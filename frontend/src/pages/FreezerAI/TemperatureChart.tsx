import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Anomalia, PontoSerie } from "../../types/freezerAi";

interface Props {
  pontos: PontoSerie[];
  resolucao: "minuto" | "hora";
  limiteAlerta: number;
  limiteCritico: number;
  faixaIdeal: [number, number];
  anomalias: Anomalia[];
  inicio: string;
  fim: string;
}

const ALTURA = 320;
const MARGEM = { topo: 16, direita: 16, baixo: 36, esquerda: 48 };

const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function fmtData(ms: number, curto: boolean) {
  const d = new Date(ms);
  return curto
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function marcasY(min: number, max: number, qtd = 5) {
  const bruto = (max - min) / qtd;
  const pot = 10 ** Math.floor(Math.log10(bruto || 1));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const out: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) out.push(+v.toFixed(6));
  return out;
}

export default function TemperatureChart(props: Props) {
  const { pontos, resolucao, limiteAlerta, limiteCritico, faixaIdeal, anomalias } = props;
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!caixa.current) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(320, e.contentRect.width)));
    obs.observe(caixa.current);
    return () => obs.disconnect();
  }, []);

  const dados = useMemo(
    () =>
      pontos.map((p) => ({ ...p, t: new Date(p.instante).getTime() })),
    [pontos],
  );

  const t0 = new Date(props.inicio).getTime();
  const t1 = new Date(props.fim).getTime();
  const valores = dados.flatMap((p) => [p.minima, p.maxima]).filter((v): v is number => v !== null);
  const yMinDados = valores.length ? Math.min(...valores) : faixaIdeal[0];
  const yMaxDados = valores.length ? Math.max(...valores) : limiteCritico;
  const yMin = Math.min(yMinDados, faixaIdeal[0]) - 1;
  const yMax = Math.max(yMaxDados, limiteAlerta) + 1;

  const w = largura - MARGEM.esquerda - MARGEM.direita;
  const h = ALTURA - MARGEM.topo - MARGEM.baixo;
  const x = (t: number) => MARGEM.esquerda + ((t - t0) / Math.max(1, t1 - t0)) * w;
  const y = (v: number) => MARGEM.topo + (1 - (v - yMin) / (yMax - yMin)) * h;
  const passoMs = resolucao === "minuto" ? 60_000 : 3_600_000;

  // quebra a linha onde não há leituras
  const segmentos: (typeof dados)[] = [];
  let atual: typeof dados = [];
  for (const p of dados) {
    if (p.media === null) {
      if (atual.length) segmentos.push(atual);
      atual = [];
    } else atual.push(p);
  }
  if (atual.length) segmentos.push(atual);

  const linha = (seg: typeof dados) =>
    seg.map((p, i) => `${i ? "L" : "M"}${x(p.t + passoMs / 2).toFixed(1)},${y(p.media!).toFixed(1)}`).join("");
  const faixa = (seg: typeof dados) =>
    seg.map((p, i) => `${i ? "L" : "M"}${x(p.t + passoMs / 2).toFixed(1)},${y(p.maxima!).toFixed(1)}`).join("") +
    [...seg].reverse().map((p) => `L${x(p.t + passoMs / 2).toFixed(1)},${y(p.minima!).toFixed(1)}`).join("") +
    "Z";

  const periodoCurto = t1 - t0 <= 24 * 3_600_000;
  const marcasX = Array.from({ length: 6 }, (_, i) => t0 + ((t1 - t0) * i) / 5);

  const intervalos = anomalias.filter((a) => ["acima_do_limite", "sem_leituras"].includes(a.tipo));
  const pontuais = anomalias.filter((a) => ["leitura_descartada", "variacao_brusca"].includes(a.tipo));

  function aoMover(e: MouseEvent<SVGSVGElement>) {
    if (!dados.length) return;
    const ret = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - ret.left - MARGEM.esquerda) / w) * (t1 - t0);
    let melhor = 0;
    for (let i = 1; i < dados.length; i++)
      if (Math.abs(dados[i].t - t) < Math.abs(dados[melhor].t - t)) melhor = i;
    setHover(melhor);
  }

  const pHover = hover !== null ? dados[hover] : null;

  return (
    <div className="fa-grafico" ref={caixa}>
      <svg
        width={largura}
        height={ALTURA}
        role="img"
        aria-label="Gráfico de temperatura no período"
        onMouseMove={aoMover}
        onMouseLeave={() => setHover(null)}
      >
        {/* faixa ideal */}
        <rect
          x={MARGEM.esquerda}
          width={w}
          y={y(Math.min(faixaIdeal[1], yMax))}
          height={Math.max(0, y(Math.max(faixaIdeal[0], yMin)) - y(Math.min(faixaIdeal[1], yMax)))}
          className="fa-g-ideal"
        />
        {/* períodos de anomalia */}
        {intervalos.map((a, i) => {
          const xa = x(Math.max(t0, new Date(a.inicio).getTime()));
          const xb = x(Math.min(t1, new Date(a.fim).getTime()));
          return (
            <rect
              key={i}
              x={xa}
              width={Math.max(2, xb - xa)}
              y={MARGEM.topo}
              height={h}
              className={a.tipo === "sem_leituras" ? "fa-g-lacuna" : `fa-g-excursao fa-gs-${a.severidade}`}
            >
              <title>{a.descricao}</title>
            </rect>
          );
        })}
        {/* grade e eixo Y */}
        {marcasY(yMin, yMax).map((v) => (
          <g key={v}>
            <line x1={MARGEM.esquerda} x2={MARGEM.esquerda + w} y1={y(v)} y2={y(v)} className="fa-g-grade" />
            <text x={MARGEM.esquerda - 6} y={y(v) + 4} textAnchor="end" className="fa-g-texto">
              {fmtNum(v)}°
            </text>
          </g>
        ))}
        {marcasX.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={ALTURA - 12}
            textAnchor={i === 0 ? "start" : i === marcasX.length - 1 ? "end" : "middle"}
            className="fa-g-texto"
          >
            {fmtData(t, periodoCurto)}
          </text>
        ))}
        {/* limites */}
        {[
          { v: limiteAlerta, c: "fa-g-alerta", r: "alerta" },
          { v: limiteCritico, c: "fa-g-critico", r: "crítico" },
        ].map(({ v, c, r }) =>
          v <= yMax && v >= yMin ? (
            <g key={r}>
              <line x1={MARGEM.esquerda} x2={MARGEM.esquerda + w} y1={y(v)} y2={y(v)} className={c} />
              <text x={MARGEM.esquerda + w - 4} y={y(v) - 4} textAnchor="end" className={`fa-g-texto ${c}-t`}>
                {r} {fmtNum(v)}°
              </text>
            </g>
          ) : null,
        )}
        {/* mínima–máxima e média */}
        {segmentos.map((s, i) => (
          <path key={`f${i}`} d={faixa(s)} className="fa-g-faixa" />
        ))}
        {segmentos.map((s, i) => (
          <path key={`l${i}`} d={linha(s)} className="fa-g-linha" />
        ))}
        {/* leituras descartadas / variações bruscas */}
        {pontuais.map((a, i) => {
          const t = new Date(a.inicio).getTime();
          if (t < t0 || t > t1) return null;
          return (
            <circle key={`p${i}`} cx={x(t)} cy={MARGEM.topo + 6} r={3.5} className={`fa-g-ponto fa-gs-${a.severidade}`}>
              <title>{a.descricao}</title>
            </circle>
          );
        })}
        {/* cursor */}
        {pHover && pHover.media !== null && (
          <g pointerEvents="none">
            <line
              x1={x(pHover.t + passoMs / 2)}
              x2={x(pHover.t + passoMs / 2)}
              y1={MARGEM.topo}
              y2={MARGEM.topo + h}
              className="fa-g-cursor"
            />
            <circle cx={x(pHover.t + passoMs / 2)} cy={y(pHover.media)} r={4} className="fa-g-marcador" />
          </g>
        )}
      </svg>
      {pHover && (
        <div
          className="fa-g-tooltip"
          style={{
            left: Math.min(largura - 190, Math.max(0, x(pHover.t + passoMs / 2) + 10)),
            top: MARGEM.topo,
          }}
        >
          <strong>{fmtData(pHover.t, false)}</strong>
          {pHover.media === null ? (
            <span>Sem leituras</span>
          ) : (
            <>
              <span>Média: {fmtNum(pHover.media)} °C</span>
              <span>
                Mín {fmtNum(pHover.minima!)} °C · Máx {fmtNum(pHover.maxima!)} °C
              </span>
              <span>{pHover.leituras} leituras</span>
            </>
          )}
        </div>
      )}
      <div className="fa-g-legenda">
        <span><i className="fa-l-linha" /> Média por {resolucao}</span>
        <span><i className="fa-l-faixa" /> Mínima–máxima</span>
        <span><i className="fa-l-ideal" /> Faixa ideal</span>
        <span><i className="fa-l-excursao" /> Acima do limite</span>
        <span><i className="fa-l-lacuna" /> Sem leituras</span>
      </div>
    </div>
  );
}
