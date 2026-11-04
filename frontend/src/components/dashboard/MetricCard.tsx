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
  description = "Sem dados disponíveis",
}: MetricCardProps) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-md shadow-slate-900/10">
      <h4 className="text-xs font-bold text-body">{label}</h4>
      <p className={`mt-3 text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="mt-2 text-xs text-muted">{description}</p>
    </article>
  );
}
