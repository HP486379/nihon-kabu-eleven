export type MatchType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type ContestContext = {
  matchType: MatchType;
  contestId: string;
  label: string;
};

const MATCH_TYPE_STORAGE_KEY = 'nihon-kabu-eleven:match-type';
const CONTEST_ANCHOR = '20260611';

const MATCH_LABELS: Record<MatchType, string> = {
  daily: 'デイリーマッチ',
  weekly: '1週間マッチ',
  monthly: '1か月マッチ',
  quarterly: '3か月マッチ',
};

const MATCH_TYPE_IDS: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];

function isMatchType(value: string | null | undefined): value is MatchType {
  return Boolean(value && MATCH_TYPE_IDS.includes(value as MatchType));
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
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
  try {
    window.localStorage.setItem(MATCH_TYPE_STORAGE_KEY, matchType);
  } catch (_error) {
    // localStorage is best-effort only.
  }

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
  return `nihon-kabu-eleven-${CONTEST_ANCHOR}-${matchType}`;
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

export function entryMatchesContest(entry: Record<string, unknown>, contestId = getCurrentContestContext().contestId) {
  const listedContestId = firstText(
    entry.contestId,
    entry.contest_id,
    (entry.contest as Record<string, unknown> | undefined)?.id,
  );

  return Boolean(listedContestId) && listedContestId === contestId;
}

export function getContestLabel(matchType: MatchType) {
  return MATCH_LABELS[matchType];
}
