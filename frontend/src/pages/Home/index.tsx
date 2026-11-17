import { useState } from "react";
import EmptyState from "../../components/dashboard/EmptyState";
import FilterBar from "../../components/dashboard/FilterBar";
import MetricCard from "../../components/dashboard/MetricCard";
import SectionCard from "../../components/dashboard/SectionCard";
import { useTemperature } from "../../hooks/useTemperature";

export default function Dashboard() {
  const [freezerId, setFreezerId] = useState("all");
  const [period, setPeriod] = useState("24h");
  const selectedFreezerId = freezerId === "all" ? null : Number(freezerId);
  const { indicators, isError, isPending, error, isFetching, refetch } =
    useTemperature(selectedFreezerId);

  return (
    <div className="dashboard-page space-y-2 lg:flex lg:flex-col lg:space-y-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:shrink-0 lg:pb-2">
        <h2 className="text-2xl font-bold text-secondary">Dashboard</h2>
        <FilterBar
          freezerId={freezerId}
          period={period}
          isRefreshing={isFetching && !isPending}
          onFreezerChange={setFreezerId}
          onPeriodChange={setPeriod}
          onRefresh={() => void refetch()}
        />
      </header>

      {isPending ? (
        <div
          className="flex flex-1 items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-medium text-body">
              Carregando temperaturas...
            </p>
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center">
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm"
            role="alert"
          >
            <h3 className="text-lg font-semibold text-heading">
              Não foi possível carregar as temperaturas
            </h3>
            <p className="mt-2 text-sm text-muted">
              {error?.message ?? "Ocorreu um erro inesperado."}
            </p>
            <button
              type="button"
              className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Tentando novamente..." : "Tentar novamente"}
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid grid items-start gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
          <section className="min-h-0 md:h-full" aria-label="Métricas gerais">
            <div className="grid gap-3 sm:grid-cols-2 md:h-full md:grid-cols-1 md:auto-rows-fr">
              {indicators.map((indicator) => (
                <MetricCard key={indicator.label} {...indicator} />
              ))}
            </div>
          </section>

          <div className="dashboard-scroll space-y-6 md:pr-2">
            <SectionCard
              title="Leituras de temperatura"
              titleId="readings-heading"
            >
              <EmptyState message="Nenhuma leitura disponível." />
            </SectionCard>

            <div className="grid gap-6 md:grid-cols-2">
              <SectionCard title="Freezers" titleId="freezers-heading">
                <EmptyState message="Nenhum freezer disponível." />
              </SectionCard>

              <SectionCard title="Ordens de serviço" titleId="oc-heading">
                <EmptyState message="Nenhuma ordem de serviço criada." />
              </SectionCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
