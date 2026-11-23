"""Fontes de dados da Freezer AI.

- SupabaseFonte: lê a tabela existente do Cold-Sense (SOMENTE LEITURA, só SELECT).
- carregar_arquivo: lê um CSV/JSON exportado (útil para testes offline).

Todas devolvem um DataFrame padronizado com as colunas:
    ts   -> datetime com fuso UTC
    temp -> float (°C)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import pandas as pd

from .config import Config


def _padronizar(df: pd.DataFrame, col_data: str, col_temp: str) -> pd.DataFrame:
    faltando = [c for c in (col_data, col_temp) if c not in df.columns]
    if faltando:
        raise ValueError(
            f"Colunas não encontradas nos dados: {faltando}. Colunas disponíveis: {list(df.columns)}"
        )
    out = pd.DataFrame(
        {
            "ts": pd.to_datetime(df[col_data], utc=True, format="ISO8601", errors="coerce"),
            "temp": pd.to_numeric(df[col_temp], errors="coerce"),
        }
    )
    out = out.dropna(subset=["ts"]).sort_values("ts").reset_index(drop=True)
    return out


def carregar_arquivo(caminho: str | Path, config: Optional[Config] = None) -> pd.DataFrame:
    """Carrega leituras de um .csv ou .json (lista de objetos, como o Supabase devolve)."""
    config = config or Config()
    caminho = Path(caminho)
    if caminho.suffix.lower() == ".csv":
        bruto = pd.read_csv(caminho)
    elif caminho.suffix.lower() == ".json":
        with caminho.open(encoding="utf-8") as f:
            conteudo = json.load(f)
        if isinstance(conteudo, dict) and "leituras" in conteudo:
            conteudo = conteudo["leituras"]
        bruto = pd.DataFrame(conteudo)
    else:
        raise ValueError("Formato não suportado. Use .csv ou .json")
    return _padronizar(bruto, config.coluna_data, config.coluna_temperatura)


class SupabaseFonte:
    """Leitura paginada da tabela de temperaturas existente.

    Credenciais vêm SOMENTE de variáveis de ambiente / arquivo .env:
        SUPABASE_URL
        SUPABASE_KEY  (recomendado: chave publishable/anon com permissão de SELECT)
        SUPABASE_SECRET_KEY é aceita como alternativa (mesmo nome usado no backend do firmware).
    """

    TAMANHO_PAGINA = 1000  # o projeto usa max_rows = 1000 (supabase/config.toml)
    MAXIMO_LINHAS = 300_000

    def __init__(self, config: Optional[Config] = None, arquivo_env: Optional[str | Path] = None):
        self.config = config or Config()
        try:
            from dotenv import load_dotenv

            load_dotenv(arquivo_env) if arquivo_env else load_dotenv()
        except ImportError:  # python-dotenv é opcional
            pass

        url = os.getenv("SUPABASE_URL")
        chave = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SECRET_KEY")
        if not url or not chave:
            raise RuntimeError(
                "Credenciais do Supabase não configuradas. Defina SUPABASE_URL e SUPABASE_KEY "
                "no arquivo .env (veja .env.example)."
            )
        from supabase import create_client

        self._cliente = create_client(url, chave)

    def buscar(
        self,
        desde: Optional[datetime] = None,
        ate: Optional[datetime] = None,
        dispositivo: Optional[int | str] = None,
    ) -> pd.DataFrame:
        cfg = self.config
        colunas = f"{cfg.coluna_data},{cfg.coluna_temperatura}"
        linhas: list[dict] = []
        inicio = 0
        while True:
            consulta = self._cliente.table(cfg.tabela).select(colunas)
            if desde is not None:
                consulta = consulta.gte(cfg.coluna_data, desde.isoformat())
            if ate is not None:
                consulta = consulta.lte(cfg.coluna_data, ate.isoformat())
            if dispositivo is not None:
                if not cfg.coluna_dispositivo:
                    raise ValueError("Defina FREEZER_AI_COLUNA_DISPOSITIVO para filtrar por freezer.")
                consulta = consulta.eq(cfg.coluna_dispositivo, dispositivo)
            resposta = (
                consulta.order(cfg.coluna_data, desc=False)
                .range(inicio, inicio + self.TAMANHO_PAGINA - 1)
                .execute()
            )
            pagina = resposta.data or []
            linhas.extend(pagina)
            if len(pagina) < self.TAMANHO_PAGINA or len(linhas) >= self.MAXIMO_LINHAS:
                break
            inicio += self.TAMANHO_PAGINA

        if not linhas:
            return pd.DataFrame({"ts": pd.Series(dtype="datetime64[ns, UTC]"), "temp": pd.Series(dtype=float)})
        return _padronizar(pd.DataFrame(linhas), cfg.coluna_data, cfg.coluna_temperatura)

    def buscar_historico(self, dias: Optional[float] = None, freezer_id: Optional[int] = None) -> pd.DataFrame:
        dias = dias if dias is not None else self.config.historico_dias
        desde = datetime.now(timezone.utc) - timedelta(days=dias)
        return self.buscar(desde=desde, dispositivo=freezer_id)

    def freezers(self) -> list[dict]:
        """Lista os freezers cadastrados (com a faixa recomendada, se existir)."""
        r = self._cliente.table(self.config.tabela_freezers).select("*").order("id").execute()
        return r.data or []

    def freezer(self, freezer_id: int) -> Optional[dict]:
        r = (self._cliente.table(self.config.tabela_freezers).select("*")
             .eq("id", freezer_id).limit(1).execute())
        return (r.data or [None])[0]

    def ultima_leitura(self, freezer_id: Optional[int] = None) -> Optional[datetime]:
        cfg = self.config
        consulta = self._cliente.table(cfg.tabela).select(cfg.coluna_data)
        if freezer_id is not None and cfg.coluna_dispositivo:
            consulta = consulta.eq(cfg.coluna_dispositivo, freezer_id)
        r = consulta.order(cfg.coluna_data, desc=True).limit(1).execute()
        if not r.data:
            return None
        return pd.to_datetime(r.data[0][cfg.coluna_data], utc=True, format="ISO8601").to_pydatetime()

    def prestadores_do_freezer(self, freezer_id: int) -> list[dict]:
        """Prestadores de manutenção ATIVOS ligados ao freezer (tabelas da tela de Prestadores)."""
        r = (self._cliente.table("freezers_prestadores")
             .select("prestador:prestadores_manutencao(id, nome, email, telefone, ativo)")
             .eq("freezer_id", freezer_id).execute())
        prestadores = [linha.get("prestador") for linha in (r.data or [])]
        return [p for p in prestadores if p and p.get("ativo") and p.get("email")]

    def nome_freezer(self, freezer_id: int) -> Optional[str]:
        try:
            r = (self._cliente.table(self.config.tabela_freezers).select("nome")
                 .eq("id", freezer_id).limit(1).execute())
            return (r.data or [{}])[0].get("nome")
        except Exception:  # noqa: BLE001 – nome é só informativo
            return None
