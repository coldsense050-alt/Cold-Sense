"""Gerador de dados sintéticos para testar a Freezer AI sem o hardware.

Simula um freezer com ciclo de compressor (~40 min) em torno de -18 °C e
leituras a cada 10 s, e permite injetar problemas conhecidos.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

CENARIOS = {
    "normal": "Freezer saudável, ciclo normal do compressor",
    "porta_aberta": "Várias aberturas de porta curtas nas últimas 24 h",
    "falha_refrigeracao": "Compressor para nas últimas 3 h: subida contínua",
    "oscilacao": "Oscilações muito maiores que o normal nas últimas 24 h",
    "perda_estabilidade": "7 dias com oscilação crescente e média subindo aos poucos",
    "falha_sensor": "Leituras 85 °C / -127 °C e falhas de envio",
    "sem_dados_recentes": "ESP32 parou de enviar há 40 min",
}


def gerar(
    cenario: str = "normal",
    dias: float = 7,
    intervalo_s: float = 10,
    fim: datetime | None = None,
    semente: int = 42,
    base: float = -18.0,
) -> pd.DataFrame:
    if cenario not in CENARIOS:
        raise ValueError(f"Cenário desconhecido: {cenario}. Opções: {', '.join(CENARIOS)}")
    rng = np.random.default_rng(semente)
    fim = fim or datetime.now(timezone.utc).replace(microsecond=0)
    n = int(dias * 86400 / intervalo_s)
    ts = pd.date_range(end=fim, periods=n, freq=f"{int(intervalo_s)}s", tz="UTC")
    seg = np.arange(n) * intervalo_s
    dia = seg / 86400  # dias desde o início
    horas_ate_fim = (n - 1 - np.arange(n)) * intervalo_s / 3600

    periodo = 40 * 60
    amplitude = np.full(n, 1.0)  # ±1 °C → ~2 °C pico a pico
    media = np.full(n, base)

    if cenario == "perda_estabilidade":
        amplitude = 0.8 + 0.45 * dia      # oscilação cresce todo dia
        media = base + 0.45 * dia          # e a média sobe ~0,45 °C/dia
    if cenario == "oscilacao":
        amplitude = np.where(horas_ate_fim < 24, 3.2, 1.0)

    fase = (seg % periodo) / periodo
    onda = np.where(fase < 0.6, 1 - 2 * fase / 0.6, -1 + 2 * (fase - 0.6) / 0.4)  # dente de serra
    temp = media + amplitude * onda + rng.normal(0, 0.08, n)

    if cenario == "porta_aberta":
        for h in (20, 16, 11, 7, 3):  # horas antes do fim
            ini = np.argmin(np.abs(horas_ate_fim - h))
            dur = int(12 * 60 / intervalo_s)  # ~12 min acima
            subida = np.concatenate([np.linspace(0, 9, dur // 3), np.full(dur // 3, 9), np.linspace(9, 0, dur - 2 * (dur // 3))])
            temp[ini: ini + dur] += subida[: len(temp[ini: ini + dur])]

    if cenario == "falha_refrigeracao":
        m = horas_ate_fim < 3
        h = 3 - horas_ate_fim[m]
        temp[m] = base + 1.0 + 4.0 * h + rng.normal(0, 0.08, m.sum())  # ~4 °C/h

    df = pd.DataFrame({"coletado_em": ts, "temperatura": np.round(temp, 2)})

    if cenario == "falha_sensor":
        idx = rng.choice(n, size=int(n * 0.015), replace=False)
        df.loc[idx[: len(idx) // 2], "temperatura"] = 85.0
        df.loc[idx[len(idx) // 2:], "temperatura"] = -127.0
        # falhas de envio: remove blocos de 20 min
        for h in (18, 12, 6, 2):
            ini = np.argmin(np.abs(horas_ate_fim - h))
            df = df.drop(index=range(ini, min(n, ini + int(20 * 60 / intervalo_s))), errors="ignore")

    if cenario == "sem_dados_recentes":
        df = df[df["coletado_em"] < fim - timedelta(minutes=40)]

    df = df.reset_index(drop=True)
    df["coletado_em"] = df["coletado_em"].map(lambda t: t.isoformat())
    return df
