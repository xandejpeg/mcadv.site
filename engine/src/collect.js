import path from 'node:path';
import { fetchText, mapLimit } from './lib/http.js';
import { parseFeed } from './lib/feed.js';
import { canonicalUrl, resumoCurto, sha1, similarity, limparTituloGN } from './lib/text.js';
import { classificarFonte } from './lib/sources.js';
import {
  loadAreas, loadSources, writeJson, parseArgs, todayBRT, nowBRTISO,
  hostOf, ROOT, AREAS_VALIDAS
} from './lib/util.js';

export function googleNewsUrl(query, dias) {
  const q = dias ? `${query} when:${dias}d` : query;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

/** Monta a lista de feeds da área: Google News (das queries) + fontes validadas. */
export function buildFeedList(area, areaCfg, sources, dias) {
  const feeds = (areaCfg.queries || []).map((q, i) => ({
    id: `google-news:${area}:${i}`,
    tipo: 'agregador',
    peso: 0.4,
    url: googleNewsUrl(q, dias),
    query: q
  }));
  for (const s of sources) {
    if (s.status === 'ok' && (s.area === area || s.area === 'todas')) {
      feeds.push({ id: s.id, tipo: s.tipo, peso: s.peso, url: s.url });
    }
  }
  return feeds;
}

function better(a, b) {
  if (a.peso_fonte !== b.peso_fonte) return a.peso_fonte > b.peso_fonte;
  return new Date(a.data) > new Date(b.data);
}

/** Dedupe por URL canônica e por similaridade de título (>= 0,82), mantendo a fonte de maior peso. */
export function dedupe(items, limiar = 0.82) {
  const byId = new Map();
  for (const it of items) {
    const ex = byId.get(it.id);
    if (!ex || better(it, ex)) byId.set(it.id, it);
  }
  const arr = [...byId.values()].sort((a, b) => new Date(b.data) - new Date(a.data));
  const kept = [];
  for (const it of arr) {
    let dup = false;
    for (const k of kept) {
      if (similarity(it.titulo, k.titulo) >= limiar) {
        dup = true;
        if (better(it, k)) Object.assign(k, it);
        break;
      }
    }
    if (!dup) kept.push(it);
  }
  return kept;
}

export async function collect(area, { dias = 7 } = {}) {
  const areas = loadAreas();
  const cfg = areas.config || {};
  const areaCfg = areas.areas[area];
  if (!areaCfg) throw new Error(`Área desconhecida: ${area}`);

  const sources = (loadSources().fontes || []);
  const feeds = buildFeedList(area, areaCfg, sources, dias);

  const now = new Date();
  const from = new Date(now.getTime() - dias * 86400000);
  const fontes_consultadas = [];
  const collected = [];

  await mapLimit(feeds, cfg.concorrencia || 6, async (f) => {
    try {
      const xml = await fetchText(f.url, { timeout: cfg.timeout_ms || 15000, retries: cfg.retries ?? 2 });
      const items = parseFeed(xml);
      let count = 0;
      for (const it of items) {
        const d = it.pubDate ? new Date(it.pubDate) : null;
        const valida = d && !isNaN(d);
        if (valida && d < from) continue;
        const urlc = canonicalUrl(it.link);
        if (!urlc) continue;
        const host = hostOf(urlc);
        const fonte = it.source || host || 'fonte';
        const cls = classificarFonte(host, fonte, f.peso);
        collected.push({
          id: sha1(urlc),
          titulo: limparTituloGN(it.title, it.source),
          resumo: resumoCurto(it.description, 300),
          fonte,
          tipo_fonte: cls.tipo,
          peso_fonte: cls.peso,
          data: valida ? d.toISOString() : now.toISOString(),
          url: it.link,
          url_canonica: urlc,
          query: f.query || null
        });
        count++;
      }
      fontes_consultadas.push({ id: f.id, url: f.url, status: 'ok', itens: count });
    } catch (err) {
      fontes_consultadas.push({ id: f.id, url: f.url, status: 'erro', erro: String(err?.message || err), itens: 0 });
    }
  });

  const itens = dedupe(collected);
  const hoje = todayBRT(now);
  const periodo_de = todayBRT(from);

  const raw = {
    area,
    gerado_em: nowBRTISO(now),
    periodo_de,
    periodo_ate: hoje,
    dias,
    fontes_consultadas,
    total_coletado: collected.length,
    total_unico: itens.length,
    itens
  };

  const out = path.join(ROOT, 'data', 'raw', area, `${hoje}.json`);
  writeJson(out, raw);
  return { raw, out };
}

async function main() {
  const args = parseArgs();
  const area = args.area;
  const dias = args.dias ? parseInt(args.dias, 10) : 7;
  if (!AREAS_VALIDAS.includes(area)) {
    console.error(`Uso: node src/collect.js --area=<${AREAS_VALIDAS.join('|')}> [--dias=7]`);
    process.exit(1);
  }
  const { raw, out } = await collect(area, { dias });
  const ok = raw.fontes_consultadas.filter((f) => f.status === 'ok').length;
  const falhas = raw.fontes_consultadas.length - ok;
  console.log(`[collect] ${area}: ${raw.total_unico} itens únicos (de ${raw.total_coletado}) · fontes ok ${ok}/${raw.fontes_consultadas.length} (${falhas} falhas)`);
  console.log(`[collect] salvo em ${path.relative(ROOT, out)}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('collect.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
