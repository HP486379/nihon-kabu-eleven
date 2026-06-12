export type MatchType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type ContestContext = {
  matchType: MatchType;
  contestId: string;
  label: string;
};

const MATCH_TYPE_STORAGE_KEY = 'nihon-kabu-eleven:match-type';

const MATCH_LABELS: Record<MatchType, string> = {
  daily: 'デイリーマッチ',
  weekly: '1週間マッチ',
  monthly: '1か月マッチ',
  quarterly: '3か月マッチ',
};

// Render / Supabase 側に存在する大会は現状1つだけなので、APIへ送る contest_id は既存IDに固定する。
// 大会種別の分離は userName / teamName の内部プレフィックスで行う。
export const API_CONTEST_ID = '5345b8eb-e9ec-4b4b-9549-35b3c4135003';

const CONTEST_IDS: Record<MatchType, string> = {
  daily: API_CONTEST_ID,
  weekly: API_CONTEST_ID,
  monthly: API_CONTEST_ID,
  quarterly: API_CONTEST_ID,
};

const MATCH_TYPE_IDS: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];
const INTERNAL_USER_PREFIX_RE = /^(weekly|monthly|quarterly)__/;
const INTERNAL_TEAM_PREFIX_RE = /^\[\[(weekly|monthly|quarterly)\]\]/;

function isMatchType(value: string | null | undefined): value is MatchType {
  return Boolean(value && MATCH_TYPE_IDS.includes(value as MatchType));
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function normalizeValue(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function readStoredMatchType() {
  try {
    const stored = window.localStorage.getItem(MATCH_TYPE_STORAGE_KEY);
    return isMatchType(stored) ? stored : null;
  } catch (_error) {
    return null;
  }
}

export function getStoredMatchType(defaultType: MatchType = 'quarterly'): MatchType {
  return readStoredMatchType() || defaultType;
}

export function setCurrentMatchType(matchType: MatchType) {
  let changed = false;

  try {
    const current = window.localStorage.getItem(MATCH_TYPE_STORAGE_KEY);
    if (current !== matchType) {
      window.localStorage.setItem(MATCH_TYPE_STORAGE_KEY, matchType);
      changed = true;
    }
  } catch (_error) {
    // localStorage is best-effort only.
  }

  const matchStrip = document.querySelector<HTMLElement>('.match-strip');
  if (matchStrip && matchStrip.dataset.matchType !== matchType) {
    matchStrip.dataset.matchType = matchType;
    changed = true;
  }

  if (!changed) return;

  window.dispatchEvent(new CustomEvent('nihon-kabu-eleven:contest-changed', {
    detail: getContestContext(matchType),
  }));
}

export function getCurrentMatchType(): MatchType {
  const selectedChip = document.querySelector<HTMLElement>('.match-type-chip.selected');
  const fromChip = selectedChip?.dataset.matchType;
  if (isMatchType(fromChip)) return fromChip;

  const matchStrip = document.querySelector<HTMLElement>('.match-strip');
  const fromStrip = matchStrip?.dataset.matchType;
  if (isMatchType(fromStrip)) return fromStrip;

  return getStoredMatchType('quarterly');
}

export function getContestId(matchType: MatchType = getCurrentMatchType()) {
  return CONTEST_IDS[matchType];
}

export function getContestContext(matchType: MatchType = getCurrentMatchType()): ContestContext {
  return {
    matchType,
    contestId: getContestId(matchType),
    label: MATCH_LABELS[matchType],
  };
}

export function getCurrentContestContext() {
  return getContestContext(getCurrentMatchType());
}

export function withContestQuery(url: string, contestId = getCurrentContestContext().contestId) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}contestId=${encodeURIComponent(contestId)}`;
}

export function toApiUserName(userName: string, matchType: MatchType = getCurrentMatchType()) {
  const normalized = normalizeValue(userName);
  return matchType === 'daily' ? normalized : `${matchType}__${normalized}`;
}

export function toDisplayUserName(userName: string) {
  return normalizeValue(userName).replace(INTERNAL_USER_PREFIX_RE, '');
}

export function toApiTeamName(teamName: string, matchType: MatchType = getCurrentMatchType()) {
  const trimmed = teamName.trim();
  return matchType === 'daily' ? trimmed : `[[${matchType}]]${trimmed}`;
}

export function toDisplayTeamName(teamName: string) {
  return teamName.trim().replace(INTERNAL_TEAM_PREFIX_RE, '');
}

export function toApiOwnerKey(ownerKey: string, matchType: MatchType = getCurrentMatchType()) {
  return `${ownerKey}__${matchType}`;
}

export function getVirtualContestStorageKey(matchType: MatchType = getCurrentMatchType()) {
  return `${API_CONTEST_ID}:${matchType}`;
}

export function entryMatchesContest(entry: Record<string, unknown>, _contestId = getCurrentContestContext().contestId) {
  const matchType = getCurrentMatchType();
  const listedMatchType = firstText(entry.matchType, entry.match_type, entry.contestType, entry.contest_type);

  if (isMatchType(listedMatchType)) return listedMatchType === matchType;

  const listedContestId = firstText(
    entry.contestId,
    entry.contest_id,
    (entry.contest as Record<string, unknown> | undefined)?.id,
  );

  if (listedContestId && listedContestId !== API_CONTEST_ID) return false;

  const entryUserName = normalizeValue(firstText(entry.userName, entry.user_name, entry.owner));
  const entryTeamName = firstText(entry.teamName, entry.team_name);
  const userPrefix = entryUserName.match(INTERNAL_USER_PREFIX_RE)?.[1] as MatchType | undefined;
  const teamPrefix = entryTeamName.match(INTERNAL_TEAM_PREFIX_RE)?.[1] as MatchType | undefined;
  const entryPrefix = userPrefix || teamPrefix;

  if (matchType === 'daily') return !entryPrefix;
  return entryPrefix === matchType;
}

export function getContestLabel(matchType: MatchType) {
  return MATCH_LABELS[matchType];
}
