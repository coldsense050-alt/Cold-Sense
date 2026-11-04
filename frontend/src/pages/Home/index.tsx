import EmptyState from "../../components/dashboard/EmptyState";
import MetricCard from "../../components/dashboard/MetricCard";
import SectionCard from "../../components/dashboard/SectionCard";

const indicators = [
  { label: "Temperatura atual", value: "-- °C", valueColor: "text-primary" },
  { label: "Temperatura média", value: "-- °C", valueColor: "text-secondary" },
  { label: "Sensores ativos", value: "0", valueColor: "text-success" },
  { label: "Alertas ativos", value: "0", valueColor: "text-warning" },
];

export default function Dashboard() {
  return (
    <div className="dashboard-page space-y-2 lg:flex lg:flex-col lg:space-y-0">
      <div className="lg:shrink-0 lg:pb-2">
        <h2 className="text-2xl font-bold text-secondary">Dashboard</h2>
      </div>

      <div className="dashboard-grid grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <section aria-label="Métricas gerais">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {indicators.map((indicator) => (
              <MetricCard key={indicator.label} {...indicator} />
            ))}
          </div>
        </section>

        <div className="dashboard-scroll space-y-6 lg:pr-2">
          <SectionCard title="Leituras de temperatura" titleId="readings-heading">
            <EmptyState message="Nenhuma leitura disponível." />
          </SectionCard>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Sensores" titleId="sensors-heading">
              <EmptyState message="Nenhum sensor disponível." />
            </SectionCard>

            <SectionCard title="Alertas" titleId="alerts-heading">
              <EmptyState message="Nenhum alerta disponível." />
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
