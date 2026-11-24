import { useState } from "react";
import type { FormEvent } from "react";
import Modal from "../../../components/ui/Modal";
import type { FreezerInput } from "../../../types/freezer";

interface FreezerFormModalProps {
  onSave: (values: FreezerInput) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

export default function FreezerFormModal({ onSave, onClose, isSaving }: FreezerFormModalProps) {
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!nome.trim()) {
      setError("Informe o nome do freezer.");
      return;
    }

    try {
      await onSave({ nome: nome.trim() });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível cadastrar o freezer. Tente novamente.");
    }
  }

  return (
    <Modal title="Adicionar freezer" description="Dê um nome ao equipamento para identificá-lo no monitoramento." onClose={onClose} isBusy={isSaving}>
      <form onSubmit={handleSubmit} aria-busy={isSaving}>
        <label htmlFor="freezer-nome" className="mb-2 block text-sm font-semibold text-body">Nome do freezer <span className="text-muted">*</span></label>
        <input id="freezer-nome" name="nome" value={nome} onChange={(event) => { setNome(event.target.value); setError(null); }} placeholder="Ex.: Freezer de sorvetes" required disabled={isSaving} aria-invalid={!!error} aria-describedby={error ? "freezer-nome-help freezer-form-error" : "freezer-nome-help"} className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-heading outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:cursor-wait disabled:opacity-60" />
        <p id="freezer-nome-help" className="mt-2 text-sm text-muted">Use um nome que facilite reconhecer o freezer, como sua localização ou finalidade.</p>
        {error && <p id="freezer-form-error" role="alert" className="mt-5 rounded-xl border border-danger-border bg-danger-soft p-3 text-sm leading-relaxed text-danger">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border-soft pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving} className="min-h-11 cursor-pointer rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-body hover:bg-page focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={isSaving} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60">
            {isSaving && <span className="size-4 rounded-full border-2 border-white/30 border-t-white motion-safe:animate-spin" aria-hidden="true" />}
            {isSaving ? "Cadastrando..." : "Cadastrar freezer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
