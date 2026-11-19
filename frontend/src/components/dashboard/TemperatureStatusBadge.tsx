import type { TemperatureAssessment } from "../../types/temperature";
import Icon from "../ui/Icon";

const statusClasses = {
  normal: "border-success/40 bg-success/15 text-success-text",
  atencao: "border-warning/30 bg-warning/10 text-warning-text",
  critico: "border-danger-border bg-danger-soft text-danger",
  indeterminado: "border-border bg-page text-muted",
};

const statusIcons = {
  normal: "checkCircle",
  atencao: "alertTriangle",
  critico: "alertOctagon",
  indeterminado: "helpCircle",
} as const;

type TemperatureStatusBadgeProps = {
  assessment: TemperatureAssessment;
  freezerName?: string;
};

export default function TemperatureStatusBadge({ assessment, freezerName }: TemperatureStatusBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[assessment.status]}`}
      title={`${freezerName ? `${freezerName}: ` : ""}${assessment.label}. ${assessment.description}`}
      aria-label={`${freezerName ? `${freezerName}: ` : ""}${assessment.label}: ${assessment.description}`}
    >
      <Icon name={statusIcons[assessment.status]} className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{freezerName ?? assessment.label}</span>
    </span>
  );
}
