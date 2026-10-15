# Missão: construir o Motor de Pesquisa Jurídica do MCAP e a Central que o comanda

## 0. Ponto de partida — o login já existe

O site https://mdcadvocacia.com **já tem uma área de login pronta e funcionando**, hoje em `admin/login.html`, `admin/painel.html` e `admin/assets/auth.js`. Essa tela de entrada é o ponto de partida desta missão: ela deixa de levar a uma página vazia "em construção" e passa a levar a uma **Central de Conteúdo** — a interface de onde tudo que este briefing descreve é operado.

Duas exigências sobre essa área, antes de qualquer outra coisa:

1. **Renomeie tudo para "Central".** A palavra "admin" / "administrador" / "área administrativa" não pode aparecer em rota, nome de pasta, título, texto de tela, chave de sessão ou cookie. Mova `admin/` para `central/`, com `central/entrar.html` e `central/index.html`, servida em `/central`. Mantenha `noindex, nofollow` e deixe um redirecionamento de `/admin/*` para `/central` só para não quebrar link salvo.
2. **A autenticação atual é insegura e precisa ser refeita.** Hoje `auth.js` carrega usuário e senha em texto puro no JavaScript do navegador e guarda a sessão em `sessionStorage` — qualquer visitante lê as credenciais no código-fonte. Como a Central vai passar a disparar coletas, gravar arquivos e publicar conteúdo, isso vira uma porta aberta. Substitua por autenticação **no servidor** (seção 5.2) e **apague as credenciais do código do cliente**.

O resto do briefing descreve o motor que a Central comanda.

Você vai transformar este repositório (site do escritório) também em **motor de pesquisa e distribuição de conteúdo jurídico**. Ele passa a coletar notícias e normas de três áreas do Direito, compilar relatórios em Markdown e servir esses relatórios para outros projetos consumirem — tudo operável pela Central, sem ninguém precisar abrir o GitHub ou o terminal.

Trabalhe de forma autônoma: leia o repositório, implemente, teste localmente e só me pergunte o que for realmente bloqueante.

**Definições já fechadas (não precisa perguntar):** o motor vive neste repositório; horários de publicação são segunda 20:00, quarta 20:00 e sexta 08:00 (BRT), com a pesquisa 2h antes; o resumo por IA usa **GitHub Models dentro do Actions** com o `GITHUB_TOKEN` e permissão `models: read` — sem chave externa; o painel se chama **Central** e fica em `/central`.

## 1. O que o motor precisa entregar

1. **Três relatórios semanais em Markdown**, um por área:
   - **Tributário & Fiscal** — publicação segunda-feira à noite
   - **Trabalhista** — publicação quarta-feira à noite
   - **Previdenciário** — publicação sexta-feira de manhã
2. **A pesquisa roda 2 horas antes de cada publicação**, gera um rascunho commitado e deixa uma janela para revisão humana antes do arquivo final.
3. **Boletim diário de clima de São Paulo às 05:00**, com temperatura, mínima/máxima e probabilidade de chuva do dia.
4. **Feeds JSON públicos** (`public/api/*.json`) que outros repositórios consomem — o primeiro consumidor é a landing page do **Real Prev** (letreiro de LED com manchetes + clima).
5. **A Central (`/central`)**, atrás do login, controlando os três itens acima: gerar e revisar os Markdown, ver e curar os dados capturados das matérias, e consultar/recapturar o clima por data (seção 5).

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
    jobs.js                 # fila/execução dos comandos vindos da Central
  templates/relatorio.md
central/                    # ex-admin/, servido em /central
  entrar.html               # ex-login.html, agora postando para o servidor
  index.html                # a Central em si
  assets/central.css
  assets/central.js         # fetch para /api/central/*, zero credencial no cliente
server/
  auth.js                   # sessão assinada, hash de senha, rate limit, CSRF
  routes-central.js         # API protegida da Central
  runner.js                 # execFile dos scripts do engine, com log
data/
  raw/<area>/<YYYY-MM-DD>.json
  weather/sao-paulo.json
  weather/history/<YYYY-MM>.jsonl
  jobs/<YYYY-MM-DD>.jsonl   # histórico de execuções disparadas pela Central
