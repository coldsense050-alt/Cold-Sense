import type { Freezer } from "../../types/freezer";
import type { TemperaturePeriod } from "../../types/temperature";

type FilterBarProps = {
  freezerId: string;
  period: TemperaturePeriod;
  freezers: Freezer[];
  isLoadingFreezers?: boolean;
  isRefreshing?: boolean;
  onFreezerChange: (freezerId: string) => void;
  onPeriodChange: (period: TemperaturePeriod) => void;
  onRefresh: () => void;
};

const selectClasses =
  "h-9 w-full appearance-none rounded-lg border border-border bg-page/70 pl-8 pr-7 text-xs font-medium text-body outline-none transition focus:rounded-b-none focus:border-primary bg-surface ";

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function FilterBar({
  freezerId,
  period,
  freezers,
  isLoadingFreezers = false,
  isRefreshing = false,
  onFreezerChange,
  onPeriodChange,
  onRefresh,
}: FilterBarProps) {
  return (
    <div
      aria-label="Filtros do dashboard"
      className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap"
    >
      <label className="min-w-0 flex-1 sm:w-44 sm:flex-none">
        <span className="sr-only">Freezer</span>
        <span className="relative block">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <rect x="5" y="2.5" width="14" height="19" rx="2" />
            <path d="M5 10h14M9 6.5v1" />
          </svg>
          <select
            className={selectClasses}
            value={freezerId}
            disabled={isLoadingFreezers}
            onChange={(event) => onFreezerChange(event.target.value)}
          >
            <option value="all">Todos os freezers</option>
            {freezers.map((freezer) => (
              <option key={freezer.id} value={freezer.id}>
                {freezer.nome}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </span>
      </label>

      <label className="min-w-0 flex-1 sm:w-40 sm:flex-none">
        <span className="sr-only">Período</span>
        <span className="relative block">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M6.75 3v3M17.25 3v3M3.75 9h16.5" />
            <rect x="3.75" y="4.5" width="16.5" height="16" rx="2" />
          </svg>
          <select
            className={selectClasses}
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as TemperaturePeriod)}
          >
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="all">Todo o período</option>
          </select>
          <ChevronIcon />
        </span>
      </label>

      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isRefreshing}
        onClick={onRefresh}
        aria-label={isRefreshing ? "Atualizando dados" : "Atualizar dados"}
        title={isRefreshing ? "Atualizando..." : "Atualizar"}
      >
        <svg
          className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
        </svg>
      </button>
    </div>
  );
}
