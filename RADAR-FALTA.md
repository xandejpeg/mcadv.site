# Radar MCAP — o que falta para 100%

Legenda: 🔴 bloqueante · 🟡 qualidade · ⚪ opcional/depois · ✅ feito/validado

## ✅ Validado agora (rodei no GitHub Actions)
- [x] Workflow **Clima** roda e commita (11s).
- [x] Workflow **Publicação** roda end-to-end e commita (13s): coleta auto-cura → render → publish → newsletter.
- [x] Permissões do Actions (`contents: write`) funcionando — bot commita e dá push.
- [x] VPS serve tudo no ar com CORS `*` (`feed.json`, `content/*.md`, `radar.html` → 200).

## 🔴 Falta você fazer (não tenho acesso)
- [ ] Rodar **Pesquisa** agendada de verdade e confirmar os 3 crons na 1ª semana (só valida no horário).
- [ ] Confirmar que o **VPS puxa** os commits do bot automaticamente (ou configurar o pull/restart).

## 🟡 Qualidade
- [ ] **Resumo por IA**: o GitHub Models foi **descontinuado** (retornou `HTTP 410 retirement brownout`). Já deixei o motor **agnóstico**: basta criar os secrets `LLM_API_KEY` + `LLM_BASE_URL` (ex.: `https://api.openai.com/v1`) + `LLM_MODEL`. Sem isso, roda no texto determinístico (relatório sempre sai).
- [ ] **Fontes oficiais**: hoje Receita Federal + JOTA validados; resto bloqueia bot/HTML. Google News cobre o resto via peso por fonte.
- [ ] **Links do Google News**: continuam como redirect (não dá pra resolver a URL final de forma confiável — Google removeu o método).

## ⚪ Opcional / fases seguintes
- [ ] **`DISPATCH_TOKEN`** (secret) + preencher `consumers.json` → notificar o Real Prev.
- [ ] **DOU real (INLABS)**: hoje é proxy `site:in.gov.br`; integrar API oficial (precisa credencial).
- [ ] **Newsletter**: gera o digest; falta **provedor de envio** de e-mail.
- [ ] Bump das actions para Node 24 (só um warning de deprecação, não quebra).

## Resumo
O produto de coleta está **funcionando de ponta a ponta e no ar**. Para "100% autônomo" faltam só: (1) você confirmar o pull automático no VPS e os horários, e (2) opcionalmente plugar uma `LLM_API_KEY` para o resumo por IA.
