import random
import time

from backend.supabase_client import supabase

LIMITE_TEMPERATURA = 30
INTERVALO_ENVIO = 30

ultimo_envio = None

while True:
    temperatura = round(random.uniform(25, 35), 2)

    print(f"Temperatura atual: {temperatura} °C")

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
                print(f"Erro ao enviar temperatura: {erro}")

        else:
            print("Temperatura elevada. Aguardando intervalo de envio.")

    else:
        print("Temperatura normal.")
        ultimo_envio = None

    time.sleep(5)