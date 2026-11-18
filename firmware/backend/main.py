"""Ponte ESP32 (serial) -> Supabase.

Lê as linhas "TEMP:<valor>" que o ESP32 envia pela serial e grava TODAS as
leituras na tabela "temperaturas" (uma a cada INTERVALO_ENVIO segundos, usando
a mediana das leituras do intervalo para filtrar ruído). A Freezer AI precisa
do histórico completo para analisar tendências, oscilações e anomalias.

Rodar (dentro da pasta firmware/):
    python -m backend.main

Configuração no arquivo firmware/.env (veja .env.example):
    PORTA_SERIAL, VELOCIDADE_SERIAL, INTERVALO_ENVIO, LIMITE_TEMPERATURA
"""

import os
import re
import statistics
import time
from datetime import datetime, timezone

import serial

from backend.supabase_client import supabase  # também carrega o .env

PORTA_SERIAL = os.getenv("PORTA_SERIAL", "COM3")  # Linux/Mac: /dev/ttyUSB0 ou /dev/ttyACM0
VELOCIDADE = int(os.getenv("VELOCIDADE_SERIAL", "115200"))
INTERVALO_ENVIO = float(os.getenv("INTERVALO_ENVIO", "10"))  # segundos entre gravações
LIMITE_TEMPERATURA = float(os.getenv("LIMITE_TEMPERATURA", "30"))  # só para aviso no console
FREEZER_ID = os.getenv("FREEZER_ID", "").strip()  # id do freezer na tabela "freezers" (opcional)
MAX_PENDENTES = 5000  # leituras guardadas na memória se o Supabase/internet cair

TABELA = "temperaturas"

# Fica fora de executar() para não perder leituras se a serial reconectar
pendentes = []


def extrair_temperatura(linha):
    resultado = re.search(r"TEMP:\s*(-?\d+(?:\.\d+)?)", linha)

    if resultado:
        return float(resultado.group(1))

    return None


def enviar(pendentes):
    """Envia as leituras pendentes em lote. Devolve True se gravou."""
    try:
        supabase.table(TABELA).insert(pendentes).execute()
        return True
    except Exception as erro:
        print(f"Erro ao enviar ao Supabase ({len(pendentes)} leituras guardadas): {erro}")
        return False


def executar():
    global pendentes
    janela = []
    inicio_janela = time.monotonic()

    print(f"Conectando à ESP32 em {PORTA_SERIAL}...")

    with serial.Serial(PORTA_SERIAL, VELOCIDADE, timeout=1) as placa:
        destino = f"freezer {FREEZER_ID}" if FREEZER_ID else "sem freezer definido (FREEZER_ID vazio)"
        print(f"ESP32 conectada. Gravando uma leitura a cada {INTERVALO_ENVIO:.0f} s – {destino}.")

        while True:
            linha = placa.readline().decode("utf-8", errors="ignore").strip()
            temperatura = extrair_temperatura(linha)

            if temperatura is not None:
                janela.append(temperatura)

            if not janela or time.monotonic() - inicio_janela < INTERVALO_ENVIO:
                continue

            valor = round(statistics.median(janela), 2)
            janela = []
            inicio_janela = time.monotonic()

            registro = {
                "temperatura": valor,
                "coletado_em": datetime.now(timezone.utc).isoformat(),
            }
            if FREEZER_ID:
                registro["freezer_id"] = int(FREEZER_ID)
            pendentes.append(registro)
            pendentes = pendentes[-MAX_PENDENTES:]

            aviso = "  << ACIMA DO LIMITE" if valor >= LIMITE_TEMPERATURA else ""
            if enviar(pendentes):
                print(f"{datetime.now():%H:%M:%S}  {valor} °C  gravado ({len(pendentes)}){aviso}")
                pendentes = []
            else:
                print(f"{datetime.now():%H:%M:%S}  {valor} °C  aguardando envio{aviso}")


if __name__ == "__main__":
    while True:
        try:
            executar()
        except serial.SerialException as erro:
            print(f"Sem conexão com a ESP32 ({erro}). Nova tentativa em 5 s...")
            time.sleep(5)
        except KeyboardInterrupt:
            print("Encerrado.")
            break
