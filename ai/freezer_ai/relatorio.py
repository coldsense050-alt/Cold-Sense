"""Transforma o resultado da análise em um relatório para o usuário.

Saída principal: dicionário JSON-serializável (contrato descrito em
tipos/freezer-ai.ts) + versão em texto para leitura no terminal.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from . import __version__
from .analise import br

VERSAO_FORMATO = "1.0"

ORDEM = {"critico": 0, "atencao": 1, "info": 2}

# Recomendações ligadas a cada tipo de achado. A IA só recomenda algo se o
# achado correspondente foi identificado nos dados.
RECOMENDACOES: dict[str, list[tuple[str, str]]] = {
    "temperatura_critica": [
        ("alta", "Verifique imediatamente se o equipamento está ligado e refrigerando."),
        ("alta", "Se a temperatura não voltar a baixar, transfira os produtos para outro equipamento e avalie se ainda estão próprios para uso."),
    ],
    "temperatura_alta": [
        ("alta", "Verifique se a porta está bem fechada e se o equipamento está ligado e refrigerando."),
    ],
    "temperatura_baixa": [
        ("media", "Verifique o ajuste do termostato: a temperatura está abaixo da faixa recomendada."),
    ],
    "excursao_prolongada": [
        ("alta", "Verifique o funcionamento do sistema de refrigeração (compressor, ventilador e termostato)."),
        ("media", "Avalie se os produtos expostos à temperatura elevada continuam próprios para uso."),
    ],
    "subida_continua": [
        ("alta", "Verifique se a porta está fechada e se o compressor está funcionando."),
    ],
    "aumento_incomum": [
        ("media", "Verifique a vedação da porta e se foram colocados produtos quentes recentemente."),
    ],
    "picos_ciclicos_acima_limite": [
        ("media", "Verifique o ajuste do termostato e a limpeza/ventilação do condensador."),
        ("media", "Se o ajuste não resolver, solicite avaliação técnica da capacidade de refrigeração."),
    ],
    "elevacoes_curtas_frequentes": [
        ("media", "Reduza a frequência e o tempo de abertura da porta e confira se ela fecha completamente."),
        ("baixa", "Verifique o estado da borracha de vedação da porta."),
    ],
    "oscilacao_elevada": [
        ("media", "Verifique termostato, vedação da porta e a ventilação do condensador (parte traseira)."),
        ("baixa", "Se as oscilações persistirem, solicite avaliação de um técnico de refrigeração."),
    ],
    "variacoes_bruscas": [
        ("baixa", "Verifique se o sensor está bem fixado e protegido do fluxo direto de ar da porta."),
    ],
    "tendencia_aquecimento": [
        ("media", "Agende manutenção preventiva: limpeza do condensador, verificação do gás refrigerante e da vedação."),
    ],
    "perda_estabilidade": [
        ("media", "Agende uma avaliação técnica preventiva: o equipamento está ficando menos estável."),
    ],
    "falha_sensor": [
        ("media", "Verifique o cabo e as conexões do sensor DS18B20 com o ESP32."),
    ],
    "picos_isolados": [
        ("baixa", "Verifique a fixação do sensor e possíveis interferências no cabo."),
    ],
    "sem_dados_recentes": [
        ("alta", "Verifique se o ESP32 está ligado, conectado ao Wi-Fi e enviando dados."),
    ],
    "sem_dados": [
        ("alta", "Verifique se o ESP32 está ligado e se o envio de dados ao Supabase está funcionando."),
    ],
    "cobertura_baixa": [
        ("baixa", "Verifique a estabilidade da conexão do ESP32; falhas de envio reduzem a precisão da análise."),
    ],
}

TEXTO_STATUS = {
    "normal": "Funcionando normalmente",
    "atencao": "Requer atenção",
    "critico": "Situação crítica",
    "indeterminado": "Não foi possível avaliar",
}


def _status(resultado: dict) -> str:
    sevs = {a["severidade"] for a in resultado["achados"]}
    if "critico" in sevs:
        return "critico"
    if not resultado["suficiente"]:
        return "indeterminado"
    if "atencao" in sevs:
        return "atencao"
    return "normal"


def _pontuacao(resultado: dict, status: str) -> int | None:
    """Índice de saúde 0-100 (regra simples e transparente: crítico -40, atenção -15)."""
    if status == "indeterminado":
        return None
    p = 100
    for a in resultado["achados"]:
        p -= {"critico": 40, "atencao": 15}.get(a["severidade"], 0)
    return max(0, p)


def _resumo(resultado: dict, status: str) -> str:
    m = resultado["metricas"]
    achados = sorted(resultado["achados"], key=lambda a: ORDEM[a["severidade"]])
    partes = []
    atual = (m.get("atual") or {}).get("temperatura")
    if status == "indeterminado":
        partes.append("Ainda não há dados suficientes para avaliar o equipamento com segurança.")
    elif status == "normal":
        p = m.get("periodo", {})
        partes.append(
            f"O equipamento funcionou dentro do esperado no período. Temperatura "
            f"{'atual' if resultado['tempo_real'] else 'no fim do período'} de {br(atual)} °C, "
            f"média de {br(p.get('media'))} °C no período, com {br(p.get('percentual_na_faixa_ideal'), 0)}% "
            "do tempo na faixa ideal."
        )
    else:
        sem_dados = any(a["codigo"] in ("sem_dados_recentes", "sem_dados") for a in achados)
        ja_cita = any(a["codigo"] in ("temperatura_critica", "temperatura_alta", "temperatura_baixa") for a in achados)
        if ja_cita:
            pass  # a primeira frase do achado já informa a temperatura
        elif atual is not None and not sem_dados:
            rotulo = "Temperatura atual" if resultado["tempo_real"] else "Temperatura no fim do período"
            partes.append(f"{rotulo}: {br(atual)} °C.")
        elif atual is not None:
            partes.append(f"Última temperatura registrada: {br(atual)} °C.")
        principais = [a for a in achados if a["severidade"] != "info"][:3]
        partes.extend(a["mensagem"] for a in principais)
    return " ".join(partes)


def gerar_relatorio(resultado: dict, fonte: str = "desconhecida") -> dict:
    status = _status(resultado)
    achados = sorted(resultado["achados"], key=lambda a: ORDEM[a["severidade"]])

    recomendacoes, vistas = [], set()
    for a in achados:
        for prioridade, texto in RECOMENDACOES.get(a["codigo"], []):
            if texto in vistas:
                continue
            vistas.add(texto)
            recomendacoes.append({"prioridade": prioridade, "texto": texto, "motivo": a["codigo"]})
    ordem_p = {"alta": 0, "media": 1, "baixa": 2}
    recomendacoes.sort(key=lambda r: ordem_p[r["prioridade"]])
    recomendacoes = recomendacoes[:6]  # mantém a lista curta e acionável

    return {
        "versao_formato": VERSAO_FORMATO,
        "gerado_por": f"Freezer AI {__version__}",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "referencia": resultado["agora"],
        "periodo": {"inicio": resultado["inicio"], "fim": resultado["agora"], "tempo_real": resultado["tempo_real"]},
        "fonte": fonte,
        "equipamento": {
            "perfil": resultado["perfil"]["nome"],
            "descricao": resultado["perfil"]["descricao"],
            "faixa_ideal": [resultado["perfil"]["ideal_min"], resultado["perfil"]["ideal_max"]],
            "limite_alerta": resultado["perfil"]["limite_alerta"],
            "limite_critico": resultado["perfil"]["limite_critico"],
        },
        "status": status,
        "status_texto": TEXTO_STATUS[status],
        "pontuacao_saude": _pontuacao(resultado, status),
        "resumo": _resumo(resultado, status),
        "achados": achados,
        "recomendacoes": recomendacoes,
        "metricas": resultado["metricas"],
        "qualidade_dados": resultado["qualidade_dados"],
        "anomalias": resultado["anomalias"],
        "serie": resultado["serie"],
        "parametros": resultado["parametros"],
        "aviso": (
            "Análise automática baseada apenas nas leituras de temperatura. "
            "Não substitui a avaliação de um técnico de refrigeração."
        ),
    }


def para_json(relatorio: dict, indent: int = 2) -> str:
    return json.dumps(relatorio, ensure_ascii=False, indent=indent, default=str)


def para_texto(rel: dict) -> str:
    icones = {"critico": "[CRÍTICO]", "atencao": "[ATENÇÃO]", "info": "[INFO]"}
    linhas = [
        "=" * 70,
        f" FREEZER AI – Relatório ({rel['equipamento']['descricao']})",
        "=" * 70,
        f"Status: {rel['status_texto'].upper()}"
        + (f"   |   Saúde: {rel['pontuacao_saude']}/100" if rel["pontuacao_saude"] is not None else ""),
        "",
        rel["resumo"],
        "",
    ]
    m = rel["metricas"]
    if m.get("periodo"):
        p, c = m["periodo"], m.get("cobertura", {})
        linhas += [
            "-- Números do período " + "-" * 48,
            f"Período analisado: {br(c.get('periodo_analisado_horas', 0))} h | leituras: {c.get('leituras')} "
            f"| cobertura: {br(c.get('percentual_cobertura', 0), 0)}%",
            f"Média {br(p['media'])} °C | mín {br(p['minima'])} °C | máx {br(p['maxima'])} °C | "
            f"na faixa ideal: {br(p['percentual_na_faixa_ideal'], 0)}% do tempo",
            "",
        ]
    if rel["achados"]:
        linhas.append("-- O que a IA identificou " + "-" * 44)
        for a in rel["achados"]:
            linhas.append(f"{icones[a['severidade']]} {a['titulo']} (confiança {a['confianca']})")
            linhas.append(f"   {a['mensagem']}")
        linhas.append("")
    if rel["recomendacoes"]:
        linhas.append("-- Recomendações " + "-" * 53)
        for r in rel["recomendacoes"]:
            linhas.append(f"({r['prioridade']}) {r['texto']}")
        linhas.append("")
    linhas.append(rel["aviso"])
    return "\n".join(linhas)


def relatorio_completo(resultado: dict, fonte: str) -> tuple[dict, Any]:
    rel = gerar_relatorio(resultado, fonte)
    return rel, para_texto(rel)
