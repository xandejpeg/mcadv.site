import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url)); // engine/src/lib
export const SRC = path.resolve(__dir, '..');               // engine/src
export const ENGINE = path.resolve(__dir, '../..');         // engine
export const ROOT = path.resolve(__dir, '../../..');        // raiz do repositório
export const CONFIG_DIR = path.join(SRC, 'config');

export const SITE_BASE = (process.env.SITE_BASE || 'https://mdcadvocacia.com').replace(/\/+$/, '');
export const USER_AGENT = 'MCAP-Radar/1.0 (+https://mcadv.site)';

export const AREAS_VALIDAS = ['tributario-fiscal', 'trabalhista', 'previdenciario'];

/** Mapeia o cron do schedule para a área correspondente. */
export const CRON_AREA = {
  '0 21 * * 1': 'tributario-fiscal',
  '0 21 * * 3': 'trabalhista',
  '0 9 * * 5': 'previdenciario',
  '0 23 * * 1': 'tributario-fiscal',
  '0 23 * * 3': 'trabalhista',
  '0 11 * * 5': 'previdenciario'
};

export function parseArgs(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
    else o._.push(a);
  }
  return o;
}

export function loadJson(p, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export function loadAreas() {
  return loadJson(path.join(CONFIG_DIR, 'areas.json'));
}

export function loadSources() {
  return loadJson(path.join(CONFIG_DIR, 'sources.json'), { gerado_em: null, fontes: [] });
}

export function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/** Data YYYY-MM-DD no fuso de São Paulo. */
export function todayBRT(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

/** ISO 8601 com offset -03:00 (BRT), sem depender do fuso da máquina. */
export function nowBRTISO(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}:${parts.second}-03:00`;
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

export function dataExtenso(dateStr) {
  const d = new Date(dateStr + 'T12:00:00-03:00');
  const s = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(d);
  return s.replace('-feira', '');
}

/** "25 a 31/08/2026" a partir de duas datas ISO YYYY-MM-DD. */
export function periodoCurto(de, ate) {
  const [ay, am, ad] = de.split('-');
  const [by, bm, bd] = ate.split('-');
  if (am === bm && ay === by) return `${ad} a ${bd}/${bm}/${by}`;
  return `${ad}/${am}/${ay} a ${bd}/${bm}/${by}`;
}

export function dataBR(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
