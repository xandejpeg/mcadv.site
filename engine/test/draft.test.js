import test from 'node:test';
import assert from 'node:assert/strict';
import { deveRespeitarRascunho } from '../src/render.js';

test('respeita o rascunho quando ele é mais novo que o raw', () => {
  assert.equal(deveRespeitarRascunho(1000, 2000, false), true);
});

test('não respeita quando o raw é mais novo (coleta refez)', () => {
  assert.equal(deveRespeitarRascunho(3000, 2000, false), false);
});

test('force ignora o rascunho e re-renderiza', () => {
  assert.equal(deveRespeitarRascunho(1000, 2000, true), false);
});

test('sem rascunho, não há o que respeitar', () => {
  assert.equal(deveRespeitarRascunho(1000, 0, false), false);
});
