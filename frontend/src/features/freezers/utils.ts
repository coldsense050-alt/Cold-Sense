import type { Temperature } from "../../types/temperature";

export function getConnectionStatus(reading?: Temperature) {
  const timestamp = reading ? new Date(reading.coletado_em).getTime() : NaN;
  const minutes = (Date.now() - timestamp) / 60_000;

  if (!Number.isFinite(timestamp)) return { label: "Sem leituras", className: "border-border bg-page text-muted" };
  if (minutes <= 10) return { label: "Ativo", className: "border-success/40 bg-success/15 text-heading" };
  if (minutes <= 15) return { label: "Instável", className: "border-warning/25 bg-warning/10 text-warning" };
  return { label: "Offline", className: "border-danger-border bg-danger-soft text-danger" };
}

export function formatReadingDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data indisponível";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
