/**
 * Contrato do relatório gerado pela Freezer AI (versao_formato "1.0").
 * Para usar no front-end do Cold-Sense quando formos integrar.
 */

export type StatusEquipamento = "normal" | "atencao" | "critico" | "indeterminado";
export type Severidade = "info" | "atencao" | "critico";
export type Nivel = "baixa" | "media" | "alta";

export type CodigoAchado =
  | "temperatura_critica"
  | "temperatura_alta"
  | "temperatura_baixa"
  | "excursao_prolongada"
  | "elevacoes_curtas"
  | "elevacoes_curtas_frequentes"
  | "picos_ciclicos_acima_limite"
  | "subida_continua"
  | "aumento_incomum"
  | "oscilacao_elevada"
  | "variacoes_bruscas"
  | "tendencia_aquecimento"
  | "perda_estabilidade"
  | "falha_sensor"
  | "picos_isolados"
  | "sem_dados_recentes"
  | "sem_dados"
  | "cobertura_baixa"
  | "dados_insuficientes"
  | "historico_insuficiente";

export interface Achado {
  codigo: CodigoAchado;
  severidade: Severidade;
  titulo: string;
  /** Frase pronta para exibir ao usuário */
  mensagem: string;
  confianca: Nivel;
  /** Números que sustentam a conclusão (variam por código) */
  evidencias: Record<string, unknown>;
}

export interface Recomendacao {
  prioridade: Nivel;
  texto: string;
  /** Código do achado que originou a recomendação */
  motivo: CodigoAchado;
}

export interface PontoSerie {
  instante: string; // ISO 8601 (UTC) – início do minuto/hora
  media: number | null;
  minima: number | null;
  maxima: number | null;
  leituras: number;
}

export type TipoAnomalia =
  | "acima_do_limite"
  | "sem_leituras"
  | "leitura_descartada"
  | "subida_continua"
  | "aumento_incomum"
  | "variacao_brusca";

export interface Anomalia {
  tipo: TipoAnomalia;
  severidade: Severidade;
  inicio: string;
  fim: string;
  descricao: string;
  valor: number | null;
}

export interface MetricasFreezerAI {
  atual?: { temperatura: number | null; coletado_em: string };
  cobertura?: {
    periodo_analisado_horas: number;
    leituras: number;
    intervalo_mediano_s: number | null;
    percentual_cobertura: number;
    lacunas: number;
    maior_lacuna_min: number;
    tempo_total_em_lacunas_min: number;
    minutos_desde_ultima_leitura: number;
  };
  periodo?: {
    media: number;
    minima: number;
    maxima: number;
    desvio_padrao: number;
    percentual_na_faixa_ideal: number;
    percentual_acima_alerta: number;
    percentual_acima_critico: number;
  };
  taxa_variacao?: Record<"15min" | "60min" | "180min", { taxa_c_por_hora: number; r2: number } | null>;
  excursoes?: {
    limite: number;
    quantidade: number;
    minutos_acima_alerta: number;
    eventos: {
      inicio: string;
      fim: string;
      duracao_min: number;
      pico: number;
      minutos_acima_critico: number;
      em_andamento: boolean;
    }[];
  };
  comparacao_padrao?: {
    referencia: "historico" | "periodo_anterior";
    media_ultimas_horas: number;
    horas_consideradas: number;
    padrao_do_equipamento: number;
    diferenca: number;
    z_robusto: number;
  } | null;
  oscilacao?: {
    amplitude_c: number;
    desvio_c: number;
    amplitude_referencia_c: number;
    referencia: "historico" | "perfil";
    variacoes_bruscas: number;
    variacoes_bruscas_por_hora: number;
  } | null;
  tendencia?: {
    dias_avaliados: number;
    suficiente: boolean;
    variacao_media_c_por_dia?: number;
    variacao_amplitude_c_por_dia?: number | null;
    dias?: { dia: string; media: number; maxima: number; amplitude: number | null; percentual_acima_alerta: number }[];
  } | null;
}

export interface RelatorioFreezerAI {
  versao_formato: "1.0";
  gerado_por: string;
  gerado_em: string;
  /** Momento de referência da análise (= fim do período) */
  referencia: string;
  periodo: { inicio: string; fim: string; tempo_real: boolean };
  fonte: string;
  equipamento: {
    perfil: "freezer" | "refrigerador";
    descricao: string;
    faixa_ideal: [number, number];
    limite_alerta: number;
    limite_critico: number;
  };
  status: StatusEquipamento;
  status_texto: string;
  /** 0–100; null quando não há dados suficientes */
  pontuacao_saude: number | null;
  /** Parágrafo curto em linguagem simples */
  resumo: string;
  achados: Achado[];
  recomendacoes: Recomendacao[];
  metricas: MetricasFreezerAI;
  qualidade_dados: {
    leituras_recebidas: number;
    leituras_validas: number;
    codigos_erro_sensor: Record<string, number>;
    fora_da_faixa_fisica: number;
    picos_isolados: number;
    descartadas: number;
  };
  /** Linha do tempo das anomalias detectadas (para listar e marcar no gráfico) */
  anomalias: Anomalia[];
  serie: { resolucao: "minuto" | "hora"; pontos: PontoSerie[] };
  parametros: { janela_horas: number; historico_dias: number; intervalo_leitura_s: number };
  aviso: string;
}
