import type { Temperature, TemperaturePeriod } from "../types/temperature";

export type TemperatureChartMetric = "maximum" | "minimum" | "average";
export type TemperatureChartGranularity = "hour" | "day";

export type TemperatureChartPoint = {
  timestamp: number;
  maximum: number | null;
  minimum: number | null;
  average: number | null;
  count: number;
};

export function groupTemperatureReadings(temperatures: readonly Temperature[], period: TemperaturePeriod) {
  const validReadings = temperatures.filter((reading) =>
    Number.isFinite(reading.temperatura) && Number.isFinite(Date.parse(reading.coletado_em)),
  );
  let firstTime = Infinity;
  let lastTime = -Infinity;
  for (const reading of validReadings) {
    const time = Date.parse(reading.coletado_em);
    firstTime = Math.min(firstTime, time);
    lastTime = Math.max(lastTime, time);
  }

  const granularity: TemperatureChartGranularity = period === "24h" || (period === "all" && validReadings.length > 0 && lastTime - firstTime <= 86_400_000)
    ? "hour"
    : "day";
  const groups = new Map<number, { maximum: number; minimum: number; total: number; count: number }>();

  function bucketTime(time: number) {
    const date = new Date(time);
    if (granularity === "hour") date.setMinutes(0, 0, 0);
    else date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  for (const reading of validReadings) {
    const timestamp = bucketTime(Date.parse(reading.coletado_em));
    const group = groups.get(timestamp);
    if (group) {
      group.maximum = Math.max(group.maximum, reading.temperatura);
      group.minimum = Math.min(group.minimum, reading.temperatura);
      group.total += reading.temperatura;
      group.count += 1;
    } else {
      groups.set(timestamp, { maximum: reading.temperatura, minimum: reading.temperatura, total: reading.temperatura, count: 1 });
    }
  }

  const points: TemperatureChartPoint[] = [];
  if (validReadings.length > 0) {
    const cursor = new Date(bucketTime(firstTime));
    const end = bucketTime(lastTime);
    while (cursor.getTime() <= end) {
      const timestamp = cursor.getTime();
      const group = groups.get(timestamp);
      points.push({
        timestamp,
        maximum: group?.maximum ?? null,
        minimum: group?.minimum ?? null,
        average: group ? group.total / group.count : null,
        count: group?.count ?? 0,
      });
      if (granularity === "hour") cursor.setHours(cursor.getHours() + 1);
      else cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { points, granularity, totalCount: validReadings.length };
}

export function getTemperatureChartAxis(points: readonly TemperatureChartPoint[]) {
  let extent = 1;
  for (const point of points) {
    if (point.minimum !== null) extent = Math.max(extent, Math.abs(point.minimum));
    if (point.maximum !== null) extent = Math.max(extent, Math.abs(point.maximum));
  }
  const roughStep = extent / 3;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const factor = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= roughStep) ?? 10;
  const step = factor * magnitude;
  const bound = Number((step * 3).toPrecision(12));
  const ticks = Array.from({ length: 7 }, (_, index) => Number(((index - 3) * step).toPrecision(12)));
  return { domain: [-bound, bound] as [number, number], ticks };
}
