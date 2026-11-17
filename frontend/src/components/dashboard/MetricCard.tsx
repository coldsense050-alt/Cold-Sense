type MetricCardProps = {
  label: string;
  value: string;
  valueColor: string;
  description?: string;
};

export default function MetricCard({
  label,
  value,
  valueColor,
  description,
}: MetricCardProps) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm shadow-slate-900/10 md:h-full md:min-h-0">
      <h4 className="text-xs font-bold text-body">{label}</h4>
      <p className={`mt-3 text-xl font-bold ${valueColor}`}>{value}</p>
      {description && <p className="mt-2 text-xs text-muted">{description}</p>}
    </article>
  );
}
