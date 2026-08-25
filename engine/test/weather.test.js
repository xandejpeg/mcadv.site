import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherCodeText, buildWeather } from '../src/weather.js';

test('weatherCodeText traduz códigos WMO para português', () => {
  assert.equal(weatherCodeText(0), 'céu limpo');
  assert.equal(weatherCodeText(61), 'chuva fraca');
  assert.equal(weatherCodeText(95), 'trovoada');
  assert.equal(weatherCodeText(999), 'condição indefinida');
});

test('buildWeather monta o objeto no contrato do ticker', () => {
  const api = {
    current: { temperature_2m: 16.4, weather_code: 61 },
    daily: {
      temperature_2m_max: [22.1],
      temperature_2m_min: [13.6],
      precipitation_probability_max: [80],
      weather_code: [61]
    }
  };
  const c = buildWeather(api, '2026-08-31');
  assert.equal(c.cidade, 'São Paulo');
  assert.equal(c.temp_atual, 16);
  assert.equal(c.min, 14);
  assert.equal(c.max, 22);
  assert.equal(c.prob_chuva, 80);
  assert.equal(c.condicao, 'chuva fraca');
  assert.match(c.texto, /^São Paulo · .+ · 16°C, chuva fraca · mín 14° \/ máx 22°$/);
  assert.match(c.data_extenso, /2026/);
});
