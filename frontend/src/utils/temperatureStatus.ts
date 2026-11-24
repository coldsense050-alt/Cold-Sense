import type { Freezer } from "../types/freezer";
import type { TemperatureAssessment } from "../types/temperature";
import { formatNumber } from "./formatNumber.ts";

const WARNING_MARGIN_RATIO = 0.1;

export function assessTemperature(
  temperature: number | null | undefined,
  freezer: Freezer | null | undefined,
): TemperatureAssessment {
  if (temperature === null || temperature === undefined || !Number.isFinite(temperature)) {
    return { status: "indeterminado", label: "Sem dados", description: "Nenhuma temperatura válida disponível para classificação." };
  }

  if (!freezer) {
    return { status: "indeterminado", label: "Sem vínculo", description: "Não foi possível identificar o freezer desta leitura para consultar seus limites." };
  }

  const minimum = freezer.temperatura_min;
  const maximum = freezer.temperatura_max;

  if (minimum === null || minimum === undefined || maximum === null || maximum === undefined) {
    return { status: "indeterminado", label: "Sem limites", description: "Cadastre a temperatura mínima e máxima deste freezer para classificar a leitura." };
  }

  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
    return { status: "indeterminado", label: "Limites inválidos", description: "A temperatura mínima deve ser menor que a máxima, e os dois limites devem ser valores válidos." };
  }

  const reference = `Faixa permitida: ${formatNumber(minimum)} °C a ${formatNumber(maximum)} °C.`;
  const belowMinimum = temperature < minimum;
  const aboveMaximum = temperature > maximum;

  if (belowMinimum || aboveMaximum) {
    return {
      status: "critico",
      label: "Crítico",
      description: `Temperatura ${belowMinimum ? "abaixo da mínima" : "acima da máxima"} permitida. ${reference}`,
    };
  }

  const margin = (maximum - minimum) * WARNING_MARGIN_RATIO;

  const nearMinimum = temperature <= minimum + margin;
  const nearMaximum = temperature >= maximum - margin;

  if (nearMinimum || nearMaximum) {
    return {
      status: "atencao",
      label: "Atenção",
      description: `Temperatura nos 10% próximos ${nearMinimum ? "à mínima" : "à máxima"}. ${reference}`,
    };
  }

  return { status: "normal", label: "Normal", description: `Temperatura dentro da faixa, afastada dos limites. ${reference}` };
}
