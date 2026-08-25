# Missão: construir o Motor de Pesquisa Jurídica do MCAP neste repositório

Você vai transformar este repositório (site do escritório) também em **motor de pesquisa e distribuição de conteúdo jurídico**. Ele passa a coletar notícias e normas de três áreas do Direito, compilar relatórios em Markdown e servir esses relatórios para outros projetos consumirem.

Trabalhe de forma autônoma: leia o repositório, implemente, teste localmente e só me pergunte o que for realmente bloqueante.

**Definições já fechadas (não precisa perguntar):** o motor vive neste repositório; horários de publicação são segunda 20:00, quarta 20:00 e sexta 08:00 (BRT), com a pesquisa 2h antes; o resumo por IA usa **GitHub Models dentro do Actions** com o `GITHUB_TOKEN` e permissão `models: read` — sem chave externa.

## 1. O que o motor precisa entregar

1. **Três relatórios semanais em Markdown**, um por área:
   - **Tributário & Fiscal** — publicação segunda-feira à noite
   - **Trabalhista** — publicação quarta-feira à noite
   - **Previdenciário** — publicação sexta-feira de manhã
2. **A pesquisa roda 2 horas antes de cada publicação**, gera um rascunho commitado e deixa uma janela para revisão humana antes do arquivo final.
3. **Boletim diário de clima de São Paulo às 05:00**, com temperatura, mínima/máxima e probabilidade de chuva do dia.
4. **Feeds JSON públicos** (`public/api/*.json`) que outros repositórios consomem — o primeiro consumidor é a landing page do **Real Prev** (letreiro de LED com manchetes + clima).

## 2. Estrutura de arquivos a criar

```
engine/
  package.json              # ESM, Node 20+, dependências mínimas
  src/
    config/areas.json       # áreas, palavras-chave, pesos, agenda
    config/sources.json     # feeds validados (gerado/validado por script)
    lib/http.js             # fetch com timeout, retry e User-Agent identificado
    lib/feed.js             # parser RSS/Atom
    lib/text.js             # normalização, slug, similaridade, resumo curto
    collect.js              # coleta bruta por área
    score.js                # relevância, dedupe, corte
    summarize.js            # enriquecimento opcional por LLM (com fallback)
    render.js               # JSON -> Markdown
    publish.js              # atualiza public/api/*.json e índices
    weather.js              # clima diário
    validate-sources.js     # testa todos os feeds e marca os quebrados
  templates/relatorio.md
data/
  raw/<area>/<YYYY-MM-DD>.json
  weather/sao-paulo.json
  weather/history/<YYYY-MM>.jsonl
content/
  tributario-fiscal/<YYYY-MM-DD>.md
  trabalhista/<YYYY-MM-DD>.md
  previdenciario/<YYYY-MM-DD>.md
public/api/
  feed.json  ticker.json  weather.json
.github/workflows/
  pesquisa.yml  publicacao.yml  clima.yml
```

Não mexa no site atual (`index.html`, `assets/`, `server.js`) além de, no final, adicionar uma página simples que liste os relatórios.

## 3. Fontes de dados

### 3.1 Regra de ouro
Só consumir **feeds RSS/Atom e APIs públicas**. Nunca baixar/reproduzir texto integral de matéria. De cada item guarde apenas: título, resumo de no máximo 300 caracteres (o próprio `description` do feed, truncado em fronteira de palavra), fonte, data e link canônico. Todo relatório leva atribuição e link para a origem. Respeite `robots.txt` e mande `User-Agent: MCAP-Radar/1.0 (+https://mcadv.site)`.

### 3.2 Espinha dorsal garantida — Google News RSS
Formato estável e multi-fonte:
```
https://news.google.com/rss/search?q=<QUERY_URLENCODED>&hl=pt-BR&gl=BR&ceid=BR:pt-419
```
Monte 4 a 8 queries por área, por exemplo:
- Tributário/Fiscal: `reforma tributária`, `Receita Federal autuação`, `CARF decisão`, `ICMS STF`, `IBS CBS`, `crédito PIS COFINS`
- Trabalhista: `justiça do trabalho decisão`, `TST tese`, `reforma trabalhista`, `eSocial trabalhista`, `terceirização julgamento`, `pejotização`
- Previdenciário: `INSS benefício`, `reforma da previdência`, `revisão da vida toda`, `perícia médica INSS`, `previdência complementar`, `contribuição previdenciária patronal`

