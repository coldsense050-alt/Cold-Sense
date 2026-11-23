import { supabase } from "./supabaseClient";
import type { Freezer, FreezerInput } from "../types/freezer";

export async function getFreezers(): Promise<Freezer[]> {
  const { data, error } = await supabase
    .from("freezers")
    .select("id, nome")
    .order("nome", { ascending: true })
    .overrideTypes<Freezer[], { merge: false }>();

  if (error) throw error;

  return data ?? [];
}

export async function getFreezer(id: number): Promise<Freezer | null> {
  const { data, error } = await supabase
    .from("freezers")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle<Freezer>();

  if (error) throw error;

  return data;
}

export async function createFreezer(values: FreezerInput): Promise<Freezer> {
  const nome = values.nome.trim();

  if (!nome) throw new Error("Informe o nome do freezer.");

  const { data, error } = await supabase
    .from("freezers")
    .insert({ nome })
    .select("id, nome")
    .single<Freezer>();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um freezer com esses dados. Escolha outro nome.");
    }
    if (error.code === "42501") {
      throw new Error("Seu usuário não tem permissão para cadastrar freezers. Entre em contato com o administrador.");
    }
    throw new Error("Não foi possível cadastrar o freezer. Verifique sua conexão e tente novamente.");
  }

  return data;
}
