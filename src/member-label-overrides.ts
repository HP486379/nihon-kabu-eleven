const MARKET_MEMBER_LABEL = 'ピッチ上メンバー(銘柄)';
const BENCH_MEMBER_LABEL = 'ベンチ入りメンバー(日本株代表候補リスト)';
const ENTRY_BUTTON_LABEL = '代表メンバーを確定して試合にエントリー';
const CANCEL_ENTRY_BUTTON_LABEL = 'エントリーを取り消す';
const ENTRY_DONE_STATUS_LABEL = 'エントリー済み';
const ENTRY_BANNER_CLASS = 'entry-complete-banner';
type EntryState = 'unknown' | 'entered' | 'editing';
let entryState: EntryState = 'unknown';

function syncMemberLabels() {
  const marketHeaderFirstCell = document.querySelector<HTMLElement>('.market-table-header span:first-child');
  if (marketHeaderFirstCell && marketHeaderFirstCell.textContent?.trim() !== MARKET_MEMBER_LABEL) {
    marketHeaderFirstCell.textContent = MARKET_MEMBER_LABEL;
  }

  const stockListTitle = document.querySelector<HTMLElement>('.stock-list-card .card-title-row h3');
  if (!stockListTitle) return;

  const currentText = stockListTitle.textContent?.trim() || '';
  if (currentText === BENCH_MEMBER_LABEL) return;
  if (currentText === '日本株代表候補リスト') {
    stockListTitle.textContent = BENCH_MEMBER_LABEL;
  }
}

function getTeamNameFromChip(teamChip: HTMLElement | null) {
  const chipText = teamChip?.textContent?.trim() || '';
  return chipText.split('｜')[0]?.trim() || 'あなたのチーム';
}

function renderEntryCompleteBanner(teamName: string) {
  let banner = document.querySelector<HTMLElement>(`.${ENTRY_BANNER_CLASS}`);
  if (!banner) {
    const matchStrip = document.querySelector<HTMLElement>('.match-strip');
    if (!matchStrip) return;

    banner = document.createElement('section');
    banner.className = `${ENTRY_BANNER_CLASS} card`;
    banner.setAttribute('aria-live', 'polite');

    const icon = document.createElement('div');
    icon.className = 'entry-complete-icon';
    icon.textContent = '⚽';

    const body = document.createElement('div');
    body.className = 'entry-complete-body';

    const title = document.createElement('strong');
    title.className = 'entry-complete-title';

    const message = document.createElement('span');
    message.className = 'entry-complete-message';

    body.append(title, message);
    banner.append(icon, body);
    matchStrip.insertAdjacentElement('afterend', banner);
  }

  const title = banner.querySelector<HTMLElement>('.entry-complete-title');
  if (title) title.textContent = `${teamName}、エントリー完了！`;

  const message = banner.querySelector<HTMLElement>('.entry-complete-message');
  if (message) message.textContent = '日本株代表カップに出場登録されました。試合結果はポジション加重リターンで判定されます。';
}

function removeEntryCompleteBanner() {
  document.querySelector<HTMLElement>(`.${ENTRY_BANNER_CLASS}`)?.remove();
}

function rewriteTeamChipStatus(teamChip: HTMLElement | null, status: 'entered' | 'editing') {
  if (!teamChip?.textContent) return;

  const nextLabel = status === 'entered' ? ENTRY_DONE_STATUS_LABEL : '編成中';
  teamChip.textContent = teamChip.textContent
    .replace('チーム確定済み', nextLabel)
    .replace(ENTRY_DONE_STATUS_LABEL, nextLabel);
}

function inferEntryState(lockButton: HTMLButtonElement | null, teamChip: HTMLElement | null): EntryState {
  if (entryState !== 'unknown') return entryState;

  const buttonText = lockButton?.textContent?.trim() || '';
  const chipText = teamChip?.textContent || '';
  if (buttonText === '確定を解除' || buttonText === CANCEL_ENTRY_BUTTON_LABEL || chipText.includes('チーム確定済み') || chipText.includes(ENTRY_DONE_STATUS_LABEL)) {
    return 'entered';
  }
  return 'editing';
}

function syncEntryLabels() {
  const lockButton = document.querySelector<HTMLButtonElement>('.lock-button');
  const teamChip = document.querySelector<HTMLElement>('.team-chip');
  const currentEntryState = inferEntryState(lockButton, teamChip);

  if (lockButton) {
    lockButton.classList.add('entry-lock-button');
    const currentText = lockButton.textContent?.trim() || '';
    if (currentEntryState === 'entered') {
      if (currentText === '確定を解除' || currentText === 'チームを確定' || currentText === ENTRY_BUTTON_LABEL) {
        lockButton.textContent = CANCEL_ENTRY_BUTTON_LABEL;
      }
    } else {
      if (currentText === 'チームを確定' || currentText === '確定を解除' || currentText === CANCEL_ENTRY_BUTTON_LABEL) {
        lockButton.textContent = ENTRY_BUTTON_LABEL;
      }
    }
  }

  if (currentEntryState === 'entered') {
    rewriteTeamChipStatus(teamChip, 'entered');
    renderEntryCompleteBanner(getTeamNameFromChip(teamChip));
    return;
  }

  rewriteTeamChipStatus(teamChip, 'editing');
  removeEntryCompleteBanner();
}

function scheduleApplyMemberLabels() {
  window.requestAnimationFrame(() => {
    applyMemberLabels();
    window.setTimeout(applyMemberLabels, 0);
    window.setTimeout(applyMemberLabels, 80);
  });
}

function applyMemberLabels() {
  syncMemberLabels();
  syncEntryLabels();
}

export function initMemberLabelOverrides() {
  window.setTimeout(applyMemberLabels, 0);

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(applyMemberLabels);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const lockButton = target?.closest<HTMLButtonElement>('.lock-button');
    if (!lockButton) return;

    const currentText = lockButton.textContent?.trim() || '';
    const isCancelClick = currentText === CANCEL_ENTRY_BUTTON_LABEL || currentText === '確定を解除';

    entryState = isCancelClick ? 'editing' : 'entered';
    if (isCancelClick) removeEntryCompleteBanner();
    scheduleApplyMemberLabels();
  }, true);
}
