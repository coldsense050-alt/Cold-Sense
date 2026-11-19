import { useState } from "react";
import Icon from "../../../components/ui/Icon";
import type { Prestador } from "../types";

interface PrestadoresTableProps {
  prestadores: Prestador[];
  isLoading: boolean;
  error: string | null;
  hasFilters: boolean;
  onRetry: () => void;
  onEdit: (prestador: Prestador) => void;
  onDelete: (prestador: Prestador) => void;
}

const PAGE_SIZE = 10;

export default function PrestadoresTable({ prestadores, isLoading, error, hasFilters, onRetry, onEdit, onDelete }: PrestadoresTableProps) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(prestadores.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const visiblePrestadores = prestadores.slice(start, start + PAGE_SIZE);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" aria-labelledby="prestadores-table-title">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-4">
        <h3 id="prestadores-table-title" className="font-semibold text-heading">Prestadores cadastrados</h3>
        {!isLoading && !error && <p className="text-sm text-muted" role="status">{prestadores.length} {prestadores.length === 1 ? "prestador encontrado" : "prestadores encontrados"}</p>}
      </div>

      {isLoading ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-muted" role="status">
          <span className="size-8 rounded-full border-3 border-primary/15 border-t-primary motion-safe:animate-spin" aria-hidden="true" />
          Carregando prestadores...
        </div>
      ) : error ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center p-8 text-center" role="alert">
          <p className="font-semibold text-heading">Não foi possível carregar a lista</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{error}</p>
          <button type="button" onClick={onRetry} className="mt-5 min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tentar novamente</button>
        </div>
      ) : prestadores.length === 0 ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center p-8 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon name={hasFilters ? "search" : "users"} className="size-7" /></span>
          <p className="font-semibold text-heading">{hasFilters ? "Nenhum prestador encontrado" : "Nenhum prestador cadastrado"}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{hasFilters ? "Tente outro nome ou altere o filtro de freezer." : "Adicione o primeiro prestador para organizar os atendimentos dos seus freezers."}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto md:min-h-0 md:flex-1 md:overflow-auto">
            <table className="w-full min-w-192 border-collapse text-left text-sm">
              <caption className="sr-only">Prestadores de manutenção, contatos, freezers atendidos, status e ações.</caption>
              <thead className="sticky top-0 z-10 bg-primary-soft text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-medium">Prestador</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Contato</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Freezers atendidos</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {visiblePrestadores.map((prestador) => (
                  <tr key={prestador.id} className="transition-colors hover:bg-page/40">
                    <th scope="row" className="min-w-52 max-w-60 px-5 py-5 align-top font-semibold text-heading">
                      <span className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary" aria-hidden="true">{prestador.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("pt-BR")}</span>
                        <span className="pt-1.5 wrap-anywhere">{prestador.nome}</span>
                      </span>
                    </th>
                    <td className="min-w-48 max-w-56 px-4 py-5 align-top">
                      {prestador.email && <p className="wrap-anywhere text-body">{prestador.email}</p>}
                      {prestador.telefone && <p className={`${prestador.email ? "mt-1.5 " : ""}text-muted`}>{prestador.telefone}</p>}
                      {!prestador.email && !prestador.telefone && <span className="text-muted">Não informado</span>}
                    </td>
                    <td className="min-w-48 max-w-64 px-4 py-5 align-top">
                      {prestador.freezers.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5" aria-label={`Freezers de ${prestador.nome}`}>
                          {prestador.freezers.map((freezer) => <li key={freezer.id} className="rounded-md border border-border-soft bg-page/60 px-2 py-1 text-sm text-body">{freezer.nome}</li>)}
                        </ul>
                      ) : <span className="text-muted">Sem vínculo</span>}
                    </td>
                    <td className="px-4 py-5 align-top"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${prestador.ativo ? "bg-success/20 text-heading" : "bg-page text-muted"}`}>{prestador.ativo ? "Ativo" : "Inativo"}</span></td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => onEdit(prestador)} aria-label={`Editar ${prestador.nome}`} className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"><Icon name="edit" className="size-4" />Editar</button>
                        <button type="button" onClick={() => onDelete(prestador)} aria-label={`Excluir ${prestador.nome}`} className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-danger"><Icon name="trash" className="size-4" />Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-soft px-5 py-3">
            <p className="text-sm text-muted">{start + 1}–{Math.min(start + PAGE_SIZE, prestadores.length)} de {prestadores.length} prestadores</p>
            <div className="flex items-center gap-3">
              <button type="button" disabled={page === 1} onClick={() => setRequestedPage(page - 1)} className="min-h-10 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <span className="text-sm text-muted" aria-label={`Página ${page} de ${pageCount}`}>{page} / {pageCount}</span>
              <button type="button" disabled={page === pageCount} onClick={() => setRequestedPage(page + 1)} className="min-h-10 cursor-pointer rounded-lg border border-border px-3 text-sm font-medium text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40">Próxima</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
