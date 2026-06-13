import express from 'express';
import fetch from 'node-fetch';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const DEV_CONTEST_ID = String(process.env.DEV_CONTEST_ID || '5345b8eb-e9ec-4b4b-9549-35b3c4135003').trim();
const ACTIVE_RESULT_ENTRY_STATUSES = ['entered', 'locked'];
const MATCH_TYPES = ['daily', 'weekly', 'monthly', 'quarterly'];
const RESULT_STATUSES = ['provisional', 'final'];
const CALCULATION_VERSION = 'weighted-return-v1';
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nowIso = () => new Date().toISOString();
const isUuid = (value) => UUID_PATTERN.test(String(value || ''));
const text = (value) => String(value || '').trim();

const FORMATION_POSITION_WEIGHTS = {
  '4-3-3': { FW: 0.35, MF: 0.30, DF: 0.25, GK: 0.10 },
  '4-2-3-1': { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 },
  '4-4-2': { FW: 0.30, MF: 0.35, DF: 0.25, GK: 0.10 },
  '3-5-2': { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 },
  '3-4-3': { FW: 0.38, MF: 0.32, DF: 0.20, GK: 0.10 },
  '5-3-2': { FW: 0.22, MF: 0.28, DF: 0.40, GK: 0.10 },
  '3-4-2-1': { FW: 0.28, MF: 0.42, DF: 0.20, GK: 0.10 },
  '5-4-1': { FW: 0.20, MF: 0.30, DF: 0.40, GK: 0.10 },
};

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function toTimestampSeconds(value) {
  const date = toDate(value);
  return date ? Math.floor(date.getTime() / 1000) : null;
}

function dateLabel(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function symbolOf(value) {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper || upper.startsWith('^') || upper.includes('.')) return upper;
  return `${upper}.T`;
}

function normalizeMatchType(value, fallback = 'daily') {
  const candidate = text(value || fallback);
  return MATCH_TYPES.includes(candidate) ? candidate : fallback;
}

function periodIdFor(matchType, dateValue = nowIso()) {
  const date = toDate(dateValue) || new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (matchType === 'daily') return `daily_${year}-${month}-${day}`;
  if (matchType === 'monthly') return `monthly_${year}-${month}`;
  if (matchType === 'quarterly') return `quarterly_${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;

  const tmp = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `weekly_${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function requiredContestId(value) {
  const candidate = text(value);
  return isUuid(candidate) ? candidate : DEV_CONTEST_ID;
}

function pickResultStatus(value, defaultStatus = 'provisional') {
  const candidate = text(value || defaultStatus);
  return RESULT_STATUSES.includes(candidate) ? candidate : defaultStatus;
}

function chooseBaseDate(entry) {
  const fromEntry = entry.locked_at || entry.created_at;
  if (toDate(fromEntry)) return fromEntry;
  throw httpError(400, `Base date was not found for entry: ${entry.id}`);
}

function inferEntryDisplay(entry) {
  return {
    displayUserName: entry.display_user_name || entry.user_name || entry.owner || '参加チーム',
    displayTeamName: entry.display_team_name || entry.team_name || '名称未設定チーム',
    ownerKey: entry.owner_key || entry.user_id || null,
  };
}

async function fetchDailyCloses(symbol, startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) throw httpError(400, 'Invalid calculation date');
  if (end.getTime() < start.getTime()) {
    throw httpError(409, `Calculation date is before base date: ${symbol}`, {
      startDate: dateLabel(startDate),
      endDate: dateLabel(endDate),
    });
  }

  const period1 = toTimestampSeconds(addDays(start, -10));
  let period2 = toTimestampSeconds(addDays(end, 10));
  if (period1 === null || period2 === null) throw httpError(400, 'Invalid calculation date');
  if (period2 <= period1) period2 = period1 + 30 * 24 * 60 * 60;

  const params = new URLSearchParams({ interval: '1d', period1: String(period1), period2: String(period2) });
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw httpError(502, `Yahoo chart fetch failed: ${symbol} ${res.status}`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];

  return timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000),
    close: closes[index],
  })).filter((point) => typeof point.close === 'number' && Number.isFinite(point.close));
}

function pickCloseOnOrAfter(points, targetDate) {
  const target = new Date(targetDate).getTime();
  return points.find((point) => point.date.getTime() >= target) || points[0] || null;
}

