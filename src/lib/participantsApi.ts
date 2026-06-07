import { DEV_CONTEST_ID } from './entryApi';

export type ParticipantApiEntry = {
  id?: string;
  entryId?: string;
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
};

export type ParticipantItem = {
  rank: number;
  team: string;
  owner: string;
  formation: string;
  matchType: string;
  returnPct: number | null;
  status: string;
  style: string;
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

function normalizeParticipant(entry: ParticipantApiEntry, index: number): ParticipantItem {
  const returnPct = toNumber(entry.returnPct ?? entry.return_pct ?? entry.resultPct ?? entry.result_pct ?? entry.weightedReturn ?? entry.weighted_return);

  return {
    rank: typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? entry.rank : index + 1,
    team: firstText(entry.teamName, entry.team_name) || `エントリー ${index + 1}`,
    owner: firstText(entry.owner, entry.userName, entry.user_name) || '参加チーム',
    formation: firstText(entry.formation) || '-',
    matchType: firstText(entry.matchType, entry.match_type, entry.contestType, entry.contest_type) || '大会未設定',
    returnPct,
    status: firstText(entry.status) || '確定済み',
    style: firstText(entry.style) || '実データ',
  };
}

function sortParticipants(participants: ParticipantItem[]): ParticipantItem[] {
  const sorted = [...participants].sort((a, b) => {
    const aValue = a.returnPct ?? Number.NEGATIVE_INFINITY;
    const bValue = b.returnPct ?? Number.NEGATIVE_INFINITY;
    return bValue - aValue;
  });

  return sorted.map((participant, index) => ({ ...participant, rank: index + 1 }));
}

async function parseApiResponse(response: Response): Promise<ParticipantsApiResult> {
  const result = await response.json().catch(() => ({})) as ParticipantsApiResult;

  if (!response.ok || result.ok === false) {
    const message = result.message || result.error || `participants api ${response.status}`;
    throw new Error(message);
  }

  return result;
}

export async function fetchParticipants(contestId = DEV_CONTEST_ID): Promise<ParticipantItem[]> {
  const url = new URL(`${API_BASE}/api/entries`);
  url.searchParams.set('contestId', contestId);

  const response = await fetch(url.toString());
  const result = await parseApiResponse(response);
  return sortParticipants(normalizeEntries(result).map(normalizeParticipant));
}
