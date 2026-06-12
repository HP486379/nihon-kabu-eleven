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

  return {
    ...savedEntry,
    match_type: savedEntry.match_type || entry.matchType,
    period_id: savedEntry.period_id || entry.periodId,
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

function toParticipant(entry, fallbackRank) {
  const matchType = inferMatchType(entry);
  const displayTeamName = entry.display_team_name || stripTeamPrefix(entry.team_name);
  const displayUserName = entry.display_user_name || stripUserPrefix(entry.owner || entry.user_name || '参加チーム');
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
    periodId: entry.period_id || periodIdFor(matchType),
    period_id: entry.period_id || periodIdFor(matchType),
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
  };
}

async function listEntries(contestId) {
  const supabase = requireSupabaseAdmin();
  let query = supabase
    .from('entries')
    .select('*')
    .in('status', ACTIVE_ENTRY_STATUSES)
    .order('created_at', { ascending: false })
    .limit(100);

  if (contestId) query = query.eq('contest_id', contestId);

  const { data, error } = await query;
  if (error) throw httpError(500, 'Failed to load entries', error.message);

  return (data || []).map((entry, index) => toParticipant(entry, index + 1));
}

async function postEntriesHandler(req, res) {
  try {
    const normalized = normalizePayload(req.body || {});
    const savedEntry = await persistEntry(normalized);
    return res.status(201).json({
      ok: true,
      status: 'saved',
      entryId: savedEntry.id,
      entry: savedEntry,
      matchType: savedEntry.match_type,
      match_type: savedEntry.match_type,
      periodId: savedEntry.period_id,
      period_id: savedEntry.period_id,
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
