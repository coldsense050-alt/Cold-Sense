"""Vigia automático da Freezer AI: alertas na tela e por e-mail.

Como funciona
-------------
A cada `FREEZER_AI_MONITOR_INTERVALO_S` segundos (padrão 60) o vigia:
  1. lista os freezers cadastrados que enviaram leituras recentemente;
  2. analisa a última hora de cada um com a MESMA IA dos relatórios, usando a
     faixa recomendada do cadastro (temperatura_min / temperatura_max);
  3. abre, atualiza ou encerra um alerta por freezer;
  4. em situação crítica, envia e-mail aos prestadores de manutenção ATIVOS
     ligados ao freezer (tabela freezers_prestadores) + cópias configuradas.

Para não gerar alarme falso nem spam:
  - "atenção" só vira alerta se persistir por `CONFIRMACOES_ATENCAO` verificações;
  - "crítico" vira alerta na hora;
  - o alerta só é encerrado após `CONFIRMACOES_NORMAL` verificações normais;
  - e-mail de lembrete no máximo a cada `FREEZER_AI_EMAIL_LEMBRETE_MIN` minutos,
    e só enquanto ninguém marcar o alerta como "ciente".

Os alertas ficam na memória da API (não cria tabela no banco). Ao reiniciar a
API, o histórico é perdido, mas um problema ainda presente gera alerta de novo.
"""

from __future__ import annotations

import os
import smtplib
import ssl
import threading
import traceback
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html import escape
from typing import Callable, Optional

import pandas as pd

from . import analisar_dataframe
from .analise import br
from .config import PERFIS, Config, Perfil, perfil_do_freezer

# Achados que justificam um alerta automático (os demais só aparecem nos relatórios)
CODIGOS_ALERTA = {
    "temperatura_critica",
    "temperatura_alta",
    "temperatura_baixa",
    "excursao_prolongada",
    "subida_continua",
    "sem_dados_recentes",
    "sem_dados",
    "falha_sensor",
    "elevacoes_curtas_frequentes",
    "picos_ciclicos_acima_limite",
}
ORDEM = {"normal": 0, "atencao": 1, "critico": 2}


def _env_float(nome: str, padrao: float) -> float:
    try:
        return float(os.getenv(nome, padrao))
    except ValueError:
        return padrao


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


# --------------------------------------------------------------------------- #
# E-mail (SMTP – funciona com Gmail usando "senha de app")
# --------------------------------------------------------------------------- #
class Email:
    def __init__(self):
        self.host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.porta = int(os.getenv("SMTP_PORTA", "587"))
        self.usuario = os.getenv("SMTP_USUARIO", "").strip()
        self.senha = os.getenv("SMTP_SENHA", "").replace(" ", "").strip()
        self.remetente = os.getenv("EMAIL_REMETENTE", self.usuario).strip()
        self.copias = [e.strip() for e in os.getenv("FREEZER_AI_EMAIL_COPIA", "").split(",") if e.strip()]

    @property
    def configurado(self) -> bool:
        return bool(self.usuario and self.senha)

    def enviar(self, para: list[str], assunto: str, texto: str, html: str) -> None:
        if not self.configurado:
            raise RuntimeError("E-mail não configurado (SMTP_USUARIO e SMTP_SENHA no ai/.env).")
        if not para:
            raise RuntimeError("Nenhum destinatário.")
        msg = EmailMessage()
        msg["From"] = f"Cold-Sense Alertas <{self.remetente}>"
        msg["To"] = ", ".join(para)
        msg["Subject"] = assunto
        msg.set_content(texto)
        msg.add_alternative(html, subtype="html")
        contexto = ssl.create_default_context()
        if self.porta == 465:
            with smtplib.SMTP_SSL(self.host, self.porta, context=contexto, timeout=20) as s:
                s.login(self.usuario, self.senha)
                s.send_message(msg)
        else:
            with smtplib.SMTP(self.host, self.porta, timeout=20) as s:
                s.starttls(context=contexto)
                s.login(self.usuario, self.senha)
                s.send_message(msg)


