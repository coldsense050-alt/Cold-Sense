import { useId, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { Temperature, TemperaturePeriod } from "../../types/temperature";
import { formatNumber } from "../../utils/formatNumber";
import { getTemperatureChartAxis, groupTemperatureReadings } from "../../utils/temperatureChart";
import type { TemperatureChartGranularity, TemperatureChartMetric, TemperatureChartPoint } from "../../utils/temperatureChart";
import EmptyState from "./EmptyState";

type TemperatureBarChartProps = {
  temperatures: Temperature[];
  period: TemperaturePeriod;
  metric: TemperatureChartMetric;
  onMetricChange: (metric: TemperatureChartMetric) => void;
};

const METRICS: { id: TemperatureChartMetric; label: string }[] = [
  { id: "maximum", label: "Máxima" },
  { id: "minimum", label: "Mínima" },
  { id: "average", label: "Média" },
];

function formatInterval(timestamp: number, granularity: TemperatureChartGranularity, full = false) {
  const date = new Date(timestamp);
  if (!full) {
    return granularity === "hour"
      ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(granularity === "hour" ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function TemperatureChartTooltip({
  active, payload, granularity, metric,
}: TooltipContentProps & { granularity: TemperatureChartGranularity; metric: TemperatureChartMetric }) {
  const point = payload?.[0]?.payload as TemperatureChartPoint | undefined;
  if (!active || !point) return null;
  const value = point[metric];

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-muted">{formatInterval(point.timestamp, granularity, true)}</p>
      {value === null ? (
        <p className="mt-2 text-sm text-muted">Sem registros neste intervalo.</p>
      ) : (
        <>
          <p className="mt-2 text-base font-bold text-primary">{formatNumber(value)} °C</p>
          <p className="mt-1 text-xs text-muted">{point.count.toLocaleString("pt-BR")} {point.count === 1 ? "registro" : "registros"}</p>
        </>
      )}
    </div>
  );
}

export default function TemperatureBarChart({ temperatures, period, metric, onMetricChange }: TemperatureBarChartProps) {
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { points, granularity, totalCount } = useMemo(() => groupTemperatureReadings(temperatures, period), [temperatures, period]);
  const { domain, ticks } = useMemo(() => getTemperatureChartAxis(points), [points]);
  const selectedMetric = METRICS.find((item) => item.id === metric)!;
  const unitLabel = granularity === "hour" ? "hora" : "dia";

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": nextIndex = (index + 1) % METRICS.length; break;
      case "ArrowLeft": nextIndex = (index + METRICS.length - 1) % METRICS.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = METRICS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onMetricChange(METRICS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-sm" aria-labelledby={`${id}-heading`}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`${id}-heading`} className="text-base font-semibold text-heading">Gráfico de temperaturas</h3>
          <p className="mt-1 text-xs text-muted" aria-live="polite">
            {selectedMetric.label} por {unitLabel} · {totalCount.toLocaleString("pt-BR")} {totalCount === 1 ? "registro" : "registros"}
          </p>
        </div>
        <div role="tablist" aria-label="Medida de temperatura" className="inline-flex self-start rounded-lg border border-border-soft bg-page p-1">
          {METRICS.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => { tabRefs.current[index] = element; }}
              type="button"
              role="tab"
              id={`${id}-tab-${item.id}`}
              aria-selected={metric === item.id}
              aria-controls={`${id}-panel`}
              tabIndex={metric === item.id ? 0 : -1}
              onClick={() => onMetricChange(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`min-h-9 cursor-pointer rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${metric === item.id ? "bg-surface text-primary shadow-sm" : "text-muted hover:bg-surface/60 hover:text-heading"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${metric}`}>
        {points.length === 0 ? (
          <EmptyState message="Nenhum registro encontrado para os filtros selecionados." />
        ) : (
          <>
            <div className="h-64 w-full min-w-0 sm:h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 288 }}>
                <BarChart
                  data={points}
                  accessibilityLayer
                  aria-label={`${selectedMetric.label} de temperatura por ${unitLabel}, em graus Celsius`}
                  margin={{ top: 10, right: 8, left: 0, bottom: 4 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid vertical={false} stroke="var(--color-border-soft)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => formatInterval(Number(value), granularity)}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    tickMargin={10}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    height={36}
                  />
                  <YAxis
                    domain={domain}
                    ticks={ticks}
                    tickFormatter={(value) => `${formatNumber(Number(value))} °C`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    width={64}
                    interval={0}
                  />
                  <Tooltip
                    filterNull={false}
                    cursor={{ fill: "var(--color-primary-soft)" }}
                    isAnimationActive={false}
                    content={(props) => <TemperatureChartTooltip {...props} metric={metric} granularity={granularity} />}
                  />
                  <Bar
                    dataKey={metric}
                    name={selectedMetric.label}
                    fill="var(--color-primary)"
                    activeBar={{ fill: "var(--color-primary-hover)" }}
                    radius={3}
                    maxBarSize={36}
                    minPointSize={(value) => value === 0 ? 2 : 0}
                    isAnimationActive={false}
                  />
                  <ReferenceLine y={0} stroke="var(--color-muted)" strokeWidth={1.5} zIndex={500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted">Horário local · Intervalos sem registros ficam vazios.</p>
          </>
        )}
      </div>
    </section>
  );
}
