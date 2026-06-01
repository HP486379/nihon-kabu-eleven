import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CACHE = new Map();
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const FALLBACK_SEARCH = [
  ['7951', 'ヤマハ', ['YAMAHA', 'やまは']],
  ['7272', 'ヤマハ発動機', ['ヤマハ発', 'YAMAHA MOTOR']],
  ['6758', 'ソニーグループ', ['ソニー', 'SONY']],
  ['7203', 'トヨタ自動車', ['トヨタ', 'TOYOTA']],
  ['7974', '任天堂', ['NINTENDO']],
  ['8035', '東京エレクトロン', ['東エレク']],
  ['9984', 'ソフトバンクグループ', ['ソフトバンクG', 'SBG']],
];

const nowIso = () => new Date().toISOString();
const norm = (value) => String(value || '').normalize('NFKC').replace(/[\s・･\-－_＿()（）.,，。]/g, '').toUpperCase();
const bareCode = (symbol) => String(symbol || '').replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
const symbolOf = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper || upper.startsWith('^') || upper.includes('.')) return upper;
  return `${upper}.T`;
};

function getCache(key, ttlMs) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) {
    CACHE.delete(key);
    return null;
  }
  return hit.data;
}

function setCache(key, data) {
  CACHE.set(key, { ts: Date.now(), data });
}

function fallbackSearch(query) {
  const q = norm(query);
  if (!q) return [];
  return FALLBACK_SEARCH
    .filter(([code, name, aliases]) => [code, name, ...aliases].some((value) => norm(value).includes(q)))
    .map(([code, name]) => ({
      code,
      symbol: `${code}.T`,
      shortName: name,
      longName: name,
      displayName: name,
      exchange: 'TYO',
      quoteType: 'EQUITY',
      source: 'fallback',
    }));
}

function mergeByCode(...groups) {
  const merged = [];
  groups.flat().forEach((item) => {
    if (!item?.code || merged.some((existing) => existing.code === item.code)) return;
    merged.push(item);
  });
  return merged;
}

async function yahooSearch(query, count = 10) {
  const q = String(query || '').trim();
  if (!q) return [];
  const key = `search:${q}:${count}`;
  const cached = getCache(key, 24 * 60 * 60 * 1000);
  if (cached) return cached;

  const fallback = fallbackSearch(q);
  const params = new URLSearchParams({ q, quotesCount: String(count), newsCount: '0', listsCount: '0', lang: 'ja-JP', region: 'JP' });
  const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?${params}`, { headers: HEADERS });
  if (!res.ok) {
    setCache(key, fallback);
    return fallback;
  }

  const data = await res.json();
  const yahoo = (Array.isArray(data?.quotes) ? data.quotes : [])
    .filter((quote) => String(quote.symbol || '').toUpperCase().endsWith('.T'))
    .map((quote) => {
      const symbol = String(quote.symbol || '').toUpperCase();
      const code = bareCode(symbol);
      const shortName = quote.shortname || quote.shortName || null;
      const longName = quote.longname || quote.longName || null;
      return { code, symbol, shortName, longName, displayName: longName || shortName || code, exchange: quote.exchange || null, quoteType: quote.quoteType || null, source: 'yahoo' };
    })
    .filter((item) => item.code);

  const result = mergeByCode(fallback, yahoo).slice(0, count);
  setCache(key, result);
  return result;
}

async function yahooChart(symbol, params) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo chart fetch failed: ${res.status}`);
  return res.json();
}

