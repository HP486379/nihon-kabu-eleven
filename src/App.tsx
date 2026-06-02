import { FormEvent, useEffect, useMemo, useState } from 'react';

type Market = 'プライム' | 'スタンダード' | 'グロース' | '任意追加';
type Position = 'FW' | 'MF' | 'DF' | 'GK';
type FormationKey = '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2' | '3-4-3' | '5-3-2' | '3-4-2-1' | '5-4-1';

type Stock = {
  code: string;
  name: string;
  market: Market;
  change: number;
  contribution: number;
  fit: Record<Position, number>;
  tags: string[];
};

type SelectedStock = Stock & { position?: Position };

type MarketQuote = {
  requestedSymbol?: string;
  symbol?: string;
  shortName?: string | null;
  longName?: string | null;
  displayName?: string | null;
  currency?: string;
  regularMarketPrice?: number | null;
  lastClose?: number | null;
  changePct?: number | null;
  periodReturnPct?: number | null;
  volume?: number | null;
  tsSource?: string | null;
  tsServer?: string;
  source?: string;
  delayed?: boolean;
  points?: number;
  error?: string;
};

type SearchResult = {
  code: string;
  symbol?: string;
  shortName?: string | null;
  longName?: string | null;
  displayName?: string | null;
  exchange?: string | null;
  quoteType?: string | null;
};

type PriceCandle = {
  t: number;
  close: number;
};

type HistoryResponse = {
  candles?: PriceCandle[];
  source?: string;
  error?: string;
};

type Formation = {
  key: FormationKey;
  label: string;
  counts: Record<Position, number>;
  weights: Record<Position, number>;
  description: string;
};

type MiniPitchDot = {
  position: Position;
  left: number;
  top: number;
};

const POSITIONS: Position[] = ['FW', 'MF', 'DF', 'GK'];
const MARKET_API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

const FORMATIONS: Formation[] = [
  { key: '4-3-3', label: '4-3-3', counts: { FW: 3, MF: 3, DF: 4, GK: 1 }, weights: { FW: 0.35, MF: 0.30, DF: 0.25, GK: 0.10 }, description: '成長期待を前線に並べる標準的な攻撃型' },
  { key: '4-2-3-1', label: '4-2-3-1', counts: { FW: 1, MF: 5, DF: 4, GK: 1 }, weights: { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 }, description: '絶対的エースを中盤で支える1トップ＋中盤支配型' },
  { key: '4-4-2', label: '4-4-2', counts: { FW: 2, MF: 4, DF: 4, GK: 1 }, weights: { FW: 0.30, MF: 0.35, DF: 0.25, GK: 0.10 }, description: '中盤を厚くするバランス型' },
  { key: '3-5-2', label: '3-5-2', counts: { FW: 2, MF: 5, DF: 3, GK: 1 }, weights: { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 }, description: '収益力と分散を重視する中盤重視型' },
  { key: '3-4-3', label: '3-4-3', counts: { FW: 3, MF: 4, DF: 3, GK: 1 }, weights: { FW: 0.38, MF: 0.32, DF: 0.20, GK: 0.10 }, description: '攻撃力を残しつつ中盤も厚い超攻撃型' },
  { key: '5-3-2', label: '5-3-2', counts: { FW: 2, MF: 3, DF: 5, GK: 1 }, weights: { FW: 0.22, MF: 0.28, DF: 0.40, GK: 0.10 }, description: '守備と下落耐性を重視する守備重視型' },
  { key: '3-4-2-1', label: '3-4-2-1', counts: { FW: 1, MF: 6, DF: 3, GK: 1 }, weights: { FW: 0.28, MF: 0.42, DF: 0.20, GK: 0.10 }, description: '中盤の厚みでエースを押し上げる攻撃的1トップ型' },
  { key: '5-4-1', label: '5-4-1', counts: { FW: 1, MF: 4, DF: 5, GK: 1 }, weights: { FW: 0.20, MF: 0.30, DF: 0.40, GK: 0.10 }, description: '守備を固めて一撃を狙う堅守カウンター型' },
];

const DEFAULT_FORMATION = FORMATIONS[0];
const DEFAULT_CUSTOM_FIT: Record<Position, number> = { FW: 70, MF: 70, DF: 70, GK: 70 };

const TOURNAMENT = {
  name: '日本株代表カップ',
  duration: '3か月リーグ',
  entryDeadline: '2026/06/10 23:59',
  startDate: '2026/06/11',
  resultDate: '2026/09/11',
  visibility: '限定公開',
  description: '運営が設定した大会日程で開催中',
  judgeRule: 'ポジション加重リターン',
};