content/
  tributario-fiscal/<YYYY-MM-DD>.md
  trabalhista/<YYYY-MM-DD>.md
  previdenciario/<YYYY-MM-DD>.md
public/api/
  feed.json  ticker.json  weather.json
.github/workflows/
  pesquisa.yml  publicacao.yml  clima.yml
```

Não mexa no site público atual (`index.html`, `assets/`, a landing) além de, no final, adicionar uma página simples que liste os relatórios. O `server.js` **vai** ser alterado: ele passa a montar as rotas de sessão e da API da Central.

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
- `public/api/ticker.json` — contrato de consumo do Real Prev (seção 7).
- `public/api/weather.json` — último clima.
- `content/README.md` — índice navegável por área/data.

Servir esses arquivos com `Access-Control-Allow-Origin: *` (ajuste o `server.js`/hospedagem).

## 5. A Central (`/central`) — o painel que comanda tudo

O cron é o piloto automático; a Central é o volante. Tudo que os workflows fazem sozinhos precisa poder ser visto, corrigido e refeito por ali, sem GitHub e sem terminal.

### 5.1 Rota e renomeação
- `admin/` → `central/`; `login.html` → `entrar.html`; `painel.html` → `index.html`.
- Servida em `/central` (e `/central/entrar`). `/admin` e `/admin/*` respondem com redirect 301 para `/central`.
- Nenhuma ocorrência de "admin"/"administrador" em rota, arquivo, título, texto visível, cookie ou chave de storage. O cabeçalho passa a ser **"Central MCADV" / "Conteúdo e Pesquisa"**.
- Mantém `<meta name="robots" content="noindex, nofollow">` e entra no `robots.txt` como `Disallow: /central`.
- Preserve a identidade visual já existente do painel (fundo escuro, dourado `#c9a96e`, Cormorant Garamond + Inter + JetBrains Mono).

### 5.2 Autenticação — refazer no servidor (obrigatório)
O `auth.js` atual compara usuário e senha dentro do navegador e guarda a sessão em `sessionStorage`. Qualquer pessoa abre o *view-source* e entra. Como a Central agora escreve arquivos e publica conteúdo, isso é inaceitável. Faça assim:

- `POST /api/central/sessao` recebe usuário e senha, compara com `CENTRAL_USER` e `CENTRAL_PASS_HASH` (hash **scrypt** ou **argon2**, nunca a senha em texto) lidos de variável de ambiente / `.env` fora do Git.
- Sessão em **cookie assinado** `HttpOnly`, `Secure`, `SameSite=Lax`, expiração de 8h e renovação por atividade. Nada de token em `localStorage`.
- Comparação de senha em tempo constante; resposta genérica ("usuário ou senha inválidos") sem revelar qual campo falhou.
- **Rate limit** no login: máximo 5 tentativas por IP a cada 15 minutos, com atraso progressivo.
- Middleware `exigirSessao` protegendo **todas** as rotas `/api/central/*` e a entrega do `central/index.html`; sem sessão, redirect para `/central/entrar`.
- **CSRF**: token por sessão, exigido em todo `POST`/`DELETE`.
- `DELETE /api/central/sessao` para sair, limpando o cookie.
- Apague `admin/assets/auth.js` e qualquer credencial do lado do cliente. Documente no README como gerar o hash da senha (`node server/auth.js --hash`).
- Se a Central e o site rodarem atrás de proxy, ligue `app.set('trust proxy', 1)` para o rate limit enxergar o IP real.

### 5.3 API da Central
Todas protegidas por sessão. Validar **sempre** `area` contra a lista fixa (`tributario-fiscal|trabalhista|previdenciario`) e `data` contra `^\d{4}-\d{2}-\d{2}$` antes de tocar em qualquer caminho de arquivo — nunca concatene entrada do usuário em path (path traversal). Executar os scripts com `execFile` e argumentos em array, **nunca** `exec` com string montada (command injection).

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/central/estado` | Visão geral: última coleta e última publicação por área, próximo cron, clima do dia, saúde das fontes |
| `POST` | `/api/central/pesquisa` | Dispara a coleta (`area`, `dias`) e devolve o `job_id` |
| `GET` | `/api/central/raw/:area/:data` | Itens capturados: título, resumo, fonte, data, link, score, selecionado/descartado |
| `PATCH` | `/api/central/raw/:area/:data` | Curadoria: incluir/excluir item, promover a destaque, reordenar, corrigir título ou resumo |
| `POST` | `/api/central/gerar-md` | Renderiza o Markdown a partir do raw curado (gera `.draft.md`) |
| `GET` | `/api/central/md/:area/:data` | Devolve o Markdown (rascunho ou publicado) para edição |
| `PUT` | `/api/central/md/:area/:data` | Salva a edição manual do Markdown |
| `POST` | `/api/central/publicar` | Promove o rascunho a publicado e atualiza `feed.json`/`ticker.json` |
| `GET` | `/api/central/clima?de=&ate=` | Histórico de clima por intervalo de datas |
| `POST` | `/api/central/clima/capturar` | Captura/recaptura o clima de uma data (`data`, opcional) |
| `PATCH` | `/api/central/clima/:data` | Correção manual de um registro de clima |
| `GET` | `/api/central/fontes` | Lista de fontes com status da última validação |
| `POST` | `/api/central/fontes/validar` | Roda `validate-sources.js` |
| `GET` | `/api/central/jobs` | Últimas 50 execuções, com status, duração e log resumido |
| `GET` | `/api/central/jobs/:id/log` | Log de uma execução (SSE ou polling) |

Execuções são assíncronas: a rota devolve `202` com `job_id` e a tela acompanha o progresso. Grave cada execução em `data/jobs/<data>.jsonl` com quem disparou, quando, parâmetros, código de saída e log truncado. Só um job por área ao mesmo tempo.

### 5.4 Telas

**Início** — cartão por área (Tributário/Fiscal, Trabalhista, Previdenciário) mostrando: data da última coleta, quantos itens, se há rascunho pendente, se já foi publicado, quando é o próximo cron. Botões `Pesquisar agora`, `Gerar MD`, `Publicar`. Um cartão de clima com o dado de hoje e botão `Recapturar`. Faixa de alertas quando alguma fonte falhou ou algum job quebrou.

**Matérias capturadas** — escolhe área + data e lista os itens do raw em tabela: seleção, título (editável), fonte, data, score, link (abre em nova aba). Permite marcar os 3 destaques, excluir item irrelevante, reordenar e salvar a curadoria. Mostra também os `descartados` com o motivo, para poder resgatar. Cada alteração é gravada no raw como `curadoria_manual: true`, e a re-renderização **respeita** a curadoria.

**Relatórios (MD)** — lista os arquivos de `content/` por área e data, com badge `rascunho`/`publicado`. Abre um editor de texto simples (textarea com fonte monoespaçada) com pré-visualização, botões `Salvar`, `Gerar de novo a partir do raw` e `Publicar`. Ao publicar, mostra o diff do que muda em `ticker.json`.

**Clima** — calendário/tabela por data com temperatura, mínima, máxima, condição e probabilidade de chuva. Filtro por intervalo, botão de recapturar uma data específica, edição manual de um registro e destaque visual para dias sem captura (falha do cron).

**Fontes** — tabela de `sources.json` com URL, área, peso, status da última validação, itens detectados e data. Botão `Validar todas`. Permite adicionar/remover fonte e ajustar peso e palavras-chave da área.

**Execuções** — histórico de jobs com filtro por área e status, e o log de cada um.

Sem framework: HTML + CSS + JS puro, no mesmo estilo do painel atual. Tudo em português, responsivo o suficiente para funcionar no celular.

### 5.5 Central × workflows
As duas pontas mexem nos mesmos arquivos, então:
- Os scripts do `engine/` são a **única** implementação; a Central e os workflows apenas os chamam. Nada de lógica duplicada dentro da API.
- Quando o servidor tem permissão de escrita no repositório, a Central commita e faz push com mensagem `radar(<area>): <acao> via central`. Sem isso, ela grava em disco e mostra um aviso de que a alteração não foi versionada.
- Rascunho editado na Central não pode ser sobrescrito por cron: o `publicacao.yml` já respeita o `.draft.md` mais novo que o raw — mantenha essa regra.
- Toda ação da Central aparece em `GET /api/central/jobs`, inclusive as originadas de cron (o workflow anexa o resultado ao mesmo `jobs.jsonl`).

## 6. Workflows

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

## 7. Contratos JSON (não mudar sem avisar os consumidores)

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

## 8. Qualidade e segurança
- Sem chaves/credenciais no repositório; tudo por secret ou variável de ambiente. O `.env` da Central entra no `.gitignore`.
- Nenhuma dependência com instalação de binário pesado; prefira `fetch` nativo do Node 20 e um parser XML leve.
- Timeout e retry em toda chamada externa; nenhuma execução pode ficar pendurada.
- Escapar/sanitizar título e resumo antes de escrever Markdown (evitar quebra do front-matter e injeção de link).
- Tratar o conteúdo dos feeds como **dado não confiável**: ele nunca vira instrução para o LLM (prompt injection). No prompt de enriquecimento, delimite o material coletado e instrua o modelo a ignorar qualquer comando contido nele.
- **Na Central:** nenhuma rota de escrita sem sessão + CSRF; `area` e `data` validadas por lista fixa/regex antes de virar caminho de arquivo; `execFile` com array de argumentos, nunca `exec` com string; o conteúdo editado no textarea nunca é injetado como HTML na pré-visualização sem sanitização (XSS); resposta das APIs com `Cache-Control: no-store`.
- `npm test` com testes de: canonicalização de URL, dedupe por similaridade, cálculo de score, renderização do template com dados fixos (snapshot), tradução de `weather_code`, validação de `area`/`data` e bloqueio das rotas da Central sem sessão.

## 9. Entrega em fases

**Fase 1 — MVP (faça agora)**
Renomeação `admin/` → `central/` com login server-side; Google News RSS + Conjur, dedupe, score, MD determinístico, clima diário, `feed.json`/`ticker.json`; os três workflows funcionando via `workflow_dispatch`; Central com as telas de Início, Matérias capturadas, Relatórios e Clima operando o motor de ponta a ponta.

**Fase 2**
Fontes oficiais validadas, tabela de normas, resumo por GitHub Models, janela de revisão do rascunho, issue automática em caso de falha, telas de Fontes e Execuções na Central, commit/push automático a partir da Central.

**Fase 3**
Página HTML no site listando os relatórios, `repository_dispatch` para os consumidores, DOU e newsletter.

## 10. Critérios de aceite da Fase 1
1. `node engine/src/collect.js --area=trabalhista` gera um raw válido com pelo menos 10 itens.
2. `node engine/src/render.js --area=trabalhista --data=<hoje>` gera um MD com front-matter válido, 3 destaques e todos os links funcionando.
3. `node engine/src/weather.js` grava o clima do dia e atualiza `ticker.json`.
4. Os três workflows rodam por `workflow_dispatch` sem erro e commitam os arquivos.
5. `public/api/ticker.json` respeita exatamente o contrato da seção 7.
6. `/central` exige login; `/api/central/*` sem sessão responde `401`; nenhuma credencial aparece no código entregue ao navegador; `/admin` redireciona para `/central`; a palavra "admin"/"administrador" não aparece em nenhuma rota ou texto de tela.
7. Pela Central é possível, sem tocar em terminal: disparar uma pesquisa, ver as matérias capturadas, tirar um item e promover outro a destaque, gerar o MD, editar o texto, publicar e ver o `ticker.json` atualizado.
8. Pela Central é possível consultar o clima por data, ver um dia sem captura e recapturar aquela data específica.
9. README do `engine/` documenta: como rodar local, como adicionar fonte, como mudar horário, o que cada secret faz e como gerar/trocar a senha da Central.

## 11. Primeiro passo
Antes de escrever código, me devolva um **plano curto** com: dependências escolhidas (e por quê), como vai fazer a sessão server-side da Central, lista de fontes que você vai validar, e qualquer ponto do briefing que esteja ambíguo. Depois implemente a Fase 1 inteira, começando pela Central e pelo login.