function quoteFromChart(inputSymbol, data) {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const volumes = quote.volume || [];
  const points = [];

  closes.forEach((close, index) => {
    if (typeof close !== 'number' || !Number.isFinite(close)) return;
    points.push({ close, volume: volumes[index] ?? null, timestamp: timestamps[index] ? new Date(timestamps[index] * 1000).toISOString() : null });
  });

  const last = points.at(-1) ?? null;
  const previous = points.length >= 2 ? points.at(-2) : null;
  const first = points.at(0) ?? null;
  return {
    requestedSymbol: inputSymbol,
    symbol: result?.meta?.symbol || inputSymbol,
    currency: result?.meta?.currency || 'JPY',
    regularMarketPrice: result?.meta?.regularMarketPrice ?? last?.close ?? null,
    previousClose: result?.meta?.previousClose ?? previous?.close ?? null,
    lastClose: last?.close ?? null,
    change: last && previous ? last.close - previous.close : null,
    changePct: last && previous && previous.close !== 0 ? (last.close / previous.close - 1) * 100 : null,
    periodReturnPct: last && first && first.close !== 0 ? (last.close / first.close - 1) * 100 : null,
    volume: last?.volume ?? null,
    tsSource: last?.timestamp,
    tsServer: nowIso(),
    source: 'yahoo-chart',
    delayed: true,
    points: points.length,
  };
}

function candlesFromChart(inputSymbol, interval, range, data) {
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const candles = timestamps.map((timestamp, index) => ({
    t: timestamp * 1000,
    open: quote.open?.[index],
    high: quote.high?.[index],
    low: quote.low?.[index],
    close: quote.close?.[index],
    volume: quote.volume?.[index] ?? 0,
  })).filter((candle) => [candle.open, candle.high, candle.low, candle.close].every((value) => typeof value === 'number' && Number.isFinite(value)));

  return { requestedSymbol: inputSymbol, symbol: result?.meta?.symbol || inputSymbol, interval, range, candles, source: 'yahoo-chart', delayed: true, tsServer: nowIso() };
}

async function fetchQuote(rawSymbol) {
  const symbol = symbolOf(rawSymbol);
  const key = `quote:${symbol}`;
  const cached = getCache(key, 30_000);
  if (cached) return { ...cached, source: 'cache' };

  const data = await yahooChart(symbol, { interval: '1d', range: '3mo' });
  const quote = quoteFromChart(symbol, data);
  const code = bareCode(symbol);
  const fallbackName = fallbackSearch(code).find((item) => item.code === code);
  const payload = fallbackName ? { ...quote, shortName: fallbackName.displayName, longName: fallbackName.displayName, displayName: fallbackName.displayName } : quote;
  setCache(key, payload);
  return payload;
}

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const results = q ? await yahooSearch(q, 10) : [];
    res.json({ results, tsServer: nowIso() });
  } catch (err) {
    const results = fallbackSearch(req.query.q).slice(0, 10);
    res.status(results.length ? 200 : 502).json({ error: String(err), results });
  }
});

app.get('/api/quote/:symbol', async (req, res) => {
  try {
    res.json(await fetchQuote(req.params.symbol));
  } catch (err) {
    res.status(502).json({ error: String(err), symbol: req.params.symbol });
  }
});

app.get('/api/quotes', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 30);
  if (!symbols.length) return res.status(400).json({ error: 'symbols query is required' });
  const results = await Promise.all([...new Set(symbols)].map(async (symbol) => {
    try {
      return await fetchQuote(symbol);
    } catch (err) {
      return { requestedSymbol: symbol, symbol: symbolOf(symbol), error: String(err), source: 'error', tsServer: nowIso() };
    }
  }));
  res.json({ results, tsServer: nowIso() });
});

app.get('/api/history/:symbol', async (req, res) => {
  try {
    const symbol = symbolOf(req.params.symbol);
    const interval = String(req.query.interval || '1d');
    const range = String(req.query.range || '3mo');
    const key = `history:${symbol}:${interval}:${range}`;
    const cached = getCache(key, 60_000);
    if (cached) return res.json({ ...cached, source: 'cache' });
    const data = await yahooChart(symbol, { interval, range });
    const payload = candlesFromChart(symbol, interval, range, data);
    setCache(key, payload);
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: String(err), symbol: req.params.symbol });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nihon-kabu-eleven-market-proxy', tsServer: nowIso() });
});

app.listen(PORT, () => {
  console.log(`market proxy on :${PORT}`);
});