const STOCKS: Stock[] = [
  { code: '285A', name: 'キオクシアホールディングス', market: 'プライム', change: 10.1, contribution: 2.63, fit: { FW: 98, MF: 76, DF: 42, GK: 34 }, tags: ['半導体メモリ', 'IPO', '高ボラ'] },
  { code: '9984', name: 'ソフトバンクグループ', market: 'プライム', change: 14.0, contribution: 2.20, fit: { FW: 97, MF: 68, DF: 36, GK: 30 }, tags: ['AI', '投資会社', '攻撃'] },
  { code: '6981', name: '村田製作所', market: 'プライム', change: 8.9, contribution: 1.45, fit: { FW: 82, MF: 89, DF: 70, GK: 66 }, tags: ['電子部品', 'スマホ', '中盤'] },
  { code: '6976', name: '太陽誘電', market: 'プライム', change: 8.4, contribution: 1.32, fit: { FW: 85, MF: 78, DF: 55, GK: 48 }, tags: ['電子部品', '景気敏感', '攻撃'] },
  { code: '5803', name: 'フジクラ', market: 'プライム', change: -2.0, contribution: 1.08, fit: { FW: 91, MF: 76, DF: 54, GK: 48 }, tags: ['電線', 'データセンター', 'テーマ'] },
  { code: '4062', name: 'イビデン', market: 'プライム', change: -5.2, contribution: 0.96, fit: { FW: 88, MF: 74, DF: 50, GK: 44 }, tags: ['半導体基板', 'AIサーバー', '攻撃'] },
  { code: '5801', name: '古河電気工業', market: 'プライム', change: 0.1, contribution: 0.88, fit: { FW: 80, MF: 78, DF: 66, GK: 58 }, tags: ['電線', 'インフラ', 'テーマ'] },
  { code: '6857', name: 'アドバンテスト', market: 'プライム', change: -1.9, contribution: 1.48, fit: { FW: 97, MF: 74, DF: 41, GK: 35 }, tags: ['半導体検査', 'AI', '攻撃'] },
  { code: '8035', name: '東京エレクトロン', market: 'プライム', change: 1.2, contribution: 1.42, fit: { FW: 96, MF: 80, DF: 48, GK: 42 }, tags: ['半導体製造装置', '大型株', '攻撃'] },
  { code: '6762', name: 'TDK', market: 'プライム', change: -0.1, contribution: 0.88, fit: { FW: 78, MF: 88, DF: 72, GK: 68 }, tags: ['電子部品', '電池', 'バランス'] },
  { code: '7203', name: 'トヨタ自動車', market: 'プライム', change: -4.5, contribution: 1.05, fit: { FW: 74, MF: 90, DF: 82, GK: 73 }, tags: ['自動車', '大型株', '主軸'] },
  { code: '7011', name: '三菱重工業', market: 'プライム', change: -4.5, contribution: 1.12, fit: { FW: 82, MF: 84, DF: 78, GK: 66 }, tags: ['防衛', '重工', 'テーマ'] },
  { code: '8306', name: '三菱UFJフィナンシャル・グループ', market: 'プライム', change: 0.8, contribution: 0.96, fit: { FW: 61, MF: 88, DF: 84, GK: 72 }, tags: ['銀行', '金利', '配当'] },
  { code: '5802', name: '住友電気工業', market: 'プライム', change: 4.7, contribution: 0.94, fit: { FW: 70, MF: 83, DF: 78, GK: 68 }, tags: ['電線', '自動車部品', '守備'] },
  { code: '5706', name: '三井金属鉱業', market: 'プライム', change: 4.3, contribution: 0.88, fit: { FW: 76, MF: 78, DF: 70, GK: 62 }, tags: ['非鉄金属', '素材', 'テーマ'] },
  { code: '3436', name: 'SUMCO', market: 'プライム', change: 9.5, contribution: 1.04, fit: { FW: 86, MF: 72, DF: 46, GK: 40 }, tags: ['シリコンウエハ', '半導体', '景気敏感'] },
  { code: '6920', name: 'レーザーテック', market: 'プライム', change: -4.4, contribution: 1.02, fit: { FW: 96, MF: 66, DF: 35, GK: 30 }, tags: ['半導体検査', '高ボラ', '攻撃'] },
  { code: '6098', name: 'リクルートホールディングス', market: 'プライム', change: 3.1, contribution: 0.92, fit: { FW: 83, MF: 87, DF: 67, GK: 60 }, tags: ['人材', 'DX', '中盤'] },
  { code: '6146', name: 'ディスコ', market: 'プライム', change: -2.0, contribution: 1.00, fit: { FW: 94, MF: 78, DF: 46, GK: 42 }, tags: ['半導体装置', '高収益', '攻撃'] },
  { code: '4063', name: '信越化学工業', market: 'プライム', change: 0.5, contribution: 0.86, fit: { FW: 70, MF: 91, DF: 86, GK: 84 }, tags: ['素材', '高収益', '安定'] },
  { code: '9983', name: 'ファーストリテイリング', market: 'プライム', change: -2.2, contribution: 0.82, fit: { FW: 76, MF: 84, DF: 70, GK: 64 }, tags: ['小売', 'グローバル', '大型株'] },
  { code: '6758', name: 'ソニーグループ', market: 'プライム', change: 2.9, contribution: 0.92, fit: { FW: 89, MF: 84, DF: 63, GK: 55 }, tags: ['エンタメ', '半導体', 'ブランド'] },
  { code: '6501', name: '日立製作所', market: 'プライム', change: -0.8, contribution: 0.90, fit: { FW: 78, MF: 88, DF: 82, GK: 72 }, tags: ['インフラ', 'DX', 'バランス'] },
  { code: '8316', name: '三井住友フィナンシャルグループ', market: 'プライム', change: 0.7, contribution: 0.82, fit: { FW: 58, MF: 86, DF: 86, GK: 74 }, tags: ['銀行', '金利', '守備'] },
  { code: '9432', name: 'NTT', market: 'プライム', change: 0.2, contribution: 0.56, fit: { FW: 45, MF: 78, DF: 92, GK: 88 }, tags: ['通信', '安定', '守備'] },
  { code: '9433', name: 'KDDI', market: 'プライム', change: 0.4, contribution: 0.63, fit: { FW: 48, MF: 76, DF: 90, GK: 86 }, tags: ['通信', '配当', '安定'] },
  { code: '7741', name: 'HOYA', market: 'プライム', change: 0.8, contribution: 0.76, fit: { FW: 72, MF: 86, DF: 90, GK: 94 }, tags: ['高収益', '医療', 'GK候補'] },
  { code: '7974', name: '任天堂', market: 'プライム', change: 1.1, contribution: 0.74, fit: { FW: 84, MF: 82, DF: 76, GK: 73 }, tags: ['IP', 'ゲーム', 'ブランド'] },
  { code: '6367', name: 'ダイキン工業', market: 'プライム', change: 0.7, contribution: 0.70, fit: { FW: 64, MF: 79, DF: 88, GK: 76 }, tags: ['空調', '世界展開', '守備'] },
  { code: '2782', name: 'セリア', market: 'スタンダード', change: 0.3, contribution: 0.50, fit: { FW: 50, MF: 68, DF: 80, GK: 72 }, tags: ['小売', '生活防衛', '安定'] },
  { code: '4816', name: '東映アニメーション', market: 'スタンダード', change: 1.5, contribution: 0.64, fit: { FW: 87, MF: 75, DF: 58, GK: 50 }, tags: ['IP', 'アニメ', '成長'] },
  { code: '4478', name: 'フリー', market: 'グロース', change: 1.8, contribution: 0.58, fit: { FW: 89, MF: 67, DF: 35, GK: 30 }, tags: ['SaaS', 'グロース', '攻撃'] },
  { code: '9166', name: 'GENDA', market: 'グロース', change: 2.1, contribution: 0.62, fit: { FW: 92, MF: 65, DF: 32, GK: 26 }, tags: ['エンタメ', 'M&A', '攻撃'] },
];

