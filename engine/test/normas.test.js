import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarNorma, extrairNormas } from '../src/lib/normas.js';

test('detecta tipos de atos normativos e padroniza o rótulo', () => {
  assert.equal(detectarNorma('Publicada a Lei nº 14.789 sobre subvenções'), 'Lei nº 14.789');
  assert.equal(detectarNorma('Receita edita Instrução Normativa 2.180'), 'Instrução Normativa nº 2.180');
  assert.equal(detectarNorma('STF fixa Tema 1234 de repercussão geral'), 'Tema nº 1234');
  assert.equal(detectarNorma('Portaria Conjunta nº 12 regulamenta'), 'Portaria Conjunta nº 12');
});

test('prefere "lei complementar" a "lei"', () => {
  assert.equal(detectarNorma('Aprovada a Lei Complementar nº 214/2025'), 'Lei Complementar nº 214/2025');
});

test('ignora texto sem ato normativo', () => {
  assert.equal(detectarNorma('Governo debate reforma sem número'), null);
});

test('extrairNormas remove duplicados e ordena por data', () => {
  const itens = [
    { titulo: 'Editada Instrução Normativa 2.180', resumo: '', data: '2026-08-20T10:00:00Z', url_canonica: 'https://a/1' },
    { titulo: 'Nova análise da Instrução Normativa 2.180', resumo: '', data: '2026-08-25T10:00:00Z', url_canonica: 'https://a/2' },
    { titulo: 'Publicada Lei nº 14.789', resumo: '', data: '2026-08-24T10:00:00Z', url_canonica: 'https://a/3' },
    { titulo: 'Notícia sem norma', resumo: 'texto', data: '2026-08-25T10:00:00Z', url_canonica: 'https://a/4' }
  ];
  const normas = extrairNormas(itens);
  assert.equal(normas.length, 2);
  // Ordenado por data desc: Lei (24/08) antes da IN (primeira ocorrência 20/08).
  assert.equal(normas[0].norma, 'Lei nº 14.789');
  assert.equal(normas[1].norma, 'Instrução Normativa nº 2.180');
  assert.equal(normas[1].data, '2026-08-20T10:00:00Z', 'mantém a primeira ocorrência do ato');
});
