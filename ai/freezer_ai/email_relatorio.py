"""E-mail com o relatório da Freezer AI (botão "Enviar por e-mail" do site)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from html import escape
from typing import Optional

from .analise import br

FUSO_BR = timezone(timedelta(hours=-3))
CORES = {"normal": "#2f9e44", "atencao": "#d97706", "critico": "#dc2626", "indeterminado": "#52647a"}
SEV = {"critico": "Crítico", "atencao": "Atenção", "info": "Informação"}


def _data(iso: Optional[str]) -> str:
    if not iso:
        return "—"
    return datetime.fromisoformat(iso).astimezone(FUSO_BR).strftime("%d/%m/%Y %H:%M")


def _num(v, casas: int = 1, sufixo: str = " °C") -> str:
    return "—" if v is None else f"{br(float(v), casas)}{sufixo}"


def conteudo_email_relatorio(rel: dict, mensagem: Optional[str], enviado_por: Optional[str],
                             url_site: str) -> tuple[str, str, str]:
    eq = rel.get("equipamento", {})
    nome = eq.get("nome") or eq.get("descricao") or "Freezer"
    local = f" ({eq['localizacao']})" if eq.get("localizacao") else ""
    periodo = rel.get("periodo", {})
    status = rel.get("status", "indeterminado")
    m = rel.get("metricas", {}) or {}
    p = m.get("periodo") or {}
    atual = (m.get("atual") or {}).get("temperatura")
    faixa = eq.get("faixa_ideal") or [None, None]
    achados = [a for a in rel.get("achados", []) if a.get("severidade") != "info"] or rel.get("achados", [])
    recs = rel.get("recomendacoes", [])
    anomalias = rel.get("anomalias", [])[:10]

    assunto = (f"[Cold-Sense] Relatório – {nome}{local}: {rel.get('status_texto', '')} "
               f"({_data(periodo.get('inicio'))[:10]} a {_data(periodo.get('fim'))[:10]})")

    linhas = []
    if mensagem:
        linhas += [mensagem.strip(), ""]
    linhas += [
        f"Relatório da Freezer AI – {nome}{local}",
        f"Período: {_data(periodo.get('inicio'))} até {_data(periodo.get('fim'))}",
        f"Status: {rel.get('status_texto', '')}"
        + (f" – saúde {rel['pontuacao_saude']}/100" if rel.get("pontuacao_saude") is not None else ""),
        f"Faixa recomendada: {_num(faixa[0])} a {_num(faixa[1])}",
        "",
        rel.get("resumo", ""),
        "",
        f"Temperatura atual/última: {_num(atual)} | média {_num(p.get('media'))} | "
        f"mín {_num(p.get('minima'))} | máx {_num(p.get('maxima'))}",
        "",
        "O que a IA identificou:",
        *[f"- [{SEV.get(a['severidade'], '')}] {a['titulo']}: {a['mensagem']}" for a in achados],
        "",
        "Recomendações:",
        *[f"- {r['texto']}" for r in recs],
    ]
    if anomalias:
        linhas += ["", "Anomalias (até 10):",
                   *[f"- {_data(a['inicio'])}: {a['descricao']}" for a in anomalias]]
    linhas += ["", f"Abrir no Cold-Sense: {url_site}",
               f"Enviado por: {enviado_por}" if enviado_por else "",
               rel.get("aviso", "")]

    cor = CORES.get(status, "#52647a")
    def li(itens):
        return "".join(f"<li style='margin-bottom:4px'>{itens_}</li>" for itens_ in itens)

    tabela_anom = ""
    if anomalias:
        tabela_anom = (
            "<p style='margin:16px 0 6px'><b>Anomalias no período</b> (até 10)</p>"
            "<table style='border-collapse:collapse;width:100%;font-size:12px'>"
            + "".join(
                f"<tr><td style='border-bottom:1px solid #e7edf3;padding:4px 6px;white-space:nowrap'>{_data(a['inicio'])}</td>"
                f"<td style='border-bottom:1px solid #e7edf3;padding:4px 6px'>{escape(a['descricao'])}</td></tr>"
                for a in anomalias)
            + "</table>")

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:620px;color:#263e54">
  {f'<p style="background:#f0f7fd;border-left:4px solid #006ecf;padding:10px 12px;margin:0 0 14px;white-space:pre-wrap">{escape(mensagem.strip())}</p>' if mensagem else ''}
  <div style="background:{cor};color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
    <div style="font-size:12px;letter-spacing:.08em">RELATÓRIO FREEZER AI</div>
    <div style="font-size:18px;font-weight:bold">{escape(nome)}{escape(local)} – {escape(rel.get('status_texto', ''))}</div>
    <div style="font-size:12px;opacity:.9">{_data(periodo.get('inicio'))} até {_data(periodo.get('fim'))}</div>
  </div>
  <div style="border:1px solid #d7e0e9;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 12px">{escape(rel.get('resumo', ''))}</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:12px">
      <tr>
        <td style="padding:6px;background:#f0f7fd"><b>Atual/última</b><br>{_num(atual)}</td>
        <td style="padding:6px;background:#f0f7fd"><b>Média</b><br>{_num(p.get('media'))}</td>
        <td style="padding:6px;background:#f0f7fd"><b>Mín / Máx</b><br>{_num(p.get('minima'))} / {_num(p.get('maxima'))}</td>
        <td style="padding:6px;background:#f0f7fd"><b>Saúde</b><br>{rel.get('pontuacao_saude') if rel.get('pontuacao_saude') is not None else '—'}/100</td>
      </tr>
    </table>
    <p style="margin:0 0 4px;font-size:12px;color:#607489">Faixa recomendada: {_num(faixa[0])} a {_num(faixa[1])}</p>
    <p style="margin:14px 0 4px"><b>O que a IA identificou</b></p>
    <ul style="margin:0;padding-left:18px">{li(f"<b>{escape(a['titulo'])}</b> ({SEV.get(a['severidade'], '')}): {escape(a['mensagem'])}" for a in achados) or '<li>Nenhum comportamento fora do padrão.</li>'}</ul>
    <p style="margin:14px 0 4px"><b>Recomendações</b></p>
    <ul style="margin:0;padding-left:18px">{li(escape(r['texto']) for r in recs) or '<li>Nenhuma ação necessária.</li>'}</ul>
    {tabela_anom}
    <p style="margin:18px 0 0"><a href="{escape(url_site)}" style="display:inline-block;background:#006ecf;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none">Abrir no Cold-Sense</a></p>
    <p style="font-size:11px;color:#607489;margin-top:16px">{('Enviado por ' + escape(enviado_por) + '. ') if enviado_por else ''}{escape(rel.get('aviso', ''))}</p>
  </div>
</div>"""
    return assunto, "\n".join(l for l in linhas if l is not None), html
