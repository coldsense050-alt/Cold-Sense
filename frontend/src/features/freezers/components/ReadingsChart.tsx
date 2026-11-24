import { useId } from "react";
import type { Temperature } from "../../../types/temperature";
import { formatNumber } from "../../../utils/formatNumber";
import { formatReadingDate } from "../utils";

export default function ReadingsChart({ readings }: { readings: Temperature[] }) {
  const gradientId = useId();
  const points = readings.slice(0, 240).toReversed();

  if (points.length === 0) return <p className="flex min-h-52 items-center justify-center text-center text-base text-muted">Nenhuma leitura no período selecionado.</p>;

  const values = points.map((point) => point.temperatura);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.15, 0.5);
  const lower = minimum - padding;
  const upper = maximum + padding;
  const start = Date.parse(points[0].coletado_em);
  const end = Date.parse(points[points.length - 1].coletado_em);
  const plot = points.map((point) => ({
    ...point,
    x: end === start ? 300 : 8 + ((Date.parse(point.coletado_em) - start) / (end - start)) * 584,
    y: 176 - ((point.temperatura - lower) / (upper - lower)) * 160,
  }));
  const line = plot.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-48 shrink-0 flex-col justify-between py-2 text-right text-sm text-muted tabular-nums" aria-hidden="true">
          <span>{formatNumber(upper)}°</span><span>{formatNumber((upper + lower) / 2)}°</span><span>{formatNumber(lower)}°</span>
        </div>
        <div className="min-w-0 flex-1">
          <svg viewBox="0 0 600 192" preserveAspectRatio="none" className="h-48 w-full overflow-visible text-primary" role="img" aria-label={`Temperaturas de ${formatReadingDate(points[0].coletado_em)} a ${formatReadingDate(points[points.length - 1].coletado_em)}, entre ${formatNumber(minimum)} e ${formatNumber(maximum)} graus Celsius. Os valores estão disponíveis na tabela de leituras.`}>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.16" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.01" /></linearGradient></defs>
            {[16, 96, 176].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="stroke-border" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />)}
            {plot.length > 1 && <path d={`${line} L${plot[plot.length - 1].x},176 L${plot[0].x},176 Z`} fill={`url(#${gradientId})`} />}
            <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {plot.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r={plot.length === 1 ? 4 : 2} fill="currentColor"><title>{formatReadingDate(point.coletado_em)}: {formatNumber(point.temperatura)} °C</title></circle>)}
          </svg>
          <div className="mt-2 flex justify-between gap-4 text-sm text-muted"><span>{formatReadingDate(points[0].coletado_em)}</span>{points.length > 1 && <span className="text-right">{formatReadingDate(points[points.length - 1].coletado_em)}</span>}</div>
        </div>
      </div>
      {readings.length > 240 && <p className="mt-4 text-sm text-muted">Gráfico das últimas 240 leituras do período. Consulte todas as leituras na tabela abaixo.</p>}
    </div>
  );
}
