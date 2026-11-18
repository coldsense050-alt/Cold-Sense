"""Linha de comando da Freezer AI.

Exemplos:
  python -m freezer_ai simular --cenario falha_refrigeracao
  python -m freezer_ai analisar --arquivo exemplos/porta_aberta.csv
  python -m freezer_ai verificar-banco
  python -m freezer_ai analisar --supabase --perfil freezer --saida relatorio.json
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from . import analisar_dataframe
from .config import PERFIS, Config
from .relatorio import para_json, para_texto
from .simulador import CENARIOS, gerar


def _config(args) -> Config:
    cfg = Config()
    mudancas = {}
    if getattr(args, "horas", None):
        mudancas["janela_horas"] = args.horas
    if getattr(args, "dias", None):
        mudancas["historico_dias"] = args.dias
    return replace(cfg, **mudancas) if mudancas else cfg


def _ajustes(args) -> dict:
    return {"limite_alerta": args.alerta, "limite_critico": args.critico}


def _emitir(rel: dict, args) -> None:
    if args.saida:
        Path(args.saida).write_text(para_json(rel), encoding="utf-8")
        print(f"Relatório JSON salvo em: {args.saida}", file=sys.stderr)
    print(para_json(rel) if args.json else para_texto(rel))


def _padronizar_df(df: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    from .fontes import _padronizar
    return _padronizar(df, cfg.coluna_data, cfg.coluna_temperatura)


def cmd_simular(args) -> int:
    cfg = _config(args)
    fim = datetime.now(timezone.utc).replace(microsecond=0)
    bruto = gerar(args.cenario, dias=args.dias_simulados, fim=fim, semente=args.semente)
    if args.salvar:
        bruto.to_csv(args.salvar, index=False)
        print(f"Dados simulados salvos em: {args.salvar}", file=sys.stderr)
    df = _padronizar_df(bruto, cfg)
    rel = analisar_dataframe(df, args.perfil, cfg, agora=fim, fonte=f"simulacao:{args.cenario}", **_ajustes(args))
    _emitir(rel, args)
    return 0


def cmd_analisar(args) -> int:
    cfg = _config(args)
    if args.arquivo:
        from .fontes import carregar_arquivo
        df = carregar_arquivo(args.arquivo, cfg)
        fonte = f"arquivo:{Path(args.arquivo).name}"
        agora = None  # referência = última leitura do arquivo
    else:
        from .fontes import SupabaseFonte
        df = SupabaseFonte(cfg, args.env).buscar_historico(freezer_id=args.freezer)
        fonte = f"supabase:{cfg.tabela}" + (f" · freezer {args.freezer}" if args.freezer is not None else "")
        agora = datetime.now(timezone.utc)
    rel = analisar_dataframe(df, args.perfil, cfg, agora=agora, fonte=fonte, **_ajustes(args))
    _emitir(rel, args)
    return 0


def cmd_verificar_banco(args) -> int:
    """Confere a conexão e a estrutura real da tabela (sem exibir credenciais)."""
    from .fontes import SupabaseFonte
    cfg = Config()
    fonte = SupabaseFonte(cfg, args.env)
    cli = fonte._cliente
    print(f"Tabela configurada: {cfg.tabela}")
    try:
        resp = cli.table(cfg.tabela).select("*").order(cfg.coluna_data, desc=True).limit(5).execute()
    except Exception as e:  # noqa: BLE001
        print(f"ERRO ao consultar a tabela: {e}")
        return 1
    linhas = resp.data or []
    if not linhas:
        print("A tabela respondeu, mas não retornou linhas (vazia ou bloqueada por RLS para esta chave).")
        return 0
    colunas = list(linhas[0].keys())
    print(f"Colunas encontradas: {colunas}")
    for nome, col in (("data", cfg.coluna_data), ("temperatura", cfg.coluna_temperatura)):
        print(f"  coluna de {nome} '{col}': {'OK' if col in colunas else 'NÃO ENCONTRADA'}")
    cont = cli.table(cfg.tabela).select(cfg.coluna_data, count="exact").limit(1).execute()
    print(f"Total de linhas: {cont.count}")
    if cfg.coluna_dispositivo:
        print(f"  coluna de freezer '{cfg.coluna_dispositivo}': "
              f"{'OK' if cfg.coluna_dispositivo in colunas else 'NÃO ENCONTRADA'}")
    print("Últimas leituras:")
    for l in linhas:
        extra = f"  (freezer {l.get(cfg.coluna_dispositivo)})" if cfg.coluna_dispositivo in l else ""
        print(f"  {l.get(cfg.coluna_data)}  ->  {l.get(cfg.coluna_temperatura)}{extra}")
    try:
        fz = cli.table(cfg.tabela_freezers).select("id,nome").order("id").execute().data or []
        print(f"Freezers cadastrados ({cfg.tabela_freezers}): " +
              (", ".join(f"{f['id']} = {f['nome']}" for f in fz) or "nenhum"))
    except Exception as e:  # noqa: BLE001
        print(f"Não foi possível ler a tabela {cfg.tabela_freezers}: {e}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="freezer_ai", description="Freezer AI – análise inteligente do Cold-Sense")
    sub = p.add_subparsers(dest="comando", required=True)

    def comuns(sp):
        sp.add_argument("--perfil", choices=list(PERFIS), default="freezer")
        sp.add_argument("--alerta", type=float, help="sobrescreve o limite de alerta (°C)")
        sp.add_argument("--critico", type=float, help="sobrescreve o limite crítico (°C)")
        sp.add_argument("--horas", type=float, help="janela de análise detalhada (padrão 24)")
        sp.add_argument("--dias", type=float, help="dias de histórico como referência (padrão 7)")
        sp.add_argument("--saida", help="salva o relatório JSON neste arquivo")
        sp.add_argument("--json", action="store_true", help="imprime JSON em vez de texto")

    s = sub.add_parser("simular", help="gera dados sintéticos e analisa")
    s.add_argument("--cenario", choices=list(CENARIOS), default="normal")
    s.add_argument("--dias-simulados", type=float, default=7)
    s.add_argument("--semente", type=int, default=42)
    s.add_argument("--salvar", help="salva os dados simulados em CSV")
    comuns(s)
    s.set_defaults(func=cmd_simular)

    a = sub.add_parser("analisar", help="analisa dados reais (Supabase) ou de arquivo")
    g = a.add_mutually_exclusive_group(required=True)
    g.add_argument("--arquivo", help="CSV/JSON com colunas coletado_em e temperatura")
    g.add_argument("--supabase", action="store_true", help="lê da tabela do Supabase (somente leitura)")
    a.add_argument("--env", help="caminho do arquivo .env (padrão: .env na pasta atual)")
    a.add_argument("--freezer", type=int, help="id do freezer (tabela freezers); vazio = todas as leituras")
    comuns(a)
    a.set_defaults(func=cmd_analisar)

    v = sub.add_parser("verificar-banco", help="confere conexão e colunas da tabela no Supabase")
    v.add_argument("--env")
    v.set_defaults(func=cmd_verificar_banco)

    sub.add_parser("cenarios", help="lista cenários de simulação").set_defaults(
        func=lambda _a: print("\n".join(f"{k:22s} {v}" for k, v in CENARIOS.items())) or 0)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
