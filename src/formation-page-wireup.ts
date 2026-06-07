type Position = 'FW' | 'MF' | 'DF' | 'GK';

type FormationItem = {
  key: string;
  label: string;
  tactic: string;
  description: string;
  counts: Record<Position, number>;
  weights: Record<Position, number>;
  recommend: string;
};

type FormationDot = {
  position: Position;
  left: number;
  top: number;
};

const FORMATIONS: FormationItem[] = [
  {
    key: '4-3-3',
    label: '4-3-3',
    tactic: '標準攻撃型',
    description: '成長期待を前線に並べつつ、中盤と守備にも一定の厚みを残す基本布陣です。',
    counts: { FW: 3, MF: 3, DF: 4, GK: 1 },
    weights: { FW: 0.35, MF: 0.30, DF: 0.25, GK: 0.10 },
    recommend: '初めての編成、成長株を中心にしたい人向け',
  },
  {
    key: '4-2-3-1',
    label: '4-2-3-1',
    tactic: '中盤支配型',
    description: '1トップを中盤で支える布陣です。収益力やテーマ性のある銘柄をMFに多く置けます。',
    counts: { FW: 1, MF: 5, DF: 4, GK: 1 },
    weights: { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 },
    recommend: '中盤力、収益力、バランスを重視したい人向け',
  },
  {
    key: '4-4-2',
    label: '4-4-2',
    tactic: 'バランス型',
    description: 'FW/MF/DFの役割が分かりやすい王道布陣です。攻守の偏りを抑えやすい構成です。',
    counts: { FW: 2, MF: 4, DF: 4, GK: 1 },
    weights: { FW: 0.30, MF: 0.35, DF: 0.25, GK: 0.10 },
    recommend: '迷ったとき、癖の少ないチームにしたい人向け',
  },
  {
    key: '3-5-2',
    label: '3-5-2',
    tactic: '中盤厚め型',
    description: 'MFを5枚置くことで、収益力やテーマ分散を厚く見せる布陣です。',
    counts: { FW: 2, MF: 5, DF: 3, GK: 1 },
    weights: { FW: 0.25, MF: 0.40, DF: 0.25, GK: 0.10 },
    recommend: '幅広いテーマ株を中盤に並べたい人向け',
  },
  {
    key: '3-4-3',
    label: '3-4-3',
    tactic: '超攻撃型',
    description: 'FW比重が最も高い攻撃的な布陣です。上昇期待の強い銘柄を前線に集めます。',
    counts: { FW: 3, MF: 4, DF: 3, GK: 1 },
    weights: { FW: 0.38, MF: 0.32, DF: 0.20, GK: 0.10 },
    recommend: '短期決戦、テーマ株、値上がり期待を攻めたい人向け',
  },
  {
    key: '5-3-2',
    label: '5-3-2',
    tactic: '守備重視型',
    description: 'DF比重を高め、安定性や下落耐性を重視する布陣です。',
    counts: { FW: 2, MF: 3, DF: 5, GK: 1 },
    weights: { FW: 0.22, MF: 0.28, DF: 0.40, GK: 0.10 },
    recommend: '大型株、低ボラ、安定株を厚くしたい人向け',
  },
  {
    key: '3-4-2-1',
    label: '3-4-2-1',
    tactic: '攻撃的1トップ型',
    description: 'MFを6枚置き、1トップを後方から押し上げる構成です。',
    counts: { FW: 1, MF: 6, DF: 3, GK: 1 },
    weights: { FW: 0.28, MF: 0.42, DF: 0.20, GK: 0.10 },
    recommend: '中盤主導で個性的な銘柄を多く使いたい人向け',
  },
  {
    key: '5-4-1',
    label: '5-4-1',
    tactic: '堅守カウンター型',
    description: 'DFを5枚置き、守備力と財務健全性を強める堅い布陣です。',
    counts: { FW: 1, MF: 4, DF: 5, GK: 1 },
    weights: { FW: 0.20, MF: 0.30, DF: 0.40, GK: 0.10 },
    recommend: '安定重視、守備的に負けにくいチームを作りたい人向け',
  },
];

const ROOT_ID = 'formation-page';
const ACTIVE_CLASS = 'formation-page-mode';
const CONTEST_ACTIVE_CLASS = 'contest-list-mode';
const HEADER_ORIGINAL_KEY = 'contestListOriginalHtml';

function getDots(formation: FormationItem): FormationDot[] {
  const tops: Record<Position, number> = { FW: 22, MF: 43, DF: 64, GK: 82 };
  const lanes: Record<number, number[]> = {
    1: [50],
    2: [38, 62],
    3: [30, 50, 70],
    4: [23, 41, 59, 77],
    5: [18, 34, 50, 66, 82],
    6: [14, 28, 42, 58, 72, 86],
  };

  return (['FW', 'MF', 'DF', 'GK'] as Position[]).flatMap((position) => {
    const lefts = lanes[formation.counts[position]] || lanes[3];
    return lefts.map((left) => ({ position, left, top: tops[position] }));
  });
}

function getCurrentFormationLabel() {
  return document.querySelector<HTMLElement>('.formation-number')?.textContent?.trim() || '4-3-3';
}

