import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarFonte } from '../src/lib/sources.js';

test('classifica tribunais por domínio como peso 1.0', () => {
  assert.equal(classificarFonte('portal.stf.jus.br', '', 0.4).peso, 1.0);
  assert.equal(classificarFonte('www.tst.jus.br', '', 0.4).tipo, 'tribunal');
});

test('classifica órgãos oficiais por domínio gov.br', () => {
  const c = classificarFonte('www.gov.br', 'Receita Federal', 0.4);
  assert.equal(c.peso, 1.0);
  assert.equal(c.tipo, 'oficial');
});

test('usa o nome do publisher quando o domínio é agregador (Google News)', () => {
  const c = classificarFonte('news.google.com', 'STF', 0.4);
  assert.equal(c.peso, 1.0);
  assert.equal(c.tipo, 'tribunal');
});

test('especializados ganham 0.8 e imprensa 0.6', () => {
  assert.equal(classificarFonte('www.conjur.com.br', 'Conjur', 0.4).peso, 0.8);
  assert.equal(classificarFonte('valor.globo.com', 'Valor', 0.4).peso, 0.6);
});

test('desconhecido cai no piso do feed', () => {
  const c = classificarFonte('blog-qualquer.com', 'Blog Qualquer', 0.4);
  assert.equal(c.peso, 0.4);
  assert.equal(c.tipo, 'agregador');
});
