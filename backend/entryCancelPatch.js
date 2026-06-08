import express from 'express';
import fetch from 'node-fetch';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const DEV_CONTEST_ID = String(process.env.DEV_CONTEST_ID || '5345b8eb-e9ec-4b4b-9549-35b3c4135003').trim();
const ACTIVE_ENTRY_STATUSES = ['draft', 'entered', 'locked'];
const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const nowIso = () => new Date().toISOString();
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const optionalContestId = (value) => {
  const text = String(value || '').trim();
  return isUuid(text) ? text : '';
};
const requiredContestId = (value) => {
  const text = String(value || '').trim();
  return isUuid(text) ? text : DEV_CONTEST_ID;
};
const symbolOf = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper || upper.startsWith('^') || upper.includes('.')) return upper;
  return `${upper}.T`;
};

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toTimestampSeconds(value) {
  const date = toDate(value);
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function dateLabel(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : String(value || '-');
}

function chooseBaseDate(contest, entry, resultDate) {
  const result = toDate(resultDate);
  if (!result) throw httpError(400, 'Invalid resultDate');

  const candidates = [
    { label: 'contest.entry_deadline', value: contest.entry_deadline },
    { label: 'entry.locked_at', value: entry.locked_at },
    { label: 'entry.created_at', value: entry.created_at },
  ]
    .map((candidate) => ({ ...candidate, date: toDate(candidate.value) }))
    .filter((candidate) => candidate.date);

  if (!candidates.length) {
    throw httpError(400, `Base date was not found for entry: ${entry.id}`);
  }

  const usable = candidates.find((candidate) => candidate.date.getTime() <= result.getTime());
  if (usable) return usable.value;

  throw httpError(409, `Calculation date is before all available base dates: ${entry.id}`, {
    resultDate: dateLabel(resultDate),
    candidates: candidates.map((candidate) => ({ label: candidate.label, date: dateLabel(candidate.value) })),
  });
}

function displayStatus(status) {
  if (status === 'draft') return '編成中';
  if (status === 'entered' || status === 'locked') return '確定済み';
  if (status === 'cancelled') return '取消済み';
  return status || '確定済み';
}

function compareEntries(a, b) {
  const aRank = Number.isInteger(a.rank) ? a.rank : null;
  const bRank = Number.isInteger(b.rank) ? b.rank : null;
  if (aRank !== null && bRank !== null) return aRank - bRank;
  if (aRank !== null) return -1;
  if (bRank !== null) return 1;

  const aReturn = a.weightedReturn ?? Number.NEGATIVE_INFINITY;
  const bReturn = b.weightedReturn ?? Number.NEGATIVE_INFINITY;
  if (aReturn !== bReturn) return bReturn - aReturn;

  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

async function loadResultsByEntryId(supabase, entryIds) {
  if (!entryIds.length) return new Map();

  const { data, error } = await supabase
    .from('entry_results')
    .select('entry_id,contest_id,team_return,rank,calculated_at')
    .in('entry_id', entryIds);

  if (error) {
    console.warn('Failed to load entry_results:', error.message);
    return new Map();
  }

  return new Map((data || []).map((result) => [result.entry_id, result]));
}

async function loadContestsById(supabase, contestIds) {
  const ids = [...new Set(contestIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('contests')
    .select('id,name,status')
    .in('id', ids);

  if (error) {
    console.warn('Failed to load contests:', error.message);
    return new Map();
  }

  return new Map((data || []).map((contest) => [contest.id, contest]));
}

function toParticipant(entry, result, contest, fallbackRank) {
  const weightedReturn = toNumber(result?.team_return);
  const resultRank = Number.isInteger(result?.rank) ? result.rank : null;

  return {
    id: entry.id,
    entryId: entry.id,
    contestId: entry.contest_id,
    teamName: entry.team_name,
    team_name: entry.team_name,
    owner: '参加チーム',
    formation: entry.formation,
    matchType: contest?.name || '大会未設定',
    match_type: contest?.name || '大会未設定',
    status: displayStatus(entry.status),
    style: weightedReturn === null ? '集計待ち' : '集計済み',
    rank: resultRank ?? fallbackRank,
    returnPct: weightedReturn,
    return_pct: weightedReturn,
    resultPct: weightedReturn,
    result_pct: weightedReturn,
    weightedReturn,
    weighted_return: weightedReturn,
    createdAt: entry.created_at,
    created_at: entry.created_at,
    lockedAt: entry.locked_at,
    locked_at: entry.locked_at,
    calculatedAt: result?.calculated_at || null,
    calculated_at: result?.calculated_at || null,
  };
}

async function listEntries(contestId) {
  const supabase = requireSupabaseAdmin();

  let query = supabase
    .from('entries')
    .select('id,contest_id,user_id,team_name,formation,status,locked_at,created_at,updated_at')
    .in('status', ACTIVE_ENTRY_STATUSES)
    .order('created_at', { ascending: false })
    .limit(100);

  if (contestId) query = query.eq('contest_id', contestId);

  const { data: entries, error: entriesError } = await query;

  if (entriesError) {
    throw httpError(500, 'Failed to load entries', entriesError.message);
  }

  const rows = entries || [];
  const resultsByEntryId = await loadResultsByEntryId(supabase, rows.map((entry) => entry.id));
  const contestsById = await loadContestsById(supabase, rows.map((entry) => entry.contest_id));

  return rows
    .map((entry, index) => toParticipant(entry, resultsByEntryId.get(entry.id), contestsById.get(entry.contest_id), index + 1))
    .sort(compareEntries)
    .map((entry, index) => ({ ...entry, rank: Number.isInteger(entry.rank) ? entry.rank : index + 1 }));
}

async function loadContest(supabase, contestId) {
  const { data, error } = await supabase
    .from('contests')
    .select('id,name,status,entry_deadline')
    .eq('id', contestId)
    .maybeSingle();

  if (error) throw httpError(500, 'Failed to load contest', error.message);
  if (!data) throw httpError(404, 'Contest was not found');
  return data;
}

async function loadEntriesForCalculation(supabase, contestId) {
  const { data, error } = await supabase
    .from('entries')
    .select('id,contest_id,team_name,formation,status,locked_at,created_at')
    .eq('contest_id', contestId)
    .in('status', ACTIVE_ENTRY_STATUSES)
    .order('created_at', { ascending: true });

  if (error) throw httpError(500, 'Failed to load entries for calculation', error.message);
  return data || [];
}

async function loadMembersForEntries(supabase, entryIds) {
  if (!entryIds.length) return new Map();

  const { data, error } = await supabase
    .from('entry_members')
    .select('entry_id,stock_code,stock_name,position,slot_order,weight')
    .in('entry_id', entryIds)
    .order('slot_order', { ascending: true });

  if (error) throw httpError(500, 'Failed to load entry members', error.message);

  const byEntryId = new Map();
  (data || []).forEach((member) => {
    if (!byEntryId.has(member.entry_id)) byEntryId.set(member.entry_id, []);
    byEntryId.get(member.entry_id).push(member);
  });
  return byEntryId;
}

async function fetchDailyCloses(symbol, startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) throw httpError(400, 'Invalid calculation date');
  if (end.getTime() < start.getTime()) {
    throw httpError(409, `Calculation date is before base date: ${symbol}`, {
      baseDate: dateLabel(startDate),
      resultDate: dateLabel(endDate),
    });
  }

  const period1 = toTimestampSeconds(addDays(start, -10));
  let period2 = toTimestampSeconds(addDays(end, 10));
  if (period1 === null || period2 === null) throw httpError(400, 'Invalid calculation date');
  if (period2 <= period1) period2 = period1 + 30 * 24 * 60 * 60;

  const params = new URLSearchParams({
    interval: '1d',
    period1: String(period1),
    period2: String(period2),
  });

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw httpError(502, `Yahoo chart fetch failed: ${symbol} ${res.status}`, {
      symbol,
      baseDate: dateLabel(startDate),
      resultDate: dateLabel(endDate),
      period1,
      period2,
      body: body.slice(0, 300),
    });
  }

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

function pickCloseOnOrBefore(points, targetDate) {
  const target = new Date(targetDate).getTime();
  return [...points].reverse().find((point) => point.date.getTime() <= target) || points.at(-1) || null;
}

async function calculateMemberReturn(member, baseDate, resultDate) {
  const symbol = symbolOf(member.stock_code);
  const points = await fetchDailyCloses(symbol, baseDate, resultDate);
  const base = pickCloseOnOrAfter(points, baseDate);
  const result = pickCloseOnOrBefore(points, resultDate);

  if (!base || !result || !base.close) {
    throw httpError(502, `Price data was not enough: ${symbol}`, {
      symbol,
      baseDate: dateLabel(baseDate),
      resultDate: dateLabel(resultDate),
    });
  }

  return {
    stockCode: member.stock_code,
    stockName: member.stock_name,
    symbol,
    position: member.position,
    weight: toNumber(member.weight) ?? 0,
    baseClose: base.close,
    resultClose: result.close,
    baseDate: base.date.toISOString(),
    resultDate: result.date.toISOString(),
    returnPct: ((result.close / base.close) - 1) * 100,
  };
}

async function calculateEntryResult(entry, members, contest, resultDate) {
  const baseDate = chooseBaseDate(contest, entry, resultDate);
  if (members.length !== 11) throw httpError(409, `Entry must have exactly 11 members: ${entry.id}`);

  const memberResults = await Promise.all(members.map((member) => calculateMemberReturn(member, baseDate, resultDate)));
  const weightTotal = memberResults.reduce((sum, member) => sum + member.weight, 0);
  if (!Number.isFinite(weightTotal) || weightTotal <= 0) throw httpError(409, `Entry weights are invalid: ${entry.id}`);

  const teamReturn = memberResults.reduce((sum, member) => sum + member.returnPct * member.weight, 0) / weightTotal;

  return {
    entryId: entry.id,
    contestId: entry.contest_id,
    teamName: entry.team_name,
    formation: entry.formation,
    teamReturn,
    baseDate,
    resultDate,
    members: memberResults,
  };
}

async function calculateContestResults(contestId, resultDateInput) {
  const supabase = requireSupabaseAdmin();
  const safeContestId = requiredContestId(contestId);

  const contest = await loadContest(supabase, safeContestId);
  const entries = await loadEntriesForCalculation(supabase, safeContestId);
  if (!entries.length) throw httpError(404, 'No active entries were found for this contest');

  const resultDate = resultDateInput || nowIso();
  const membersByEntryId = await loadMembersForEntries(supabase, entries.map((entry) => entry.id));
  const calculated = await Promise.all(entries.map((entry) => calculateEntryResult(entry, membersByEntryId.get(entry.id) || [], contest, resultDate)));
  const ranked = [...calculated]
    .sort((a, b) => b.teamReturn - a.teamReturn)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const { error: deleteError } = await supabase
    .from('entry_results')
    .delete()
    .eq('contest_id', safeContestId)
    .in('entry_id', ranked.map((item) => item.entryId));

  if (deleteError) throw httpError(500, 'Failed to clear previous entry results', deleteError.message);

  const calculatedAt = nowIso();
  const rows = ranked.map((item) => ({
    entry_id: item.entryId,
    contest_id: item.contestId,
    team_return: Number(item.teamReturn.toFixed(6)),
    rank: item.rank,
    calculated_at: calculatedAt,
  }));

  const { data: savedResults, error: insertError } = await supabase
    .from('entry_results')
    .insert(rows)
    .select('entry_id,contest_id,team_return,rank,calculated_at');

  if (insertError) throw httpError(500, 'Failed to save entry results', insertError.message);

  return {
    contest,
    count: ranked.length,
    calculatedAt,
    results: ranked.map((item) => ({
      entryId: item.entryId,
      contestId: item.contestId,
      rank: item.rank,
      teamName: item.teamName,
      formation: item.formation,
      teamReturn: Number(item.teamReturn.toFixed(6)),
      baseDate: item.baseDate,
      resultDate: item.resultDate,
      members: item.members,
    })),
    savedResults,
  };
}

async function cancelActiveEntry(contestId) {
  const supabase = requireSupabaseAdmin();
  const userId = String(process.env.DEV_USER_ID || '').trim();

  if (!isUuid(contestId)) {
    throw httpError(400, 'contestId must be a valid UUID');
  }

  if (!isUuid(userId)) {
    throw httpError(500, 'DEV_USER_ID is not configured as a valid UUID');
  }

  const { data: existingEntry, error: findError } = await supabase
    .from('entries')
    .select('id,status,contest_id,user_id,team_name,formation,created_at,locked_at')
    .eq('contest_id', contestId)
    .eq('user_id', userId)
    .in('status', ACTIVE_ENTRY_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw httpError(500, 'Failed to check existing entry', findError.message);
  }

  if (!existingEntry) {
    throw httpError(404, 'Active entry was not found for this contest');
  }

  const { data: cancelledEntry, error: updateError } = await supabase
    .from('entries')
    .update({
      status: 'cancelled',
      updated_at: nowIso(),
    })
    .eq('id', existingEntry.id)
    .select('id,status,contest_id,user_id,team_name,formation,created_at,locked_at,updated_at')
    .single();

  if (updateError) {
    throw httpError(500, 'Failed to cancel entry', updateError.message);
  }

  return cancelledEntry;
}

const originalListen = express.application.listen;

express.application.listen = function patchedListen(...args) {
  if (!this.__entryRoutesReady) {
    this.__entryRoutesReady = true;

    this.get('/api/entries', async (req, res) => {
      const rawContestId = req.query?.contestId || req.query?.contest_id || '';
      const contestId = optionalContestId(rawContestId);

      try {
        const entries = await listEntries(contestId);
        return res.json({
          ok: true,
          entries,
          participants: entries,
          count: entries.length,
          contestId: contestId || null,
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

    this.post('/api/results/calculate', async (req, res) => {
      const rawContestId = req.body?.contestId || req.body?.contest_id || req.query?.contestId || req.query?.contest_id || '';
      const contestId = requiredContestId(rawContestId);
      const resultDate = String(req.body?.resultDate || req.body?.result_date || req.query?.resultDate || req.query?.result_date || '').trim() || null;

      try {
        const result = await calculateContestResults(contestId, resultDate);
        return res.json({
          ok: true,
          status: 'calculated',
          ...result,
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

    this.post('/api/entries/cancel', async (req, res) => {
      const contestId = String(req.body?.contestId || req.body?.contest_id || '').trim();

      try {
        const entry = await cancelActiveEntry(contestId);
        return res.json({
          ok: true,
          status: 'cancelled',
          entry,
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
  }

  return originalListen.apply(this, args);
};
