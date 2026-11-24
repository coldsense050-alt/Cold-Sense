import { useQuery } from "@tanstack/react-query";
import { getFreezerTemperatureHistory } from "../../../services/temperatureService";

export function useFreezerReadings(freezerId: number, enabled = true) {
  const query = useQuery({
    queryKey: ["freezer-temperature-history", freezerId],
    queryFn: () => getFreezerTemperatureHistory(freezerId),
    enabled,
    refetchInterval: 60_000,
  });

  return { ...query, data: query.data ?? [] };
}
