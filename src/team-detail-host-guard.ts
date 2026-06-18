import { fetchParticipants, type ParticipantItem, type ParticipantMember } from './lib/participantsApi';
import { getContestLabel, type MatchType } from './lib/contestContext';

const ROOT_ID = 'team-detail-page';
const ACTIVE_CLASS = 'team-detail-page-mode';
const OTHER_PAGE_CLASSES = ['participants-page-mode', 'contest-list-mode', 'formation-page-mode', 'results-page-mode'];
const MATCH_TYPES: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];
const POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;
const MARKET_API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

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

const RETURN_LABEL_BY_MATCH: Record<MatchType, string> = {
  daily: '本日リターン',
  weekly: '1週間リターン',
  monthly: '1か月リターン',
  quarterly: '3か月リターン',
};

type PriceCandle = {
  t?: number;
  close?: number;
};

let requestSeq = 0;
let marketSyncSeq = 0;
let initialized = false;

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

function formatPct(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatCardPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getMemberCode(member: ParticipantMember) {
  return normalizeCode(firstText(member.stockCode, member.stock_code, member.code));
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

function parseHash() {
  const match = window.location.hash.match(/^#\/teams\/(daily|weekly|monthly|quarterly)\/([^/?#]+)$/);
  if (match) return { matchType: match[1] as MatchType, entryId: decodeURIComponent(match[2]) };

  const legacy = window.location.hash.match(/^#\/teams\/([^/?#]+)$/);
  if (legacy) return { matchType: undefined, entryId: decodeURIComponent(legacy[1]) };

  return null;
}

function createHostElement() {
  const page = document.createElement('section');
  page.id = ROOT_ID;
  page.className = 'team-detail-page card';
  page.setAttribute('aria-label', 'チーム詳細');
  return page;
}

function ensureTeamDetailHost() {
  let page = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (!page) page = createHostElement();

  const main = document.querySelector('main.main') || document.querySelector('main') || document.querySelector('.main');
  const header = main?.querySelector('.page-header') || document.querySelector('.page-header');

  if (main) {
    if (page.parentElement !== main) {
      if (header?.parentElement === main && header.nextSibling) main.insertBefore(page, header.nextSibling);
      else if (header?.parentElement === main) main.appendChild(page);
      else main.appendChild(page);
    }
    page.style.display = 'block';
    return page;
  }

  const root = document.getElementById('root') || document.body;
  if (page.parentElement !== root) root.appendChild(page);
  page.style.display = 'block';
  return page;
}

function enterTeamDetailMode() {
  const shell = document.querySelector('.app-shell');
  if (!shell) return;
  OTHER_PAGE_CLASSES.forEach((className) => shell.classList.remove(className));
  shell.classList.add(ACTIVE_CLASS);
}

function renderLoading() {
  enterTeamDetailMode();
  const page = ensureTeamDetailHost();
  page.innerHTML = `
    <div class="team-detail-loading">
      <strong>チーム詳細を読み込んでいます...</strong>
    </div>
  `;
}

function renderError(message: string) {
  enterTeamDetailMode();
  const page = ensureTeamDetailHost();
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

function renderPlayerCard(member: ParticipantMember, matchType: MatchType) {
  const position = getMemberPosition(member);
  const positionClass = position.toLowerCase();
  const code = getMemberCode(member);
  const name = getMemberName(member);
  const periodLabel = RETURN_LABEL_BY_MATCH[matchType] || '期間リターン';

  return `
    <article class="player-card position-${positionClass}">
      <div class="position-pill">${position}</div>
      <strong>${escapeHtml(name)}</strong>
      <small>${escapeHtml(code)}</small>
      <div class="player-period-label">${escapeHtml(periodLabel)}</div>
      <div class="player-change trend-up">取得待ち</div>
      <svg class="sparkline spark-${positionClass} trend-up" viewBox="0 0 112 34" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="22" x2="112" y2="14" />
      </svg>
    </article>
  `;
}

function renderPitchRow(members: ParticipantMember[], position: typeof POSITIONS[number], matchType: MatchType) {
  const rows = members
    .filter((member) => getMemberPosition(member) === position)
    .sort((a, b) => getMemberOrder(a) - getMemberOrder(b));

  return `
    <div class="pitch-row row-${position.toLowerCase()}">
      ${rows.map((member) => renderPlayerCard(member, matchType)).join('')}
    </div>
  `;
}

function renderMemberSection(team: ParticipantItem, matchType: MatchType) {
  const members = Array.isArray(team.members) ? team.members : [];
  if (members.length === 0) {
    return `
      <div class="team-detail-empty-members">
        <strong>銘柄メンバーはまだ表示できません</strong>
        <span>APIの members / entry_members が取得できない場合は、反映後に再読み込みしてください。</span>
      </div>
    `;
  }

  return `
    <div class="pitch-card team-detail-pitch-card">
      <div class="pitch-stage">
        <div class="pitch-markings"></div>
        <div class="pitch-players">
          ${renderPitchRow(members, 'FW', matchType)}
          ${renderPitchRow(members, 'MF', matchType)}
          ${renderPitchRow(members, 'DF', matchType)}
          ${renderPitchRow(members, 'GK', matchType)}
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

function getShareText(team: ParticipantItem, matchType: MatchType) {
  const members = Array.isArray(team.members) ? team.members : [];
  const picks = members
    .sort((a, b) => getMemberOrder(a) - getMemberOrder(b))
    .map(getMemberName)
    .filter(Boolean)
    .slice(0, 3);
  return [
    `日本株代表イレブン2026で「${team.team}」を編成しました⚽📈`,
    '',
    `大会：${getContestLabel(matchType)}`,
    `布陣：${team.formation}`,
    picks.length ? `代表メンバー：${picks.join(' / ')}` : '',
    `暫定順位：${team.rank}位`,
    `暫定リターン：${formatPct(team.returnPct)}`,
    '',
    '#日本株代表イレブン #日本株 #個人開発',
  ].filter((line) => line !== '').join('\n');
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

function updateCardMarket(card: HTMLElement, returnPct: number, candles: PriceCandle[]) {
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

async function syncTeamDetailCardMarketPeriod(matchType: MatchType) {
  const seq = ++marketSyncSeq;
  const page = document.getElementById(ROOT_ID);
  if (!page) return;

  const range = RANGE_BY_MATCH[matchType] || '3mo';
  const mode = RETURN_MODE_BY_MATCH[matchType] || 'period';
  const cards = Array.from(page.querySelectorAll<HTMLElement>('.team-detail-pitch-card .player-card'));
  if (cards.length === 0) return;

  await Promise.all(cards.map(async (card) => {
    const code = getCardCode(card);
    if (!code) return;

    try {
      const candles = await fetchCandles(code, range);
      if (seq !== marketSyncSeq || candles.length < 2) return;
      const returnPct = computePeriodReturn(candles, mode);
      if (returnPct === null || !document.body.contains(card)) return;
      updateCardMarket(card, returnPct, candles);
    } catch (_error) {
      // Keep the existing detail card display when market data is unavailable.
    }
  }));
}

function scheduleTeamDetailMarketSync(matchType: MatchType, delay = 0) {
  window.setTimeout(() => {
    void syncTeamDetailCardMarketPeriod(matchType);
  }, delay);
}

function renderDetail(team: ParticipantItem, matchType: MatchType) {
  enterTeamDetailMode();
  const page = ensureTeamDetailHost();
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
      <div><span>代表メンバー</span><b>${Array.isArray(team.members) && team.members.length ? `${team.members.length}銘柄` : '-'}</b></div>
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
      ${renderMemberSection(team, matchType)}
    </div>
  `;

  scheduleTeamDetailMarketSync(matchType, 80);
  scheduleTeamDetailMarketSync(matchType, 700);
}

async function renderCurrentRoute() {
  const parsed = parseHash();
  if (!parsed) return;

  const requestId = ++requestSeq;
  renderLoading();

  try {
    const searchTypes = parsed.matchType
      ? [parsed.matchType, ...MATCH_TYPES.filter((type) => type !== parsed.matchType)]
      : MATCH_TYPES;

    for (const matchType of searchTypes) {
      const participants = await fetchParticipants(matchType);
      if (requestId !== requestSeq) return;
      const team = participants.find((item) => item.id === parsed.entryId);
      if (team) {
        renderDetail(team, matchType);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    renderError('現在の大会期間に該当するチームが見つかりませんでした。');
  } catch (error) {
    if (requestId !== requestSeq) return;
    renderError(error instanceof Error ? error.message : String(error));
  }
}

function handlePageActions(event: MouseEvent) {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const page = target?.closest<HTMLElement>(`#${ROOT_ID}`);
  if (!target || !page) return;

  if (target.closest('.team-detail-back-button')) {
    event.preventDefault();
    if (window.location.hash.startsWith('#/teams/')) {
      window.history.pushState('', document.title, `${window.location.pathname}${window.location.search}`);
    }
    document.querySelector('.app-shell')?.classList.remove(ACTIVE_CLASS);
    document.getElementById(ROOT_ID)?.remove();
  }
}

export function initTeamDetailHostGuard() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest('.team-detail-open')) return;
    window.setTimeout(() => {
      void renderCurrentRoute();
    }, 0);
  }, true);

  document.addEventListener('click', handlePageActions);

  window.addEventListener('hashchange', () => {
    void renderCurrentRoute();
  });

  window.setTimeout(() => {
    void renderCurrentRoute();
  }, 0);
}
