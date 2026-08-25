import fs from 'node:fs';
import path from 'node:path';
import { rankAndSelect } from './score.js';
import { tituloTicker } from './lib/text.js';
import {
  loadAreas, loadJson, writeJson, nowBRTISO, dataBR, ROOT, SITE_BASE, AREAS_VALIDAS
} from './lib/util.js';

/** Parser minimalista do front-matter YAML gerado por este motor. */
export function parseFrontMatter(md) {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) return {};
  const obj = {};
  for (const line of m[1].split('\n')) {
    const mm = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!mm) continue;
    let v = mm[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
    obj[mm[1]] = v;
  }
  return obj;
}

function listarRelatorios() {
  const rel = [];
  for (const area of AREAS_VALIDAS) {
    const dir = path.join(ROOT, 'content', area);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)); } catch { continue; }
    for (const f of files) {
      const fm = parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
      const data = fm.data || f.slice(0, 10);
      rel.push({
        area,
        titulo: fm.titulo || `${area} ${data}`,
        data,
        edicao: fm.edicao ? Number(fm.edicao) : null,
        url_md: `${SITE_BASE}/content/${area}/${f}`,
        itens: fm.itens ? Number(fm.itens) : null
      });
    }
  }
  rel.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return rel;
}

function ultimoRaw(area) {
  const dir = path.join(ROOT, 'data', 'raw', area);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); } catch { return null; }
  if (!files.length) return null;
  return loadJson(path.join(dir, files[files.length - 1]), null);
}

/** Manchetes do ticker: mescla as três áreas, no mínimo 2 por área quando houver, máx 8, recentes primeiro. */
export function montarManchetes(areas) {
  const porArea = {};
  for (const area of AREAS_VALIDAS) {
    const raw = ultimoRaw(area);
    if (!raw) { porArea[area] = []; continue; }
    const { destaques, secundarios } = rankAndSelect(raw.itens, areas.areas[area], new Date(), {
      janelaDias: areas.config?.janela_dias || 7,
      scoreMin: areas.config?.score_minimo ?? 0.15
    });
    porArea[area] = [...destaques, ...secundarios].map((it) => ({
      titulo: tituloTicker(it.titulo, 90),
      url: it.url_canonica,
      fonte: it.fonte,
      area,
      data: String(it.data).slice(0, 10)
    }));
  }

  const escolhidas = [];
  // Garante no mínimo 2 por área quando houver.
  for (const area of AREAS_VALIDAS) escolhidas.push(...porArea[area].slice(0, 2));
  // Completa até 8 com os demais, sem repetir URL.
  const usados = new Set(escolhidas.map((m) => m.url));
  const resto = AREAS_VALIDAS.flatMap((a) => porArea[a].slice(2)).filter((m) => !usados.has(m.url));
  resto.sort((a, b) => (a.data < b.data ? 1 : -1));
  for (const m of resto) { if (escolhidas.length >= 8) break; escolhidas.push(m); }

  return escolhidas.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)).slice(0, 8);
}

function gerarReadmeConteudo(relatorios) {
  const linhas = ['# Conteúdo — Radar MCAP', '', 'Índice dos relatórios gerados automaticamente. Cada arquivo é um resumo com links para as fontes originais.', ''];
  for (const area of AREAS_VALIDAS) {
    const doArea = relatorios.filter((r) => r.area === area);
    linhas.push(`## ${area}`, '');
    if (!doArea.length) { linhas.push('_Sem relatórios ainda._', ''); continue; }
    for (const r of doArea) {
      linhas.push(`- **${dataBR(r.data)}** — [${r.titulo}](${area}/${r.data}.md)${r.itens ? ` · ${r.itens} itens` : ''}`);
    }
    linhas.push('');
  }
  return linhas.join('\n');
}

export function publish() {
  const areas = loadAreas();
  const relatorios = listarRelatorios();

  writeJson(path.join(ROOT, 'public', 'api', 'feed.json'), {
    gerado_em: nowBRTISO(),
    versao: 1,
    relatorios: relatorios.slice(0, 52)
  });

  const tickerPath = path.join(ROOT, 'public', 'api', 'ticker.json');
  const ticker = loadJson(tickerPath, { versao: 1 });
  ticker.versao = 1;
  ticker.gerado_em = nowBRTISO();
  ticker.clima = ticker.clima || null;
  ticker.manchetes = montarManchetes(areas);
  writeJson(tickerPath, ticker);

  fs.mkdirSync(path.join(ROOT, 'content'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'content', 'README.md'), gerarReadmeConteudo(relatorios) + '\n', 'utf8');

  return { relatorios: relatorios.length, manchetes: ticker.manchetes.length };
}

async function main() {
  const r = publish();
  console.log(`[publish] feed.json: ${r.relatorios} relatórios · ticker.json: ${r.manchetes} manchetes`);
}

if (process.argv[1]?.endsWith('publish.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
