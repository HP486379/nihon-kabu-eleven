import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';

let isInitialized = false;
let isLoading = false;
let lastSignature = '';

function isConfirmedParticipant(participant: ParticipantItem) {
  const status = participant.status || '';
  return status.includes('確定') || status.includes('完了') || status.toLowerCase().includes('locked');
}

function getDashboardSummaryCard() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.side-card'));
  return cards.find((card) => card.querySelector('h3')?.textContent?.trim() === '試合サマリー') || null;
}

function getParticipantSummaryBlock(card: HTMLElement) {
  const blocks = Array.from(card.querySelectorAll<HTMLElement>('.summary-block'));
  return blocks.find((block) => block.querySelector('.label')?.textContent?.trim() === '参加チーム') || null;
}

function setSummaryText(totalText: string, detailText: string) {
  const card = getDashboardSummaryCard();
  if (!card) return false;

  const block = getParticipantSummaryBlock(card);
  if (!block) return false;

  const record = block.querySelector<HTMLElement>('.record');
  const subtext = block.querySelector<HTMLElement>('.subtext');
  if (record) record.textContent = totalText;
  if (subtext) subtext.textContent = detailText;
  return true;
}

function renderParticipantSummary(participants: ParticipantItem[]) {
  const confirmed = participants.filter(isConfirmedParticipant).length;
  const editing = Math.max(participants.length - confirmed, 0);
  const signature = `${participants.length}:${confirmed}:${editing}`;
  if (signature === lastSignature && getDashboardSummaryCard()) return;

  lastSignature = signature;
  setSummaryText(`${participants.length}チーム`, `確定済み ${confirmed} / 編成中 ${editing}`);
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