function createMiniPitch(formation: FormationItem) {
  return `
    <div class="formation-page-mini-pitch" aria-hidden="true">
      ${getDots(formation).map((dot) => `
        <i class="formation-page-dot dot-${dot.position.toLowerCase()}" style="left:${dot.left}%;top:${dot.top}%"></i>
      `).join('')}
    </div>
  `;
}

function createFormationPage() {
  const current = getCurrentFormationLabel();
  const section = document.createElement('section');
  section.id = ROOT_ID;
  section.className = 'formation-page card';
  section.setAttribute('aria-label', 'フォーメーション一覧');
  section.innerHTML = `
    <div class="formation-page-hero">
      <div>
        <p class="formation-page-kicker">FORMATION</p>
        <h2>フォーメーション一覧</h2>
        <p>布陣ごとの人数構成、ポジション比重、向いている勝ち方を確認できます。</p>
      </div>
      <button type="button" class="formation-page-back">ダッシュボードへ戻る</button>
    </div>
    <div class="formation-page-grid">
      ${FORMATIONS.map((formation) => `
        <article class="formation-page-card ${formation.label === current ? 'current' : ''}">
          <div class="formation-page-card-head">
            <span>${formation.tactic}</span>
            ${formation.label === current ? '<b>現在選択中</b>' : ''}
          </div>
          <h3>${formation.label}</h3>
          ${createMiniPitch(formation)}
          <p>${formation.description}</p>
          <dl>
            <div><dt>人数構成</dt><dd>FW ${formation.counts.FW} / MF ${formation.counts.MF} / DF ${formation.counts.DF} / GK ${formation.counts.GK}</dd></div>
            <div><dt>比重</dt><dd>FW ${Math.round(formation.weights.FW * 100)}% / MF ${Math.round(formation.weights.MF * 100)}% / DF ${Math.round(formation.weights.DF * 100)}% / GK ${Math.round(formation.weights.GK * 100)}%</dd></div>
            <div><dt>おすすめ</dt><dd>${formation.recommend}</dd></div>
          </dl>
        </article>
      `).join('')}
    </div>
    <div class="formation-page-note">
      <strong>使い方</strong>
      <span>実際の布陣変更は、ダッシュボード左側のフォーメーションカードから選択します。</span>
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

function applyFormationHeader() {
  const header = document.querySelector<HTMLElement>('.page-header');
  if (!header) return;

  const kicker = header.querySelector<HTMLElement>('.match-kicker');
  const title = header.querySelector<HTMLElement>('.header-main h1');
  const subline = header.querySelector<HTMLElement>('.header-subline');
  const chip = header.querySelector<HTMLElement>('.team-chip');

  [kicker, title, subline, chip].forEach(rememberOriginalHtml);

  if (kicker) kicker.textContent = 'FORMATION';
  if (title) title.textContent = 'フォーメーション';
  if (subline) {
    subline.innerHTML = `
      <span>⚽ 8種類の布陣</span>
      <span>📊 ポジション比重を確認</span>
      <span>🧭 戦術タイプを比較</span>
    `;
  }
  if (chip) chip.textContent = '布陣一覧｜人数構成｜ポジション比重';
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

function setActiveNav(target: 'dashboard' | 'formation') {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  links.forEach((link) => link.classList.remove('active'));
  const keyword = target === 'formation' ? 'フォーメーション' : 'ダッシュボード';
  const nav = links.find((link) => link.textContent?.includes(keyword));
  nav?.classList.add('active');
}

function showFormationPage() {
  const shell = document.querySelector('.app-shell');
  const main = document.querySelector('main.main');
  if (!shell || !main) return;

  const oldPage = document.getElementById(ROOT_ID);
  oldPage?.remove();

  const header = main.querySelector('.page-header');
  const page = createFormationPage();
  if (header?.nextSibling) {
    main.insertBefore(page, header.nextSibling);
  } else {
    main.appendChild(page);
  }
  page.querySelector('.formation-page-back')?.addEventListener('click', showDashboard);

  shell.classList.remove(CONTEST_ACTIVE_CLASS);
  shell.classList.add(ACTIVE_CLASS);
  applyFormationHeader();
  setActiveNav('formation');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
  const shell = document.querySelector('.app-shell');
  shell?.classList.remove(ACTIVE_CLASS);
  shell?.classList.remove(CONTEST_ACTIVE_CLASS);
  restoreDashboardHeader();
  setActiveNav('dashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindFormationNavigation() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  const formationNav = links.find((link) => link.textContent?.includes('フォーメーション'));
  const dashboardNav = links.find((link) => link.textContent?.includes('ダッシュボード'));
  if (!formationNav || formationNav.dataset.formationPageBound === 'true') return false;

  formationNav.dataset.formationPageBound = 'true';
  formationNav.href = '#formation-page';
  formationNav.addEventListener('click', (event) => {
    event.preventDefault();
    showFormationPage();
  });

  if (dashboardNav && dashboardNav.dataset.formationPageBound !== 'true') {
    dashboardNav.dataset.formationPageBound = 'true';
    dashboardNav.href = '#dashboard';
    dashboardNav.addEventListener('click', (event) => {
      event.preventDefault();
      showDashboard();
    });
  }
  return true;
}

export function initFormationPage() {
  const tryBind = () => bindFormationNavigation();
  if (tryBind()) return;

  const observer = new MutationObserver(() => {
    if (tryBind()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 5000);
}
