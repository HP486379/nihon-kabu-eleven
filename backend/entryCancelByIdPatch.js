import express from 'express';
import { requireSupabaseAdmin } from './supabaseAdmin.js';

const nowIso = () => new Date().toISOString();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(String(value || ''));
}

function httpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function cancelEntryById(entryId) {
  const supabase = requireSupabaseAdmin();
  const safeEntryId = String(entryId || '').trim();

  if (!isUuid(safeEntryId)) {
    throw httpError(400, 'entryId must be a valid UUID');
  }

  const { data: existingEntry, error: findError } = await supabase
    .from('entries')
    .select('id,status,contest_id,user_id,team_name,formation,created_at,locked_at,updated_at')
    .eq('id', safeEntryId)
    .maybeSingle();

  if (findError) {
    throw httpError(500, 'Failed to load entry', findError.message);
  }

  if (!existingEntry) {
    throw httpError(404, 'Entry was not found');
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

const originalListen = express.application.listen;

express.application.listen = function entryCancelByIdListenPatch(...args) {
  if (!this.__entryCancelByIdRoutesReady) {
    this.__entryCancelByIdRoutesReady = true;

    this.post('/api/entries/:entryId/cancel', async (req, res) => {
      const entryId = req.params?.entryId || req.body?.entryId || req.body?.entry_id || '';

      try {
        const entry = await cancelEntryById(entryId);
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