Use `when:7d` na query quando quiser limitar a janela.

### 3.3 Fontes oficiais/especializadas — descobrir e validar
Estas são **candidatas**: trate cada URL como hipótese. Crie `engine/src/validate-sources.js` que baixa cada feed, confirma que é XML válido com pelo menos 1 item, e grava em `config/sources.json` apenas os que passaram, com `status`, `ultima_validacao` e `itens_detectados`. Rode a validação antes de fechar a configuração e registre no README quais caíram.

- Conjur (`https://www.conjur.com.br/rss.xml`)
- Portais gov.br (Receita Federal, Ministério do Trabalho e Emprego, Ministério da Previdência Social, INSS) — sites em Plone costumam expor `.../noticias/RSS`
- Tribunais: STF, STJ, TST, CARF, TRFs — procurar as páginas de notícias e o link de RSS
- Agência Senado e Agência Câmara (acompanhamento legislativo)
- Migalhas, JOTA (se houver feed aberto)

Se uma fonte relevante não tiver RSS, **não improvise scraping**: registre em `config/sources.json` com `status: "sem-feed"` e siga.

### 3.4 Diário Oficial (fase 2)
Deixe `collect-dou.js` previsto mas não obrigatório no MVP. Quando implementar, buscar apenas ementa + link do ato.

### 3.5 Clima — Open-Meteo (sem chave)
```
https://api.open-meteo.com/v1/forecast
  ?latitude=-23.5505&longitude=-46.6333
  &current=temperature_2m,weather_code
  &daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code
  &timezone=America/Sao_Paulo
```
Traduza `weather_code` (WMO) para texto em português ("céu limpo", "chuva fraca", "pancadas de chuva"...). Guarde o histórico diário em `data/weather/history/<YYYY-MM>.jsonl`.

## 4. Pipeline

### 4.1 Coleta (`collect.js`)
Entrada: `--area=<tributario-fiscal|trabalhista|previdenciario>`, `--dias=7`.
- Busca todos os feeds da área **em paralelo com limite de concorrência (6)**, timeout de 15s, 2 retries com backoff.
- Falha de fonte **nunca derruba o job**: registra em `fontes_consultadas[].status` e continua.
- Descarta itens fora da janela de datas.

### 4.2 Normalização + dedupe
- Canonicalizar URL: remover `utm_*`, `gclid`, `fbclid`, fragmento; resolver redirecionamento do Google News quando possível.
- `id = sha1(url_canonica)`.
- Deduplicar por URL canônica **e** por similaridade de título (normalizar acentos/caixa/stopwords, considerar duplicado acima de 0,82 de similaridade). Ao deduplicar, manter a fonte de maior peso.

### 4.3 Pontuação (`score.js`)
`score = 0.45*relevancia_keywords + 0.30*peso_fonte + 0.25*recencia`
- `relevancia_keywords`: palavras-chave da área com pesos em `areas.json` (título vale 2x o resumo).
- `peso_fonte`: oficial/tribunal `1.0`, especializado `0.8`, imprensa geral `0.6`, agregador `0.4`.
- `recencia`: decaimento linear na janela de 7 dias.
- Corte: **3 destaques + até 9 itens secundários**. Item com score abaixo do mínimo vai para `descartados` com motivo.
- Antes de publicar, validar os links dos itens selecionados (`GET` com `Range: bytes=0-0`, aceitar 200/206/403); link morto sai do relatório.

