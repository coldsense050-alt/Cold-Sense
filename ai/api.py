"""API HTTP da Freezer AI (FastAPI).

O site chama esta API quando o usuário clica em "Gerar relatório".
A API lê as leituras do Supabase (somente SELECT), roda a análise e devolve
o relatório em JSON.

Rodar localmente (dentro da pasta ai/):
    uvicorn api:app --reload --port 8000

Variáveis de ambiente (arquivo ai/.env) – veja ai/.env.example:
    SUPABASE_URL, SUPABASE_KEY          -> acesso ao banco (use a chave secret: a API roda no servidor)
    FREEZER_AI_CORS_ORIGINS             -> endereços do site autorizados (separados por vírgula)
    FREEZER_AI_FONTE=simulacao          -> (opcional) usa dados simulados, para testar sem banco
    FREEZER_AI_MONITOR=0                -> (opcional) desliga o vigia automático de alertas
    SMTP_USUARIO, SMTP_SENHA            -> conta que envia os e-mails de alerta (Gmail + senha de app)
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from freezer_ai import __version__, analisar_dataframe
from freezer_ai.alertas import Monitor
from freezer_ai.config import PERFIS, Config, perfil_do_freezer
from freezer_ai.simulador import CENARIOS

load_dotenv()

PERIODO_MAXIMO_DIAS = 31
MINUTO_MAXIMO_HORAS = 72      # gráfico por minuto só até 3 dias (evita milhares de pontos)
AUTO_MINUTO_ATE_HORAS = 48    # resolução automática: por minuto até 48 h, depois por hora
HISTORICO_EXTRA_DIAS = 7      # dias antes do período usados como "padrão" do equipamento

FONTE = os.getenv("FREEZER_AI_FONTE", "supabase").strip().lower()
origens = [o.strip() for o in os.getenv("FREEZER_AI_CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

_fonte_supabase = None
MONITOR_LIGADO = os.getenv("FREEZER_AI_MONITOR", "1").strip() not in ("0", "false", "nao", "não")
monitor: Optional[Monitor] = None


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    global monitor
    monitor = Monitor(_supabase, simulacao=(FONTE == "simulacao"))
    if MONITOR_LIGADO:
        monitor.iniciar()
        print(f"[freezer-ai] vigia de alertas ligado (a cada {monitor.intervalo_s:.0f} s). "
              f"E-mail {'configurado' if monitor.email.configurado else 'NÃO configurado'}.")
    yield
    monitor.parar()


app = FastAPI(title="Freezer AI", version=__version__, description="Análise inteligente do Cold-Sense",
              lifespan=ciclo_de_vida)
app.add_middleware(CORSMiddleware, allow_origins=origens, allow_methods=["GET", "POST"], allow_headers=["*"])


def _supabase():
    global _fonte_supabase
    if _fonte_supabase is None:
        from freezer_ai.fontes import SupabaseFonte
        _fonte_supabase = SupabaseFonte(Config())
    return _fonte_supabase


def _como_utc(valor: Optional[datetime]) -> Optional[datetime]:
    if valor is None:
        return None
    return valor.replace(tzinfo=timezone.utc) if valor.tzinfo is None else valor.astimezone(timezone.utc)


@app.get("/saude")
def saude():
    return {"ok": True, "versao": __version__, "fonte": FONTE, "perfis": list(PERFIS)}


@app.get("/relatorio")
def relatorio(
    inicio: Optional[datetime] = Query(None, description="Início do período (ISO 8601). Padrão: fim - 24 h"),
    fim: Optional[datetime] = Query(None, description="Fim do período (ISO 8601). Padrão: agora"),
    perfil: str = Query("freezer"),
    resolucao: Literal["auto", "minuto", "hora"] = Query("auto"),
    alerta: Optional[float] = Query(None, description="Sobrescreve o limite de alerta (°C)"),
    critico: Optional[float] = Query(None, description="Sobrescreve o limite crítico (°C)"),
    freezer_id: Optional[int] = Query(None, description="Freezer a analisar (tabela freezers). Vazio = todas as leituras"),
    cenario: str = Query("normal", description="Só no modo simulação"),
):
    agora = datetime.now(timezone.utc)
    fim = _como_utc(fim) or agora
    inicio = _como_utc(inicio) or (fim - timedelta(hours=24))

    if perfil not in PERFIS:
        raise HTTPException(422, f"Perfil inválido. Opções: {', '.join(PERFIS)}")
    if fim > agora + timedelta(minutes=5):
        raise HTTPException(422, "O fim do período não pode estar no futuro.")
    if inicio >= fim:
        raise HTTPException(422, "O início do período deve ser anterior ao fim.")
    horas = (fim - inicio).total_seconds() / 3600
    if horas < 0.25:
        raise HTTPException(422, "Escolha um período de pelo menos 15 minutos.")
    if horas > PERIODO_MAXIMO_DIAS * 24:
        raise HTTPException(422, f"O período máximo é de {PERIODO_MAXIMO_DIAS} dias.")
    if resolucao == "minuto" and horas > MINUTO_MAXIMO_HORAS:
        raise HTTPException(422, f"Gráfico por minuto só para períodos de até {MINUTO_MAXIMO_HORAS} h.")
    if resolucao == "auto":
        resolucao = "minuto" if horas <= AUTO_MINUTO_ATE_HORAS else "hora"

    extra = HISTORICO_EXTRA_DIAS if horas <= 7 * 24 else 0
    config = replace(Config(), janela_horas=horas, historico_dias=horas / 24 + extra)
    tempo_real = (agora - fim) <= timedelta(minutes=2)

    try:
        if FONTE == "simulacao":
            if cenario not in CENARIOS:
                raise HTTPException(422, f"Cenário inválido. Opções: {', '.join(CENARIOS)}")
            from freezer_ai.fontes import _padronizar
            from freezer_ai.simulador import gerar
            bruto = gerar(cenario, dias=config.historico_dias, fim=fim.replace(microsecond=0))
            df = _padronizar(bruto, "coletado_em", "temperatura")
            origem = f"simulacao:{cenario}"
        else:
            fonte = _supabase()
            df = fonte.buscar(desde=fim - timedelta(days=config.historico_dias), ate=fim, dispositivo=freezer_id)
            origem = f"supabase:{config.tabela}"
            if freezer_id is not None:
                nome = fonte.nome_freezer(freezer_id)
                origem += f" · freezer {freezer_id}" + (f" ({nome})" if nome else "")
    except HTTPException:
        raise
    except Exception as erro:  # noqa: BLE001 – não expõe detalhes internos/credenciais
        print(f"[freezer-ai] erro ao buscar dados: {type(erro).__name__}: {erro}")
        raise HTTPException(502, "Não foi possível buscar as leituras no banco de dados.") from None

    # Faixa recomendada cadastrada no freezer (temperatura_min / temperatura_max)
    cadastro = None
    if freezer_id is not None and FONTE != "simulacao":
        try:
            cadastro = _supabase().freezer(freezer_id)
        except Exception as erro:  # noqa: BLE001
            print(f"[freezer-ai] não foi possível ler o cadastro do freezer {freezer_id}: {erro}")
    elif FONTE == "simulacao":
        cadastro = {"id": 1, "nome": "Freezer simulado", "temperatura_min": -25.0, "temperatura_max": -10.0}
    perfil_usado = (perfil_do_freezer(cadastro) if cadastro else None) or perfil

    try:
        rel = analisar_dataframe(
            df, perfil_usado, config, agora=fim, fonte=origem, tempo_real=tempo_real, resolucao=resolucao,
            limite_alerta=alerta, limite_critico=critico,
        )
    except ValueError as erro:
        raise HTTPException(422, str(erro)) from None
    rel["equipamento"]["origem_limites"] = "cadastro" if perfil_usado is not perfil else "padrao"
    if alerta is not None or critico is not None:
        rel["equipamento"]["origem_limites"] = "manual"
    if cadastro:
        rel["equipamento"].update({k: cadastro.get(k) for k in ("nome", "localizacao", "marca", "modelo")})
    return rel


@app.post("/relatorio/enviar")
def enviar_relatorio(dados: dict = Body(...)):
    """Envia um relatório já gerado para prestadores cadastrados.

    Corpo: {"relatorio": {...}, "para": ["email", ...], "mensagem": "...", "enviado_por": "..."}
    Por segurança, só aceita destinatários cadastrados (prestadores ativos) ou
    listados em FREEZER_AI_EMAIL_COPIA – a API não envia para qualquer endereço.
    """
    from freezer_ai.email_relatorio import conteudo_email_relatorio

    m = _monitor()
    rel = dados.get("relatorio")
    para = [str(e).strip().lower() for e in (dados.get("para") or []) if str(e).strip()]
    if not isinstance(rel, dict) or "status" not in rel:
        raise HTTPException(422, "Relatório inválido. Gere o relatório antes de enviar.")
    if not para:
        raise HTTPException(422, "Escolha pelo menos um destinatário.")
    if len(para) > 20:
        raise HTTPException(422, "Escolha no máximo 20 destinatários.")
    if not m.email.configurado:
        raise HTTPException(503, "O envio de e-mail não está configurado (SMTP_USUARIO e SMTP_SENHA no ai/.env).")

    permitidos = {e.lower() for e in m.email.copias}
    try:
        permitidos |= {p["email"].strip().lower() for p in _supabase().prestadores_ativos()}
    except Exception as erro:  # noqa: BLE001
        print(f"[freezer-ai] não foi possível ler os prestadores: {erro}")
        if not permitidos:
            raise HTTPException(502, "Não foi possível consultar os prestadores cadastrados.") from None
    fora = [e for e in para if e not in permitidos]
    if fora:
        raise HTTPException(422, f"Destinatário(s) não cadastrado(s) como prestador ativo: {', '.join(fora)}")

    mensagem = (dados.get("mensagem") or "").strip()[:2000] or None
    enviado_por = (dados.get("enviado_por") or "").strip()[:200] or None
    assunto, texto, html = conteudo_email_relatorio(rel, mensagem, enviado_por, m.url_site)
    try:
        m.email.enviar(sorted(set(para)), assunto, texto, html)
    except Exception as erro:  # noqa: BLE001
        raise HTTPException(502, f"Falha no envio: {erro}") from None
    return {"ok": True, "para": sorted(set(para)), "assunto": assunto}


# --------------------------------------------------------------------------- #
# Alertas automáticos
# --------------------------------------------------------------------------- #
def _monitor() -> Monitor:
    if monitor is None:
        raise HTTPException(503, "O vigia de alertas ainda não foi iniciado.")
    return monitor


@app.get("/alertas")
def listar_alertas():
    """Alertas ativos, histórico recente e situação do vigia (o site consulta a cada 30 s)."""
    return _monitor().estado()


@app.post("/alertas/verificar")
def verificar_agora():
    """Roda uma verificação imediata (sem esperar o próximo ciclo)."""
    return _monitor().verificar()


@app.post("/alertas/{alerta_id}/ciente")
def marcar_ciente(alerta_id: str, dados: dict = Body(default={})):
    alerta = _monitor().marcar_ciente(alerta_id, dados.get("por"))
    if alerta is None:
        raise HTTPException(404, "Alerta não encontrado ou já encerrado.")
    return alerta


@app.post("/alertas/teste-email")
def teste_email():
    """Envia um e-mail de teste para a própria conta remetente (e para as cópias configuradas)."""
    try:
        return _monitor().enviar_teste()
    except Exception as erro:  # noqa: BLE001
        raise HTTPException(502, f"Falha no envio: {erro}") from None


@app.post("/alertas/simular")
def simular(cenario: str = Query(..., description="Cenário do simulador")):
    """Só no modo simulação: troca o cenário que o vigia está observando."""
    m = _monitor()
    if not m.simulacao:
        raise HTTPException(400, "Disponível apenas com FREEZER_AI_FONTE=simulacao.")
    if cenario not in CENARIOS:
        raise HTTPException(422, f"Cenário inválido. Opções: {', '.join(CENARIOS)}")
    m.definir_cenario(cenario)
    return m.verificar()
