import { useMemo, useState } from 'react';
import './match-mode.css';

type Market = 'プライム' | 'スタンダード' | 'グロース';
type MarketFilter = '全市場' | Market;
type Position = 'FW' | 'MF' | 'DF' | 'GK';
type MatchDurationKey = '1day' | '1week' | '1month' | '3months' | '6months';

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

type MatchDuration = {
  key: MatchDurationKey;
  label: string;
  description: string;
  resultDate: string;
};

const POSITIONS: Position[] = ['FW', 'MF', 'DF', 'GK'];
const POSITION_LIMITS: Record<Position, number> = { FW: 3, MF: 3, DF: 4, GK: 1 };

const MATCH_DURATIONS: MatchDuration[] = [
  { key: '1day', label: '1日決戦', description: '翌営業日の終値で決着', resultDate: '2026/06/12' },
  { key: '1week', label: '1週間カップ', description: '1週間後の終値で決着', resultDate: '2026/06/18' },
  { key: '1month', label: '1か月リーグ', description: '1か月後の終値で決着', resultDate: '2026/07/11' },
  { key: '3months', label: '3か月リーグ', description: '3か月後の終値で決着', resultDate: '2026/09/11' },
  { key: '6months', label: '半年チャレンジ', description: '半年後の終値で決着', resultDate: '2026/12/11' },
];

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

const SAMPLE_TEAMS = [
  { rank: 1, name: '半導体ジャパン', owner: 'sora', returnPct: 18.42, status: '暫定首位' },
  { rank: 2, name: 'ツヨシジャパン', owner: 'you', returnPct: 15.68, status: '逆転圏内' },
  { rank: 3, name: '高配当ジャパン', owner: 'kabu', returnPct: 9.74, status: '堅守型' },
  { rank: 4, name: 'グロース連合', owner: 'growth', returnPct: 7.31, status: '追走中' },
  { rank: 5, name: '任天堂FC', owner: 'game', returnPct: 5.92, status: '守備固め' },
];

