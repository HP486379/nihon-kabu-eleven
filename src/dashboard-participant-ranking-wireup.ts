import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';
import { getEntryFormMatchType, type MatchType } from './lib/contestContext';

let isInitialized = false;
let lastSignature = '';
let requestSeq = 0;

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getRankingCard() {
  return document.querySelector<HTMLElement>('.ranking-card');
}

function getRankingTable() {
  return document.querySelector<HTMLElement>('.ranking-card .ranking-table');
}

function getRankingRows(table: HTMLElement) {
  return Array.from(table.querySelectorAll<HTMLElement>('.ranking-row'));
}

function setDisplayAttr(element: HTMLElement | null, name: string, value: string) {
  if (!element) return;
  element.dataset[name] = value;
}

function setRowData(row: HTMLElement, rank: string, team: string, status: string, result: string, entryId = '') {
  row.dataset.rankingEmpty = 'false';
  if (entryId) row.dataset.entryId = entryId;

  setDisplayAttr(row.querySelector<HTMLElement>('.rank-badge'), 'rankingRank', rank);
  setDisplayAttr(row.querySelector<HTMLElement>('.ranking-name strong'), 'rankingTeam', team);
  setDisplayAttr(row.querySelector<HTMLElement>('.ranking-name small'), 'rankingStatus', status);
  setDisplayAttr(row.querySelector<HTMLElement>('b'), 'rankingResult', result);
}

function clearRowData(row: HTMLElement) {
  row.dataset.rankingEmpty = 'true';
  delete row.dataset.entryId;

  setDisplayAttr(row.querySelector<HTMLElement>('.rank-badge'), 'rankingRank', '');
  setDisplayAttr(row.querySelector<HTMLElement>('.ranking-name strong'), 'rankingTeam', '');
  setDisplayAttr(row.querySelector<HTMLElement>('.ranking-name small'), 'rankingStatus', '');
  setDisplayAttr(row.querySelector<HTMLElement>('b'), 'rankingResult', '');
}

function renderMessage(table: HTMLElement, rank: string, title: string, message: string) {
  const rows = getRankingRows(table);
  const [firstRow, ...restRows] = rows;
  if (!firstRow) return false;

  setRowData(firstRow, rank, title, message, '--');
  restRows.forEach(clearRowData);
  return true;
}

function renderDashboardRanking(participants: ParticipantItem[], matchType: MatchType) {
  const card = getRankingCard();
  const table = getRankingTable();
  if (!card || !table) return false;

  const signature = `${matchType}::${participants.map((participant) => `${participant.id}:${participant.rank}:${participant.returnPct ?? 'waiting'}:${participant.team}`).join('|')}`;
  if (signature === lastSignature && card.dataset.rankingSource === 'api') return true;
  lastSignature = signature;

  card.dataset.rankingSource = 'api';
  card.dataset.rankingMatchType = matchType;
  table.dataset.source = 'api';
  table.dataset.matchType = matchType;

  if (participants.length === 0) {
    return renderMessage(table, '-', '参加チームなし', '現在選択中の大会タイプに登録がありません');
  }

  const rows = getRankingRows(table);
  if (rows.length === 0) return false;

  participants.slice(0, rows.length).forEach((participant, index) => {
    setRowData(
      rows[index],
      String(participant.rank),
      participant.team,
      participant.style || participant.status,
      formatPct(participant.returnPct),
      participant.id,
    );
  });

  rows.slice(participants.length).forEach(clearRowData);
  return true;
}

function renderDashboardRankingError(message: string) {
  const card = getRankingCard();
  const table = getRankingTable();
  if (!card || !table) return;

  card.dataset.rankingSource = 'error';
  table.dataset.source = 'error';
  renderMessage(table, '!', '取得失敗', message);
}

async function refreshDashboardRanking() {
  const requestId = ++requestSeq;

  try {
    const matchType = getEntryFormMatchType();
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
