import { useEffect, useMemo, useState } from 'react';

type Market = 'プライム' | 'スタンダード' | 'グロース';
type MarketFilter = '全市場' | Market;
type Position = 'FW' | 'MF' | 'DF' | 'GK';
type FormationKey = '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2' | '3-4-3' | '5-3-2';

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
  { key: '4-3-3', label: '4-3-3', counts: { FW: 3, MF: 3, DF: 4, GK: 1 }, description: '成長期待を前線に並べる標準型' },
  { key: '4-2-3-1', label: '4-2-3-1', counts: { FW: 1, MF: 5, DF: 4, GK: 1 }, description: '絶対的エースを中盤で支える1トップ型' },
  { key: '4-4-2', label: '4-4-2', counts: { FW: 2, MF: 4, DF: 4, GK: 1 }, description: '中盤を厚くするバランス型' },
  { key: '3-5-2', label: '3-5-2', counts: { FW: 2, MF: 5, DF: 3, GK: 1 }, description: '収益力と分散を重視する中盤型' },
  { key: '3-4-3', label: '3-4-3', counts: { FW: 3, MF: 4, DF: 3, GK: 1 }, description: '攻撃力を残しつつ中盤も厚い型' },
  { key: '5-3-2', label: '5-3-2', counts: { FW: 2, MF: 3, DF: 5, GK: 1 }, description: '守備と下落耐性を重視する堅守型' },
];

const DEFAULT_FORMATION = FORMATIONS[0];

