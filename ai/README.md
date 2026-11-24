# Freezer AI – inteligência de análise do Cold-Sense

> **Uso pelo site:** a página **Freezer AI** do front-end chama a API desta pasta.
> Veja a seção [API e página no site](#api-e-página-no-site).

Módulo Python **independente** que lê as leituras de temperatura já gravadas no
Supabase do Cold-Sense, interpreta o comportamento do equipamento e gera um
relatório (JSON + texto) com status, achados, evidências e recomendações.

```
ESP32 → Supabase (tabela existente) → Freezer AI (somente leitura) → relatório JSON → site (TS/JS)
```

- **Não altera nada do projeto principal**, não cria tabelas e só faz `SELECT`.
- Não "chuta" diagnóstico: cada conclusão traz os números que a sustentam
  (`evidencias`) e um nível de `confianca`. Sem dados suficientes, o status é
  `indeterminado`.

## Checklist: teste com o ESP32

Três programas rodando ao mesmo tempo, cada um em um terminal:

**1. Ponte ESP32 → Supabase** (pasta `firmware/`)
```bash
cd firmware
pip install pyserial supabase python-dotenv
copy .env.example .env      # Mac/Linux: cp
# no .env: SUPABASE_URL, SUPABASE_SECRET_KEY, PORTA_SERIAL (ex.: COM3 – veja no Gerenciador de Dispositivos)
# e FREEZER_ID = id do freezer na tabela "freezers" (o verificar-banco abaixo lista os ids)
python -m backend.main
```
Deve aparecer uma linha por leitura gravada, a cada ~10 s:
`14:02:10  27.4 °C  gravado (1)`. Feche o monitor serial do PlatformIO/VS Code antes,
porque só um programa pode usar a porta por vez.

**2. API da Freezer AI** (pasta `ai/`)
```bash
cd ai
pip install -r requirements.txt
copy .env.example .env      # preencha SUPABASE_URL e SUPABASE_KEY; NÃO use FREEZER_AI_FONTE=simulacao
python -m freezer_ai verificar-banco   # confere conexão, colunas e últimas leituras
iniciar_api.bat                        # ou: python -m uvicorn api:app --reload --port 8000
```

**3. Site** (pasta `frontend/`)
```bash
cd frontend
# em .env.local: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e VITE_FREEZER_AI_URL=http://localhost:8000
npm install
npm run dev
```
Abra `http://localhost:5173/freezer-ai` (ou clique em **Freezer AI** no menu lateral),
escolha o **freezer**, o período **Última hora**, marque **Atualizar a cada 1 min** e
clique em **Gerar relatório**.

**Um freezer por análise:** cada leitura tem `freezer_id` (tabela `freezers`). A IA
analisa um freezer por vez para não misturar equipamentos. Se o `FREEZER_ID` da ponte
ficar vazio, as leituras entram sem freezer; nesse caso escolha **Todas as leituras** na página.

**Dicas para o teste**
- São necessários pelo menos ~5 min de leituras (30 leituras) para a análise sair
  do estado "dados insuficientes". Tendências de vários dias só aparecem com 3 dias de histórico.
- Sensor fora do freezer (temperatura ambiente) vai aparecer como crítico no perfil
  freezer. Para testar o comportamento, preencha os campos **Alerta acima de** e
  **Crítico acima de** na página (ex.: 30 e 35) e aqueça o sensor com a mão.
- Para simular falha de comunicação, desconecte o ESP32 por alguns minutos: a ponte
  tenta reconectar sozinha e a IA mostra a interrupção no gráfico.
- Se `verificar-banco` mostrar "nenhuma linha" com a chave publishable, a tabela
  está protegida por RLS. Libere leitura com uma política de SELECT (no SQL Editor do Supabase):
  ```sql
  create policy "leitura publica das temperaturas" on public.temperaturas
    for select using (true);
  ```
  (Avalie com a equipe antes; o site atual já lê essa tabela com a chave publishable.)

## Alertas automáticos (vigia)

Além dos relatórios sob demanda, a API tem um **vigia** que analisa cada freezer
**a cada minuto**, sozinho:

- Usa a **faixa recomendada do cadastro** (`temperatura_min` / `temperatura_max` da
  tabela `freezers`): acima da máxima ou abaixo da mínima = **atenção**; mais de
  3 °C acima da máxima (`FREEZER_AI_MARGEM_CRITICA`) = **crítico**.
- Também alerta: subida contínua, temperatura acima do limite por muito tempo,
  aberturas de porta frequentes, falha do sensor e **freezer sem enviar leituras**
  (ESP32 desligado / falta de energia).
- **Na tela**: cartão no canto de qualquer página do site, contador no menu
  "Freezer AI", som e notificação do navegador. O botão **Ciente** registra quem viu.
- **Por e-mail**: em situação crítica, para os **prestadores ativos ligados ao
  freezer** (tela Prestadores) + cópias em `FREEZER_AI_EMAIL_COPIA`. Lembrete a cada
  60 min enquanto ninguém marcar "Ciente"; e-mail de "Normalizado" quando o problema acaba.
- Para evitar alarme falso, "atenção" só vira alerta se continuar por 2 verificações
  seguidas; o alerta só é encerrado após 3 verificações normais.
- Os alertas ficam na memória da API (não cria tabela no banco). Ao reiniciar a API,
  o histórico some, mas um problema ainda presente gera alerta de novo.

### Configurar o e-mail (Gmail)
1. Use uma conta Gmail da equipe e ative a **verificação em duas etapas**.
2. Em myaccount.google.com, procure **"Senhas de app"**, crie uma chamada `Cold-Sense`.
3. No `ai/.env`: `SMTP_USUARIO=conta@gmail.com` e `SMTP_SENHA=` a senha de 16 letras.
4. Reinicie a API e use o botão **Testar e-mail** na página Freezer AI.

### Enviar um relatório por e-mail
Depois de gerar um relatório na página Freezer AI, o botão **✉ Enviar por e-mail** abre
a lista de **prestadores ativos** (tela Prestadores). Os ligados ao freezer analisado já
vêm marcados; dá para escrever uma mensagem. Por segurança, a API só envia para e-mails
cadastrados como prestador ativo (ou listados em `FREEZER_AI_EMAIL_COPIA`).

### Rotas
| Método | Rota | Descrição |
|---|---|---|
| POST | `/relatorio/enviar` | Envia um relatório gerado para prestadores cadastrados |
| GET | `/alertas` | Alertas ativos, histórico e situação do vigia |
| POST | `/alertas/verificar` | Verifica agora, sem esperar o próximo minuto |
| POST | `/alertas/{id}/ciente` | Marca como ciente (`{"por": "email"}`) |
| POST | `/alertas/teste-email` | Envia e-mail de teste para a conta remetente |
| POST | `/alertas/simular?cenario=...` | Só em simulação: muda o cenário observado |

**Testar sem ESP32:** `FREEZER_AI_FONTE=simulacao` e `FREEZER_AI_MONITOR_CENARIO=falha_refrigeracao`
no `ai/.env` → em até 1 minuto aparece um alerta crítico no site.

> Segurança: as rotas de alerta não exigem login. Para publicar a API na internet,
> proteja-as (ex.: validar o token do Supabase) ou mantenha a API só na rede local.

## O que ela identifica

| Código | O que significa |
|---|---|
| `temperatura_critica` / `temperatura_alta` / `temperatura_baixa` | Temperatura atual fora dos limites do perfil |
| `excursao_prolongada` | Ficou acima do limite de alerta por mais de 30 min |
| `elevacoes_curtas_frequentes` | Várias subidas curtas com recuperação rápida (padrão compatível com porta aberta) |
| `picos_ciclicos_acima_limite` | Ultrapassa o limite de forma regular a cada ciclo do compressor |
| `subida_continua` | Subindo de forma consistente há 1 h (com estimativa de quando atinge o limite) |
| `aumento_incomum` | Média das últimas 3 h bem acima do padrão do próprio equipamento |
| `oscilacao_elevada` / `variacoes_bruscas` | Oscilação maior que a habitual / saltos bruscos frequentes |
| `tendencia_aquecimento` | Média diária subindo de forma consistente (≥ 3 dias de histórico) |
| `perda_estabilidade` | Oscilação diária crescendo ao longo dos dias |
| `falha_sensor` / `picos_isolados` | Valores 85 °C / -127 °C do DS18B20, leituras impossíveis ou ruído |
| `sem_dados_recentes` / `cobertura_baixa` / `dados_insuficientes` | Problemas de comunicação/volume de dados |

Técnicas usadas (simples e explicáveis): limpeza de códigos de erro do sensor,
mediana por minuto, regressão linear (taxa °C/h), comparação robusta com o
padrão histórico (mediana/MAD), amplitude da oscilação em torno da média móvel
e tendência diária.

## Instalação

```bash
cd ai
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Testar sem hardware (simulação)

```bash
python -m freezer_ai cenarios                              # lista os cenários
python -m freezer_ai simular --cenario normal
python -m freezer_ai simular --cenario falha_refrigeracao
python -m freezer_ai simular --cenario porta_aberta --json  # saída JSON
python -m freezer_ai simular --cenario perda_estabilidade --saida relatorio.json
python -m pytest -q                                        # testes automáticos
```

Cenários: `normal`, `porta_aberta`, `falha_refrigeracao`, `oscilacao`,
`perda_estabilidade`, `falha_sensor`, `sem_dados_recentes`.

## Analisar um arquivo exportado

CSV ou JSON com as colunas `coletado_em` e `temperatura` (mesmo formato da tabela):

```bash
python -m freezer_ai simular --cenario porta_aberta --salvar dados.csv   # gera um CSV de teste
python -m freezer_ai analisar --arquivo dados.csv
python -m freezer_ai analisar --arquivo exemplos/backend_atual.json
```

## Analisar os dados reais do Supabase

1. Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_KEY`
   (com o login ativado no site, use a chave *secret*: a API roda no servidor).
2. Confira a estrutura real da tabela (mostra colunas e últimas leituras, nunca as chaves):
   ```bash
   python -m freezer_ai verificar-banco
   ```
3. Rode a análise:
   ```bash
   python -m freezer_ai analisar --supabase --perfil freezer --saida relatorio.json
   ```

Opções úteis: `--perfil refrigerador`, `--alerta -10 --critico -6` (ajusta limites),
`--horas 12` (janela detalhada), `--dias 14` (histórico de referência).

## Perfis padrão (ajustáveis em `freezer_ai/config.py`)

| Perfil | Faixa ideal | Alerta acima de | Crítico acima de |
|---|---|---|---|
| freezer | -24 a -16 °C | -12 °C | -8 °C |
| refrigerador | 1 a 5 °C | 7 °C (e abaixo de -0,5 °C) | 10 °C |

## Uso dentro de outro código Python

```python
from freezer_ai import analisar_dataframe
from freezer_ai.fontes import SupabaseFonte

df = SupabaseFonte().buscar_historico(dias=7)
relatorio = analisar_dataframe(df, perfil="freezer", fonte="supabase")
print(relatorio["status"], relatorio["resumo"])
```

O formato do JSON está tipado em `tipos/freezer-ai.ts` (para o front-end).

## API e página no site

O usuário abre o site, clica em **Freezer AI** no menu, escolhe o período
(última hora, 6 h, 24 h, 7 dias, 30 dias ou datas personalizadas), o tipo de
equipamento e o gráfico (automático, por minuto ou por hora) e clica em
**Gerar relatório**. O site chama esta API, que lê o Supabase, roda a análise e
devolve: status, nota de saúde, resumo, gráfico com faixa ideal e limites,
anomalias marcadas no gráfico e listadas com data/hora, achados com evidências e
recomendações. Dá para baixar o JSON ou imprimir/salvar em PDF.

### Rodando local (2 terminais)

```bash
# Terminal 1 – API
cd ai
pip install -r requirements.txt
cp .env.example .env          # preencha SUPABASE_URL e SUPABASE_KEY
uvicorn api:app --reload --port 8000

# Terminal 2 – site
cd frontend
# em .env.local, acrescente: VITE_FREEZER_AI_URL=http://localhost:8000
npm install
npm run dev                   # abra http://localhost:5173/freezer-ai
```

**Testar sem banco:** coloque `FREEZER_AI_FONTE=simulacao` no `ai/.env`. A página
passa a mostrar um seletor de cenário simulado (porta aberta, falha de refrigeração…).

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | Verifica se a IA está no ar (`fonte`: supabase ou simulacao) |
| GET | `/relatorio` | Gera o relatório. Parâmetros: `inicio`, `fim` (ISO 8601), `freezer_id`, `perfil` (`freezer`/`refrigerador`), `resolucao` (`auto`/`minuto`/`hora`), `alerta`, `critico` |

Regras: período de 15 min a 31 dias; gráfico por minuto até 72 h (automático:
por minuto até 48 h, depois por hora); para períodos de até 7 dias a IA usa
também os 7 dias anteriores como "padrão" do equipamento. Documentação
interativa em `http://localhost:8000/docs`.

### Publicação (quando for para produção)

- Hospede a pasta `ai/` em um serviço que rode Python (Render, Railway, Fly.io…)
  com o comando `uvicorn api:app --host 0.0.0.0 --port $PORT` e as variáveis do `.env`.
- No front-end, `VITE_FREEZER_AI_URL` = endereço público da API.
- Na API, `FREEZER_AI_CORS_ORIGINS` = endereço público do site.
- A API só faz leitura. Use a chave *publishable* com uma política RLS de
  SELECT na tabela, em vez da chave secreta.

## Estrutura

```
freezer_ai/
  config.py      perfis, limites e nomes de tabela/colunas (via variáveis de ambiente)
  fontes.py      leitura do Supabase (paginada, só SELECT) e de arquivos
  analise.py     motor de análise (sem rede/banco, fácil de testar)
  relatorio.py   status, pontuação, resumo, recomendações, JSON e texto
  simulador.py   dados sintéticos para testes
  __main__.py    linha de comando
api.py                API HTTP (FastAPI) usada pelo site
tipos/freezer-ai.ts   contrato do JSON (cópia em frontend/src/types/freezerAi.ts)
tests/                testes com os cenários simulados
exemplos/             dados e relatório de exemplo
```

## Pontos de atenção encontrados no projeto principal (não foram alterados)

1. **O backend atual só grava quando a temperatura passa de 30 °C, e no máximo a
   cada 5 min** (`firmware/backend/main.py`: `LIMITE_TEMPERATURA = 30`,
   `INTERVALO_ENVIO = 300`). Para a IA analisar tendência, oscilação e
   histórico, ela precisa de **todas** as leituras (~a cada 10 s). Com os dados
   atuais, a IA vai responder corretamente "dados insuficientes / falhas de envio".
2. `PORTA_SERIAL` está comentada no `main.py` do backend, então o script falha ao rodar.
3. Não há migrações SQL no repositório; a IA usa apenas o que o código confirma:
   tabela `temperaturas`, colunas `temperatura` e `coletado_em`. Use
   `verificar-banco` para confirmar a estrutura real.
4. Cada leitura pode ter `freezer_id` (tabela `freezers`); a IA filtra por ele.
   A ponte do ESP32 grava esse campo quando `FREEZER_ID` está preenchido no `firmware/.env`.

## Próximos passos sugeridos para a integração

- Rodar a IA periodicamente (ex.: a cada 5–15 min) e disponibilizar o JSON para o site.
  Opções: gravar o relatório em uma tabela nova (decisão a combinar) ou expor via
  uma pequena API/Edge Function.
- Ajustar os limites dos perfis com dados reais do freezer.
