import { useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import Modal from "../../components/ui/Modal";
import { usePrestadores } from "../../features/prestadores/hooks/usePrestadores";
import { useAuth } from "../../hooks/useAuth";
import { enviarRelatorioPorEmail } from "../../services/alertasService";
import type { RelatorioFreezerAI } from "../../types/freezerAi";

interface Props {
  relatorio: RelatorioFreezerAI;
  /** Freezer analisado: os prestadores ligados a ele já vêm marcados */
  freezerId: number | null;
  onClose: () => void;
}

/** Escolha de prestadores cadastrados para receber o relatório por e-mail. */
export default function EnviarRelatorioModal({ relatorio, freezerId, onClose }: Props) {
  const { data: prestadores, isPending, isError } = usePrestadores();
  const { session } = useAuth();
  const disponiveis = prestadores.filter((p) => p.ativo && p.email);
  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Padrão: prestadores ligados ao freezer analisado
  const selecionados =
    marcados ??
    new Set(
      disponiveis
        .filter((p) => freezerId !== null && p.freezers.some((f) => f.id === freezerId))
        .map((p) => p.email!.toLowerCase()),
    );

  function alternar(email: string) {
    const novo = new Set(selecionados);
    if (novo.has(email)) novo.delete(email);
    else novo.add(email);
    setMarcados(novo);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (selecionados.size === 0) {
      setErro("Escolha pelo menos um destinatário.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarRelatorioPorEmail({
        relatorio,
        para: [...selecionados],
        mensagem: mensagem.trim() || undefined,
        enviado_por: session?.user.email ?? null,
      });
      setSucesso(`Relatório enviado para ${r.para.join(", ")}.`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  // Portal: renderiza fora de .fa-pagina para não herdar os estilos da página
  return createPortal(
    <Modal
      title="Enviar relatório por e-mail"
      description="Escolha os prestadores de manutenção que vão receber este relatório. Os ligados ao freezer analisado já vêm marcados."
      onClose={onClose}
      isBusy={enviando}
    >
      {sucesso ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-primary-soft p-4 text-sm text-body" role="status">✉ {sucesso}</p>
          <button type="button" onClick={onClose} className="min-h-11 w-full cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">
            Fechar
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="space-y-5">
          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-body">Destinatários</legend>
            {isPending ? (
              <p className="text-sm text-muted">Carregando prestadores…</p>
            ) : isError ? (
              <p className="text-sm text-danger">Não foi possível carregar os prestadores.</p>
            ) : disponiveis.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhum prestador ativo com e-mail. Cadastre na página <b>Prestadores</b>.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {disponiveis.map((p) => {
                  const email = p.email!.toLowerCase();
                  const doFreezer = freezerId !== null && p.freezers.some((f) => f.id === freezerId);
                  return (
                    <li key={p.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:border-border-hover">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-primary"
                          checked={selecionados.has(email)}
                          onChange={() => alternar(email)}
                          disabled={enviando}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-heading">
                            {p.nome}
                            {doFreezer && (
                              <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                                atende este freezer
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted">{p.email}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-body">Mensagem (opcional)</span>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ex.: Favor verificar o freezer ainda hoje."
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-heading outline-none placeholder:text-placeholder focus:border-primary focus:ring-3 focus:ring-primary/10"
              disabled={enviando}
            />
          </label>

          {erro && (
            <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger" role="alert">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={enviando} className="min-h-11 cursor-pointer rounded-xl border border-border px-4 text-sm font-semibold text-body hover:border-border-hover disabled:opacity-60">
              Cancelar
            </button>
            <button type="submit" disabled={enviando || selecionados.size === 0} className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
              {enviando ? "Enviando…" : `Enviar para ${selecionados.size}`}
            </button>
          </div>
        </form>
      )}
    </Modal>,
    document.body,
  );
}