const STOCKS: Stock[] = [
  { code: '6758', name: 'ソニーグループ', market: 'プライム', change: 18.7, contribution: 1.74, fit: { FW: 91, MF: 84, DF: 61, GK: 55 }, tags: ['世界ブランド', 'エンタメ', '成長'] },
  { code: '7203', name: 'トヨタ自動車', market: 'プライム', change: 14.6, contribution: 2.18, fit: { FW: 78, MF: 90, DF: 82, GK: 71 }, tags: ['大型株', '輸出', '主軸'] },
  { code: '8035', name: '東京エレクトロン', market: 'プライム', change: 23.1, contribution: 3.21, fit: { FW: 96, MF: 80, DF: 48, GK: 42 }, tags: ['半導体', '攻撃力', 'テーマ'] },
  { code: '4063', name: '信越化学工業', market: 'プライム', change: 11.2, contribution: 1.12, fit: { FW: 70, MF: 91, DF: 86, GK: 84 }, tags: ['素材', '高収益', '安定'] },
  { code: '8306', name: '三菱UFJフィナンシャル・グループ', market: 'プライム', change: 10.3, contribution: 1.03, fit: { FW: 61, MF: 88, DF: 84, GK: 72 }, tags: ['金融', '中盤', '配当'] },
  { code: '6861', name: 'キーエンス', market: 'プライム', change: 19.4, contribution: 1.87, fit: { FW: 88, MF: 94, DF: 72, GK: 80 }, tags: ['高収益', '司令塔', '品質'] },
  { code: '7974', name: '任天堂', market: 'プライム', change: 15.3, contribution: 1.32, fit: { FW: 84, MF: 82, DF: 76, GK: 73 }, tags: ['IP', 'ゲーム', 'ブランド'] },
  { code: '6367', name: 'ダイキン工業', market: 'プライム', change: 8.9, contribution: 0.89, fit: { FW: 64, MF: 79, DF: 88, GK: 76 }, tags: ['空調', '世界展開', '守備'] },
  { code: '6301', name: 'コマツ', market: 'プライム', change: 9.7, contribution: 0.97, fit: { FW: 66, MF: 78, DF: 85, GK: 70 }, tags: ['建機', '景気敏感', '基盤'] },
  { code: '6098', name: 'リクルートホールディングス', market: 'プライム', change: 12.0, contribution: 1.20, fit: { FW: 83, MF: 87, DF: 67, GK: 60 }, tags: ['人材', 'DX', '攻守'] },
  { code: '7741', name: 'HOYA', market: 'プライム', change: 7.6, contribution: 0.76, fit: { FW: 72, MF: 86, DF: 90, GK: 94 }, tags: ['高収益', '医療', '最後の砦'] },
  { code: '9432', name: 'NTT', market: 'プライム', change: 4.2, contribution: 0.56, fit: { FW: 45, MF: 78, DF: 92, GK: 88 }, tags: ['通信', '安定', '守備'] },
  { code: '9433', name: 'KDDI', market: 'プライム', change: 5.3, contribution: 0.63, fit: { FW: 48, MF: 76, DF: 90, GK: 86 }, tags: ['通信', '配当', '安定'] },
  { code: '9984', name: 'ソフトバンクグループ', market: 'プライム', change: 19.9, contribution: 2.02, fit: { FW: 95, MF: 66, DF: 38, GK: 31 }, tags: ['AI', '投資会社', '攻撃'] },
  { code: '6857', name: 'アドバンテスト', market: 'プライム', change: 24.5, contribution: 2.30, fit: { FW: 97, MF: 74, DF: 41, GK: 35 }, tags: ['半導体', '攻撃', 'テーマ'] },
  { code: '2782', name: 'セリア', market: 'スタンダード', change: 3.8, contribution: 0.50, fit: { FW: 50, MF: 68, DF: 80, GK: 72 }, tags: ['小売', '安定', '生活'] },
  { code: '4816', name: '東映アニメーション', market: 'スタンダード', change: 15.4, contribution: 1.25, fit: { FW: 87, MF: 75, DF: 58, GK: 50 }, tags: ['IP', 'アニメ', '成長'] },
  { code: '4478', name: 'フリー', market: 'グロース', change: 17.6, contribution: 1.14, fit: { FW: 89, MF: 67, DF: 35, GK: 30 }, tags: ['SaaS', 'グロース', '攻撃'] },
  { code: '7342', name: 'ウェルスナビ', market: 'グロース', change: 9.8, contribution: 0.75, fit: { FW: 80, MF: 62, DF: 34, GK: 28 }, tags: ['FinTech', 'グロース', '攻撃'] },
  { code: '9166', name: 'GENDA', market: 'グロース', change: 21.3, contribution: 1.41, fit: { FW: 92, MF: 65, DF: 32, GK: 26 }, tags: ['エンタメ', 'M&A', '攻撃'] },
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

function formatPrice(value?: number | null, currency = 'JPY') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value);
}

