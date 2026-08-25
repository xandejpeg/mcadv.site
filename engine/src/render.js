import fs from 'node:fs';
import path from 'node:path';
import { checkLink, mapLimit } from './lib/http.js';
import { mdEscape, yamlString, stripSmartQuotes } from './lib/text.js';
import { rankAndSelect } from './score.js';
import { enrich } from './summarize.js';
import { extrairNormas } from './lib/normas.js';
import {
  loadAreas, loadJson, parseArgs, todayBRT, nowBRTISO, dataBR, periodoCurto, dataExtenso,
  ROOT, AREAS_VALIDAS
} from './lib/util.js';

const TEMPLATE = fs.readFileSync(path.join(ROOT, 'engine', 'templates', 'relatorio.md'), 'utf8').replace(/\r\n/g, '\n');

function blocoDestaque(d, i, porque) {
  const linhas = [
    `### ${i + 1}. ${mdEscape(d.titulo)}`,
    `**${mdEscape(d.fonte)} · ${dataBR(d.data)}** · [ler na fonte](${d.url_canonica})`,
    '',
    stripSmartQuotes(d.resumo) || '_Resumo não disponível na fonte._'
  ];
  const pq = porque[d.id];
  if (pq) { linhas.push('', `> **Por que importa:** ${stripSmartQuotes(pq)}`); }
  return linhas.join('\n');
}

function blocoSecundario(s) {
  const dm = dataBR(s.data).slice(0, 5); // DD/MM
  const resumo1 = stripSmartQuotes(s.resumo).split('. ')[0];
  return `- **[${mdEscape(s.titulo)}](${s.url_canonica})** — ${mdEscape(s.fonte)}, ${dm}. ${resumo1}`;
}

function blocoNormas(normas) {
  if (!normas || !normas.length) {
    return '_Nenhum ato normativo identificado automaticamente nesta edição._';
  }
  const head = '| Norma | Data | Ementa | Link |\n|---|---|---|---|';
  const rows = normas.map((n) => `| ${mdEscape(n.norma)} | ${dataBR(n.data)} | ${mdEscape(n.ementa)} | [ver](${n.url}) |`);
  return [head, ...rows].join('\n');
}

/** Renderização pura (sem IO): recebe o payload e devolve o Markdown. Usado nos testes. */
export function renderMarkdown(p) {
  const destaquesMd = p.destaques.length
    ? p.destaques.map((d, i) => blocoDestaque(d, i, p.porque || {})).join('\n\n')
    : '_Sem destaques nesta edição._';
  const secundariosMd = p.secundarios.length
    ? p.secundarios.map(blocoSecundario).join('\n')
    : '_Sem itens secundários nesta edição._';

  return TEMPLATE
    .replaceAll('{{TITULO}}', yamlString(p.titulo).slice(1, -1))
    .replaceAll('{{AREA}}', p.area)
    .replaceAll('{{DATA}}', p.data)
    .replaceAll('{{PERIODO_DE}}', p.periodo_de)
    .replaceAll('{{PERIODO_ATE}}', p.periodo_ate)
    .replaceAll('{{EDICAO}}', String(p.edicao))
    .replaceAll('{{FONTES_CONSULTADAS}}', String(p.fontes_consultadas))
    .replaceAll('{{ITENS}}', String(p.itens))
    .replaceAll('{{GERADO_EM}}', p.gerado_em)
    .replaceAll('{{TITULO_H1}}', p.titulo)
    .replaceAll('{{PANORAMA}}', p.panorama)
    .replaceAll('{{DESTAQUES}}', destaquesMd)
    .replaceAll('{{SECUNDARIOS}}', secundariosMd)
    .replaceAll('{{NORMAS}}', blocoNormas(p.normas))
    .replaceAll('{{RODAPE_DATA}}', dataBR(p.data));
}

function calcularEdicao(area, data) {
  const dir = path.join(ROOT, 'content', area);
  let datas = [];
  try {
    datas = fs.readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map((f) => f.slice(0, 10));
  } catch { /* pasta ainda não existe */ }
  const anteriores = datas.filter((d) => d < data).length;
  return anteriores + 1;
}

/** Decide se o rascunho editado à mão deve ser respeitado (mais novo que o raw). */
export function deveRespeitarRascunho(rawMtimeMs, draftMtimeMs, force = false) {
  if (force) return false;
  if (!rawMtimeMs || !draftMtimeMs) return false;
  return draftMtimeMs > rawMtimeMs;
}

