import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';
import { getEntryFormMatchType, type MatchType } from './lib/contestContext';

let isInitialized = false;
let lastSignature = '';
let requestSeq = 0;

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getRankingTable() {
  return document.querySelector<HTMLElement>('.ranking-card .ranking-table');
}

function getRankingRows(table: HTMLElement) {
  return Array.from(table.querySelectorAll<HTMLElement>('.ranking-row'));
}

function setRowHidden(row: HTMLElement, hidden: boolean) {
  row.hidden = hidden;
  row.style.display = hidden ? 'none' : '';
}

function writeRow(row: HTMLElement, rank: string, team: string, status: string, result: string) {
  row.className = 'ranking-row';
  setRowHidden(row, false);

  const badge = row.querySelector<HTMLElement>('.rank-badge');
  const name = row.querySelector<HTMLElement>('.ranking-name strong');
  const sub = row.querySelector<HTMLElement>('.ranking-name small');
  const value = row.querySelector<HTMLElement>('b');

  if (badge) badge.textContent = rank;
  if (name) name.textContent = team;
  if (sub) sub.textContent = status;
  if (value) value.textContent = result;
}

function renderMessage(table: HTMLElement, rank: string, title: string, message: string) {
  const rows = getRankingRows(table);
  const [firstRow, ...restRows] = rows;
  if (!firstRow) return false;

  writeRow(firstRow, rank, title, message, '--');
  restRows.forEach((row) => setRowHidden(row, true));
  return true;
}

function renderDashboardRanking(participants: ParticipantItem[], matchType: MatchType) {
  const table = getRankingTable();
  if (!table) return false;

  const signature = `${matchType}::${participants.map((participant) => `${participant.id}:${participant.rank}:${participant.returnPct ?? 'waiting'}:${participant.team}`).join('|')}`;
  if (signature === lastSignature && table.dataset.source === 'api') return true;
  lastSignature = signature;

  table.dataset.source = 'api';
  table.dataset.matchType = matchType;

  if (participants.length === 0) {
    const rendered = renderMessage(table, '-', '参加チームなし', '現在選択中の大会タイプに登録がありません');
    const footnote = document.querySelector<HTMLElement>('.ranking-card .ranking-footnote');
    if (footnote) footnote.textContent = '※ API / Supabase の参加チームを現在の大会タイプで表示しています。';
    return rendered;
  }

  const rows = getRankingRows(table);
  if (rows.length === 0) return false;

  participants.slice(0, rows.length).forEach((participant, index) => {
    writeRow(
      rows[index],
      String(participant.rank),
      participant.team,
      participant.style || participant.status,
      formatPct(participant.returnPct),
    );
    rows[index].dataset.entryId = participant.id;
  });

  rows.slice(participants.length).forEach((row) => setRowHidden(row, true));

  const footnote = document.querySelector<HTMLElement>('.ranking-card .ranking-footnote');
  if (footnote) footnote.textContent = '※ API / Supabase の参加チームを現在の大会タイプで表示しています。';
  return true;
}

function renderDashboardRankingError(message: string) {
  const table = getRankingTable();
  if (!table) return;

  table.dataset.source = 'error';
  renderMessage(table, '!', '取得失敗', message);
}

async function refreshDashboardRanking() {
  const matchType = getEntryFormMatchType();
  const requestId = ++requestSeq;

  try {
    const participants = await fetchParticipants(matchType);
    if (requestId !== requestSeq) return;
    renderDashboardRanking(participants, matchType);
  } catch (error) {
    if (requestId !== requestSeq) return;
    const message = error instanceof Error ? error.message : String(error);
    renderDashboardRankingError(message);
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
