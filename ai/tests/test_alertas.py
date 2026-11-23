"""Testes do vigia de alertas (modo simulação, sem banco e sem enviar e-mail de verdade)."""

import time
from datetime import datetime, timedelta, timezone

import pytest

from freezer_ai.alertas import Monitor, _conteudo_email
from freezer_ai.config import perfil_do_freezer


class EmailFalso:
    def __init__(self):
        self.enviados = []
        self.copias = ["manutencao@exemplo.com"]
        self.usuario = "alertas@exemplo.com"

    configurado = True

    def enviar(self, para, assunto, texto, html):
        self.enviados.append({"para": para, "assunto": assunto, "texto": texto})


def esperar_emails(email, n, limite=3.0):
    fim = time.time() + limite
    while len(email.enviados) < n and time.time() < fim:
        time.sleep(0.05)
    return email.enviados


@pytest.fixture()
def vigia():
    email = EmailFalso()
    m = Monitor(lambda: None, simulacao=True, email=email)
    return m, email


def test_perfil_do_cadastro():
    p = perfil_do_freezer({"id": 1, "nome": "Sorvetes", "temperatura_min": -25, "temperatura_max": -10})
    assert (p.ideal_min, p.ideal_max, p.limite_alerta, p.limite_critico) == (-25, -10, -10, -7)
    assert perfil_do_freezer({"id": 2, "nome": "Sem faixa"}) is None
    assert perfil_do_freezer({"id": 3, "temperatura_min": 5, "temperatura_max": 2}) is None


def test_normal_nao_gera_alerta(vigia):
    m, email = vigia
    m.definir_cenario("normal")
    estado = m.verificar()
    assert estado["ativos"] == []
    assert estado["monitor"]["ultimo_erro"] is None
    assert estado["monitor"]["freezers_monitorados"][0]["nome"] == "Freezer simulado"


def test_critico_gera_alerta_e_email(vigia):
    m, email = vigia
    m.definir_cenario("falha_refrigeracao")
    estado = m.verificar()
    assert len(estado["ativos"]) == 1
    alerta = estado["ativos"][0]
    assert alerta["nivel"] == "critico"
    assert alerta["faixa"] == [-25.0, -10.0]
    assert any(a["codigo"] == "temperatura_critica" for a in alerta["achados"])
    enviados = esperar_emails(email, 1)
    assert enviados and "CRÍTICO" in enviados[0]["assunto"]
    assert enviados[0]["para"] == ["manutencao@exemplo.com"]

    # segunda verificação: não repete o e-mail (lembrete só depois do intervalo)
    m.verificar()
    time.sleep(0.3)
    assert len(email.enviados) == 1


def test_ciente_e_encerramento(vigia):
    m, email = vigia
    m.definir_cenario("falha_refrigeracao")
    alerta = m.verificar()["ativos"][0]
    esperar_emails(email, 1)
    assert m.marcar_ciente(alerta["id"], "alan@exemplo.com")["ciente_por"] == "alan@exemplo.com"
    assert m.marcar_ciente("inexistente", None) is None

    m.definir_cenario("normal")
    for _ in range(m.confirmacoes_normal):
        estado = m.verificar()
    assert estado["ativos"] == []
    assert estado["historico"][0]["encerrado_em"] is not None
    enviados = esperar_emails(email, 2)
    assert "Normalizado" in enviados[1]["assunto"]


def test_atencao_precisa_confirmar(vigia):
    m, _ = vigia
    m.email_nivel = "atencao"
    m.confirmacoes_atencao = 2
    m._processar({"id": 7, "nome": "X"}, {"nivel": "atencao", "titulo": "t", "achados": [], "recomendacoes": [],
                                          "temperatura": -9.5, "faixa": [-25, -10], "limites": {}})
    assert m.estado()["ativos"] == []          # 1ª vez: só observa
    m._processar({"id": 7, "nome": "X"}, {"nivel": "atencao", "titulo": "t", "achados": [], "recomendacoes": [],
                                          "temperatura": -9.5, "faixa": [-25, -10], "limites": {}})
    assert len(m.estado()["ativos"]) == 1      # 2ª vez seguida: vira alerta


def test_sem_leituras_vira_critico(vigia):
    import pandas as pd
    m, _ = vigia
    ultima = datetime.now(timezone.utc) - timedelta(hours=2)
    vazio = pd.DataFrame({"ts": pd.Series(dtype="datetime64[ns, UTC]"), "temp": pd.Series(dtype=float)})
    r = m._analisar({"id": 1, "nome": "F", "temperatura_min": -25, "temperatura_max": -10}, vazio, ultima)
    assert r["nivel"] == "critico" and r["achados"][0]["codigo"] == "sem_dados_recentes"


def test_conteudo_do_email():
    alerta = {
        "nivel": "critico", "titulo": "Temperatura atual crítica", "temperatura": -5.1,
        "faixa": [-25.0, -10.0], "inicio": datetime.now(timezone.utc).isoformat(),
        "freezer": {"id": 1, "nome": "Sorvetes – Setor A", "localizacao": "Empório Vila Serena",
                    "marca": "Fricon", "modelo": "HCED 311 V"},
        "achados": [{"mensagem": "A temperatura atual é -5,1 °C."}],
        "recomendacoes": ["Verifique se o equipamento está ligado."],
    }
    assunto, texto, html = _conteudo_email(alerta, "http://localhost:5173/freezer-ai")
    assert assunto == "[Cold-Sense] CRÍTICO – Sorvetes – Setor A (Empório Vila Serena): -5,1 °C"
    assert "Fricon HCED 311 V" in texto and "-25,0 a -10,0 °C" in texto
    assert "<li>Verifique se o equipamento está ligado.</li>" in html
