import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSavePrestador } from "./useSavePrestador";
import { deletePrestador, getPrestadores } from "../../../services/prestadorService";

export function usePrestadores() {
  const queryClient = useQueryClient();
  const queryKey = ["prestadores"];
  const query = useQuery({ queryKey, queryFn: getPrestadores });

  const saveMutation = useSavePrestador();

  const deleteMutation = useMutation({
    mutationFn: deletePrestador,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, data: query.data ?? [], saveMutation, deleteMutation };
}