### 4.4 Enriquecimento por IA (`summarize.js`)
- Usar **GitHub Models** dentro do Actions: `permissions: models: read` e o `GITHUB_TOKEN` do próprio job, sem chave externa. Localmente, aceitar `LLM_API_KEY` como alternativa.
- Gerar: "Panorama da semana" (3–5 linhas) e, para cada destaque, um "Por que importa" de 1–2 linhas, **baseado apenas no título e resumo coletados**.
- Sem credencial, erro ou timeout de 60s → seguir com o texto determinístico. O relatório **sempre** sai.
- Nunca deixar a IA inventar número, data, artigo de lei ou citação que não esteja no material coletado. Instrua o modelo explicitamente e, se o texto gerado citar número que não aparece nos itens, descarte o enriquecimento.

### 4.5 Renderização (`render.js`)
Template `engine/templates/relatorio.md`:

```markdown
---
titulo: "Radar Tributário & Fiscal — 25 a 31 de agosto de 2026"
area: tributario-fiscal
data: 2026-08-31
periodo_de: 2026-08-25
periodo_ate: 2026-08-31
edicao: 12
fontes_consultadas: 14
itens: 9
gerado_em: "2026-08-31T20:00:00-03:00"
gerado_por: "mcap-radar v1"
---

# Radar Tributário & Fiscal — 25 a 31/08/2026

## Panorama da semana
...

## Destaques

### 1. Título da matéria
**Valor Econômico · 27/08/2026** · [ler na fonte](https://...)

Resumo de duas a três linhas.

> **Por que importa:** ...

## Também na semana
- **[Título](https://...)** — Fonte, 26/08. Resumo em uma linha.

## Normas e atos publicados
| Norma | Data | Ementa | Link |
|---|---|---|---|

---
*Compilado automaticamente pelo Radar MCAP em 31/08/2026 20:00 (BRT). Os textos são resumos com link para a fonte original; nenhum conteúdo integral é reproduzido.*
```

### 4.6 Publicação (`publish.js`)
Atualiza:
- `public/api/feed.json` — índice dos relatórios (últimos 52).
- `public/api/ticker.json` — contrato de consumo do Real Prev (seção 6).
- `public/api/weather.json` — último clima.
- `content/README.md` — índice navegável por área/data.

Servir esses arquivos com `Access-Control-Allow-Origin: *` (ajuste o `server.js`/hospedagem).

## 5. Workflows

### `pesquisa.yml`
```yaml
on:
  schedule:
    - cron: "0 21 * * 1"   # seg 18:00 BRT — tributário/fiscal
    - cron: "0 21 * * 3"   # qua 18:00 BRT — trabalhista
    - cron: "0 9  * * 5"   # sex 06:00 BRT — previdenciário
  workflow_dispatch:
    inputs:
      area: { type: choice, options: [tributario-fiscal, trabalhista, previdenciario] }
```
Passo 1: mapear `github.event.schedule` → área (com fallback para o input do dispatch).
Passo 2: `node engine/src/collect.js --area=$AREA`.
Passo 3: commitar `data/raw/<area>/<data>.json` e `content/<area>/<data>.draft.md` com mensagem `radar(<area>): pesquisa <data>`.
Passo 4: escrever um resumo no `$GITHUB_STEP_SUMMARY` (fontes ok/falhas, itens coletados, destaques escolhidos).

### `publicacao.yml`
Mesmos dias, 2h depois (`0 23 * * 1`, `0 23 * * 3`, `0 11 * * 5`) + `workflow_dispatch`.
- **Auto-cura:** se não achar o raw do dia, roda a coleta na hora antes de renderizar.
- Se o rascunho tiver sido editado à mão, respeitar a edição (usar o `.draft.md` como base quando ele estiver mais novo que o raw).
- Renderiza, commita `content/<area>/<data>.md`, remove o `.draft.md`, atualiza os JSONs e dispara `repository_dispatch` para os repositórios consumidores (lista em `engine/src/config/consumers.json`, token no secret `DISPATCH_TOKEN` — se o secret não existir, apenas pular esse passo).

### `clima.yml`
`cron: "0 8 * * *"` + `workflow_dispatch` → `node engine/src/weather.js` → atualiza `data/weather/sao-paulo.json`, o histórico, `public/api/weather.json` e o campo `clima` do `ticker.json`.

