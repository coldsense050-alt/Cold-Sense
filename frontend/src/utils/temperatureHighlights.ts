import type { Freezer } from "../types/freezer";
import type { Temperature } from "../types/temperature";
import { formatNumber } from "./formatNumber.ts";
import { assessTemperature } from "./temperatureStatus.ts";

export function getTemperatureHighlights(
  temperatures: readonly Temperature[],
  freezerId: number | null,
  freezers: readonly Freezer[],
) {
  let maximum: Temperature | undefined;
  let minimum: Temperature | undefined;
  let latest: Temperature | undefined;
  let total = 0;
  let count = 0;

  // Readings arrive from the service in descending collection order.
  for (const reading of temperatures) {
    if (!Number.isFinite(reading.temperatura)) continue;
    latest ??= reading;
    if (!maximum || reading.temperatura > maximum.temperatura) maximum = reading;
    if (!minimum || reading.temperatura < minimum.temperatura) minimum = reading;
    total += reading.temperatura;
    count += 1;
  }

  const freezersById = new Map(freezers.map((freezer) => [freezer.id, freezer]));
  const temperatureValue = (value: number | undefined) => value === undefined ? "-- °C" : `${formatNumber(value)} °C`;
  const freezerName = (reading: Temperature | undefined) => {
    if (!reading) return undefined;
    if (reading.freezer_id === null) return "Sem freezer vinculado";
    return freezersById.get(reading.freezer_id)?.nome ?? `Freezer #${reading.freezer_id}`;
  };
  const readingAssessment = (reading: Temperature | undefined) => {
    if (!reading) return undefined;
    const freezer = reading.freezer_id === null
      ? undefined
      : freezersById.get(reading.freezer_id) ?? { id: reading.freezer_id, nome: `Freezer #${reading.freezer_id}` };
    return assessTemperature(reading.temperatura, freezer);
  };
  const maximumIndicator = {
    label: "Temperatura máxima",
    value: temperatureValue(maximum?.temperatura),
    valueColor: "text-secondary",
    collectedAt: maximum?.coletado_em,
    collectedAtLabel: "Registrado em",
  };

  if (freezerId === null) {
    return [
      { ...maximumIndicator, freezerName: freezerName(maximum), assessment: readingAssessment(maximum) },
      {
        label: "Temperatura mínima",
        value: temperatureValue(minimum?.temperatura),
        valueColor: "text-secondary",
        freezerName: freezerName(minimum),
        assessment: readingAssessment(minimum),
        collectedAt: minimum?.coletado_em,
        collectedAtLabel: "Registrado em",
      },
    ];
  }

  const freezer = freezersById.get(freezerId) ?? { id: freezerId, nome: `Freezer #${freezerId}` };
  const average = count > 0 ? total / count : undefined;

  return [
    { ...maximumIndicator, assessment: assessTemperature(maximum?.temperatura, freezer) },
    {
      label: "Temperatura mínima",
      value: temperatureValue(minimum?.temperatura),
      valueColor: "text-secondary",
      assessment: assessTemperature(minimum?.temperatura, freezer),
      collectedAt: minimum?.coletado_em,
      collectedAtLabel: "Registrado em",
    },
    {
      label: "Temperatura média",
      value: temperatureValue(average),
      valueColor: "text-secondary",
      assessment: assessTemperature(average, freezer),
      collectedAt: latest?.coletado_em,
      collectedAtLabel: "Dados até",
    },
  ];
}
