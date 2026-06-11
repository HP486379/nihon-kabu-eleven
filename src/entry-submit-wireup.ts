import { DEV_CONTEST_ID, buildEntryPayload, submitEntry, type SubmitEntryResult } from './lib/entryApi';

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
  message?: string;
  error?: string;
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

let isInitialized = false;
let isSubmitting = false;

function getText(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function getTeamName() {
  const chipText = getText('.team-chip');
  return chipText.split('｜')[0]?.trim() || 'ゲストジャパン';
}

function isReactLockedMode() {
  return getText('.team-chip').includes('チーム確定済み');
}

function getFormationConfig() {
  const key = getText('.formation-number');
  return FORMATION_CONFIGS[key] || null;
}

function getMarketByCode(code: string) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.stock-item'));
  const matched = cards.find((card) => (card.textContent || '').includes(code));
  const metaText = matched?.querySelector('small')?.textContent || '';
  const [, market] = metaText.split('/').map((value) => value.trim());
  return market || '任意追加';
}

function readSelectedMembers(): SelectedMember[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.player-card')).map((card) => {
    const positionText = card.querySelector<HTMLElement>('.position-pill')?.textContent?.trim();
    const position = ['FW', 'MF', 'DF', 'GK'].includes(positionText || '') ? positionText as Position : 'MF';
    const code = card.querySelector('small')?.textContent?.trim() || '';
    const name = card.querySelector('strong')?.textContent?.trim() || code;

    return {
      code,
      name,
      market: getMarketByCode(code),
      position,
    };
  }).filter((member) => Boolean(member.code));
}

function ensureStatusElement(button: HTMLButtonElement) {
  const parent = button.parentElement;
  if (!parent) return null;

  const existing = parent.querySelector<HTMLElement>('.entry-submit-status');
  if (existing) return existing;

  const element = document.createElement('p');
  element.className = 'entry-submit-status helper-text';
  element.setAttribute('aria-live', 'polite');
  parent.appendChild(element);
  return element;
}

function clearStatus(button: HTMLButtonElement) {
  const parent = button.parentElement;
  const existing = parent?.querySelector<HTMLElement>('.entry-submit-status');
  if (!existing) return;
  existing.textContent = '';
  delete existing.dataset.status;
}

function setStatus(button: HTMLButtonElement, message: string, type: 'idle' | 'saving' | 'saved' | 'warning' | 'error') {
  const element = ensureStatusElement(button);
  if (!element) return;

  element.textContent = message;
  element.dataset.status = type;
  element.style.margin = '8px 0 0';
  element.style.fontWeight = type === 'error' || type === 'warning' ? '700' : '600';
}

function validateMembers(members: SelectedMember[], formation: FormationConfig) {
  if (members.length !== 11) return '11銘柄を選抜してからエントリーしてください。';

  const counts = members.reduce<Record<Position, number>>((acc, member) => {
    acc[member.position] += 1;
    return acc;
  }, { FW: 0, MF: 0, DF: 0, GK: 0 });

  const mismatch = (Object.keys(formation.counts) as Position[]).find((position) => counts[position] !== formation.counts[position]);
  if (mismatch) return `${formation.key} の ${mismatch} 人数が一致していません。`;

  const uniqueCodes = new Set(members.map((member) => member.code));
  if (uniqueCodes.size !== members.length) return '同じ銘柄が重複しています。';

  return null;
}

function isCreateAnotherAction(button: HTMLButtonElement, label: string) {
  return button.dataset.entryAction === 'create-another' || label.includes('別チームを作る') || label.includes('チームを作り直す');
}

function isEntryAction(label: string) {
  return !label.includes('別チームを作る')
    && !label.includes('チームを作り直す')
    && !label.includes('取り消')
    && (label.includes('チームを確定') || label.includes('エントリー'));
}

function isAlreadyEnteredError(message: string) {
  return message.includes('Active entry already exists') || message.includes('already exists');
}

