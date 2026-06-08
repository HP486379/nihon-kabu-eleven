type ContestItem = {
  id: string;
  title: string;
  type: string;
  badge: string;
  status: string;
  entryDeadline: string;
  resultDate: string;
  rule: string;
  description: string;
  recommended: string;
};

const CONTESTS: ContestItem[] = [
  {
    id: 'daily',
    title: '日本株代表カップ デイリーマッチ',
    type: 'デイリーマッチ',
    badge: '即日決戦',
    status: '準備中',
    entryDeadline: '運営設定の締切日時',
    resultDate: '翌営業日の終値で集計',
    rule: '締切日の終値を基準価格、翌営業日の終値を集計価格として、ポジション加重リターンで順位を決定します。',
    description: '今日の布陣がすぐ勝負になる、お祭り枠の超短期大会です。',
    recommended: 'まず試してみたい人・毎日参加したい人向け',
  },
  {
    id: 'weekly',
    title: '日本株代表カップ 1週間マッチ',
    type: '1週間マッチ',
    badge: '短期決戦',
    status: '開催中',
    entryDeadline: '運営設定の締切日時',
    resultDate: '締切1週間後の終値で集計',
    rule: '締切日の終値を基準価格、締切1週間後の終値を集計価格として、ポジション加重リターンで順位を決定します。',
    description: '決算、材料、テーマ株が動きやすいライト参加向けの短期大会です。',
    recommended: '短期で結果を見たい人向け',
  },
  {
    id: 'monthly',
    title: '日本株代表カップ 1か月マッチ',
    type: '1か月マッチ',
    badge: '標準大会',
    status: '準備中',
    entryDeadline: '運営設定の締切日時',
    resultDate: '締切1か月後の終値で集計',
    rule: '締切日の終値を基準価格、締切1か月後の終値を集計価格として、ポジション加重リターンで順位を決定します。',
    description: '短期の勢いと銘柄選定力のバランスが出やすい、メイン大会候補です。',
    recommended: '通常開催の主軸向け',
  },
  {
    id: 'quarterly',
    title: '日本株代表カップ 3か月マッチ',
    type: '3か月マッチ',
    badge: '本格リーグ',
    status: '開催中',
    entryDeadline: '運営設定の締切日時',
    resultDate: '締切3か月後の終値で集計',
    rule: '締切日の終値を基準価格、締切3か月後の終値を集計価格として、ポジション加重リターンで順位を決定します。',
    description: 'テーマ性、業績期待、相場の地合いまで含めて競う本格リーグです。',
    recommended: 'じっくり勝負したい人向け',
  },
];

const ROOT_ID = 'contest-list-page';
const ACTIVE_CLASS = 'contest-list-mode';
const FORMATION_ACTIVE_CLASS = 'formation-page-mode';
const HEADER_ORIGINAL_KEY = 'contestListOriginalHtml';

function createContestListPage() {
  const section = document.createElement('section');
  section.id = ROOT_ID;
  section.className = 'contest-list-page card';
  section.setAttribute('aria-label', '大会一覧');
  section.innerHTML = `
    <div class="contest-list-hero">
      <div>
        <p class="contest-list-kicker">MATCH MODE</p>
        <h2>大会一覧</h2>
        <p>デイリー・1週間・1か月・3か月の大会から、自分のチームに合う勝負を選びます。</p>
      </div>
      <button type="button" class="contest-list-back">ダッシュボードへ戻る</button>
    </div>
    <div class="contest-list-grid">
      ${CONTESTS.map((contest) => `
        <article class="contest-list-card contest-${contest.id}">
          <div class="contest-list-card-head">
            <span>${contest.badge}</span>
            <b>${contest.status}</b>
          </div>
          <h3>${contest.title}</h3>
          <p class="contest-list-type">${contest.type}</p>
          <p>${contest.description}</p>
          <dl>
            <div><dt>締切</dt><dd>${contest.entryDeadline}</dd></div>
            <div><dt>集計</dt><dd>${contest.resultDate}</dd></div>
            <div><dt>おすすめ</dt><dd>${contest.recommended}</dd></div>
          </dl>
          <div class="contest-list-rule">${contest.rule}</div>
        </article>
      `).join('')}
    </div>
    <div class="contest-list-note">
      <strong>共通ルール</strong>
      <span>締切日または集計日が休場日の場合は、直後の取引日の終値を使用します。デイリーマッチは翌営業日の終値で集計します。</span>
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

function applyContestHeader() {
  const header = document.querySelector<HTMLElement>('.page-header');
  if (!header) return;

  const kicker = header.querySelector<HTMLElement>('.match-kicker');
  const title = header.querySelector<HTMLElement>('.header-main h1');
  const subline = header.querySelector<HTMLElement>('.header-subline');
  const chip = header.querySelector<HTMLElement>('.team-chip');

  [kicker, title, subline, chip].forEach(rememberOriginalHtml);

  if (kicker) kicker.textContent = 'MATCH MODE';
  if (title) title.textContent = '試合モード / 大会一覧';
  if (subline) {
    subline.innerHTML = `
      <span>🏆 デイリーマッチ・1週間・1か月・3か月マッチ</span>
      <span>📅 締切後の終値で集計</span>
      <span>📈 ポジション加重リターンで判定</span>
    `;
  }
  if (chip) chip.textContent = '大会一覧｜勝負形式を選択｜金融エンタメゲーム';
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

function setActiveNav(target: 'dashboard' | 'contest') {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  links.forEach((link) => link.classList.remove('active'));
  const keyword = target === 'contest' ? '試合モード' : 'ダッシュボード';
  const nav = links.find((link) => link.textContent?.includes(keyword));
  nav?.classList.add('active');
}

function showContestList() {
  const shell = document.querySelector('.app-shell');
  const main = document.querySelector('main.main');
  if (!shell || !main) return;
  if (!document.getElementById(ROOT_ID)) {
    const header = main.querySelector('.page-header');
    const page = createContestListPage();
    if (header?.nextSibling) {
      main.insertBefore(page, header.nextSibling);
    } else {
      main.appendChild(page);
    }
    page.querySelector('.contest-list-back')?.addEventListener('click', showDashboard);
  }
  shell.classList.remove(FORMATION_ACTIVE_CLASS);
  shell.classList.add(ACTIVE_CLASS);
  applyContestHeader();
  setActiveNav('contest');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
  const shell = document.querySelector('.app-shell');
  shell?.classList.remove(ACTIVE_CLASS);
  shell?.classList.remove(FORMATION_ACTIVE_CLASS);
  restoreDashboardHeader();
  setActiveNav('dashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindContestListNavigation() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  const contestNav = links.find((link) => link.textContent?.includes('試合モード'));
  const dashboardNav = links.find((link) => link.textContent?.includes('ダッシュボード'));
  if (!contestNav || contestNav.dataset.contestListBound === 'true') return false;

  contestNav.dataset.contestListBound = 'true';
  contestNav.href = '#contest-list';
  contestNav.addEventListener('click', (event) => {
    event.preventDefault();
    showContestList();
  });

  if (dashboardNav && dashboardNav.dataset.contestListBound !== 'true') {
    dashboardNav.dataset.contestListBound = 'true';
    dashboardNav.href = '#dashboard';
    dashboardNav.addEventListener('click', (event) => {
      event.preventDefault();
      showDashboard();
    });
  }
  return true;
}

export function initContestListPage() {
  const tryBind = () => bindContestListNavigation();
  if (tryBind()) return;

  const observer = new MutationObserver(() => {
    if (tryBind()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 5000);
}
