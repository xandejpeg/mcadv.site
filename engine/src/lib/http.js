import { USER_AGENT } from './util.js';

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** GET com timeout, retries e backoff. Retorna o corpo como texto. */
export async function fetchText(url, opts = {}) {
  const { timeout = 15000, retries = 2, headers = {}, method = 'GET' } = opts;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          ...headers
        }
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt < retries) await sleep(300 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts = {}) {
  const txt = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  return JSON.parse(txt);
}

/** Verifica se um link está vivo com custo mínimo (Range 0-0). Aceita 200/206/403. */
export async function checkLink(url, opts = {}) {
  const { timeout = 10000 } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' }
    });
    clearTimeout(t);
    return [200, 206, 403].includes(res.status);
  } catch {
    clearTimeout(t);
    return false;
  }
}

/** Executa fn sobre items com concorrência limitada, preservando a ordem. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const n = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}
