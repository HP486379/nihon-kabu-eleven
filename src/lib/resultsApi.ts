import { DEV_CONTEST_ID } from './entryApi';

export type CalculateResultsResult = {
  ok?: boolean;
  status?: string;
  count?: number;
  results?: Array<{
    entryId?: string;
    contestId?: string;
    rank?: number;
    teamName?: string;
    formation?: string;
    teamReturn?: number;
  }>;
  message?: string;
  error?: string;
};

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeContestId(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return UUID_PATTERN.test(text) ? text : DEV_CONTEST_ID;
}

async function parseApiResponse<T>(response: Response, fallbackLabel: string): Promise<T> {
  const result = await response.json().catch(() => ({})) as T & { ok?: boolean; message?: string; error?: string };

  if (!response.ok || result.ok === false) {
    const message = result.message || result.error || `${fallbackLabel} ${response.status}`;
    throw new Error(message);
  }

  return result;
}

export async function calculateResults(contestId: unknown = DEV_CONTEST_ID): Promise<CalculateResultsResult> {
  const response = await fetch(`${API_BASE}/api/results/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contestId: normalizeContestId(contestId) }),
  });

  return parseApiResponse<CalculateResultsResult>(response, 'results calculate api');
}
