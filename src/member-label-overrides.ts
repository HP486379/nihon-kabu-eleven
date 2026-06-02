const MARKET_MEMBER_LABEL = 'ピッチ上メンバー(銘柄)';
const BENCH_MEMBER_LABEL = 'ベンチ入りメンバー(日本株代表候補リスト)';
const ENTRY_BUTTON_LABEL = '代表メンバーを確定して試合にエントリー';
const CANCEL_ENTRY_BUTTON_LABEL = 'エントリーを取り消す';
const ENTRY_DONE_STATUS_LABEL = 'エントリー済み';
const ENTRY_BANNER_CLASS = 'entry-complete-banner';

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

function syncEntryLabels() {
  const lockButton = document.querySelector<HTMLButtonElement>('.lock-button');
  const teamChip = document.querySelector<HTMLElement>('.team-chip');

  const isEnteredBeforeRewrite = Boolean(
    teamChip?.textContent?.includes(ENTRY_DONE_STATUS_LABEL)
    || teamChip?.textContent?.includes('チーム確定済み')
    || lockButton?.textContent?.trim() === CANCEL_ENTRY_BUTTON_LABEL
    || lockButton?.textContent?.trim() === '確定を解除',
  );

  if (lockButton) {
    lockButton.classList.add('entry-lock-button');
    const currentText = lockButton.textContent?.trim() || '';
    if (currentText === 'チームを確定') {
      lockButton.textContent = ENTRY_BUTTON_LABEL;
    }
    if (currentText === '確定を解除') {
      lockButton.textContent = CANCEL_ENTRY_BUTTON_LABEL;
    }
  }

  if (teamChip?.textContent?.includes('チーム確定済み')) {
    teamChip.textContent = teamChip.textContent.replace('チーム確定済み', ENTRY_DONE_STATUS_LABEL);
  }

  const isEntered = Boolean(
    isEnteredBeforeRewrite
    || teamChip?.textContent?.includes(ENTRY_DONE_STATUS_LABEL)
    || lockButton?.textContent?.trim() === CANCEL_ENTRY_BUTTON_LABEL,
  );

  if (isEntered) {
    renderEntryCompleteBanner(getTeamNameFromChip(teamChip));
  } else {
    removeEntryCompleteBanner();
  }
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
    if (target?.closest('.lock-button')) {
      scheduleApplyMemberLabels();
    }
  });
}