def _conteudo_email(alerta: dict, url_site: str, normalizado: bool = False) -> tuple[str, str, str]:
    fz = alerta["freezer"]
    nome = fz.get("nome") or f"Freezer {fz.get('id')}"
    local = f" ({fz['localizacao']})" if fz.get("localizacao") else ""
    temp = alerta.get("temperatura")
    temp_txt = f"{br(temp)} °C" if temp is not None else "sem leitura"
    faixa = alerta.get("faixa")
    faixa_txt = f"{br(faixa[0])} a {br(faixa[1])} °C" if faixa else "não cadastrada"
    inicio = datetime.fromisoformat(alerta["inicio"]).astimezone(timezone(timedelta(hours=-3)))

    if normalizado:
        assunto = f"[Cold-Sense] Normalizado – {nome}{local}"
        texto = (f"O alerta do freezer {nome}{local} foi encerrado: a temperatura voltou ao normal "
                 f"({temp_txt}).\nInício do problema: {inicio:%d/%m/%Y %H:%M}.\n\n{url_site}")
        html = (f"<p>O alerta do freezer <b>{escape(nome)}</b>{escape(local)} foi <b>encerrado</b>: "
                f"a temperatura voltou ao normal ({escape(temp_txt)}).</p>"
                f"<p>Início do problema: {inicio:%d/%m/%Y %H:%M}.</p><p><a href='{escape(url_site)}'>Abrir o Cold-Sense</a></p>")
        return assunto, texto, html

    nivel = "CRÍTICO" if alerta["nivel"] == "critico" else "ATENÇÃO"
    assunto = f"[Cold-Sense] {nivel} – {nome}{local}: {temp_txt}"
    equip = " ".join(x for x in (fz.get("marca"), fz.get("modelo")) if x)
    achados = alerta.get("achados", [])
    recs = alerta.get("recomendacoes", [])

    linhas = [
        f"{nivel}: {alerta['titulo']}",
        "",
        f"Freezer: {nome}{local}" + (f" – {equip}" if equip else ""),
        f"Temperatura: {temp_txt} (faixa recomendada: {faixa_txt})",
        f"Desde: {inicio:%d/%m/%Y %H:%M}",
        "",
        "O que a Freezer AI identificou:",
        *[f"- {a['mensagem']}" for a in achados],
        "",
        "Recomendações:",
        *[f"- {r}" for r in recs],
        "",
        f"Acompanhe no sistema: {url_site}",
        "",
        "Mensagem automática do Cold-Sense. Análise baseada nas leituras de temperatura; "
        "não substitui a avaliação técnica.",
    ]
    cor = "#dc2626" if alerta["nivel"] == "critico" else "#d97706"
    html = f"""
<div style="font-family:Arial,sans-serif;max-width:560px;color:#263e54">
  <div style="background:{cor};color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
    <div style="font-size:12px;letter-spacing:.08em">{nivel}</div>
    <div style="font-size:18px;font-weight:bold">{escape(alerta['titulo'])}</div>
  </div>
  <div style="border:1px solid #d7e0e9;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 6px"><b>Freezer:</b> {escape(nome)}{escape(local)}{(' – ' + escape(equip)) if equip else ''}</p>
    <p style="margin:0 0 6px"><b>Temperatura:</b> {escape(temp_txt)} <span style="color:#607489">(faixa recomendada: {escape(faixa_txt)})</span></p>
    <p style="margin:0 0 14px"><b>Desde:</b> {inicio:%d/%m/%Y %H:%M}</p>
    <p style="margin:0 0 4px"><b>O que a Freezer AI identificou:</b></p>
    <ul style="margin:0 0 14px;padding-left:18px">{''.join(f'<li>{escape(a["mensagem"])}</li>' for a in achados)}</ul>
    <p style="margin:0 0 4px"><b>Recomendações:</b></p>
    <ul style="margin:0 0 14px;padding-left:18px">{''.join(f'<li>{escape(r)}</li>' for r in recs)}</ul>
    <a href="{escape(url_site)}" style="display:inline-block;background:#006ecf;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">Abrir o Cold-Sense</a>
    <p style="font-size:11px;color:#607489;margin-top:16px">Mensagem automática do Cold-Sense. Análise baseada nas leituras de temperatura; não substitui a avaliação técnica.</p>
  </div>
</div>"""
    return assunto, "\n".join(linhas), html


