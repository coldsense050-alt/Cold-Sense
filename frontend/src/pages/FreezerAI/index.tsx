import { useEffect, useRef, useState } from "react";
import {
  ErroFreezerAI,
  FREEZER_AI_URL,
  consultarSaude,
  gerarRelatorio,
  type ParametrosRelatorio,
} from "../../services/freezerAiService";
import type { Achado, Anomalia, RelatorioFreezerAI } from "../../types/freezerAi";
import { useFreezer } from "../../hooks/useFreezer";
import TemperatureChart from "./TemperatureChart";
import "./FreezerAI.css";

type Preset = "1h" | "6h" | "24h" | "7d" | "30d" | "personalizado";

const PRESETS: { id: Preset; rotulo: string; horas?: number }[] = [
  { id: "1h", rotulo: "Última hora", horas: 1 },
  { id: "6h", rotulo: "6 horas", horas: 6 },
  { id: "24h", rotulo: "24 horas", horas: 24 },
  { id: "7d", rotulo: "7 dias", horas: 168 },
  { id: "30d", rotulo: "30 dias", horas: 720 },
  { id: "personalizado", rotulo: "Personalizado" },
];

const CENARIOS = [
  "normal",
  "porta_aberta",
  "falha_refrigeracao",
  "oscilacao",
  "perda_estabilidade",
  "falha_sensor",
  "sem_dados_recentes",
];

const ROTULO_SEVERIDADE = { critico: "Crítico", atencao: "Atenção", info: "Informação" } as const;
const ROTULO_TIPO: Record<Anomalia["tipo"], string> = {
  acima_do_limite: "Acima do limite",
  sem_leituras: "Sem leituras",
  leitura_descartada: "Leitura descartada",
  subida_continua: "Subida contínua",
  aumento_incomum: "Aumento incomum",
  variacao_brusca: "Variação brusca",
};

