import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';
import { getCurrentMatchType, setCurrentMatchType, type MatchType } from './lib/contestContext';

const MATCH_TABS: Array<{ type: MatchType; label: string }> = [
  { type: 'daily', label: 'デイリーマッチ' },
  { type: 'weekly', label: '1週間マッチ' },
  { type: 'monthly', label: '1か月マッチ' },
  { type: 'quarterly', label: '3か月マッチ' },
];

let initialized = false;
let loading = false;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isLockedStatus(status: string) {
  return status.includes('確定') || status.includes('完了') || status.toLowerCase().includes('locked');
}

function formatReturn(value: number | null) {
  if (value === null) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function returnClass(value: number | null) {
  if (value === null) return 'neutral';
  return value >= 0 ? 'positive' : 'negative';
}

function renderSummary(page: HTMLElement, participants: ParticipantItem[]) {
  const confirmed = participants.filter((team) => isLockedStatus(team.status)).length;
  const editing = Math.max(participants.length - confirmed, 0);
  const leader = participants[0];
  const summary = page.querySelector<HTMLElement>('.participants-summary-grid');
  if (!summary) return;
  summary.innerHTML = `
    <div><span>参加チーム</span><b>${participants.length}チーム</b></div>
    <div><span>確定済み</span><b>${confirmed}チーム</b></div>
    <div><span>編成中</span><b>${editing}チーム</b></div>
    <div><span>暫定首位</span><b>${leader ? escapeHtml(leader.team) : '-'}</b></div>
  `;
}

function renderRows(page: HTMLElement, participants: ParticipantItem[]) {
  const body = page.querySelector<HTMLElement>('[data-participants-body]');
  if (!body) return;

  if (participants.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="participants-empty-state">
            <strong>まだ参加チームがありません</strong>
            <span>この大会タイプでチームを確定すると、ここに表示されます。</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = participants.map((team) => {
    const locked = isLockedStatus(team.status);
    const disabled = team.id || (team.team && team.createdAt) ? '' : 'disabled';
    return `
      <tr data-entry-id="${escapeHtml(team.id)}" data-team-name="${escapeHtml(team.team)}" data-formation="${escapeHtml(team.formation)}" data-created-at="${escapeHtml(team.createdAt)}">
        <td><span class="participants-rank rank-${team.rank <= 3 ? team.rank : 'other'}">${team.rank}</span></td>
        <td><strong>${escapeHtml(team.team)}</strong><small>${escapeHtml(team.owner)} / ${escapeHtml(team.style)}</small></td>
        <td><b>${escapeHtml(team.formation)}</b></td>
        <td>${escapeHtml(team.matchType)}</td>
        <td><span class="participants-status ${locked ? 'locked' : 'editing'}">${escapeHtml(team.status)}</span></td>
        <td class="participants-return ${returnClass(team.returnPct)}">${formatReturn(team.returnPct)}</td>
        <td><button type="button" class="participants-cancel-button" data-entry-id="${escapeHtml(team.id)}" ${disabled}>取消</button></td>
      </tr>
    `;
  }).join('');
}

function setMessage(page: HTMLElement, message: string, type: 'idle' | 'error') {
  const box = page.querySelector<HTMLElement>('[data-participants-message]');
  if (!box) return;
  box.textContent = message;
  box.dataset.messageType = type;
}

function getToolbar(page: HTMLElement) {
  return page.querySelector<HTMLElement>('.participants-toolbar');
}

function buildTabHtml(current: MatchType) {
  return MATCH_TABS.map((tab) => `
    <button
      type="button"
      class="participants-match-tab ${tab.type === current ? 'selected' : ''}"
      data-match-type="${tab.type}"
      aria-pressed="${tab.type === current ? 'true' : 'false'}"
    >${tab.label}</button>
  `).join('');
}

function ensureToolbarMarkup(page: HTMLElement) {
  const toolbar = getToolbar(page);
  if (!toolbar) return;

  const current = getCurrentMatchType();
  const source = toolbar.querySelector<HTMLElement>('[data-participants-source]');
  const sourceText = source?.textContent?.trim() || 'APIから取得中...';

  const hasExpectedTabs = MATCH_TABS.every((tab) => toolbar.querySelector(`[data-match-type="${tab.type}"]`));
  const hasOnlyExpectedActiveDisplay = toolbar.querySelectorAll('.participants-match-current, .match-type-chip, [data-current-match-type]').length === 0;

  if (!hasExpectedTabs || !hasOnlyExpectedActiveDisplay) {
    toolbar.innerHTML = `${buildTabHtml(current)}<strong data-participants-source>${escapeHtml(sourceText)}</strong>`;
    return;
  }

  updateTabSelection(page, current);
}

function updateTabSelection(page: HTMLElement, current: MatchType = getCurrentMatchType()) {
  const toolbar = getToolbar(page);
  if (!toolbar) return;

  toolbar.querySelectorAll<HTMLButtonElement>('.participants-match-tab').forEach((button) => {
    const selected = button.dataset.matchType === current;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function renderTabs(page: HTMLElement) {
  ensureToolbarMarkup(page);
  updateTabSelection(page);
}

async function refreshParticipants(page: HTMLElement) {
  if (loading) return;
  loading = true;
  renderTabs(page);
  const source = page.querySelector<HTMLElement>('[data-participants-source]');
  if (source) source.textContent = 'APIから取得中...';
  try {
    const participants = await fetchParticipants();
    renderTabs(page);
    renderSummary(page, participants);
    renderRows(page, participants);
    if (source) source.textContent = 'API実データを表示中';
    setMessage(page, '', 'idle');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (source) source.textContent = 'API取得エラー';
    setMessage(page, `参加チームの取得に失敗しました：${message}`, 'error');
  } finally {
    loading = false;
  }
}

function bindPage(page: HTMLElement) {
  renderTabs(page);
  if (page.dataset.matchTabsBound === 'true') return;
  page.dataset.matchTabsBound = 'true';

  page.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.participants-match-tab') : null;
    const type = button?.dataset.matchType as MatchType | undefined;
    if (!button || !type) return;
    event.preventDefault();
    setCurrentMatchType(type);
    updateTabSelection(page, type);
    void refreshParticipants(page);
  });
}

function scan() {
  const page = document.getElementById('participants-page');
  if (page instanceof HTMLElement) bindPage(page);
}

export function initParticipantsMatchTabs() {
  if (initialized) return;
  initialized = true;
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('nihon-kabu-eleven:contest-changed', scan);
  window.setTimeout(scan, 0);
}