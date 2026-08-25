import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDispatchPayload } from '../src/dispatch.js';
import { buildDouQuery } from '../src/collect-dou.js';
import { selecionarUltimos, buildNewsletterMd } from '../src/newsletter.js';

test('buildDispatchPayload usa o evento do consumidor e inclui os feeds', () => {
  const p = buildDispatchPayload({ evento: 'meu-evento' });
  assert.equal(p.event_type, 'meu-evento');
  assert.match(p.client_payload.feed, /\/public\/api\/feed\.json$/);
  assert.equal(p.client_payload.origem, 'mcap-radar');
});

test('buildDispatchPayload cai no evento padrão quando não informado', () => {
  const p = buildDispatchPayload({});
  assert.equal(p.event_type, 'mcap-radar-updated');
});

test('buildDouQuery restringe a busca a in.gov.br e aplica janela', () => {
  const url = buildDouQuery('reforma tributária', 7);
  assert.match(url, /news\.google\.com\/rss\/search/);
  const q = decodeURIComponent(new URL(url).searchParams.get('q'));
  assert.match(q, /^site:in\.gov\.br /);
  assert.match(q, /when:7d$/);
});

test('selecionarUltimos escolhe o relatório mais recente por área', () => {
  const rel = [
    { area: 'trabalhista', data: '2026-08-18', titulo: 'antigo' },
    { area: 'trabalhista', data: '2026-08-25', titulo: 'novo' },
    { area: 'previdenciario', data: '2026-08-22', titulo: 'prev' }
  ];
  const u = selecionarUltimos(rel);
  const trab = u.find((r) => r.area === 'trabalhista');
  assert.equal(trab.titulo, 'novo');
  assert.equal(u.length, 2);
});

test('buildNewsletterMd gera front-matter e lista os relatórios com link', () => {
  const md = buildNewsletterMd({
    data: '2026-08-25',
    ultimos: [{ area: 'trabalhista', data: '2026-08-25', titulo: 'Radar Trabalhista', itens: 12 }],
    manchetes: [{ titulo: 'Manchete X', url: 'https://x/1', fonte: 'JOTA', data: '2026-08-25' }],
    clima: { texto: 'São Paulo · 22°C' }
  });
  assert.match(md, /^---\n/);
  assert.match(md, /# Boletim Radar MCAP/);
  assert.match(md, /\[Radar Trabalhista\]\(https:\/\/[^)]+\/content\/trabalhista\/2026-08-25\.md\)/);
  assert.match(md, /## Manchetes em destaque/);
  assert.match(md, /São Paulo · 22°C/);
});