# --------------------------------------------------------------------------- #
# Vigia
# --------------------------------------------------------------------------- #
class Monitor:
    def __init__(
        self,
        obter_fonte: Callable[[], object],
        simulacao: bool = False,
        email: Optional[Email] = None,
    ):
        self._obter_fonte = obter_fonte
        self.simulacao = simulacao
        self.cenario_simulado = os.getenv("FREEZER_AI_MONITOR_CENARIO", "normal")
        self.email = email or Email()
        self.intervalo_s = _env_float("FREEZER_AI_MONITOR_INTERVALO_S", 60)
        self.janela_atividade_h = _env_float("FREEZER_AI_MONITOR_ATIVIDADE_H", 24)
        self.lembrete_min = _env_float("FREEZER_AI_EMAIL_LEMBRETE_MIN", 60)
        self.email_nivel = os.getenv("FREEZER_AI_EMAIL_NIVEL", "critico").strip().lower()
        self.url_site = os.getenv("FREEZER_AI_URL_SITE", "http://localhost:5173/freezer-ai")
        self.confirmacoes_atencao = int(_env_float("FREEZER_AI_CONFIRMACOES_ATENCAO", 2))
        self.confirmacoes_normal = int(_env_float("FREEZER_AI_CONFIRMACOES_NORMAL", 3))

        self._lock = threading.RLock()
        self._parar = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.ativos: dict[int, dict] = {}       # freezer_id -> alerta
        self.historico: list[dict] = []          # alertas encerrados (mais recentes primeiro)
        self._contagem: dict[int, dict] = {}     # freezer_id -> {"atencao": n, "normal": n}
        self.ultima_verificacao: Optional[datetime] = None
        self.ultimo_erro: Optional[str] = None
        self.freezers_monitorados: list[dict] = []

    # ---------------- ciclo ----------------
    def iniciar(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._parar.clear()
        self._thread = threading.Thread(target=self._loop, name="freezer-ai-monitor", daemon=True)
        self._thread.start()

    def parar(self) -> None:
        self._parar.set()

    def _loop(self) -> None:
        while not self._parar.is_set():
            self.verificar()
            self._parar.wait(self.intervalo_s)

    # ---------------- dados ----------------
    def _freezers_e_dados(self) -> list[tuple[dict, pd.DataFrame, Optional[datetime]]]:
        agora = _agora()
        if self.simulacao:
            from .fontes import _padronizar
            from .simulador import gerar
            fz = {"id": 1, "nome": "Freezer simulado", "localizacao": "Simulação",
                  "temperatura_min": -25.0, "temperatura_max": -10.0}
            bruto = gerar(self.cenario_simulado, dias=2 / 24, fim=agora.replace(microsecond=0))
            df = _padronizar(bruto, "coletado_em", "temperatura")
            return [(fz, df, df["ts"].max() if not df.empty else None)]

        fonte = self._obter_fonte()
        try:
            freezers = fonte.freezers()
        except Exception:  # noqa: BLE001 – sem tabela de freezers: monitora todas as leituras
            freezers = []
        if not freezers:
            freezers = [{"id": None, "nome": "Todas as leituras"}]
        saida = []
        for fz in freezers:
            ultima = fonte.ultima_leitura(fz.get("id"))
            if ultima is None or agora - ultima > timedelta(hours=self.janela_atividade_h):
                continue  # freezer sem ESP32 ligado (ou parado há muito tempo): não monitora
            df = fonte.buscar(desde=agora - timedelta(hours=1), ate=agora, dispositivo=fz.get("id"))
            saida.append((fz, df, ultima))
        return saida

    # ---------------- análise ----------------
    def _analisar(self, fz: dict, df: pd.DataFrame, ultima: Optional[datetime] = None) -> dict:
        perfil: Perfil = perfil_do_freezer(fz) or PERFIS["freezer"]
        faixa = [perfil.ideal_min, perfil.ideal_max]
        limites = {"alerta": perfil.limite_alerta, "critico": perfil.limite_critico,
                   "minimo": perfil.limite_minimo_alerta}
        if df.empty and ultima is not None:
            # nenhuma leitura na última hora: ESP32 desligado, sem Wi-Fi ou sem energia
            minutos = (_agora() - ultima).total_seconds() / 60
            horas = minutos / 60
            quanto = f"{br(horas)} h" if horas >= 1.5 else f"{int(minutos)} min"
            return {
                "nivel": "critico",
                "achados": [{"codigo": "sem_dados_recentes", "severidade": "critico",
                             "titulo": "Sem leituras do freezer",
                             "mensagem": f"O freezer não envia leituras há {quanto}. A temperatura atual é "
                                         "desconhecida; pode ser falta de energia, ESP32 desligado ou sem conexão."}],
                "recomendacoes": ["Verifique se o freezer e o ESP32 estão ligados e com energia.",
                                  "Verifique a conexão do ESP32 e o programa que envia as leituras."],
                "temperatura": None, "titulo": "Sem leituras do freezer",
                "faixa": faixa, "limites": limites,
            }
        config = replace(Config(), janela_horas=1.0, historico_dias=1 / 24, limite_sem_dados_min=10.0)
        rel = analisar_dataframe(df, perfil, config, agora=_agora(), fonte="monitor", tempo_real=True)
        achados = [a for a in rel["achados"] if a["codigo"] in CODIGOS_ALERTA and a["severidade"] != "info"]
        nivel = "normal"
        for a in achados:
            if ORDEM[a["severidade"]] > ORDEM[nivel]:
                nivel = a["severidade"]
        codigos = {a["codigo"] for a in achados}
        recs = [r["texto"] for r in rel["recomendacoes"] if r["motivo"] in codigos]
        temp = (rel["metricas"].get("atual") or {}).get("temperatura")
        principal = sorted(achados, key=lambda a: -ORDEM[a["severidade"]])[0] if achados else None
        return {
            "nivel": nivel,
            "achados": [{"codigo": a["codigo"], "severidade": a["severidade"],
                         "titulo": a["titulo"], "mensagem": a["mensagem"]} for a in achados],
            "recomendacoes": recs,
            "temperatura": temp,
            "titulo": principal["titulo"] if principal else "",
            "faixa": faixa,
            "limites": limites,
        }

    def verificar(self) -> dict:
        """Roda uma verificação completa. Seguro para chamar a qualquer momento."""
        try:
            pacotes = self._freezers_e_dados()
            with self._lock:
                self.freezers_monitorados = [
                    {"id": fz.get("id"), "nome": fz.get("nome"), "ultima_leitura": _iso(ultima)}
                    for fz, _, ultima in pacotes
                ]
            for fz, df, ultima in pacotes:
                self._processar(fz, self._analisar(fz, df, ultima))
            with self._lock:
                self.ultima_verificacao = _agora()
                self.ultimo_erro = None
        except Exception as erro:  # noqa: BLE001
            with self._lock:
                self.ultimo_erro = f"{type(erro).__name__}: {erro}"
            print("[freezer-ai][monitor] erro:", self.ultimo_erro)
            traceback.print_exc()
        return self.estado()

    def _processar(self, fz: dict, r: dict) -> None:
        fid = fz.get("id") if fz.get("id") is not None else 0
        agora = _agora()
        with self._lock:
            cont = self._contagem.setdefault(fid, {"atencao": 0, "normal": 0})
            ativo = self.ativos.get(fid)

            if r["nivel"] == "normal":
                cont["atencao"] = 0
                if ativo:
                    cont["normal"] += 1
                    if cont["normal"] >= self.confirmacoes_normal:
                        self._encerrar(fid, r["temperatura"])
                return

            cont["normal"] = 0
            if r["nivel"] == "atencao" and not ativo:
                cont["atencao"] += 1
                if cont["atencao"] < self.confirmacoes_atencao:
                    return  # aguarda confirmar (evita alarme por abertura rápida de porta)

            if not ativo:
                ativo = {
                    "id": uuid.uuid4().hex[:12],
                    "freezer": {k: fz.get(k) for k in ("id", "nome", "localizacao", "marca", "modelo")},
                    "inicio": _iso(agora),
                    "ciente": False, "ciente_por": None, "ciente_em": None,
                    "emails": [], "nivel_maximo": r["nivel"], "encerrado_em": None,
                }
                self.ativos[fid] = ativo
            escalou = ORDEM[r["nivel"]] > ORDEM[ativo.get("nivel", "normal")]
            ativo.update({
                "nivel": r["nivel"], "titulo": r["titulo"], "achados": r["achados"],
                "recomendacoes": r["recomendacoes"], "temperatura": r["temperatura"],
                "faixa": r["faixa"], "limites": r["limites"], "atualizado_em": _iso(agora),
            })
            if ORDEM[r["nivel"]] > ORDEM[ativo["nivel_maximo"]]:
                ativo["nivel_maximo"] = r["nivel"]
            if escalou and r["nivel"] == "critico":
                ativo["ciente"] = False  # piorou: precisa de nova confirmação

            if self._deve_enviar(ativo, escalou):
                self._enviar_em_segundo_plano(ativo)

    def _deve_enviar(self, alerta: dict, escalou: bool) -> bool:
        if ORDEM[alerta["nivel"]] < ORDEM.get(self.email_nivel, 2):
            return False
        enviados = [e for e in alerta["emails"] if e.get("tipo") == "alerta"]
        if not enviados or escalou:
            return True
        if alerta["ciente"]:
            return False
        ultimo = datetime.fromisoformat(enviados[-1]["em"])
        return _agora() - ultimo >= timedelta(minutes=self.lembrete_min)

    def _destinatarios(self, freezer_id: Optional[int]) -> list[str]:
        emails: list[str] = []
        if not self.simulacao and freezer_id is not None:
            try:
                emails += [p["email"] for p in self._obter_fonte().prestadores_do_freezer(freezer_id)]
            except Exception as erro:  # noqa: BLE001
                print("[freezer-ai][monitor] não foi possível ler os prestadores:", erro)
        emails += self.email.copias
        return sorted(set(e for e in emails if e))

    def _enviar_em_segundo_plano(self, alerta: dict, normalizado: bool = False) -> None:
        registro = {"em": _iso(_agora()), "tipo": "normalizado" if normalizado else "alerta",
                    "para": [], "ok": False, "erro": None}
        alerta["emails"].append(registro)
        copia = dict(alerta)

        def tarefa():
            try:
                para = self._destinatarios(copia["freezer"].get("id"))
                registro["para"] = para
                assunto, texto, html = _conteudo_email(copia, self.url_site, normalizado)
                self.email.enviar(para, assunto, texto, html)
                registro["ok"] = True
                print(f"[freezer-ai][monitor] e-mail enviado para {', '.join(para)}: {assunto}")
            except Exception as erro:  # noqa: BLE001
                registro["erro"] = str(erro)
                print("[freezer-ai][monitor] e-mail NÃO enviado:", erro)

        threading.Thread(target=tarefa, daemon=True).start()

    def _encerrar(self, fid: int, temperatura: Optional[float]) -> None:
        alerta = self.ativos.pop(fid)
        alerta["encerrado_em"] = _iso(_agora())
        alerta["temperatura_final"] = temperatura
        if any(e.get("ok") and e.get("tipo") == "alerta" for e in alerta["emails"]):
            alerta["temperatura"] = temperatura
            self._enviar_em_segundo_plano(alerta, normalizado=True)
        self.historico.insert(0, alerta)
        del self.historico[50:]
        self._contagem[fid] = {"atencao": 0, "normal": 0}

    # ---------------- ações ----------------
    def marcar_ciente(self, alerta_id: str, por: Optional[str]) -> Optional[dict]:
        with self._lock:
            for alerta in self.ativos.values():
                if alerta["id"] == alerta_id:
                    alerta.update({"ciente": True, "ciente_por": (por or "").strip() or None,
                                   "ciente_em": _iso(_agora())})
                    return dict(alerta)
        return None

    def definir_cenario(self, cenario: str) -> None:
        self.cenario_simulado = cenario

    def enviar_teste(self) -> dict:
        destino = [self.email.usuario] + self.email.copias
        destino = sorted(set(e for e in destino if e))
        assunto = "[Cold-Sense] Teste de e-mail da Freezer AI"
        texto = "Se você recebeu esta mensagem, o envio de alertas por e-mail está funcionando."
        self.email.enviar(destino, assunto, texto, f"<p>{texto}</p>")
        return {"ok": True, "para": destino}

    def estado(self) -> dict:
        with self._lock:
            return {
                "ativos": sorted((dict(a) for a in self.ativos.values()),
                                 key=lambda a: (-ORDEM[a["nivel"]], a["inicio"])),
                "historico": [dict(a) for a in self.historico[:20]],
                "monitor": {
                    "ativo": bool(self._thread and self._thread.is_alive()),
                    "simulacao": self.simulacao,
                    "cenario": self.cenario_simulado if self.simulacao else None,
                    "intervalo_s": self.intervalo_s,
                    "ultima_verificacao": _iso(self.ultima_verificacao),
                    "ultimo_erro": self.ultimo_erro,
                    "email_configurado": self.email.configurado,
                    "email_nivel": self.email_nivel,
                    "freezers_monitorados": self.freezers_monitorados,
                },
            }
