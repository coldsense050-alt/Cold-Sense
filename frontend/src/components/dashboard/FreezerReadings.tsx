import type { Freezer } from "../../types/freezer";
import type { Temperature } from "../../types/temperature";
import { formatNumber } from "../../utils/formatNumber";
import { assessTemperature } from "../../utils/temperatureStatus";
import EmptyState from "./EmptyState";
import TemperatureStatusBadge from "./TemperatureStatusBadge";

type FreezerReadingsProps = {
  freezers: Freezer[];
  temperatures: Temperature[];
  isPending: boolean;
  isError: boolean;
};

export default function FreezerReadings({
  freezers,
  temperatures,
  isPending,
  isError,
}: FreezerReadingsProps) {
  if (isPending) return <EmptyState message="Carregando freezers..." />;
  if (isError)
    return (
      <EmptyState message="Não foi possível carregar os freezers. Tente atualizar os dados." />
    );
  if (freezers.length === 0)
    return <EmptyState message="Nenhum freezer disponível." />;

  const readingsByFreezer = new Map<
    number,
    {
      latest: Temperature;
      maximum: number;
      minimum: number;
      total: number;
      count: number;
    }
  >();
  for (const reading of temperatures) {
    if (reading.freezer_id === null || !Number.isFinite(reading.temperatura))
      continue;

    const summary = readingsByFreezer.get(reading.freezer_id);
    if (summary) {
      summary.maximum = Math.max(summary.maximum, reading.temperatura);
      summary.minimum = Math.min(summary.minimum, reading.temperatura);
      summary.total += reading.temperatura;
      summary.count += 1;
    } else {
      // Readings arrive in descending collection order.
      readingsByFreezer.set(reading.freezer_id, {
        latest: reading,
        maximum: reading.temperatura,
        minimum: reading.temperatura,
        total: reading.temperatura,
        count: 1,
      });
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-soft">
      <table className="w-full min-w-160 text-left text-sm">
        <thead className="border-b border-border bg-page text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-3 font-semibold">
              Freezer
            </th>
            <th
              scope="col"
              className="px-3 py-3 text-right font-semibold text-primary"
            >
              Última
            </th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">
              Máxima
            </th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">
              Mínima
            </th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">
              Média
            </th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {freezers.map((freezer) => {
            const summary = readingsByFreezer.get(freezer.id);
            const reading = summary?.latest;
            const metrics = [
              { label: "Máxima", value: summary?.maximum },
              { label: "Mínima", value: summary?.minimum },
              {
                label: "Média",
                value: summary ? summary.total / summary.count : undefined,
              },
            ];

            return (
              <tr
                key={freezer.id}
                className="transition-colors hover:bg-page/50"
              >
                <th scope="row" className="min-w-44 px-3 py-4 font-normal">
                  <p className="font-semibold text-heading">{freezer.nome}</p>
                  <p className="mt-1 text-xs text-muted">
                    {reading ? (
                      <>
                        Última leitura:{" "}
                        <time dateTime={reading.coletado_em}>
                          {new Date(reading.coletado_em).toLocaleString(
                            "pt-BR",
                          )}
                        </time>
                      </>
                    ) : (
                      "Sem leituras no período"
                    )}
                  </p>
                </th>
                <td className="px-3 py-4 text-right text-lg font-bold whitespace-nowrap text-primary tabular-nums">
                  {reading ? formatNumber(reading.temperatura) : "--"} °C
                </td>
                {metrics.map((metric) => (
                  <td
                    key={metric.label}
                    className="px-3 py-4 text-right font-semibold whitespace-nowrap text-body tabular-nums"
                  >
                    {metric.value === undefined
                      ? "--"
                      : formatNumber(metric.value)}{" "}
                    °C
                  </td>
                ))}
                <td className="px-3 py-4 text-right">
                  <TemperatureStatusBadge
                    assessment={assessTemperature(
                      reading?.temperatura,
                      freezer,
                    )}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
