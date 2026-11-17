import { useQuery } from "@tanstack/react-query";
import { getTemperatures } from "../services/temperatureService";
import type { Temperature } from "../types/temperature";
import { formatNumber } from "../utils/formatNumber";

export function useTemperature(freezerID: number | null) {
  const temperatureQ = useQuery<Temperature[], Error>({
    queryKey: ["temperatures", freezerID],
    queryFn: () => getTemperatures(freezerID),
  });

  const temperatures = temperatureQ.data;

  const lastReading = temperatures?.[0];

  const currentTemperature = lastReading?.temperatura;

  const averageTemperature =
    temperatures && temperatures.length > 0
      ? temperatures.reduce((total, item) => total + item.temperatura, 0) /
        temperatures.length
      : undefined;

  const lastReadingTime = lastReading
    ? new Date(lastReading.coletado_em).getTime()
    : undefined;

  const minutesSinceLastReading = lastReadingTime
    ? (Date.now() - lastReadingTime) / 60_000
    : undefined;

  const connectionStatus =
    minutesSinceLastReading === undefined
      ? "Sem dados"
      : minutesSinceLastReading <= 10
        ? "Ativo"
        : minutesSinceLastReading <= 15
          ? "Instável"
          : "Offline";

  const latestReadingByFreezer = new Map<number, number>();

  temperatures?.forEach((temperature) => {
    if (temperature.freezer_id === null) return;

    const readingTime = new Date(temperature.coletado_em).getTime();
    const latestReadingTime = latestReadingByFreezer.get(
      temperature.freezer_id,
    );

    if (latestReadingTime === undefined || readingTime > latestReadingTime) {
      latestReadingByFreezer.set(temperature.freezer_id, readingTime);
    }
  });

  const activeFreezers = Array.from(latestReadingByFreezer.values()).filter(
    (readingTime) => (Date.now() - readingTime) / 60_000 <= 10,
  ).length;

  const freezerStatusIndicator =
    freezerID === null
      ? {
          label: "Freezers ativos",
          value: String(activeFreezers),
          valueColor: activeFreezers === 0 ? "text-grey" : "text-success",
        }
      : {
          label: "Status do freezer",
          value: connectionStatus,
          valueColor:
            connectionStatus === "Ativo"
              ? "text-success"
              : connectionStatus === "Instável"
                ? "text-warning"
                : "text-red-600",
          description: lastReading
            ? `Última leitura: ${new Date(lastReading.coletado_em).toLocaleString("pt-BR")}`
            : "Nenhuma leitura recebida",
        };

  const indicators = [
    {
      label: "Temperatura atual",
      value:
        currentTemperature !== undefined
          ? `${formatNumber(currentTemperature)} °C`
          : "-- °C",
      valueColor: "text-primary",
    },
    {
      label: "Temperatura média",
      value:
        averageTemperature !== undefined
          ? `${formatNumber(averageTemperature)} °C`
          : "-- °C",
      valueColor: "text-secondary",
    },
    freezerStatusIndicator,
    {
      label: "Total de ordens de serviço",
      value: "0",
      valueColor: "text-grey",
    },
  ];

  return {
    data: temperatures,
    indicators,
    isPending: temperatureQ.isPending,
    isError: temperatureQ.isError,
    error: temperatureQ.error,
    isFetching: temperatureQ.isFetching,
    refetch: temperatureQ.refetch,
  };
}
