import { useQuery } from "@tanstack/react-query";
import { getFreezers } from "../services/freezerService";
import type { Freezer } from "../types/freezer";

export function useFreezer() {
  const freezerQ = useQuery<Freezer[], Error>({
    queryKey: ["freezers"],
    queryFn: getFreezers,
  });

  return {
    data: freezerQ.data ?? [],
    isPending: freezerQ.isPending,
    isError: freezerQ.isError,
    error: freezerQ.error,
    isFetching: freezerQ.isFetching,
    refetch: freezerQ.refetch,
  };
}
