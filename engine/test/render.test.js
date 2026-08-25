import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/render.js';

const payload = {
  titulo: 'Radar Trabalhista — 25 a 31/08/2026',
  area: 'trabalhista',
  data: '2026-08-31',
  periodo_de: '2026-08-25',
  periodo_ate: '2026-08-31',
  edicao: 12,
  fontes_consultadas: 14,
  itens: 4,
  gerado_em: '2026-08-31T20:00:00-03:00',
  panorama: 'Panorama determinístico da semana.',
  porque: { a1: 'Impacta empresas.', a2: 'Relevante para o setor.', a3: 'Muda a jurisprudência.' },
  destaques: [
    { id: 'a1', titulo: 'TST fixa tese sobre pejotização', resumo: 'Resumo do primeiro destaque.', fonte: 'Conjur', data: '2026-08-27T10:00:00-03:00', url_canonica: 'https://www.conjur.com.br/a' },
    { id: 'a2', titulo: 'Reforma trabalhista volta à pauta', resumo: 'Resumo do segundo destaque.', fonte: 'Valor', data: '2026-08-26T10:00:00-03:00', url_canonica: 'https://valor.globo.com/b' },
    { id: 'a3', titulo: 'eSocial ganha novo evento', resumo: 'Resumo do terceiro destaque.', fonte: 'JOTA', data: '2026-08-25T10:00:00-03:00', url_canonica: 'https://www.jota.info/c' }
  ],
  secundarios: [
    { titulo: 'Item secundário 1', resumo: 'Uma linha. Outra frase.', fonte: 'Migalhas', data: '2026-08-25T09:00:00-03:00', url_canonica: 'https://migalhas.com.br/d' }
  ],
  normas: []
};

test('renderMarkdown produz front-matter válido e estrutura esperada', () => {
  const md = renderMarkdown(payload);
  assert.match(md, /^---\n/);
  assert.match(md, /area: trabalhista/);
  assert.match(md, /edicao: 12/);
  assert.match(md, /itens: 4/);
  assert.match(md, /## Panorama da semana/);
  assert.match(md, /### 1\. TST fixa tese sobre pejotização/);
  assert.match(md, /### 2\. Reforma trabalhista/);
  assert.match(md, /### 3\. eSocial/);
  assert.match(md, /> \*\*Por que importa:\*\* Impacta empresas\./);
  assert.match(md, /## Também na semana/);
  assert.match(md, /\[Item secundário 1\]\(https:\/\/migalhas\.com\.br\/d\)/);
  assert.match(md, /nenhum conteúdo integral é reproduzido/);
});

test('renderMarkdown escapa o título no front-matter', () => {
  const p = { ...payload, titulo: 'Radar "aspas" — teste' };
  const md = renderMarkdown(p);
  assert.match(md, /titulo: "Radar \\"aspas\\" — teste"/);
});
