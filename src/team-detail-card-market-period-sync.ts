import { fetchParticipants, type ParticipantItem, type ParticipantMember } from './lib/participantsApi';
import { getContestLabel, type MatchType } from './lib/contestContext';

type PriceCandle = {
  t?: number;
  close?: number;
};

type TeamDetailParticipant = ParticipantItem & {
  members?: ParticipantMember[];
};

const MARKET_API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const ROOT_ID = 'team-detail-page';
const ROOT_SELECTOR = `#${ROOT_ID}`;
const ACTIVE_CLASS = 'team-detail-page-mode';
const MATCH_TYPES: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];
const POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;

const RANGE_BY_MATCH: Record<MatchType, string> = {
  daily: '5d',
  weekly: '5d',
  monthly: '1mo',
  quarterly: '3mo',
};

const RETURN_MODE_BY_MATCH: Record<MatchType, 'daily' | 'period'> = {
  daily: 'daily',
  weekly: 'period',
  monthly: 'period',
  quarterly: 'period',
};

let initialized = false;
let syncSeq = 0;
let fallbackSeq = 0;
let fallbackInFlightKey = '';
let scheduledTimer: number | null = null;

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

function normalizeCode(value: string) {
  return value.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
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

function getDetailMatchType(): MatchType | null {
  const page = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  const pageMatchType = page?.dataset.matchType;
  if (isMatchType(pageMatchType)) return pageMatchType;

  const hashMatch = window.location.hash.match(/^#\/teams\/(daily|weekly|monthly|quarterly)\//);
  const hashMatchType = hashMatch?.[1];
  return isMatchType(hashMatchType) ? hashMatchType : null;
}

function getMembers(team: TeamDetailParticipant) {
  return Array.isArray(team.members) ? team.members : [];
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

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatCardPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '取得待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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
  } else {
    document.body.appendChild(page);
  }

  return page;
}

function renderFallbackLoading() {
  const page = createOrGetPage();
  page.innerHTML = `
    <div class="team-detail-loading">
      <strong>チーム詳細を読み込んでいます...</strong>
    </div>
  `;
}

function renderFallbackError(message: string) {
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

function renderFallbackPlayerCard(member: ParticipantMember) {
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

function renderFallbackPitchRow(members: ParticipantMember[], position: typeof POSITIONS[number]) {
  const rows = members
    .filter((member) => getMemberPosition(member) === position)
    .sort((a, b) => getMemberOrder(a) - getMemberOrder(b));

  return `
    <div class="pitch-row row-${position.toLowerCase()}">
      ${rows.map(renderFallbackPlayerCard).join('')}
    </div>
  `;
}

function renderFallbackMemberSection(team: TeamDetailParticipant) {
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
          ${renderFallbackPitchRow(members, 'FW')}
          ${renderFallbackPitchRow(members, 'MF')}
          ${renderFallbackPitchRow(members, 'DF')}
          ${renderFallbackPitchRow(members, 'GK')}
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

function renderFallbackDetail(team: TeamDetailParticipant, matchType: MatchType) {
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
      ${renderFallbackMemberSection(team)}
    </div>
  `;
}

async function loadTeam(entryId: string, preferredMatchType?: MatchType) {
  const searchTypes = preferredMatchType
    ? [preferredMatchType, ...MATCH_TYPES.filter((type) => type !== preferredMatchType)]
    : MATCH_TYPES;

  for (const matchType of searchTypes) {
    const participants = await fetchParticipants(matchType);
    const team = participants.find((item) => item.id === entryId) as TeamDetailParticipant | undefined;
    if (team) return { team, matchType };
  }

  return null;
}

function hasRenderedDetailPage() {
  const page = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!page) return false;
  if (page.querySelector('.team-detail-loading')) return false;
  return page.children.length > 0;
}

async function ensureDetailPageRendered(force = false) {
  const parsed = parseHash();
  if (!parsed) return;

  document.querySelector('.app-shell')?.classList.add(ACTIVE_CLASS);

  if (!force && hasRenderedDetailPage()) return;

  const key = `${parsed.matchType || 'auto'}:${parsed.entryId}`;
  if (fallbackInFlightKey === key) return;
  fallbackInFlightKey = key;
  const seq = ++fallbackSeq;

  if (!hasRenderedDetailPage()) renderFallbackLoading();

  try {
    const result = await loadTeam(parsed.entryId, parsed.matchType);
    if (seq !== fallbackSeq) return;
    if (!result) {
      renderFallbackError('現在の大会期間に該当するチームが見つかりませんでした。');
      return;
    }

    const currentPage = document.querySelector<HTMLElement>(ROOT_SELECTOR);
    if (!force && currentPage?.dataset.entryId === result.team.id && hasRenderedDetailPage()) return;

    renderFallbackDetail(result.team, result.matchType);
    window.setTimeout(() => scheduleSync(80), 0);
  } catch (error) {
    if (seq !== fallbackSeq) return;
    renderFallbackError(error instanceof Error ? error.message : String(error));
  } finally {
    if (fallbackInFlightKey === key) fallbackInFlightKey = '';
  }
}

function scheduleEnsure(delay = 0, force = false) {
  window.setTimeout(() => {
    void ensureDetailPageRendered(force);
  }, delay);
}

function getDetailCards() {
  return Array.from(document.querySelectorAll<HTMLElement>(`${ROOT_SELECTOR} .team-detail-pitch-card .player-card`));
}

function getCardCode(card: HTMLElement) {
  return normalizeCode(card.querySelector('small')?.textContent || '');
}

function getCardPosition(card: HTMLElement) {
  if (card.classList.contains('position-fw')) return 'fw';
  if (card.classList.contains('position-mf')) return 'mf';
  if (card.classList.contains('position-df')) return 'df';
  if (card.classList.contains('position-gk')) return 'gk';
  return 'mf';
}

function computePeriodReturn(candles: PriceCandle[], mode: 'daily' | 'period') {
  const closes = candles
    .map((candle) => Number(candle.close))
    .filter((value) => Number.isFinite(value));

  if (mode === 'daily') {
    const last = closes.at(-1);
    const previous = closes.at(-2);
    return typeof last === 'number' && typeof previous === 'number' && previous !== 0
      ? (last / previous - 1) * 100
      : null;
  }

  const first = closes.at(0);
  const last = closes.at(-1);
  return typeof first === 'number' && typeof last === 'number' && first !== 0
    ? (last / first - 1) * 100
    : null;
}

function buildSparklinePoints(candles: PriceCandle[], width = 112, height = 34) {
  const closes = candles
    .map((candle) => Number(candle.close))
    .filter((value) => Number.isFinite(value));
  if (closes.length < 2) return '';

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const step = width / Math.max(1, closes.length - 1);

  return closes.map((close, index) => {
    const x = index * step;
    const y = height - ((close - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

async function fetchCandles(code: string, range: string) {
  const url = `${MARKET_API_BASE}/api/history/${encodeURIComponent(code)}?range=${encodeURIComponent(range)}&interval=1d&periodLocked=1`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];
  const payload = await response.json() as { candles?: PriceCandle[] };
  return Array.isArray(payload.candles) ? payload.candles : [];
}

function updateCard(card: HTMLElement, returnPct: number, candles: PriceCandle[]) {
  const position = getCardPosition(card);
  const trendClass = returnPct >= 0 ? 'trend-up' : 'trend-down';
  const oppositeClass = returnPct >= 0 ? 'trend-down' : 'trend-up';

  const change = card.querySelector<HTMLElement>('.player-change');
  if (change) {
    change.textContent = formatCardPct(returnPct);
    change.classList.remove(oppositeClass);
    change.classList.add(trendClass);
  }

  const svg = card.querySelector<SVGSVGElement>('svg.sparkline');
  if (!svg) return;

  svg.classList.remove('trend-up', 'trend-down');
  svg.classList.add(trendClass);
  svg.classList.add(`spark-${position}`);

  const points = buildSparklinePoints(candles);
  if (!points) return;

  svg.querySelectorAll('line').forEach((line) => line.remove());
  let polyline = svg.querySelector<SVGPolylineElement>('polyline');
  if (!polyline) {
    polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    svg.appendChild(polyline);
  }
  polyline.setAttribute('points', points);
}

async function syncTeamDetailCardMarketPeriod() {
  const page = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!page) return;

  const seq = ++syncSeq;
  const matchType = getDetailMatchType();
  if (!matchType) return;

  const range = RANGE_BY_MATCH[matchType] || '3mo';
  const mode = RETURN_MODE_BY_MATCH[matchType] || 'period';
  const cardByCode = new Map<string, HTMLElement[]>();

  getDetailCards().forEach((card) => {
    const code = getCardCode(card);
    if (!code) return;
    const cards = cardByCode.get(code) || [];
    cards.push(card);
    cardByCode.set(code, cards);
  });

  const entries = [...cardByCode.entries()];
  if (entries.length === 0) return;

  await Promise.all(entries.map(async ([code, cards]) => {
    try {
      const candles = await fetchCandles(code, range);
      if (seq !== syncSeq || candles.length < 2) return;
      const returnPct = computePeriodReturn(candles, mode);
      if (returnPct === null) return;
      cards.forEach((card) => {
        if (document.body.contains(card)) updateCard(card, returnPct, candles);
      });
    } catch (_error) {
      // Keep the current card display when market data is unavailable.
    }
  }));
}

function scheduleSync(delay = 0) {
  if (scheduledTimer !== null) window.clearTimeout(scheduledTimer);
  scheduledTimer = window.setTimeout(() => {
    scheduledTimer = null;
    void syncTeamDetailCardMarketPeriod();
  }, delay);
}

export function initTeamDetailCardMarketPeriodSync() {
  if (initialized) return;
  initialized = true;

  const observer = new MutationObserver(() => {
    const isDetailMode = document.querySelector('.app-shell')?.classList.contains(ACTIVE_CLASS);
    if (isDetailMode && (!document.querySelector(ROOT_SELECTOR) || !hasRenderedDetailPage())) {
      scheduleEnsure(240, false);
    }
    if (!document.querySelector(ROOT_SELECTOR)) return;
    scheduleSync(160);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => {
    scheduleEnsure(220, false);
    scheduleEnsure(1800, true);
    scheduleSync(220);
    scheduleSync(900);
  });

  document.addEventListener('click', (event) => {
    const openButton = event.target instanceof HTMLElement ? event.target.closest('.team-detail-open') : null;
    if (!openButton) return;
    scheduleEnsure(600, false);
    scheduleEnsure(2200, true);
    scheduleSync(500);
    scheduleSync(1300);
  });

  scheduleEnsure(1500, false);
  scheduleEnsure(3200, true);
  scheduleSync(1500);
}
