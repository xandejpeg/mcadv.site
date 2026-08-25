import path from 'node:path';
import { loadJson, SRC, SITE_BASE, nowBRTISO } from './lib/util.js';

/** Monta o corpo do repository_dispatch para um consumidor. */
export function buildDispatchPayload(consumidor, extra = {}) {
  return {
    event_type: consumidor.evento || 'mcap-radar-updated',
    client_payload: {
      origem: 'mcap-radar',
      atualizado_em: nowBRTISO(),
      feed: `${SITE_BASE}/public/api/feed.json`,
      ticker: `${SITE_BASE}/public/api/ticker.json`,
      weather: `${SITE_BASE}/public/api/weather.json`,
      ...extra
    }
  };
}

async function enviar(repo, payload, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return res.status; // 204 = ok
}

export async function dispatch({ extra = {} } = {}) {
  const token = process.env.DISPATCH_TOKEN;
  const cfg = loadJson(path.join(SRC, 'config', 'consumers.json'), { consumidores: [] });
  const ativos = (cfg.consumidores || []).filter((c) => c.ativo && c.repo);

  if (!token) {
    console.log('[dispatch] DISPATCH_TOKEN ausente — nada enviado.');
    return { enviados: 0, pulados: ativos.length };
  }
  if (!ativos.length) {
    console.log('[dispatch] Nenhum consumidor ativo em consumers.json.');
    return { enviados: 0, pulados: 0 };
  }

  let enviados = 0;
  for (const c of ativos) {
    try {
      const status = await enviar(c.repo, buildDispatchPayload(c, extra), token);
      if (status === 204) { enviados++; console.log(`[dispatch] ${c.repo}: ok`); }
      else console.log(`[dispatch] ${c.repo}: HTTP ${status}`);
    } catch (err) {
      console.log(`[dispatch] ${c.repo}: erro ${err?.message || err}`);
    }
  }
  return { enviados, pulados: ativos.length - enviados };
}

if (process.argv[1]?.endsWith('dispatch.js')) {
  dispatch().catch((e) => { console.error(e); process.exit(1); });
}