export async function render(area, { data, draft = false, skipLinkCheck = false, force = false } = {}) {
  const areas = loadAreas();
  const cfg = areas.config || {};
  const areaCfg = areas.areas[area];
  if (!areaCfg) throw new Error(`Área desconhecida: ${area}`);

  data = data || todayBRT();
  const rawPath = path.join(ROOT, 'data', 'raw', area, `${data}.json`);
  const raw = loadJson(rawPath, null);
  if (!raw) throw new Error(`Raw não encontrado: ${path.relative(ROOT, rawPath)} (rode collect antes)`);

  const finalPath = path.join(ROOT, 'content', area, `${data}.md`);
  const draftPath = path.join(ROOT, 'content', area, `${data}.draft.md`);

  // Janela de revisão: se o rascunho foi editado à mão depois da coleta, respeita a edição.
  if (!draft) {
    const rawMtime = fs.statSync(rawPath).mtimeMs;
    const draftMtime = fs.existsSync(draftPath) ? fs.statSync(draftPath).mtimeMs : 0;
    if (deveRespeitarRascunho(rawMtime, draftMtime, force)) {
      const body = fs.readFileSync(draftPath, 'utf8');
      fs.writeFileSync(finalPath, body, 'utf8');
      return { out: finalPath, md: body, destaques: [], secundarios: [], descartados: [], edicao: calcularEdicao(area, data), titulo: null, promovidoDoRascunho: true };
    }
  }

  const now = new Date();
  const { destaques: d0, secundarios: s0, descartados } = rankAndSelect(raw.itens, areaCfg, now, {
    janelaDias: cfg.janela_dias || 7,
    scoreMin: cfg.score_minimo ?? 0.15,
    maxDestaques: cfg.max_destaques ?? 3,
    maxSecundarios: cfg.max_secundarios ?? 9
  });

  // Validação de links antes de publicar (pode ser pulada em testes/local).
  let destaques = d0;
  let secundarios = s0;
  if (!skipLinkCheck) {
    const candidatos = [...d0, ...s0];
    const vivos = await mapLimit(candidatos, 6, async (it) => (await checkLink(it.url_canonica)) ? it : null);
    const validos = vivos.filter(Boolean);
    destaques = validos.slice(0, cfg.max_destaques ?? 3);
    secundarios = validos.slice(cfg.max_destaques ?? 3, (cfg.max_destaques ?? 3) + (cfg.max_secundarios ?? 9));
  }

  const fontesOk = (raw.fontes_consultadas || []).filter((f) => f.status === 'ok').length;
  const periodo = periodoCurto(raw.periodo_de, raw.periodo_ate);
  const { panorama, porque } = await enrich({
    area, areaCfg, destaques, secundarios, periodo, fontesOk
  }, { forcarDeterministico: !!process.env.MCAP_DETERMINISTICO });

  const titulo = `${areaCfg.titulo_radar} — ${periodo}`;
  const edicao = calcularEdicao(area, data);
  const idsDestaque = new Set(destaques.map((d) => d.id));
  const normas = extrairNormas(raw.itens.filter((it) => !idsDestaque.has(it.id)), 6);
  const md = renderMarkdown({
    titulo, area, data,
    periodo_de: raw.periodo_de, periodo_ate: raw.periodo_ate,
    edicao, fontes_consultadas: (raw.fontes_consultadas || []).length,
    itens: destaques.length + secundarios.length,
    gerado_em: nowBRTISO(now),
    panorama, porque, destaques, secundarios, normas
  });

  const nome = draft ? `${data}.draft.md` : `${data}.md`;
  const out = path.join(ROOT, 'content', area, nome);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md, 'utf8');

  return { out, md, destaques, secundarios, descartados, edicao, titulo, normas };
}

async function main() {
  const args = parseArgs();
  const area = args.area;
  if (!AREAS_VALIDAS.includes(area)) {
    console.error(`Uso: node src/render.js --area=<${AREAS_VALIDAS.join('|')}> [--data=YYYY-MM-DD] [--draft] [--skip-link-check] [--force]`);
    process.exit(1);
  }
  const { out, destaques, secundarios } = await render(area, {
    data: args.data,
    draft: !!args.draft,
    skipLinkCheck: !!args['skip-link-check'],
    force: !!args.force
  });
  console.log(`[render] ${area}: ${destaques.length} destaques + ${secundarios.length} secundários → ${path.relative(ROOT, out)}`);
}

if (process.argv[1]?.endsWith('render.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
