import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';
import { getEntryFormMatchType, type MatchType } from './lib/contestContext';

let isInitialized = false;
let requestSeq = 0;
let lastSignature = '';

const USER_NAME_STORAGE_KEY = 'nihon-kabu-eleven:user-name';

function normalizeCompare(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function readCurrentUserName() {
  try {
    return normalizeCompare(window.localStorage.getItem(USER_NAME_STORAGE_KEY) || '');
  } catch (_error) {
    return '';
  }
}

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatSignedDiff(value: number | null) {
  return formatPct(value);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusCard() {
  return document.querySelector<HTMLElement>('.match-progress-card');
}

function findOwnParticipant(participants: ParticipantItem[]) {
  const userName = readCurrentUserName();
  if (!userName) return null;
  return participants.find((participant) => normalizeCompare(participant.owner) === userName) || null;
}

function getReferenceTopix(matchType: MatchType) {
  // TODO: replace with real TOPIX period return once the index API is formalized.
  if (matchType === 'daily') return null;
  if (matchType === 'weekly') return null;
  if (matchType === 'monthly') return null;
  return null;
}

function buildLinePoints(value: number | null, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const width = 220;
  const height = 70;
  const range = max - min || 1;
  const endY = height - ((value - min) / range) * height;
  const midY = height - (((value * 0.55) - min) / range) * height;
  return `0,${height.toFixed(1)} 72,${midY.toFixed(1)} 148,${((height + endY) / 2).toFixed(1)} 220,${endY.toFixed(1)}`;
}

function renderChart(ownReturn: number | null, leaderReturn: number | null, medianReturn: number | null) {
  const values = [ownReturn, leaderReturn, medianReturn].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) {
    return '<div class="dashboard-status-chart-empty">集計待ち</div>';
  }

  const min = Math.min(0, ...values) - 2;
  const max = Math.max(0, ...values) + 2;
  const ownPoints = buildLinePoints(ownReturn, min, max);
  const leaderPoints = buildLinePoints(leaderReturn, min, max);
  const medianPoints = buildLinePoints(medianReturn, min, max);

  return `
    <svg class="dashboard-status-chart" viewBox="0 0 240 92" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="82" x2="240" y2="82" class="chart-axis" />
      <line x1="0" y1="48" x2="240" y2="48" class="chart-grid-line" />
      ${leaderPoints ? `<polyline class="status-line line-leader" points="${leaderPoints}" />` : ''}
      ${ownPoints ? `<polyline class="status-line line-own" points="${ownPoints}" />` : ''}
      ${medianPoints ? `<polyline class="status-line line-median" points="${medianPoints}" />` : ''}
    </svg>
  `;
}

function renderNoParticipants(matchType: MatchType) {
  const card = getStatusCard();
  if (!card) return false;

  card.dataset.source = 'api';
  card.dataset.matchType = matchType;
  card.innerHTML = `
    <div class="card-title-row">
      <h3>勝負状況 <small>（暫定リターン）</small></h3>
      <span>ⓘ</span>
    </div>
    <div class="dashboard-status-metrics">
      <div class="dashboard-status-metric"><span>あなた</span><strong>-</strong></div>
      <div class="dashboard-status-metric"><span>現在1位</span><strong>-</strong></div>
      <div class="dashboard-status-metric"><span>中央値</span><strong>-</strong></div>
    </div>
    <div class="dashboard-status-chart-empty">現在選択中の大会タイプに参加チームがありません</div>
    <p class="dashboard-status-note">※ API / Supabase の参加チームを現在の大会タイプで集計しています。</p>
  `;
  return true;
}

function renderStatus(participants: ParticipantItem[], matchType: MatchType) {
  const card = getStatusCard();
  if (!card) return false;

  if (participants.length === 0) return renderNoParticipants(matchType);

  const returns = participants
    .map((participant) => participant.returnPct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const leader = participants.find((participant) => typeof participant.returnPct === 'number' && Number.isFinite(participant.returnPct));
  const leaderReturn = leader?.returnPct ?? null;
  const medianReturn = median(returns);
  const own = findOwnParticipant(participants);
  const ownReturn = own?.returnPct ?? null;
  const topDiff = ownReturn !== null && leaderReturn !== null ? ownReturn - leaderReturn : null;
  const medianDiff = ownReturn !== null && medianReturn !== null ? ownReturn - medianReturn : null;
  const referenceTopix = getReferenceTopix(matchType);
  const signature = `${matchType}:${participants.map((participant) => `${participant.id}:${participant.returnPct ?? 'waiting'}:${participant.rank}`).join('|')}:own:${own?.id || 'none'}`;
  if (signature === lastSignature && card.dataset.source === 'api') return true;
  lastSignature = signature;

  card.dataset.source = 'api';
  card.dataset.matchType = matchType;
  card.innerHTML = `
    <div class="card-title-row">
      <h3>勝負状況 <small>（暫定リターン）</small></h3>
      <span>ⓘ</span>
    </div>
    <div class="dashboard-status-metrics">
      <div class="dashboard-status-metric"><span>あなた</span><strong class="${ownReturn !== null && ownReturn >= 0 ? 'positive' : ownReturn !== null ? 'negative' : ''}">${own ? formatPct(ownReturn) : '未エントリー'}</strong></div>
      <div class="dashboard-status-metric"><span>現在1位</span><strong class="${leaderReturn !== null && leaderReturn >= 0 ? 'positive' : leaderReturn !== null ? 'negative' : ''}">${formatPct(leaderReturn)}</strong></div>
      <div class="dashboard-status-metric"><span>中央値</span><strong class="${medianReturn !== null && medianReturn >= 0 ? 'positive' : medianReturn !== null ? 'negative' : ''}">${formatPct(medianReturn)}</strong></div>
    </div>
    <div class="dashboard-status-chart-wrap">
      ${renderChart(ownReturn, leaderReturn, medianReturn)}
    </div>
    <div class="dashboard-status-legend">
      <span class="legend-own">あなた</span>
      <span class="legend-leader">現在1位</span>
      <span class="legend-median">中央値</span>
    </div>
    <div class="dashboard-status-diffs">
      <div><span>1位との差</span><strong>${formatSignedDiff(topDiff)}</strong></div>
      <div><span>中央値との差</span><strong>${formatSignedDiff(medianDiff)}</strong></div>
      <div><span>参考TOPIX</span><strong>${referenceTopix === null ? '-' : formatPct(referenceTopix)}</strong></div>
    </div>
    <p class="dashboard-status-note">※ 現在の大会タイプに登録された参加チームの暫定リターンで表示しています。</p>
  `;
  return true;
}

function renderError(message: string) {
  const card = getStatusCard();
  if (!card) return;

  card.dataset.source = 'error';
  card.innerHTML = `
    <div class="card-title-row">
      <h3>勝負状況 <small>（暫定リターン）</small></h3>
      <span>ⓘ</span>
    </div>
    <div class="dashboard-status-chart-empty">取得失敗：${escapeHtml(message)}</div>
  `;
}

async function refreshDashboardMatchStatus() {
  const matchType = getEntryFormMatchType();
  const requestId = ++requestSeq;

  try {
    const participants = await fetchParticipants(matchType);
    if (requestId !== requestSeq) return;
    renderStatus(participants, matchType);
  } catch (error) {
    if (requestId !== requestSeq) return;
    renderError(error instanceof Error ? error.message : String(error));
  }
}

function scheduleRefresh(delayMs = 0) {
  window.setTimeout(() => {
    void refreshDashboardMatchStatus();
  }, delayMs);
}

export function initDashboardMatchStatus() {
  if (isInitialized) return;
  isInitialized = true;

  scheduleRefresh(700);
  scheduleRefresh(2300);

  window.addEventListener('nihon-kabu-eleven:entry-saved', () => scheduleRefresh(700));
  window.addEventListener('nihon-kabu-eleven:contest-changed', () => {
    lastSignature = '';
    scheduleRefresh(300);
  });
  window.addEventListener('focus', () => scheduleRefresh(300));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh(300);
  });
}
