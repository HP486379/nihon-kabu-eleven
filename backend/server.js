import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CACHE = new Map();
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Nihon-Kabu-Eleven/0.1)',
};

function getCache(key, ttlMs) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  CACHE.set(key, { ts: Date.now(), data });
}

function normalizeSymbol(symbol) {
  if (!symbol) return symbol;
  const upper = String(symbol).trim().toUpperCase();
  if (!upper) return upper;
  if (upper.startsWith('^') || upper.includes('.')) return upper;
  return `${upper}.T`;
}

function sanitizeSymbols(rawSymbols) {
  const values = String(rawSymbols || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 30);
  return [...new Set(values)];
}

async function yahooChart(symbol, params = { interval: '1d', range: '3mo' }) {
  const prepared = Object.entries(params).reduce((acc, [key, value]) => {
    if (value == null) return acc;
    acc[key] = value;
    return acc;
  }, {});
  const query = new URLSearchParams(prepared).toString();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`;
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    throw new Error(`Yahoo chart fetch failed: ${res.status}`);
  }
  return res.json();
}

function parseQuoteFromYahoo(inputSymbol, resp) {
  const result = resp?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const volumes = quote.volume || [];
  const validPoints = [];

  for (let i = 0; i < closes.length; i += 1) {
    const close = closes[i];
    if (typeof close !== 'number' || !Number.isFinite(close)) continue;
    validPoints.push({
      close,
      volume: volumes[i] ?? null,
      timestamp: timestamps[i] ? new Date(timestamps[i] * 1000).toISOString() : null,
    });
  }

  const last = validPoints.at(-1) ?? null;
  const previous = validPoints.length >= 2 ? validPoints.at(-2) : null;
  const first = validPoints.at(0) ?? null;
  const change = last && previous ? last.close - previous.close : null;
  const changePct = last && previous && previous.close !== 0 ? (last.close / previous.close - 1) * 100 : null;
  const periodReturnPct = last && first && first.close !== 0 ? (last.close / first.close - 1) * 100 : null;

  return {
    requestedSymbol: inputSymbol,
    symbol: result?.meta?.symbol || inputSymbol,
    exchangeName: result?.meta?.exchangeName || null,
    currency: result?.meta?.currency || 'JPY',
    regularMarketPrice: result?.meta?.regularMarketPrice ?? last?.close ?? null,
    previousClose: result?.meta?.previousClose ?? previous?.close ?? null,
    lastClose: last?.close ?? null,
    change,
    changePct,
    periodReturnPct,
    volume: last?.volume ?? null,
    tsSource: last?.timestamp,
    tsServer: new Date().toISOString(),
    source: 'yahoo-chart',
    delayed: true,
    points: validPoints.length,
  };
}

function parseOhlcFromYahoo(inputSymbol, interval, range, resp) {
  const result = resp?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const candles = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];
    if ([open, high, low, close].some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      continue;
    }
    candles.push({
      t: timestamps[i] * 1000,
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
    });
  }

  return {
    requestedSymbol: inputSymbol,
    symbol: result?.meta?.symbol || inputSymbol,
    interval,
    range,
    candles,
    source: 'yahoo-chart',
    delayed: true,
    tsServer: new Date().toISOString(),
  };
}

async function fetchQuote(rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol);
  const cacheKey = `quote:${symbol}`;
  const cached = getCache(cacheKey, 30_000);
  if (cached) return { ...cached, source: 'cache' };
  const data = await yahooChart(symbol, { interval: '1d', range: '3mo' });
  const payload = parseQuoteFromYahoo(symbol, data);
  setCache(cacheKey, payload);
  return payload;
}

app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const payload = await fetchQuote(req.params.symbol);
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: String(err), symbol: req.params.symbol });
  }
});

app.get('/api/quotes', async (req, res) => {
  const symbols = sanitizeSymbols(req.query.symbols);
  if (!symbols.length) {
    return res.status(400).json({ error: 'symbols query is required' });
  }

  const results = await Promise.all(symbols.map(async (rawSymbol) => {
    try {
      return await fetchQuote(rawSymbol);
    } catch (err) {
      return {
        requestedSymbol: rawSymbol,
        symbol: normalizeSymbol(rawSymbol),
        error: String(err),
        source: 'error',
        tsServer: new Date().toISOString(),
      };
    }
  }));

  res.json({ results, tsServer: new Date().toISOString() });
});

app.get('/api/history/:symbol', async (req, res) => {
  try {
    const symbol = normalizeSymbol(req.params.symbol);
    const interval = String(req.query.interval || '1d');
    const range = String(req.query.range || '3mo');
    const cacheKey = `history:${symbol}:${interval}:${range}`;
    const cached = getCache(cacheKey, 60_000);
    if (cached) return res.json({ ...cached, source: 'cache' });

    const data = await yahooChart(symbol, { interval, range });
    const payload = parseOhlcFromYahoo(symbol, interval, range, data);
    setCache(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: String(err), symbol: req.params.symbol });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nihon-kabu-eleven-market-proxy', tsServer: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`market proxy on :${PORT}`);
});
