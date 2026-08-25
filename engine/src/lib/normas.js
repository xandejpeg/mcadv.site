import { resumoCurto } from './text.js';

// Ordem importa: alternativas mais longas primeiro (ex.: "lei complementar" antes de "lei").
const TIPOS = [
  'lei complementar',
  'emenda constitucional',
  'medida provis[oó]ria',
  'instru[cç][aã]o normativa',
  'ato declarat[oó]rio(?: interpretativo| executivo)?',
  'solu[cç][aã]o de consulta',
  'parecer normativo',
  'portaria(?: conjunta| normativa)?',
  'resolu[cç][aã]o(?: conjunta)?',
  's[uú]mula(?: vinculante)?',
  'decreto(?:-lei)?',
  'lei',
  'tema'
];

const NORMA_RE = new RegExp(
  `\\b(${TIPOS.join('|')})\\b\\s*(?:n[º°.]?\\s*)?(\\d{1,5}(?:[./]\\d{1,5})?)`,
  'i'
);

function capitalizar(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|\s)([a-zà-ú])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Detecta um ato normativo num texto e devolve o rótulo padronizado, ou null. */
export function detectarNorma(texto) {
  const m = NORMA_RE.exec(texto || '');
  if (!m) return null;
  const tipo = capitalizar(m[1].replace(/\s+/g, ' ').trim());
  return `${tipo} nº ${m[2]}`;
}

/**
 * Extrai atos normativos dos itens (título ou resumo), sem repetir o mesmo ato.
 * Retorna [{ norma, data, ementa, url }] ordenado por data (mais recente primeiro).
 */
export function extrairNormas(itens, limite = 6) {
  const out = [];
  const vistos = new Set();
  for (const it of itens) {
    const label = detectarNorma(it.titulo) || detectarNorma(it.resumo);
    if (!label) continue;
    const key = label.toLowerCase();
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push({
      norma: label,
      data: it.data,
      ementa: resumoCurto(it.resumo || it.titulo, 160),
      url: it.url_canonica
    });
  }
  out.sort((a, b) => new Date(b.data) - new Date(a.data));
  return out.slice(0, limite);
}