const SAMPLE_TEAMS = [
  { rank: 1, name: '半導体ジャパン', returnPct: 18.42, status: '暫定首位' },
  { rank: 2, name: 'ツヨシジャパン', returnPct: 15.68, status: '逆転圏内' },
  { rank: 3, name: '高配当ジャパン', returnPct: 9.74, status: '堅守型' },
  { rank: 4, name: 'グロース連合', returnPct: 7.31, status: '追走中' },
  { rank: 5, name: '任天堂FC', returnPct: 5.92, status: '守備固め' },
];

function formatTeamName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 'マイジャパン';
  return trimmed.endsWith('ジャパン') ? trimmed : `${trimmed}ジャパン`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatPct(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '取得待ち';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatWeight(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatPrice(value?: number | null, currency = 'JPY') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value);
}

function normalizeQuoteCode(quote: MarketQuote) {
  const raw = quote.requestedSymbol || quote.symbol || '';
  return raw.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '');
}

function normalizeStockCodeInput(input: string) {
  const raw = input.trim().toUpperCase();
  if (!raw) return '';
  return raw.replace(/\.T$/i, '').replace(/[^0-9A-Z]/g, '');
}

function createCustomStock(code: string, name?: string | null): Stock {
  return {
    code,
    name: name || code,
    market: '任意追加',
    change: 0,
    contribution: 0,
    fit: DEFAULT_CUSTOM_FIT,
    tags: ['実データ取得', 'ユーザー選択'],
  };
}

function createStockFromSearchResult(result: SearchResult): Stock {
  return createCustomStock(result.code, result.displayName || result.longName || result.shortName || result.code);
}

function getStockDisplayName(stock: Stock, quote?: MarketQuote) {
  const name = quote?.displayName || quote?.longName || quote?.shortName || stock.name;
  return name.replace(/\s*\(任意銘柄\)\s*$/g, '');
}

