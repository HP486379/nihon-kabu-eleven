type Position = 'FW' | 'MF' | 'DF' | 'GK';
type AutoMode = 'attack' | 'balance' | 'defense' | 'random';

type ApiStock = {
  code?: string;
  symbol?: string;
  shortName?: string | null;
  longName?: string | null;
  displayName?: string | null;
  name?: string | null;
  market?: string | null;
  sector?: string | null;
  scaleCategory?: string | null;
  source?: string | null;
};

type Quote = {
  requestedSymbol?: string;
  symbol?: string;
  changePct?: number | null;
  periodReturnPct?: number | null;
  volume?: number | null;
  regularMarketPrice?: number | null;
  lastClose?: number | null;
};

type AutoCandidate = {
  code: string;
  name: string;
  market: string;
  sector: string;
  scaleCategory: string;
  source: string;
  change: number;
  volume: number;
  fit: Record<Position, number>;
};

type AutoUniverseResponse = {
  results?: ApiStock[];
  stocks?: ApiStock[];
  items?: ApiStock[];
  universe?: ApiStock[];
};

type QuoteResponse = {
  results?: Quote[];
};

const POSITIONS: Position[] = ['FW', 'MF', 'DF', 'GK'];
const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'https://nihon-kabu-eleven-api.onrender.com').replace(/\/$/, '');
const MAX_API_CANDIDATES = 180;
const QUOTE_CHUNK_SIZE = 30;

const SEARCH_SEEDS = [
  'プライム', 'スタンダード', 'グロース',
  '半導体', '銀行', '通信', '自動車', '電機', '機械', '化学',
  '医薬品', '小売', '情報通信', '建設', '電力', '食品', '商社',
];

let initialized = false;
let running = false;
let cachedUniverse: AutoCandidate[] | null = null;
let cachedUniverseAt = 0;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function modeLabel(mode: AutoMode) {
  if (mode === 'attack') return '攻撃型';
  if (mode === 'defense') return '守備型';
  if (mode === 'random') return 'ランダム';
  return 'バランス型';
}

function normalizeCode(value?: string | null) {
  return String(value || '')
    .toUpperCase()
    .replace(/\.T$/i, '')
    .replace(/[^0-9A-Z]/g, '');
}

function stockName(stock: ApiStock) {
  return String(stock.displayName || stock.longName || stock.shortName || stock.name || stock.code || stock.symbol || '').trim();
}

function extractStocks(payload: AutoUniverseResponse | ApiStock[] | unknown): ApiStock[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as AutoUniverseResponse;
  return data.results || data.stocks || data.items || data.universe || [];
}

function dedupeStocks(stocks: ApiStock[]) {
  const map = new Map<string, ApiStock>();
  stocks.forEach((stock) => {
    const code = normalizeCode(stock.code || stock.symbol);
    if (!code || map.has(code)) return;
    map.set(code, { ...stock, code });
  });
  return Array.from(map.values());
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchUniverseFromKnownEndpoints() {
  const paths = [
    `/api/stocks/universe?limit=${MAX_API_CANDIDATES}`,
    `/api/universe?limit=${MAX_API_CANDIDATES}`,
    `/api/stocks?limit=${MAX_API_CANDIDATES}`,
  ];

  for (const path of paths) {
    try {
      const payload = await fetchJson<AutoUniverseResponse | ApiStock[]>(path);
      const stocks = dedupeStocks(extractStocks(payload));
      if (stocks.length >= 11) return stocks.slice(0, MAX_API_CANDIDATES);
    } catch (_error) {
      // Try next endpoint. Older backend builds do not expose a dedicated universe route.
    }
  }

  return [];
}

async function fetchUniverseFromSearchApi() {
  const groups = await Promise.all(SEARCH_SEEDS.map(async (seed) => {
    try {
      const payload = await fetchJson<AutoUniverseResponse>(`/api/search?q=${encodeURIComponent(seed)}&count=80`);
      return extractStocks(payload);
    } catch (_error) {
      return [];
    }
  }));

  return dedupeStocks(groups.flat()).slice(0, MAX_API_CANDIDATES);
}

async function fetchQuotes(codes: string[]) {
  const result = new Map<string, Quote>();
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += QUOTE_CHUNK_SIZE) chunks.push(codes.slice(i, i + QUOTE_CHUNK_SIZE));

  for (const chunk of chunks) {
    try {
      const payload = await fetchJson<QuoteResponse>(`/api/quotes?symbols=${encodeURIComponent(chunk.join(','))}`);
      (payload.results || []).forEach((quote) => {
        const code = normalizeCode(quote.requestedSymbol || quote.symbol);
        if (code) result.set(code, quote);
      });
    } catch (_error) {
      // Keep candidates usable even when quote fetch partially fails.
    }
    await wait(120);
  }

  return result;
}

