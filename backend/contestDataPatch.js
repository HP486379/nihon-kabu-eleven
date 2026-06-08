import express from 'express';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const DEFAULT_CONTEST_DURATION_DAYS = Number(process.env.DEFAULT_CONTEST_DURATION_DAYS || 7);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nowIso = () => new Date().toISOString();

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function optionalContestId(value) {
  const text = String(value || '').trim();
  return isUuid(text) ? text : '';
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

function dateLabel(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function inferContestType(contest) {
  const text = `${contest?.name || ''}`.toLowerCase();

  if (/(デイリー|デイリーカップ|デイリーマッチ|一日|1\s*日|1\s*day|daily|1d)/.test(text)) {
    return {
      contestType: 'daily',
      contestTypeLabel: 'デイリーマッチ',
      durationDays: 1,
      durationSource: 'name',
    };
  }

  if (/3\s*(か月|ヶ月|ヵ月|month|months)|3m/.test(text)) {
    return {
      contestType: 'three_month',
      contestTypeLabel: '3か月マッチ',
      durationDays: 90,
      durationSource: 'name',
    };
  }

  if (/1\s*(か月|ヶ月|ヵ月|month)|1m/.test(text)) {
    return {
      contestType: 'one_month',
      contestTypeLabel: '1か月マッチ',
      durationDays: 30,
      durationSource: 'name',
    };
  }

  if (/1\s*(週間|週|week)|1w/.test(text)) {
    return {
      contestType: 'one_week',
      contestTypeLabel: '1週間マッチ',
      durationDays: 7,
      durationSource: 'name',
    };
  }

  const fallbackDays = Number.isFinite(DEFAULT_CONTEST_DURATION_DAYS) && DEFAULT_CONTEST_DURATION_DAYS > 0
    ? DEFAULT_CONTEST_DURATION_DAYS
    : 7;

  return {
    contestType: fallbackDays <= 1 ? 'daily' : fallbackDays >= 90 ? 'three_month' : fallbackDays >= 30 ? 'one_month' : 'one_week',
    contestTypeLabel: fallbackDays <= 1 ? 'デイリーマッチ' : fallbackDays >= 90 ? '3か月マッチ' : fallbackDays >= 30 ? '1か月マッチ' : '1週間マッチ',
    durationDays: fallbackDays,
    durationSource: 'default',
  };
}

function getPhase(contest, resultReadyAt, currentDateValue = nowIso()) {
  const status = String(contest?.status || '').toLowerCase();
  if (['completed', 'calculated', 'finished'].includes(status)) {
    return { phase: 'completed', phaseLabel: '集計済み' };
  }

  const currentDate = toDate(currentDateValue);
  const entryDeadline = toDate(contest?.entry_deadline);
  const resultReadyDate = toDate(resultReadyAt);

  if (!entryDeadline || !currentDate) {
    return { phase: status || 'unknown', phaseLabel: '日程未設定' };
  }

  if (currentDate.getTime() < entryDeadline.getTime()) {
    return { phase: 'entry_open', phaseLabel: '募集中' };
  }

  if (resultReadyDate && currentDate.getTime() < resultReadyDate.getTime()) {
    return { phase: 'waiting_result', phaseLabel: '集計待ち' };
  }

  return { phase: 'ready_to_calculate', phaseLabel: '集計可能' };
}

function normalizeContest(contest, currentDateValue = nowIso()) {
  const type = inferContestType(contest);
  const deadline = toDate(contest?.entry_deadline);
  const resultReadyAt = deadline ? addDays(deadline, type.durationDays).toISOString() : null;
  const resultReadyDate = toDate(resultReadyAt);
  const currentDate = toDate(currentDateValue);
  const phase = getPhase(contest, resultReadyAt, currentDateValue);

  return {
    id: contest.id,
    name: contest.name,
    status: contest.status,
    contestType: type.contestType,
    contestTypeLabel: type.contestTypeLabel,
    durationDays: type.durationDays,
    durationSource: type.durationSource,
    entryDeadline: contest.entry_deadline || null,
    entryDeadlineDate: dateLabel(contest.entry_deadline),
    resultReadyAt,
    resultReadyDate: dateLabel(resultReadyAt),
    isEntryClosed: Boolean(deadline && currentDate && currentDate.getTime() >= deadline.getTime()),
    isResultReady: Boolean(resultReadyDate && currentDate && currentDate.getTime() >= resultReadyDate.getTime()),
    ...phase,
  };
}

function pickActiveContest(contests) {
  return contests.find((contest) => ['entry_open', 'waiting_result', 'ready_to_calculate'].includes(contest.phase))
    || contests[0]
    || null;
}

async function listContests(contestId) {
  const supabase = requireSupabaseAdmin();

  let query = supabase
    .from('contests')
    .select('id,name,status,entry_deadline')
    .order('entry_deadline', { ascending: true });

  if (contestId) query = query.eq('id', contestId);

  const { data, error } = await query;
  if (error) {
    const err = new Error('Failed to load contests');
    err.status = 500;
    err.details = error.message;
    throw err;
  }

  return (data || []).map((contest) => normalizeContest(contest));
}

const originalListen = express.application.listen;

express.application.listen = function contestDataListenPatch(...args) {
  if (!this.__contestDataRoutesReady) {
    this.__contestDataRoutesReady = true;

    this.get('/api/contests', async (req, res) => {
      const rawContestId = req.query?.contestId || req.query?.contest_id || req.query?.id || '';
      const contestId = optionalContestId(rawContestId);

      try {
        const contests = await listContests(contestId);
        return res.json({
          ok: true,
          contests,
          activeContest: pickActiveContest(contests),
          count: contests.length,
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
  }

  return originalListen.apply(this, args);
};
