import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import * as XLSX from 'xlsx';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CACHE = new Map();
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const JPX_LISTED_ISSUES_URL = 'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls';

const FALLBACK_SEARCH = [
  ['7951', 'ヤマハ', ['YAMAHA', 'やまは', 'ヤマハ株式会社']],
  ['7272', 'ヤマハ発動機', ['ヤマハ発', 'YAMAHA MOTOR']],
  ['9506', '東北電力', ['東北電', 'TOHOKU ELECTRIC']],
  ['9501', '東京電力ホールディングス', ['東京電力', '東電', 'TEPCO']],
  ['9502', '中部電力', ['中電']],
  ['9503', '関西電力', ['関電']],
  ['6758', 'ソニーグループ', ['ソニー', 'SONY']],
  ['7203', 'トヨタ自動車', ['トヨタ', 'TOYOTA']],
  ['7974', '任天堂', ['NINTENDO']],
  ['8035', '東京エレクトロン', ['東エレク', 'TEL']],
  ['9984', 'ソフトバンクグループ', ['ソフトバンクG', 'SBG']],
];

const FORMATION_COUNTS = {
  '4-3-3': { FW: 3, MF: 3, DF: 4, GK: 1 },
  '4-2-3-1': { FW: 1, MF: 5, DF: 4, GK: 1 },
  '4-4-2': { FW: 2, MF: 4, DF: 4, GK: 1 },
  '3-5-2': { FW: 2, MF: 5, DF: 3, GK: 1 },
  '3-4-3': { FW: 3, MF: 4, DF: 3, GK: 1 },
  '5-3-2': { FW: 2, MF: 3, DF: 5, GK: 1 },
  '3-4-2-1': { FW: 1, MF: 6, DF: 3, GK: 1 },
  '5-4-1': { FW: 1, MF: 4, DF: 5, GK: 1 },
};

const POSITIONS = ['FW', 'MF', 'DF', 'GK'];

const nowIso = () => new Date().toISOString();
const normalizeText = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[\s・･\-－_＿()（）\[\]［］.,，。]/g, '')
  .toUpperCase();
const bareCode = (symbol) => String(symbol || '').replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
const symbolOf = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper || upper.startsWith('^') || upper.includes('.')) return upper;
  return `${upper}.T`;
};
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

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

function mergeByCode(...groups) {
  const merged = [];
  groups.flat().forEach((item) => {
    if (!item?.code || merged.some((existing) => existing.code === item.code)) return;
    merged.push(item);
  });
  return merged;
}

