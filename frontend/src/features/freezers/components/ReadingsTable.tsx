import { useState } from "react";
import type { Temperature } from "../../../types/temperature";
import { formatNumber } from "../../../utils/formatNumber";
import { formatReadingDate } from "../utils";

const PAGE_SIZE = 10;
const paginationClasses = "min-h-11 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";

export default function ReadingsTable({ readings }: { readings: Temperature[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(readings.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = readings.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="freezer-readings-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft p-5">
        <h3 id="freezer-readings-heading" className="text-base font-semibold text-heading">Leituras de temperatura</h3>
        <p className="text-sm text-muted">{readings.length} {readings.length === 1 ? "leitura no período" : "leituras no período"}</p>
      </div>
      {visible.length === 0 ? <p className="p-8 text-center text-base text-muted">Nenhuma leitura no período selecionado.</p> : <>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Leituras do freezer no período selecionado, da mais recente para a mais antiga.</caption>
            <thead className="border-b border-border-soft bg-page/50 text-muted"><tr><th scope="col" className="px-5 py-3 font-medium">Data e hora</th><th scope="col" className="px-5 py-3 text-right font-medium">Temperatura</th></tr></thead>
            <tbody className="divide-y divide-border-soft">{visible.map((reading) => <tr key={reading.id} className="hover:bg-primary-soft/60"><td className="px-5 py-3.5 text-body"><time dateTime={reading.coletado_em}>{formatReadingDate(reading.coletado_em)}</time></td><td className="px-5 py-3.5 text-right font-semibold whitespace-nowrap text-primary tabular-nums">{formatNumber(reading.temperatura)} °C</td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft p-4">
          <p role="status" className="text-sm text-muted">Página {currentPage + 1} de {pageCount}</p>
          <div className="flex gap-2"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={paginationClasses}>Anterior</button><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className={paginationClasses}>Próxima</button></div>
        </div>
      </>}
    </section>
  );
}
