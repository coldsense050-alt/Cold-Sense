import { useQuery } from "@tanstack/react-query";
import { getTemperatures } from "../services/temperatureService";
import type { Freezer } from "../types/freezer";
import type { Temperature, TemperaturePeriod } from "../types/temperature";
import { getTemperatureHighlights } from "../utils/temperatureHighlights";

export function useTemperature(freezerID: number | null, period: TemperaturePeriod, freezers: Freezer[]) {
  const temperatureQ = useQuery<Temperature[], Error>({
    queryKey: ["temperatures", freezerID, period],
    queryFn: ({ signal }) => getTemperatures(freezerID, period, signal),
  });

  const temperatures = temperatureQ.data;
  const updatedAt = temperatureQ.dataUpdatedAt;

  const lastReading = temperatures?.[0];

  const lastReadingTime = lastReading
    ? new Date(lastReading.coletado_em).getTime()
    : undefined;

  const minutesSinceLastReading = lastReadingTime !== undefined
    ? (updatedAt - lastReadingTime) / 60_000
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
    (readingTime) => (updatedAt - readingTime) / 60_000 <= 10,
  ).length;

  const freezerStatusIndicator =
    freezerID === null
      ? {
          label: "Freezers ativos",
          value: String(activeFreezers),
          valueColor: activeFreezers === 0 ? "text-muted" : "text-success",
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
          collectedAt: lastReading?.coletado_em,
          description: lastReading ? undefined : "Nenhuma leitura recebida",
        };

  const indicators = [
    ...getTemperatureHighlights(temperatures ?? [], freezerID, freezers),
    freezerStatusIndicator,
    {
      label: "Total de ordens de serviço",
      value: "0",
      valueColor: "text-muted",
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
