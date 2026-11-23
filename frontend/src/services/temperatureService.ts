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

export async function getLatestTemperature(freezerId: number): Promise<Temperature | null> {
  const { data, error } = await supabase
    .from("temperaturas")
    .select("id, temperatura, coletado_em, freezer_id")
    .eq("freezer_id", freezerId)
    .order("coletado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<Temperature>();

  if (error) throw error;
  return data;
}

export async function getFreezerTemperatureHistory(freezerId: number): Promise<Temperature[]> {
  const readings: Temperature[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("temperaturas")
      .select("id, temperatura, coletado_em, freezer_id")
      .eq("freezer_id", freezerId)
      .order("coletado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1)
      .overrideTypes<Temperature[], { merge: false }>();

    if (error) throw error;
    readings.push(...(data ?? []));
    if (!data || data.length < pageSize) return readings;
  }
}
