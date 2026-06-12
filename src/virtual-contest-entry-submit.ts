import { buildEntryPayload, submitEntry, type SubmitEntryResult } from './lib/entryApi';
import {
  entryMatchesContest,
  getCurrentContestContext,
  getVirtualContestStorageKey,
  toApiOwnerKey,
  toApiTeamName,
  toApiUserName,
  toDisplayUserName,
  withContestQuery,
} from './lib/contestContext';

type Position = 'FW' | 'MF' | 'DF' | 'GK';

type FormationConfig = {
  key: string;
  counts: Record<Position, number>;
  weights: Record<Position, number>;
};

type SelectedMember = {
  code: string;
  name: string;
  market: string;
  position: Position;
};

type EntryListItem = {
  id?: string;
  entryId?: string;
  entry_id?: string;
  contestId?: string | null;
  contest_id?: string | null;
  contest?: { id?: string | null } | null;
  teamName?: string | null;
  team_name?: string | null;
  userName?: string | null;
  user_name?: string | null;
  owner?: string | null;
  ownerKey?: string | null;
  owner_key?: string | null;
  formation?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type EntryListResult = {
  ok?: boolean;
  entries?: EntryListItem[];
  participants?: EntryListItem[];
  data?: EntryListItem[];
};

const FORMATION_CONFIGS: Record<string, FormationConfig> = {
  '4-3-3': { key: '4-3-3', counts: { FW: 3, MF: 3, DF: 4, GK: 1 }, weights: { FW: 0.35, MF: 0.30, DF: 0.25, GK: 0.10 } },
  '4-2-3-1': { key: '4-2-3-1', counts: { FW: 1, MF: 5, DF: 4, GK: 1 }, weights: { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 } },
  '4-4-2': { key: '4-4-2', counts: { FW: 2, MF: 4, DF: 4, GK: 1 }, weights: { FW: 0.30, MF: 0.35, DF: 0.25, GK: 0.10 } },
  '3-5-2': { key: '3-5-2', counts: { FW: 2, MF: 5, DF: 3, GK: 1 }, weights: { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 } },
  '3-4-3': { key: '3-4-3', counts: { FW: 3, MF: 4, DF: 3, GK: 1 }, weights: { FW: 0.38, MF: 0.32, DF: 0.20, GK: 0.10 } },
  '5-3-2': { key: '5-3-2', counts: { FW: 2, MF: 3, DF: 5, GK: 1 }, weights: { FW: 0.22, MF: 0.28, DF: 0.40, GK: 0.10 } },
  '3-4-2-1': { key: '3-4-2-1', counts: { FW: 1, MF: 6, DF: 3, GK: 1 }, weights: { FW: 0.28, MF: 0.42, DF: 0.20, GK: 0.10 } },
  '5-4-1': { key: '5-4-1', counts: { FW: 1, MF: 4, DF: 5, GK: 1 }, weights: { FW: 0.20, MF: 0.30, DF: 0.40, GK: 0.10 } },
};

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const USER_NAME_STORAGE_KEY = 'nihon-kabu-eleven:user-name';
const OWNER_KEY_STORAGE_KEY = 'nihon-kabu-eleven:owner-key';
const ENTRY_ID_STORAGE_PREFIX = 'nihon-kabu-eleven:entry-id:';

let initialized = false;
let submitting = false;

function text(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function normalizeUserName(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function validUserName(value: string) {
  return /^[a-z0-9_-]{3,24}$/.test(value);
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch (_error) {
    return '';
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // best effort
  }
}

function getOrRegisterUserName() {
  const stored = normalizeUserName(readStorage(USER_NAME_STORAGE_KEY));
  if (validUserName(stored)) return stored;

  const raw = window.prompt('ユーザーネームを登録してください。半角英数字・ハイフン・アンダースコアで3〜24文字です。例：Taro');
  if (raw === null) return null;

  const normalized = normalizeUserName(raw);
  if (!validUserName(normalized)) {
    throw new Error('ユーザーネームは半角英数字・ハイフン・アンダースコアで3〜24文字にしてください。');
  }

  writeStorage(USER_NAME_STORAGE_KEY, normalized);
  return normalized;
}

function getOwnerKey() {
  const existing = readStorage(OWNER_KEY_STORAGE_KEY);
  if (existing) return existing;

  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeStorage(OWNER_KEY_STORAGE_KEY, generated);
  return generated;
}

function entryStorageKey(userName: string, virtualContestKey: string) {
  return `${ENTRY_ID_STORAGE_PREFIX}${virtualContestKey}:${userName}`;
}

function getStoredEntryId(userName: string, virtualContestKey: string) {
  return readStorage(entryStorageKey(userName, virtualContestKey));
}

function rememberEntryId(userName: string, virtualContestKey: string, entryId: string) {
  writeStorage(entryStorageKey(userName, virtualContestKey), entryId);
}

function getTeamName() {
  const chipText = text('.team-chip');
  return chipText.split('｜')[0]?.trim() || 'ゲストジャパン';
}

function getFormationConfig() {
  return FORMATION_CONFIGS[text('.formation-number')] || null;
}

function getMarketByCode(code: string) {
  const matched = Array.from(document.querySelectorAll<HTMLElement>('.stock-item')).find((card) => (card.textContent || '').includes(code));
  const metaText = matched?.querySelector('small')?.textContent || '';
  const [, market] = metaText.split('/').map((value) => value.trim());
  return market || '任意追加';
}

function readMembers(): SelectedMember[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.player-card')).map((card) => {
    const positionText = card.querySelector<HTMLElement>('.position-pill')?.textContent?.trim();
    const position = ['FW', 'MF', 'DF', 'GK'].includes(positionText || '') ? positionText as Position : 'MF';
    const code = card.querySelector('small')?.textContent?.trim() || '';
    const name = card.querySelector('strong')?.textContent?.trim() || code;
    return { code, name, market: getMarketByCode(code), position };
  }).filter((member) => Boolean(member.code));
}

function validateMembers(members: SelectedMember[], formation: FormationConfig) {
  if (members.length !== 11) return '11銘柄を選抜してからエントリーしてください。';

  const counts = members.reduce<Record<Position, number>>((acc, member) => {
    acc[member.position] += 1;
    return acc;
  }, { FW: 0, MF: 0, DF: 0, GK: 0 });

  const mismatch = (Object.keys(formation.counts) as Position[]).find((position) => counts[position] !== formation.counts[position]);
  if (mismatch) return `${formation.key} の ${mismatch} 人数が一致していません。`;
  if (new Set(members.map((member) => member.code)).size !== members.length) return '同じ銘柄が重複しています。';
  return null;
}

function ensureStatus(button: HTMLButtonElement) {
  const parent = button.parentElement;
  if (!parent) return null;
  let status = parent.querySelector<HTMLElement>('.entry-submit-status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'entry-submit-status helper-text';
    status.setAttribute('aria-live', 'polite');
    parent.appendChild(status);
  }
  status.style.margin = '8px 0 0';
  return status;
}

function setStatus(button: HTMLButtonElement, message: string, type: 'saving' | 'saved' | 'warning' | 'error') {
  const status = ensureStatus(button);
  if (!status) return;
  status.textContent = message;
  status.dataset.status = type;
  status.style.fontWeight = type === 'error' || type === 'warning' ? '700' : '600';
}

function normalizeEntries(result: EntryListResult): EntryListItem[] {
  if (Array.isArray(result.entries)) return result.entries;
  if (Array.isArray(result.participants)) return result.participants;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

function getEntryId(entry: EntryListItem) {
  return firstText(entry.entryId, entry.entry_id, entry.id);
}

function getEntryUserName(entry: EntryListItem) {
  return toDisplayUserName(firstText(entry.userName, entry.user_name, entry.owner));
}

function getEntryOwnerKey(entry: EntryListItem) {
  return firstText(entry.ownerKey, entry.owner_key);
}

async function fetchEntryList(contestId: string) {
  const response = await fetch(withContestQuery(`${API_BASE}/api/entries?ts=${Date.now()}`, contestId), {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (!response.ok) return [];
  const result = await response.json().catch(() => ({})) as EntryListResult;
  return normalizeEntries(result).filter((entry) => entryMatchesContest(entry as Record<string, unknown>, contestId));
}

function findConflict(entries: EntryListItem[], userName: string, apiOwnerKey: string, previousEntryId: string) {
  return entries.find((entry) => {
    if (normalizeUserName(getEntryUserName(entry)) !== userName) return false;
    const entryId = getEntryId(entry);
    if (previousEntryId && entryId === previousEntryId) return false;
    const entryOwnerKey = getEntryOwnerKey(entry);
    if (entryOwnerKey && entryOwnerKey === apiOwnerKey) return false;
    return true;
  });
}

async function cancelEntryById(entryId: string, entry?: EntryListItem) {
  if (!entryId) return;
  const response = await fetch(`${API_BASE}/api/entries/cancel-selected`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entryId,
      teamName: firstText(entry?.teamName, entry?.team_name),
      formation: firstText(entry?.formation),
      createdAt: firstText(entry?.createdAt, entry?.created_at),
    }),
  });
  if (!response.ok) throw new Error('既存エントリーの取消に失敗しました。');
}

function isAlreadyEntered(message: string) {
  return message.includes('Active entry already exists') || message.includes('already exists');
}

function getSavedEntryId(result: SubmitEntryResult) {
  return result.entryId || result.entry_id || result.entry?.id || result.entry?.entryId || result.entry?.entry_id || '';
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function confirmVisible(entryId: string, contestId: string) {
  for (const delay of [0, 300, 800, 1500, 2500]) {
    if (delay) await wait(delay);
    const entries = await fetchEntryList(contestId);
    if (entries.some((entry) => getEntryId(entry) === entryId)) return true;
  }
  return false;
}

function hideButton(button: HTMLButtonElement) {
  button.dataset.entryAction = 'post-entry';
  button.disabled = true;
  button.hidden = true;
  button.style.display = 'none';
  button.parentElement?.querySelector<HTMLButtonElement>('.cancel-entry-button')?.remove();
}

async function submitReplacingPrevious(payload: ReturnType<typeof buildEntryPayload>, previousEntryId: string, entriesBefore: EntryListItem[]) {
  try {
    return await submitEntry(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyEntered(message) || !previousEntryId) throw error;
    const previousEntry = entriesBefore.find((entry) => getEntryId(entry) === previousEntryId);
    await cancelEntryById(previousEntryId, previousEntry);
    return submitEntry(payload);
  }
}

function isEntryButton(button: HTMLButtonElement) {
  const label = button.textContent?.trim() || '';
  return !button.disabled
    && !label.includes('別チームを作る')
    && !label.includes('チームを作り直す')
    && !label.includes('取り消')
    && (label.includes('チームを確定') || label.includes('エントリー'));
}

async function handleClick(button: HTMLButtonElement, event: MouseEvent) {
  if (!isEntryButton(button)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (submitting) return;

  const originalText = button.textContent || 'チームを確定';
  const formation = getFormationConfig();
  if (!formation) {
    setStatus(button, 'フォーメーション情報を取得できませんでした。', 'error');
    return;
  }

  const members = readMembers();
  const validationError = validateMembers(members, formation);
  if (validationError) {
    setStatus(button, validationError, 'error');
    return;
  }

  const contest = getCurrentContestContext();

  try {
    submitting = true;
    button.disabled = true;
    button.textContent = 'エントリー保存中...';
    setStatus(button, `${contest.label} のエントリーを保存しています。`, 'saving');

    const userName = getOrRegisterUserName();
    if (!userName) {
      setStatus(button, 'ユーザーネーム登録をキャンセルしました。', 'warning');
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    const baseOwnerKey = getOwnerKey();
    const apiUserName = toApiUserName(userName, contest.matchType);
    const apiOwnerKey = toApiOwnerKey(baseOwnerKey, contest.matchType);
    const virtualKey = getVirtualContestStorageKey(contest.matchType);
    const previousEntryId = getStoredEntryId(userName, virtualKey);
    const entriesBefore = await fetchEntryList(contest.contestId);
    const conflict = findConflict(entriesBefore, userName, apiOwnerKey, previousEntryId);
    if (conflict) throw new Error(`この大会ではユーザーネーム「${userName}」は既に使われています。`);

    const payload = buildEntryPayload({
      contestId: contest.contestId,
      teamName: toApiTeamName(getTeamName(), contest.matchType),
      userName: apiUserName,
      ownerKey: apiOwnerKey,
      formation,
      selected: members,
    });

    const result = await submitReplacingPrevious(payload, previousEntryId, entriesBefore);
    const savedEntryId = getSavedEntryId(result);
    if (!savedEntryId) throw new Error('保存結果に entryId がありません。');

    if (previousEntryId && previousEntryId !== savedEntryId) {
      const previousEntry = entriesBefore.find((entry) => getEntryId(entry) === previousEntryId);
      await cancelEntryById(previousEntryId, previousEntry).catch(() => undefined);
    }

    setStatus(button, '保存結果を参加チーム一覧で確認しています。', 'saving');
    const visible = await confirmVisible(savedEntryId, contest.contestId);
    if (!visible) throw new Error('保存APIは応答しましたが、選択中の大会の参加チーム一覧で新チームを確認できませんでした。');

    rememberEntryId(userName, virtualKey, savedEntryId);
    setStatus(button, `エントリー完了。${contest.label}でユーザーネーム「${userName}」の1チームとして保存しました。`, 'saved');
    window.dispatchEvent(new CustomEvent('nihon-kabu-eleven:entry-saved', {
      detail: {
        teamName: getTeamName(),
        userName,
        entryId: savedEntryId,
        contestId: contest.contestId,
        matchType: contest.matchType,
      },
    }));
    hideButton(button);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(button, `エントリー保存に失敗しました：${message}`, 'error');
    button.disabled = false;
    button.textContent = originalText;
  } finally {
    submitting = false;
  }
}

export function initVirtualContestEntrySubmit() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.lock-button') : null;
    if (!button) return;
    void handleClick(button, event);
  }, true);
}
