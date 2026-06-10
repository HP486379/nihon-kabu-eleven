export type ParticipantApiEntry = {
  id?: string;
  entryId?: string;
  entry_id?: string;
  rank?: number | null;
  teamName?: string | null;
  team_name?: string | null;
  owner?: string | null;
  userName?: string | null;
  user_name?: string | null;
  formation?: string | null;
  matchType?: string | null;
  match_type?: string | null;
  contestType?: string | null;
  contest_type?: string | null;
  returnPct?: number | string | null;
  return_pct?: number | string | null;
  resultPct?: number | string | null;
  result_pct?: number | string | null;
  weightedReturn?: number | string | null;
  weighted_return?: number | string | null;
  status?: string | null;
  style?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

export type ParticipantsApiResult = {
  ok?: boolean;
  entries?: ParticipantApiEntry[];
  participants?: ParticipantApiEntry[];
  data?: ParticipantApiEntry[];
  message?: string;
  error?: string;
  details?: string | null;
};

export type ParticipantItem = {
  id: string;
  rank: number;
  team: string;
  owner: string;
  formation: string;
  matchType: string;
  returnPct: number | null;
  status: string;
  style: string;
  createdAt: string;
};

export type CancelParticipantEntryTarget = {
  entryId?: string;
  teamName: string;
  formation: string;
  createdAt: string;
};

export type CancelParticipantEntryResult = {
  ok?: boolean;
  status?: string;
  entry?: unknown;
  entryId?: string;
  entry_id?: string;
  message?: string;
  error?: string;
  details?: string | Record<string, unknown> | null;
};

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function normalizeEntries(result: ParticipantsApiResult): ParticipantApiEntry[] {
  if (Array.isArray(result.entries)) return result.entries;
  if (Array.isArray(result.participants)) return result.participants;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

function getEntryId(entry: ParticipantApiEntry) {
  return firstText(entry.entryId, entry.entry_id, entry.id);
}

function normalizeParticipant(entry: ParticipantApiEntry, index: number): ParticipantItem {
  const returnPct = toNumber(entry.returnPct ?? entry.return_pct ?? entry.resultPct ?? entry.result_pct ?? entry.weightedReturn ?? entry.weighted_return);

  return {
    id: getEntryId(entry),
    rank: typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? entry.rank : index + 1,
    team: firstText(entry.teamName, entry.team_name) || `エントリー ${index + 1}`,
    owner: firstText(entry.owner, entry.userName, entry.user_name) || '参加チーム',
    formation: firstText(entry.formation) || '-',
    matchType: firstText(entry.matchType, entry.match_type, entry.contestType, entry.contest_type) || '大会未設定',
    returnPct,
    status: firstText(entry.status) || '確定済み',
    style: firstText(entry.style) || '実データ',
    createdAt: firstText(entry.createdAt, entry.created_at),
  };
}

function sortParticipants(participants: ParticipantItem[]): ParticipantItem[] {
  const sorted = [...participants].sort((a, b) => {
    const aValue = a.returnPct ?? Number.NEGATIVE_INFINITY;
    const bValue = b.returnPct ?? Number.NEGATIVE_INFINITY;
    if (aValue !== bValue) return bValue - aValue;
    return b.rank - a.rank;
  });

  return sorted.map((participant, index) => ({ ...participant, rank: index + 1 }));
}

function stringifyDetails(details: unknown) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch (_error) {
    return String(details);
  }
}

function clearLocalSubmittedEntries() {
  try {
    window.localStorage.removeItem('nihon-kabu-eleven:submitted-participants');
  } catch (_error) {
    // localStorage cleanup is best-effort only.
  }
}

async function parseApiResponse<T extends { ok?: boolean; message?: string; error?: string; details?: unknown }>(response: Response, fallbackLabel: string): Promise<T> {
  const result = await response.json().catch(() => ({})) as T;

  if (!response.ok || result.ok === false) {
    const detailText = stringifyDetails(result.details);
    const baseMessage = result.message || result.error || `${fallbackLabel} ${response.status}`;
    throw new Error(detailText ? `${baseMessage}: ${detailText}` : baseMessage);
  }

  return result;
}

export async function fetchParticipants(): Promise<ParticipantItem[]> {
  clearLocalSubmittedEntries();
  const response = await fetch(`${API_BASE}/api/entries?ts=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const result = await parseApiResponse<ParticipantsApiResult>(response, 'participants api');
  const entries = normalizeEntries(result);
  return sortParticipants(entries.map(normalizeParticipant));
}

export async function cancelParticipantEntry(target: CancelParticipantEntryTarget): Promise<CancelParticipantEntryResult> {
  const response = await fetch(`${API_BASE}/api/entries/cancel-selected`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });

  return parseApiResponse<CancelParticipantEntryResult>(response, 'entry cancel api');
}
