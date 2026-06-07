type ResultItem = {
  rank: number;
  team: string;
  owner: string;
  formation: string;
  matchType: string;
  resultPct: number;
  status: string;
  highlight: string;
};

const RESULTS: ResultItem[] = [
  { rank: 1, team: '半導体ジャパン', owner: '暫定優勝', formation: '3-4-3', matchType: '3か月マッチ', resultPct: 18.42, status: '結果確定', highlight: 'FWの半導体勢が大きく貢献' },
  { rank: 2, team: 'ツヨシジャパン', owner: '準優勝', formation: '4-3-3', matchType: '3か月マッチ', resultPct: 15.68, status: '結果確定', highlight: '攻守バランスよく上位追走' },
  { rank: 3, team: '高配当ジャパン', owner: '3位', formation: '5-4-1', matchType: '3か月マッチ', resultPct: 9.74, status: '結果確定', highlight: '守備型ながら堅実にプラス' },
  { rank: 4, team: 'グロース連合', owner: '入賞圏外', formation: '4-2-3-1', matchType: '1か月マッチ', resultPct: 7.92, status: '集計中', highlight: '中盤銘柄の底上げが目立つ' },
  { rank: 5, team: '任天堂FC', owner: '入賞圏外', formation: '4-4-2', matchType: '1か月マッチ', resultPct: 5.31, status: '集計中', highlight: '安定型で大崩れせず' },
  { rank: 6, team: '素材代表', owner: '入賞圏外', formation: '3-5-2', matchType: '1週間マッチ', resultPct: 4.88, status: '集計中', highlight: '短期テーマ株が貢献' },
  { rank: 7, team: '財務堅守イレブン', owner: '入賞圏外', formation: '5-3-2', matchType: '3か月マッチ', resultPct: 2.44, status: '集計中', highlight: '守備重視で小幅プラス' },
  { rank: 8, team: '成長株ユナイテッド', owner: '入賞圏外', formation: '3-4-2-1', matchType: '1週間マッチ', resultPct: -1.26, status: '集計中', highlight: '攻撃型が短期変動に苦戦' },
];

const ROOT_ID = 'results-page';
const ACTIVE_CLASS = 'results-page-mode';
const CONTEST_ACTIVE_CLASS = 'contest-list-mode';
const FORMATION_ACTIVE_CLASS = 'formation-page-mode';
const PARTICIPANTS_ACTIVE_CLASS = 'participants-page-mode';
const HEADER_ORIGINAL_KEY = 'contestListOriginalHtml';

function formatPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function createResultsPage() {
  const champion = RESULTS[0];
  const average = RESULTS.reduce((sum, item) => sum + item.resultPct, 0) / RESULTS.length;
  const positiveCount = RESULTS.filter((item) => item.resultPct >= 0).length;
  const section = document.createElement('section');
  section.id = ROOT_ID;
  section.className = 'results-page card';
  section.setAttribute('aria-label', '結果発表');
  section.innerHTML = `
    <div class="results-page-hero">
      <div>
        <p class="results-page-kicker">RESULTS</p>
        <h2>結果発表</h2>
        <p>大会終了後の順位、優勝チーム、ポジション加重リターンを確認できます。</p>
      </div>
      <button type="button" class="results-page-back">ダッシュボードへ戻る</button>
    </div>

    <div class="results-champion-card">
      <div class="results-cup">🏆</div>
      <div>
        <span>WINNER</span>
        <h3>${champion.team}</h3>
        <p>${champion.matchType} / ${champion.formation} / ${champion.highlight}</p>
      </div>
      <strong>${formatPct(champion.resultPct)}</strong>
    </div>

    <div class="results-summary-grid">
      <div><span>参加チーム</span><b>${RESULTS.length}チーム</b></div>
      <div><span>優勝リターン</span><b>${formatPct(champion.resultPct)}</b></div>
      <div><span>平均リターン</span><b>${formatPct(average)}</b></div>
      <div><span>プラス着地</span><b>${positiveCount}チーム</b></div>
    </div>

    <div class="results-toolbar">
      <span>3か月マッチ</span>
      <span>1か月マッチ</span>
      <span>1週間マッチ</span>
      <strong>表示は暫定結果データです</strong>
    </div>

    <div class="results-podium">
      ${RESULTS.slice(0, 3).map((team) => `
        <article class="results-podium-card rank-${team.rank}">
          <div class="results-medal">${team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : '🥉'}</div>
          <h3>${team.team}</h3>
          <p>${team.owner} / ${team.formation}</p>
          <strong class="${team.resultPct >= 0 ? 'positive' : 'negative'}">${formatPct(team.resultPct)}</strong>
        </article>
      `).join('')}
    </div>

    <div class="results-table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>順位</th>
            <th>チーム</th>
            <th>布陣</th>
            <th>大会</th>
            <th>状態</th>
            <th>成績</th>
            <th>寸評</th>
          </tr>
        </thead>
        <tbody>
          ${RESULTS.map((team) => `
            <tr>
              <td><span class="results-rank rank-${team.rank <= 3 ? team.rank : 'other'}">${team.rank}</span></td>
              <td>
                <strong>${team.team}</strong>
                <small>${team.owner}</small>
              </td>
              <td><b>${team.formation}</b></td>
              <td>${team.matchType}</td>
              <td><span class="results-status ${team.status === '結果確定' ? 'fixed' : 'pending'}">${team.status}</span></td>
              <td class="results-return ${team.resultPct >= 0 ? 'positive' : 'negative'}">${formatPct(team.resultPct)}</td>
              <td>${team.highlight}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="results-note">
      <strong>集計ルール</strong>
      <span>締切日の終値を基準価格とし、各大会の集計日の終値との差をポジション加重リターンで判定します。</span>
    </div>
  `;
  return section;
}

function rememberOriginalHtml(element: HTMLElement | null) {
  if (!element) return;
  if (!element.dataset[HEADER_ORIGINAL_KEY]) {
    element.dataset[HEADER_ORIGINAL_KEY] = element.innerHTML;
  }
}

function applyResultsHeader() {
  const header = document.querySelector<HTMLElement>('.page-header');
  if (!header) return;

  const kicker = header.querySelector<HTMLElement>('.match-kicker');
  const title = header.querySelector<HTMLElement>('.header-main h1');
  const subline = header.querySelector<HTMLElement>('.header-subline');
  const chip = header.querySelector<HTMLElement>('.team-chip');

  [kicker, title, subline, chip].forEach(rememberOriginalHtml);

  if (kicker) kicker.textContent = 'RESULTS';
  if (title) title.textContent = '結果発表';
  if (subline) {
    subline.innerHTML = `
      <span>🏆 優勝チームを表示</span>
      <span>📊 最終順位を確認</span>
      <span>📈 ポジション加重リターンで集計</span>
    `;
  }
  if (chip) chip.textContent = '結果発表｜最終順位｜大会成績';
}

function restoreDashboardHeader() {
  const elements = document.querySelectorAll<HTMLElement>(`[data-${HEADER_ORIGINAL_KEY.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`);
  elements.forEach((element) => {
    const originalHtml = element.dataset[HEADER_ORIGINAL_KEY];
    if (originalHtml !== undefined) {
      element.innerHTML = originalHtml;
      delete element.dataset[HEADER_ORIGINAL_KEY];
    }
  });
}

function setActiveNav(target: 'dashboard' | 'results') {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  links.forEach((link) => link.classList.remove('active'));
  const keyword = target === 'results' ? '結果発表' : 'ダッシュボード';
  const nav = links.find((link) => link.textContent?.includes(keyword));
  nav?.classList.add('active');
}

function showResultsPage() {
  const shell = document.querySelector('.app-shell');
  const main = document.querySelector('main.main');
  if (!shell || !main) return;

  document.getElementById(ROOT_ID)?.remove();

  const header = main.querySelector('.page-header');
  const page = createResultsPage();
  if (header?.nextSibling) {
    main.insertBefore(page, header.nextSibling);
  } else {
    main.appendChild(page);
  }
  page.querySelector('.results-page-back')?.addEventListener('click', showDashboard);

  shell.classList.remove(CONTEST_ACTIVE_CLASS);
  shell.classList.remove(FORMATION_ACTIVE_CLASS);
  shell.classList.remove(PARTICIPANTS_ACTIVE_CLASS);
  shell.classList.add(ACTIVE_CLASS);
  applyResultsHeader();
  setActiveNav('results');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
  const shell = document.querySelector('.app-shell');
  shell?.classList.remove(ACTIVE_CLASS);
  shell?.classList.remove(CONTEST_ACTIVE_CLASS);
  shell?.classList.remove(FORMATION_ACTIVE_CLASS);
  shell?.classList.remove(PARTICIPANTS_ACTIVE_CLASS);
  restoreDashboardHeader();
  setActiveNav('dashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindResultsNavigation() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  const resultsNav = links.find((link) => link.textContent?.includes('結果発表'));
  const dashboardNav = links.find((link) => link.textContent?.includes('ダッシュボード'));
  const otherNavs = links.filter((link) => ['試合モード', 'フォーメーション', '参加チーム'].some((label) => link.textContent?.includes(label)));
  if (!resultsNav || resultsNav.dataset.resultsPageBound === 'true') return false;

  resultsNav.dataset.resultsPageBound = 'true';
  resultsNav.href = '#results-page';
  resultsNav.addEventListener('click', (event) => {
    event.preventDefault();
    showResultsPage();
  });

  if (dashboardNav && dashboardNav.dataset.resultsPageBound !== 'true') {
    dashboardNav.dataset.resultsPageBound = 'true';
    dashboardNav.href = '#dashboard';
    dashboardNav.addEventListener('click', (event) => {
      event.preventDefault();
      showDashboard();
    });
  }

  otherNavs.forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelector('.app-shell')?.classList.remove(ACTIVE_CLASS);
    }, { capture: true });
  });

  return true;
}

export function initResultsPage() {
  const tryBind = () => bindResultsNavigation();
  if (tryBind()) return;

  const observer = new MutationObserver(() => {
    if (tryBind()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 5000);
}