function normalizeQuoteCode(quote: MarketQuote) {
  const raw = quote.requestedSymbol || quote.symbol || '';
  return raw.replace(/\.T$/i, '').replace(/[^0-9A-Z]/gi, '');
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

function getMiniPitchDots(formation: Formation): MiniPitchDot[] {
  const tops: Record<Position, number> = { FW: 22, MF: 43, DF: 64, GK: 82 };
  const lanes: Record<number, number[]> = {
    1: [50],
    2: [38, 62],
    3: [30, 50, 70],
    4: [23, 41, 59, 77],
    5: [18, 34, 50, 66, 82],
  };

  return POSITIONS.flatMap((position) => {
    const count = formation.counts[position];
    const lefts = lanes[count] || lanes[3];
    return lefts.map((left) => ({ position, left, top: tops[position] }));
  });
}

function App() {
  const [teamNameInput, setTeamNameInput] = useState('ツヨシ');
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('全市場');
  const [query, setQuery] = useState('');
  const [formationKey, setFormationKey] = useState<FormationKey>(DEFAULT_FORMATION.key);
  const [quoteMap, setQuoteMap] = useState<Record<string, MarketQuote>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, PriceCandle[]>>({});
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedStock[]>(() => assignFormationPositions(STOCKS.slice(0, 11), DEFAULT_FORMATION));

  const teamName = formatTeamName(teamNameInput);
  const currentFormation = useMemo(() => getFormationByKey(formationKey), [formationKey]);
  const formationDots = useMemo(() => getMiniPitchDots(currentFormation), [currentFormation]);
  const selectedCodesKey = useMemo(() => selected.map((stock) => stock.code).sort().join(','), [selected]);

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

  const filteredStocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STOCKS.filter((stock) => (marketFilter === '全市場' || stock.market === marketFilter)
      && (!q || stock.name.toLowerCase().includes(q) || stock.code.includes(q)));
  }, [marketFilter, query]);

  const positionCounts = useMemo(() => selected.reduce<Record<Position, number>>((acc, stock) => {
    if (stock.position) acc[stock.position] += 1;
    return acc;
  }, { FW: 0, MF: 0, DF: 0, GK: 0 }), [selected]);

  const marketSummary = useMemo(() => {
    const counts: Record<Market, number> = { プライム: 0, スタンダード: 0, グロース: 0 };
    selected.forEach((stock) => counts[stock.market] += 1);
    return counts;
  }, [selected]);

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
    if (scores.attack >= 85 && scores.defense < 75) return { type: '超攻撃型チーム', text: '前線に成長期待の高い銘柄を集めた、得点力重視の布陣です。' };
    if (scores.defense >= 85 && scores.attack < 75) return { type: '堅守安定型チーム', text: '守備陣と最後尾に安定感のある銘柄を置いた、失点を抑える布陣です。' };
    if (scores.balance >= 82) return { type: '攻撃型バランスチーム', text: '成長期待の高い銘柄を前線に置きつつ、中盤と守備にも安定感を残したバランス型の布陣です。' };
    return { type: '個性派ミックスチーム', text: '市場区分やポジション適性が入り混じった、独自色の強い布陣です。配置を変えると診断も変わります。' };
  }, [scores, selected.length]);

  const ranking = [...selected].sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  const marketDataRows = selected.map((stock) => ({ stock, quote: quoteMap[stock.code] }));
  const availableReturns = marketDataRows
    .map(({ quote }) => quote?.periodReturnPct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const actualTeamReturn = availableReturns.length
    ? availableReturns.reduce((sum, value) => sum + value, 0) / availableReturns.length
    : null;
  const latestQuote = marketDataRows
    .map(({ quote }) => quote?.tsSource || quote?.tsServer)
    .filter((value): value is string => Boolean(value))
    .sort()
    .slice(-1)[0];

  const handleFormationChange = (nextKey: FormationKey) => {
    const nextFormation = getFormationByKey(nextKey);
    setFormationKey(nextKey);
    setSelected((current) => assignFormationPositions(current, nextFormation));
  };

  const toggleStock = (stock: Stock) => {
    if (selected.some((item) => item.code === stock.code)) {
      setSelected((current) => current.filter((item) => item.code !== stock.code));
      return;
    }
    if (selected.length < 11) {
      setSelected((current) => [...current, { ...stock, position: getNextOpenPosition(current, currentFormation) }]);
    }
  };

  const setPosition = (code: string, position: Position) => {
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
          <a><span>⚽</span>フォーメーション</a>
          <a><span>👥</span>選手一覧</a>
          <a><span>📊</span>成績・分析</a>
          <a><span>⚔</span>対戦成績</a>
          <a><span>📰</span>ニュース</a>
          <a><span>⚙</span>設定</a>
        </nav>
        <div className="help-link">？ ヘルプ</div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div className="header-main">
            <h1>日本株代表イレブン 2026</h1>
            <div className="header-subline">
              <span>📅 2026年6月11日開幕</span>
              <span>⚔ TOPIX・日経平均と対戦中</span>
            </div>
            <div className="team-chip">{teamName}</div>
          </div>
          <div className="header-metrics">
            <div className="metric-card"><span>本日の成績</span><strong>+1.24%</strong></div>
            <div className="metric-card"><span>チームリターン</span><strong>{formatPct(actualTeamReturn)}</strong></div>
            <div className="metric-card"><span>現在の順位</span><strong>🏆 1位 / 3</strong></div>
            <div className="metric-card"><span>最終更新</span><strong>{latestQuote ? new Date(latestQuote).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未取得'}</strong></div>
          </div>
        </header>

        <section className="dashboard-grid">
          <div className="left-panel">
            <div className="card side-card">
              <h3>チームサマリー</h3>
              <div className="summary-block">
                <p className="label">チーム時価総額</p>
                <p className="big-number">128,745<span>億円</span></p>
                <p className="sub-positive">前日比 +1,576億円（+1.24%）</p>
              </div>
              <div className="summary-block compact">
                <p className="label">戦績（対TOPIX）</p>
                <p className="record">15勝 2敗 1分</p>
                <p className="subtext">勝率 83.3%</p>
              </div>
              <div className="summary-block compact no-border">
                <p className="label">最大失点率（対TOPIX）</p>
                <p className="loss-rate">-4.32%</p>
                <p className="subtext">（2026/03/11）</p>
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
                <span className="fw">FW</span>（フォワード）：{currentFormation.counts.FW}名
                <span className="mf">MF</span>（ミッドフィールダー）：{currentFormation.counts.MF}名
                <span className="df">DF</span>（ディフェンダー）：{currentFormation.counts.DF}名
                <span className="gk">GK</span>（ゴールキーパー）：{currentFormation.counts.GK}名
              </div>
            </div>
          </div>

          <div className="right-panel">
            <div className="card chart-card">
              <div className="card-title-row">
                <h3>パフォーマンス比較 <small>（リターン）</small></h3>
                <span>ⓘ</span>
              </div>
              <div className="tabs-row">
                <button className="tab active">1ヶ月</button>
                <button className="tab">3ヶ月</button>
                <button className="tab">6ヶ月</button>
                <button className="tab">年初来</button>
                <button className="tab">通算</button>
              </div>
              <div className="chart-box">
                <div className="chart-grid" />
                <div className="chart-line blue" />
                <div className="chart-line red" />
                <div className="chart-line gray" />
                <div className="chart-label blue">日本株代表イレブン<br /><strong>+15.68%</strong></div>
                <div className="chart-label red">TOPIX<br /><strong>+6.21%</strong></div>
                <div className="chart-label gray">日経平均<br /><strong>+5.43%</strong></div>
                <div className="chart-axis">5/11　　5/18　　5/25　　6/1　　6/8　　6/11</div>
              </div>
              <p className="chart-footnote">※ リターンは2026/5/11を0%として表示</p>
            </div>

            <div className="card ranking-card">
              <div className="card-title-row">
                <h3>得点ランキング <small>（貢献度）</small></h3>
                <a>詳細を見る ›</a>
              </div>
              <div className="ranking-table">
                <div className="ranking-header"><span>順位</span><span>銘柄</span><span>貢献度</span></div>
                {ranking.map((stock, index) => (
                  <div className="ranking-row" key={stock.code}>
                    <span className="rank-badge">{index + 1}</span>
                    <div className="ranking-name"><strong>{stock.name}</strong><small>（{stock.code}）</small></div>
                    <b>+{stock.contribution.toFixed(2)}%</b>
                  </div>
                ))}
              </div>
              <p className="ranking-footnote">※ 貢献度はチームリターンに対する寄与度</p>
            </div>
          </div>
        </section>

        <section className="editor-grid">
          <div className="card editor-card">
            <h3>チーム名</h3>
            <input value={teamNameInput} onChange={(event) => setTeamNameInput(event.target.value)} placeholder="例：ツヨシ" />
            <p className="helper-text">入力した名前は「○○ジャパン」として表示されます。</p>
          </div>
          <div className="card editor-card editor-wide">
            <h3>銘柄フィルター</h3>
            <div className="filter-row">
              {(['全市場', 'プライム', 'スタンダード', 'グロース'] as MarketFilter[]).map((market) => (
                <button key={market} className={marketFilter === market ? 'selected' : ''} onClick={() => setMarketFilter(market)}>{market}</button>
              ))}
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="銘柄名・証券コードで検索" />
            <p className="helper-text">選抜メンバー：{selected.length} / 11銘柄　｜　市場構成：プライム {marketSummary.プライム} / スタンダード {marketSummary.スタンダード} / グロース {marketSummary.グロース}</p>
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
              <p className="helper-text">チームリターンは、選抜銘柄の株価ベースリターンを等ウェイト平均した参考値です。配当・手数料・税金は含みません。</p>
            </div>
            <span className={`market-status status-${quoteStatus}`}>{quoteStatus === 'loading' ? '取得中' : quoteStatus === 'success' ? '取得済み' : quoteStatus === 'error' ? '取得エラー' : '未取得'}</span>
          </div>
          {quoteError && <div className="market-error">バックエンド未起動、または取得失敗：{quoteError}</div>}
          <div className="market-summary-row">
            <div><span>取得銘柄</span><strong>{availableReturns.length} / {selected.length}</strong></div>
            <div><span>チームリターン</span><strong>{formatPct(actualTeamReturn)}</strong></div>
            <div><span>API</span><strong>{MARKET_API_BASE}</strong></div>
          </div>
          <div className="market-table-wrap">
            <div className="market-table">
              <div className="market-table-header"><span>銘柄</span><span>現在値</span><span>前日比</span><span>個別リターン</span><span>取得元</span></div>
              {marketDataRows.map(({ stock, quote }) => (
                <div className="market-table-row" key={stock.code}>
                  <span><strong>{stock.name}</strong><small>{stock.code}</small></span>
                  <span>{formatPrice(quote?.regularMarketPrice ?? quote?.lastClose, quote?.currency || 'JPY')}</span>
                  <span className={(quote?.changePct ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPct(quote?.changePct)}</span>
                  <span className={(quote?.periodReturnPct ?? 0) >= 0 ? 'positive' : 'negative'}>{formatPct(quote?.periodReturnPct)}</span>
                  <span>{quote?.source || quote?.error || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card stock-list-card">
          <div className="card-title-row">
            <h3>銘柄リスト</h3>
            <div className="position-status">FW {positionCounts.FW}/{currentFormation.counts.FW}　MF {positionCounts.MF}/{currentFormation.counts.MF}　DF {positionCounts.DF}/{currentFormation.counts.DF}　GK {positionCounts.GK}/{currentFormation.counts.GK}</div>
          </div>
          <div className="stock-grid">
            {filteredStocks.map((stock) => {
              const chosen = selected.find((item) => item.code === stock.code);
              return (
                <article className={`stock-item ${chosen ? 'chosen' : ''}`} key={stock.code}>
                  <div className="stock-item-head">
                    <button onClick={() => toggleStock(stock)}>{chosen ? '選抜中' : selected.length >= 11 ? '上限' : '選抜'}</button>
                    <div>
                      <strong>{stock.name}</strong>
                      <small>{stock.code} / {stock.market}</small>
                    </div>
                  </div>
                  <p>{stock.tags.join('・')}</p>
                  {chosen && (
                    <div className="position-buttons">
                      {POSITIONS.map((position) => (
                        <button key={position} className={chosen.position === position ? 'selected' : ''} onClick={() => setPosition(stock.code, position)}>{position}</button>
                      ))}
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
      <strong>{stock.name}</strong>
      <small>{stock.code}</small>
      <div className={`player-change ${trendClass}`}>{formatPct(returnPct)}</div>
      <svg className={`sparkline spark-${position.toLowerCase()} ${trendClass}`} viewBox="0 0 112 34" preserveAspectRatio="none" aria-hidden="true">
        {points ? <polyline points={points} /> : <line x1="0" y1="22" x2="112" y2="14" />}
      </svg>
    </article>
  );
}

export default App;
