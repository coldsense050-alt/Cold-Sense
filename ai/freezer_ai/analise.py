"""Motor de análise da Freezer AI.

Abordagem: estatística robusta + regras explicáveis. Cada conclusão ("achado")
carrega as evidências numéricas que a sustentam. Se os dados não permitem
concluir algo, a IA não conclui (e diz que não conseguiu avaliar).

Nada aqui acessa banco ou rede: recebe um DataFrame (ts, temp) e devolve
um dicionário com métricas e achados. Isso facilita testar e reaproveitar.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Optional

import numpy as np
import pandas as pd

from .config import CODIGOS_ERRO_SENSOR, FAIXA_FISICA_SENSOR, Config, Perfil

SEVERIDADES = ("info", "atencao", "critico")


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def br(valor: float, casas: int = 1) -> str:
    """Formata número no padrão brasileiro (vírgula decimal)."""
    return f"{valor:.{casas}f}".replace(".", ",")


def _r(valor: Any, casas: int = 2) -> Any:
    if valor is None:
        return None
    try:
        if np.isnan(valor):
            return None
    except TypeError:
        return valor
    return round(float(valor), casas)


def _duracao_txt(minutos: float) -> str:
    if minutos < 1:
        return "menos de 1 min"
    if minutos < 90:
        return f"{int(round(minutos))} min"
    horas = minutos / 60
    if horas < 48:
        return f"{br(horas)} h"
    return f"{br(horas / 24)} dias"


@dataclass
class Achado:
    codigo: str
    severidade: str
    titulo: str
    mensagem: str
    confianca: str = "media"  # baixa | media | alta
    evidencias: dict = field(default_factory=dict)

    def __post_init__(self):
        assert self.severidade in SEVERIDADES, self.severidade


def _regressao(minutos: np.ndarray, valores: np.ndarray) -> tuple[float, float]:
    """Inclinação (°C/h) e R² de uma regressão linear simples."""
    if len(valores) < 3 or np.ptp(minutos) == 0:
        return float("nan"), float("nan")
    a, b = np.polyfit(minutos, valores, 1)
    previsto = a * minutos + b
    ss_res = float(np.sum((valores - previsto) ** 2))
    ss_tot = float(np.sum((valores - valores.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return a * 60.0, r2


def _serie_minuto(df: pd.DataFrame) -> pd.Series:
    """Mediana por minuto (minutos sem leitura ficam NaN)."""
    if df.empty:
        return pd.Series(dtype=float)
    return df.set_index("ts")["temp"].resample("1min").median()


def _amplitude_oscilacao(serie_min: pd.Series) -> Optional[dict]:
    """Oscilação em torno da tendência local (remove a média móvel de 60 min)."""
    s = serie_min.interpolate(limit=5, limit_area="inside")
    if s.notna().sum() < 120:  # precisa de pelo menos ~2 h
        return None
    tendencia = s.rolling(61, center=True, min_periods=20).median()
    residuo = (s - tendencia).dropna()
    if len(residuo) < 60:
        return None
    return {
        "amplitude": float(np.percentile(residuo, 95) - np.percentile(residuo, 5)),
        "desvio": float(residuo.std()),
    }


def _segmentos(mascara: pd.Series, ts: pd.Series, limite_lacuna_s: float) -> list[tuple[int, int]]:
    """Índices (início, fim) de trechos contínuos onde a máscara é verdadeira."""
    segs = []
    inicio = None
    anterior_ts = None
    for i, (flag, t) in enumerate(zip(mascara.to_numpy(), ts)):
        quebrou = anterior_ts is not None and (t - anterior_ts).total_seconds() > limite_lacuna_s * 5
        if flag and inicio is None:
            inicio = i
        elif inicio is not None and (not flag or quebrou):
            segs.append((inicio, i - 1))
            inicio = i if (flag and quebrou) else None
        anterior_ts = t
    if inicio is not None:
        segs.append((inicio, len(mascara) - 1))
    return segs


# --------------------------------------------------------------------------- #
# Etapa 1 – qualidade dos dados
# --------------------------------------------------------------------------- #
def limpar(df: pd.DataFrame, limite_pico: float = 4.0) -> tuple[pd.DataFrame, dict, pd.DataFrame]:
    """Remove leituras impossíveis / códigos de erro / picos isolados."""
    df = df.dropna(subset=["temp"]).copy()
    total = len(df)
    motivo = pd.Series("", index=df.index)

    for codigo in CODIGOS_ERRO_SENSOR:
        motivo[np.isclose(df["temp"], codigo)] = "codigo_erro"
    fora = (df["temp"] < FAIXA_FISICA_SENSOR[0]) | (df["temp"] > FAIXA_FISICA_SENSOR[1])
    motivo[fora & (motivo == "")] = "fora_da_faixa"

    validos = df[motivo == ""]
    # Pico isolado: uma leitura que destoa muito das vizinhas (mediana de 5 leituras)
    mediana = validos["temp"].rolling(5, center=True, min_periods=3).median()
    picos_idx = validos.index[(validos["temp"] - mediana).abs() > limite_pico]
    motivo[picos_idx] = "pico_isolado"

    limpo = df[motivo == ""].reset_index(drop=True)
    erros = df[motivo == "codigo_erro"]["temp"].round(1).value_counts().to_dict()
    resumo = {
        "leituras_recebidas": total,
        "leituras_validas": len(limpo),
        "codigos_erro_sensor": {str(k): int(v) for k, v in erros.items()},
        "fora_da_faixa_fisica": int((motivo == "fora_da_faixa").sum()),
        "picos_isolados": int((motivo == "pico_isolado").sum()),
    }
    resumo["descartadas"] = total - len(limpo)
    descartadas = df[motivo != ""].assign(motivo=motivo[motivo != ""]).reset_index(drop=True)
    return limpo, resumo, descartadas


# --------------------------------------------------------------------------- #
# Análise principal
# --------------------------------------------------------------------------- #
def analisar(
    df: pd.DataFrame,
    perfil: Perfil,
    config: Optional[Config] = None,
    agora: Optional[datetime] = None,
    tempo_real: bool = True,
    resolucao: str = "hora",
) -> dict:
    """Analisa as leituras e devolve métricas + achados.

    df: DataFrame com colunas ts (UTC) e temp (°C), já com histórico se houver.
    agora: momento de referência = fim do período (padrão: última leitura recebida).
    tempo_real: True quando "agora" é o momento atual; False para períodos passados
        (muda só a redação: "temperatura atual" x "no fim do período").
    resolucao: "minuto" ou "hora" – agregação da série devolvida para gráficos.
    """
    config = config or Config()
    achados: list[Achado] = []
    metricas: dict[str, Any] = {}

    limpo, qualidade, descartadas = limpar(df)
    ctx = {"tempo_real": tempo_real, "resolucao": resolucao, "descartadas": descartadas}
    if agora is None:
        agora = df["ts"].max() if not df.empty else pd.Timestamp.now(tz="UTC")
    agora = pd.Timestamp(agora)
    if agora.tzinfo is None:
        agora = agora.tz_localize("UTC")

    inicio_janela = agora - pd.Timedelta(hours=config.janela_horas)
    inicio_hist = agora - pd.Timedelta(days=config.historico_dias)
    recente = limpo[(limpo["ts"] > inicio_janela) & (limpo["ts"] <= agora)].reset_index(drop=True)
    base = limpo[(limpo["ts"] >= inicio_hist) & (limpo["ts"] <= inicio_janela)].reset_index(drop=True)

    # ---------------- qualidade / cobertura ----------------
    _avaliar_qualidade(df, qualidade, achados)

    if recente.empty:
        achados.append(
            Achado(
                "sem_dados",
                "critico" if not limpo.empty else "atencao",
                "Sem leituras no período",
                f"Não há leituras válidas nas últimas {br(config.janela_horas, 0)} h. "
                "Não é possível avaliar o equipamento.",
                "alta",
                {"ultima_leitura": limpo["ts"].max().isoformat() if not limpo.empty else None},
            )
        )
        return _montar(ctx, perfil, config, agora, metricas, qualidade, achados, recente, base, suficiente=False)

    ultima = recente.iloc[-1]
    sem_dados_min = (agora - ultima["ts"]).total_seconds() / 60
    periodo_min = (agora - max(recente["ts"].iloc[0], inicio_janela)).total_seconds() / 60
    esperado = max(1.0, periodo_min * 60 / config.intervalo_leitura_s)
    cobertura = min(1.0, len(recente) / esperado)
    difs = recente["ts"].diff().dt.total_seconds().dropna()
    lacunas = difs[difs > config.limite_lacuna_s]

    metricas["cobertura"] = {
        "periodo_analisado_horas": _r(periodo_min / 60),
        "leituras": int(len(recente)),
        "intervalo_mediano_s": _r(difs.median()) if len(difs) else None,
        "percentual_cobertura": _r(cobertura * 100, 1),
        "lacunas": int(len(lacunas)),
        "maior_lacuna_min": _r(lacunas.max() / 60, 1) if len(lacunas) else 0.0,
        "tempo_total_em_lacunas_min": _r(lacunas.sum() / 60, 1) if len(lacunas) else 0.0,
        "minutos_desde_ultima_leitura": _r(sem_dados_min, 1),
    }

    if sem_dados_min > config.limite_sem_dados_min:
        achados.append(
            Achado(
                "sem_dados_recentes",
                "critico" if sem_dados_min > 60 else "atencao",
                "Sem leituras recentes" if tempo_real else "Sem leituras no fim do período",
                (f"O sistema não recebe leituras há {_duracao_txt(sem_dados_min)}. "
                 "A temperatura atual do equipamento é desconhecida.") if tempo_real else
                (f"Não há leituras nos últimos {_duracao_txt(sem_dados_min)} do período selecionado."),
                "alta",
                {"minutos_sem_leitura": _r(sem_dados_min, 1), "ultima_leitura": ultima["ts"].isoformat()},
            )
        )
    if len(lacunas) and (cobertura < 0.8 or lacunas.max() >= 600):
        achados.append(
            Achado(
                "cobertura_baixa",
                "atencao" if cobertura < 0.5 else "info",
                "Interrupções no envio de leituras",
                f"Foram recebidas {br(cobertura * 100, 0)}% das leituras esperadas no período, com "
                f"{len(lacunas)} interrupções (a maior de {_duracao_txt(lacunas.max() / 60)}). "
                "Isso reduz a confiabilidade da análise.",
                "alta",
                metricas["cobertura"],
            )
        )

    suficiente = len(recente) >= config.minimo_leituras and periodo_min >= config.minimo_periodo_min
    if not suficiente:
        achados.append(
            Achado(
                "dados_insuficientes",
                "info",
                "Dados insuficientes",
                f"Há apenas {len(recente)} leituras em {_duracao_txt(periodo_min)}. São necessárias pelo "
                f"menos {config.minimo_leituras} leituras em {br(config.minimo_periodo_min, 0)} min para "
                "uma análise confiável.",
                "alta",
            )
        )
        metricas["atual"] = {"temperatura": _r(ultima["temp"]), "coletado_em": ultima["ts"].isoformat()}
        # mesmo com poucos dados, uma temperatura fora do limite precisa ser avisada
        _avaliar_temperatura_atual(float(ultima["temp"]), perfil, achados, "baixa", tempo_real)
        return _montar(ctx, perfil, config, agora, metricas, qualidade, achados, recente, base, suficiente=False)

    conf_geral = "alta" if cobertura >= 0.8 and periodo_min >= 360 else ("media" if cobertura >= 0.5 else "baixa")

    # ---------------- estatísticas do período ----------------
    t = recente["temp"]
    serie_min = _serie_minuto(recente)
    metricas["periodo"] = {
        "media": _r(t.mean()),
        "minima": _r(t.min()),
        "maxima": _r(t.max()),
        "desvio_padrao": _r(t.std()),
        "percentual_na_faixa_ideal": _r(((t >= perfil.ideal_min) & (t <= perfil.ideal_max)).mean() * 100, 1),
        "percentual_acima_alerta": _r((t > perfil.limite_alerta).mean() * 100, 1),
        "percentual_acima_critico": _r((t > perfil.limite_critico).mean() * 100, 1),
    }
    # temperatura "atual": mediana das últimas leituras (2 min) para não reagir a ruído
    ult = recente[recente["ts"] >= ultima["ts"] - pd.Timedelta(minutes=2)]["temp"]
    atual = float(ult.median())
    metricas["atual"] = {"temperatura": _r(atual), "coletado_em": ultima["ts"].isoformat()}

    _avaliar_temperatura_atual(atual, perfil, achados, conf_geral, tempo_real)
    _avaliar_taxa(serie_min, atual, perfil, metricas, achados)
    _avaliar_excursoes(recente, perfil, config, metricas, achados)
    _avaliar_aumento_incomum(recente, base, agora, perfil, config, metricas, achados)
    _avaliar_oscilacao(serie_min, base, perfil, metricas, achados, conf_geral)
    _avaliar_tendencia(limpo[limpo["ts"] >= inicio_hist], agora, perfil, config, metricas, achados)

    return _montar(ctx, perfil, config, agora, metricas, qualidade, achados, recente, base, suficiente=True)


# --------------------------------------------------------------------------- #
# Regras
# --------------------------------------------------------------------------- #
def _avaliar_qualidade(df_bruto: pd.DataFrame, q: dict, achados: list[Achado]) -> None:
    total = max(1, q["leituras_recebidas"])
    erros = sum(q["codigos_erro_sensor"].values()) + q["fora_da_faixa_fisica"]
    if erros:
        pct = erros / total * 100
        detalhes = []
        if "85.0" in q["codigos_erro_sensor"]:
            detalhes.append(f"{q['codigos_erro_sensor']['85.0']}× o valor 85 °C (reset do sensor)")
        if "-127.0" in q["codigos_erro_sensor"]:
            detalhes.append(f"{q['codigos_erro_sensor']['-127.0']}× o valor -127 °C (sensor desconectado)")
        if q["fora_da_faixa_fisica"]:
            detalhes.append(f"{q['fora_da_faixa_fisica']} valores fora da faixa do sensor")
        achados.append(
            Achado(
                "falha_sensor",
                "atencao" if pct >= 1 or erros >= 5 else "info",
                "Leituras inválidas do sensor",
                f"Foram descartadas {erros} leituras inválidas ({'; '.join(detalhes)}). "
                "Isso costuma indicar mau contato, cabo danificado ou alimentação instável do sensor.",
                "alta",
                {"leituras_invalidas": erros, "percentual": _r(pct, 2), **q["codigos_erro_sensor"]},
            )
        )
    if q["picos_isolados"]:
        pct = q["picos_isolados"] / total * 100
        achados.append(
            Achado(
                "picos_isolados",
                "atencao" if pct >= 1 else "info",
                "Leituras isoladas fora do padrão",
                f"{q['picos_isolados']} leituras isoladas destoavam das vizinhas e foram ignoradas na análise. "
                "Poucas ocorrências são normais; muitas podem indicar ruído elétrico ou mau contato.",
                "media",
                {"picos_isolados": q["picos_isolados"], "percentual": _r(pct, 2)},
            )
        )


def _avaliar_temperatura_atual(atual: float, perfil: Perfil, achados: list[Achado], conf: str,
                               tempo_real: bool = True) -> None:
    quando = "atual" if tempo_real else "no fim do período"
    ev = {"temperatura_atual": _r(atual), "limite_alerta": perfil.limite_alerta, "limite_critico": perfil.limite_critico}
    if atual > perfil.limite_critico:
        achados.append(Achado(
            "temperatura_critica", "critico", f"Temperatura {quando} crítica",
            f"A temperatura {quando} é {br(atual)} °C, acima do limite crítico de {br(perfil.limite_critico)} °C.",
            conf, ev))
    elif atual > perfil.limite_alerta:
        achados.append(Achado(
            "temperatura_alta", "atencao", f"Temperatura {quando} acima do recomendado",
            f"A temperatura {quando} é {br(atual)} °C, acima do limite de alerta de {br(perfil.limite_alerta)} °C.",
            conf, ev))
    elif perfil.limite_minimo_alerta is not None and atual < perfil.limite_minimo_alerta:
        achados.append(Achado(
            "temperatura_baixa", "atencao", "Temperatura abaixo do recomendado",
            f"A temperatura {quando} é {br(atual)} °C, abaixo de {br(perfil.limite_minimo_alerta)} °C. "
            "Há risco de congelamento dos produtos.",
            conf, {**ev, "limite_minimo_alerta": perfil.limite_minimo_alerta}))


def _avaliar_taxa(serie_min: pd.Series, atual: float, perfil: Perfil, metricas: dict, achados: list[Achado]) -> None:
    fim = serie_min.index.max()
    resultado = {}
    for janela in (15, 60, 180):
        trecho = serie_min[serie_min.index > fim - pd.Timedelta(minutes=janela)].dropna()
        if len(trecho) < max(10, janela * 0.5):
            resultado[f"{janela}min"] = None
            continue
        minutos = (trecho.index - trecho.index[0]).total_seconds().to_numpy() / 60
        taxa, r2 = _regressao(minutos, trecho.to_numpy())
        resultado[f"{janela}min"] = {"taxa_c_por_hora": _r(taxa), "r2": _r(r2)}
    metricas["taxa_variacao"] = resultado

    h1 = resultado.get("60min")
    if not h1:
        return
    taxa, r2 = h1["taxa_c_por_hora"], h1["r2"]
    if taxa is None or taxa < perfil.taxa_subida_alerta or r2 < 0.6:
        return
    msg = (f"A temperatura está subindo de forma contínua há pelo menos 1 hora, "
           f"a cerca de {br(taxa)} °C por hora.")
    ev = {"taxa_c_por_hora_1h": taxa, "r2": r2, "temperatura_atual": _r(atual)}
    if atual < perfil.limite_alerta:
        minutos_ate = (perfil.limite_alerta - atual) / taxa * 60
        ev["minutos_estimados_ate_limite_alerta"] = _r(minutos_ate, 0)
        msg += (f" Se o ritmo se mantiver, atingirá o limite de alerta ({br(perfil.limite_alerta)} °C) "
                f"em aproximadamente {_duracao_txt(minutos_ate)}.")
    achados.append(Achado("subida_continua", "atencao", "Temperatura em subida contínua", msg,
                          "alta" if r2 >= 0.8 else "media", ev))


def _avaliar_excursoes(recente: pd.DataFrame, perfil: Perfil, config: Config, metricas: dict, achados: list[Achado]) -> None:
    acima = recente["temp"] > perfil.limite_alerta
    segs = _segmentos(acima, recente["ts"], config.limite_lacuna_s)
    eventos = []
    for i, j in segs:
        ini, fim = recente["ts"].iloc[i], recente["ts"].iloc[j]
        dur = (fim - ini).total_seconds() / 60
        if dur < 1:  # ignora 1 ou 2 leituras soltas
            continue
        trecho = recente["temp"].iloc[i:j + 1]
        eventos.append({
            "inicio": ini.isoformat(),
            "fim": fim.isoformat(),
            "duracao_min": _r(dur, 1),
            "pico": _r(trecho.max()),
            "minutos_acima_critico": _r(
                (trecho > perfil.limite_critico).sum() * config.intervalo_leitura_s / 60, 1),
            "em_andamento": bool(j == len(recente) - 1),
        })
    metricas["excursoes"] = {
        "limite": perfil.limite_alerta,
        "quantidade": len(eventos),
        "minutos_acima_alerta": _r(sum(e["duracao_min"] for e in eventos), 1),
        "eventos": eventos[-100:],
    }
    if not eventos:
        return

    longos = [e for e in eventos if e["duracao_min"] > 30]
    curtos = [e for e in eventos if e["duracao_min"] <= 20 and not e["em_andamento"]]

    for e in longos:
        grave = e["duracao_min"] > 60 or e["minutos_acima_critico"] > 15
        estado = "e continua acima" if e["em_andamento"] else "antes de voltar ao normal"
        achados.append(Achado(
            "excursao_prolongada", "critico" if grave else "atencao",
            "Temperatura acima do limite por tempo prolongado",
            f"O equipamento ficou {_duracao_txt(e['duracao_min'])} acima de {br(perfil.limite_alerta)} °C "
            f"{estado} (pico de {br(e['pico'])} °C).",
            "alta", e))

    if len(curtos) >= 8:
        inicios = pd.to_datetime([e["inicio"] for e in curtos])
        intervalos = (inicios[1:] - inicios[:-1]).total_seconds().to_numpy() / 60
        cv = float(np.std(intervalos) / np.mean(intervalos)) if len(intervalos) > 1 else 1.0
        if cv < 0.35:
            achados.append(Achado(
                "picos_ciclicos_acima_limite", "atencao", "Temperatura ultrapassa o limite a cada ciclo",
                f"A temperatura ultrapassou {br(perfil.limite_alerta)} °C de forma regular, a cada "
                f"{_duracao_txt(float(np.mean(intervalos)))} aproximadamente ({len(curtos)} vezes no período). "
                "Esse padrão repetitivo acompanha o ciclo de refrigeração e indica que o equipamento está "
                "trabalhando no limite da sua capacidade ou com o termostato mal ajustado.",
                "media", {"quantidade": len(curtos), "intervalo_medio_min": _r(np.mean(intervalos), 1),
                          "coeficiente_variacao": _r(cv)}))
            return

    if 1 <= len(curtos) < 3 and not longos:
        achados.append(Achado(
            "elevacoes_curtas", "info", "Elevação curta de temperatura",
            f"{'Houve 1 elevação curta' if len(curtos) == 1 else f'Houve {len(curtos)} elevações curtas'} acima de "
            f"{br(perfil.limite_alerta)} °C (pico de {br(max(e['pico'] for e in curtos))} °C), com retorno ao normal "
            f"em até {_duracao_txt(max(e['duracao_min'] for e in curtos))}. Ocorrências isoladas assim costumam "
            "ser aberturas de porta e não indicam problema.",
            "media", {"quantidade": len(curtos), "pico_maximo": _r(max(e["pico"] for e in curtos))}))

    if len(curtos) >= 3:
        rec = [e["duracao_min"] for e in curtos]
        achados.append(Achado(
            "elevacoes_curtas_frequentes", "atencao", "Elevações curtas e frequentes",
            f"Foram identificadas {len(curtos)} elevações curtas acima de {br(perfil.limite_alerta)} °C, "
            f"com retorno ao normal em média em {_duracao_txt(float(np.mean(rec)))}. Esse padrão é compatível "
            "com aberturas de porta frequentes ou prolongadas, ou com porta mal fechada.",
            "media", {"quantidade": len(curtos), "duracao_media_min": _r(np.mean(rec), 1),
                      "pico_maximo": _r(max(e["pico"] for e in curtos))}))


def _avaliar_aumento_incomum(recente, base, agora, perfil, config, metricas, achados) -> None:
    corte = agora - pd.Timedelta(hours=config.ultimas_horas)
    ultimas = recente[recente["ts"] > corte]["temp"]
    if base["ts"].nunique() > 0 and (base["ts"].max() - base["ts"].min()) >= pd.Timedelta(hours=24):
        referencia, origem = base, "historico"
    else:
        referencia = recente[recente["ts"] <= corte]
        origem = "periodo_anterior"
        if referencia.empty or (referencia["ts"].max() - referencia["ts"].min()) < pd.Timedelta(hours=6):
            metricas["comparacao_padrao"] = None
            return
    if len(ultimas) < 30:
        metricas["comparacao_padrao"] = None
        return

    horarias = referencia.set_index("ts")["temp"].resample("1h").mean().dropna()
    mediana = float(horarias.median())
    mad = float((horarias - mediana).abs().median()) * 1.4826
    mad = max(mad, 0.3)
    media_ult = float(ultimas.mean())
    delta = media_ult - mediana
    z = delta / mad
    metricas["comparacao_padrao"] = {
        "referencia": origem,
        "media_ultimas_horas": _r(media_ult),
        "horas_consideradas": config.ultimas_horas,
        "padrao_do_equipamento": _r(mediana),
        "diferenca": _r(delta),
        "z_robusto": _r(z),
    }
    if delta >= perfil.delta_aumento_incomum and z >= 3:
        achados.append(Achado(
            "aumento_incomum", "atencao", "Aumento incomum de temperatura",
            f"A temperatura média das últimas {br(config.ultimas_horas, 0)} h ({br(media_ult)} °C) está "
            f"{br(delta)} °C acima do padrão habitual deste equipamento ({br(mediana)} °C).",
            "alta" if origem == "historico" else "media", metricas["comparacao_padrao"]))


def _avaliar_oscilacao(serie_min, base, perfil, metricas, achados, conf) -> None:
    atual = _amplitude_oscilacao(serie_min)
    if atual is None:
        metricas["oscilacao"] = None
        return
    ref = _amplitude_oscilacao(_serie_minuto(base)) if len(base) else None
    if ref and ref["amplitude"] > 0:
        referencia, origem = ref["amplitude"], "historico"
    else:
        referencia, origem = perfil.amplitude_normal, "perfil"

    s = serie_min.dropna()
    janelas = [(pd.Timestamp(e["inicio"]) - pd.Timedelta(minutes=5), pd.Timestamp(e["fim"]) + pd.Timedelta(minutes=5))
               for e in (metricas.get("excursoes") or {}).get("eventos", [])]
    idx_saltos = s.index[(s.diff().abs() > perfil.salto_brusco).to_numpy()]
    # saltos dentro de uma elevação acima do limite já são explicados por ela
    saltos = int(sum(1 for ts in idx_saltos if not any(a <= ts <= b for a, b in janelas)))
    horas = max(1e-9, (s.index.max() - s.index.min()).total_seconds() / 3600)
    metricas["oscilacao"] = {
        "amplitude_c": _r(atual["amplitude"]),
        "desvio_c": _r(atual["desvio"]),
        "amplitude_referencia_c": _r(referencia),
        "referencia": origem,
        "variacoes_bruscas": saltos,
        "variacoes_bruscas_por_hora": _r(saltos / horas),
    }
    limite = max(referencia * 1.5, referencia + 1.0)
    if atual["amplitude"] > limite:
        achados.append(Achado(
            "oscilacao_elevada", "atencao", "Oscilações de temperatura acima do normal",
            f"O equipamento está apresentando oscilações de cerca de {br(atual['amplitude'])} °C, "
            f"acima do esperado ({br(referencia)} °C"
            f"{' no histórico deste equipamento' if origem == 'historico' else ' para este tipo de equipamento'}).",
            conf if origem == "historico" else "media", metricas["oscilacao"]))
    elif saltos / horas >= 1.0 and saltos >= 6 and not any(
        a.codigo in ("elevacoes_curtas_frequentes", "picos_ciclicos_acima_limite", "excursao_prolongada")
        for a in achados
    ):
        achados.append(Achado(
            "variacoes_bruscas", "atencao", "Variações bruscas frequentes",
            f"Foram registradas {saltos} variações bruscas (mais de {br(perfil.salto_brusco)} °C em 1 minuto) "
            "no período.", "media", metricas["oscilacao"]))


def _avaliar_tendencia(hist: pd.DataFrame, agora, perfil, config, metricas, achados) -> None:
    """Tendência em dias: aquecimento gradual e perda de estabilidade."""
    if hist.empty:
        metricas["tendencia"] = None
        return
    dias = []
    dia_local = hist["ts"].dt.tz_convert(config.fuso).dt.date
    for dia, grupo in hist.groupby(dia_local):
        esperado = 86400 / config.intervalo_leitura_s
        if len(grupo) < esperado * 0.5:  # ignora dias com menos de 50% das leituras
            continue
        osc = _amplitude_oscilacao(_serie_minuto(grupo))
        dias.append({
            "dia": dia.isoformat(),
            "media": float(grupo["temp"].mean()),
            "maxima": float(grupo["temp"].max()),
            "amplitude": osc["amplitude"] if osc else float("nan"),
            "percentual_acima_alerta": float((grupo["temp"] > perfil.limite_alerta).mean() * 100),
        })
    if len(dias) < 3:
        metricas["tendencia"] = {"dias_avaliados": len(dias), "suficiente": False}
        achados.append(Achado(
            "historico_insuficiente", "info", "Histórico ainda curto",
            "Ainda não há pelo menos 3 dias completos de leituras; a análise de tendência de longo prazo "
            "será feita quando houver mais histórico.", "alta", {"dias_completos": len(dias)}))
        return

    x = np.arange(len(dias), dtype=float)
    medias = np.array([d["media"] for d in dias])
    amps = np.array([d["amplitude"] for d in dias])
    tx_media, r2_media = _regressao(x * 60, medias)  # truque: x*60 -> taxa "por dia"
    ok = ~np.isnan(amps)
    tx_amp, r2_amp = _regressao(x[ok] * 60, amps[ok]) if ok.sum() >= 3 else (float("nan"), float("nan"))
    metricas["tendencia"] = {
        "dias_avaliados": len(dias),
        "suficiente": True,
        "variacao_media_c_por_dia": _r(tx_media),
        "r2_media": _r(r2_media),
        "variacao_amplitude_c_por_dia": _r(tx_amp),
        "r2_amplitude": _r(r2_amp),
        "dias": [{k: (_r(v) if isinstance(v, float) else v) for k, v in d.items()} for d in dias],
    }
    variacao_total = tx_media * (len(dias) - 1)
    if tx_media >= 0.3 and r2_media >= 0.5 and variacao_total >= 1.0:
        achados.append(Achado(
            "tendencia_aquecimento", "atencao", "Tendência de aquecimento gradual",
            f"Nos últimos {len(dias)} dias a temperatura média subiu de forma consistente, cerca de "
            f"{br(tx_media)} °C por dia ({br(variacao_total)} °C no total). O equipamento pode estar "
            "perdendo eficiência de refrigeração.",
            "alta" if r2_media >= 0.8 else "media",
            {"variacao_c_por_dia": _r(tx_media), "variacao_total_c": _r(variacao_total), "r2": _r(r2_media),
             "dias_avaliados": len(dias)}))
    if ok.sum() >= 3:
        primeiros = float(np.nanmedian(amps[: max(1, len(amps) // 2)]))
        ultimo = float(amps[ok][-1])
        ultimos2 = amps[ok][-2:]
        persistente = len(ultimos2) == 2 and bool(np.all(ultimos2 >= primeiros * 1.3))
        if primeiros > 0 and ultimo / primeiros >= 1.5 and persistente and tx_amp > 0 and r2_amp >= 0.7:
            achados.append(Achado(
                "perda_estabilidade", "atencao", "Tendência de perda de estabilidade",
                f"O histórico indica que as oscilações de temperatura estão aumentando: de cerca de "
                f"{br(primeiros)} °C no início do período para {br(ultimo)} °C no dia mais recente.",
                "alta" if r2_amp >= 0.8 else "media",
                {"amplitude_inicial_c": _r(primeiros), "amplitude_recente_c": _r(ultimo),
                 "variacao_c_por_dia": _r(tx_amp), "r2": _r(r2_amp)}))


# --------------------------------------------------------------------------- #
# Montagem do resultado
# --------------------------------------------------------------------------- #
def _serie(recente: pd.DataFrame, resolucao: str) -> list[dict]:
    if recente.empty:
        return []
    regra = "1min" if resolucao == "minuto" else "1h"
    g = recente.set_index("ts")["temp"].resample(regra)
    tab = pd.DataFrame({"media": g.mean(), "minima": g.min(), "maxima": g.max(), "leituras": g.count()})
    return [
        {"instante": ts.isoformat(), "media": _r(l["media"]), "minima": _r(l["minima"]),
         "maxima": _r(l["maxima"]), "leituras": int(l["leituras"])}
        for ts, l in tab.iterrows()
    ]


def _anomalias(ctx, recente, perfil, config, metricas, achados, inicio_janela, agora) -> list[dict]:
    """Linha do tempo de anomalias com data/hora, para listar e marcar no gráfico."""
    itens: list[dict] = []
    for e in (metricas.get("excursoes") or {}).get("eventos", []):
        grave = e["pico"] > perfil.limite_critico
        itens.append({
            "tipo": "acima_do_limite", "severidade": "critico" if grave else "atencao",
            "inicio": e["inicio"], "fim": e["fim"],
            "descricao": f"Acima de {br(perfil.limite_alerta)} °C por {_duracao_txt(e['duracao_min'])} "
                         f"(pico de {br(e['pico'])} °C)" + (" – em andamento" if e["em_andamento"] else ""),
            "valor": e["pico"],
        })
    # interrupções de envio (≥ 5 min)
    if len(recente) > 1:
        dif = recente["ts"].diff().dt.total_seconds()
        for i in dif[dif >= 300].index[:50]:
            ini, fim = recente["ts"].iloc[i - 1], recente["ts"].iloc[i]
            itens.append({
                "tipo": "sem_leituras", "severidade": "info", "inicio": ini.isoformat(), "fim": fim.isoformat(),
                "descricao": f"Sem leituras por {_duracao_txt(dif[i] / 60)}", "valor": None,
            })
    # leituras descartadas (erro do sensor / picos)
    desc = ctx["descartadas"]
    desc = desc[(desc["ts"] > inicio_janela) & (desc["ts"] <= agora)]
    nomes = {"codigo_erro": "Leitura inválida do sensor", "fora_da_faixa": "Valor fora da faixa do sensor",
             "pico_isolado": "Leitura isolada fora do padrão (ignorada)"}
    for _, l in desc.head(50).iterrows():
        itens.append({
            "tipo": "leitura_descartada", "severidade": "info" if l["motivo"] == "pico_isolado" else "atencao",
            "inicio": l["ts"].isoformat(), "fim": l["ts"].isoformat(),
            "descricao": f"{nomes[l['motivo']]}: {br(l['temp'])} °C", "valor": _r(l["temp"]),
        })
    codigos = {a.codigo: a for a in achados}
    fim_iso = recente["ts"].iloc[-1].isoformat() if not recente.empty else agora.isoformat()
    if "subida_continua" in codigos:
        itens.append({
            "tipo": "subida_continua", "severidade": "atencao",
            "inicio": (pd.Timestamp(fim_iso) - pd.Timedelta(hours=1)).isoformat(), "fim": fim_iso,
            "descricao": codigos["subida_continua"].mensagem, "valor": None,
        })
    if "aumento_incomum" in codigos:
        itens.append({
            "tipo": "aumento_incomum", "severidade": "atencao",
            "inicio": (agora - pd.Timedelta(hours=config.ultimas_horas)).isoformat(), "fim": fim_iso,
            "descricao": codigos["aumento_incomum"].mensagem, "valor": None,
        })
    # variações bruscas (por minuto)
    if not recente.empty:
        s = _serie_minuto(recente).dropna()
        saltos = s.diff().abs()
        janelas = [(pd.Timestamp(e["inicio"]) - pd.Timedelta(minutes=5), pd.Timestamp(e["fim"]) + pd.Timedelta(minutes=5))
                   for e in (metricas.get("excursoes") or {}).get("eventos", [])]
        candidatos = [ts for ts in saltos[saltos > perfil.salto_brusco].index
                      if not any(a <= ts <= b for a, b in janelas)]  # já explicadas pela excursão
        for ts in candidatos[:50]:
            itens.append({
                "tipo": "variacao_brusca", "severidade": "info", "inicio": ts.isoformat(), "fim": ts.isoformat(),
                "descricao": f"Variação de {br(float(saltos[ts]))} °C em 1 minuto", "valor": _r(s[ts]),
            })
    itens.sort(key=lambda x: x["inicio"])
    return itens


def _montar(ctx, perfil, config, agora, metricas, qualidade, achados, recente, base, suficiente) -> dict:
    inicio_janela = agora - pd.Timedelta(hours=config.janela_horas)
    return {
        "agora": agora.isoformat(),
        "inicio": inicio_janela.isoformat(),
        "tempo_real": ctx["tempo_real"],
        "perfil": asdict(perfil),
        "parametros": {
            "janela_horas": config.janela_horas,
            "historico_dias": config.historico_dias,
            "intervalo_leitura_s": config.intervalo_leitura_s,
        },
        "suficiente": suficiente,
        "qualidade_dados": qualidade,
        "metricas": metricas,
        "achados": [asdict(a) for a in achados],
        "anomalias": _anomalias(ctx, recente, perfil, config, metricas, achados, inicio_janela, agora),
        "serie": {"resolucao": ctx["resolucao"], "pontos": _serie(recente, ctx["resolucao"])},
        "historico_base_leituras": int(len(base)),
    }
