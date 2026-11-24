import { Link } from "react-router";
import Icon from "../../../components/ui/Icon";
import type { Freezer } from "../../../types/freezer";
import type { Temperature } from "../../../types/temperature";
import { formatNumber } from "../../../utils/formatNumber";
import { formatReadingDate, getConnectionStatus } from "../utils";

interface FreezerCardProps {
  freezer: Freezer;
  reading?: Temperature;
  isLoadingReadings: boolean;
  hasReadingError: boolean;
}

export default function FreezerCard({ freezer, reading, isLoadingReadings, hasReadingError }: FreezerCardProps) {
  const status = hasReadingError
    ? { label: "Leitura indisponível", className: "border-border bg-page text-muted" }
    : isLoadingReadings
      ? { label: "Carregando...", className: "border-border bg-page text-muted" }
      : getConnectionStatus(reading);

  return (
    <article className="h-full">
      <Link to={`/freezers/${freezer.id}`} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm shadow-secondary/5 transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-primary/10 bg-primary-soft text-primary"><Icon name="freezer" className="size-6" /></span>
          <span className={`rounded-full border px-2.5 py-1 text-sm font-medium ${status.className}`}>{status.label}</span>
        </div>
        <h3 className="mt-5 text-lg font-bold wrap-break-word text-heading group-hover:text-primary">{freezer.nome}</h3>
        <p className="mt-1 text-sm text-muted">Freezer #{freezer.id}</p>
        <div className="mt-6 flex-1">
          <p className="text-sm text-muted">Última temperatura</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-primary tabular-nums">
            {reading && !hasReadingError ? formatNumber(reading.temperatura) : "--"}<span className="ml-1 text-lg font-medium text-muted">°C</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {hasReadingError ? "Não foi possível consultar a temperatura." : isLoadingReadings ? "Buscando última leitura..." : reading ? <time dateTime={reading.coletado_em}>{formatReadingDate(reading.coletado_em)}</time> : "Aguardando a primeira leitura."}
          </p>
        </div>
        <div className="mt-5 border-t border-border-soft pt-4 text-sm font-semibold text-primary">Ver detalhes do freezer</div>
      </Link>
    </article>
  );
}
