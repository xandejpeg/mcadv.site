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
| `GITHUB_TOKEN` | Fornecido pelo Actions. Commits dos workflows. | Sempre presente no Actions. |
| `DISPATCH_TOKEN` | PAT para disparar `repository_dispatch` aos consumidores (`consumers.json`). | O passo de notificação é **pulado**. |
| `LLM_API_KEY` | Chave de um provedor **compatível com OpenAI** para o resumo por IA. | Usa o **resumo determinístico**. |
| `LLM_BASE_URL` | Endpoint do provedor (ex.: `https://api.openai.com/v1`). | Default: GitHub Models (**em descontinuação** — ver nota). |
| `LLM_MODEL` | Modelo (ex.: `gpt-4o-mini`). | Default `openai/gpt-4o-mini`. |

> ⚠️ **GitHub Models em descontinuação.** Em produção o endpoint padrão retornou `HTTP 410 github_models_retirement_brownout`. Para ter resumo por IA, configure `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` de um provedor compatível com OpenAI. Sem isso, o motor usa o **texto determinístico** (o relatório sempre sai).

Variáveis úteis: `SITE_BASE` (base das URLs em `feed.json`, default `https://mdcadvocacia.com`), `LLM_API_KEY`/`LLM_BASE_URL`/`LLM_MODEL` (resumo por IA em qualquer provedor compatível com OpenAI), `MCAP_USE_MODELS=1` (tenta o GitHub Models com o `GITHUB_TOKEN` — hoje retornando 410), `MCAP_DETERMINISTICO=1` (força o texto determinístico).

## Enriquecimento por IA (fallback garantido)
`summarize.js` gera "Panorama da semana" e "Por que importa". Sem credencial, com erro ou timeout de 60s, cai no **texto determinístico** — o relatório **sempre** sai. O material coletado é tratado como dado não confiável (delimitado no prompt, com instrução explícita para o modelo ignorar comandos embutidos) e qualquer número citado que não apareça no material invalida o enriquecimento.

## Contratos JSON
`public/api/feed.json`, `public/api/ticker.json` e `public/api/weather.json` seguem os contratos da seção 6 do briefing. **Não altere sem avisar os consumidores.** Os arquivos são servidos com `Access-Control-Allow-Origin: *` (ver `server.js`).

## Fases
- **Fase 1:** Google News + Conjur, dedupe, score, Markdown determinístico, clima, `feed.json`/`ticker.json`, três workflows via `workflow_dispatch`.
- **Fase 2:** peso de fonte por domínio/nome (`lib/sources.js`), tabela de **Normas e atos publicados** (`lib/normas.js`), **janela de revisão** do rascunho, fontes oficiais ampliadas, resumo por **GitHub Models** e issue automática em falha.
- **Fase 3 (atual):** página pública **`radar.html`** listando os relatórios, `repository_dispatch` para os consumidores (`dispatch.js`), coletor de **DOU** opcional (`collect-dou.js`) e **newsletter** (digest combinado `newsletter.js`).

## Página pública (Fase 3)
`radar.html` (na raiz do site) consome `public/api/feed.json` e `public/api/weather.json`, lista os relatórios por área e renderiza o `.md` escolhido num leitor embutido (conversor Markdown mínimo, sem dependências). Link no rodapé da LP ("Radar Jurídico"). Requer os feeds servidos com CORS (já configurado no `server.js`).

## repository_dispatch (Fase 3)
`node src/dispatch.js` lê `src/config/consumers.json` e envia um `repository_dispatch` para cada consumidor **ativo** com `repo` preenchido, usando o secret `DISPATCH_TOKEN`. Sem o secret, o passo é pulado. O `client_payload` inclui as URLs de `feed`, `ticker` e `weather`. Chamado automaticamente no fim de `publicacao.yml`.

## DOU (Fase 3, opcional)
`node src/collect-dou.js --area=<area>` coleta atos do Diário Oficial de forma best-effort. Como a INLABS/DOU não expõe RSS aberto, usamos o índice do Google News restrito a `site:in.gov.br` (guardando **apenas ementa + link**, sem scraping do jornal) até haver credencial INLABS. Saída em `data/raw/dou/<area>/<data>.json`. Não é obrigatório no pipeline.

## Newsletter (Fase 3)
`node src/newsletter.js` monta um boletim combinado com o relatório mais recente de cada área + manchetes do ticker + clima. Gera `content/newsletter/<data>.md` e `public/api/newsletter.json`. Roda ao fim de `publicacao.yml`. O envio por e-mail em si depende de infraestrutura externa (fora do escopo do motor).

## Peso de fonte (Fase 2)
`lib/sources.js` classifica cada item pela fonte real (domínio ou nome do publisher) e aplica o maior peso entre domínio, nome e o piso do feed. Assim, uma notícia do STF/Receita que chega pelo Google News recebe peso de fonte oficial, não de agregador. Ajuste as regras em `REGRAS_HOST`/`REGRAS_NOME`.

## Janela de revisão do rascunho (Fase 2)
O workflow de **pesquisa** gera `content/<area>/<data>.draft.md`. Se um humano editar esse rascunho, a **publicação** respeita a edição: quando o `.draft.md` é mais novo que o raw, ele é promovido a `<data>.md` sem re-renderizar. Para forçar a re-renderização (descartando o rascunho), rode `node src/render.js --area=<area> --force`.
