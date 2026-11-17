"""Testes da API em modo simulação (sem banco)."""

import importlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def cliente(monkeypatch):
    monkeypatch.setenv("FREEZER_AI_FONTE", "simulacao")
    import api
    importlib.reload(api)
    return TestClient(api.app)


def test_saude(cliente):
    assert cliente.get("/saude").json()["ok"] is True


def test_relatorio_24h_por_minuto(cliente):
    r = cliente.get("/relatorio", params={"cenario": "porta_aberta"})
    assert r.status_code == 200
    d = r.json()
    assert d["serie"]["resolucao"] == "minuto"
    assert 1400 <= len(d["serie"]["pontos"]) <= 1442
    assert any(a["tipo"] == "acima_do_limite" for a in d["anomalias"])
    assert d["periodo"]["tempo_real"] is True


def test_relatorio_7_dias_por_hora(cliente):
    fim = datetime.now(timezone.utc)
    r = cliente.get("/relatorio", params={"inicio": (fim - timedelta(days=7)).isoformat(),
                                          "fim": fim.isoformat(), "cenario": "perda_estabilidade"})
    d = r.json()
    assert d["serie"]["resolucao"] == "hora"
    assert any(a["codigo"] == "tendencia_aquecimento" for a in d["achados"])


def test_periodo_passado(cliente):
    fim = datetime.now(timezone.utc) - timedelta(days=2)
    d = cliente.get("/relatorio", params={"inicio": (fim - timedelta(hours=6)).isoformat(),
                                          "fim": fim.isoformat(), "cenario": "falha_refrigeracao"}).json()
    assert d["periodo"]["tempo_real"] is False
    assert "fim do período" in d["resumo"]


@pytest.mark.parametrize("params", [
    {"resolucao": "minuto", "inicio": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()},
    {"perfil": "geladeira"},
    {"inicio": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()},
])
def test_validacoes(cliente, params):
    assert cliente.get("/relatorio", params=params).status_code == 422
