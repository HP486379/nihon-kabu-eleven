import { getEntryFormMatchType, type MatchType } from './lib/contestContext';

type PriceCandle = {
  t?: number;
  close?: number;
};

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

let initialized = false;
let syncSeq = 0;

function normalizeCode(value: string) {
  return value.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function getDashboardCards() {
  return Array.from(document.querySelectorAll<HTMLElement>('.dashboard-grid .center-panel .pitch-card .player-card'));
}

function getCardCode(card: HTMLElement) {
  const code = card.querySelector('small')?.textContent || '';
  return normalizeCode(code);
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
  const url = `${MARKET_API_BASE}/api/history/${encodeURIComponent(code)}?range=${encodeURIComponent(range)}&interval=1d`;
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

async function syncDashboardCardMarketPeriod() {
  const seq = ++syncSeq;
  const matchType = getEntryFormMatchType();
  const range = RANGE_BY_MATCH[matchType] || '3mo';
  const mode = RETURN_MODE_BY_MATCH[matchType] || 'period';
  const cards = getDashboardCards();
  const cardByCode = new Map<string, HTMLElement>();

  cards.forEach((card) => {
    const code = getCardCode(card);
    if (code) cardByCode.set(code, card);
  });

  const codes = [...cardByCode.keys()];
  if (codes.length === 0) return;

  await Promise.all(codes.map(async (code) => {
    try {
      const candles = await fetchCandles(code, range);
      if (seq !== syncSeq || candles.length < 2) return;
      const returnPct = computePeriodReturn(candles, mode);
      if (returnPct === null) return;
      const card = cardByCode.get(code);
      if (!card || !document.body.contains(card)) return;
      updateCard(card, returnPct, candles);
    } catch (_error) {
      // Keep the current card display when market data is unavailable.
    }
  }));
}

function scheduleSync(delay = 0) {
  window.setTimeout(() => {
    void syncDashboardCardMarketPeriod();
  }, delay);
}

export function initDashboardCardMarketPeriodSync() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('nihon-kabu-eleven:contest-changed', () => {
    scheduleSync(120);
    scheduleSync(900);
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('.match-type-chip') : null;
    if (!target) return;
    scheduleSync(180);
    scheduleSync(1000);
  });

  scheduleSync(1200);
}
