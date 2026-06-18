import type { MatchType } from './lib/contestContext';

type PriceCandle = {
  t?: number;
  close?: number;
};

const MARKET_API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');
const ROOT_SELECTOR = '#team-detail-page';
const MATCH_TYPES: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];

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
let scheduledTimer: number | null = null;

function normalizeCode(value: string) {
  return value.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function isMatchType(value: string | undefined): value is MatchType {
  return MATCH_TYPES.includes(value as MatchType);
}

function getDetailMatchType(): MatchType | null {
  const page = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  const pageMatchType = page?.dataset.matchType;
  if (isMatchType(pageMatchType)) return pageMatchType;

  const hashMatch = window.location.hash.match(/^#\/teams\/(daily|weekly|monthly|quarterly)\//);
  const hashMatchType = hashMatch?.[1];
  return isMatchType(hashMatchType) ? hashMatchType : null;
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

function formatPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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
    change.textContent = formatPct(returnPct);
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
    if (!document.querySelector(ROOT_SELECTOR)) return;
    scheduleSync(160);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => {
    scheduleSync(220);
    scheduleSync(900);
  });

  document.addEventListener('click', (event) => {
    const openButton = event.target instanceof HTMLElement ? event.target.closest('.team-detail-open') : null;
    if (!openButton) return;
    scheduleSync(500);
    scheduleSync(1300);
  });

  scheduleSync(1500);
}
