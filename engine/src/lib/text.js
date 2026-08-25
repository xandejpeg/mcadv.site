import crypto from 'node:crypto';

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'para', 'por', 'com', 'que', 'se', 'sobre', 'ao', 'aos', 'as', 'os',
  'sua', 'seu', 'suas', 'seus', 'the', 'of', 'to', 'in', 'and', 'ser', 'ter', 'mais',
  'como', 'foi', 'sao', 'sem', 'seu', 'apos', 'entre', 'pela', 'pelo', 'pelos', 'pelas'
]);

/** Minúsculas sem acento. */
export function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Tokens úteis (sem stopwords nem termos curtos). */
export function tokens(s) {
  return normalize(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !STOPWORDS.has(w));
}

/** Similaridade de Dice sobre tokens (0..1). */
export function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export function slug(s) {
  return normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function sha1(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

/** URL canônica: sem parâmetros de rastreio nem fragmento; resolve o wrapper do Google News. */
export function canonicalUrl(raw) {
  if (!raw) return '';
  try {
    let u = new URL(raw);
    if (/(^|\.)news\.google\.com$/.test(u.hostname)) {
      const real = u.searchParams.get('url');
      if (real) u = new URL(real);
    }
    const drop = [];
    for (const [k] of u.searchParams) {
      if (/^utm_/i.test(k) || ['gclid', 'fbclid', 'igshid', 'mc_cid', 'mc_eid', 'ref', 'ref_src'].includes(k.toLowerCase())) {
        drop.push(k);
      }
    }
    drop.forEach((k) => u.searchParams.delete(k));
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

/** Trunca em fronteira de palavra, no máximo max caracteres. */
export function resumoCurto(s, max = 300) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

export function stripSmartQuotes(s) {
  return String(s || '').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
}

/** Escapa texto para uso inline em Markdown (evita quebra de tabela/link). */
export function mdEscape(s) {
  return stripSmartQuotes(s)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/([\[\]])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escalar YAML seguro entre aspas duplas. */
export function yamlString(s) {
  const clean = stripSmartQuotes(s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return '"' + clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Título curto para o letreiro: sem aspas tipográficas, corte em fronteira de palavra. */
export function tituloTicker(s, max = 90) {
  const t = stripSmartQuotes(s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > 40 ? cut.slice(0, sp) : cut).trim() + '…';
}

/** Remove o sufixo " - Publisher" que o Google News anexa aos títulos. */
export function limparTituloGN(titulo, fonte) {
  const t = String(titulo || '').trim();
  if (fonte) {
    const suffix = ` - ${fonte}`;
    if (t.endsWith(suffix)) return t.slice(0, -suffix.length).trim();
  }
  const m = /^(.*\S)\s+-\s+[^-]{2,60}$/.exec(t);
  return m ? m[1].trim() : t;
}
