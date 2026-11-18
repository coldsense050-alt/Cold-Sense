"""Freezer AI – inteligência de análise de temperatura do Cold-Sense."""

__version__ = "0.1.0"


def analisar_dataframe(df, perfil="freezer", config=None, agora=None, fonte="dataframe",
                       tempo_real=True, resolucao="hora", **ajustes_perfil):
    """Atalho: DataFrame (ts, temp) -> relatório (dict pronto para JSON)."""
    from .analise import analisar
    from .config import Config, obter_perfil
    from .relatorio import gerar_relatorio

    p = obter_perfil(perfil, **ajustes_perfil)
    resultado = analisar(df, p, config or Config(), agora=agora, tempo_real=tempo_real, resolucao=resolucao)
    return gerar_relatorio(resultado, fonte=fonte)