function getSavedEntryId(result: SubmitEntryResult) {
  return result.entryId || result.entry_id || result.entry?.id || result.entry?.entryId || result.entry?.entry_id || '';
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function normalizeEntryList(result: EntryListResult): EntryListItem[] {
  if (Array.isArray(result.entries)) return result.entries;
  if (Array.isArray(result.participants)) return result.participants;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

function entryMatches(entry: EntryListItem, entryId: string) {
  const listedId = firstText(entry.entryId, entry.entry_id, entry.id);
  return Boolean(entryId) && listedId === entryId;
}

function getEntryId(entry: EntryListItem) {
  return firstText(entry.entryId, entry.entry_id, entry.id);
}

function getEntryUserName(entry: EntryListItem) {
  return firstText(entry.userName, entry.user_name, entry.owner);
}

function getEntryOwnerKey(entry: EntryListItem) {
  return firstText(entry.ownerKey, entry.owner_key);
}

function normalizeUserName(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function isValidUserName(value: string) {
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
    // localStorage is best-effort only.
  }
}

function getOrCreateOwnerKey() {
  const existing = readStorage(OWNER_KEY_STORAGE_KEY);
  if (existing) return existing;

  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeStorage(OWNER_KEY_STORAGE_KEY, generated);
  return generated;
}

function getEntryStorageKey(userName: string) {
  return `${ENTRY_ID_STORAGE_PREFIX}${userName}`;
}

function getStoredEntryId(userName: string) {
  return readStorage(getEntryStorageKey(userName));
}

function rememberEntryId(userName: string, entryId: string) {
  writeStorage(getEntryStorageKey(userName), entryId);
}

function getOrRegisterUserName() {
  const stored = normalizeUserName(readStorage(USER_NAME_STORAGE_KEY));
  if (isValidUserName(stored)) return stored;

  const raw = window.prompt('ユーザーネームを登録してください。半角英数字・ハイフン・アンダースコアで3〜24文字です。例：Taro');
  if (raw === null) return null;

  const normalized = normalizeUserName(raw);
  if (!isValidUserName(normalized)) {
    throw new Error('ユーザーネームは半角英数字・ハイフン・アンダースコアで3〜24文字にしてください。');
  }

  writeStorage(USER_NAME_STORAGE_KEY, normalized);
  return normalized;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchEntryList() {
  const response = await fetch(`${API_BASE}/api/entries?ts=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) return [];
  const result = await response.json().catch(() => ({})) as EntryListResult;
  return normalizeEntryList(result);
}

function findUserNameConflict(entries: EntryListItem[], userName: string, ownerKey: string, previousEntryId: string) {
  return entries.find((entry) => {
    const entryUserName = normalizeUserName(getEntryUserName(entry));
    if (!entryUserName || entryUserName !== userName) return false;

    const entryId = getEntryId(entry);
    if (previousEntryId && entryId === previousEntryId) return false;

    const entryOwnerKey = getEntryOwnerKey(entry);
    if (entryOwnerKey && entryOwnerKey === ownerKey) return false;

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

  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { message?: string; error?: string; details?: string };
    throw new Error(result.message || result.error || `entry cancel api ${response.status}`);
  }
}

async function confirmEntryVisible(entryId: string) {
  const delays = [0, 300, 800, 1500, 2500];
  for (const delay of delays) {
    if (delay) await wait(delay);
    const entries = await fetchEntryList();
    if (entries.some((entry) => entryMatches(entry, entryId))) return true;
  }
  return false;
}

async function submitReplacingPrevious(payload: ReturnType<typeof buildEntryPayload>, previousEntryId: string, entriesBefore: EntryListItem[]) {
  try {
    return await submitEntry(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyEnteredError(message) || !previousEntryId) throw error;

    const previousEntry = entriesBefore.find((entry) => entryMatches(entry, previousEntryId));
    await cancelEntryById(previousEntryId, previousEntry);
    return submitEntry(payload);
  }
}

async function handleEntryClick(button: HTMLButtonElement, event: MouseEvent) {
  const label = button.textContent?.trim() || '';

  if (isCreateAnotherAction(button, label)) {
    const shouldLetReactUnlock = isReactLockedMode();
    clearStatus(button);

    if (shouldLetReactUnlock) {
      button.dataset.entryAction = 'unlocking';
      window.setTimeout(setupEntryButton, 0);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    restoreEntryButton(button);
    window.setTimeout(setupEntryButton, 0);
    return;
  }

  if (!isEntryAction(label)) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (isSubmitting) return;

  const formation = getFormationConfig();
  if (!formation) {
    setStatus(button, 'フォーメーション情報を取得できませんでした。', 'error');
    return;
  }

  const members = readSelectedMembers();
  const validationError = validateMembers(members, formation);
  if (validationError) {
    setStatus(button, validationError, 'error');
    return;
  }

  const originalText = button.textContent || 'チームを確定';

  try {
    isSubmitting = true;
    button.disabled = true;
    button.textContent = 'エントリー保存中...';
    setStatus(button, '大会エントリーを保存しています。', 'saving');

    const userName = getOrRegisterUserName();
    if (!userName) {
      setStatus(button, 'ユーザーネーム登録をキャンセルしました。', 'warning');
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    const ownerKey = getOrCreateOwnerKey();
    const previousEntryId = getStoredEntryId(userName);
    const entriesBefore = await fetchEntryList();
    const conflict = findUserNameConflict(entriesBefore, userName, ownerKey, previousEntryId);
    if (conflict) {
      throw new Error(`ユーザーネーム「${userName}」は既に使われています。別のユーザーネームを登録してください。`);
    }

    const payload = buildEntryPayload({
      contestId: DEV_CONTEST_ID,
      teamName: getTeamName(),
      userName,
      ownerKey,
      formation,
      selected: members,
    });

    const result = await submitReplacingPrevious(payload, previousEntryId, entriesBefore);
    const savedEntryId = getSavedEntryId(result);
    if (!savedEntryId) {
      throw new Error('保存結果に entryId がありません。');
    }

    if (previousEntryId && previousEntryId !== savedEntryId) {
      const previousEntry = entriesBefore.find((entry) => entryMatches(entry, previousEntryId));
      await cancelEntryById(previousEntryId, previousEntry).catch(() => undefined);
    }

    setStatus(button, '保存結果を参加チーム一覧で確認しています。', 'saving');
    const visible = await confirmEntryVisible(savedEntryId);
    if (!visible) {
      throw new Error('保存APIは応答しましたが、参加チーム一覧のAPIで新チームを確認できませんでした。');
    }

    rememberEntryId(userName, savedEntryId);
    setStatus(button, `エントリー完了。ユーザーネーム「${userName}」の1チームとして保存しました。`, 'saved');
    button.disabled = false;
    showCreateAnotherButton(button);
    window.dispatchEvent(new CustomEvent('nihon-kabu-eleven:entry-saved', { detail: { teamName: payload.teamName, userName, entryId: savedEntryId } }));
    window.setTimeout(setupEntryButton, 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(button, `エントリー保存に失敗しました：${message}`, 'error');
    button.disabled = false;
    button.textContent = originalText;
  } finally {
    isSubmitting = false;
  }
}

function removeCancelButton(lockButton: HTMLButtonElement) {
  const parent = lockButton.parentElement;
  parent?.querySelector<HTMLButtonElement>('.cancel-entry-button')?.remove();
}

function restoreEntryButton(button: HTMLButtonElement) {
  button.dataset.entryAction = 'entry';
  button.classList.remove('create-another-team-button');
  removeCancelButton(button);
  if (button.textContent?.trim() !== 'チームを確定') {
    button.textContent = 'チームを確定';
  }
}

function showCreateAnotherButton(button: HTMLButtonElement) {
  button.dataset.entryAction = 'create-another';
  button.classList.add('create-another-team-button');
  if (button.textContent?.trim() !== 'チームを作り直す') {
    button.textContent = 'チームを作り直す';
  }
  removeCancelButton(button);
}

function syncEntryActionButtons(button: HTMLButtonElement) {
  const label = button.textContent?.trim() || '';

  if (label.includes('チームを確定')) {
    restoreEntryButton(button);
    return;
  }

  const shouldShowCreateAnother = label.includes('別チームを作る')
    || label.includes('チームを作り直す')
    || label.includes('エントリーを取り消す')
    || label.includes('確定を解除')
    || label.includes('解除');

  if (!shouldShowCreateAnother) return;

  showCreateAnotherButton(button);
}

function setupEntryButton() {
  const button = document.querySelector<HTMLButtonElement>('.lock-button');
  if (!button) return;

  syncEntryActionButtons(button);

  if (button.dataset.entrySubmitReady === 'true') return;

  button.dataset.entrySubmitReady = 'true';
  button.addEventListener('click', (event) => {
    void handleEntryClick(button, event);
  }, true);
}

export function initEntrySubmit() {
  if (isInitialized) return;
  isInitialized = true;

  const observer = new MutationObserver(setupEntryButton);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(setupEntryButton, 0);
}
