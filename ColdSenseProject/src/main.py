from machine import Pin
import onewire
import ds18x20
import time

# Sensor conectado ao GPIO 4
pino = Pin(4)

# Configura comunicacao OneWire
barramento = onewire.OneWire(pino)

# Inicializa o DS18B20
sensor = ds18x20.DS18X20(barramento)

# Procura sensores conectados
sensores = sensor.scan()

if not sensores:
    print("Nenhum sensor encontrado!")
else:
    print("Sensor encontrado!")

while True:
    if sensores:
        sensor.convert_temp()
        time.sleep_ms(750)

        for dispositivo in sensores:
            temperatura = sensor.read_temp(dispositivo)
            print("Temperatura:", temperatura, "°C")