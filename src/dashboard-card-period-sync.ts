import { getEntryFormMatchType, type MatchType } from './lib/contestContext';

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

let initialized = false;
let requestSeq = 0;
let observer: MutationObserver | null = null;

const RANGE_BY_MATCH: Record<MatchType, { range: string; label: string; usePreviousClose?: boolean }> = {
  daily: { range: '5d', label: '前営業日比', usePreviousClose: true },
  weekly: { range: '1mo', label: '短期推移' },
  monthly: { range: '1mo', label: '1か月' },
  quarterly: { range: '3mo', label: '3か月' },
};

type Candle = {
  t?: number;
  close: number;
};

type HistoryPayload = {
  candles?: Candle[];
};

function getCards() {
  return Array.from(document.querySelectorAll<HTMLElement>('.center-panel .pitch-card .player-card'));
}

function getCardCode(card: HTMLElement) {
  const raw = card.querySelector('small')?.textContent || '';
  return raw.trim().replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '');
}

function formatPct(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '取得待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getReturnPct(candles: Candle[], matchType: MatchType) {
  const closes = candles
    .map((candle) => Number(candle.close))
    .filter((value) => Number.isFinite(value));

  if (closes.length < 2) return null;

  const last = closes[closes.length - 1];
  const base = RANGE_BY_MATCH[matchType].usePreviousClose ? closes[closes.length - 2] : closes[0];
  if (!base) return null;
  return (last / base - 1) * 100;
}

function buildSparklinePoints(candles: Candle[], width = 112, height = 34) {
  const closes = candles
    .map((candle) => Number(candle.close))
    .filter((value) => Number.isFinite(value));
  if (closes.length < 2) return '';

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const xStep = width / Math.max(1, closes.length - 1);

  return closes.map((close, index) => {
    const x = index * xStep;
    const y = height - ((close - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

async function fetchHistory(code: string, matchType: MatchType) {
  const { range } = RANGE_BY_MATCH[matchType];
  const response = await fetch(`${API_BASE}/api/history/${encodeURIComponent(code)}?range=${encodeURIComponent(range)}&interval=1d`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`history ${response.status}`);
  const payload = await response.json() as HistoryPayload;
  return payload.candles || [];
}

function setCardLoading(card: HTMLElement, matchType: MatchType) {
  const change = card.querySelector<HTMLElement>('.player-change');
  if (!change) return;
  change.textContent = '取得中';
  change.classList.remove('trend-up', 'trend-down');
  card.dataset.cardPeriod = matchType;
}

function updateCard(card: HTMLElement, candles: Candle[], matchType: MatchType) {
  const returnPct = getReturnPct(candles, matchType);
  const trendClass = (returnPct ?? 0) >= 0 ? 'trend-up' : 'trend-down';
  const change = card.querySelector<HTMLElement>('.player-change');
  const sparkline = card.querySelector<SVGElement>('.sparkline');
  const points = buildSparklinePoints(candles);

  if (change) {
    change.textContent = formatPct(returnPct);
    change.classList.remove('trend-up', 'trend-down');
    change.classList.add(trendClass);
    change.title = `${RANGE_BY_MATCH[matchType].label}リターン`;
  }

  if (sparkline) {
    sparkline.classList.remove('trend-up', 'trend-down');
    sparkline.classList.add(trendClass);
    sparkline.innerHTML = points ? `<polyline points="${points}" />` : '<line x1="0" y1="22" x2="112" y2="14" />';
  }

  card.dataset.cardPeriod = matchType;
}

async function syncCards() {
  const matchType = getEntryFormMatchType();
  const cards = getCards();
  const requestId = ++requestSeq;

  cards.forEach((card) => setCardLoading(card, matchType));

  await Promise.all(cards.map(async (card) => {
    const code = getCardCode(card);
    if (!code) return;

    try {
      const candles = await fetchHistory(code, matchType);
      if (requestId !== requestSeq) return;
      updateCard(card, candles, matchType);
    } catch (_error) {
      if (requestId !== requestSeq) return;
      updateCard(card, [], matchType);
    }
  }));
}

function scheduleSync(delay = 80) {
  window.setTimeout(() => {
    void syncCards();
  }, delay);
}

export function initDashboardCardPeriodSync() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('nihon-kabu-eleven:contest-changed', () => scheduleSync(120));
  window.addEventListener('focus', () => scheduleSync(120));
  scheduleSync(1200);
  scheduleSync(2600);

  observer = new MutationObserver(() => scheduleSync(120));
  observer.observe(document.body, { childList: true, subtree: true });
}
