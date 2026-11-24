import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAlertas, marcarCiente, verificarAgora } from "../services/alertasService";
import type { EstadoAlertas } from "../types/freezerAi";

export const CHAVE_ALERTAS = ["freezer-ai", "alertas"] as const;

/** Consulta os alertas da Freezer AI a cada 30 s (em todas as páginas). */
export function useAlertas() {
  const consulta = useQuery<EstadoAlertas, Error>({
    queryKey: CHAVE_ALERTAS,
    queryFn: getAlertas,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 10_000,
    retry: false,
  });
  const ativos = consulta.data?.ativos ?? [];
  return {
    estado: consulta.data,
    ativos,
    pendentes: ativos.filter((a) => !a.ciente),
    online: consulta.isSuccess && !consulta.isError,
    isError: consulta.isError,
    refetch: consulta.refetch,
  };
}

export function useMarcarCiente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, por }: { id: string; por?: string | null }) => marcarCiente(id, por),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_ALERTAS }),
  });
}

export function useVerificarAgora() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: verificarAgora,
    onSuccess: (dados) => queryClient.setQueryData(CHAVE_ALERTAS, dados),
  });
}
