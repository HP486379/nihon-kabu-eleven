import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';

let isInitialized = false;
let isLoading = false;
let lastSignature = '';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getRankingTable() {
  return document.querySelector<HTMLElement>('.ranking-card .ranking-table');
}

function renderRows(participants: ParticipantItem[]) {
  if (participants.length === 0) {
    return `
      <div class="ranking-row">
        <span class="rank-badge">-</span>
        <div class="ranking-name"><strong>参加チームなし</strong><small>現在選択中の大会タイプに登録がありません</small></div>
        <b>--</b>
      </div>
    `;
  }

  return participants.slice(0, 5).map((participant) => `
    <div class="ranking-row" data-entry-id="${escapeHtml(participant.id)}">
      <span class="rank-badge">${participant.rank}</span>
      <div class="ranking-name"><strong>${escapeHtml(participant.team)}</strong><small>${escapeHtml(participant.style || participant.status)}</small></div>
      <b>${formatPct(participant.returnPct)}</b>
    </div>
  `).join('');
}

function renderDashboardRanking(participants: ParticipantItem[]) {
  const table = getRankingTable();
  if (!table) return false;

  const signature = participants.map((participant) => `${participant.id}:${participant.rank}:${participant.returnPct ?? 'waiting'}:${participant.team}`).join('|');
  if (signature === lastSignature && table.dataset.source === 'api') return true;
  lastSignature = signature;

  table.dataset.source = 'api';
  table.innerHTML = `
    <div class="ranking-header"><span>順位</span><span>チーム</span><span>成績</span></div>
    ${renderRows(participants)}
  `;

  const footnote = document.querySelector<HTMLElement>('.ranking-card .ranking-footnote');
  if (footnote) footnote.textContent = '※ API / Supabase の参加チームを現在の大会タイプで表示しています。';
  return true;
}

function renderDashboardRankingError(message: string) {
  const table = getRankingTable();
  if (!table) return;

  table.dataset.source = 'error';
  table.innerHTML = `
    <div class="ranking-header"><span>順位</span><span>チーム</span><span>成績</span></div>
    <div class="ranking-row">
      <span class="rank-badge">!</span>
      <div class="ranking-name"><strong>取得失敗</strong><small>${escapeHtml(message)}</small></div>
      <b>--</b>
    </div>
  `;
}

async function refreshDashboardRanking() {
  if (isLoading) return;
  isLoading = true;

  try {
    const participants = await fetchParticipants();
    renderDashboardRanking(participants);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderDashboardRankingError(message);
  } finally {
    isLoading = false;
  }
}

function scheduleRefresh(delayMs = 0) {
  window.setTimeout(() => {
    void refreshDashboardRanking();
  }, delayMs);
}

export function initDashboardParticipantRanking() {
  if (isInitialized) return;
  isInitialized = true;

  scheduleRefresh(600);
  scheduleRefresh(2200);

  window.addEventListener('nihon-kabu-eleven:entry-saved', () => scheduleRefresh(700));
  window.addEventListener('nihon-kabu-eleven:contest-changed', () => {
    lastSignature = '';
    scheduleRefresh(300);
  });
  window.addEventListener('focus', () => scheduleRefresh(300));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh(300);
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const label = target?.closest('a,button')?.textContent || '';
    if (label.includes('ダッシュボード') || label.includes('大会タイプ')) {
      scheduleRefresh(700);
    }
  });
}
