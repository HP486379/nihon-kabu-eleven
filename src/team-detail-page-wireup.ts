import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';
import { getContestLabel, getEntryFormMatchType, type MatchType } from './lib/contestContext';

const ROOT_ID = 'team-detail-page';
const ACTIVE_CLASS = 'team-detail-page-mode';
const MATCH_TYPES: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];

let initialized = false;
let requestSeq = 0;

type TeamMember = {
  stockCode?: string | null;
  stock_code?: string | null;
  code?: string | null;
  stockName?: string | null;
  stock_name?: string | null;
  name?: string | null;
  market?: string | null;
  position?: string | null;
  slotOrder?: number | string | null;
  slot_order?: number | string | null;
  weight?: number | string | null;
};

type TeamDetailParticipant = ParticipantItem & {
  periodId?: string;
  period_id?: string;
  members?: TeamMember[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getSelectedParticipantMatchType(): MatchType | null {
  const selected = document.querySelector<HTMLElement>('#participants-page .participants-match-tab.selected');
  const type = selected?.dataset.matchType;
  return MATCH_TYPES.includes(type as MatchType) ? type as MatchType : null;
}

function getVisibleMatchType(): MatchType {
  return getSelectedParticipantMatchType() || getEntryFormMatchType();
}

function getDetailUrl(entryId: string, matchType: MatchType) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/teams/${matchType}/${encodeURIComponent(entryId)}`;
}

function getMembers(team: TeamDetailParticipant) {
  return Array.isArray(team.members) ? team.members : [];
}

function getMemberCode(member: TeamMember) {
  return firstText(member.stockCode, member.stock_code, member.code);
}

function getMemberName(member: TeamMember) {
  return firstText(member.stockName, member.stock_name, member.name, getMemberCode(member));
}

function getMemberPosition(member: TeamMember) {
  const position = firstText(member.position).toUpperCase();
  return ['FW', 'MF', 'DF', 'GK'].includes(position) ? position : 'MF';
}

function getMemberOrder(member: TeamMember) {
  const raw = member.slotOrder ?? member.slot_order;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 999;
}

function getShareMemberLine(team: TeamDetailParticipant) {
  const members = getMembers(team);
  if (members.length === 0) return '';

  const forwards = members
    .filter((member) => getMemberPosition(member) === 'FW')
    .sort((a, b) => getMemberOrder(a) - getMemberOrder(b))
    .map(getMemberName)
    .filter(Boolean)
    .slice(0, 3);

  if (forwards.length > 0) return `注目FW：${forwards.join(' / ')}`;

  const picks = members
    .sort((a, b) => getMemberOrder(a) - getMemberOrder(b))
    .map(getMemberName)
    .filter(Boolean)
    .slice(0, 3);

  return picks.length > 0 ? `代表メンバー：${picks.join(' / ')}` : '';
}

function getShareText(team: TeamDetailParticipant, matchType: MatchType) {
  const matchLabel = getContestLabel(matchType);
  const memberLine = getShareMemberLine(team);
  return [
    `日本株代表イレブン2026で「${team.team}」を編成しました⚽📈`,
    '',
    `大会：${matchLabel}`,
    `布陣：${team.formation}`,
    memberLine,
    `暫定順位：${team.rank}位`,
    `暫定リターン：${formatPct(team.returnPct)}`,
    '',
    '#日本株代表イレブン #日本株 #個人開発',
  ].filter((line) => line !== '').join('\n');
}

function openXShare(team: TeamDetailParticipant, matchType: MatchType) {
  const url = getDetailUrl(team.id, matchType);
  const text = getShareText(team, matchType);
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(intent, '_blank', 'noopener,noreferrer');
}

async function copyShareUrl(team: TeamDetailParticipant, matchType: MatchType) {
  const url = getDetailUrl(team.id, matchType);
  try {
    await navigator.clipboard.writeText(url);
    setDetailMessage('共有URLをコピーしました。', 'success');
  } catch (_error) {
    window.prompt('共有URLをコピーしてください', url);
  }
}

function setDetailMessage(message: string, type: 'idle' | 'success' | 'error') {
  const box = document.querySelector<HTMLElement>(`#${ROOT_ID} [data-team-detail-message]`);
  if (!box) return;
  box.textContent = message;
  box.dataset.messageType = type;
}

function renderMemberSection(team: TeamDetailParticipant) {
  const members = getMembers(team);
  if (members.length === 0) {
    return `
      <div class="team-detail-empty-members">
        <strong>銘柄メンバーはまだ表示できません</strong>
        <span>このチームの銘柄データが取得できない場合は、APIの反映完了後に再読み込みしてください。</span>
      </div>
    `;
  }

  return ['FW', 'MF', 'DF', 'GK'].map((position) => {
    const rows = members
      .filter((member) => getMemberPosition(member) === position)
      .sort((a, b) => getMemberOrder(a) - getMemberOrder(b));

    if (rows.length === 0) return '';

    return `
      <section class="team-detail-position-group position-${position.toLowerCase()}">
        <h3>${position}</h3>
        <div class="team-detail-member-grid">
          ${rows.map((member) => `
            <article class="team-detail-member-card">
              <span>${escapeHtml(getMemberCode(member))}</span>
              <strong>${escapeHtml(getMemberName(member))}</strong>
              <small>${escapeHtml(firstText(member.market) || '日本株')}</small>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');
}

function createOrGetPage() {
  let page = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (page) return page;

  const main = document.querySelector('main.main');
  const header = main?.querySelector('.page-header');
  page = document.createElement('section');
  page.id = ROOT_ID;
  page.className = 'team-detail-page card';
  page.setAttribute('aria-label', 'チーム詳細');

  if (main) {
    if (header?.nextSibling) main.insertBefore(page, header.nextSibling);
    else main.appendChild(page);
  }

  return page;
}

function renderLoading() {
  const page = createOrGetPage();
  page.innerHTML = `
    <div class="team-detail-loading">
      <strong>チーム詳細を読み込んでいます...</strong>
    </div>
  `;
}

function renderError(message: string) {
  const page = createOrGetPage();
  page.innerHTML = `
    <div class="team-detail-page-hero">
      <div>
        <p class="team-detail-kicker">TEAM DETAIL</p>
        <h2>チーム詳細を表示できません</h2>
        <p>${escapeHtml(message)}</p>
      </div>
      <button type="button" class="team-detail-back-button">戻る</button>
    </div>
  `;
}

function renderDetail(team: TeamDetailParticipant, matchType: MatchType) {
  const page = createOrGetPage();
  const matchLabel = getContestLabel(matchType);
  page.dataset.entryId = team.id;
  page.dataset.matchType = matchType;
  page.innerHTML = `
    <div class="team-detail-page-hero">
      <div>
        <p class="team-detail-kicker">TEAM DETAIL</p>
        <h2>${escapeHtml(team.team)}</h2>
        <p>${escapeHtml(team.owner)} 監督の ${escapeHtml(matchLabel)} エントリーです。</p>
      </div>
      <div class="team-detail-actions">
        <button type="button" class="team-detail-share-x">Xで共有</button>
        <button type="button" class="team-detail-copy-url">URLコピー</button>
        <button type="button" class="team-detail-back-button">戻る</button>
      </div>
    </div>

    <div class="team-detail-message" data-team-detail-message data-message-type="idle"></div>

    <div class="team-detail-summary-grid">
      <div><span>大会</span><b>${escapeHtml(matchLabel)}</b></div>
      <div><span>布陣</span><b>${escapeHtml(team.formation || '-')}</b></div>
      <div><span>暫定順位</span><b>${team.rank ? `${team.rank}位` : '-'}</b></div>
      <div><span>暫定リターン</span><b>${escapeHtml(formatPct(team.returnPct))}</b></div>
      <div><span>状態</span><b>${escapeHtml(team.status || '確定済み')}</b></div>
      <div><span>代表メンバー</span><b>${getMembers(team).length || '-'}銘柄</b></div>
    </div>

    <div class="team-detail-share-preview">
      <strong>共有文プレビュー</strong>
      <pre>${escapeHtml(getShareText(team, matchType))}</pre>
    </div>

    <div class="team-detail-members">
      <div class="team-detail-section-title">
        <h3>代表メンバー</h3>
        <p>チームの布陣と銘柄構成を見せ合うための詳細ページです。</p>
      </div>
      ${renderMemberSection(team)}
    </div>
  `;
}

async function loadTeam(entryId: string, preferredMatchType?: MatchType) {
  const searchTypes = preferredMatchType
    ? [preferredMatchType, ...MATCH_TYPES.filter((type) => type !== preferredMatchType)]
    : [getVisibleMatchType(), ...MATCH_TYPES.filter((type) => type !== getVisibleMatchType())];

  for (const matchType of searchTypes) {
    const participants = await fetchParticipants(matchType);
    const team = participants.find((item) => item.id === entryId) as TeamDetailParticipant | undefined;
    if (team) return { team, matchType };
  }

  return null;
}

async function showTeamDetail(entryId: string, preferredMatchType?: MatchType) {
  const shell = document.querySelector('.app-shell');
  const requestId = ++requestSeq;
  shell?.classList.add(ACTIVE_CLASS);
  renderLoading();

  try {
    const result = await loadTeam(entryId, preferredMatchType);
    if (requestId !== requestSeq) return;
    if (!result) {
      renderError('現在の大会期間に該当するチームが見つかりませんでした。');
      return;
    }
    renderDetail(result.team, result.matchType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    if (requestId !== requestSeq) return;
    renderError(error instanceof Error ? error.message : String(error));
  }
}

function hideTeamDetail() {
  document.querySelector('.app-shell')?.classList.remove(ACTIVE_CLASS);
  document.getElementById(ROOT_ID)?.remove();
}

function parseHash() {
  const match = window.location.hash.match(/^#\/teams\/(daily|weekly|monthly|quarterly)\/([^/?#]+)$/);
  if (match) return { matchType: match[1] as MatchType, entryId: decodeURIComponent(match[2]) };

  const legacy = window.location.hash.match(/^#\/teams\/([^/?#]+)$/);
  if (legacy) return { matchType: undefined, entryId: decodeURIComponent(legacy[1]) };

  return null;
}

function openDetail(entryId: string, matchType: MatchType = getVisibleMatchType()) {
  if (!entryId) return;
  window.location.hash = `/teams/${matchType}/${encodeURIComponent(entryId)}`;
  void showTeamDetail(entryId, matchType);
}

function bindDetailPageActions() {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const openButton = target.closest<HTMLButtonElement>('.team-detail-open');
    if (openButton) {
      event.preventDefault();
      const entryId = openButton.dataset.entryId || '';
      const matchType = openButton.dataset.matchType as MatchType | undefined;
      openDetail(entryId, MATCH_TYPES.includes(matchType as MatchType) ? matchType as MatchType : getVisibleMatchType());
      return;
    }

    const page = target.closest<HTMLElement>(`#${ROOT_ID}`);
    if (!page) return;

    const backButton = target.closest<HTMLButtonElement>('.team-detail-back-button');
    if (backButton) {
      event.preventDefault();
      if (window.location.hash.startsWith('#/teams/')) {
        window.history.pushState('', document.title, `${window.location.pathname}${window.location.search}`);
      }
      hideTeamDetail();
      return;
    }
  });
}

async function handlePageActionClick(event: MouseEvent) {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const page = target?.closest<HTMLElement>(`#${ROOT_ID}`);
  if (!target || !page) return;

  const hash = parseHash();
  if (!hash) return;
  const result = await loadTeam(hash.entryId, hash.matchType);
  if (!result) return;

  if (target.closest('.team-detail-share-x')) {
    event.preventDefault();
    openXShare(result.team, result.matchType);
  }

  if (target.closest('.team-detail-copy-url')) {
    event.preventDefault();
    void copyShareUrl(result.team, result.matchType);
  }
}

function enhanceDetailButtons() {
  const visibleMatchType = getVisibleMatchType();

  document.querySelectorAll<HTMLTableRowElement>('tr[data-entry-id]').forEach((row) => {
    const entryId = row.dataset.entryId || '';
    if (!entryId || row.dataset.teamDetailEnhanced === 'true') return;
    const actionCell = row.querySelector<HTMLTableCellElement>('td:last-child');
    if (!actionCell) return;
    row.dataset.teamDetailEnhanced = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'team-detail-open participants-detail-button';
    button.dataset.entryId = entryId;
    button.dataset.matchType = visibleMatchType;
    button.textContent = '詳細';
    actionCell.prepend(button);
  });

  document.querySelectorAll<HTMLElement>('.ranking-row[data-entry-id]').forEach((row) => {
    const entryId = row.dataset.entryId || '';
    if (!entryId || row.dataset.teamDetailEnhanced === 'true') return;
    row.dataset.teamDetailEnhanced = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'team-detail-open ranking-detail-button';
    button.dataset.entryId = entryId;
    button.dataset.matchType = visibleMatchType;
    button.textContent = '見る';
    row.appendChild(button);
  });
}

function bindHashRoute() {
  const openFromHash = () => {
    const parsed = parseHash();
    if (!parsed) return;
    void showTeamDetail(parsed.entryId, parsed.matchType);
  };

  window.addEventListener('hashchange', openFromHash);
  window.setTimeout(openFromHash, 0);
}

export function initTeamDetailPage() {
  if (initialized) return;
  initialized = true;

  bindDetailPageActions();
  bindHashRoute();
  document.addEventListener('click', (event) => {
    void handlePageActionClick(event as MouseEvent);
  });

  const observer = new MutationObserver(enhanceDetailButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('nihon-kabu-eleven:contest-changed', () => window.setTimeout(enhanceDetailButtons, 100));
  window.setTimeout(enhanceDetailButtons, 800);
  window.setTimeout(enhanceDetailButtons, 2200);
}
