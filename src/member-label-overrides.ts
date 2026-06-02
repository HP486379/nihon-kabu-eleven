const MARKET_MEMBER_LABEL = 'ピッチ上メンバー(銘柄)';
const BENCH_MEMBER_LABEL = 'ベンチ入りメンバー(日本株代表候補リスト)';
const ENTRY_BUTTON_LABEL = '代表メンバーを確定して試合にエントリー';
const CANCEL_ENTRY_BUTTON_LABEL = 'エントリーを取り消す';
const ENTRY_DONE_STATUS_LABEL = 'エントリー済み';

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

function syncEntryLabels() {
  const lockButton = document.querySelector<HTMLButtonElement>('.lock-button');
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

  const teamChip = document.querySelector<HTMLElement>('.team-chip');
  if (teamChip?.textContent?.includes('チーム確定済み')) {
    teamChip.textContent = teamChip.textContent.replace('チーム確定済み', ENTRY_DONE_STATUS_LABEL);
  }
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
}
