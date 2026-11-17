import type { RelatorioFreezerAI } from "../types/freezerAi";

/** Endereço da API Python da Freezer AI (pasta ai/). Configure em .env.local */
export const FREEZER_AI_URL: string =
  (import.meta.env.VITE_FREEZER_AI_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

export interface ParametrosRelatorio {
  inicio: Date;
  fim: Date;
  perfil: "freezer" | "refrigerador";
  resolucao: "auto" | "minuto" | "hora";
  /** Freezer analisado (tabela freezers). null = todas as leituras */
  freezerId?: number | null;
  /** Sobrescrevem os limites do perfil (opcional) */
  alerta?: number;
  critico?: number;
  /** Usado apenas quando a API está em modo simulação */
  cenario?: string;
}

export class ErroFreezerAI extends Error {}

export async function gerarRelatorio(
  p: ParametrosRelatorio,
  signal?: AbortSignal,
): Promise<RelatorioFreezerAI> {
  const params = new URLSearchParams({
    inicio: p.inicio.toISOString(),
    fim: p.fim.toISOString(),
    perfil: p.perfil,
    resolucao: p.resolucao,
  });
  if (p.cenario) params.set("cenario", p.cenario);
  if (p.freezerId != null) params.set("freezer_id", String(p.freezerId));
  if (p.alerta !== undefined) params.set("alerta", String(p.alerta));
  if (p.critico !== undefined) params.set("critico", String(p.critico));

  let resposta: Response;
  try {
    resposta = await fetch(`${FREEZER_AI_URL}/relatorio?${params}`, { signal });
  } catch (erro) {
    if ((erro as Error).name === "AbortError") throw erro;
    throw new ErroFreezerAI(
      `Não foi possível conectar à Freezer AI (${FREEZER_AI_URL}). Verifique se a API está rodando.`,
    );
  }
  if (!resposta.ok) {
    let detalhe = `Erro ${resposta.status}`;
    try {
      const corpo = await resposta.json();
      if (typeof corpo?.detail === "string") detalhe = corpo.detail;
    } catch {
      /* resposta sem JSON */
    }
    throw new ErroFreezerAI(detalhe);
  }
  return (await resposta.json()) as RelatorioFreezerAI;
}

export async function consultarSaude(): Promise<{ ok: boolean; fonte: string } | null> {
  try {
    const r = await fetch(`${FREEZER_AI_URL}/saude`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
