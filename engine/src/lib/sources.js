/**
 * Classificação de confiabilidade da fonte → peso usado no score.
 * Fase 2: mesmo quando o item chega via Google News (agregador), a fonte real
 * (nome do publisher ou domínio) determina o peso, dando o devido valor a
 * tribunais e órgãos oficiais.
 *
 * tipo → peso: oficial/tribunal 1.0, especializado 0.8, imprensa 0.6, agregador 0.4.
 */

const REGRAS_HOST = [
  { re: /(^|\.)(gov\.br|planalto\.gov\.br|in\.gov\.br|senado\.leg\.br|camara\.leg\.br)$/i, tipo: 'oficial', peso: 1.0 },
  { re: /(^|\.)(stf|stj|tst|tse|trf\d|trt\d+|tjsp|csjt|cnj|jus)\.jus\.br$/i, tipo: 'tribunal', peso: 1.0 },
  { re: /(^|\.)(conjur\.com\.br|jota\.info|migalhas\.com\.br)$/i, tipo: 'especializado', peso: 0.8 },
  { re: /(^|\.)(valor\.globo\.com|oglobo\.globo\.com|g1\.globo\.com|estadao\.com\.br|folha\.uol\.com\.br|exame\.com|infomoney\.com\.br|gazetadopovo\.com\.br|cnnbrasil\.com\.br)$/i, tipo: 'imprensa', peso: 0.6 }
];

const REGRAS_NOME = [
  { re: /\b(supremo|stf)\b/i, tipo: 'tribunal', peso: 1.0 },
  { re: /\b(stj|superior tribunal de justi)/i, tipo: 'tribunal', peso: 1.0 },
  { re: /\b(tst|trt|tribunal superior do trabalho|tribunal.*trabalho)\b/i, tipo: 'tribunal', peso: 1.0 },
  { re: /\b(carf|receita federal|minist[eé]rio|inss|planalto|senado|c[aâ]mara dos deputados|di[aá]rio oficial|gov\.br)\b/i, tipo: 'oficial', peso: 1.0 },
  { re: /\b(conjur|consultor jur[ií]dico|jota|migalhas)\b/i, tipo: 'especializado', peso: 0.8 },
  { re: /\b(valor|estad[aã]o|folha|globo|exame|veja|g1|uol|cnn|infomoney|gazeta do povo)\b/i, tipo: 'imprensa', peso: 0.6 }
];

function porHost(host) {
  if (!host) return null;
  for (const r of REGRAS_HOST) if (r.re.test(host)) return { tipo: r.tipo, peso: r.peso };
  return null;
}

function porNome(nome) {
  if (!nome) return null;
  for (const r of REGRAS_NOME) if (r.re.test(nome)) return { tipo: r.tipo, peso: r.peso };
  return null;
}

/**
 * Melhor classificação entre host, nome e o piso do feed.
 * pisoFeed: peso default do feed (ex.: 0.4 para Google News).
 */
export function classificarFonte(host, nome, pisoFeed = 0.4) {
  const candidatos = [porHost(host), porNome(nome), { tipo: 'agregador', peso: pisoFeed }].filter(Boolean);
  candidatos.sort((a, b) => b.peso - a.peso);
  return candidatos[0];
}
