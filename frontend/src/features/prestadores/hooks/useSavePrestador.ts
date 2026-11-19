import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savePrestador } from "../../../services/prestadorService";
import type { PrestadorFields, PrestadorInput } from "../types";

function normalizePrestadorFields(values: PrestadorInput): PrestadorFields {
  return {
    nome: values.nome.trim(),
    email: values.email.trim() || null,
    telefone: values.telefone.trim() || null,
    ativo: values.ativo,
  };
}

export function useSavePrestador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id: number | null; values: PrestadorInput }) => {
      const fields = normalizePrestadorFields(values);
      return savePrestador(id, fields, values.freezerIds);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["prestadores"] }),
  });
}