function formatTeamName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 'マイジャパン';
  return trimmed.endsWith('ジャパン') ? trimmed : `${trimmed}ジャパン`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function App() {
  const [teamNameInput, setTeamNameInput] = useState('ツヨシ');
  const [matchName, setMatchName] = useState('日本株代表カップ');
  const [durationKey, setDurationKey] = useState<MatchDurationKey>('1week');
  const [isLocked, setIsLocked] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('全市場');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedStock[]>(() => STOCKS.slice(0, 11).map((stock, index) => ({
    ...stock,
    position: index < 3 ? 'FW' : index < 6 ? 'MF' : index < 10 ? 'DF' : 'GK',
  })));

  const teamName = formatTeamName(teamNameInput);
  const matchDuration = MATCH_DURATIONS.find((duration) => duration.key === durationKey) ?? MATCH_DURATIONS[1];

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

  const isFormationComplete = selected.length === 11
    && positionCounts.FW === 3
    && positionCounts.MF === 3
    && positionCounts.DF === 4
    && positionCounts.GK === 1;

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

  const ranking = [...selected].sort((a, b) => b.contribution - a.contribution).slice(0, 5);

  const toggleStock = (stock: Stock) => {
    if (isLocked) return;
    if (selected.some((item) => item.code === stock.code)) {
      setSelected((current) => current.filter((item) => item.code !== stock.code));
      return;
    }
    if (selected.length < 11) setSelected((current) => [...current, { ...stock }]);
  };

  const setPosition = (code: string, position: Position) => {
    if (isLocked) return;
    setSelected((current) => {
      const count = current.filter((stock) => stock.position === position && stock.code !== code).length;
      if (count >= POSITION_LIMITS[position]) return current;
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
            <p className="match-kicker">{matchName}</p>
            <h1>日本株代表イレブン 2026</h1>
            <div className="header-subline">
              <span>🏆 {matchDuration.label}</span>
              <span>📅 結果発表：{matchDuration.resultDate}</span>
              <span>📈 日次終値ベースで勝負</span>
            </div>
            <div className="team-chip">{teamName}｜{isLocked ? 'チーム確定済み' : '編成中'}</div>
          </div>
          <div className="header-metrics">
            <div className="metric-card"><span>参加チーム</span><strong>8</strong></div>
            <div className="metric-card"><span>暫定順位</span><strong>🏆 2位 / 8</strong></div>
            <div className="metric-card"><span>首位との差</span><strong>-2.74%</strong></div>
            <div className="metric-card"><span>ステータス</span><strong>{isLocked ? '試合待機' : '編成中'}</strong></div>
          </div>
        </header>

        <section className="match-strip card">
          <div>
            <span>試合期間</span>
            <strong>{matchDuration.description}</strong>
          </div>
          <div>
            <span>判定方式</span>
            <strong>11銘柄の平均騰落率</strong>
          </div>
          <div>
            <span>締切</span>
            <strong>開始日前日 23:59</strong>
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
                <p className="record compact-record">{matchName}</p>
                <p className="subtext">{matchDuration.label} / {matchDuration.resultDate} 結果発表</p>
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

            <div className="card side-card">
              <h3>フォーメーション</h3>
              <div className="formation-number">4-3-3</div>
              <div className="formation-mini-pitch">
                {Array.from({ length: 11 }).map((_, index) => <i key={index} />)}
              </div>
              <button className="ghost-button">ポジション確認 ⚙</button>
            </div>
          </div>

          <div className="center-panel">
            <div className="card pitch-card">
              <div className="pitch-stage">
                <div className="pitch-markings" />
                <div className="pitch-players">
                  <div className="pitch-row row-fw">
                    {selected.filter((stock) => stock.position === 'FW').map((stock) => <PlayerCard key={stock.code} stock={stock} />)}
                  </div>
                  <div className="pitch-row row-mf">
                    {selected.filter((stock) => stock.position === 'MF').map((stock) => <PlayerCard key={stock.code} stock={stock} />)}
                  </div>
                  <div className="pitch-row row-df">
                    {selected.filter((stock) => stock.position === 'DF').map((stock) => <PlayerCard key={stock.code} stock={stock} />)}
                  </div>
                  <div className="pitch-row row-gk">
                    {selected.filter((stock) => stock.position === 'GK').map((stock) => <PlayerCard key={stock.code} stock={stock} />)}
                  </div>
                </div>
              </div>
              <div className="pitch-legend">
                <span className="fw">FW</span>成長期待
                <span className="mf">MF</span>収益力・バランス
                <span className="df">DF</span>安定性・下落耐性
                <span className="gk">GK</span>最後の砦
              </div>
            </div>
          </div>

          <div className="right-panel">
            <div className="card chart-card match-progress-card">
              <div className="card-title-row">
                <h3>試合進行 <small>（プロトタイプ）</small></h3>
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
                <p>開始日の終値と終了日の終値を比較し、11銘柄の平均騰落率で順位を決定します。</p>
              </div>
              <p className="chart-footnote">※ 現段階では画面プロトタイプです。実データ連携は未実装です。</p>
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
              <p className="ranking-footnote">※ 参加チーム成績はサンプル表示です。</p>
            </div>
          </div>
        </section>

        <section className="editor-grid">
          <div className="card editor-card">
            <h3>試合設定</h3>
            <input value={matchName} onChange={(event) => setMatchName(event.target.value)} disabled={isLocked} placeholder="例：日本株代表カップ" />
            <div className="duration-buttons">
              {MATCH_DURATIONS.map((duration) => (
                <button key={duration.key} className={duration.key === durationKey ? 'selected' : ''} disabled={isLocked} onClick={() => setDurationKey(duration.key)}>{duration.label}</button>
              ))}
            </div>
            <p className="helper-text">試合期間を決めて、終了日の終値で結果発表します。</p>
          </div>
          <div className="card editor-card editor-wide">
            <h3>チーム編成</h3>
            <input value={teamNameInput} onChange={(event) => setTeamNameInput(event.target.value)} disabled={isLocked} placeholder="例：ツヨシ" />
            <div className="filter-row">
              {(['全市場', 'プライム', 'スタンダード', 'グロース'] as MarketFilter[]).map((market) => (
                <button key={market} className={marketFilter === market ? 'selected' : ''} disabled={isLocked} onClick={() => setMarketFilter(market)}>{market}</button>
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

        <section className="card stock-list-card">
          <div className="card-title-row">
            <h3>銘柄リスト</h3>
            <div className="position-status">FW {positionCounts.FW}/3　MF {positionCounts.MF}/3　DF {positionCounts.DF}/4　GK {positionCounts.GK}/1</div>
          </div>
          <div className="stock-grid">
            {filteredStocks.map((stock) => {
              const chosen = selected.find((item) => item.code === stock.code);
              return (
                <article className={`stock-item ${chosen ? 'chosen' : ''} ${isLocked ? 'locked' : ''}`} key={stock.code}>
                  <div className="stock-item-head">
                    <button disabled={isLocked} onClick={() => toggleStock(stock)}>{chosen ? '選抜中' : selected.length >= 11 ? '上限' : '選抜'}</button>
                    <div>
                      <strong>{stock.name}</strong>
                      <small>{stock.code} / {stock.market}</small>
                    </div>
                  </div>
                  <p>{stock.tags.join('・')}</p>
                  {chosen && (
                    <div className="position-buttons">
                      {POSITIONS.map((position) => (
                        <button key={position} disabled={isLocked} className={chosen.position === position ? 'selected' : ''} onClick={() => setPosition(stock.code, position)}>{position}</button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <footer className="page-footer">
          <div>当アプリは金融エンタメを目的とした仮想ポートフォリオ対戦サービスです。特定の金融商品の売買を推奨するものではありません。</div>
          <div>表示データ：サンプル　判定方式：日次終値ベース</div>
        </footer>
      </main>
    </div>
  );
}

function PlayerCard({ stock }: { stock: SelectedStock }) {
  const position = stock.position ?? 'FW';
  return (
    <article className={`player-card position-${position.toLowerCase()}`}>
      <div className="position-pill">{position}</div>
      <strong>{stock.name}</strong>
      <small>{stock.code}</small>
      <div className="player-change">+{stock.change.toFixed(1)}%</div>
      <div className={`sparkline spark-${position.toLowerCase()}`} />
    </article>
  );
}

export default App;
