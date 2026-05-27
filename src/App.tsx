import { useMemo, useState } from 'react';

type Market = 'プライム' | 'スタンダード' | 'グロース';
type MarketFilter = '全市場' | Market;
type Position = 'FW' | 'MF' | 'DF' | 'GK';

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

const POSITIONS: Position[] = ['FW', 'MF', 'DF', 'GK'];
const POSITION_LIMITS: Record<Position, number> = { FW: 3, MF: 3, DF: 4, GK: 1 };

const STOCKS: Stock[] = [
  { code: '6758', name: 'ソニーグループ', market: 'プライム', change: 18.7, contribution: 2.1, fit: { FW: 91, MF: 84, DF: 61, GK: 55 }, tags: ['世界ブランド', 'エンタメ', '成長'] },
  { code: '7203', name: 'トヨタ自動車', market: 'プライム', change: 14.6, contribution: 1.8, fit: { FW: 78, MF: 90, DF: 82, GK: 71 }, tags: ['大型株', '輸出', '主軸'] },
  { code: '8035', name: '東京エレクトロン', market: 'プライム', change: 23.1, contribution: 3.2, fit: { FW: 96, MF: 80, DF: 48, GK: 42 }, tags: ['半導体', '攻撃力', 'テーマ'] },
  { code: '4063', name: '信越化学工業', market: 'プライム', change: 11.2, contribution: 1.2, fit: { FW: 70, MF: 91, DF: 86, GK: 84 }, tags: ['素材', '高収益', '安定'] },
  { code: '8306', name: '三菱UFJ FG', market: 'プライム', change: 10.3, contribution: 1.1, fit: { FW: 61, MF: 88, DF: 84, GK: 72 }, tags: ['金融', '中盤', '配当'] },
  { code: '6861', name: 'キーエンス', market: 'プライム', change: 19.4, contribution: 1.9, fit: { FW: 88, MF: 94, DF: 72, GK: 80 }, tags: ['高収益', '司令塔', '品質'] },
  { code: '7974', name: '任天堂', market: 'プライム', change: 15.3, contribution: 1.4, fit: { FW: 84, MF: 82, DF: 76, GK: 73 }, tags: ['IP', 'ゲーム', 'ブランド'] },
  { code: '6367', name: 'ダイキン工業', market: 'プライム', change: 8.9, contribution: 0.9, fit: { FW: 64, MF: 79, DF: 88, GK: 76 }, tags: ['空調', '世界展開', '守備'] },
  { code: '6301', name: 'コマツ', market: 'プライム', change: 9.7, contribution: 1.0, fit: { FW: 66, MF: 78, DF: 85, GK: 70 }, tags: ['建機', '景気敏感', '基盤'] },
  { code: '6098', name: 'リクルートHD', market: 'プライム', change: 12.0, contribution: 1.7, fit: { FW: 83, MF: 87, DF: 67, GK: 60 }, tags: ['人材', 'DX', '攻守'] },
  { code: '7741', name: 'HOYA', market: 'プライム', change: 7.6, contribution: 1.3, fit: { FW: 72, MF: 86, DF: 90, GK: 94 }, tags: ['高収益', '医療', '最後の砦'] },
  { code: '9432', name: 'NTT', market: 'プライム', change: 4.2, contribution: 0.6, fit: { FW: 45, MF: 78, DF: 92, GK: 88 }, tags: ['通信', '安定', '守備'] },
  { code: '9433', name: 'KDDI', market: 'プライム', change: 5.3, contribution: 0.7, fit: { FW: 48, MF: 76, DF: 90, GK: 86 }, tags: ['通信', '配当', '安定'] },
  { code: '9984', name: 'ソフトバンクG', market: 'プライム', change: 19.9, contribution: 2.4, fit: { FW: 95, MF: 66, DF: 38, GK: 31 }, tags: ['AI', '投資会社', '攻撃'] },
  { code: '6857', name: 'アドバンテスト', market: 'プライム', change: 24.5, contribution: 2.8, fit: { FW: 97, MF: 74, DF: 41, GK: 35 }, tags: ['半導体', '攻撃', 'テーマ'] },
  { code: '2782', name: 'セリア', market: 'スタンダード', change: 3.8, contribution: 0.5, fit: { FW: 50, MF: 68, DF: 80, GK: 72 }, tags: ['小売', '安定', '生活'] },
  { code: '4816', name: '東映アニメーション', market: 'スタンダード', change: 15.4, contribution: 1.6, fit: { FW: 87, MF: 75, DF: 58, GK: 50 }, tags: ['IP', 'アニメ', '成長'] },
  { code: '4478', name: 'フリー', market: 'グロース', change: 17.6, contribution: 1.6, fit: { FW: 89, MF: 67, DF: 35, GK: 30 }, tags: ['SaaS', 'グロース', '攻撃'] },
  { code: '7342', name: 'ウェルスナビ', market: 'グロース', change: 9.8, contribution: 0.9, fit: { FW: 80, MF: 62, DF: 34, GK: 28 }, tags: ['FinTech', 'グロース', '攻撃'] },
  { code: '9166', name: 'GENDA', market: 'グロース', change: 21.3, contribution: 1.9, fit: { FW: 92, MF: 65, DF: 32, GK: 26 }, tags: ['エンタメ', 'M&A', '攻撃'] },
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
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('全市場');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedStock[]>(() => STOCKS.slice(0, 11).map((stock, index) => ({
    ...stock,
    position: index < 3 ? 'FW' : index < 6 ? 'MF' : index < 10 ? 'DF' : 'GK',
  })));

  const teamName = formatTeamName(teamNameInput);

  const filteredStocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STOCKS.filter((stock) => (marketFilter === '全市場' || stock.market === marketFilter)
      && (!q || stock.name.toLowerCase().includes(q) || stock.code.includes(q)));
  }, [marketFilter, query]);

  const positionCounts = useMemo(() => selected.reduce<Record<Position, number>>((acc, stock) => {
    if (stock.position) acc[stock.position] += 1;
    return acc;
  }, { FW: 0, MF: 0, DF: 0, GK: 0 }), [selected]);

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
    return { attack: clampScore(attack), midfield: clampScore(midfield), defense: clampScore(defense), stability: clampScore(stability), balance: clampScore(balance) };
  }, [selected]);

  const diagnosis = useMemo(() => {
    if (selected.length < 11) return { type: '編成中', text: '11銘柄を選抜すると、チーム診断が表示されます。' };
    if (scores.attack >= 85 && scores.defense < 75) return { type: '超攻撃型チーム', text: '前線に成長期待の高い銘柄を集めた、得点力重視の布陣です。守備よりもリターンを狙う個性的なチームです。' };
    if (scores.defense >= 85 && scores.attack < 75) return { type: '堅守安定型チーム', text: '守備陣と最後尾に安定感のある銘柄を置いた、失点を抑える布陣です。' };
    if (scores.balance >= 82) return { type: '攻撃型バランスチーム', text: '成長期待の高い銘柄を前線に置きつつ、中盤と守備にも安定感を残したバランス型の布陣です。' };
    return { type: '個性派ミックスチーム', text: '市場区分やポジション適性が入り混じった、独自色の強い布陣です。配置を変えると診断も変わります。' };
  }, [scores, selected.length]);

  const marketSummary = useMemo(() => {
    const counts: Record<Market, number> = { プライム: 0, スタンダード: 0, グロース: 0 };
    selected.forEach((stock) => counts[stock.market] += 1);
    return `プライム ${counts.プライム} / スタンダード ${counts.スタンダード} / グロース ${counts.グロース}`;
  }, [selected]);

  const ranking = [...selected].sort((a, b) => b.contribution - a.contribution).slice(0, 5);

  const toggleStock = (stock: Stock) => {
    if (selected.some((item) => item.code === stock.code)) {
      setSelected((current) => current.filter((item) => item.code !== stock.code));
      return;
    }
    if (selected.length < 11) setSelected((current) => [...current, { ...stock }]);
  };

  const setPosition = (code: string, position: Position) => {
    setSelected((current) => {
      const count = current.filter((stock) => stock.position === position && stock.code !== code).length;
      if (count >= POSITION_LIMITS[position]) return current;
      return current.map((stock) => stock.code === code ? { ...stock, position } : stock);
    });
  };

  const positionRows: Position[] = ['FW', 'MF', 'DF', 'GK'];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">⚽</div>
        <h1>日本株代表<br />イレブン</h1>
        <nav>
          <a className="active">ダッシュボード</a>
          <a>フォーメーション</a>
          <a>選手一覧</a>
          <a>対戦成績</a>
        </nav>
      </aside>

      <main className="main">
        <section className="topbar">
          <div>
            <p className="eyebrow">日本株代表イレブン 2026</p>
            <h2>{teamName}</h2>
            <p>2026年6月11日開幕　｜　TOPIX・日経平均と仮想対戦中</p>
          </div>
          <div className="metric-row">
            <div><span>本日の成績</span><strong>+1.24%</strong></div>
            <div><span>通算成績</span><strong>+15.68%</strong></div>
            <div><span>現在の順位</span><strong>🏆 1位 / 3</strong></div>
            <div><span>表示データ</span><strong>サンプル</strong></div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="left-column">
            <div className="card summary-card">
              <h3>チームサマリー</h3>
              <dl>
                <div><dt>チーム名</dt><dd>{teamName}</dd></div>
                <div><dt>選抜銘柄数</dt><dd>{selected.length}銘柄</dd></div>
                <div><dt>市場構成</dt><dd>{marketSummary}</dd></div>
                <div><dt>チームタイプ</dt><dd>{diagnosis.type}</dd></div>
              </dl>
            </div>
            <div className="card formation-card">
              <h3>フォーメーション</h3>
              <strong>4-3-3</strong>
              <div className="mini-pitch"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <p>FW：3名　MF：3名　DF：4名　GK：1名</p>
            </div>
          </div>

          <div className="card pitch-card">
            <div className="section-title">
              <div>
                <h3>あなたの代表イレブン</h3>
                <p>{teamName}｜4-3-3</p>
              </div>
              <span>TOPIX・日経平均と仮想対戦</span>
            </div>
            <div className="pitch">
              {positionRows.map((position) => (
                <div className={`pitch-row row-${position}`} key={position}>
                  {selected.filter((stock) => stock.position === position).map((stock) => (
                    <div className="player-card" key={stock.code}>
                      <span>{stock.position}</span>
                      <strong>{stock.name}</strong>
                      <small>{stock.code}</small>
                      <b>+{stock.change.toFixed(1)}%</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="position-legend"><b>FW</b>フォワード：3名 <b>MF</b>ミッドフィールダー：3名 <b>DF</b>ディフェンダー：4名 <b>GK</b>ゴールキーパー：1名</div>
          </div>

          <div className="right-column">
            <div className="card chart-card">
              <h3>パフォーマンス比較</h3>
              <div className="chart-tabs"><b>1ヶ月</b><span>3ヶ月</span><span>6ヶ月</span><span>年初来</span></div>
              <div className="fake-chart"><i className="line team" /><i className="line topix" /><i className="line nikkei" /></div>
              <p><b>日本株代表イレブン</b> +15.68%</p>
              <p><b>TOPIX</b> +6.21%</p>
              <p><b>日経平均</b> +5.43%</p>
            </div>
            <div className="card ranking-card">
              <h3>得点ランキング</h3>
              {ranking.map((stock, index) => (
                <div className="rank-row" key={stock.code}>
                  <span>{index + 1}</span>
                  <div><strong>{stock.name}</strong><small>{stock.position ?? '未設定'} / {stock.code}</small></div>
                  <b>+{stock.contribution.toFixed(2)}%</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="editor-grid">
          <div className="card control-card">
            <h3>チーム名を決める</h3>
            <input value={teamNameInput} onChange={(event) => setTeamNameInput(event.target.value)} placeholder="例：ツヨシ" />
            <p className="small-note">入力した名前が「○○ジャパン」として表示されます。</p>
          </div>
          <div className="card control-card">
            <h3>選手を選ぶ</h3>
            <div className="filter-row">
              {(['全市場', 'プライム', 'スタンダード', 'グロース'] as MarketFilter[]).map((market) => (
                <button key={market} className={marketFilter === market ? 'selected' : ''} onClick={() => setMarketFilter(market)}>{market}</button>
              ))}
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="銘柄名・証券コードで検索" />
            <p className="small-note">選抜メンバー：{selected.length} / 11銘柄</p>
          </div>
          <div className="card diagnosis-card">
            <h3>チーム診断</h3>
            <h4>{diagnosis.type}</h4>
            <p>{diagnosis.text}</p>
          </div>
        </section>

        <section className="card score-card wide-score">
          {[
            ['攻撃力', scores.attack], ['中盤力', scores.midfield], ['守備力', scores.defense], ['安定感', scores.stability], ['バランス', scores.balance],
          ].map(([label, value]) => <div className="score-row" key={label as string}><span>{label}</span><div><b>{value}</b><i style={{ width: `${value}%` }} /></div></div>)}
        </section>

        <section className="stock-section card">
          <div className="section-title">
            <div>
              <h3>銘柄リスト</h3>
              <p>代表メンバーに入れたい銘柄を選び、ポジションを割り振ってください。</p>
            </div>
            <span>FW {positionCounts.FW}/3　MF {positionCounts.MF}/3　DF {positionCounts.DF}/4　GK {positionCounts.GK}/1</span>
          </div>
          <div className="stock-list">
            {filteredStocks.map((stock) => {
              const chosen = selected.find((item) => item.code === stock.code);
              return (
                <article className={`stock-item ${chosen ? 'chosen' : ''}`} key={stock.code}>
                  <button onClick={() => toggleStock(stock)}>{chosen ? '選抜中' : selected.length >= 11 ? '上限' : '選抜'}</button>
                  <div><strong>{stock.name}</strong><small>{stock.code} / {stock.market}</small><p>{stock.tags.join('・')}</p></div>
                  {chosen && <div className="position-buttons">{POSITIONS.map((position) => <button key={position} className={chosen.position === position ? 'selected' : ''} onClick={() => setPosition(stock.code, position)}>{position}</button>)}</div>}
                </article>
              );
            })}
          </div>
        </section>

        <footer className="disclaimer">本アプリは、日本株11銘柄で構成する仮想ポートフォリオをサッカーチーム風に可視化する金融エンタメサービスです。ユーザーが選択した銘柄やポジションは、投資判断・売買推奨を目的としたものではありません。表示される数値・ランキング・スコアにはサンプルデータおよび演出を含む場合があります。投資判断はご自身の責任で行ってください。</footer>
      </main>
    </div>
  );
}

export default App;
