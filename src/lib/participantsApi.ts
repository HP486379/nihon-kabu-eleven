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

export type RememberSubmittedParticipantInput = {
  entryId?: string;
  teamName: string;
  formation: string;
  createdAt?: string | null;
  status?: string;
  matchType?: string;
};

type LocalSubmittedEntry = ParticipantApiEntry & {
  remembered_at?: string;
  expires_at?: string;
};

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_SUBMITTED_ENTRIES_KEY = 'nihon-kabu-eleven:submitted-participants';
const LOCAL_SUBMITTED_ENTRY_TTL_MS = 60 * 60 * 1000;
const MAX_LOCAL_SUBMITTED_ENTRIES = 20;

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

function validUuid(value: unknown) {
  const text = firstText(value);
  return UUID_PATTERN.test(text) ? text : '';
}

function getEntryId(entry: ParticipantApiEntry) {
  return validUuid(entry.entryId) || validUuid(entry.entry_id) || validUuid(entry.id);
}

function getEntryTeamName(entry: ParticipantApiEntry) {
  return firstText(entry.teamName, entry.team_name);
}

function getEntryFormation(entry: ParticipantApiEntry) {
  return firstText(entry.formation);
}

function getEntryCreatedAt(entry: ParticipantApiEntry) {
  return firstText(entry.createdAt, entry.created_at);
}

function getEntryIdentity(entry: ParticipantApiEntry) {
  const id = getEntryId(entry);
  if (id) return `id:${id}`;

  const teamName = getEntryTeamName(entry);
  const formation = getEntryFormation(entry);
  const createdAt = getEntryCreatedAt(entry);
  if (teamName && createdAt) return `fallback:${teamName}|${formation}|${createdAt}`;
  if (teamName && formation) return `team:${teamName}|${formation}`;
  return '';
}

function hasSameTeamAndFormation(left: ParticipantApiEntry, right: ParticipantApiEntry) {
  const leftTeam = getEntryTeamName(left);
  const rightTeam = getEntryTeamName(right);
  if (!leftTeam || !rightTeam || leftTeam !== rightTeam) return false;
  return getEntryFormation(left) === getEntryFormation(right);
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

function readLocalSubmittedEntries(): LocalSubmittedEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_SUBMITTED_ENTRIES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as LocalSubmittedEntry[];
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    return parsed.filter((entry) => {
      const expiresAt = firstText(entry.expires_at);
      if (!expiresAt) return true;
      const expiresTime = Date.parse(expiresAt);
      return !Number.isFinite(expiresTime) || expiresTime > now;
    });
  } catch (_error) {
    return [];
  }
}

function writeLocalSubmittedEntries(entries: LocalSubmittedEntry[]) {
  if (typeof window === 'undefined') return;

  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(LOCAL_SUBMITTED_ENTRIES_KEY);
      return;
    }

    window.localStorage.setItem(LOCAL_SUBMITTED_ENTRIES_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL_SUBMITTED_ENTRIES)));
  } catch (_error) {
    // localStorage is best-effort only.
  }
}

function mergeLocalSubmittedEntries(apiEntries: ParticipantApiEntry[]) {
  const localEntries = readLocalSubmittedEntries();
  if (localEntries.length === 0) return apiEntries;

  const apiIdentities = new Set(apiEntries.map(getEntryIdentity).filter(Boolean));
  const localOnly = localEntries.filter((entry) => {
    const identity = getEntryIdentity(entry);
    if (identity && apiIdentities.has(identity)) return false;
    return !apiEntries.some((apiEntry) => hasSameTeamAndFormation(entry, apiEntry));
  });

  return [...apiEntries, ...localOnly];
}

export function rememberSubmittedParticipant(input: RememberSubmittedParticipantInput) {
  const teamName = firstText(input.teamName);
  const formation = firstText(input.formation);
  if (!teamName || !formation) return;

  const now = new Date();
  const createdAt = firstText(input.createdAt) || now.toISOString();
  const nextEntry: LocalSubmittedEntry = {
    id: firstText(input.entryId),
    entryId: firstText(input.entryId),
    teamName,
    team_name: teamName,
    formation,
    matchType: firstText(input.matchType) || '第1回 日本株代表イレブン杯',
    match_type: firstText(input.matchType) || '第1回 日本株代表イレブン杯',
    status: firstText(input.status) || '確定済み',
    style: '参加チーム / 集計待ち',
    createdAt,
    created_at: createdAt,
    remembered_at: now.toISOString(),
    expires_at: new Date(now.getTime() + LOCAL_SUBMITTED_ENTRY_TTL_MS).toISOString(),
  };

  const current = readLocalSubmittedEntries().filter((entry) => !hasSameTeamAndFormation(entry, nextEntry));
  writeLocalSubmittedEntries([nextEntry, ...current]);
}

function forgetSubmittedParticipant(target: CancelParticipantEntryTarget) {
  const current = readLocalSubmittedEntries();
  if (current.length === 0) return false;

  const before = current.length;
  const next = current.filter((entry) => {
    const targetEntry: ParticipantApiEntry = {
      id: target.entryId,
      entryId: target.entryId,
      teamName: target.teamName,
      formation: target.formation,
      createdAt: target.createdAt,
    };

    return getEntryIdentity(entry) !== getEntryIdentity(targetEntry) && !hasSameTeamAndFormation(entry, targetEntry);
  });

  writeLocalSubmittedEntries(next);
  return next.length !== before;
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
  const response = await fetch(`${API_BASE}/api/entries`);
  const result = await parseApiResponse<ParticipantsApiResult>(response, 'participants api');
  const entries = mergeLocalSubmittedEntries(normalizeEntries(result));
  return sortParticipants(entries.map(normalizeParticipant));
}

export async function cancelParticipantEntry(target: CancelParticipantEntryTarget): Promise<CancelParticipantEntryResult> {
  try {
    const response = await fetch(`${API_BASE}/api/entries/cancel-selected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });

    const result = await parseApiResponse<CancelParticipantEntryResult>(response, 'entry cancel api');
    forgetSubmittedParticipant(target);
    return result;
  } catch (error) {
    const removedLocalEntry = forgetSubmittedParticipant(target);
    if (removedLocalEntry && !validUuid(target.entryId)) {
      return { ok: true, status: 'cancelled', message: 'locally remembered entry removed' };
    }
    throw error;
  }
}
