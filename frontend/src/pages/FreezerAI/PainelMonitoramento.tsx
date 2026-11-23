import { useState } from "react";
import { useAlertas, useMarcarCiente, useVerificarAgora } from "../../hooks/useAlertas";
import { useAuth } from "../../hooks/useAuth";
import { testarEmail } from "../../services/alertasService";
import type { Alerta } from "../../types/freezerAi";

const fmtDataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";
const fmtTemp = (v: number | null) =>
  v === null ? "sem leitura" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} °C`;

function LinhaAlerta({ alerta, encerrado = false }: { alerta: Alerta; encerrado?: boolean }) {
  const { session } = useAuth();
  const marcar = useMarcarCiente();
  const enviados = alerta.emails.filter((e) => e.tipo === "alerta");
  const ultimoEmail = enviados[enviados.length - 1];
  const nivel = encerrado ? alerta.nivel_maximo : alerta.nivel;
  return (
    <li className={`fa-achado fa-sev-${nivel}`}>
      <div className="fa-achado-topo">
        <span className={`fa-selo fa-sev-${nivel}`}>{nivel === "critico" ? "Crítico" : "Atenção"}</span>
        <strong>
          {alerta.freezer.nome ?? "Freezer"}
          {alerta.freezer.localizacao ? ` · ${alerta.freezer.localizacao}` : ""}
        </strong>
        <span className="fa-confianca">
          {encerrado
            ? `${fmtDataHora(alerta.inicio)} → ${fmtDataHora(alerta.encerrado_em)}`
            : `desde ${fmtDataHora(alerta.inicio)}`}
        </span>
      </div>
      <p>
        <b>{fmtTemp(alerta.temperatura)}</b> · {alerta.achados[0]?.mensagem ?? alerta.titulo}
      </p>
      <p className="fa-monitor-detalhe">
        {ultimoEmail
          ? ultimoEmail.ok
            ? `✉ E-mail enviado para ${ultimoEmail.para.join(", ")} às ${fmtDataHora(ultimoEmail.em)}`
            : ultimoEmail.erro
              ? `✉ E-mail não enviado: ${ultimoEmail.erro}`
              : "✉ Enviando e-mail…"
          : "Sem e-mail para este alerta."}
        {alerta.ciente && ` · Ciente: ${alerta.ciente_por ?? "sim"} (${fmtDataHora(alerta.ciente_em)})`}
      </p>
      {!encerrado && !alerta.ciente && (
        <button
          type="button"
          className="fa-botao-pequeno no-print"
          disabled={marcar.isPending}
          onClick={() => marcar.mutate({ id: alerta.id, por: session?.user.email })}
        >
          Ciente
        </button>
      )}
    </li>
  );
}

/** Situação do vigia automático e alertas (ativos + histórico). */
export default function PainelMonitoramento() {
  const { estado, isError } = useAlertas();
  const verificar = useVerificarAgora();
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [msgEmail, setMsgEmail] = useState<string | null>(null);

  if (isError || !estado) return null; // IA offline: o selo do cabeçalho já avisa

  const m = estado.monitor;

  async function enviarTeste() {
    setMsgEmail("Enviando e-mail de teste…");
    try {
      const r = await testarEmail();
      setMsgEmail(`E-mail de teste enviado para ${r.para.join(", ")}.`);
    } catch (e) {
      setMsgEmail((e as Error).message);
    }
  }

  return (
    <section className="fa-painel no-print" aria-labelledby="fa-monitor-titulo">
      <div className="fa-titulo-com-filtro">
        <h3 id="fa-monitor-titulo">
          Monitoramento automático{" "}
          <span className={`fa-status-api ${m.ativo ? "on" : "off"}`}>{m.ativo ? "vigia ligado" : "vigia desligado"}</span>
        </h3>
        <div className="fa-acoes">
          <button type="button" onClick={() => verificar.mutate()} disabled={verificar.isPending}>
            {verificar.isPending ? "Verificando…" : "Verificar agora"}
          </button>
          <button type="button" onClick={() => void enviarTeste()} disabled={!m.email_configurado}
            title={m.email_configurado ? "Envia um e-mail de teste" : "Configure SMTP_USUARIO e SMTP_SENHA no ai/.env"}>
            Testar e-mail
          </button>
        </div>
      </div>
      <p className="fa-monitor-detalhe">
        A IA verifica {m.freezers_monitorados.length === 1 ? "1 freezer" : `${m.freezers_monitorados.length} freezers`}{" "}
        a cada {Math.round(m.intervalo_s)} s
        {m.freezers_monitorados.length > 0 && ` (${m.freezers_monitorados.map((f) => f.nome).join(", ")})`}. Última
        verificação: {fmtDataHora(m.ultima_verificacao)}. E-mail:{" "}
        {m.email_configurado ? `ligado (situações ${m.email_nivel === "atencao" ? "de atenção e críticas" : "críticas"})` : "não configurado"}.
        {m.simulacao && ` Modo simulação (cenário: ${m.cenario}).`}
      </p>
      {m.ultimo_erro && <p className="fa-aviso">Erro na última verificação: {m.ultimo_erro}</p>}
      {msgEmail && <p className="fa-monitor-detalhe">{msgEmail}</p>}

      {estado.ativos.length > 0 ? (
        <ul className="fa-lista-achados" style={{ marginTop: 12 }}>
          {estado.ativos.map((a) => <LinhaAlerta key={a.id} alerta={a} />)}
        </ul>
      ) : (
        <p className="fa-monitor-ok">✓ Nenhum alerta ativo no momento.</p>
      )}

      {estado.historico.length > 0 && (
        <>
          <button type="button" className="fa-link" onClick={() => setMostrarHistorico(!mostrarHistorico)}>
            {mostrarHistorico ? "Ocultar alertas encerrados" : `Ver alertas encerrados (${estado.historico.length})`}
          </button>
          {mostrarHistorico && (
            <ul className="fa-lista-achados">
              {estado.historico.map((a) => <LinhaAlerta key={a.id} alerta={a} encerrado />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
