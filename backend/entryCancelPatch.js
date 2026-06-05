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
  if (!this.__entryCancelRouteReady) {
    this.__entryCancelRouteReady = true;

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
