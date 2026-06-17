import express from 'express';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const DEV_CONTEST_ID = String(process.env.DEV_CONTEST_ID || '5345b8eb-e9ec-4b4b-9549-35b3c4135003').trim();
const ACTIVE_ENTRY_STATUSES = ['draft', 'entered', 'locked'];
const MATCH_TYPES = ['daily', 'weekly', 'monthly', 'quarterly'];
const USER_PREFIX_RE = /^(weekly|monthly|quarterly)__/;
const TEAM_PREFIX_RE = /^\[\[(weekly|monthly|quarterly)\]\]/;
const OWNER_SUFFIX_RE = /__(daily|weekly|monthly|quarterly)$/;

const nowIso = () => new Date().toISOString();
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const isMatchType = (value) => MATCH_TYPES.includes(String(value || '').trim());

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function firstText(...values) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function inferMatchType(payloadOrEntry) {
  const explicit = firstText(payloadOrEntry.matchType, payloadOrEntry.match_type, payloadOrEntry.contestType, payloadOrEntry.contest_type);
  if (isMatchType(explicit)) return explicit;

  const userName = firstText(payloadOrEntry.userName, payloadOrEntry.user_name, payloadOrEntry.owner);
  const teamName = firstText(payloadOrEntry.teamName, payloadOrEntry.team_name);
  const ownerKey = firstText(payloadOrEntry.ownerKey, payloadOrEntry.owner_key);

  const userPrefix = userName.match(USER_PREFIX_RE)?.[1];
  if (isMatchType(userPrefix)) return userPrefix;

  const teamPrefix = teamName.match(TEAM_PREFIX_RE)?.[1];
  if (isMatchType(teamPrefix)) return teamPrefix;

  const ownerSuffix = ownerKey.match(OWNER_SUFFIX_RE)?.[1];
  if (isMatchType(ownerSuffix)) return ownerSuffix;

  return 'daily';
}

function stripUserPrefix(value) {
  return String(value || '').trim().replace(USER_PREFIX_RE, '');
}

function stripTeamPrefix(value) {
  return String(value || '').trim().replace(TEAM_PREFIX_RE, '');
}

