import { supabase } from "./supabaseClient";

export async function getTemperatures() {
  const { data, error } = await supabase
    .from("temperaturas")
    .select("*")
    .order("coletado_em", { ascending: false });
  if (error) throw error;
  return data;
}
