import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import Icon from "../../components/ui/Icon";
import { getFreezer } from "../../services/freezerService";
import { formatNumber } from "../../utils/formatNumber";
import FreezerFeedback from "./components/FreezerFeedback";
import ReadingsChart from "./components/ReadingsChart";
import ReadingsTable from "./components/ReadingsTable";
import { useFreezerReadings } from "./hooks/useFreezerReadings";
import { formatReadingDate, getConnectionStatus } from "./utils";

type Period = "24h" | "7d" | "all";

function FreezerDetails({ id }: { id: number }) {
  const freezerQuery = useQuery({ queryKey: ["freezers", id], queryFn: () => getFreezer(id) });
  const readingsQuery = useFreezerReadings(id, !!freezerQuery.data);
  const [period, setPeriod] = useState<Period>("24h");
  const validReadings = readingsQuery.data.filter((reading) => Number.isFinite(reading.temperatura) && Number.isFinite(Date.parse(reading.coletado_em)));
  const latest = validReadings[0];
  const since = period === "all" ? -Infinity : Date.now() - (period === "24h" ? 24 : 168) * 3_600_000;
  const readings = validReadings.filter((reading) => Date.parse(reading.coletado_em) >= since);
  const statistics = readings.reduce((result, reading) => ({
    total: result.total + reading.temperatura,
    minimum: Math.min(result.minimum, reading.temperatura),
    maximum: Math.max(result.maximum, reading.temperatura),
  }), { total: 0, minimum: Infinity, maximum: -Infinity });
  const status = readingsQuery.isError
    ? { label: "Dados indisponíveis", className: "border-border bg-page text-muted" }
    : readingsQuery.isPending
      ? { label: "Carregando leituras...", className: "border-border bg-page text-muted" }
      : getConnectionStatus(latest);
  const isRefreshing = freezerQuery.isFetching || readingsQuery.isFetching;

  if (freezerQuery.isPending) return <p role="status" className="py-12 text-center text-base text-muted">Carregando freezer...</p>;
  if (freezerQuery.isError && !freezerQuery.data) return <FreezerFeedback title="Não foi possível carregar o freezer" message="Verifique sua conexão e tente novamente." isError isBusy={freezerQuery.isFetching} actionLabel="Tentar novamente" onAction={() => void freezerQuery.refetch()} />;
  if (!freezerQuery.data) return <FreezerFeedback title="Freezer não encontrado" message="Este equipamento não está disponível. Volte à listagem para escolher outro freezer." />;

  const metrics = [
    { label: "Última temperatura", value: latest?.temperatura, description: latest ? formatReadingDate(latest.coletado_em) : "Aguardando a primeira leitura" },
    { label: "Temperatura média", value: readings.length ? statistics.total / readings.length : undefined, description: "No período selecionado" },
    { label: "Temperatura mínima", value: readings.length ? statistics.minimum : undefined, description: "No período selecionado" },
    { label: "Temperatura máxima", value: readings.length ? statistics.maximum : undefined, description: "No período selecionado" },
  ];

  function refresh() {
    void freezerQuery.refetch();
    void readingsQuery.refetch();
  }

  return (
    <>
      <header className="flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary-soft text-primary"><Icon name="freezer" className="size-7" /></span>
          <div className="min-w-0">
            <p className="mb-1 text-sm text-muted">Freezer #{id}</p>
            <h2 className="text-2xl font-bold tracking-tight wrap-break-word text-heading">{freezerQuery.data.nome}</h2>
            <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-sm font-medium ${status.className}`}>{status.label}</span>
          </div>
        </div>
        <button type="button" onClick={refresh} disabled={isRefreshing} className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"><Icon name="refresh" className={`size-4 ${isRefreshing ? "motion-safe:animate-spin" : ""}`} />{isRefreshing ? "Atualizando..." : "Atualizar"}</button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2 md:pr-2">
        {freezerQuery.isError && <p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-body">Não foi possível atualizar o cadastro. Os últimos dados carregados continuam disponíveis.</p>}
        {readingsQuery.isError && <p role="alert" className="rounded-xl border border-danger-border bg-danger-soft p-4 text-sm text-danger">Não foi possível atualizar as leituras deste freezer.{validReadings.length > 0 ? " Exibindo os últimos dados carregados." : ""} <button type="button" disabled={readingsQuery.isFetching} onClick={() => void readingsQuery.refetch()} className="cursor-pointer font-semibold underline underline-offset-2 disabled:opacity-60">Tentar novamente</button></p>}

        <section className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center" aria-label="Período do histórico">
          <div><h3 className="text-base font-semibold text-heading">Histórico do freezer</h3><p className="mt-1 text-sm text-muted">Selecione o período das métricas e leituras.</p></div>
          <div className="relative sm:w-52">
            <label htmlFor="freezer-period" className="sr-only">Período das leituras</label>
            <select id="freezer-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="min-h-11 w-full appearance-none rounded-xl border border-border bg-surface py-2.5 pr-10 pl-3 text-base text-heading outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"><option value="24h">Últimas 24 horas</option><option value="7d">Últimos 7 dias</option><option value="all">Todo o histórico</option></select>
            <Icon name="chevron" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
          </div>
        </section>

        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Métricas de temperatura" aria-busy={readingsQuery.isPending}>
          {metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-border bg-surface p-5"><dt className="text-sm font-medium text-body">{metric.label}</dt><dd className="mt-3 text-2xl font-semibold tracking-tight whitespace-nowrap text-primary tabular-nums">{readingsQuery.isPending ? "..." : metric.value === undefined ? "--" : formatNumber(metric.value)} <span className="text-base font-medium text-muted">°C</span></dd><dd className="mt-2 text-sm text-muted">{metric.description}</dd></div>)}
        </dl>

        {readingsQuery.isPending ? <div role="status" className="flex min-h-52 items-center justify-center rounded-2xl border border-border bg-surface text-base text-muted">Carregando leituras de temperatura...</div> : validReadings.length === 0 ? !readingsQuery.isError && <FreezerFeedback title="Aguardando a primeira leitura" message="As temperaturas e o histórico aparecerão aqui quando este freezer enviar dados." /> : <>
          <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="freezer-chart-heading"><h3 id="freezer-chart-heading" className="mb-5 text-base font-semibold text-heading">Variação de temperatura</h3><ReadingsChart readings={readings} /></section>
          <ReadingsTable key={period} readings={readings} />
        </>}

        <p className="text-sm leading-relaxed text-muted">O status indica a conexão: ativo até 10 minutos sem uma leitura, instável até 15 minutos e offline após esse intervalo.</p>
      </div>
    </>
  );
}

export default function FreezerDetailsPage() {
  const { freezerId } = useParams();
  const id = Number(freezerId);
  const isValidId = /^[1-9]\d*$/.test(freezerId ?? "") && Number.isSafeInteger(id);

  return (
    <div className="flex min-h-full flex-col gap-5 md:h-full md:min-h-0">
      <Link to="/freezers" className="w-fit shrink-0 rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Voltar para freezers</Link>
      {isValidId ? <FreezerDetails key={id} id={id} /> : <FreezerFeedback title="Freezer não encontrado" message="O endereço deste equipamento é inválido. Volte à listagem para escolher um freezer." />}
    </div>
  );
}
