import { useState } from "react";
import type { Freezer } from "../../types/freezer";
import type { Temperature } from "../../types/temperature";
import { formatNumber } from "../../utils/formatNumber";
import { assessTemperature } from "../../utils/temperatureStatus";
import EmptyState from "./EmptyState";
import TemperatureStatusBadge from "./TemperatureStatusBadge";

type TemperatureReadingsProps = {
  temperatures: Temperature[];
  freezers: Freezer[];
};

const PAGE_SIZE = 10;

export default function TemperatureReadings({ temperatures, freezers }: TemperatureReadingsProps) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(temperatures.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const visibleReadings = temperatures.slice(start, start + PAGE_SIZE);

  if (temperatures.length === 0) {
    return <EmptyState message="Nenhum registro encontrado para os filtros selecionados." />;
  }

  const freezersById = new Map(freezers.map((freezer) => [freezer.id, freezer]));

  return (
    <div>
      <p className="mb-3 text-xs text-muted" role="status">
        {temperatures.length.toLocaleString("pt-BR")} {temperatures.length === 1 ? "registro encontrado" : "registros encontrados"}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-144 text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th scope="col" className="px-2 py-3 font-semibold">Data e hora</th>
              <th scope="col" className="px-2 py-3 font-semibold">Freezer</th>
              <th scope="col" className="px-2 py-3 text-right font-semibold">Temperatura</th>
              <th scope="col" className="px-2 py-3 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {visibleReadings.map((reading) => (
              <tr key={reading.id}>
                <td className="px-2 py-3 whitespace-nowrap text-body">
                  <time dateTime={reading.coletado_em}>{new Date(reading.coletado_em).toLocaleString("pt-BR")}</time>
                </td>
                <td className="px-2 py-3 text-body">
                  {reading.freezer_id === null
                    ? "Sem freezer vinculado"
                    : freezersById.get(reading.freezer_id)?.nome ?? `Freezer #${reading.freezer_id}`}
                </td>
                <td className="px-2 py-3 text-right font-semibold whitespace-nowrap text-primary">
                  {formatNumber(reading.temperatura)} °C
                </td>
                <td className="px-2 py-3 text-right">
                  <TemperatureStatusBadge assessment={assessTemperature(reading.temperatura, reading.freezer_id === null ? undefined : freezersById.get(reading.freezer_id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-3">
        <p className="text-sm text-muted" role="status">{start + 1}–{Math.min(start + PAGE_SIZE, temperatures.length)} de {temperatures.length} registros</p>
        <div className="flex items-center gap-3">
          <button type="button" disabled={page === 1} onClick={() => setRequestedPage(page - 1)} className="min-h-10 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
          <span className="text-sm text-muted" aria-label={`Página ${page} de ${pageCount}`}>{page} / {pageCount}</span>
          <button type="button" disabled={page === pageCount} onClick={() => setRequestedPage(page + 1)} className="min-h-10 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Próxima</button>
        </div>
      </div>
    </div>
  );
}
