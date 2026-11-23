import { useQueries } from "@tanstack/react-query";
import { getLatestTemperature } from "../../../services/temperatureService";
import type { Freezer } from "../../../types/freezer";

export function useLatestFreezerReadings(freezers: Freezer[]) {
  const queries = useQueries({
    queries: freezers.map((freezer) => ({
      queryKey: ["freezer-latest-temperature", freezer.id],
      queryFn: () => getLatestTemperature(freezer.id),
      refetchInterval: 60_000,
    })),
  });

  return {
    byFreezer: new Map(freezers.map((freezer, index) => [freezer.id, queries[index]])),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
