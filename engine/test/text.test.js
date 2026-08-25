import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, similarity, slug, resumoCurto, tituloTicker, mdEscape, sha1, limparTituloGN } from '../src/lib/text.js';

test('canonicalUrl remove parâmetros de rastreio e fragmento', () => {
  const out = canonicalUrl('https://exemplo.com/materia?utm_source=x&utm_medium=y&id=10#topo');
  assert.equal(out, 'https://exemplo.com/materia?id=10');
});

test('canonicalUrl resolve o wrapper do Google News (?url=)', () => {
  const real = 'https://valor.globo.com/legislacao/noticia/2026/08/27/algo.ghtml';
  const g = `https://news.google.com/rss/articles/abc?oc=5&url=${encodeURIComponent(real)}`;
  assert.equal(canonicalUrl(g), real);
});

test('similarity detecta títulos quase iguais acima de 0,82', () => {
  const a = 'STF decide sobre exclusão do ICMS da base do PIS e da COFINS';
  const b = 'STF decide sobre exclusão do ICMS da base de PIS/COFINS';
  assert.ok(similarity(a, b) >= 0.82, `similaridade ${similarity(a, b)}`);
});

test('similarity de textos diferentes fica baixa', () => {
  const a = 'INSS altera regra de perícia médica';
  const b = 'Reforma tributária avança no Senado';
  assert.ok(similarity(a, b) < 0.5);
});

test('resumoCurto trunca em fronteira de palavra', () => {
  const s = 'palavra '.repeat(60).trim();
  const r = resumoCurto(s, 50);
  assert.ok(r.length <= 51);
  assert.ok(r.endsWith('…'));
  assert.ok(!r.includes('palav\u2026') === true);
});

test('tituloTicker limita a 90 caracteres e remove aspas tipográficas', () => {
  const s = '\u201cDecisão\u201d importante ' + 'x'.repeat(120);
  const r = tituloTicker(s, 90);
  assert.ok(r.length <= 91);
  assert.ok(!/[\u201C\u201D]/.test(r));
});

test('mdEscape neutraliza barras verticais e colchetes', () => {
  assert.equal(mdEscape('a | b [c]'), 'a \\| b \\[c\\]');
});

test('slug e sha1 são determinísticos', () => {
  assert.equal(slug('Reforma Tributária: o que muda?'), 'reforma-tributaria-o-que-muda');
  assert.equal(sha1('x'), sha1('x'));
});

test('limparTituloGN remove o sufixo " - Publisher" do Google News', () => {
  assert.equal(limparTituloGN('TST fixa tese sobre pejotização - Migalhas', 'Migalhas'), 'TST fixa tese sobre pejotização');
  assert.equal(limparTituloGN('Notícia sem fonte casada - Estado de Minas', ''), 'Notícia sem fonte casada');
  assert.equal(limparTituloGN('Título simples sem sufixo', 'Valor'), 'Título simples sem sufixo');
});
