import { useState } from "react";
import Icon from "../../components/ui/Icon";
import { useFreezer } from "../../hooks/useFreezer";
import type { FreezerInput } from "../../types/freezer";
import FreezerCard from "./components/FreezerCard";
import FreezerFeedback from "./components/FreezerFeedback";
import FreezerFormModal from "./components/FreezerFormModal";
import { useCreateFreezer } from "./hooks/useCreateFreezer";
import { useLatestFreezerReadings } from "./hooks/useLatestFreezerReadings";
import { normalizeSearch } from "./utils";

export default function Freezers() {
  const freezerQuery = useFreezer();
  const readingsQuery = useLatestFreezerReadings(freezerQuery.data);
  const createMutation = useCreateFreezer();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const term = normalizeSearch(search.trim());
  const filtered = freezerQuery.data.filter((freezer) => normalizeSearch(`${freezer.nome} ${freezer.id}`).includes(term));
  const isRefreshing = freezerQuery.isFetching || readingsQuery.isFetching;

  async function handleSave(values: FreezerInput) {
    const freezer = await createMutation.mutateAsync(values);
    setSearch("");
    setNotice(`${freezer.nome} cadastrado com sucesso.`);
    setFormOpen(false);
  }

  function refresh() {
    void freezerQuery.refetch();
    if (freezerQuery.data.length > 0) void readingsQuery.refetch();
  }

  return (
    <div className="flex min-h-full flex-col gap-6 md:h-full md:min-h-0">
      <header className="flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm font-semibold tracking-widest text-muted uppercase">Equipamentos</p>
          <h2 className="text-2xl font-bold tracking-tight text-heading">Freezers</h2>
          <p className="mt-2 text-base text-muted">Acompanhe seus equipamentos e acesse o histórico de cada freezer.</p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/10 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Icon name="plus" className="size-4.5" />Adicionar freezer
        </button>
      </header>

      {notice && <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/15 px-4 py-2.5">
        <p role="status" className="text-sm font-medium wrap-break-word text-heading">{notice}</p>
        <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-heading hover:bg-success/20 focus-visible:outline-2 focus-visible:outline-primary"><Icon name="close" className="size-4" /></button>
      </div>}

      <section className="shrink-0 rounded-2xl border border-border bg-surface p-4" aria-label="Busca de freezers">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="freezer-search" className="mb-2 block text-sm font-medium text-body">Buscar freezer</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" />
              <input id="freezer-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque pelo nome ou número do freezer" className="min-h-11 w-full rounded-xl border border-border bg-surface py-2.5 pr-3 pl-10 text-base text-heading outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-primary/10" />
            </div>
          </div>
          <button type="button" disabled={isRefreshing} onClick={refresh} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"><Icon name="refresh" className={`size-4 ${isRefreshing ? "motion-safe:animate-spin" : ""}`} />{isRefreshing ? "Atualizando..." : "Atualizar"}</button>
        </div>
      </section>

      {readingsQuery.isError && freezerQuery.data.length > 0 && <p role="alert" className="shrink-0 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-body">Não foi possível atualizar as temperaturas. <button type="button" disabled={readingsQuery.isFetching} onClick={() => void readingsQuery.refetch()} className="cursor-pointer font-semibold text-primary underline underline-offset-2 disabled:opacity-60">Tentar novamente</button></p>}
      {freezerQuery.isError && freezerQuery.data.length > 0 && <p role="alert" className="shrink-0 text-sm text-danger">Não foi possível atualizar os freezers. Os últimos dados carregados continuam disponíveis.</p>}

      <div className="min-h-0 flex-1 overflow-y-auto pb-2 md:pr-2" aria-busy={freezerQuery.isPending}>
        {freezerQuery.isPending ? <div role="status">
          <p className="sr-only">Carregando freezers...</p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 rounded-2xl border border-border bg-surface p-5 motion-safe:animate-pulse"><div className="size-11 rounded-xl bg-page" /><div className="mt-5 h-5 w-2/3 rounded bg-page" /><div className="mt-3 h-4 w-1/3 rounded bg-page" /><div className="mt-8 h-9 w-1/2 rounded bg-page" /></div>)}</div>
        </div> : freezerQuery.isError && freezerQuery.data.length === 0 ? <FreezerFeedback title="Não foi possível carregar os freezers" message="Verifique sua conexão e tente novamente." isError isBusy={freezerQuery.isFetching} actionLabel="Tentar novamente" onAction={() => void freezerQuery.refetch()} /> : freezerQuery.data.length === 0 ? <FreezerFeedback title="Seu primeiro freezer começa aqui" message="Cadastre um equipamento para organizar e acompanhar suas leituras de temperatura." actionLabel="Adicionar freezer" onAction={() => setFormOpen(true)} /> : filtered.length === 0 ? <FreezerFeedback title="Nenhum freezer encontrado" message="Tente buscar por outro nome ou número do equipamento." actionLabel="Limpar busca" onAction={() => setSearch("")} /> : <>
          <p role="status" className="mb-4 text-sm text-muted">{filtered.length} {filtered.length === 1 ? "freezer" : "freezers"}{term ? ` de ${freezerQuery.data.length}` : filtered.length === 1 ? " cadastrado" : " cadastrados"}</p>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label="Freezers cadastrados">
            {filtered.map((freezer) => {
              const readingQuery = readingsQuery.byFreezer.get(freezer.id);
              return <li key={freezer.id}><FreezerCard freezer={freezer} reading={readingQuery?.data ?? undefined} isLoadingReadings={readingQuery?.isPending ?? false} hasReadingError={readingQuery?.isError ?? false} /></li>;
            })}
          </ul>
        </>}
      </div>

      {formOpen && <FreezerFormModal onSave={handleSave} onClose={() => { if (!createMutation.isPending) setFormOpen(false); }} isSaving={createMutation.isPending} />}
    </div>
  );
}
