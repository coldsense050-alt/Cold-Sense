import { supabase } from "./supabaseClient";
import type { Temperature, TemperaturePeriod } from "../types/temperature";

const PAGE_SIZE = 1000;
const PERIOD_DURATION_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function getTemperatures(
  freezerID: number | null,
  period: TemperaturePeriod,
  signal?: AbortSignal,
): Promise<Temperature[]> {
  const until = new Date();
  const since = period === "all"
    ? null
    : new Date(until.getTime() - PERIOD_DURATION_MS[period]).toISOString();
  const temperatures: Temperature[] = [];
  let totalCount: number | null = null;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("temperaturas")
      .select("id, temperatura, coletado_em, freezer_id", offset === 0 ? { count: "exact" } : {})
      .lte("coletado_em", until.toISOString());

    if (freezerID !== null) {
      query = query.eq("freezer_id", freezerID);
    }

    if (since !== null) {
      query = query.gte("coletado_em", since);
    }

    if (signal) query = query.abortSignal(signal);

    const { data, error, count } = await query
      .order("coletado_em", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data as Temperature[]) ?? [];
    totalCount = count ?? totalCount;
    temperatures.push(...page);

    if (page.length < PAGE_SIZE || (totalCount !== null && temperatures.length >= totalCount)) {
      return temperatures;
    }
  }
}
