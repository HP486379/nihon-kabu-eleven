import { API_CONTEST_ID, type MatchType } from './contestContext';

export type EntryResultItem = {
  id?: string;
  entryId?: string;
  entry_id?: string;
  contestId?: string;
  contest_id?: string;
  matchType?: MatchType;
  match_type?: MatchType;
  periodId?: string;
  period_id?: string;
  ownerKey?: string | null;
  owner_key?: string | null;
  userName?: string | null;
  user_name?: string | null;
  teamName?: string | null;
  team_name?: string | null;
  formation?: string | null;
  weightedReturn?: number | string | null;
  weighted_return?: number | string | null;
  returnPct?: number | string | null;
  return_pct?: number | string | null;
  teamReturn?: number | string | null;
  team_return?: number | string | null;
  rank?: number | null;
  rankOrder?: number | null;
  rank_order?: number | null;
  stockReturns?: unknown[];
  stock_returns?: unknown[];
  resultStatus?: string | null;
  result_status?: string | null;
  calculationVersion?: string | null;
  calculation_version?: string | null;
  calculatedAt?: string | null;
  calculated_at?: string | null;
  finalizedAt?: string | null;
  finalized_at?: string | null;
};

export type ResultsApiResult = {
  ok?: boolean;
  contestId?: string;
  contest_id?: string;
  matchType?: MatchType;
  match_type?: MatchType;
  periodId?: string;
  period_id?: string;
  count?: number;
  results?: EntryResultItem[];
  message?: string;
  error?: string;
  details?: unknown;
};

export type CalculateResultsResult = ResultsApiResult & {
  status?: string;
  calculationVersion?: string;
  calculatedAt?: string;
};

type ResultRequest = {
  contestId?: string;
  matchType: MatchType;
  periodId: string;
  resultStatus?: 'provisional' | 'final';
};

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

function stringifyDetails(details: unknown) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch (_error) {
    return String(details);
  }
}

async function parseApiResponse<T>(response: Response, fallbackLabel: string): Promise<T> {
  const result = await response.json().catch(() => ({})) as T & { ok?: boolean; message?: string; error?: string; details?: unknown };

  if (!response.ok || result.ok === false) {
    const detailText = stringifyDetails(result.details);
    const message = result.message || result.error || `${fallbackLabel} ${response.status}`;
    throw new Error(detailText ? `${message}: ${detailText}` : message);
  }

  return result;
}

export function getCurrentPeriodId(matchType: MatchType, date = new Date()) {
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

export async function fetchEntryResults({ contestId = API_CONTEST_ID, matchType, periodId }: ResultRequest): Promise<ResultsApiResult> {
  const params = new URLSearchParams({
    contestId,
    matchType,
    periodId,
    ts: String(Date.now()),
  });

  const response = await fetch(`${API_BASE}/api/results?${params}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  return parseApiResponse<ResultsApiResult>(response, 'results api');
}

export async function calculateResults({ contestId = API_CONTEST_ID, matchType, periodId, resultStatus = 'provisional' }: ResultRequest): Promise<CalculateResultsResult> {
  const response = await fetch(`${API_BASE}/api/results/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contestId, matchType, periodId, resultStatus }),
  });

  return parseApiResponse<CalculateResultsResult>(response, 'results calculate api');
}
