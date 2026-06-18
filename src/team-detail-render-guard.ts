import { fetchParticipants, type ParticipantItem, type ParticipantMember } from './lib/participantsApi';
import { getContestLabel, type MatchType } from './lib/contestContext';

const ROOT_ID = 'team-detail-page';
const ACTIVE_CLASS = 'team-detail-page-mode';
const MATCH_TYPES: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];
const POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;

let initialized = false;
let requestSeq = 0;

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

function formatPct(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function isMatchType(value: string | undefined): value is MatchType {
  return MATCH_TYPES.includes(value as MatchType);
}

function parseHash() {
  const match = window.location.hash.match(/^#\/teams\/(daily|weekly|monthly|quarterly)\/([^/?#]+)$/);
  if (match) return { matchType: match[1] as MatchType, entryId: decodeURIComponent(match[2]) };

  const legacy = window.location.hash.match(/^#\/teams\/([^/?#]+)$/);
  if (legacy) return { matchType: undefined, entryId: decodeURIComponent(legacy[1]) };

  return null;
}

function normalizeCode(value: string) {
  return value.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function getMemberCode(member: ParticipantMember) {
  return firstText(member.stockCode, member.stock_code, member.code);
}

function getMemberName(member: ParticipantMember) {
  return firstText(member.stockName, member.stock_name, member.name, getMemberCode(member));
}

function getMemberPosition(member: ParticipantMember) {
  const position = firstText(member.position).toUpperCase();
  return POSITIONS.includes(position as typeof POSITIONS[number]) ? position as typeof POSITIONS[number] : 'MF';
}

function getMemberOrder(member: ParticipantMember) {
  const raw = member.slotOrder ?? member.slot_order;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : 999;
}

function getMembers(team: ParticipantItem) {
  return Array.isArray(team.members) ? team.members : [];
}

function getShareMemberLine(team: ParticipantItem) {
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

function getShareText(team: ParticipantItem, matchType: MatchType) {
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

function findMainHost() {
  const header = document.querySelector<HTMLElement>('main.main .page-header, main .page-header, .main .page-header, .page-header');
  const explicitMain = document.querySelector<HTMLElement>('main.main, main, .main, .main-content, [role="main"]');
  const host = explicitMain || header?.parentElement || document.querySelector<HTMLElement>('.app-shell') || document.getElementById('root') || document.body;
  return { host, header };
}

function createOrGetPage() {
  let page = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (page) return page;

  const { host, header } = findMainHost();
  page = document.createElement('section');
  page.id = ROOT_ID;
  page.className = 'team-detail-page card';
  page.setAttribute('aria-label', 'チーム詳細');

  if (header && header.parentElement === host && header.nextSibling) {
    host.insertBefore(page, header.nextSibling);
  } else if (header && header.parentElement === host) {
    host.appendChild(page);
  } else {
    host.appendChild(page);
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

function renderPlayerCard(member: ParticipantMember) {
  const position = getMemberPosition(member);
  const positionClass = position.toLowerCase();
  const code = normalizeCode(getMemberCode(member));

  return `
    <article class="player-card position-${positionClass}">
      <div class="position-pill">${position}</div>
      <strong>${escapeHtml(getMemberName(member))}</strong>
      <small>${escapeHtml(code)}</small>
      <div class="player-change trend-up">取得待ち</div>
      <svg class="sparkline spark-${positionClass} trend-up" viewBox="0 0 112 34" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="22" x2="112" y2="14" />
      </svg>
    </article>
  `;
}

function renderPitchRow(members: ParticipantMember[], position: typeof POSITIONS[number]) {
  const rows = members
    .filter((member) => getMemberPosition(member) === position)
    .sort((a, b) => getMemberOrder(a) - getMemberOrder(b));

  return `
    <div class="pitch-row row-${position.toLowerCase()}">
      ${rows.map(renderPlayerCard).join('')}
    </div>
  `;
}

function renderMemberSection(team: ParticipantItem) {
  const members = getMembers(team);
  if (members.length === 0) {
    return `
      <div class="team-detail-empty-members">
        <strong>銘柄メンバーはまだ表示できません</strong>
        <span>このチームの銘柄データが取得できない場合は、APIの反映完了後に再読み込みしてください。</span>
      </div>
    `;
  }

  return `
    <div class="pitch-card team-detail-pitch-card">
      <div class="pitch-stage">
        <div class="pitch-markings"></div>
        <div class="pitch-players">
          ${renderPitchRow(members, 'FW')}
          ${renderPitchRow(members, 'MF')}
          ${renderPitchRow(members, 'DF')}
          ${renderPitchRow(members, 'GK')}
        </div>
      </div>
      <div class="pitch-legend">
        <span class="fw">FW</span>（フォワード）
        <span class="mf">MF</span>（ミッドフィールダー）
        <span class="df">DF</span>（ディフェンダー）
        <span class="gk">GK</span>（ゴールキーパー）
      </div>
    </div>
  `;
}

function renderDetail(team: ParticipantItem, matchType: MatchType) {
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
        <p>ダッシュボードと同じピッチ・カード表示で布陣を確認できます。</p>
      </div>
      ${renderMemberSection(team)}
    </div>
  `;
}

async function loadTeam(entryId: string, preferredMatchType?: MatchType) {
  const searchTypes = preferredMatchType
    ? [preferredMatchType, ...MATCH_TYPES.filter((type) => type !== preferredMatchType)]
    : MATCH_TYPES;

  for (const matchType of searchTypes) {
    const participants = await fetchParticipants(matchType);
    const team = participants.find((item) => item.id === entryId);
    if (team) return { team, matchType };
  }

  return null;
}

async function forceRenderFromHash() {
  const parsed = parseHash();
  if (!parsed) return;

  const seq = ++requestSeq;
  document.querySelector('.app-shell')?.classList.add(ACTIVE_CLASS);

  const existing = document.getElementById(ROOT_ID);
  if (!existing || existing.children.length === 0) renderLoading();

  try {
    const result = await loadTeam(parsed.entryId, parsed.matchType);
    if (seq !== requestSeq) return;

    if (!result) {
      renderError('現在の大会期間に該当するチームが見つかりませんでした。');
      return;
    }

    renderDetail(result.team, result.matchType);
  } catch (error) {
    if (seq !== requestSeq) return;
    renderError(error instanceof Error ? error.message : String(error));
  }
}

export function initTeamDetailRenderGuard() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.team-detail-open') : null;
    if (!button) return;

    const entryId = button.dataset.entryId || '';
    const matchType = isMatchType(button.dataset.matchType) ? button.dataset.matchType : undefined;
    if (!entryId) return;

    window.setTimeout(() => {
      if (!window.location.hash.startsWith('#/teams/')) {
        window.location.hash = `/teams/${matchType || 'monthly'}/${encodeURIComponent(entryId)}`;
      }
      void forceRenderFromHash();
    }, 80);

    window.setTimeout(() => {
      void forceRenderFromHash();
    }, 800);
  }, true);

  window.addEventListener('hashchange', () => {
    window.setTimeout(() => {
      void forceRenderFromHash();
    }, 80);
  });

  window.setTimeout(() => {
    void forceRenderFromHash();
  }, 500);
}
