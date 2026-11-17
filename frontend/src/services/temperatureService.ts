import { supabase } from "./supabaseClient";
import type { Temperature } from "../types/temperature";

export async function getTemperatures(
  freezerID: number | null,
): Promise<Temperature[]> {
  let query = supabase.from("temperaturas").select("*");

  if (freezerID != null) {
    query = query.eq("freezer_id", freezerID);
  }

  const { data, error } = await query.order("coletado_em", {
    ascending: false,
  });

  if (error) throw error;

  return (data as Temperature[]) ?? [];
}
