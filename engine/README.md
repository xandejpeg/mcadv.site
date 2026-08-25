# Radar MCAP — Motor de Pesquisa Jurídica

Coleta notícias e normas de **três áreas do Direito** (Tributário & Fiscal, Trabalhista e Previdenciário), compila relatórios em Markdown e serve feeds JSON públicos para outros projetos consumirem (ex.: letreiro de LED da LP do Real Prev). Inclui um boletim diário de clima de São Paulo.

> Regra de ouro: só consumimos **RSS/Atom e APIs públicas**. Nunca reproduzimos texto integral — apenas título, resumo (≤ 300 caracteres do próprio feed), fonte, data e link canônico, sempre com atribuição.

## Requisitos
- Node.js 20+ (usa `fetch` nativo).
- Uma única dependência: `fast-xml-parser`.

## Instalação
```bash
cd engine
npm install
```

## Como rodar local

```bash
# 1) Validar as fontes candidatas (gera src/config/sources.json)
npm run validate-sources

# 2) Coletar uma área (grava data/raw/<area>/<hoje>.json)
node src/collect.js --area=trabalhista --dias=7

# 3) Renderizar o relatório (grava content/<area>/<hoje>.md)
#    Use --draft para rascunho e --skip-link-check para pular a validação de links.
node src/render.js --area=trabalhista --skip-link-check

# 4) Clima do dia (grava data/weather + public/api/weather.json e atualiza o ticker)
node src/weather.js

# 5) Publicar índices e feeds (public/api/feed.json, ticker.json e content/README.md)
node src/publish.js

# Testes
npm test
```

Áreas válidas: `tributario-fiscal`, `trabalhista`, `previdenciario`.

## Estrutura

```
engine/src/
  config/areas.json      # áreas, queries, palavras-chave (com pesos) e agenda
  config/sources.json    # fontes validadas (gerado por validate-sources.js)
  config/consumers.json  # repositórios que recebem repository_dispatch
  lib/http.js            # fetch com timeout/retry/UA, checkLink, mapLimit
  lib/feed.js            # parser RSS/Atom/RDF
  lib/text.js            # normalização, slug, similaridade, canonicalização, escapes
  lib/util.js            # paths, datas BRT, carga de config
  collect.js  score.js  summarize.js  render.js  publish.js  weather.js
  validate-sources.js
templates/relatorio.md
```
Saídas ficam fora de `engine/`, na raiz do repo: `data/`, `content/`, `public/api/`.

## Como adicionar uma fonte
1. Edite a lista `CANDIDATAS` em `src/validate-sources.js` com `{ id, area, tipo, peso, url }`.
   - `area`: uma das três áreas ou `todas`.
   - `tipo` → peso sugerido: oficial/tribunal `1.0`, especializado `0.8`, imprensa `0.6`, agregador `0.4`.
2. Rode `npm run validate-sources`. Só entram no `sources.json` os feeds que responderem com XML válido e ≥ 1 item; os que falharem ficam registrados com `status` (`erro` / `sem-feed`).
3. Para Google News, basta adicionar/editar as `queries` da área em `src/config/areas.json`.

## Como mudar os horários
Os horários são definidos nos **cron** dos workflows em `.github/workflows/`:
- `pesquisa.yml` — pesquisa (rascunho), 2h antes da publicação.
- `publicacao.yml` — publicação do relatório final.
- `clima.yml` — boletim de clima às 05:00 BRT.

Os crons estão em **UTC**. Ex.: seg 20:00 BRT = `0 23 * * 1`. O agendador do GitHub pode atrasar em horário de pico — nada depende do minuto exato. Se mudar dia/área, ajuste também o mapeamento `case` do passo "Definir área" no workflow correspondente.

## Secrets
| Secret | Para quê | Se faltar |
|---|---|---|
| `GITHUB_TOKEN` | Fornecido pelo Actions. Commits dos workflows e, com `permissions: models: read`, o resumo por **GitHub Models**. | Sempre presente no Actions. |
| `DISPATCH_TOKEN` | PAT para disparar `repository_dispatch` aos consumidores (`consumers.json`). | O passo de notificação é **pulado**. |
| `LLM_API_KEY` (local) | Alternativa ao GitHub Models para rodar o enriquecimento por IA fora do Actions. | Usa o **resumo determinístico**. |

Variáveis úteis: `SITE_BASE` (base das URLs em `feed.json`, default `https://mdcadvocacia.com`), `MCAP_USE_MODELS=1` (liga o LLM no Actions), `MCAP_DETERMINISTICO=1` (força o texto determinístico), `LLM_MODEL` (default `openai/gpt-4o-mini`).

## Enriquecimento por IA (fallback garantido)
`summarize.js` gera "Panorama da semana" e "Por que importa". Sem credencial, com erro ou timeout de 60s, cai no **texto determinístico** — o relatório **sempre** sai. O material coletado é tratado como dado não confiável (delimitado no prompt, com instrução explícita para o modelo ignorar comandos embutidos) e qualquer número citado que não apareça no material invalida o enriquecimento.

## Contratos JSON
`public/api/feed.json`, `public/api/ticker.json` e `public/api/weather.json` seguem os contratos da seção 6 do briefing. **Não altere sem avisar os consumidores.** Os arquivos são servidos com `Access-Control-Allow-Origin: *` (ver `server.js`).

## Fases
- **Fase 1:** Google News + Conjur, dedupe, score, Markdown determinístico, clima, `feed.json`/`ticker.json`, três workflows via `workflow_dispatch`.
- **Fase 2 (atual):** peso de fonte por domínio/nome (`lib/sources.js` — oficial/tribunal têm peso 1.0 mesmo quando o item chega via Google News), tabela de **Normas e atos publicados** (`lib/normas.js`), **janela de revisão** do rascunho (o `.draft.md` editado à mão é respeitado quando mais novo que o raw; use `--force` para re-renderizar), fontes oficiais ampliadas e validadas, resumo por **GitHub Models** e issue automática em falha.
- **Fase 3:** página HTML no site, `repository_dispatch`, DOU e newsletter.

## Peso de fonte (Fase 2)
`lib/sources.js` classifica cada item pela fonte real (domínio ou nome do publisher) e aplica o maior peso entre domínio, nome e o piso do feed. Assim, uma notícia do STF/Receita que chega pelo Google News recebe peso de fonte oficial, não de agregador. Ajuste as regras em `REGRAS_HOST`/`REGRAS_NOME`.

## Janela de revisão do rascunho (Fase 2)
O workflow de **pesquisa** gera `content/<area>/<data>.draft.md`. Se um humano editar esse rascunho, a **publicação** respeita a edição: quando o `.draft.md` é mais novo que o raw, ele é promovido a `<data>.md` sem re-renderizar. Para forçar a re-renderização (descartando o rascunho), rode `node src/render.js --area=<area> --force`.