function includesAny(text: string, keys: string[]) {
  return keys.some((key) => text.includes(key));
}

function buildFit(stock: ApiStock, quote?: Quote): Record<Position, number> {
  const text = `${stockName(stock)} ${stock.market || ''} ${stock.sector || ''} ${stock.scaleCategory || ''}`;
  const change = typeof quote?.periodReturnPct === 'number'
    ? quote.periodReturnPct
    : typeof quote?.changePct === 'number'
      ? quote.changePct
      : 0;
  const positive = Math.max(0, change);
  const calm = Math.max(0, 8 - Math.abs(change));
  const isPrime = text.includes('プライム') || /Core|Large|TOPIX/i.test(text);
  const isGrowth = text.includes('グロース');
  const isAttack = includesAny(text, ['半導体', '電気機器', '情報通信', '機械', 'サービス', 'ゲーム', 'AI', '電子部品']);
  const isDefense = includesAny(text, ['銀行', '保険', '通信', '電気ガス', '食品', '医薬品', '陸運', '小売', '建設']);
  const isCyclical = includesAny(text, ['自動車', '鉄鋼', '非鉄', '商社', '化学', '機械']);

  return {
    FW: 54 + positive * 1.8 + (isAttack ? 20 : 0) + (isGrowth ? 10 : 0) + (isCyclical ? 6 : 0),
    MF: 60 + positive * 0.8 + calm * 1.2 + (isPrime ? 8 : 0) + (isCyclical ? 7 : 0) + (isAttack ? 4 : 0),
    DF: 58 + calm * 2.0 + (isDefense ? 18 : 0) + (isPrime ? 9 : 0) - (isGrowth ? 8 : 0),
    GK: 54 + calm * 2.4 + (isDefense ? 22 : 0) + (isPrime ? 12 : 0) - (isGrowth ? 12 : 0),
  };
}

function toCandidate(stock: ApiStock, quote?: Quote): AutoCandidate | null {
  const code = normalizeCode(stock.code || stock.symbol);
  const name = stockName(stock);
  if (!code || !name) return null;
  const change = typeof quote?.periodReturnPct === 'number'
    ? quote.periodReturnPct
    : typeof quote?.changePct === 'number'
      ? quote.changePct
      : 0;

  return {
    code,
    name,
    market: String(stock.market || ''),
    sector: String(stock.sector || ''),
    scaleCategory: String(stock.scaleCategory || ''),
    source: String(stock.source || 'api'),
    change,
    volume: typeof quote?.volume === 'number' ? quote.volume : 0,
    fit: buildFit(stock, quote),
  };
}

