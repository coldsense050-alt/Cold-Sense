export type TemperaturePeriod = "24h" | "7d" | "30d" | "all";

export type TemperatureAssessment = {
  status: "normal" | "atencao" | "critico" | "indeterminado";
  label: string;
  description: string;
};

export type Temperature = {
  id: number;
  temperatura: number;
  coletado_em: string;
  freezer_id: number | null;
};
