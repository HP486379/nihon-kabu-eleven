import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';

let isInitialized = false;
let isLoading = false;
let lastSignature = '';

const USER_NAME_STORAGE_KEY = 'nihon-kabu-eleven:user-name';

function normalizeCompare(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function isConfirmedParticipant(participant: ParticipantItem) {
  const status = participant.status || '';
  return status.includes('確定') || status.includes('完了') || status.toLowerCase().includes('locked');
}

function getDashboardSummaryCard() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.side-card'));
  return cards.find((card) => card.querySelector('h3')?.textContent?.trim() === '試合サマリー') || null;
}

function getSummaryBlock(card: HTMLElement, labelText: string) {
  const blocks = Array.from(card.querySelectorAll<HTMLElement>('.summary-block'));
  return blocks.find((block) => block.querySelector('.label')?.textContent?.trim() === labelText) || null;
}

function setBlockText(block: HTMLElement | null, recordText: string, detailText: string, options?: { positive?: boolean }) {
  if (!block) return false;

  const record = block.querySelector<HTMLElement>('.record, .loss-rate');
  const subtext = block.querySelector<HTMLElement>('.subtext');

  if (record) {
    record.textContent = recordText;
    record.classList.toggle('positive-rank', Boolean(options?.positive));
  }
  if (subtext) subtext.textContent = detailText;
  return true;
}

function setSummaryText(totalText: string, detailText: string) {
  const card = getDashboardSummaryCard();
  if (!card) return false;
  return setBlockText(getSummaryBlock(card, '参加チーム'), totalText, detailText);
}

function readCurrentUserName() {
  try {
    return normalizeCompare(window.localStorage.getItem(USER_NAME_STORAGE_KEY) || '');
  } catch (_error) {
    return '';
  }
}

function findOwnParticipant(participants: ParticipantItem[]) {
  const userName = readCurrentUserName();
  if (!userName) return null;

  return participants.find((participant) => normalizeCompare(participant.owner) === userName) || null;
}

function renderOwnTeamSummary(participants: ParticipantItem[]) {
  const card = getDashboardSummaryCard();
  if (!card) return false;

  const block = getSummaryBlock(card, 'あなたのチーム');
  if (!block) return false;

  if (participants.length === 0) {
    return setBlockText(block, '未エントリー', '現在の大会に参加チームがありません');
  }

  const own = findOwnParticipant(participants);
  if (!own) {
    return setBlockText(block, '未エントリー', '現在の大会にあなたのチームはありません');
  }

  return setBlockText(
    block,
    `暫定 ${own.rank}位`,
    typeof own.returnPct === 'number' ? `暫定リターン ${formatPct(own.returnPct)}` : '集計待ち',
    { positive: true },
  );
}

function setHeaderMetric(labelText: string, valueText: string) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.header-metrics .metric-card'));
  const card = cards.find((item) => item.querySelector('span')?.textContent?.trim() === labelText);
  const value = card?.querySelector<HTMLElement>('strong');
  if (value) value.textContent = valueText;
}

function renderHeaderContestMetrics(participants: ParticipantItem[]) {
  const own = findOwnParticipant(participants);

  if (!own) {
    setHeaderMetric('チームリターン', '-');
    setHeaderMetric('現在の順位', participants.length === 0 ? '-' : '未エントリー');
    return;
  }

  setHeaderMetric('チームリターン', formatPct(own.returnPct));
  setHeaderMetric('現在の順位', `🏆 ${own.rank}位 / ${participants.length}`);
}

function renderParticipantSummary(participants: ParticipantItem[]) {
  const confirmed = participants.filter(isConfirmedParticipant).length;
  const editing = Math.max(participants.length - confirmed, 0);
  const own = findOwnParticipant(participants);
  const signature = `${participants.length}:${confirmed}:${editing}:${own?.id || 'no-own'}:${own?.returnPct ?? 'waiting'}`;
  if (signature === lastSignature && getDashboardSummaryCard()) return;

  lastSignature = signature;
  setSummaryText(`${participants.length}チーム`, `確定済み ${confirmed} / 編成中 ${editing}`);
  renderOwnTeamSummary(participants);
  renderHeaderContestMetrics(participants);
}

async function refreshDashboardParticipantSummary() {
  if (isLoading) return;
  isLoading = true;

  try {
    const participants = await fetchParticipants();
    renderParticipantSummary(participants);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSummaryText('取得失敗', `参加チーム一覧APIを確認してください：${message}`);
    renderOwnTeamSummary([]);
    renderHeaderContestMetrics([]);
  } finally {
    isLoading = false;
  }
}

function scheduleRefresh(delayMs = 0) {
  window.setTimeout(() => {
    void refreshDashboardParticipantSummary();
  }, delayMs);
}

export function initDashboardParticipantSummary() {
  if (isInitialized) return;
  isInitialized = true;

  scheduleRefresh(500);
  scheduleRefresh(2000);

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
    if (label.includes('ダッシュボード') || label.includes('参加チーム')) {
      scheduleRefresh(700);
    }
  });
}
