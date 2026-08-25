import test from 'node:test';
import assert from 'node:assert/strict';
import { relevancia, recencia, scoreItem, rankAndSelect } from '../src/score.js';

const areaCfg = {
  nome: 'Trabalhista',
  titulo_radar: 'Radar Trabalhista',
  keywords: [
    { termo: 'tst', peso: 3 },
    { termo: 'clt', peso: 2 },
    { termo: 'esocial', peso: 2 }
  ]
};

test('relevância maior quando a palavra-chave está no título', () => {
  const noTitulo = relevancia({ titulo: 'TST fixa tese sobre CLT', resumo: '' }, areaCfg);
  const noResumo = relevancia({ titulo: 'Notícia geral', resumo: 'algo sobre tst e clt' }, areaCfg);
  assert.ok(noTitulo > noResumo);
});

test('recência decai na janela', () => {
  const now = new Date('2026-08-31T12:00:00-03:00');
  const hoje = recencia('2026-08-31T10:00:00-03:00', now, 7);
  const antiga = recencia('2026-08-25T10:00:00-03:00', now, 7);
  assert.ok(hoje > antiga);
  assert.ok(antiga >= 0 && hoje <= 1);
});

test('scoreItem combina relevância, peso e recência', () => {
  const now = new Date('2026-08-31T12:00:00-03:00');
  const forte = scoreItem({ titulo: 'TST e eSocial', resumo: 'clt', peso_fonte: 1.0, data: '2026-08-31T10:00:00-03:00' }, areaCfg, now);
  const fraco = scoreItem({ titulo: 'Assunto qualquer', resumo: 'sem relação', peso_fonte: 0.4, data: '2026-08-25T10:00:00-03:00' }, areaCfg, now);
  assert.ok(forte > fraco);
  assert.ok(forte <= 1 && fraco >= 0);
});

test('rankAndSelect separa 3 destaques e o restante em secundários', () => {
  const now = new Date('2026-08-31T12:00:00-03:00');
  const itens = Array.from({ length: 8 }, (_, i) => ({
    id: 'i' + i,
    titulo: i < 5 ? 'TST decisão CLT eSocial ' + i : 'assunto neutro ' + i,
    resumo: 'clt esocial',
    peso_fonte: i < 5 ? 1.0 : 0.4,
    data: '2026-08-3' + (1 - (i % 2)) + 'T10:00:00-03:00'
  }));
  const r = rankAndSelect(itens, areaCfg, now, { scoreMin: 0.1 });
  assert.equal(r.destaques.length, 3);
  assert.ok(r.secundarios.length >= 1);
  assert.ok(r.destaques[0].score >= r.destaques[2].score);
});
