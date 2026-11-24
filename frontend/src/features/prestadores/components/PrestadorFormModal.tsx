import { useState } from "react";
import type { FormEvent } from "react";
import type { Freezer } from "../../../types/freezer";
import type { Prestador, PrestadorInput } from "../types";
import Icon from "../../../components/ui/Icon";
import Modal from "../../../components/ui/Modal";

interface PrestadorFormModalProps {
  prestador: Prestador | null;
  freezers: Freezer[];
  isLoadingFreezers: boolean;
  freezerError: string | null;
  onRetryFreezers: () => void;
  onSave: (values: PrestadorInput) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

const inputClasses = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:cursor-wait disabled:opacity-60";
const labelClasses = "mb-2 block text-xs font-semibold text-body";

export default function PrestadorFormModal({ prestador, freezers, isLoadingFreezers, freezerError, onRetryFreezers, onSave, onClose, isSaving }: PrestadorFormModalProps) {
  const [nome, setNome] = useState(prestador?.nome ?? "");
  const [email, setEmail] = useState(prestador?.email ?? "");
  const [telefone, setTelefone] = useState(prestador?.telefone ?? "");
  const [ativo, setAtivo] = useState(prestador?.ativo ?? true);
  const [selectedFreezers, setSelectedFreezers] = useState<Freezer[]>(prestador?.freezers ?? []);
  const [error, setError] = useState<string | null>(null);
  const availableFreezers = freezers.filter((freezer) => !selectedFreezers.some((selected) => selected.id === freezer.id));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!nome.trim()) {
      setError("Informe o nome do prestador.");
      return;
    }

    try {
      await onSave({ nome: nome.trim(), email, telefone, ativo, freezerIds: selectedFreezers.map((freezer) => freezer.id) });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o prestador. Tente novamente.");
    }
  }

  return (
    <Modal title={prestador ? "Editar prestador" : "Adicionar prestador"} description="Cadastre os dados de contato e selecione os freezers atendidos." isBusy={isSaving} onClose={onClose}>
      <form onSubmit={handleSubmit} aria-busy={isSaving}>
        <fieldset disabled={isSaving} className="space-y-5">
          <div>
            <label htmlFor="prestador-nome" className={labelClasses}>Nome do prestador <span className="text-muted">*</span></label>
            <input id="prestador-nome" name="nome" className={inputClasses} autoComplete="organization" placeholder="Ex.: Refrigeração Silva" value={nome} onChange={(event) => { setNome(event.target.value); setError(null); }} required />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="prestador-email" className={labelClasses}>E-mail</label>
              <input id="prestador-email" name="email" type="email" className={inputClasses} autoComplete="email" placeholder="contato@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label htmlFor="prestador-telefone" className={labelClasses}>Telefone</label>
              <input id="prestador-telefone" name="telefone" type="tel" className={inputClasses} autoComplete="tel" placeholder="(85) 99999-9999" value={telefone} onChange={(event) => setTelefone(event.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="prestador-freezers" className={labelClasses}>Freezers atendidos</label>
            <div className="relative">
              <select
                id="prestador-freezers"
                className={`${inputClasses} appearance-none pr-10`}
                value=""
                disabled={isSaving || isLoadingFreezers || !!freezerError || availableFreezers.length === 0}
                aria-describedby="prestador-freezers-help"
                onChange={(event) => {
                  const selected = freezers.find((freezer) => freezer.id === Number(event.target.value));
                  if (selected) setSelectedFreezers((current) => [...current, selected]);
                }}
              >
                <option value="">{isLoadingFreezers ? "Carregando freezers..." : freezerError ? "Freezers indisponíveis" : freezers.length === 0 ? "Nenhum freezer cadastrado" : availableFreezers.length === 0 ? "Todos os freezers selecionados" : "Selecione um freezer"}</option>
                {availableFreezers.map((freezer) => <option key={freezer.id} value={freezer.id}>{freezer.nome}</option>)}
              </select>
              <Icon name="chevron" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
            </div>
            <p id="prestador-freezers-help" className="mt-2 text-xs text-muted">Vínculo opcional. Você pode selecionar mais de um freezer.</p>
            {freezerError && (
              <p className="mt-2 text-sm text-danger" role="alert">
                Não foi possível carregar os freezers. <button type="button" className="cursor-pointer font-semibold underline underline-offset-2" onClick={onRetryFreezers}>Tentar novamente</button>
              </p>
            )}
            {selectedFreezers.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Freezers selecionados">
                {selectedFreezers.map((freezer) => (
                  <li key={freezer.id} className="flex max-w-full items-center gap-1 rounded-lg border border-primary/10 bg-primary-soft py-1 pr-1 pl-2.5 text-xs font-medium text-primary">
                    <Icon name="freezer" className="size-4 shrink-0" />
                    <span className="truncate" title={freezer.nome}>{freezer.nome}</span>
                    <button type="button" aria-label={`Desvincular ${freezer.nome}`} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait" onClick={() => setSelectedFreezers((current) => current.filter((selected) => selected.id !== freezer.id))}>
                      <Icon name="close" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-soft bg-page/40 p-3">
            <input type="checkbox" className="size-4.5 shrink-0 accent-primary" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
            <span><span className="block text-sm font-semibold text-body">Prestador ativo</span><span className="mt-0.5 block text-xs text-muted">Disponível para novos atendimentos.</span></span>
          </label>
        </fieldset>

        {error && <p className="mt-5 rounded-xl border border-danger-border bg-danger-soft p-3 text-sm leading-relaxed text-danger" role="alert">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border-soft pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving} className="min-h-11 cursor-pointer rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={isSaving} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">
            {isSaving && <span className="size-4 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" aria-hidden="true" />}
            {isSaving ? "Salvando..." : prestador ? "Salvar alterações" : "Cadastrar prestador"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
