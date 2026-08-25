import path from 'node:path';
import { fetchText, mapLimit } from './lib/http.js';
import { parseFeed } from './lib/feed.js';
import { canonicalUrl, resumoCurto, sha1, similarity, limparTituloGN } from './lib/text.js';
import {
  loadAreas, writeJson, parseArgs, todayBRT, nowBRTISO, ROOT, AREAS_VALIDAS
} from './lib/util.js';

/**
 * Coleta de Diário Oficial da União (opcional, best-effort).
 * A INLABS/DOU não expõe RSS aberto; conforme o briefing (3.4), guardamos apenas
 * ementa + link do ato. Aqui usamos o índice do Google News restrito a in.gov.br
 * (site:in.gov.br) como proxy — sem scraping do jornal — até haver credencial INLABS.
 */
export function buildDouQuery(termo, dias) {
  const base = `site:in.gov.br ${termo}`;
  const q = dias ? `${base} when:${dias}d` : base;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

export async function collectDou(area, { dias = 7 } = {}) {
  const areas = loadAreas();
  const areaCfg = areas.areas[area];
  if (!areaCfg) throw new Error(`Área desconhecida: ${area}`);

  const termos = (areaCfg.queries || []).slice(0, 4);
  const feeds = termos.map((t) => buildDouQuery(t, dias));
  const now = new Date();
  const from = new Date(now.getTime() - dias * 86400000);
  const atos = [];

  await mapLimit(feeds, 4, async (url) => {
    try {
      const items = parseFeed(await fetchText(url, { timeout: 15000, retries: 1 }));
      for (const it of items) {
        const d = it.pubDate ? new Date(it.pubDate) : null;
        if (d && !isNaN(d) && d < from) continue;
        const urlc = canonicalUrl(it.link);
        atos.push({
          id: sha1(urlc),
          ementa: resumoCurto(limparTituloGN(it.title, it.source), 200),
          data: d && !isNaN(d) ? d.toISOString() : now.toISOString(),
          fonte: 'Diário Oficial da União',
          url: it.link,
          url_canonica: urlc
        });
      }
    } catch { /* fonte pode falhar sem derrubar o job */ }
  });

  // Dedupe simples por ementa.
  const unicos = [];
  for (const a of atos) {
    if (!unicos.some((u) => similarity(u.ementa, a.ementa) >= 0.82)) unicos.push(a);
  }

  const hoje = todayBRT(now);
  const doc = { area, gerado_em: nowBRTISO(now), origem: 'dou-proxy:google-news', total: unicos.length, atos: unicos };
  const out = path.join(ROOT, 'data', 'raw', 'dou', area, `${hoje}.json`);
  writeJson(out, doc);
  return { doc, out };
}

async function main() {
  const args = parseArgs();
  const area = args.area;
  const dias = args.dias ? parseInt(args.dias, 10) : 7;
  if (!AREAS_VALIDAS.includes(area)) {
    console.error(`Uso: node src/collect-dou.js --area=<${AREAS_VALIDAS.join('|')}> [--dias=7]`);
    process.exit(1);
  }
  const { doc, out } = await collectDou(area, { dias });
  console.log(`[collect-dou] ${area}: ${doc.total} atos → ${path.relative(ROOT, out)}`);
}

if (process.argv[1]?.endsWith('collect-dou.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
