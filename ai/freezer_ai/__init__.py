"""Freezer AI – inteligência de análise de temperatura do Cold-Sense."""

__version__ = "0.2.0"


def analisar_dataframe(df, perfil="freezer", config=None, agora=None, fonte="dataframe",
                       tempo_real=True, resolucao="hora", **ajustes_perfil):
    """Atalho: DataFrame (ts, temp) -> relatório (dict pronto para JSON)."""
    from .analise import analisar
    from .config import Config, obter_perfil
    from .relatorio import gerar_relatorio

    from dataclasses import replace as _replace
    from .config import Perfil

    if isinstance(perfil, Perfil):  # perfil montado a partir do cadastro do freezer
        ajustes = {k: v for k, v in ajustes_perfil.items() if v is not None}
        p = _replace(perfil, **ajustes) if ajustes else perfil
        if p.limite_critico < p.limite_alerta:
            raise ValueError("O limite crítico deve ser maior ou igual ao limite de alerta.")
    else:
        p = obter_perfil(perfil, **ajustes_perfil)
    resultado = analisar(df, p, config or Config(), agora=agora, tempo_real=tempo_real, resolucao=resolucao)
    return gerar_relatorio(resultado, fonte=fonte)
