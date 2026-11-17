"""Testes da Freezer AI com dados simulados (rodar: python -m pytest -q)."""

from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from freezer_ai import analisar_dataframe
from freezer_ai.config import Config
from freezer_ai.fontes import _padronizar
from freezer_ai.simulador import gerar

FIM = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)


def rodar(cenario, perfil="freezer", **kw):
    df = _padronizar(gerar(cenario, fim=FIM), "coletado_em", "temperatura")
    return analisar_dataframe(df, perfil, Config(), agora=FIM, **kw)


def codigos(rel):
    return {a["codigo"] for a in rel["achados"] if a["severidade"] != "info"}


def test_normal_sem_alertas():
    rel = rodar("normal")
    assert rel["status"] == "normal"
    assert codigos(rel) == set()
    assert rel["pontuacao_saude"] == 100


def test_porta_aberta():
    rel = rodar("porta_aberta")
    assert "elevacoes_curtas_frequentes" in codigos(rel)
    assert "excursao_prolongada" not in codigos(rel)


def test_falha_refrigeracao_critica():
    rel = rodar("falha_refrigeracao")
    assert rel["status"] == "critico"
    assert {"temperatura_critica", "subida_continua", "aumento_incomum"} <= codigos(rel)


def test_oscilacao():
    rel = rodar("oscilacao")
    assert "oscilacao_elevada" in codigos(rel)
    assert "tendencia_aquecimento" not in codigos(rel)


def test_perda_estabilidade():
    rel = rodar("perda_estabilidade")
    assert {"tendencia_aquecimento", "perda_estabilidade"} <= codigos(rel)


def test_falha_sensor():
    rel = rodar("falha_sensor")
    assert "falha_sensor" in codigos(rel)
    # valores 85 / -127 não podem contaminar a análise de temperatura
    assert rel["metricas"]["periodo"]["maxima"] < 0
    assert "temperatura_critica" not in codigos(rel)


def test_sem_dados_recentes():
    rel = rodar("sem_dados_recentes")
    assert "sem_dados_recentes" in codigos(rel)


def test_dados_esparsos_viram_indeterminado():
    """Situação do backend atual: poucas leituras, só quando passa de 30 °C, a cada 5 min."""
    ts = [FIM - timedelta(minutes=5 * i) for i in range(10)][::-1]
    df = pd.DataFrame({"ts": pd.to_datetime(ts, utc=True), "temp": [30.5] * 10})
    rel = analisar_dataframe(df, "freezer", Config(), agora=FIM)
    assert rel["status"] in ("indeterminado", "critico")
    assert any(a["codigo"] == "dados_insuficientes" for a in rel["achados"])


def test_sem_nenhum_dado():
    df = pd.DataFrame({"ts": pd.Series(dtype="datetime64[ns, UTC]"), "temp": pd.Series(dtype=float)})
    rel = analisar_dataframe(df, "freezer", Config(), agora=FIM)
    assert rel["status"] in ("indeterminado", "atencao")
    assert rel["pontuacao_saude"] is None or rel["status"] != "normal"


def test_refrigerador_usa_limites_proprios():
    df = _padronizar(gerar("normal", fim=FIM, base=4.0), "coletado_em", "temperatura")
    rel = analisar_dataframe(df, "refrigerador", Config(), agora=FIM)
    assert rel["status"] == "normal"


def test_limite_invalido():
    with pytest.raises(ValueError):
        analisar_dataframe(pd.DataFrame({"ts": [], "temp": []}), "freezer", limite_alerta=-5, limite_critico=-10)


def test_json_serializavel():
    import json
    json.dumps(rodar("falha_sensor"), ensure_ascii=False)


def test_supabase_paginacao(monkeypatch):
    """Simula o cliente do Supabase para validar paginação e colunas usadas."""
    linhas = [{"coletado_em": (FIM - timedelta(seconds=10 * i)).isoformat(), "temperatura": -18.0}
              for i in range(2500)][::-1]
    chamadas = []

    class Consulta:
        def __init__(self): self.ini = self.fim = 0
        def select(self, cols): chamadas.append(("select", cols)); return self
        def gte(self, *a): return self
        def lte(self, *a): return self
        def eq(self, *a): return self
        def order(self, *a, **k): return self
        def range(self, i, f): self.ini, self.fim = i, f; return self
        def execute(self):
            return type("R", (), {"data": linhas[self.ini:self.fim + 1]})()

    class Cliente:
        def table(self, nome): chamadas.append(("table", nome)); return Consulta()

    import supabase
    monkeypatch.setattr(supabase, "create_client", lambda url, chave: Cliente())
    monkeypatch.setenv("SUPABASE_URL", "https://exemplo.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "chave-de-teste")
    from freezer_ai.fontes import SupabaseFonte
    df = SupabaseFonte(Config()).buscar_historico(dias=1)
    assert len(df) == 2500
    assert ("table", "temperaturas") in chamadas
    assert ("select", "coletado_em,temperatura") in chamadas
