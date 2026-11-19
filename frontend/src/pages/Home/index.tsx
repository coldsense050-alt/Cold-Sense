import { lazy, Suspense, useState } from "react";
import EmptyState from "../../components/dashboard/EmptyState";
import FilterBar from "../../components/dashboard/FilterBar";
import FreezerReadings from "../../components/dashboard/FreezerReadings";
import MetricCard from "../../components/dashboard/MetricCard";
import SectionCard from "../../components/dashboard/SectionCard";
import TemperatureReadings from "../../components/dashboard/TemperatureReadings";
import { useFreezer } from "../../hooks/useFreezer";
import { useTemperature } from "../../hooks/useTemperature";
import type { TemperaturePeriod } from "../../types/temperature";
import type { TemperatureChartMetric } from "../../utils/temperatureChart";

const TemperatureBarChart = lazy(() => import("../../components/dashboard/TemperatureBarChart"));

export default function Dashboard() {
  const [freezerId, setFreezerId] = useState("all");
  const [period, setPeriod] = useState<TemperaturePeriod>("24h");
  const [chartMetric, setChartMetric] = useState<TemperatureChartMetric>("maximum");
  const selectedFreezerId = freezerId === "all" ? null : Number(freezerId);
  const freezerQuery = useFreezer();
  const { data: temperatures = [], indicators, isError, isPending, error, isFetching, refetch } =
    useTemperature(selectedFreezerId, period, freezerQuery.data);
  const selectedFreezers = selectedFreezerId === null
    ? freezerQuery.data
    : freezerQuery.data.filter((freezer) => freezer.id === selectedFreezerId);

  function refreshDashboard() {
    void refetch();
    void freezerQuery.refetch();
  }

  return (
    <div className="dashboard-page space-y-2 lg:flex lg:flex-col lg:space-y-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:shrink-0 lg:pb-2">
        <h2 className="text-2xl font-bold text-secondary">Dashboard</h2>
        <FilterBar
          freezerId={freezerId}
          period={period}
          freezers={freezerQuery.data}
          isLoadingFreezers={freezerQuery.isPending}
          isRefreshing={isFetching || freezerQuery.isFetching}
          onFreezerChange={setFreezerId}
          onPeriodChange={setPeriod}
          onRefresh={refreshDashboard}
        />
      </header>

      {freezerQuery.isError && (
        <p className="text-sm text-danger" role="alert">
          Não foi possível carregar a lista de freezers. Use Atualizar dados para tentar novamente.
        </p>
      )}

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
          <section className="min-h-0 md:h-full md:overflow-y-auto md:pr-1" aria-label="Métricas gerais">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              {indicators.map((indicator) => (
                <MetricCard key={indicator.label} {...indicator} />
              ))}
            </div>
          </section>

          <div className="dashboard-scroll space-y-6 md:pr-2">
            <Suspense fallback={
              <SectionCard title="Gráfico de temperaturas" titleId="temperature-chart-loading">
                <div className="flex h-72 items-center justify-center text-sm text-muted" role="status">Carregando gráfico...</div>
              </SectionCard>
            }>
              <TemperatureBarChart temperatures={temperatures} period={period} metric={chartMetric} onMetricChange={setChartMetric} />
            </Suspense>
            <SectionCard
              title="Registros de temperaturas"
              titleId="readings-heading"
            >
              <TemperatureReadings key={`${freezerId}:${period}`} temperatures={temperatures} freezers={freezerQuery.data} />
            </SectionCard>

            <div className="grid gap-6 md:grid-cols-2">
              <SectionCard title="Freezers" titleId="freezers-heading">
                <FreezerReadings
                  freezers={selectedFreezers}
                  temperatures={temperatures}
                  isPending={freezerQuery.isPending}
                  isError={freezerQuery.isError}
                />
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
