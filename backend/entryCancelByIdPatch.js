import express from 'express';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const nowIso = () => new Date().toISOString();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_ENTRY_STATUSES = ['draft', 'entered', 'locked'];

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function text(value) {
  return String(value || '').trim();
}

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function loadEntryByTarget(supabase, target) {
  const entryId = text(target?.entryId || target?.entry_id || target?.id);

  if (isUuid(entryId)) {
    const { data, error } = await supabase
      .from('entries')
      .select('id,status,contest_id,user_id,team_name,formation,created_at,locked_at,updated_at')
      .eq('id', entryId)
      .maybeSingle();

    if (error) throw httpError(500, 'Failed to load entry', error.message);
    if (!data) throw httpError(404, 'Entry was not found', { entryId });
    return data;
  }

  const teamName = text(target?.teamName || target?.team_name);
  const formation = text(target?.formation);
  const createdAt = text(target?.createdAt || target?.created_at);

  if (!teamName || !createdAt) {
    throw httpError(400, 'entryId or teamName + createdAt is required', { entryId, teamName, formation, createdAt });
  }

  let query = supabase
    .from('entries')
    .select('id,status,contest_id,user_id,team_name,formation,created_at,locked_at,updated_at')
    .eq('team_name', teamName)
    .eq('created_at', createdAt)
    .in('status', ACTIVE_ENTRY_STATUSES)
    .order('created_at', { ascending: false })
    .limit(2);

  if (formation) query = query.eq('formation', formation);

  const { data, error } = await query;
  if (error) throw httpError(500, 'Failed to load entry by fallback target', error.message);

  const rows = data || [];
  if (!rows.length) throw httpError(404, 'Entry was not found by fallback target', { teamName, formation, createdAt });
  if (rows.length > 1) throw httpError(409, 'Entry target is ambiguous', { teamName, formation, createdAt, count: rows.length });

  return rows[0];
}

async function cancelEntryTarget(target) {
  const supabase = requireSupabaseAdmin();
  const existingEntry = await loadEntryByTarget(supabase, target);
  const safeEntryId = existingEntry.id;

  if (!isUuid(safeEntryId)) {
    throw httpError(500, 'Loaded entry id is not a valid UUID', { entryId: safeEntryId });
  }

  if (existingEntry.status === 'cancelled') {
    return existingEntry;
  }

  const { error: deleteResultsError } = await supabase
    .from('entry_results')
    .delete()
    .eq('entry_id', safeEntryId);

  if (deleteResultsError) {
    throw httpError(500, 'Failed to clear entry results', deleteResultsError.message);
  }

  const { data: cancelledEntry, error: updateError } = await supabase
    .from('entries')
    .update({
      status: 'cancelled',
      updated_at: nowIso(),
    })
    .eq('id', safeEntryId)
    .select('id,status,contest_id,user_id,team_name,formation,created_at,locked_at,updated_at')
    .single();

  if (updateError) {
    throw httpError(500, 'Failed to cancel entry', updateError.message);
  }

  return cancelledEntry;
}

function sendError(res, err) {
  return res.status(err.status || 500).json({
    ok: false,
    error: err.message,
    details: err.details || null,
    tsServer: nowIso(),
  });
}

const originalListen = express.application.listen;

express.application.listen = function entryCancelByIdListenPatch(...args) {
  if (!this.__entryCancelByIdRoutesReady) {
    this.__entryCancelByIdRoutesReady = true;

    this.post('/api/entries/cancel-selected', async (req, res) => {
      try {
        const entry = await cancelEntryTarget(req.body || {});
        return res.json({
          ok: true,
          status: 'cancelled',
          entry,
          entryId: entry.id,
          entry_id: entry.id,
          tsServer: nowIso(),
        });
      } catch (err) {
        return sendError(res, err);
      }
    });

    this.post('/api/entries/:entryId/cancel', async (req, res) => {
      try {
        const entry = await cancelEntryTarget({ ...req.body, entryId: req.params?.entryId });
        return res.json({
          ok: true,
          status: 'cancelled',
          entry,
          entryId: entry.id,
          entry_id: entry.id,
          tsServer: nowIso(),
        });
      } catch (err) {
        return sendError(res, err);
      }
    });
  }

  return originalListen.apply(this, args);
};
