"""Configurações da Freezer AI.

Tudo o que é "regra de negócio" (limites de temperatura, tolerâncias, nomes
de tabela/colunas) fica aqui, para poder ser ajustado sem mexer na análise.

Os nomes de tabela e colunas padrão foram tirados do código existente do
Cold-Sense:
  - firmware/backend/main.py      -> insert em "temperaturas" com a coluna "temperatura"
  - frontend/src/services/temperatureService.ts -> "coletado_em" e "freezer_id"
  - frontend/src/services/freezerService.ts     -> tabela "freezers" (id, nome)
Se o banco mudar, basta ajustar as variáveis de ambiente abaixo.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, replace
from typing import Optional


@dataclass(frozen=True)
class Perfil:
    """Faixas de operação de um tipo de equipamento (°C)."""

    nome: str
    descricao: str
    ideal_min: float
    ideal_max: float
    limite_alerta: float          # acima disso: atenção
    limite_critico: float         # acima disso: crítico
    limite_minimo_alerta: Optional[float] = None  # abaixo disso: frio demais (ex.: geladeira congelando)
    amplitude_normal: float = 4.0  # oscilação pico a pico considerada normal (ciclo do compressor)
    taxa_subida_alerta: float = 2.0   # °C/h sustentado por 1 h
    delta_aumento_incomum: float = 2.0  # °C acima do padrão do próprio equipamento
    salto_brusco: float = 2.0      # °C de variação em 1 minuto


PERFIS: dict[str, Perfil] = {
    "freezer": Perfil(
        nome="freezer",
        descricao="Freezer / congelador",
        ideal_min=-24.0,
        ideal_max=-16.0,
        limite_alerta=-12.0,
        limite_critico=-8.0,
        amplitude_normal=4.0,
    ),
    "refrigerador": Perfil(
        nome="refrigerador",
        descricao="Refrigerador / geladeira",
        ideal_min=1.0,
        ideal_max=5.0,
        limite_alerta=7.0,
        limite_critico=10.0,
        limite_minimo_alerta=-0.5,
        amplitude_normal=3.0,
    ),
}


def obter_perfil(nome: str, **ajustes) -> Perfil:
    """Retorna um perfil, opcionalmente sobrescrevendo limites (valores None são ignorados)."""
    if nome not in PERFIS:
        raise ValueError(f"Perfil desconhecido: {nome!r}. Opções: {', '.join(PERFIS)}")
    ajustes = {k: v for k, v in ajustes.items() if v is not None}
    perfil = replace(PERFIS[nome], **ajustes)
    if perfil.limite_critico < perfil.limite_alerta:
        raise ValueError("O limite crítico deve ser maior ou igual ao limite de alerta.")
    return perfil


@dataclass(frozen=True)
class Config:
    """Parâmetros gerais da análise."""

    intervalo_leitura_s: float = 10.0     # o ESP32 envia ~a cada 10 s
    limite_lacuna_s: float = 60.0          # intervalo maior que isso entre leituras = lacuna
    limite_sem_dados_min: float = 5.0      # sem leitura há mais que isso = alerta de comunicação
    janela_horas: float = 24.0             # período analisado em detalhe
    historico_dias: float = 7.0            # histórico usado como "padrão" do equipamento
    ultimas_horas: float = 3.0             # recorte para "aumento incomum nas últimas horas"
    minimo_leituras: int = 30              # abaixo disso a análise fica "indeterminada"
    minimo_periodo_min: float = 30.0

    # Fuso usado para agrupar o histórico por dia (tendências)
    fuso: str = field(default_factory=lambda: os.getenv("FREEZER_AI_FUSO", "America/Fortaleza"))

    # Banco (lidos do ambiente; nunca coloque chaves aqui)
    tabela: str = field(default_factory=lambda: os.getenv("FREEZER_AI_TABELA", "temperaturas"))
    coluna_temperatura: str = field(
        default_factory=lambda: os.getenv("FREEZER_AI_COLUNA_TEMPERATURA", "temperatura")
    )
    coluna_data: str = field(default_factory=lambda: os.getenv("FREEZER_AI_COLUNA_DATA", "coletado_em"))
    # Coluna que identifica o freezer de cada leitura (tabela "freezers" do Cold-Sense)
    coluna_dispositivo: Optional[str] = field(
        default_factory=lambda: os.getenv("FREEZER_AI_COLUNA_DISPOSITIVO", "freezer_id") or None
    )
    tabela_freezers: str = field(default_factory=lambda: os.getenv("FREEZER_AI_TABELA_FREEZERS", "freezers"))
    # Faixa recomendada cadastrada em cada freezer (tabela "freezers")
    coluna_temp_min: str = field(default_factory=lambda: os.getenv("FREEZER_AI_COLUNA_TEMP_MIN", "temperatura_min"))
    coluna_temp_max: str = field(default_factory=lambda: os.getenv("FREEZER_AI_COLUNA_TEMP_MAX", "temperatura_max"))
    # Quantos °C acima da máxima recomendada a situação passa a ser crítica
    margem_critica: float = field(default_factory=lambda: float(os.getenv("FREEZER_AI_MARGEM_CRITICA", "3")))


# Valores que o DS18B20 devolve quando há erro (não são temperaturas reais)
CODIGOS_ERRO_SENSOR = {
    85.0: "valor de reset do DS18B20 (85 °C) – leitura feita antes da conversão ou falha de alimentação",
    -127.0: "sensor desconectado (-127 °C)",
}
FAIXA_FISICA_SENSOR = (-55.0, 125.0)  # faixa de medição do DS18B20


def perfil_do_freezer(freezer: dict, config: Optional["Config"] = None) -> Optional[Perfil]:
    """Monta o perfil a partir da faixa cadastrada no freezer (temperatura_min/max).

    Regras:
      - faixa ideal = mínima a máxima cadastradas;
      - alerta      = acima da máxima ou abaixo da mínima;
      - crítico     = acima da máxima + margem_critica (padrão 3 °C).
    Devolve None se o freezer não tiver a faixa cadastrada (usa-se o perfil padrão).
    """
    config = config or Config()
    tmin = freezer.get(config.coluna_temp_min)
    tmax = freezer.get(config.coluna_temp_max)
    try:
        tmin, tmax = float(tmin), float(tmax)
    except (TypeError, ValueError):
        return None
    if tmin >= tmax:
        return None
    base = PERFIS["refrigerador"] if tmax > 0 else PERFIS["freezer"]
    nome = freezer.get("nome") or f"Freezer {freezer.get('id')}"
    return replace(
        base,
        nome="cadastro",
        descricao=nome,
        ideal_min=tmin,
        ideal_max=tmax,
        limite_alerta=tmax,
        limite_critico=tmax + config.margem_critica,
        limite_minimo_alerta=tmin,
    )