const fmt = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function paraInputLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function IconeIA({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CartaoAchado({ achado }: { achado: Achado }) {
  return (
    <li className={`fa-achado fa-sev-${achado.severidade}`}>
      <div className="fa-achado-topo">
        <span className={`fa-selo fa-sev-${achado.severidade}`}>{ROTULO_SEVERIDADE[achado.severidade]}</span>
        <strong>{achado.titulo}</strong>
        <span className="fa-confianca">confiança {achado.confianca}</span>
      </div>
      <p>{achado.mensagem}</p>
      {Object.keys(achado.evidencias).length > 0 && (
        <details>
          <summary>Ver evidências</summary>
          <dl className="fa-evidencias">
            {Object.entries(achado.evidencias)
              .filter(([, v]) => typeof v !== "object" || v === null)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{typeof v === "number" ? fmt(v, 2) : String(v ?? "—")}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
    </li>
  );
}

export default function FreezerAI() {
  const [preset, setPreset] = useState<Preset>("24h");
  const [inicioCustom, setInicioCustom] = useState(() => paraInputLocal(new Date(Date.now() - 86_400_000)));
  const [fimCustom, setFimCustom] = useState(() => paraInputLocal(new Date()));
  const [perfil, setPerfil] = useState<ParametrosRelatorio["perfil"]>("freezer");
  const { data: freezers, isPending: carregandoFreezers } = useFreezer();
  // "" = ainda não escolhido (usa o primeiro freezer); "todas" = todas as leituras
  const [freezerEscolhido, setFreezerEscolhido] = useState("");
  const freezerSelecionado = freezerEscolhido || (freezers[0] ? String(freezers[0].id) : "todas");
  const [resolucao, setResolucao] = useState<ParametrosRelatorio["resolucao"]>("auto");
  const [cenario, setCenario] = useState("normal");
  const [alerta, setAlerta] = useState("");
  const [critico, setCritico] = useState("");
  const [modoSimulacao, setModoSimulacao] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioFreezerAI | null>(null);
  const [filtroAnomalia, setFiltroAnomalia] = useState<"todas" | Anomalia["tipo"]>("todas");
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const controle = useRef<AbortController | null>(null);
  const [autoAtualizar, setAutoAtualizar] = useState(false);
  const gerarRef = useRef<() => void>(() => {});

  useEffect(() => {
    consultarSaude().then((s) => {
      setApiOnline(!!s);
      setModoSimulacao(s?.fonte === "simulacao");
    });
  }, []);

  function periodoEscolhido(): { inicio: Date; fim: Date } | string {
    if (preset !== "personalizado") {
      const horas = PRESETS.find((p) => p.id === preset)!.horas!;
      const fim = new Date();
      return { inicio: new Date(fim.getTime() - horas * 3_600_000), fim };
    }
    const inicio = new Date(inicioCustom);
    const fim = new Date(fimCustom);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return "Informe início e fim do período.";
    if (inicio >= fim) return "O início deve ser anterior ao fim.";
    return { inicio, fim };
  }

  const horasPeriodo =
    preset !== "personalizado"
      ? PRESETS.find((p) => p.id === preset)!.horas!
      : (new Date(fimCustom).getTime() - new Date(inicioCustom).getTime()) / 3_600_000 || 0;
  const minutoBloqueado = horasPeriodo > 72;

  async function gerar(silencioso = false) {
    const p = periodoEscolhido();
    if (typeof p === "string") {
      setErro(p);
      return;
    }
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
    const limAlerta = num(alerta);
    const limCritico = num(critico);
    if ([limAlerta, limCritico].some((v) => v !== undefined && Number.isNaN(v))) {
      setErro("Os limites devem ser números, por exemplo -12 ou 8,5.");
      return;
    }
    if (limAlerta !== undefined && limCritico !== undefined && limCritico < limAlerta) {
      setErro("O limite crítico deve ser maior ou igual ao limite de alerta.");
      return;
    }
    controle.current?.abort();
    controle.current = new AbortController();
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const r = await gerarRelatorio(
        {
          ...p,
          perfil,
          resolucao: minutoBloqueado && resolucao === "minuto" ? "hora" : resolucao,
          cenario: modoSimulacao ? cenario : undefined,
          freezerId: freezerSelecionado === "todas" ? null : Number(freezerSelecionado),
          alerta: limAlerta,
          critico: limCritico,
        },
        controle.current.signal,
      );
      setRelatorio(r);
      if (!silencioso) {
        setFiltroAnomalia("todas");
        setMostrarTodas(false);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErro(e instanceof ErroFreezerAI ? e.message : "Erro inesperado ao gerar o relatório.");
    } finally {
      setCarregando(false);
    }
  }

  // Atualização automática (útil para acompanhar o ESP32 ao vivo)
  useEffect(() => {
    gerarRef.current = () => void gerar(true);
  });
  useEffect(() => {
    if (!autoAtualizar || preset === "personalizado") return;
    const id = window.setInterval(() => gerarRef.current(), 60_000);
    return () => window.clearInterval(id);
  }, [autoAtualizar, preset]);

  function baixarJson() {
    if (!relatorio) return;
    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-freezer-ai-${relatorio.periodo.fim.slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const anomalias = relatorio?.anomalias ?? [];
  const anomaliasFiltradas = anomalias.filter((a) => filtroAnomalia === "todas" || a.tipo === filtroAnomalia);
  const tiposPresentes = [...new Set(anomalias.map((a) => a.tipo))];
  const m = relatorio?.metricas;

  return (
    <div className="fa-pagina h-full overflow-y-auto md:pr-2">
      <header className="fa-cabecalho">
        <span className="fa-icone"><IconeIA /></span>
        <div>
          <h2 className="text-2xl font-bold text-secondary">Freezer AI</h2>
          <p>Análise inteligente das temperaturas: escolha o período e gere o relatório.</p>
        </div>
        <span className={`fa-status-api ${apiOnline ? "on" : apiOnline === false ? "off" : ""}`}>
          {apiOnline === null ? "Verificando IA…" : apiOnline ? (modoSimulacao ? "IA online (simulação)" : "IA online") : "IA offline"}
        </span>
      </header>

      <section className="fa-painel fa-form no-print" aria-label="Opções do relatório">
        <div className="fa-campo">
          <span className="fa-rotulo">Período</span>
          <div className="fa-presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={preset === p.id ? "ativo" : ""}
                onClick={() => setPreset(p.id)}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          {preset === "personalizado" && (
            <div className="fa-datas">
              <label>
                De
                <input type="datetime-local" value={inicioCustom} max={fimCustom} onChange={(e) => setInicioCustom(e.target.value)} />
              </label>
              <label>
                Até
                <input type="datetime-local" value={fimCustom} onChange={(e) => setFimCustom(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="fa-linha-campos">
          {!modoSimulacao && (
            <label className="fa-campo">
              <span className="fa-rotulo">Freezer</span>
              <select
                value={freezerSelecionado}
                disabled={carregandoFreezers}
                onChange={(e) => setFreezerEscolhido(e.target.value)}
              >
                {freezers.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
                <option value="todas">Todas as leituras</option>
              </select>
            </label>
          )}
          <label className="fa-campo">
            <span className="fa-rotulo">Tipo de equipamento</span>
            <select value={perfil} onChange={(e) => setPerfil(e.target.value as ParametrosRelatorio["perfil"])}>
              <option value="freezer">Freezer</option>
              <option value="refrigerador">Refrigerador</option>
            </select>
          </label>
          <label className="fa-campo">
            <span className="fa-rotulo">Gráfico</span>
            <select value={resolucao} onChange={(e) => setResolucao(e.target.value as ParametrosRelatorio["resolucao"])}>
              <option value="auto">Automático</option>
              <option value="minuto" disabled={minutoBloqueado}>
                Por minuto{minutoBloqueado ? " (até 3 dias)" : ""}
              </option>
              <option value="hora">Por hora</option>
            </select>
          </label>
          <label className="fa-campo fa-campo-curto">
            <span className="fa-rotulo">Alerta acima de (°C)</span>
            <input inputMode="decimal" placeholder={perfil === "freezer" ? "-12" : "7"} value={alerta} onChange={(e) => setAlerta(e.target.value)} />
          </label>
          <label className="fa-campo fa-campo-curto">
            <span className="fa-rotulo">Crítico acima de (°C)</span>
            <input inputMode="decimal" placeholder={perfil === "freezer" ? "-8" : "10"} value={critico} onChange={(e) => setCritico(e.target.value)} />
          </label>
          {modoSimulacao && (
            <label className="fa-campo">
              <span className="fa-rotulo">Cenário simulado</span>
              <select value={cenario} onChange={(e) => setCenario(e.target.value)}>
                {CENARIOS.map((c) => (
                  <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          )}
          <label className="fa-auto" title="Gera o relatório de novo a cada 1 minuto (não vale para período personalizado)">
            <input
              type="checkbox"
              checked={autoAtualizar}
              disabled={preset === "personalizado"}
              onChange={(e) => setAutoAtualizar(e.target.checked)}
            />
            Atualizar a cada 1 min
          </label>
          <button type="button" className="fa-botao-gerar" onClick={() => gerar()} disabled={carregando}>
            <IconeIA tamanho={18} /> {carregando ? "Analisando…" : "Gerar relatório"}
          </button>
        </div>
        {apiOnline === false && (
          <p className="fa-aviso">A API da Freezer AI não respondeu em {FREEZER_AI_URL}. Inicie-a com <code>uvicorn api:app --port 8000</code> na pasta <code>ai/</code>.</p>
        )}
      </section>

      {erro && <div className="fa-erro" role="alert">{erro}</div>}
      {carregando && !relatorio && <div className="fa-painel fa-carregando">A IA está analisando as leituras…</div>}

      {relatorio && (
        <div className={`fa-resultado ${carregando ? "fa-atualizando" : ""}`}>
          <section className={`fa-painel fa-status fa-st-${relatorio.status}`}>
            <div className="fa-status-topo">
              <div>
                <span className="fa-rotulo">Status do {relatorio.equipamento.descricao.toLowerCase()}</span>
                <h3>{relatorio.status_texto}</h3>
                <span className="fa-periodo-txt">
                  {fmtDataHora(relatorio.periodo.inicio)} até {fmtDataHora(relatorio.periodo.fim)}
                </span>
              </div>
              {relatorio.pontuacao_saude !== null && (
                <div className="fa-nota" aria-label={`Saúde ${relatorio.pontuacao_saude} de 100`}>
                  <strong>{relatorio.pontuacao_saude}</strong>
                  <span>/100 saúde</span>
                </div>
              )}
            </div>
            <p className="fa-resumo">{relatorio.resumo}</p>
            <div className="fa-acoes no-print">
              <button type="button" onClick={baixarJson}>Baixar JSON</button>
              <button type="button" onClick={() => window.print()}>Imprimir / PDF</button>
            </div>
          </section>

          {m?.periodo && (
            <section className="fa-cartoes" aria-label="Números do período">
              {[
                {
                  r: m.atual?.desatualizada
                    ? "Última leitura"
                    : relatorio.periodo.tempo_real ? "Temperatura atual" : "No fim do período",
                  v: `${fmt(m.atual?.temperatura)} °C`,
                },
                { r: "Média", v: `${fmt(m.periodo.media)} °C` },
                { r: "Mínima", v: `${fmt(m.periodo.minima)} °C` },
                { r: "Máxima", v: `${fmt(m.periodo.maxima)} °C` },
                { r: "Na faixa ideal", v: `${fmt(m.periodo.percentual_na_faixa_ideal, 0)}%` },
                { r: "Acima do alerta", v: `${fmt(m.periodo.percentual_acima_alerta, 1)}%` },
                { r: "Leituras recebidas", v: `${fmt(m.cobertura?.percentual_cobertura, 0)}%` },
                { r: "Anomalias", v: String(anomalias.length) },
              ].map((c) => (
                <div key={c.r} className="fa-cartao">
                  <span>{c.r}</span>
                  <strong>{c.v}</strong>
                </div>
              ))}
            </section>
          )}

          <section className="fa-painel">
            <h3>Temperatura {relatorio.serie.resolucao === "minuto" ? "por minuto" : "por hora"}</h3>
            {relatorio.serie.pontos.length ? (
              <TemperatureChart
                pontos={relatorio.serie.pontos}
                resolucao={relatorio.serie.resolucao}
                limiteAlerta={relatorio.equipamento.limite_alerta}
                limiteCritico={relatorio.equipamento.limite_critico}
                faixaIdeal={relatorio.equipamento.faixa_ideal}
                anomalias={relatorio.anomalias}
                inicio={relatorio.periodo.inicio}
                fim={relatorio.periodo.fim}
              />
            ) : (
              <p>Nenhuma leitura no período.</p>
            )}
          </section>

          <div className="fa-duas-colunas">
            <section className="fa-painel">
              <h3>O que a IA identificou</h3>
              {relatorio.achados.length ? (
                <ul className="fa-lista-achados">
                  {relatorio.achados.map((a, i) => <CartaoAchado key={`${a.codigo}-${i}`} achado={a} />)}
                </ul>
              ) : (
                <p>Nenhum comportamento fora do padrão foi encontrado no período.</p>
              )}
            </section>
            <section className="fa-painel">
              <h3>Recomendações</h3>
              {relatorio.recomendacoes.length ? (
                <ol className="fa-recomendacoes">
                  {relatorio.recomendacoes.map((r) => (
                    <li key={r.texto}>
                      <span className={`fa-prio fa-prio-${r.prioridade}`}>{r.prioridade}</span>
                      {r.texto}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Nenhuma ação necessária no momento.</p>
              )}
            </section>
          </div>

          <section className="fa-painel">
            <div className="fa-titulo-com-filtro">
              <h3>Anomalias no período ({anomaliasFiltradas.length})</h3>
              {tiposPresentes.length > 1 && (
                <select className="no-print" value={filtroAnomalia} onChange={(e) => setFiltroAnomalia(e.target.value as typeof filtroAnomalia)}>
                  <option value="todas">Todas</option>
                  {tiposPresentes.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
                </select>
              )}
            </div>
            {anomaliasFiltradas.length ? (
              <div className="fa-tabela-wrap">
                <table className="fa-tabela">
                  <thead>
                    <tr><th>Início</th><th>Fim</th><th>Tipo</th><th>Gravidade</th><th>Descrição</th></tr>
                  </thead>
                  <tbody>
                    {(mostrarTodas ? anomaliasFiltradas : anomaliasFiltradas.slice(0, 15)).map((a, i) => (
                      <tr key={i}>
                        <td>{fmtDataHora(a.inicio)}</td>
                        <td>{a.fim === a.inicio ? "—" : fmtDataHora(a.fim)}</td>
                        <td>{ROTULO_TIPO[a.tipo]}</td>
                        <td><span className={`fa-selo fa-sev-${a.severidade}`}>{ROTULO_SEVERIDADE[a.severidade]}</span></td>
                        <td>{a.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {anomaliasFiltradas.length > 15 && (
                  <button type="button" className="fa-link no-print" onClick={() => setMostrarTodas(!mostrarTodas)}>
                    {mostrarTodas ? "Mostrar menos" : `Mostrar todas (${anomaliasFiltradas.length})`}
                  </button>
                )}
              </div>
            ) : (
              <p>Nenhuma anomalia registrada no período.</p>
            )}
          </section>

          <p className="fa-rodape">
            {relatorio.aviso} Gerado em {fmtDataHora(relatorio.gerado_em)} · {relatorio.gerado_por} · fonte {relatorio.fonte}
          </p>
        </div>
      )}
    </div>
  );
}
