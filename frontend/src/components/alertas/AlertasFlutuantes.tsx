import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAlertas, useMarcarCiente } from "../../hooks/useAlertas";
import { useAuth } from "../../hooks/useAuth";
import type { Alerta } from "../../types/freezerAi";

const fmtTemp = (v: number | null) =>
  v === null ? "sem leitura" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;
const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Bipe curto pelo navegador (o navegador pode bloquear até o primeiro clique na página). */
function tocarBipe(critico: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = critico ? 880 : 660;
    ganho.gain.value = 0.05;
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (critico ? 0.6 : 0.3));
    osc.onended = () => void ctx.close();
  } catch {
    /* sem áudio disponível */
  }
}

function notificarNavegador(alerta: Alerta) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const nivel = alerta.nivel === "critico" ? "CRÍTICO" : "Atenção";
    new Notification(`${nivel} – ${alerta.freezer.nome ?? "Freezer"}`, {
      body: `${alerta.titulo} · ${fmtTemp(alerta.temperatura)}`,
      tag: alerta.id,
    });
  } catch {
    /* navegador sem suporte */
  }
}

/**
 * Alertas da Freezer AI que aparecem em qualquer página, no canto da tela.
 * Somem quando alguém marca "Ciente" (continuam listados na página Freezer AI).
 */
export default function AlertasFlutuantes() {
  const { pendentes } = useAlertas();
  const { session } = useAuth();
  const marcar = useMarcarCiente();
  const [minimizados, setMinimizados] = useState<Set<string>>(new Set());
  const [permissao, setPermissao] = useState<string>(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const vistos = useRef<Map<string, string>>(new Map());

  // Novo alerta (ou alerta que piorou): som + notificação do navegador
  useEffect(() => {
    for (const alerta of pendentes) {
      const anterior = vistos.current.get(alerta.id);
      if (anterior !== alerta.nivel) {
        if (anterior === undefined || alerta.nivel === "critico") {
          tocarBipe(alerta.nivel === "critico");
          notificarNavegador(alerta);
        }
        vistos.current.set(alerta.id, alerta.nivel);
      }
    }
  }, [pendentes]);

  const visiveis = pendentes.filter((a) => !minimizados.has(`${a.id}:${a.nivel}`));
  if (visiveis.length === 0) return null;

  async function pedirPermissao() {
    if (typeof Notification === "undefined") return;
    setPermissao(await Notification.requestPermission());
  }

  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 print:hidden"
      role="region"
      aria-label="Alertas da Freezer AI"
      aria-live="assertive"
    >
      {visiveis.slice(0, 3).map((alerta) => {
        const critico = alerta.nivel === "critico";
        return (
          <article
            key={alerta.id}
            className={`overflow-hidden rounded-xl border bg-surface shadow-xl ${
              critico ? "border-red-300" : "border-amber-300"
            }`}
          >
            <header
              className={`flex items-center justify-between gap-2 px-4 py-2 text-white ${
                critico ? "bg-red-600" : "bg-amber-600"
              }`}
            >
              <span className="text-xs font-bold tracking-wider uppercase">
                {critico ? "Crítico" : "Atenção"} · desde {fmtHora(alerta.inicio)}
              </span>
              <button
                type="button"
                className="cursor-pointer rounded px-1 text-lg leading-none text-white/80 hover:text-white"
                aria-label="Minimizar alerta"
                title="Minimizar (volta a aparecer se piorar)"
                onClick={() => setMinimizados((m) => new Set(m).add(`${alerta.id}:${alerta.nivel}`))}
              >
                ×
              </button>
            </header>
            <div className="space-y-2 px-4 py-3">
              <p className="text-sm font-semibold text-heading">
                {alerta.freezer.nome ?? "Freezer"}
                {alerta.freezer.localizacao && (
                  <span className="font-normal text-muted"> · {alerta.freezer.localizacao}</span>
                )}
              </p>
              <p className={`text-2xl font-bold ${critico ? "text-red-600" : "text-amber-600"}`}>
                {fmtTemp(alerta.temperatura)}
                <span className="ml-2 text-xs font-medium text-muted">
                  faixa {alerta.faixa[0].toLocaleString("pt-BR")} a {alerta.faixa[1].toLocaleString("pt-BR")} °C
                </span>
              </p>
              <p className="text-sm text-body">{alerta.achados[0]?.mensagem ?? alerta.titulo}</p>
              {alerta.emails.some((e) => e.ok && e.tipo === "alerta") && (
                <p className="text-xs text-muted">✉ Manutenção avisada por e-mail.</p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={marcar.isPending}
                  onClick={() => marcar.mutate({ id: alerta.id, por: session?.user.email })}
                  className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  Ciente
                </button>
                <Link
                  to={alerta.freezer.id != null ? `/freezer-ai?freezer=${alerta.freezer.id}` : "/freezer-ai"}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-body hover:border-border-hover"
                >
                  Ver análise
                </Link>
                {permissao === "default" && (
                  <button
                    type="button"
                    onClick={() => void pedirPermissao()}
                    className="cursor-pointer text-xs font-medium text-primary underline"
                  >
                    Ativar avisos do navegador
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
      {visiveis.length > 3 && (
        <Link to="/freezer-ai" className="self-end rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white">
          + {visiveis.length - 3} alertas
        </Link>
      )}
    </div>
  );
}
