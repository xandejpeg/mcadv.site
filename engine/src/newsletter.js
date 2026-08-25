import fs from 'node:fs';
import path from 'node:path';
import { loadJson, writeJson, nowBRTISO, todayBRT, dataBR, dataExtenso, ROOT, SITE_BASE, AREAS_VALIDAS } from './lib/util.js';

const NOMES = {
  'tributario-fiscal': 'Tributário & Fiscal',
  'trabalhista': 'Trabalhista',
  'previdenciario': 'Previdenciário'
};

/** Escolhe o relatório mais recente de cada área a partir do feed. */
export function selecionarUltimos(relatorios) {
  const porArea = {};
  for (const r of relatorios) {
    if (!porArea[r.area] || r.data > porArea[r.area].data) porArea[r.area] = r;
  }
  return AREAS_VALIDAS.map((a) => porArea[a]).filter(Boolean);
}

/** Monta o Markdown da newsletter (puro, testável). */
export function buildNewsletterMd({ data, ultimos, manchetes = [], clima = null }) {
  const linhas = [
    '---',
    `titulo: "Boletim Radar MCAP — ${dataExtenso(data)}"`,
    `data: ${data}`,
    'gerado_por: "mcap-radar v1"',
    '---',
    '',
    `# Boletim Radar MCAP`,
    `*${dataExtenso(data)}*`,
    ''
  ];
  if (clima && clima.texto) linhas.push(`> ${clima.texto}`, '');

  linhas.push('## Relatórios da semana', '');
  if (!ultimos.length) linhas.push('_Sem relatórios disponíveis._', '');
  for (const r of ultimos) {
    linhas.push(`- **${NOMES[r.area] || r.area}** — [${r.titulo}](${SITE_BASE}/content/${r.area}/${r.data}.md)${r.itens ? ` · ${r.itens} itens` : ''}`);
  }
  linhas.push('');

  if (manchetes.length) {
    linhas.push('## Manchetes em destaque', '');
    for (const m of manchetes.slice(0, 6)) {
      linhas.push(`- [${m.titulo}](${m.url}) — ${m.fonte}, ${dataBR(m.data)}`);
    }
    linhas.push('');
  }

  linhas.push('---', '*Você recebe este boletim do escritório Moraes de Carvalho Advogados. Resumos com link para a fonte original.*');
  return linhas.join('\n') + '\n';
}

export function newsletter() {
  const feed = loadJson(path.join(ROOT, 'public', 'api', 'feed.json'), { relatorios: [] });
  const ticker = loadJson(path.join(ROOT, 'public', 'api', 'ticker.json'), { manchetes: [], clima: null });
  const data = todayBRT();
  const ultimos = selecionarUltimos(feed.relatorios || []);

  const md = buildNewsletterMd({ data, ultimos, manchetes: ticker.manchetes || [], clima: ticker.clima });
  const outMd = path.join(ROOT, 'content', 'newsletter', `${data}.md`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, md, 'utf8');

  writeJson(path.join(ROOT, 'public', 'api', 'newsletter.json'), {
    gerado_em: nowBRTISO(),
    versao: 1,
    data,
    url_md: `${SITE_BASE}/content/newsletter/${data}.md`,
    relatorios: ultimos.map((r) => ({ area: r.area, titulo: r.titulo, data: r.data, url_md: `${SITE_BASE}/content/${r.area}/${r.data}.md` })),
    clima: ticker.clima || null
  });

  return { data, relatorios: ultimos.length };
}

async function main() {
  const r = newsletter();
  console.log(`[newsletter] boletim ${r.data} com ${r.relatorios} relatórios`);
}

if (process.argv[1]?.endsWith('newsletter.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
