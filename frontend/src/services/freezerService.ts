import { supabase } from "./supabaseClient";
import type { Freezer } from "../types/freezer";

export async function getFreezers(): Promise<Freezer[]> {
  const { data, error } = await supabase
    .from("freezers")
    .select("id, nome")
    .order("nome", { ascending: true })
    .overrideTypes<Freezer[], { merge: false }>();

  if (error) throw error;

  return data ?? [];
}
