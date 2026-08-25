import fs from 'node:fs';
import path from 'node:path';
import { fetchJson } from './lib/http.js';
import {
  writeJson, loadJson, todayBRT, nowBRTISO, dataExtenso, ROOT
} from './lib/util.js';

const WMO = {
  0: 'céu limpo', 1: 'predomínio de sol', 2: 'parcialmente nublado', 3: 'nublado',
  45: 'nevoeiro', 48: 'nevoeiro com geada',
  51: 'garoa fraca', 53: 'garoa moderada', 55: 'garoa densa',
  56: 'garoa congelante fraca', 57: 'garoa congelante densa',
  61: 'chuva fraca', 63: 'chuva moderada', 65: 'chuva forte',
  66: 'chuva congelante fraca', 67: 'chuva congelante forte',
  71: 'neve fraca', 73: 'neve moderada', 75: 'neve forte', 77: 'grãos de neve',
  80: 'pancadas de chuva fracas', 81: 'pancadas de chuva moderadas', 82: 'pancadas de chuva fortes',
  85: 'pancadas de neve fracas', 86: 'pancadas de neve fortes',
  95: 'trovoada', 96: 'trovoada com granizo', 99: 'trovoada com granizo forte'
};

export function weatherCodeText(code) {
  return WMO[code] ?? 'condição indefinida';
}

const LAT = -23.5505;
const LON = -46.6333;

export function buildWeather(api, dataStr = todayBRT()) {
  const cur = api.current || {};
  const daily = api.daily || {};
  const code = (daily.weather_code && daily.weather_code[0] != null) ? daily.weather_code[0] : cur.weather_code;
  const condicao = weatherCodeText(code);
  const min = Math.round(daily.temperature_2m_min?.[0]);
  const max = Math.round(daily.temperature_2m_max?.[0]);
  const prob = daily.precipitation_probability_max?.[0] ?? 0;
  const tempAtual = Math.round(cur.temperature_2m);
  const extenso = dataExtenso(dataStr);
  return {
    cidade: 'São Paulo',
    data: dataStr,
    data_extenso: extenso,
    temp_atual: tempAtual,
    min, max,
    condicao,
    prob_chuva: prob,
    texto: `São Paulo · ${extenso} · ${tempAtual}°C, ${condicao} · mín ${min}° / máx ${max}°`
  };
}

export async function weather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=America/Sao_Paulo`;
  const api = await fetchJson(url, { timeout: 15000, retries: 2 });
  const hoje = todayBRT();
  const clima = buildWeather(api, hoje);

  // Estado atual
  writeJson(path.join(ROOT, 'data', 'weather', 'sao-paulo.json'), { gerado_em: nowBRTISO(), ...clima });

  // Histórico diário (uma linha JSON por dia, sem duplicar)
  const mes = hoje.slice(0, 7);
  const histPath = path.join(ROOT, 'data', 'weather', 'history', `${mes}.jsonl`);
  fs.mkdirSync(path.dirname(histPath), { recursive: true });
  let linhas = [];
  try { linhas = fs.readFileSync(histPath, 'utf8').split('\n').filter(Boolean); } catch { /* novo mês */ }
  linhas = linhas.filter((l) => { try { return JSON.parse(l).data !== hoje; } catch { return false; } });
  linhas.push(JSON.stringify(clima));
  fs.writeFileSync(histPath, linhas.join('\n') + '\n', 'utf8');

  // Feed público
  writeJson(path.join(ROOT, 'public', 'api', 'weather.json'), { gerado_em: nowBRTISO(), versao: 1, ...clima });

  // Atualiza o campo clima do ticker (preservando manchetes existentes)
  const tickerPath = path.join(ROOT, 'public', 'api', 'ticker.json');
  const ticker = loadJson(tickerPath, { versao: 1, manchetes: [] });
  ticker.versao = 1;
  ticker.gerado_em = nowBRTISO();
  ticker.clima = clima;
  ticker.manchetes = ticker.manchetes || [];
  writeJson(tickerPath, ticker);

  return clima;
}

async function main() {
  const clima = await weather();
  console.log(`[weather] ${clima.texto}`);
}

if (process.argv[1]?.endsWith('weather.js')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
