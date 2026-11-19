import { useMemo, useState } from "react";
import PrestadoresTable from "./components/PrestadoresTable";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import { useFreezer } from "../../hooks/useFreezer";
import type { Prestador, PrestadorInput } from "./types";
import PrestadorFormModal from "./components/PrestadorFormModal";
import { usePrestadores } from "./hooks/usePrestadores";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export default function Prestadores() {
  const { data: prestadores, isPending, isError, error, refetch, saveMutation, deleteMutation } = usePrestadores();
  const freezerQuery = useFreezer();
  const [search, setSearch] = useState("");
  const [freezerId, setFreezerId] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Prestador | null>(null);
  const [deleting, setDeleting] = useState<Prestador | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasFilters = !!search.trim() || freezerId !== "all";

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return prestadores.filter((prestador) => {
      const matchesText = normalize([prestador.nome, prestador.email, prestador.telefone].filter(Boolean).join(" ")).includes(term);
      const matchesFreezer = freezerId === "all" || prestador.freezers.some((freezer) => freezer.id === Number(freezerId));
      return matchesText && matchesFreezer;
    });
  }, [prestadores, search, freezerId]);

  async function handleSave(values: PrestadorInput) {
    setNotice(null);
    await saveMutation.mutateAsync({ id: editing?.id ?? null, values });
    setNotice(editing ? "Prestador atualizado com sucesso." : "Prestador cadastrado com sucesso.");
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting || deleteMutation.isPending) return;
    setNotice(null);
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleting.id);
      setDeleting(null);
      setNotice("Prestador excluído com sucesso.");
    } catch (deletionError) {
      setDeleteError(deletionError instanceof Error ? deletionError.message : "Não foi possível excluir o prestador.");
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-6 md:h-full md:min-h-0">
      <header className="flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-widest text-muted uppercase">Manutenção</p>
          <h2 className="text-2xl font-bold tracking-tight text-heading">Prestadores de manutenção</h2>
          <p className="mt-2 text-sm text-muted">Gerencie os contatos e os freezers atendidos por cada prestador.</p>
        </div>
        <button type="button" className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/10 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Icon name="plus" className="size-4.5" />Adicionar prestador
        </button>
      </header>

      {notice && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/15 px-4 py-2.5">
          <p role="status" className="text-sm font-medium text-heading">{notice}</p>
          <button type="button" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-heading hover:bg-success/20 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setNotice(null)} aria-label="Fechar aviso"><Icon name="close" className="size-4" /></button>
        </div>
      )}

      <section className="shrink-0 rounded-2xl border border-border bg-surface p-4" aria-label="Filtros de prestadores">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="prestador-search" className="mb-2 block text-sm font-medium text-body">Buscar prestador</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted" />
              <input id="prestador-search" type="search" placeholder="Nome, e-mail ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface py-2.5 pr-3 pl-10 text-base text-heading outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-primary/10" />
            </div>
          </div>
          <div className="lg:w-64">
            <label htmlFor="prestador-filter-freezer" className="mb-2 block text-sm font-medium text-body">Filtrar por freezer</label>
            <div className="relative">
              <select id="prestador-filter-freezer" value={freezerId} onChange={(event) => setFreezerId(event.target.value)} disabled={freezerQuery.isPending || freezerQuery.isError} className="min-h-11 w-full appearance-none rounded-xl border border-border bg-surface py-2.5 pr-10 pl-3 text-base text-heading outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:opacity-60">
                <option value="all">{freezerQuery.isPending ? "Carregando freezers..." : "Todos os freezers"}</option>
                {freezerQuery.data.map((freezer) => <option key={freezer.id} value={freezer.id}>{freezer.nome}</option>)}
              </select>
              <Icon name="chevron" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
            </div>
          </div>
          {hasFilters && <button type="button" onClick={() => { setSearch(""); setFreezerId("all"); }} className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary">Limpar filtros</button>}
        </div>
        {freezerQuery.isError && <p className="mt-3 text-sm text-danger" role="alert">O filtro de freezers está indisponível. <button type="button" className="cursor-pointer font-semibold underline" onClick={() => void freezerQuery.refetch()}>Tentar novamente</button></p>}
      </section>

      <PrestadoresTable
        key={`${search}:${freezerId}`}
        prestadores={filtered}
        isLoading={isPending}
        error={isError ? error?.message ?? "Tente novamente em instantes." : null}
        hasFilters={hasFilters}
        onRetry={() => void refetch()}
        onEdit={(prestador) => { setEditing(prestador); setFormOpen(true); }}
        onDelete={(prestador) => { setDeleting(prestador); setDeleteError(null); }}
      />

      {formOpen && (
        <PrestadorFormModal
          key={editing?.id ?? "new"}
          prestador={editing}
          freezers={freezerQuery.data}
          isLoadingFreezers={freezerQuery.isPending}
          freezerError={freezerQuery.isError ? freezerQuery.error?.message ?? "Freezers indisponíveis" : null}
          onRetryFreezers={() => void freezerQuery.refetch()}
          onSave={handleSave}
          onClose={() => { if (!saveMutation.isPending) setFormOpen(false); }}
          isSaving={saveMutation.isPending}
        />
      )}

      {deleting && (
        <Modal title="Excluir prestador" description={`Deseja excluir ${deleting.nome}? O cadastro e seus vínculos com os freezers serão removidos.`} role="alertdialog" isBusy={deleteMutation.isPending} onClose={() => { if (!deleteMutation.isPending) setDeleting(null); }}>
          {deleteError && <p className="mb-5 rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger" role="alert">{deleteError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={deleteMutation.isPending} onClick={() => setDeleting(null)} className="min-h-11 cursor-pointer rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">Cancelar</button>
            <button type="button" disabled={deleteMutation.isPending} onClick={() => void handleDelete()} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-danger px-5 py-2.5 text-sm font-semibold text-white hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-60">
              <Icon name="trash" className="size-4" />{deleteMutation.isPending ? "Excluindo..." : "Excluir prestador"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
