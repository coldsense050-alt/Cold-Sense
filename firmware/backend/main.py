import time
import re
import serial

from backend.supabase_client import supabase

# PORTA_SERIAL = "COM3" mudar porta depois
VELOCIDADE = 115200

LIMITE_TEMPERATURA = 30
INTERVALO_ENVIO = 300

ultimo_envio = None

def extrair_temperatura(linha):
    resultado = re.search(r"TEMP:\s*(-?\d+(?:\.\d+)?)", linha)

    if resultado:
        return float(resultado.group(1))

    return None


print("Conectando à ESP32...")

with serial.Serial(PORTA_SERIAL, VELOCIDADE, timeout=1) as placa:

    print("ESP32 conectada, aguardando temperaturas...")

    while True:
        linha = placa.readline().decode("utf-8", errors="ignore").strip()

        temperatura = extrair_temperatura(linha)

        if temperatura is None:
            continue

        print(f"Temperatura recebida: {temperatura} °C")

        if temperatura >= LIMITE_TEMPERATURA:

            agora = time.monotonic()

            if ultimo_envio is None or agora - ultimo_envio >= INTERVALO_ENVIO:

                dados = {
                    "temperatura": temperatura
                }

                try:
                    resposta = supabase.table("temperaturas").insert(dados).execute()

                    ultimo_envio = agora

                    print("Temperatura enviada ao Supabase!")
                    print(resposta.data)

                except Exception as erro:
                    print(f"Erro ao enviar: {erro}")

            else:
                print("Limite atingido. Aguardando intervalo de envio.")

        else:
            print("Temperatura normal.")
            ultimo_envio = None