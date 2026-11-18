from machine import Pin
import onewire
import ds18x20
import time

# Sensor DS18B20 no GPIO 4 (D4), com resistor de 4,7 kOhm entre DADOS e 3V3
PINO_SENSOR = 4
INTERVALO_MS = 1000  # pausa entre leituras

sensor = ds18x20.DS18X20(onewire.OneWire(Pin(PINO_SENSOR)))


def procurar_sensores():
    encontrados = sensor.scan()
    if encontrados:
        print("Sensor encontrado!")
    else:
        print("Nenhum sensor encontrado! Nova tentativa em 5 s...")
    return encontrados


sensores = procurar_sensores()

while True:
    if not sensores:
        time.sleep(5)
        sensores = procurar_sensores()
        continue

    try:
        sensor.convert_temp()
        time.sleep_ms(750)
        for dispositivo in sensores:
            print("TEMP:" + str(sensor.read_temp(dispositivo)))
    except Exception as erro:
        print("Erro na leitura:", erro)
        sensores = []  # procura o sensor de novo

    time.sleep_ms(INTERVALO_MS)