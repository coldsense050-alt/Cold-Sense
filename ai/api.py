"""API HTTP da Freezer AI (FastAPI).

O site chama esta API quando o usuário clica em "Gerar relatório".
A API lê as leituras do Supabase (somente SELECT), roda a análise e devolve
o relatório em JSON.

Rodar localmente (dentro da pasta ai/):
    uvicorn api:app --reload --port 8000

Variáveis de ambiente (arquivo ai/.env):
    SUPABASE_URL, SUPABASE_KEY          -> acesso de leitura ao banco
    FREEZER_AI_CORS_ORIGINS             -> endereços do site autorizados (separados por vírgula)
    FREEZER_AI_FONTE=simulacao          -> (opcional) usa dados simulados, para testar sem banco
"""

from __future__ import annotations

import os
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from freezer_ai import __version__, analisar_dataframe
from freezer_ai.config import PERFIS, Config
from freezer_ai.simulador import CENARIOS

load_dotenv()

PERIODO_MAXIMO_DIAS = 31
MINUTO_MAXIMO_HORAS = 72      # gráfico por minuto só até 3 dias (evita milhares de pontos)
AUTO_MINUTO_ATE_HORAS = 48    # resolução automática: por minuto até 48 h, depois por hora
HISTORICO_EXTRA_DIAS = 7      # dias antes do período usados como "padrão" do equipamento

FONTE = os.getenv("FREEZER_AI_FONTE", "supabase").strip().lower()
origens = [o.strip() for o in os.getenv("FREEZER_AI_CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app = FastAPI(title="Freezer AI", version=__version__, description="Análise inteligente do Cold-Sense")
app.add_middleware(CORSMiddleware, allow_origins=origens, allow_methods=["GET"], allow_headers=["*"])

_fonte_supabase = None


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

    try:
        return analisar_dataframe(
            df, perfil, config, agora=fim, fonte=origem, tempo_real=tempo_real, resolucao=resolucao,
            limite_alerta=alerta, limite_critico=critico,
        )
    except ValueError as erro:
        raise HTTPException(422, str(erro)) from None