function positionCounts(members) {
  return members.reduce((acc, member) => {
    const position = text(member.position).toUpperCase();
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {});
}

async function calculateMember(member, entry, baseDate, resultDate, counts) {
  const formationWeights = FORMATION_POSITION_WEIGHTS[entry.formation] || FORMATION_POSITION_WEIGHTS['4-3-3'];
  const position = text(member.position).toUpperCase();
  const positionCount = counts[position] || 1;
  const effectiveWeight = (formationWeights[position] || 0) / positionCount;
  const symbol = symbolOf(member.stock_code);
  const points = await fetchDailyCloses(symbol, baseDate, resultDate);
  const start = pickCloseOnOrAfter(points, baseDate);
  const end = pickCloseOnOrAfter(points, resultDate);

  if (!start || !end || !start.close) {
    throw httpError(502, `Price data was not enough: ${symbol}`, { symbol, baseDate: dateLabel(baseDate), resultDate: dateLabel(resultDate) });
  }

  const returnRate = end.close / start.close - 1;
  const contribution = returnRate * effectiveWeight;

  return {
    code: member.stock_code,
    name: member.stock_name,
    symbol,
    position,
    slot_order: member.slot_order,
    weight: Number(effectiveWeight.toFixed(10)),
    start_price: start.close,
    end_price: end.close,
    start_date: start.date.toISOString(),
    end_date: end.date.toISOString(),
    return_rate: Number(returnRate.toFixed(10)),
    contribution: Number(contribution.toFixed(10)),
  };
}

async function loadEntriesForResults(supabase, contestId, matchType, periodId) {
  const { data, error } = await supabase
    .from('entries')
    .select('id,contest_id,user_id,team_name,display_team_name,display_user_name,owner_key,formation,status,match_type,period_id,locked_at,created_at')
    .eq('contest_id', contestId)
    .eq('match_type', matchType)
    .eq('period_id', periodId)
    .in('status', ACTIVE_RESULT_ENTRY_STATUSES)
    .order('created_at', { ascending: true });

  if (error) throw httpError(500, 'Failed to load entries for result calculation', error.message);
  return data || [];
}

async function loadMembersByEntryId(supabase, entryIds) {
  if (!entryIds.length) return new Map();

  const { data, error } = await supabase
    .from('entry_members')
    .select('entry_id,stock_code,stock_name,position,slot_order,weight')
    .in('entry_id', entryIds)
    .order('slot_order', { ascending: true });

  if (error) throw httpError(500, 'Failed to load entry members', error.message);

  const map = new Map();
  (data || []).forEach((member) => {
    if (!map.has(member.entry_id)) map.set(member.entry_id, []);
    map.get(member.entry_id).push(member);
  });
  return map;
}

async function loadEntryFormations(supabase, entryIds) {
  if (!entryIds.length) return new Map();

  const { data, error } = await supabase
    .from('entries')
    .select('id,formation')
    .in('id', entryIds);

  if (error) throw httpError(500, 'Failed to load entry formations', error.message);

  return new Map((data || []).map((entry) => [entry.id, entry.formation || null]));
}

function attachFormations(rows, formationByEntryId) {
  return rows.map((row) => ({
    ...row,
    formation: row.formation || formationByEntryId.get(row.entry_id) || null,
  }));
}

async function calculateOneEntry(entry, members, resultDate) {
  if (members.length !== 11) throw httpError(409, `Entry must have exactly 11 members: ${entry.id}`);

  const baseDate = chooseBaseDate(entry);
  const counts = positionCounts(members);
  const stockReturns = await Promise.all(members.map((member) => calculateMember(member, entry, baseDate, resultDate, counts)));
  const weightedReturn = stockReturns.reduce((sum, member) => sum + member.contribution, 0);
  const display = inferEntryDisplay(entry);

  return {
    entry,
    entryId: entry.id,
    contestId: entry.contest_id,
    matchType: entry.match_type,
    periodId: entry.period_id,
    ownerKey: display.ownerKey,
    displayUserName: display.displayUserName,
    displayTeamName: display.displayTeamName,
    formation: entry.formation,
    weightedReturn,
    stockReturns,
    baseDate,
    resultDate,
  };
}

function assignRanks(calculated) {
  const sorted = [...calculated].sort((a, b) => {
    if (b.weightedReturn !== a.weightedReturn) return b.weightedReturn - a.weightedReturn;
    return String(a.entry.created_at || '').localeCompare(String(b.entry.created_at || '')) || String(a.entryId).localeCompare(String(b.entryId));
  });

  let lastReturn = null;
  let lastRank = 0;
  return sorted.map((item, index) => {
    const rank = lastReturn !== null && item.weightedReturn === lastReturn ? lastRank : index + 1;
    lastReturn = item.weightedReturn;
    lastRank = rank;
    return { ...item, rank, rankOrder: index + 1 };
  });
}

async function saveResults(supabase, ranked, resultStatus) {
  const calculatedAt = nowIso();
  const rows = ranked.map((item) => ({
    contest_id: item.contestId,
    entry_id: item.entryId,
    match_type: item.matchType,
    period_id: item.periodId,
    owner_key: item.ownerKey,
    display_user_name: item.displayUserName,
    display_team_name: item.displayTeamName,
    weighted_return: Number(item.weightedReturn.toFixed(10)),
    team_return: Number((item.weightedReturn * 100).toFixed(6)),
    rank: item.rank,
    rank_order: item.rankOrder,
    stock_returns: item.stockReturns,
    result_status: resultStatus,
    calculation_version: CALCULATION_VERSION,
    calculated_at: calculatedAt,
    finalized_at: resultStatus === 'final' ? calculatedAt : null,
    updated_at: calculatedAt,
  }));

  const { data, error } = await supabase
    .from('entry_results')
    .upsert(rows, { onConflict: 'contest_id,match_type,period_id,entry_id' })
    .select('*');

  if (error) throw httpError(500, 'Failed to save entry results', error.message);
  return { rows: data || [], calculatedAt };
}

function toResultPayload(row) {
  const weightedReturn = numberOrNull(row.weighted_return) ?? ((numberOrNull(row.team_return) ?? 0) / 100);
  return {
    id: row.id,
    entryId: row.entry_id,
    entry_id: row.entry_id,
    contestId: row.contest_id,
    contest_id: row.contest_id,
    matchType: row.match_type,
    match_type: row.match_type,
    periodId: row.period_id,
    period_id: row.period_id,
    ownerKey: row.owner_key,
    owner_key: row.owner_key,
    userName: row.display_user_name,
    user_name: row.display_user_name,
    teamName: row.display_team_name,
    team_name: row.display_team_name,
    formation: row.formation || null,
    weightedReturn,
    weighted_return: weightedReturn,
    returnPct: Number((weightedReturn * 100).toFixed(6)),
    return_pct: Number((weightedReturn * 100).toFixed(6)),
    rank: row.rank,
    rankOrder: row.rank_order,
    rank_order: row.rank_order,
    stockReturns: row.stock_returns || [],
    stock_returns: row.stock_returns || [],
    resultStatus: row.result_status,
    result_status: row.result_status,
    calculationVersion: row.calculation_version,
    calculation_version: row.calculation_version,
    calculatedAt: row.calculated_at,
    calculated_at: row.calculated_at,
    finalizedAt: row.finalized_at,
    finalized_at: row.finalized_at,
  };
}

async function calculateFormalResults(input) {
  const supabase = requireSupabaseAdmin();
  const contestId = requiredContestId(input.contestId || input.contest_id);
  const matchType = normalizeMatchType(input.matchType || input.match_type);
  const periodId = text(input.periodId || input.period_id) || periodIdFor(matchType);
  const resultDate = text(input.resultDate || input.result_date) || nowIso();
  const resultStatus = pickResultStatus(input.resultStatus || input.result_status);

  const entries = await loadEntriesForResults(supabase, contestId, matchType, periodId);
  if (!entries.length) throw httpError(404, 'No active entries were found for this match_type / period_id', { contestId, matchType, periodId });

  const membersByEntryId = await loadMembersByEntryId(supabase, entries.map((entry) => entry.id));
  const calculated = await Promise.all(entries.map((entry) => calculateOneEntry(entry, membersByEntryId.get(entry.id) || [], resultDate)));
  const ranked = assignRanks(calculated);
  const saved = await saveResults(supabase, ranked, resultStatus);
  const formationByEntryId = new Map(ranked.map((item) => [item.entryId, item.formation || null]));
  const rows = attachFormations(saved.rows, formationByEntryId);

  return {
    contestId,
    matchType,
    periodId,
    resultStatus,
    calculationVersion: CALCULATION_VERSION,
    count: rows.length,
    calculatedAt: saved.calculatedAt,
    results: rows.map(toResultPayload).sort((a, b) => (a.rankOrder || 999999) - (b.rankOrder || 999999)),
  };
}

async function listFormalResults(query) {
  const supabase = requireSupabaseAdmin();
  const contestId = requiredContestId(query.contestId || query.contest_id);
  const matchType = normalizeMatchType(query.matchType || query.match_type);
  const periodId = text(query.periodId || query.period_id) || periodIdFor(matchType);

  const { data, error } = await supabase
    .from('entry_results')
    .select('*')
    .eq('contest_id', contestId)
    .eq('match_type', matchType)
    .eq('period_id', periodId)
    .order('rank_order', { ascending: true });

  if (error) throw httpError(500, 'Failed to load entry results', error.message);

  const rows = data || [];
  const formationByEntryId = await loadEntryFormations(supabase, rows.map((row) => row.entry_id));
  const rowsWithFormations = attachFormations(rows, formationByEntryId);

  return {
    contestId,
    matchType,
    periodId,
    count: rowsWithFormations.length,
    results: rowsWithFormations.map(toResultPayload),
  };
}

function sendError(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    error: err.message,
    details: err.details || null,
    tsServer: nowIso(),
  });
}

const previousPost = express.application.post;
express.application.post = function formalResultsPost(path, ...handlers) {
  if (path === '/api/results/calculate') {
    return previousPost.call(this, path, async (req, res) => {
      try {
        const result = await calculateFormalResults({ ...(req.query || {}), ...(req.body || {}) });
        return res.json({ ok: true, status: 'calculated', ...result, tsServer: nowIso() });
      } catch (err) {
        return sendError(res, err);
      }
    });
  }
  return previousPost.call(this, path, ...handlers);
};

const previousListen = express.application.listen;
express.application.listen = function formalResultsListen(...args) {
  if (!this.__formalResultRoutesReady) {
    this.__formalResultRoutesReady = true;

    this.get('/api/results', async (req, res) => {
      try {
        const result = await listFormalResults(req.query || {});
        return res.json({ ok: true, ...result, tsServer: nowIso() });
      } catch (err) {
        return sendError(res, err);
      }
    });
  }

  return previousListen.apply(this, args);
};
