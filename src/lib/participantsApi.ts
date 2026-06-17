import { entryMatchesContest, getContestContext, getCurrentContestContext, toDisplayTeamName, toDisplayUserName, withContestQuery, type MatchType } from './contestContext';

export type ParticipantMember = {
  id?: string | null;
  entryId?: string | null;
  entry_id?: string | null;
  stockCode?: string | null;
  stock_code?: string | null;
  code?: string | null;
  stockName?: string | null;
  stock_name?: string | null;
  name?: string | null;
  market?: string | null;
  position?: string | null;
  slotOrder?: number | string | null;
  slot_order?: number | string | null;
  weight?: number | string | null;
};

export type ParticipantApiEntry = {
  id?: string;
  entryId?: string;
  entry_id?: string;
  contestId?: string | null;
  contest_id?: string | null;
  contest?: { id?: string | null } | null;
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
  members?: ParticipantMember[] | null;
  entry_members?: ParticipantMember[] | null;
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
  members?: ParticipantMember[];
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

function getDisplayOwner(entry: ParticipantApiEntry) {
  const rawUserName = firstText(entry.userName, entry.user_name);
  if (rawUserName) return toDisplayUserName(rawUserName);
  const rawOwner = firstText(entry.owner);
  return rawOwner && rawOwner !== '参加チーム' ? toDisplayUserName(rawOwner) : '参加チーム';
}

function normalizeMembers(entry: ParticipantApiEntry): ParticipantMember[] {
  if (Array.isArray(entry.members)) return entry.members;
  if (Array.isArray(entry.entry_members)) return entry.entry_members;
  return [];
}

function normalizeParticipant(entry: ParticipantApiEntry, index: number, matchType?: MatchType): ParticipantItem {
  const returnPct = toNumber(entry.returnPct ?? entry.return_pct ?? entry.resultPct ?? entry.result_pct ?? entry.weightedReturn ?? entry.weighted_return);
  const context = matchType ? getContestContext(matchType) : getCurrentContestContext();

  return {
    id: getEntryId(entry),
    rank: typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? entry.rank : index + 1,
    team: toDisplayTeamName(firstText(entry.teamName, entry.team_name) || `エントリー ${index + 1}`),
    owner: getDisplayOwner(entry),
    formation: firstText(entry.formation) || '-',
    matchType: firstText(entry.matchType, entry.match_type, entry.contestType, entry.contest_type) || context.label,
    returnPct,
    status: firstText(entry.status) || '確定済み',
    style: firstText(entry.style) || '集計待ち',
    createdAt: firstText(entry.createdAt, entry.created_at),
    members: normalizeMembers(entry),
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

export async function fetchParticipants(matchType?: MatchType): Promise<ParticipantItem[]> {
  clearLocalSubmittedEntries();
  const context = matchType ? getContestContext(matchType) : getCurrentContestContext();
  const response = await fetch(withContestQuery(`${API_BASE}/api/entries?ts=${Date.now()}`, context.contestId), {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const result = await parseApiResponse<ParticipantsApiResult>(response, 'participants api');
  const entries = normalizeEntries(result).filter((entry) => entryMatchesContest(entry as Record<string, unknown>, context.contestId, context.matchType));
  return sortParticipants(entries.map((entry, index) => normalizeParticipant(entry, index, context.matchType)));
}

export async function cancelParticipantEntry(target: CancelParticipantEntryTarget): Promise<CancelParticipantEntryResult> {
  const response = await fetch(`${API_BASE}/api/entries/cancel-selected`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });

  return parseApiResponse<CancelParticipantEntryResult>(response, 'entry cancel api');
}
