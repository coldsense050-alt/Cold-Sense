import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFreezer } from "../../../services/freezerService";
import type { Freezer } from "../../../types/freezer";

export function useCreateFreezer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFreezer,
    onSuccess: async (freezer) => {
      queryClient.setQueryData(["freezers", freezer.id], freezer);
      queryClient.setQueryData<Freezer[]>(["freezers"], (current = []) =>
        [...current.filter((item) => item.id !== freezer.id), freezer]
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
      await queryClient.invalidateQueries({ queryKey: ["freezers"] });
    },
  });
}