async function loadApiUniverseCandidates() {
  const cacheFresh = cachedUniverse && Date.now() - cachedUniverseAt < 10 * 60 * 1000;
  if (cacheFresh) return cachedUniverse || [];

  const direct = await fetchUniverseFromKnownEndpoints();
  const searched = direct.length >= 11 ? direct : await fetchUniverseFromSearchApi();
  const stocks = dedupeStocks(searched).slice(0, MAX_API_CANDIDATES);
  if (stocks.length < 11) throw new Error('APIから十分な銘柄候補を取得できませんでした。');

  const quotes = await fetchQuotes(stocks.map((stock) => normalizeCode(stock.code || stock.symbol)).filter(Boolean));
  const candidates = stocks
    .map((stock) => toCandidate(stock, quotes.get(normalizeCode(stock.code || stock.symbol))))
    .filter((candidate): candidate is AutoCandidate => Boolean(candidate));

  cachedUniverse = candidates;
  cachedUniverseAt = Date.now();
  return candidates;
}

function scoreCandidate(candidate: AutoCandidate, position: Position, mode: AutoMode) {
  if (mode === 'random') return Math.random() * 100;

  const fit = candidate.fit[position];
  const averageFit = POSITIONS.reduce((sum, current) => sum + candidate.fit[current], 0) / POSITIONS.length;
  const positiveChange = Math.max(candidate.change, 0);
  const calmBonus = Math.max(0, 8 - Math.abs(candidate.change));
  const liquidityBonus = candidate.volume > 0 ? Math.min(10, Math.log10(candidate.volume + 1)) : 0;

  if (mode === 'attack') {
    return fit + positiveChange * 1.7 + liquidityBonus + (position === 'FW' ? candidate.fit.FW * 0.18 : 0);
  }

  if (mode === 'defense') {
    return fit + calmBonus * 2.0 + liquidityBonus * 0.5 + (position === 'GK' ? candidate.fit.GK * 0.2 : 0);
  }

  return fit * 0.58 + averageFit * 0.36 + calmBonus + liquidityBonus + Math.max(0, positiveChange) * 0.35;
}

