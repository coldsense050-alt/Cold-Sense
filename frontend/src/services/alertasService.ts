import type { Alerta, EstadoAlertas } from "../types/freezerAi";
import { FREEZER_AI_URL } from "./freezerAiService";

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${FREEZER_AI_URL}${caminho}`, init);
  if (!resposta.ok) {
    let detalhe = `Erro ${resposta.status}`;
    try {
      const corpo = await resposta.json();
      if (typeof corpo?.detail === "string") detalhe = corpo.detail;
    } catch {
      /* sem JSON */
    }
    throw new Error(detalhe);
  }
  return (await resposta.json()) as T;
}

/** Alertas ativos, histórico e situação do vigia da Freezer AI. */
export function getAlertas(): Promise<EstadoAlertas> {
  return pedir<EstadoAlertas>("/alertas");
}

export function marcarCiente(id: string, por: string | null | undefined): Promise<Alerta> {
  return pedir<Alerta>(`/alertas/${encodeURIComponent(id)}/ciente`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ por: por ?? null }),
  });
}

export function verificarAgora(): Promise<EstadoAlertas> {
  return pedir<EstadoAlertas>("/alertas/verificar", { method: "POST" });
}

export function testarEmail(): Promise<{ ok: boolean; para: string[] }> {
  return pedir("/alertas/teste-email", { method: "POST" });
}

/** Envia um relatório já gerado para prestadores cadastrados (a API só aceita e-mails cadastrados). */
export function enviarRelatorioPorEmail(dados: {
  relatorio: unknown;
  para: string[];
  mensagem?: string;
  enviado_por?: string | null;
}): Promise<{ ok: boolean; para: string[]; assunto: string }> {
  return pedir("/relatorio/enviar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}
