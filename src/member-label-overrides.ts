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
    renderEntryCompleteBanner(getTeamNameFromChip(teamChip));
    return;
  }

  removeEntryCompleteBanner();
}

function parsePercentText(text: string | undefined | null) {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function getHeaderMetricValue(label: string) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.metric-card'));
  const card = cards.find((item) => item.querySelector('span')?.textContent?.trim() === label);
  return parsePercentText(card?.querySelector('strong')?.textContent);
}

function formatSignedPct(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function buildLinePoints(values: number[], min: number, max: number) {
  const width = 250;
  const height = 86;
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = 12 + (index * (width - 24)) / Math.max(1, values.length - 1);
    const y = 8 + (height - 16) * (1 - (value - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function makeTrend(finalValue: number, shape: number[]) {
  return shape.map((rate) => Number((finalValue * rate).toFixed(2)));
}

function renderMatchupChart(card: HTMLElement, yourReturn: number) {
  const topReturn = Math.max(yourReturn + 22.4, yourReturn * 1.14, 18.42);
  const medianReturn = Math.max(Math.min(yourReturn * 0.52, yourReturn - 12), 5.92);
  const topGap = yourReturn - topReturn;
  const medianGap = yourReturn - medianReturn;
  const topix = 12.4;

  const yourTrend = makeTrend(yourReturn, [0, 0.16, 0.31, 0.45, 0.63, 0.82, 1]);
  const topTrend = makeTrend(topReturn, [0, 0.20, 0.38, 0.54, 0.71, 0.89, 1]);
  const medianTrend = makeTrend(medianReturn, [0, 0.13, 0.25, 0.39, 0.55, 0.76, 1]);
  const allValues = [...yourTrend, ...topTrend, ...medianTrend, topix];
  const min = Math.min(0, ...allValues);
  const max = Math.max(...allValues) * 1.08;
  const renderKey = [yourReturn, topReturn, medianReturn].map((value) => value.toFixed(2)).join('|');

  if (card.dataset.matchupChartKey === renderKey) return;
  card.dataset.matchupChartKey = renderKey;
  card.classList.add('matchup-chart-card');

  card.innerHTML = `
    <div class="card-title-row matchup-title-row">
      <h3>勝負状況 <small>（暫定リターン）</small></h3>
      <span>ⓘ</span>
    </div>
    <div class="matchup-score-grid">
      <div><span>あなた</span><strong>${formatSignedPct(yourReturn)}</strong></div>
      <div><span>現在1位</span><strong>${formatSignedPct(topReturn)}</strong></div>
      <div><span>中央値</span><strong>${formatSignedPct(medianReturn)}</strong></div>
    </div>
    <div class="matchup-chart-wrap" aria-label="あなた、現在1位、参加チーム中央値の暫定リターン推移">
      <svg viewBox="0 0 250 86" role="img">
        <line x1="12" y1="78" x2="238" y2="78" class="chart-axis-line" />
        <line x1="12" y1="45" x2="238" y2="45" class="chart-grid-line" />
        <polyline points="${buildLinePoints(medianTrend, min, max)}" class="chart-line chart-line-median" />
        <polyline points="${buildLinePoints(topTrend, min, max)}" class="chart-line chart-line-top" />
        <polyline points="${buildLinePoints(yourTrend, min, max)}" class="chart-line chart-line-you" />
      </svg>
    </div>
    <div class="matchup-legend">
      <span class="legend-you">あなた</span>
      <span class="legend-top">現在1位</span>
      <span class="legend-median">中央値</span>
    </div>
    <div class="matchup-gap-grid">
      <div><span>1位との差</span><strong>${formatSignedPct(topGap)}</strong></div>
      <div><span>中央値との差</span><strong>${formatSignedPct(medianGap)}</strong></div>
      <div><span>参考TOPIX</span><strong>${formatSignedPct(topix)}</strong></div>
    </div>
    <p class="chart-footnote">※ 現在の表示値をもとにした一回勝負の暫定推移です</p>
  `;
}

function syncMatchupChart() {
  const card = document.querySelector<HTMLElement>('.match-progress-card');
  if (!card) return;

  const yourReturn = getHeaderMetricValue('チームリターン');
  if (yourReturn === null) return;
  renderMatchupChart(card, yourReturn);
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
  syncMatchupChart();
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
