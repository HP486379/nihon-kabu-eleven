import { DEV_CONTEST_ID, buildEntryPayload, submitEntry } from './lib/entryApi';

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

let isInitialized = false;
let isSubmitting = false;
let allowReactLockOnce = false;

function getText(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function getTeamName() {
  const chipText = getText('.team-chip');
  return chipText.split('｜')[0]?.trim() || 'ゲストジャパン';
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

function isCancelAction(label: string) {
  return label.includes('取り消') || label.includes('解除');
}

function isAlreadyEnteredError(message: string) {
  return message.includes('Active entry already exists') || message.includes('already exists');
}

async function handleCancelClick(button: HTMLButtonElement) {
  if (isSubmitting) return;

  const originalText = button.textContent || '編成を解除する';

  isSubmitting = true;
  button.disabled = true;
  button.textContent = '編成解除中...';
  setStatus(button, '保存済みチームは残したまま、編成画面に戻します。', 'saving');

  allowReactLockOnce = true;
  button.disabled = false;
  button.textContent = originalText;
  button.click();

  setStatus(button, '保存済みチームは参加チーム一覧に残っています。続けて別チームを作成できます。', 'saved');
  isSubmitting = false;
}

async function handleEntryClick(button: HTMLButtonElement, event: MouseEvent) {
  if (allowReactLockOnce) {
    allowReactLockOnce = false;
    return;
  }

  const label = button.textContent?.trim() || '';
  if (isCancelAction(label)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await handleCancelClick(button);
    return;
  }

  if (!label.includes('チームを確定') && !label.includes('エントリー')) return;

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

    const payload = buildEntryPayload({
      contestId: DEV_CONTEST_ID,
      teamName: getTeamName(),
      formation,
      selected: members,
    });

    await submitEntry(payload);

    setStatus(button, 'エントリー完了。大会に保存しました。', 'saved');
    allowReactLockOnce = true;
    button.disabled = false;
    button.textContent = originalText;
    button.click();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAlreadyEnteredError(message)) {
      setStatus(button, 'この大会には既にエントリー済みです。APIとSupabaseの重複チェックは正常に動いています。', 'warning');
    } else {
      setStatus(button, `エントリー保存に失敗しました：${message}`, 'error');
    }
    button.disabled = false;
    button.textContent = originalText;
  } finally {
    isSubmitting = false;
  }
}

function setupEntryButton() {
  const button = document.querySelector<HTMLButtonElement>('.lock-button');
  if (!button || button.dataset.entrySubmitReady === 'true') return;

  button.dataset.entrySubmitReady = 'true';
  button.addEventListener('click', (event) => {
    void handleEntryClick(button, event);
  }, true);
}

export function initEntrySubmit() {
  if (isInitialized) return;
  isInitialized = true;

  const observer = new MutationObserver(setupEntryButton);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(setupEntryButton, 0);
}