function buildSparklinePoints(candles: PriceCandle[] | undefined, width = 112, height = 34) {
  const closes = (candles || [])
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

function getFormationByKey(key: FormationKey) {
  return FORMATIONS.find((formation) => formation.key === key) || DEFAULT_FORMATION;
}

function assignFormationPositions(stocks: SelectedStock[], formation: Formation): SelectedStock[] {
  const expandedPositions = POSITIONS.flatMap((position) => Array.from({ length: formation.counts[position] }, () => position));
  return stocks.map((stock, index) => ({
    ...stock,
    position: expandedPositions[index] || stock.position || 'MF',
  }));
}

function getNextOpenPosition(stocks: SelectedStock[], formation: Formation) {
  const counts = stocks.reduce<Record<Position, number>>((acc, stock) => {
    if (stock.position) acc[stock.position] += 1;
    return acc;
  }, { FW: 0, MF: 0, DF: 0, GK: 0 });

  return POSITIONS.find((position) => counts[position] < formation.counts[position]) || 'MF';
}

function getPositionMemberWeight(formation: Formation, position: Position) {
  const count = formation.counts[position];
  if (!count) return 0;
  return formation.weights[position] / count;
}

function getMiniPitchDots(formation: Formation): MiniPitchDot[] {
  const tops: Record<Position, number> = { FW: 22, MF: 43, DF: 64, GK: 82 };
  const lanes: Record<number, number[]> = {
    1: [50],
    2: [38, 62],
    3: [30, 50, 70],
    4: [23, 41, 59, 77],
    5: [18, 34, 50, 66, 82],
    6: [14, 28, 42, 58, 72, 86],
  };

  return POSITIONS.flatMap((position) => {
    const count = formation.counts[position];
    const lefts = lanes[count] || lanes[3];
    return lefts.map((left) => ({ position, left, top: tops[position] }));
  });
}

export { FORMATIONS, getFormationByKey, assignFormationPositions, getNextOpenPosition, getMiniPitchDots };

function App() {
  const [teamNameInput, setTeamNameInput] = useState('ツヨシ');
  const [isLocked, setIsLocked] = useState(false);
  const [query, setQuery] = useState('');
  const [customStocks, setCustomStocks] = useState<Stock[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [formationKey, setFormationKey] = useState<FormationKey>(DEFAULT_FORMATION.key);
  const [quoteMap, setQuoteMap] = useState<Record<string, MarketQuote>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, PriceCandle[]>>({});
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedStock[]>(() => assignFormationPositions(STOCKS.slice(0, 11), DEFAULT_FORMATION));

  const teamName = formatTeamName(teamNameInput);
  const currentFormation = useMemo(() => getFormationByKey(formationKey), [formationKey]);
  const formationDots = useMemo(() => getMiniPitchDots(currentFormation), [currentFormation]);
  const allStocks = useMemo(() => [...STOCKS, ...customStocks], [customStocks]);
  const selectedCodesKey = useMemo(() => selected.map((stock) => stock.code).sort().join(','), [selected]);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!selectedCodesKey) {
      setQuoteMap({});
      setQuoteStatus('idle');
      return;
    }

    const controller = new AbortController();
    const loadQuotes = async () => {
      try {
        setQuoteStatus('loading');
        setQuoteError(null);
        const response = await fetch(`${MARKET_API_BASE}/api/quotes?symbols=${encodeURIComponent(selectedCodesKey)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`market proxy ${response.status}`);
        const payload = await response.json() as { results?: MarketQuote[] };
        const nextMap: Record<string, MarketQuote> = {};
        (payload.results || []).forEach((quote) => {
          const code = normalizeQuoteCode(quote);
          if (code) nextMap[code] = quote;
        });
        setQuoteMap(nextMap);
        setQuoteStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setQuoteStatus('error');
        setQuoteError(error instanceof Error ? error.message : String(error));
      }
    };

    loadQuotes();
    return () => controller.abort();
  }, [selectedCodesKey]);

  useEffect(() => {
    if (!selectedCodesKey) {
      setHistoryMap({});
      return;
    }

    const controller = new AbortController();
    const codes = selectedCodesKey.split(',').filter(Boolean);

    const loadHistories = async () => {
      const pairs = await Promise.all(codes.map(async (code): Promise<[string, PriceCandle[]]> => {
        try {
          const response = await fetch(`${MARKET_API_BASE}/api/history/${encodeURIComponent(code)}?range=3mo&interval=1d`, {
            signal: controller.signal,
          });
          if (!response.ok) return [code, []];
          const payload = await response.json() as HistoryResponse;
          return [code, payload.candles || []];
        } catch (_error) {
          if (controller.signal.aborted) return [code, []];
          return [code, []];
        }
      }));
      if (controller.signal.aborted) return;
      setHistoryMap(Object.fromEntries(pairs));
    };

    loadHistories();
    return () => controller.abort();
  }, [selectedCodesKey]);

  useEffect(() => {
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchStatus('idle');
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchStatus('loading');
        setSearchError(null);
        const response = await fetch(`${MARKET_API_BASE}/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`search ${response.status}`);
        const payload = await response.json() as { results?: SearchResult[] };
        setSearchResults(payload.results || []);
        setSearchStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchStatus('error');
        setSearchError(error instanceof Error ? error.message : String(error));
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery]);

  const filteredStocks = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return allStocks;

    const localMatches = allStocks.filter((stock) => stock.name.toLowerCase().includes(q) || stock.code.includes(q));
    const remoteMatches = searchResults.map((result) => {
      const existing = allStocks.find((stock) => stock.code === result.code);
      return existing || createStockFromSearchResult(result);
    });

    const merged: Stock[] = [];
    [...localMatches, ...remoteMatches].forEach((stock) => {
      if (!stock.code || merged.some((item) => item.code === stock.code)) return;
      merged.push(stock);
    });

    const inputCode = normalizeStockCodeInput(trimmedQuery);
    if (inputCode && !merged.some((stock) => stock.code === inputCode)) {
      merged.push(createCustomStock(inputCode));
    }

    return merged;
  }, [allStocks, searchResults, trimmedQuery]);

  const positionCounts = useMemo(() => selected.reduce<Record<Position, number>>((acc, stock) => {
    if (stock.position) acc[stock.position] += 1;
    return acc;
  }, { FW: 0, MF: 0, DF: 0, GK: 0 }), [selected]);

  const marketSummary = useMemo(() => {
    const counts: Record<Market, number> = { プライム: 0, スタンダード: 0, グロース: 0, 任意追加: 0 };
    selected.forEach((stock) => counts[stock.market] += 1);
    return counts;
  }, [selected]);

  const isFormationComplete = selected.length === 11
    && positionCounts.FW === currentFormation.counts.FW
    && positionCounts.MF === currentFormation.counts.MF
    && positionCounts.DF === currentFormation.counts.DF
    && positionCounts.GK === currentFormation.counts.GK;

  const scores = useMemo(() => {
    const average = (position: Position) => {
      const members = selected.filter((stock) => stock.position === position);
      return members.length ? members.reduce((sum, stock) => sum + stock.fit[position], 0) / members.length : 0;
    };
    const attack = average('FW');
    const midfield = average('MF');
    const defense = average('DF');
    const stability = average('GK');
    const balance = selected.length === 11 ? (attack + midfield + defense + stability) / 4 + Math.max(0, 18 - Math.abs(attack - defense) * 0.35) : 0;
    return {
      attack: clampScore(attack),
      midfield: clampScore(midfield),
      defense: clampScore(defense),
      stability: clampScore(stability),
      balance: clampScore(balance),
    };
  }, [selected]);

  const diagnosis = useMemo(() => {
    if (selected.length < 11) return { type: '編成中', text: '11銘柄を選抜すると、チーム診断が表示されます。' };
    if (scores.attack >= 85 && scores.defense < 75) return { type: '超攻撃型チーム', text: '前線に成長期待の高い銘柄を集めた、得点力重視の布陣です。決算跨ぎを攻める短期決戦向きです。' };
    if (scores.defense >= 85 && scores.attack < 75) return { type: '堅守安定型チーム', text: '守備陣と最後尾に安定感のある銘柄を置いた、失点を抑える布陣です。' };
    if (scores.balance >= 82) return { type: '攻撃型バランスチーム', text: '成長期待の高い銘柄を前線に置きつつ、中盤と守備にも安定感を残したバランス型の布陣です。' };
    return { type: '個性派ミックスチーム', text: '市場区分やポジション適性が入り混じった、独自色の強い布陣です。配置を変えると診断も変わります。' };
  }, [scores, selected.length]);

  const marketDataRows = useMemo(() => selected.map((stock) => {
    const position = stock.position || 'MF';
    const quote = quoteMap[stock.code];
    const returnPct = quote?.periodReturnPct;
    const memberWeight = getPositionMemberWeight(currentFormation, position);
    const hasReturn = typeof returnPct === 'number' && Number.isFinite(returnPct);
    return {
      stock,
      quote,
      memberWeight,
      weightedContribution: hasReturn ? returnPct * memberWeight : null,
    };
  }), [currentFormation, quoteMap, selected]);

  const availableReturns = marketDataRows.filter((row) => row.weightedContribution !== null);
  const availableWeight = availableReturns.reduce((sum, row) => sum + row.memberWeight, 0);
  const actualTeamReturn = availableWeight > 0
    ? availableReturns.reduce((sum, row) => sum + (row.weightedContribution || 0), 0) / availableWeight
    : null;
  const latestQuote = marketDataRows
    .map(({ quote }) => quote?.tsSource || quote?.tsServer)
    .filter((value): value is string => Boolean(value))
    .sort()
    .slice(-1)[0];

  const ensureCustomCandidate = (stock: Stock) => {
    if (stock.market !== '任意追加') return;
    setCustomStocks((current) => current.some((item) => item.code === stock.code) ? current : [...current, stock]);
  };

  const handleFormationChange = (nextKey: FormationKey) => {
    if (isLocked) return;
    const nextFormation = getFormationByKey(nextKey);
    setFormationKey(nextKey);
    setSelected((current) => assignFormationPositions(current, nextFormation));
  };

  const toggleStock = (stock: Stock) => {
    if (isLocked) return;
    if (selected.some((item) => item.code === stock.code)) {
      setSelected((current) => current.filter((item) => item.code !== stock.code));
      return;
    }

    ensureCustomCandidate(stock);
    if (selected.length < 11) {
      setSelected((current) => [...current, { ...stock, position: getNextOpenPosition(current, currentFormation) }]);
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLocked || !trimmedQuery) return;

    const firstStock = filteredStocks[0];
    const inputCode = normalizeStockCodeInput(trimmedQuery);
    const stock = firstStock || (inputCode ? createCustomStock(inputCode) : null);
    if (!stock) return;

    ensureCustomCandidate(stock);
    setSelected((current) => {
      if (current.some((item) => item.code === stock.code) || current.length >= 11) return current;
      return [...current, { ...stock, position: getNextOpenPosition(current, currentFormation) }];
    });
  };

  const setPosition = (code: string, position: Position) => {
    if (isLocked) return;
    setSelected((current) => {
      const count = current.filter((stock) => stock.position === position && stock.code !== code).length;
      if (count >= currentFormation.counts[position]) return current;
      return current.map((stock) => stock.code === code ? { ...stock, position } : stock);
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-logo"><span /><i /><b /></div>
          <div className="brand-text">日本株代表<br />イレブン</div>
        </div>
        <nav className="sidebar-nav">
          <a className="active"><span>⌂</span>ダッシュボード</a>
          <a><span>🏆</span>試合モード</a>
          <a><span>⚽</span>フォーメーション</a>
          <a><span>👥</span>参加チーム</a>
          <a><span>📊</span>結果発表</a>
          <a><span>⚙</span>設定</a>
        </nav>
        <div className="help-link">？ ヘルプ</div>
      </aside>

      <main className="main">
        <header className="page-header match-header">
          <div className="header-main">
            <p className="match-kicker">{TOURNAMENT.name}</p>
            <h1>日本株代表イレブン 2026</h1>
            <div className="header-subline">
              <span>🏆 {TOURNAMENT.duration}</span>
              <span>📅 結果発表：{TOURNAMENT.resultDate}</span>
              <span>📈 日次終値ベースで勝負</span>
            </div>
            <div className="team-chip">{teamName}｜{isLocked ? 'チーム確定済み' : '編成中'}｜{TOURNAMENT.visibility}</div>
          </div>
          <div className="header-metrics">
            <div className="metric-card"><span>本日の成績</span><strong>+1.24%</strong></div>
            <div className="metric-card"><span>チームリターン</span><strong>{formatPct(actualTeamReturn)}</strong></div>
            <div className="metric-card"><span>現在の順位</span><strong>🏆 1位 / 3</strong></div>
            <div className="metric-card"><span>最終更新</span><strong>{latestQuote ? new Date(latestQuote).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未取得'}</strong></div>
          </div>
        </header>

        <section className="match-strip card">
          <div>
            <span>試合期間</span>
            <strong>{TOURNAMENT.duration}の終値で決着</strong>
          </div>
          <div>
            <span>判定方式</span>
            <strong>{TOURNAMENT.judgeRule}</strong>
          </div>
          <div>
            <span>締切</span>
            <strong>{TOURNAMENT.resultDate}</strong>
          </div>
          <button className="lock-button" disabled={!isFormationComplete} onClick={() => setIsLocked((locked) => !locked)}>
            {isLocked ? '確定を解除' : 'チームを確定'}
          </button>
        </section>

        <section className="dashboard-grid">
          <div className="left-panel">
            <div className="card side-card">
              <h3>試合サマリー</h3>
              <div className="summary-block">
                <p className="label">試合名</p>
                <p className="record compact-record">{TOURNAMENT.name}</p>
                <p className="subtext">{TOURNAMENT.duration} / {TOURNAMENT.resultDate} 結果発表</p>
              </div>
              <div className="summary-block compact">
                <p className="label">参加チーム</p>
                <p className="record">8チーム</p>
                <p className="subtext">確定済み 5 / 編成中 3</p>
              </div>
              <div className="summary-block compact no-border">
                <p className="label">あなたのチーム</p>
                <p className="loss-rate positive-rank">暫定 2位</p>
                <p className="subtext">首位との差 -2.74%</p>
              </div>
            </div>

            <div className="card side-card formation-card">
              <h3>フォーメーション</h3>
              <div className="formation-number">{currentFormation.label}</div>
              <p className="formation-description">{currentFormation.description}</p>
              <div className="formation-mini-pitch">
                {formationDots.map((dot, index) => (
                  <i
                    key={`${dot.position}-${index}`}
                    className={`formation-mini-dot dot-${dot.position.toLowerCase()}`}
                    style={{ left: `${dot.left}%`, top: `${dot.top}%` }}
                    title={dot.position}
                  />
                ))}
              </div>
              <div className="formation-buttons" aria-label="フォーメーション選択">
                {FORMATIONS.map((formation) => (
                  <button
                    key={formation.key}
                    className={formation.key === currentFormation.key ? 'selected' : ''}
                    disabled={isLocked}
                    onClick={() => handleFormationChange(formation.key)}
                  >
                    {formation.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="center-panel">
            <div className="card pitch-card">
              <div className="pitch-stage">
                <div className="pitch-markings" />
                <div className="pitch-players">
                  <div className="pitch-row row-fw">
                    {selected.filter((stock) => stock.position === 'FW').map((stock) => (
                      <PlayerCard key={stock.code} stock={stock} quote={quoteMap[stock.code]} candles={historyMap[stock.code]} />
                    ))}
                  </div>
                  <div className="pitch-row row-mf">
                    {selected.filter((stock) => stock.position === 'MF').map((stock) => (
                      <PlayerCard key={stock.code} stock={stock} quote={quoteMap[stock.code]} candles={historyMap[stock.code]} />
                    ))}
                  </div>
                  <div className="pitch-row row-df">
                    {selected.filter((stock) => stock.position === 'DF').map((stock) => (
                      <PlayerCard key={stock.code} stock={stock} quote={quoteMap[stock.code]} candles={historyMap[stock.code]} />
                    ))}
                  </div>
                  <div className="pitch-row row-gk">
                    {selected.filter((stock) => stock.position === 'GK').map((stock) => (
                      <PlayerCard key={stock.code} stock={stock} quote={quoteMap[stock.code]} candles={historyMap[stock.code]} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="pitch-legend">
                <span className="fw">FW</span>（フォワード）：{currentFormation.counts.FW}名 / {Math.round(currentFormation.weights.FW * 100)}%
                <span className="mf">MF</span>（ミッドフィールダー）：{currentFormation.counts.MF}名 / {Math.round(currentFormation.weights.MF * 100)}%
                <span className="df">DF</span>（ディフェンダー）：{currentFormation.counts.DF}名 / {Math.round(currentFormation.weights.DF * 100)}%
                <span className="gk">GK</span>（ゴールキーパー）：{currentFormation.counts.GK}名 / {Math.round(currentFormation.weights.GK * 100)}%
              </div>
            </div>
          </div>

          <div className="right-panel">
            <div className="card chart-card match-progress-card">
              <div className="card-title-row">
                <h3>パフォーマンス比較 <small>（リターン）</small></h3>
                <span>ⓘ</span>
              </div>
              <div className="match-timeline">
                <div className="timeline-step active"><b>1</b><span>編成</span></div>
                <div className={`timeline-step ${isLocked ? 'active' : ''}`}><b>2</b><span>確定</span></div>
                <div className="timeline-step"><b>3</b><span>試合</span></div>
                <div className="timeline-step"><b>4</b><span>結果発表</span></div>
              </div>
              <div className="match-rule-box">
                <strong>勝敗ルール</strong>
                <p>開始日の終値と終了日の終値を比較し、フォーメーション別のポジション比重を反映したチームリターンで順位を決定します。</p>
              </div>
              <p className="chart-footnote">※ リターンは2026/5/11を0%として表示</p>
            </div>

            <div className="card ranking-card">
              <div className="card-title-row">
                <h3>参加チームランキング</h3>
                <a>共有 ›</a>
              </div>
              <div className="ranking-table">
                <div className="ranking-header"><span>順位</span><span>チーム</span><span>成績</span></div>
                {SAMPLE_TEAMS.map((team) => (
                  <div className={`ranking-row ${team.name === teamName ? 'my-team-row' : ''}`} key={team.rank}>
                    <span className="rank-badge">{team.rank}</span>
                    <div className="ranking-name"><strong>{team.name}</strong><small>{team.status}</small></div>
                    <b>+{team.returnPct.toFixed(2)}%</b>
                  </div>
                ))}
              </div>
              <p className="ranking-footnote">※ 貢献度はチームリターンに対する寄与度</p>
            </div>
          </div>
        </section>

        <section className="editor-grid">
          <div className="card editor-card tournament-card">
            <h3>開催中の大会</h3>
            <div className="tournament-overview">
              <div><span>大会名</span><strong>{TOURNAMENT.name}</strong></div>
              <div><span>大会期間</span><strong>{TOURNAMENT.duration}</strong></div>
              <div><span>公開設定</span><strong>{TOURNAMENT.visibility}</strong></div>
            </div>
            <p className="helper-text">大会日程は運営側で設定します。参加者は締切までに11銘柄を選抜し、チームを確定してください。</p>
          </div>
          <div className="card editor-card editor-wide">
            <h3>チーム編成</h3>
            <input value={teamNameInput} onChange={(event) => setTeamNameInput(event.target.value)} disabled={isLocked} placeholder="例：ツヨシ" />
            <form className="filter-row custom-stock-row" onSubmit={handleSearchSubmit}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} disabled={isLocked} placeholder="銘柄名・証券コードで検索して追加（例：ヤマハ / 7951）" />
              <button type="submit" disabled={isLocked || !trimmedQuery}>{selected.length >= 11 ? '候補追加' : '検索して追加'}</button>
            </form>
            <p className="helper-text">
              {searchStatus === 'loading' ? '検索中です。' : searchStatus === 'error' ? `検索に失敗しました：${searchError}` : trimmedQuery ? `検索候補：${filteredStocks.length}件` : '銘柄名または証券コードで検索し、下の銘柄リストから選抜してください。'}
            </p>
            <p className="helper-text">選抜メンバー：{selected.length} / 11銘柄　｜　市場構成：プライム {marketSummary.プライム} / スタンダード {marketSummary.スタンダード} / グロース {marketSummary.グロース} / 任意追加 {marketSummary.任意追加}</p>
          </div>
          <div className="card editor-card">
            <h3>チーム診断</h3>
            <div className="diagnosis-name">{diagnosis.type}</div>
            <p className="helper-text strong-text">{diagnosis.text}</p>
            <div className="mini-scores">
              <span>攻撃力 {scores.attack}</span>
              <span>中盤力 {scores.midfield}</span>
              <span>守備力 {scores.defense}</span>
              <span>安定感 {scores.stability}</span>
              <span>バランス {scores.balance}</span>
            </div>
          </div>
        </section>

        <section className="card market-data-card">
          <div className="card-title-row">
            <div>
              <h3>実データ確認 <small>（Yahoo Finance 遅延データ）</small></h3>
              <p className="helper-text">チームリターンは、選抜銘柄の株価ベースリターンにフォーメーション別ポジション比重を掛けた参考値です。配当・手数料・税金は含みません。</p>
            </div>
            <span className={`market-status status-${quoteStatus}`}>{quoteStatus === 'loading' ? '取得中' : quoteStatus === 'success' ? '取得済み' : quoteStatus === 'error' ? '取得エラー' : '未取得'}</span>
          </div>
          {quoteError && <div className="market-error">バックエンド未起動、または取得失敗：{quoteError}</div>}
          <div className="market-summary-row">
            <div><span>取得銘柄</span><strong>{availableReturns.length} / {selected.length}</strong></div>
            <div><span>有効ウェイト</span><strong>{formatWeight(availableWeight)}</strong></div>
            <div><span>チームリターン</span><strong>{formatPct(actualTeamReturn)}</strong></div>
          </div>
          <div className="market-table-wrap">
            <div className="market-table">
              <div className="market-table-header"><span>銘柄</span><span>現在値</span><span>前日比</span><span>個別リターン</span><span>比重</span></div>
              {marketDataRows.map(({ stock, quote, memberWeight }) => (
                <div className="market-table-row" key={stock.code}>
                  <span>
                    <strong>{getStockDisplayName(stock, quote)}</strong>
                    <small>{stock.code} / {stock.position}</small>
                    <button type="button" disabled={isLocked} onClick={() => toggleStock(stock)}>外す</button>
                  </span>
                  <span>{formatPrice(quote?.regularMarketPrice ?? quote?.lastClose, quote?.currency || 'JPY')}</span>
                  <span className={(quote?.changePct ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPct(quote?.changePct)}</span>
                  <span className={(quote?.periodReturnPct ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPct(quote?.periodReturnPct)}</span>
                  <span>{formatWeight(memberWeight)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card stock-list-card">
          <div className="card-title-row">
            <h3>{trimmedQuery ? '検索結果・銘柄リスト' : '日本株代表候補リスト'}</h3>
            <div className="position-status">FW {positionCounts.FW}/{currentFormation.counts.FW}　MF {positionCounts.MF}/{currentFormation.counts.MF}　DF {positionCounts.DF}/{currentFormation.counts.DF}　GK {positionCounts.GK}/{currentFormation.counts.GK}</div>
          </div>
          <div className="stock-grid">
            {filteredStocks.map((stock) => {
              const chosen = selected.find((item) => item.code === stock.code);
              const quote = quoteMap[stock.code];
              return (
                <article className={`stock-item ${chosen ? 'chosen' : ''} ${isLocked ? 'locked' : ''}`} key={stock.code}>
                  <div className="stock-item-head">
                    <button disabled={isLocked} onClick={() => toggleStock(stock)}>{chosen ? '選抜中' : selected.length >= 11 ? (stock.market === '任意追加' ? '候補追加' : '上限') : '選抜'}</button>
                    <div>
                      <strong>{getStockDisplayName(stock, quote)}</strong>
                      <small>{stock.code} / {stock.market}</small>
                    </div>
                  </div>
                  <p>{stock.tags.join('・')}</p>
                  {chosen && (
                    <div className="position-buttons">
                      {POSITIONS.map((position) => {
                        const isSelectedPosition = chosen.position === position;
                        const isFullPosition = positionCounts[position] >= currentFormation.counts[position] && !isSelectedPosition;
                        return (
                          <button
                            key={position}
                            type="button"
                            disabled={isLocked || isFullPosition}
                            aria-pressed={isSelectedPosition}
                            className={isSelectedPosition ? 'selected active-position' : 'position-option'}
                            onClick={() => setPosition(stock.code, position)}
                            title={isFullPosition ? `${position}は上限です` : `${position}に配置`}
                          >
                            {position}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <footer className="page-footer">
          <div>当アプリは情報提供を目的としたものであり、特定の金融商品の売買を推奨するものではありません。</div>
          <div>データ提供：Yahoo Finance 遅延データ / サンプル表示併用</div>
        </footer>
      </main>
    </div>
  );
}

function PlayerCard({ stock, quote, candles }: { stock: SelectedStock; quote?: MarketQuote; candles?: PriceCandle[] }) {
  const position = stock.position ?? 'FW';
  const returnPct = typeof quote?.periodReturnPct === 'number' ? quote.periodReturnPct : stock.change;
  const trendClass = returnPct >= 0 ? 'trend-up' : 'trend-down';
  const points = buildSparklinePoints(candles);

  return (
    <article className={`player-card position-${position.toLowerCase()}`}>
      <div className="position-pill">{position}</div>
      <strong>{getStockDisplayName(stock, quote)}</strong>
      <small>{stock.code}</small>
      <div className={`player-change ${trendClass}`}>{formatPct(returnPct)}</div>
      <svg className={`sparkline spark-${position.toLowerCase()} ${trendClass}`} viewBox="0 0 112 34" preserveAspectRatio="none" aria-hidden="true">
        {points ? <polyline points={points} /> : <line x1="0" y1="22" x2="112" y2="14" />}
      </svg>
    </article>
  );
}

export default App;
