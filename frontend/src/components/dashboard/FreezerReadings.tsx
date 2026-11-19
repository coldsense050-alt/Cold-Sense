import type { Freezer } from "../../types/freezer";
import type { Temperature } from "../../types/temperature";
import { formatNumber } from "../../utils/formatNumber";
import { assessTemperature } from "../../utils/temperatureStatus";
import EmptyState from "./EmptyState";
import TemperatureStatusBadge from "./TemperatureStatusBadge";

type FreezerReadingsProps = {
  freezers: Freezer[];
  temperatures: Temperature[];
  isPending: boolean;
  isError: boolean;
};

export default function FreezerReadings({ freezers, temperatures, isPending, isError }: FreezerReadingsProps) {
  if (isPending) return <EmptyState message="Carregando freezers..." />;
  if (isError) return <EmptyState message="Não foi possível carregar os freezers. Tente atualizar os dados." />;
  if (freezers.length === 0) return <EmptyState message="Nenhum freezer disponível." />;

  const latestByFreezer = new Map<number, Temperature>();
  for (const reading of temperatures) {
    if (reading.freezer_id !== null && !latestByFreezer.has(reading.freezer_id)) {
      latestByFreezer.set(reading.freezer_id, reading);
    }
  }

  return (
    <ul className="divide-y divide-border-soft">
      {freezers.map((freezer) => {
        const reading = latestByFreezer.get(freezer.id);

        return (
          <li key={freezer.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-heading">{freezer.nome}</p>
              <p className="mt-1 text-xs text-muted">
                {reading
                  ? `Última leitura no período: ${new Date(reading.coletado_em).toLocaleString("pt-BR")}`
                  : "Sem leituras no período selecionado"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {reading && <span className="text-sm font-bold text-primary">{formatNumber(reading.temperatura)} °C</span>}
              <TemperatureStatusBadge assessment={assessTemperature(reading?.temperatura, freezer)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
