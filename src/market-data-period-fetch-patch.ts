import { getEntryFormMatchType, type MatchType } from './lib/contestContext';

type PriceCandle = {
  t?: number;
  close?: number;
};

type QuotePayload = {
  results?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

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

function normalizeCode(value: string) {
  return value.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

function quoteCode(quote: Record<string, unknown>) {
  return normalizeCode(String(quote.requestedSymbol || quote.symbol || ''));
}

function getActiveMarketPeriod() {
  const matchType = getEntryFormMatchType();
  return {
    matchType,
    range: RANGE_BY_MATCH[matchType] || '3mo',
    returnMode: RETURN_MODE_BY_MATCH[matchType] || 'period',
  };
}

function getRequestUrl(input: RequestInfo | URL) {
  const raw = input instanceof Request ? input.url : String(input);
  try {
    return new URL(raw, window.location.origin);
  } catch (_error) {
    return null;
  }
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

async function fetchHistory(originalFetch: typeof window.fetch, apiOrigin: string, code: string, range: string, signal?: AbortSignal | null) {
  const url = `${apiOrigin}/api/history/${encodeURIComponent(code)}?range=${encodeURIComponent(range)}&interval=1d`;
  const response = await originalFetch(url, { signal: signal || undefined });
  if (!response.ok) return [];
  const payload = await response.json() as { candles?: PriceCandle[] };
  return Array.isArray(payload.candles) ? payload.candles : [];
}

async function patchQuotesResponse(
  originalFetch: typeof window.fetch,
  originalResponse: Response,
  requestUrl: URL,
  init?: RequestInit,
) {
  const payload = await originalResponse.clone().json() as QuotePayload;
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length === 0) return originalResponse;

  const { matchType, range, returnMode } = getActiveMarketPeriod();
  const codes = results.map(quoteCode).filter(Boolean);
  const uniqueCodes = [...new Set(codes)];
  const historyEntries = await Promise.all(uniqueCodes.map(async (code) => {
    try {
      const candles = await fetchHistory(originalFetch, requestUrl.origin, code, range, init?.signal || null);
      return [code, candles] as const;
    } catch (_error) {
      return [code, []] as const;
    }
  }));
  const historyMap = Object.fromEntries(historyEntries);

  const patchedResults = results.map((quote) => {
    const code = quoteCode(quote);
    const candles = historyMap[code] || [];
    const periodReturnPct = computePeriodReturn(candles, returnMode);
    if (periodReturnPct === null) {
      return {
        ...quote,
        periodMatchType: matchType,
        periodRange: range,
        periodReturnMode: returnMode,
      };
    }
    return {
      ...quote,
      periodReturnPct,
      periodMatchType: matchType,
      periodRange: range,
      periodReturnMode: returnMode,
      periodPoints: candles.length,
    };
  });

  const patchedPayload = {
    ...payload,
    results: patchedResults,
    periodMatchType: matchType,
    periodRange: range,
    periodReturnMode: returnMode,
  };
  const headers = new Headers(originalResponse.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(patchedPayload), {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers,
  });
}

function rewriteHistoryUrl(url: URL) {
  const { range } = getActiveMarketPeriod();
  const nextUrl = new URL(url.toString());
  nextUrl.searchParams.set('range', range);
  nextUrl.searchParams.set('interval', nextUrl.searchParams.get('interval') || '1d');
  return nextUrl.toString();
}

function shouldKeepExplicitHistoryRange(url: URL) {
  return url.searchParams.get('periodLocked') === '1';
}

export function initMarketDataPeriodFetchPatch() {
  if (initialized) return;
  initialized = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = getRequestUrl(input);
    if (!url) return originalFetch(input, init);

    if (url.pathname === '/api/quotes') {
      const response = await originalFetch(input, init);
      if (!response.ok) return response;
      try {
        return await patchQuotesResponse(originalFetch, response, url, init);
      } catch (_error) {
        return response;
      }
    }

    if (url.pathname.startsWith('/api/history/')) {
      if (shouldKeepExplicitHistoryRange(url)) return originalFetch(input, init);
      return originalFetch(rewriteHistoryUrl(url), init);
    }

    return originalFetch(input, init);
  };
}
