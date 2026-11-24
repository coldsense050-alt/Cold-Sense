import type { TemperatureAssessment } from "../../types/temperature";
import TemperatureStatusBadge from "./TemperatureStatusBadge";

type MetricCardProps = {
  label: string;
  value: string;
  valueColor: string;
  description?: string;
  assessment?: TemperatureAssessment;
  freezerName?: string;
  collectedAt?: string;
  collectedAtLabel?: string;
};

export default function MetricCard({
  label,
  value,
  valueColor,
  description,
  assessment,
  freezerName,
  collectedAt,
  collectedAtLabel = "Último registro",
}: MetricCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm shadow-slate-900/10 md:h-full md:min-h-0">
      <h4 className="text-xs font-bold text-body">{label}</h4>
      <p className={`mt-3 text-xl font-bold ${valueColor}`}>{value}</p>
      {assessment && <div className="mt-2"><TemperatureStatusBadge assessment={assessment} freezerName={freezerName} /></div>}
      {description && <p className="mt-2 text-xs text-muted">{description}</p>}
      {collectedAt && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <time dateTime={collectedAt} title={collectedAtLabel}>{new Date(collectedAt).toLocaleString("pt-BR")}</time>
        </p>
      )}
    </article>
  );
}