function getFormationCounts(): Record<Position, number> {
  const text = document.querySelector<HTMLElement>('.position-status')?.textContent || '';
  const read = (position: Position, fallback: number) => {
    const match = text.match(new RegExp(`${position}\s+\d+/(\d+)`));
    const value = match ? Number(match[1]) : fallback;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  return {
    FW: read('FW', 3),
    MF: read('MF', 3),
    DF: read('DF', 4),
    GK: read('GK', 1),
  };
}

function buildLineup(candidates: AutoCandidate[], mode: AutoMode, counts: Record<Position, number>) {
  const used = new Set<string>();
  const lineup: AutoCandidate[] = [];

  POSITIONS.forEach((position) => {
    const ranked = [...candidates]
      .filter((candidate) => !used.has(candidate.code))
      .sort((a, b) => scoreCandidate(b, position, mode) - scoreCandidate(a, position, mode));

    ranked.slice(0, counts[position]).forEach((candidate) => {
      used.add(candidate.code);
      lineup.push(candidate);
    });
  });

  return lineup.slice(0, 11);
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function setSearchFilter(value: string) {
  const input = document.querySelector<HTMLInputElement>('.custom-stock-row input');
  if (!input) return false;
  setNativeInputValue(input, value);
  await wait(420);
  return true;
}

async function clearSearchFilter() {
  const input = document.querySelector<HTMLInputElement>('.custom-stock-row input');
  if (!input || input.value === '') return;
  setNativeInputValue(input, '');
  await wait(250);
}

async function clearCurrentSelection() {
  for (let index = 0; index < 20; index += 1) {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.market-table-row button, .stock-item.chosen .stock-item-head button'))
      .find((candidate) => !candidate.disabled && /(外す|選抜中)/.test(candidate.textContent || ''));
    if (!button) return;
    button.click();
    await wait(80);
  }
}

function findStockSelectButton(code: string) {
  const normalized = normalizeCode(code);
  const items = Array.from(document.querySelectorAll<HTMLElement>('.stock-item'));
  const item = items.find((candidate) => {
    const small = candidate.querySelector('small')?.textContent || '';
    return normalizeCode(small).startsWith(normalized);
  });
  if (!item) return null;
  return Array.from(item.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => !button.disabled && /(選抜|候補追加)/.test(button.textContent || '')) || null;
}

async function selectCandidate(candidate: AutoCandidate) {
  let button = findStockSelectButton(candidate.code);
  if (!button) {
    await setSearchFilter(candidate.code);
    button = findStockSelectButton(candidate.code);
  }
  if (!button) {
    await setSearchFilter(candidate.name);
    button = findStockSelectButton(candidate.code);
  }
  if (!button) return false;
  button.click();
  await wait(95);
  return true;
}

function setStatus(message: string, type: 'idle' | 'success' | 'warning' | 'error' = 'idle') {
  const status = document.querySelector<HTMLElement>('[data-auto-formation-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.status = type;
}

function isTeamLocked() {
  const lockButton = document.querySelector<HTMLButtonElement>('.lock-button');
  return Boolean(lockButton?.textContent?.includes('確定を解除'));
}

async function applyAutoFormation(mode: AutoMode) {
  if (running) return;
  if (isTeamLocked()) {
    setStatus('確定済みのため自動編成できません。先に確定を解除してください。', 'warning');
    return;
  }

  running = true;
  try {
    setStatus('APIから銘柄ユニバースを取得しています...', 'idle');
    const candidates = await loadApiUniverseCandidates();
    setStatus(`${candidates.length}銘柄から${modeLabel(mode)}で自動編成しています...`, 'idle');
    await clearSearchFilter();
    await clearCurrentSelection();
    await wait(120);

    const counts = getFormationCounts();
    const lineup = buildLineup(candidates, mode, counts);
    const missed: string[] = [];

    for (const candidate of lineup) {
      const selected = await selectCandidate(candidate);
      if (!selected) missed.push(`${candidate.code} ${candidate.name}`);
    }

    await clearSearchFilter();

    if (missed.length > 0) {
      setStatus(`API候補から自動編成しました。一部候補が画面上で選抜できませんでした：${missed.join(', ')}`, 'warning');
      return;
    }

    setStatus(`${modeLabel(mode)}でAPI銘柄ユニバースから11銘柄を自動配置しました。内容を確認してからエントリーしてください。`, 'success');
  } catch (error) {
    setStatus(`自動編成に失敗しました：${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    running = false;
  }
}

function createPanel() {
  const target = document.querySelector<HTMLElement>('.editor-wide');
  if (!target || target.querySelector('.auto-formation-panel')) return;

  const panel = document.createElement('div');
  panel.className = 'auto-formation-panel';
  panel.innerHTML = `
    <div class="auto-formation-head">
      <div>
        <strong>条件で自動編成</strong>
        <span>APIから取得できる銘柄ユニバースを使い、ゲーム用に11銘柄を自動配置します。売買推奨ではありません。</span>
      </div>
    </div>
    <div class="auto-formation-buttons">
      <button type="button" data-auto-mode="attack">攻撃型</button>
      <button type="button" data-auto-mode="balance">バランス型</button>
      <button type="button" data-auto-mode="defense">守備型</button>
      <button type="button" data-auto-mode="random">ランダム</button>
    </div>
    <p class="auto-formation-status" data-auto-formation-status data-status="idle">API銘柄ユニバースからフォーメーションに合わせて自動配置できます。</p>
  `;

  const form = target.querySelector('.custom-stock-row');
  if (form?.nextSibling) target.insertBefore(panel, form.nextSibling);
  else target.appendChild(panel);
}

function bindActions() {
  document.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest<HTMLButtonElement>('[data-auto-mode]')
      : null;
    if (!button) return;
    event.preventDefault();
    void applyAutoFormation(button.dataset.autoMode as AutoMode);
  });
}

export function initAutoFormationWireup() {
  if (initialized) return;
  initialized = true;

  bindActions();
  const observer = new MutationObserver(createPanel);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(createPanel, 600);
  window.setTimeout(createPanel, 1800);
}
