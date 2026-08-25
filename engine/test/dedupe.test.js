import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from '../src/collect.js';
import { sha1, canonicalUrl } from '../src/lib/text.js';

function item(url, titulo, peso, data) {
  const u = canonicalUrl(url);
  return { id: sha1(u), titulo, resumo: '', fonte: 'x', peso_fonte: peso, data, url: url, url_canonica: u };
}

test('dedupe remove URL canônica repetida', () => {
  const itens = [
    item('https://a.com/x?utm_source=1', 'Título A', 0.4, '2026-08-31T10:00:00Z'),
    item('https://a.com/x', 'Título A variação', 0.8, '2026-08-31T09:00:00Z')
  ];
  const out = dedupe(itens);
  assert.equal(out.length, 1);
  assert.equal(out[0].peso_fonte, 0.8, 'mantém a fonte de maior peso');
});

test('dedupe agrupa títulos muito similares de URLs diferentes', () => {
  const itens = [
    item('https://a.com/1', 'STF decide exclusão do ICMS da base do PIS e COFINS', 0.6, '2026-08-31T10:00:00Z'),
    item('https://b.com/2', 'STF decide exclusão do ICMS da base de PIS/COFINS', 1.0, '2026-08-31T08:00:00Z'),
    item('https://c.com/3', 'INSS muda regra de perícia médica', 0.8, '2026-08-30T08:00:00Z')
  ];
  const out = dedupe(itens);
  assert.equal(out.length, 2);
  const icms = out.find((o) => /ICMS/.test(o.titulo));
  assert.equal(icms.peso_fonte, 1.0);
});
