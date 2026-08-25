import { normalize } from './lib/text.js';

/** Relevância 0..1 pela presença de palavras-chave da área (título vale 2x). */
export function relevancia(item, areaCfg) {
  const titulo = normalize(item.titulo);
  const resumo = normalize(item.resumo);
  let soma = 0;
  for (const kw of areaCfg.keywords || []) {
    const termo = normalize(kw.termo);
    const peso = kw.peso || 1;
    if (titulo.includes(termo)) soma += peso * 2;
    else if (resumo.includes(termo)) soma += peso;
  }
  const norm = areaCfg.rel_norm || 8;
  return Math.min(1, soma / norm);
}

/** Recência 0..1 com decaimento linear na janela. */
export function recencia(dataISO, now = new Date(), janelaDias = 7) {
  const d = new Date(dataISO);
  if (isNaN(d)) return 0;
  const ageDays = (now.getTime() - d.getTime()) / 86400000;
  if (ageDays <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - ageDays / janelaDias));
}

export function scoreItem(item, areaCfg, now = new Date(), janelaDias = 7) {
  const rel = relevancia(item, areaCfg);
  const peso = typeof item.peso_fonte === 'number' ? item.peso_fonte : 0.4;
  const rec = recencia(item.data, now, janelaDias);
  return 0.45 * rel + 0.30 * peso + 0.25 * rec;
}

/**
 * Ordena por score e separa destaques, secundários e descartados.
 * opts: { janelaDias, scoreMin, maxDestaques, maxSecundarios }
 */
export function rankAndSelect(itens, areaCfg, now = new Date(), opts = {}) {
  const janela = opts.janelaDias ?? 7;
  const scoreMin = opts.scoreMin ?? 0.15;
  const maxDestaques = opts.maxDestaques ?? 3;
  const maxSecundarios = opts.maxSecundarios ?? 9;

  const scored = itens
    .map((it) => ({ ...it, score: +scoreItem(it, areaCfg, now, janela).toFixed(4) }))
    .sort((a, b) => b.score - a.score || new Date(b.data) - new Date(a.data));

  const aprovados = scored.filter((x) => x.score >= scoreMin);
  const descartados = scored
    .filter((x) => x.score < scoreMin)
    .map((x) => ({ id: x.id, titulo: x.titulo, score: x.score, motivo: 'score abaixo do minimo' }));

  return {
    destaques: aprovados.slice(0, maxDestaques),
    secundarios: aprovados.slice(maxDestaques, maxDestaques + maxSecundarios),
    descartados,
    scored
  };
}