function fallbackSearch(query) {
  const q = normalizeText(query);
  if (!q) return [];
  return FALLBACK_SEARCH
    .filter(([code, name, aliases]) => [code, name, ...aliases].some((value) => normalizeText(value).includes(q)))
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

function pick(row, candidates) {
  const keys = Object.keys(row);
  const key = candidates.find((candidate) => keys.includes(candidate))
    || keys.find((candidate) => candidates.some((expected) => normalizeText(candidate).includes(normalizeText(expected))));
  return key ? row[key] : null;
}

function normalizeJpxRow(row) {
  const rawCode = pick(row, ['コード', 'Code', 'Local Code', 'LocalCode']);
  const rawName = pick(row, ['銘柄名', '名称', 'Name', 'Issue Name', 'IssueName']);
  if (!rawCode || !rawName) return null;

  const code = String(rawCode).trim().replace(/\.0$/, '').toUpperCase();
  const name = String(rawName).trim();
  if (!code || !name) return null;

  const market = String(pick(row, ['市場・商品区分', '市場区分', 'Market Segment', 'MarketSegment']) || '').trim();
  const sector = String(pick(row, ['33業種区分', '33業種区分名', 'Sector33', '33 Sector']) || '').trim();
  const scaleCategory = String(pick(row, ['規模区分', 'Scale Category']) || '').trim();

  return {
    code,
    symbol: `${code}.T`,
    shortName: name,
    longName: name,
    displayName: name,
    exchange: 'TYO',
    quoteType: 'EQUITY',
    market,
    sector,
    scaleCategory,
    source: 'jpx-listed-issues',
  };
}

async function loadJpxListedIssues() {
  const cached = getCache('jpx-listed-issues', 12 * 60 * 60 * 1000);
  if (cached) return cached;

  const res = await fetch(JPX_LISTED_ISSUES_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`JPX listed issues fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const issues = rows.map(normalizeJpxRow).filter(Boolean);

  setCache('jpx-listed-issues', issues);
  return issues;
}

async function jpxSearch(query, count = 20) {
  const q = normalizeText(query);
  if (!q) return [];

  const issues = await loadJpxListedIssues();
  const exact = [];
  const startsWith = [];
  const includes = [];

  issues.forEach((issue) => {
    const fields = [issue.code, issue.displayName, issue.shortName, issue.longName, issue.market, issue.sector].map(normalizeText);
    if (fields.some((field) => field === q)) exact.push(issue);
    else if (fields.some((field) => field.startsWith(q))) startsWith.push(issue);
    else if (fields.some((field) => field.includes(q))) includes.push(issue);
  });

  return mergeByCode(exact, startsWith, includes).slice(0, count);
}

async function yahooSearch(query, count = 10) {
  const q = String(query || '').trim();
  if (!q) return [];
  const key = `search:${q}:${count}`;
  const cached = getCache(key, 24 * 60 * 60 * 1000);
  if (cached) return cached;

  const fallback = fallbackSearch(q);
  let jpx = [];
  try {
    jpx = await jpxSearch(q, count * 2);
  } catch (err) {
    console.warn('JPX search fallback failed:', err);
  }

  let yahoo = [];
  try {
    const params = new URLSearchParams({ q, quotesCount: String(count), newsCount: '0', listsCount: '0', lang: 'ja-JP', region: 'JP' });
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?${params}`, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      yahoo = (Array.isArray(data?.quotes) ? data.quotes : [])
        .filter((quote) => String(quote.symbol || '').toUpperCase().endsWith('.T'))
        .map((quote) => {
          const symbol = String(quote.symbol || '').toUpperCase();
          const code = bareCode(symbol);
          const shortName = quote.shortname || quote.shortName || null;
          const longName = quote.longname || quote.longName || null;
          return {
            code,
            symbol,
            shortName,
            longName,
            displayName: longName || shortName || code,
            exchange: quote.exchange || null,
            quoteType: quote.quoteType || null,
            source: 'yahoo-search',
          };
        })
        .filter((item) => item.code);
    }
  } catch (err) {
    console.warn('Yahoo search failed:', err);
  }

  const result = mergeByCode(fallback, jpx, yahoo).slice(0, count);
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

async function searchNameByCode(code) {
  const fallback = fallbackSearch(code).find((item) => item.code === code);
  if (fallback) return fallback;
  try {
    const issues = await loadJpxListedIssues();
    return issues.find((issue) => issue.code === code) || null;
  } catch (_err) {
    return null;
  }
}

async function fetchQuote(rawSymbol) {
  const symbol = symbolOf(rawSymbol);
  const key = `quote:${symbol}`;
  const cached = getCache(key, 30_000);
  if (cached) return { ...cached, source: 'cache' };

  const data = await yahooChart(symbol, { interval: '1d', range: '3mo' });
  const quote = quoteFromChart(symbol, data);
  const code = bareCode(symbol);
  const name = await searchNameByCode(code);
  const payload = name ? { ...quote, shortName: name.displayName, longName: name.displayName, displayName: name.displayName } : quote;
  setCache(key, payload);
  return payload;
}

function normalizeEntryMember(member) {
  return {
    stockCode: String(member?.stockCode || member?.stock_code || member?.code || '').trim(),
    stockName: String(member?.stockName || member?.stock_name || member?.name || '').trim(),
    market: String(member?.market || '').trim() || null,
    position: String(member?.position || '').trim().toUpperCase(),
    slotOrder: Number(member?.slotOrder ?? member?.slot_order),
    weight: Number(member?.weight),
  };
}

function validateEntryPayload(payload) {
  const errors = [];
  const contestId = String(payload?.contestId || '').trim();
  const teamName = String(payload?.teamName || '').trim();
  const formation = String(payload?.formation || '').trim();
  const members = Array.isArray(payload?.members) ? payload.members.map(normalizeEntryMember) : [];

  if (!contestId) errors.push('contestId is required');
  if (contestId && !isUuid(contestId)) errors.push('contestId must be a valid UUID');
  if (!teamName) errors.push('teamName is required');
  if (!FORMATION_COUNTS[formation]) errors.push('formation is invalid');
  if (members.length !== 11) errors.push('members must contain exactly 11 stocks');

  const stockCodes = new Set();
  const slotOrders = new Set();
  const positionCounts = { FW: 0, MF: 0, DF: 0, GK: 0 };

  members.forEach((member, index) => {
    if (!member.stockCode) errors.push(`members[${index}].stockCode is required`);
    if (!member.stockName) errors.push(`members[${index}].stockName is required`);

    if (member.stockCode) {
      if (stockCodes.has(member.stockCode)) errors.push(`duplicate stockCode: ${member.stockCode}`);
      stockCodes.add(member.stockCode);
    }

    if (!POSITIONS.includes(member.position)) {
      errors.push(`members[${index}].position is invalid`);
    } else {
      positionCounts[member.position] += 1;
    }

    if (!Number.isInteger(member.slotOrder) || member.slotOrder < 1 || member.slotOrder > 11) {
      errors.push(`members[${index}].slotOrder must be an integer from 1 to 11`);
    } else if (slotOrders.has(member.slotOrder)) {
      errors.push(`duplicate slotOrder: ${member.slotOrder}`);
    } else {
      slotOrders.add(member.slotOrder);
    }

    if (!Number.isFinite(member.weight) || member.weight <= 0) {
      errors.push(`members[${index}].weight must be greater than 0`);
    }
  });

  const expectedCounts = FORMATION_COUNTS[formation];
  if (expectedCounts) {
    POSITIONS.forEach((position) => {
      if (positionCounts[position] !== expectedCounts[position]) {
        errors.push(`${formation} requires ${expectedCounts[position]} ${position}, got ${positionCounts[position]}`);
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      contestId,
      teamName,
      formation,
      members,
      membersCount: members.length,
      positionCounts,
    },
  };
}

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function persistEntry(entry) {
  const supabase = requireSupabaseAdmin();
  const userId = String(process.env.DEV_USER_ID || '').trim();

  if (!isUuid(userId)) {
    throw httpError(500, 'DEV_USER_ID is not configured as a valid UUID');
  }

  const { data: contest, error: contestError } = await supabase
    .from('contests')
    .select('id,status,entry_deadline')
    .eq('id', entry.contestId)
    .maybeSingle();

  if (contestError) {
    throw httpError(500, 'Failed to load contest', contestError.message);
  }

  if (!contest) {
    throw httpError(404, 'Contest was not found');
  }

  if (contest.status !== 'entry_open') {
    throw httpError(409, `Contest is not accepting entries: ${contest.status}`);
  }

  if (contest.entry_deadline && new Date(contest.entry_deadline).getTime() <= Date.now()) {
    throw httpError(409, 'Contest entry deadline has passed');
  }

  const lockedAt = nowIso();
  const { data: savedEntry, error: entryError } = await supabase
    .from('entries')
    .insert({
      contest_id: entry.contestId,
      user_id: userId,
      team_name: entry.teamName,
      formation: entry.formation,
      status: 'entered',
      locked_at: lockedAt,
    })
    .select('id,contest_id,user_id,team_name,formation,status,locked_at,created_at')
    .single();

  if (entryError) {
    throw httpError(500, 'Failed to save entry', entryError.message);
  }

  const memberRows = entry.members.map((member) => ({
    entry_id: savedEntry.id,
    stock_code: member.stockCode,
    stock_name: member.stockName,
    market: member.market,
    position: member.position,
    slot_order: member.slotOrder,
    weight: member.weight,
  }));

  const { error: membersError } = await supabase
    .from('entry_members')
    .insert(memberRows);

  if (membersError) {
    throw httpError(500, 'Failed to save entry members', membersError.message);
  }

  return {
    ...savedEntry,
    saveMode: 'created',
    membersCount: memberRows.length,
  };
}

app.post('/api/entries', async (req, res) => {
  const validation = validateEntryPayload(req.body);

  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      errors: validation.errors,
      tsServer: nowIso(),
    });
  }

  try {
    const savedEntry = await persistEntry(validation.normalized);

    return res.status(201).json({
      ok: true,
      status: 'saved',
      entryId: savedEntry.id,
      entry: savedEntry,
      tsServer: nowIso(),
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      ok: false,
      error: err.message,
      details: err.details || null,
      tsServer: nowIso(),
    });
  }
});

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