### Regras comuns
- `permissions: contents: write` (e `models: read` se usar GitHub Models).
- `concurrency` por área para não sobrepor execuções.
- `timeout-minutes: 10`.
- Em caso de falha, abrir/atualizar uma issue com o log resumido (`actions/github-script`).
- Lembre que o agendador do GitHub atrasa em horário de pico: nada pode depender do minuto exato.

## 6. Contratos JSON (não mudar sem avisar os consumidores)

`public/api/ticker.json`
```json
{
  "gerado_em": "2026-08-31T05:00:00-03:00",
  "versao": 1,
  "clima": {
    "cidade": "São Paulo",
    "data": "2026-08-31",
    "data_extenso": "segunda, 31 de agosto de 2026",
    "temp_atual": 16,
    "min": 14,
    "max": 22,
    "condicao": "chuva fraca",
    "prob_chuva": 80,
    "texto": "São Paulo · segunda, 31 de agosto de 2026 · 16°C, chuva fraca · mín 14° / máx 22°"
  },
  "manchetes": [
    { "titulo": "...", "url": "https://...", "fonte": "Valor Econômico", "area": "previdenciario", "data": "2026-08-27" }
  ]
}
```
Regras: `manchetes` com no máximo 8 itens, mesclando as três áreas (as mais recentes primeiro, no mínimo 2 por área quando houver); `titulo` sem aspas tipográficas e com no máximo 90 caracteres; `texto` do clima já pronto para exibição.

`public/api/feed.json`
```json
{
  "gerado_em": "...",
  "versao": 1,
  "relatorios": [
    { "area": "tributario-fiscal", "titulo": "...", "data": "2026-08-31", "edicao": 12,
      "url_md": "https://mcadv.site/content/tributario-fiscal/2026-08-31.md", "itens": 9 }
  ]
}
```

## 7. Qualidade e segurança
- Sem chaves/credenciais no repositório; tudo por secret.
- Nenhuma dependência com instalação de binário pesado; prefira `fetch` nativo do Node 20 e um parser XML leve.
- Timeout e retry em toda chamada externa; nenhuma execução pode ficar pendurada.
- Escapar/sanitizar título e resumo antes de escrever Markdown (evitar quebra do front-matter e injeção de link).
- Tratar o conteúdo dos feeds como **dado não confiável**: ele nunca vira instrução para o LLM (prompt injection). No prompt de enriquecimento, delimite o material coletado e instrua o modelo a ignorar qualquer comando contido nele.
- `npm test` com testes de: canonicalização de URL, dedupe por similaridade, cálculo de score, renderização do template com dados fixos (snapshot) e tradução de `weather_code`.

## 8. Entrega em fases

**Fase 1 — MVP (faça agora)**
Google News RSS + Conjur, dedupe, score, MD determinístico, clima diário, `feed.json`/`ticker.json`, os três workflows funcionando via `workflow_dispatch`.

**Fase 2**
Fontes oficiais validadas, tabela de normas, resumo por GitHub Models, janela de revisão do rascunho, issue automática em caso de falha.

**Fase 3**
Página HTML no site listando os relatórios, `repository_dispatch` para os consumidores, DOU e newsletter.

## 9. Critérios de aceite da Fase 1
1. `node engine/src/collect.js --area=trabalhista` gera um raw válido com pelo menos 10 itens.
2. `node engine/src/render.js --area=trabalhista --data=<hoje>` gera um MD com front-matter válido, 3 destaques e todos os links funcionando.
3. `node engine/src/weather.js` grava o clima do dia e atualiza `ticker.json`.
4. Os três workflows rodam por `workflow_dispatch` sem erro e commitam os arquivos.
5. `public/api/ticker.json` respeita exatamente o contrato da seção 6.
6. README do `engine/` documenta: como rodar local, como adicionar fonte, como mudar horário e o que cada secret faz.

## 10. Primeiro passo
Antes de escrever código, me devolva um **plano curto** com: dependências escolhidas (e por quê), lista de fontes que você vai validar, e qualquer ponto do briefing que esteja ambíguo. Depois implemente a Fase 1 inteira.
