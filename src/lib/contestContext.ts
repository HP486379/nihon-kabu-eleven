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

// Supabase 側の contest_id が uuid 型でも通るよう、各大会タイプに固定UUIDを割り当てる。
// daily は既存データとの互換性のため、従来の DEV_CONTEST_ID をそのまま使う。
const CONTEST_IDS: Record<MatchType, string> = {
  daily: '5345b8eb-e9ec-4b4b-9549-35b3c4135003',
  weekly: '0d7f27e7-8a4f-4ac7-8d7a-1f6b6c9c3f11',
  monthly: '8f67c66e-58c8-4d78-8c0f-3f3ed8c6b1b2',
  quarterly: 'ee8bdc92-b0d4-4c78-8fa8-f0d9677d7c33',
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

export function entryMatchesContest(entry: Record<string, unknown>, contestId = getCurrentContestContext().contestId) {
  const listedContestId = firstText(
    entry.contestId,
    entry.contest_id,
    (entry.contest as Record<string, unknown> | undefined)?.id,
  );

  if (listedContestId) return listedContestId === contestId;

  // contest_id が返ってこない旧データは daily 側の既存大会として扱う。
  return contestId === CONTEST_IDS.daily;
}

export function getContestLabel(matchType: MatchType) {
  return MATCH_LABELS[matchType];
}
