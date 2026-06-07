import express from 'express';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const ACTIVE_ENTRY_STATUSES = ['draft', 'entered', 'locked'];
const nowIso = () => new Date().toISOString();
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

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
      const contestId = String(req.query?.contestId || req.query?.contest_id || '').trim();

      if (contestId && !isUuid(contestId)) {
        return res.status(400).json({
          ok: false,
          error: 'contestId must be a valid UUID',
          tsServer: nowIso(),
        });
      }

      try {
        const entries = await listEntries(contestId);
        return res.json({
          ok: true,
          entries,
          participants: entries,
          count: entries.length,
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
