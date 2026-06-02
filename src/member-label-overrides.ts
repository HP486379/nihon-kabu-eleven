const MARKET_MEMBER_LABEL = 'ピッチ上メンバー(銘柄)';
const BENCH_MEMBER_LABEL = 'ベンチ入りメンバー(日本株代表候補リスト)';

function applyMemberLabels() {
  const marketHeaderFirstCell = document.querySelector<HTMLElement>('.market-table-header span:first-child');
  if (marketHeaderFirstCell && marketHeaderFirstCell.textContent !== MARKET_MEMBER_LABEL) {
    marketHeaderFirstCell.textContent = MARKET_MEMBER_LABEL;
  }

  const stockListTitle = document.querySelector<HTMLElement>('.stock-list-card .card-title-row h3');
  if (!stockListTitle) return;

  const currentText = stockListTitle.textContent?.trim() || '';
  if (currentText === '日本株代表候補リスト' || currentText === 'ベンチ入りメンバー(日本株代表候補リスト)') {
    stockListTitle.textContent = BENCH_MEMBER_LABEL;
  }
}

export function initMemberLabelOverrides() {
  const observer = new MutationObserver(applyMemberLabels);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(applyMemberLabels, 0);
}
