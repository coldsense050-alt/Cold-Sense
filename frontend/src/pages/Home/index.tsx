const indicators = [
  "Temperatura atual",
  "Temperatura média",
  "Sensores ativos",
  "Alertas ativos",
];

function EmptySection({ message }: { message: string }) {
  return <p>{message}</p>;
}

export default function Dashboard() {
  return (
    <>
      <h2>Dashboard</h2>

      <section aria-labelledby="overview-heading">
        <h3 id="overview-heading">Visão geral</h3>
        {indicators.map((indicator) => (
          <article key={indicator}>
            <h4>{indicator}</h4>
            <EmptySection message="Sem dados" />
          </article>
        ))}
      </section>

      <section aria-labelledby="readings-heading">
        <h3 id="readings-heading">Leituras de temperatura</h3>
        <EmptySection message="Nenhuma leitura disponível." />
      </section>

      <section aria-labelledby="sensors-heading">
        <h3 id="sensors-heading">Sensores</h3>
        <EmptySection message="Nenhum sensor disponível." />
      </section>

      <section aria-labelledby="alerts-heading">
        <h3 id="alerts-heading">Alertas</h3>
        <EmptySection message="Nenhum alerta disponível." />
      </section>
    </>
  );
}