function stripOwnerSuffix(value) {
  return String(value || '').trim().replace(OWNER_SUFFIX_RE, '');
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextBusinessDay(date) {
  let next = addUtcDays(date, 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addUtcDays(next, 1);
  return next;
}

function normalizeToBusinessDay(date) {
  let next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = addUtcDays(next, 1);
  return next;
}

function periodIdFor(matchType, date = new Date()) {
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

function isoWeekStartDate(year, weekNo) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const week1Monday = addUtcDays(jan4, 1 - dayNum);
  return addUtcDays(week1Monday, (weekNo - 1) * 7);
}

function periodStartDateFor(matchType, periodId, fallbackDate = new Date()) {
  const fallback = new Date(Date.UTC(fallbackDate.getUTCFullYear(), fallbackDate.getUTCMonth(), fallbackDate.getUTCDate()));

  if (matchType === 'daily') {
    const match = String(periodId || '').match(/^daily_(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return fallback;
  }

  if (matchType === 'weekly') {
    const match = String(periodId || '').match(/^weekly_(\d{4})-W(\d{2})$/);
    if (match) return isoWeekStartDate(Number(match[1]), Number(match[2]));
    const dayNum = fallback.getUTCDay() || 7;
    return addUtcDays(fallback, 1 - dayNum);
  }

  if (matchType === 'monthly') {
    const match = String(periodId || '').match(/^monthly_(\d{4})-(\d{2})$/);
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
  }

  if (matchType === 'quarterly') {
    const match = String(periodId || '').match(/^quarterly_(\d{4})-Q([1-4])$/);
    if (match) return new Date(Date.UTC(Number(match[1]), (Number(match[2]) - 1) * 3, 1));
    return new Date(Date.UTC(fallback.getUTCFullYear(), Math.floor(fallback.getUTCMonth() / 3) * 3, 1));
  }

  return fallback;
}

function resultDateFor(matchType, baseDate) {
  if (matchType === 'daily') return nextBusinessDay(baseDate);
  if (matchType === 'weekly') return normalizeToBusinessDay(addUtcDays(baseDate, 7));

  const months = matchType === 'quarterly' ? 3 : 1;
  const result = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + months, baseDate.getUTCDate()));
  return normalizeToBusinessDay(result);
}

function periodMetaFor(matchType, periodId = '', date = new Date()) {
  const safeMatchType = isMatchType(matchType) ? matchType : 'daily';
  const resolvedPeriodId = firstText(periodId) || periodIdFor(safeMatchType, date);
  const baseDate = periodStartDateFor(safeMatchType, resolvedPeriodId, date);
  const resultDate = resultDateFor(safeMatchType, baseDate);

  return {
    matchType: safeMatchType,
    match_type: safeMatchType,
    periodId: resolvedPeriodId,
    period_id: resolvedPeriodId,
    baseDate: toDateOnly(baseDate),
    base_date: toDateOnly(baseDate),
    resultDate: toDateOnly(resultDate),
    result_date: toDateOnly(resultDate),
    resultBasis: 'scheduled_close',
    result_basis: 'scheduled_close',
  };
}

function normalizePayload(body) {
  const contestId = isUuid(body?.contestId || body?.contest_id) ? String(body.contestId || body.contest_id).trim() : DEV_CONTEST_ID;
  const teamName = firstText(body?.teamName, body?.team_name);
  const userName = firstText(body?.userName, body?.user_name, body?.owner);
  const ownerKey = firstText(body?.ownerKey, body?.owner_key);
  const formation = firstText(body?.formation);
  const members = Array.isArray(body?.members) ? body.members : [];

  if (!teamName) throw httpError(400, 'teamName is required');
  if (!formation) throw httpError(400, 'formation is required');
  if (!members.length) throw httpError(400, 'members are required');

  const matchType = inferMatchType(body || {});
  const periodId = firstText(body?.periodId, body?.period_id) || periodIdFor(matchType);
  const periodMeta = periodMetaFor(matchType, periodId);
  const displayTeamName = firstText(body?.displayTeamName, body?.display_team_name) || stripTeamPrefix(teamName);
  const displayUserName = firstText(body?.displayUserName, body?.display_user_name) || stripUserPrefix(userName);
  const ownerKeyBase = firstText(body?.ownerKeyBase, body?.owner_key_base) || stripOwnerSuffix(ownerKey);

  return {
    contestId,
    teamName,
    userName,
    ownerKey,
    ownerKeyBase,
    formation,
    members,
    matchType,
    periodId,
    baseDate: periodMeta.baseDate,
    resultDate: periodMeta.resultDate,
    displayTeamName,
    displayUserName,
  };
}

function columnMissing(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('match_type') || text.includes('period_id') || text.includes('display_user_name') || text.includes('display_team_name') || text.includes('owner_key');
}

async function loadContest(supabase, contestId) {
  const { data, error } = await supabase
    .from('contests')
    .select('id,status,entry_deadline')
    .eq('id', contestId)
    .maybeSingle();

  if (error) throw httpError(500, 'Failed to load contest', error.message);
  if (!data) throw httpError(404, 'Contest was not found');
  if (data.status !== 'entry_open') throw httpError(409, `Contest is not accepting entries: ${data.status}`);
  if (data.entry_deadline && new Date(data.entry_deadline).getTime() <= Date.now()) throw httpError(409, 'Contest entry deadline has passed');
  return data;
}

async function insertEntry(supabase, entry, userId, includeFormalColumns) {
  const lockedAt = nowIso();
  const baseRow = {
    contest_id: entry.contestId,
    user_id: userId,
    team_name: entry.teamName,
    formation: entry.formation,
    status: 'entered',
    locked_at: lockedAt,
  };

  const formalRow = includeFormalColumns
    ? {
      ...baseRow,
      match_type: entry.matchType,
      period_id: entry.periodId,
      display_user_name: entry.displayUserName,
      display_team_name: entry.displayTeamName,
      owner_key: entry.ownerKey,
    }
    : baseRow;

  const { data, error } = await supabase
    .from('entries')
    .insert(formalRow)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function persistEntry(entry) {
  const supabase = requireSupabaseAdmin();
  const userId = String(process.env.DEV_USER_ID || '').trim();
  if (!isUuid(userId)) throw httpError(500, 'DEV_USER_ID is not configured as a valid UUID');

  await loadContest(supabase, entry.contestId);

  let savedEntry;
  try {
    savedEntry = await insertEntry(supabase, entry, userId, true);
  } catch (error) {
    if (!columnMissing(error)) throw httpError(500, 'Failed to save entry', error.message);
    savedEntry = await insertEntry(supabase, entry, userId, false);
  }

  const memberRows = entry.members.map((member) => ({
    entry_id: savedEntry.id,
    stock_code: member.stockCode || member.stock_code || member.code,
    stock_name: member.stockName || member.stock_name || member.name || member.stockCode || member.stock_code || member.code,
    market: member.market || '任意追加',
    position: member.position || 'MF',
    slot_order: member.slotOrder || member.slot_order || 1,
    weight: member.weight || 0,
  }));

  const { error: membersError } = await supabase.from('entry_members').insert(memberRows);
  if (membersError) throw httpError(500, 'Failed to save entry members', membersError.message);

  const periodMeta = periodMetaFor(savedEntry.match_type || entry.matchType, savedEntry.period_id || entry.periodId);

  return {
    ...savedEntry,
    match_type: savedEntry.match_type || entry.matchType,
    period_id: savedEntry.period_id || entry.periodId,
    base_date: periodMeta.base_date,
    result_date: periodMeta.result_date,
    display_user_name: savedEntry.display_user_name || entry.displayUserName,
    display_team_name: savedEntry.display_team_name || entry.displayTeamName,
    owner_key: savedEntry.owner_key || entry.ownerKey,
    saveMode: 'created',
    membersCount: memberRows.length,
  };
}

function displayStatus(status) {
  if (status === 'draft') return '編成中';
  if (status === 'entered' || status === 'locked') return '確定済み';
  if (status === 'cancelled') return '取消済み';
  return status || '確定済み';
}

function normalizeMember(member) {
  return {
    id: member.id || null,
    entryId: member.entry_id || null,
    entry_id: member.entry_id || null,
    stockCode: member.stock_code || null,
    stock_code: member.stock_code || null,
    code: member.stock_code || null,
    stockName: member.stock_name || member.stock_code || '',
    stock_name: member.stock_name || member.stock_code || '',
    name: member.stock_name || member.stock_code || '',
    market: member.market || '日本株',
    position: member.position || 'MF',
    slotOrder: member.slot_order || 999,
    slot_order: member.slot_order || 999,
    weight: member.weight || 0,
  };
}

function toParticipant(entry, fallbackRank) {
  const matchType = inferMatchType(entry);
  const periodId = entry.period_id || periodIdFor(matchType);
  const periodMeta = periodMetaFor(matchType, periodId);
  const displayTeamName = entry.display_team_name || stripTeamPrefix(entry.team_name);
  const displayUserName = entry.display_user_name || stripUserPrefix(entry.owner || entry.user_name || '参加チーム');
  const members = Array.isArray(entry.entry_members) ? entry.entry_members.map(normalizeMember) : [];
  return {
    id: entry.id,
    entryId: entry.id,
    contestId: entry.contest_id,
    contest_id: entry.contest_id,
    teamName: displayTeamName,
    team_name: displayTeamName,
    rawTeamName: entry.team_name,
    raw_team_name: entry.team_name,
    owner: displayUserName || '参加チーム',
    userName: displayUserName,
    user_name: displayUserName,
    ownerKey: entry.owner_key || null,
    owner_key: entry.owner_key || null,
    formation: entry.formation,
    matchType,
    match_type: matchType,
    periodId,
    period_id: periodId,
    baseDate: periodMeta.baseDate,
    base_date: periodMeta.base_date,
    resultDate: periodMeta.resultDate,
    result_date: periodMeta.result_date,
    resultBasis: periodMeta.resultBasis,
    result_basis: periodMeta.result_basis,
    status: displayStatus(entry.status),
    style: '集計待ち',
    rank: fallbackRank,
    returnPct: null,
    return_pct: null,
    resultPct: null,
    result_pct: null,
    weightedReturn: null,
    weighted_return: null,
    createdAt: entry.created_at,
    created_at: entry.created_at,
    lockedAt: entry.locked_at,
    locked_at: entry.locked_at,
    calculatedAt: null,
    calculated_at: null,
    members,
    entry_members: members,
  };
}

function entryBelongsToCurrentPeriod(entry, requestedMatchType = '', requestedPeriodId = '') {
  const entryMatchType = inferMatchType(entry);
  if (requestedMatchType && entryMatchType !== requestedMatchType) return false;

  const entryPeriodId = firstText(entry.period_id, entry.periodId);
  if (!entryPeriodId) return false;

  const activePeriodId = requestedPeriodId || periodIdFor(entryMatchType);
  return entryPeriodId === activePeriodId;
}

async function attachEntryMembers(supabase, entries) {
  const entryIds = [...new Set((entries || []).map((entry) => entry.id).filter(Boolean))];
  if (entryIds.length === 0) return entries || [];

  const { data, error } = await supabase
    .from('entry_members')
    .select('id,entry_id,stock_code,stock_name,market,position,slot_order,weight')
    .in('entry_id', entryIds)
    .order('slot_order', { ascending: true });

  if (error) throw httpError(500, 'Failed to load entry members', error.message);

  const grouped = new Map();
  (data || []).forEach((member) => {
    const key = member.entry_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(member);
  });

  return (entries || []).map((entry) => ({
    ...entry,
    entry_members: grouped.get(entry.id) || [],
  }));
}

async function listEntries(contestId, requestedMatchType = '', requestedPeriodId = '') {
  const supabase = requireSupabaseAdmin();
  const matchType = isMatchType(requestedMatchType) ? requestedMatchType : '';
  const periodId = firstText(requestedPeriodId) || (matchType ? periodIdFor(matchType) : '');

  let query = supabase
    .from('entries')
    .select('*')
    .in('status', ACTIVE_ENTRY_STATUSES)
    .order('created_at', { ascending: false })
    .limit(100);

  if (contestId) query = query.eq('contest_id', contestId);
  if (matchType) query = query.eq('match_type', matchType);
  if (periodId) query = query.eq('period_id', periodId);

  const { data, error } = await query;
  if (error) throw httpError(500, 'Failed to load entries', error.message);

  const currentPeriodEntries = (data || []).filter((entry) => entryBelongsToCurrentPeriod(entry, matchType, periodId));
  const entriesWithMembers = await attachEntryMembers(supabase, currentPeriodEntries);
  return entriesWithMembers.map((entry, index) => toParticipant(entry, index + 1));
}

async function postEntriesHandler(req, res) {
  try {
    const normalized = normalizePayload(req.body || {});
    const savedEntry = await persistEntry(normalized);
    const periodMeta = periodMetaFor(savedEntry.match_type, savedEntry.period_id);
    return res.status(201).json({
      ok: true,
      status: 'saved',
      entryId: savedEntry.id,
      entry: savedEntry,
      matchType: savedEntry.match_type,
      match_type: savedEntry.match_type,
      periodId: savedEntry.period_id,
      period_id: savedEntry.period_id,
      baseDate: periodMeta.baseDate,
      base_date: periodMeta.base_date,
      resultDate: periodMeta.resultDate,
      result_date: periodMeta.result_date,
      period: periodMeta,
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
}

async function getEntriesHandler(req, res) {
  const rawContestId = req.query?.contestId || req.query?.contest_id || '';
  const contestId = isUuid(rawContestId) ? String(rawContestId).trim() : '';
  const rawMatchType = firstText(req.query?.matchType, req.query?.match_type);
  const matchType = isMatchType(rawMatchType) ? rawMatchType : '';
  const periodId = firstText(req.query?.periodId, req.query?.period_id) || (matchType ? periodIdFor(matchType) : '');
  const periodMeta = matchType ? periodMetaFor(matchType, periodId) : null;

  try {
    const entries = await listEntries(contestId, matchType, periodId);
    return res.json({
      ok: true,
      entries,
      participants: entries,
      count: entries.length,
      contestId: contestId || null,
      matchType: matchType || null,
      match_type: matchType || null,
      periodId: periodId || null,
      period_id: periodId || null,
      baseDate: periodMeta?.baseDate || null,
      base_date: periodMeta?.base_date || null,
      resultDate: periodMeta?.resultDate || null,
      result_date: periodMeta?.result_date || null,
      period: periodMeta,
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
}

const originalPost = express.application.post;
express.application.post = function formalEntryPost(path, ...handlers) {
  if (path === '/api/entries') {
    return originalPost.call(this, path, postEntriesHandler);
  }
  return originalPost.call(this, path, ...handlers);
};

const previousListen = express.application.listen;
express.application.listen = function formalEntryListen(...args) {
  if (!this.__formalEntrySchemaRoutesReady) {
    this.__formalEntrySchemaRoutesReady = true;
    this.get('/api/entries', getEntriesHandler);
  }
  return previousListen.apply(this, args);
};
