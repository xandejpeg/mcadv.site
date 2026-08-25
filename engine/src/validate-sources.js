import path from 'node:path';
import { fetchText, mapLimit } from './lib/http.js';
import { parseFeed } from './lib/feed.js';
import { writeJson, nowBRTISO, CONFIG_DIR, ROOT } from './lib/util.js';

/**
 * Candidatas a fonte. Cada URL é uma HIPÓTESE: só entra em sources.json se responder
 * com XML válido e ao menos 1 item. As que falharem ficam registradas com o status.
 * tipo → peso: oficial/tribunal 1.0, especializado 0.8, imprensa 0.6, agregador 0.4.
 */
const CANDIDATAS = [
  { id: 'conjur', area: 'todas', tipo: 'especializado', peso: 0.8, url: 'https://www.conjur.com.br/rss.xml' },
  { id: 'stf-noticias', area: 'todas', tipo: 'tribunal', peso: 1.0, url: 'https://portal.stf.jus.br/RSS/feed.asp?tipo=noticiaSTF' },
  { id: 'stj-noticias', area: 'todas', tipo: 'tribunal', peso: 1.0, url: 'https://www.stj.jus.br/sites/portalp/SiteAssets/rss/noticias.xml' },
  { id: 'tst-noticias', area: 'trabalhista', tipo: 'tribunal', peso: 1.0, url: 'https://www.tst.jus.br/-/rss/noticias' },
  { id: 'receita-federal', area: 'tributario-fiscal', tipo: 'oficial', peso: 1.0, url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/RSS' },
  { id: 'mte-noticias', area: 'trabalhista', tipo: 'oficial', peso: 1.0, url: 'https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/RSS' },
  { id: 'mps-noticias', area: 'previdenciario', tipo: 'oficial', peso: 1.0, url: 'https://www.gov.br/previdencia/pt-br/noticias-e-conteudo/RSS' },
  { id: 'inss-noticias', area: 'previdenciario', tipo: 'oficial', peso: 1.0, url: 'https://www.gov.br/inss/pt-br/noticias/RSS' },
  { id: 'agencia-senado', area: 'todas', tipo: 'oficial', peso: 0.9, url: 'https://www12.senado.leg.br/noticias/feed/ultimasnoticias/rss.xml' },
  { id: 'agencia-camara', area: 'todas', tipo: 'oficial', peso: 0.9, url: 'https://www.camara.leg.br/noticias/rss/ultimas' }
];

export async function validate(candidatas = CANDIDATAS) {
  const resultados = await mapLimit(candidatas, 6, async (c) => {
    try {
      const xml = await fetchText(c.url, { timeout: 15000, retries: 1 });
      const items = parseFeed(xml);
      if (items.length >= 1) {
        return { ...c, status: 'ok', itens_detectados: items.length, ultima_validacao: nowBRTISO() };
      }
      return { ...c, status: 'sem-feed', itens_detectados: 0, ultima_validacao: nowBRTISO() };
    } catch (err) {
      return { ...c, status: 'erro', erro: String(err?.message || err), itens_detectados: 0, ultima_validacao: nowBRTISO() };
    }
  });

  const doc = { gerado_em: nowBRTISO(), fontes: resultados };
  writeJson(path.join(CONFIG_DIR, 'sources.json'), doc);
  return doc;
}

async function main() {
  const doc = await validate();
  const ok = doc.fontes.filter((f) => f.status === 'ok');
  console.log(`[validate-sources] ${ok.length}/${doc.fontes.length} fontes OK`);
  for (const f of doc.fontes) {
    const tag = f.status === 'ok' ? `ok (${f.itens_detectados})` : f.status;
    console.log(`  - ${f.id}: ${tag}`);
  }
  console.log(`[validate-sources] gravado em ${path.relative(ROOT, path.join(CONFIG_DIR, 'sources.json'))}`);
}

if (process.argv[1]?.endsWith('validate-sources.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
