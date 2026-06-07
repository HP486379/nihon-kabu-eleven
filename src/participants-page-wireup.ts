type ParticipantItem = {
  rank: number;
  team: string;
  owner: string;
  formation: string;
  matchType: string;
  returnPct: number;
  status: string;
  style: string;
};

const PARTICIPANTS: ParticipantItem[] = [
  { rank: 1, team: '半導体ジャパン', owner: '暫定首位', formation: '3-4-3', matchType: '3か月マッチ', returnPct: 18.42, status: '確定済み', style: '攻撃型' },
  { rank: 2, team: 'ツヨシジャパン', owner: '逆転圏内', formation: '4-3-3', matchType: '3か月マッチ', returnPct: 15.68, status: '確定済み', style: '標準攻撃型' },
  { rank: 3, team: '高配当ジャパン', owner: '堅守型', formation: '5-4-1', matchType: '3か月マッチ', returnPct: 9.74, status: '確定済み', style: '守備型' },
  { rank: 4, team: 'グロース連合', owner: '追走中', formation: '4-2-3-1', matchType: '1か月マッチ', returnPct: 7.92, status: '編成中', style: '中盤支配型' },
  { rank: 5, team: '任天堂FC', owner: '守備固め', formation: '4-4-2', matchType: '1か月マッチ', returnPct: 5.31, status: '確定済み', style: 'バランス型' },
  { rank: 6, team: '素材代表', owner: 'テーマ分散', formation: '3-5-2', matchType: '1週間マッチ', returnPct: 4.88, status: '確定済み', style: '中盤厚め型' },
  { rank: 7, team: '財務堅守イレブン', owner: '低ボラ重視', formation: '5-3-2', matchType: '3か月マッチ', returnPct: 2.44, status: '編成中', style: '守備重視型' },
  { rank: 8, team: '成長株ユナイテッド', owner: '攻撃準備中', formation: '3-4-2-1', matchType: '1週間マッチ', returnPct: -1.26, status: '編成中', style: '攻撃的1トップ型' },
];

const ROOT_ID = 'participants-page';
const ACTIVE_CLASS = 'participants-page-mode';
const CONTEST_ACTIVE_CLASS = 'contest-list-mode';
const FORMATION_ACTIVE_CLASS = 'formation-page-mode';
const HEADER_ORIGINAL_KEY = 'contestListOriginalHtml';

function formatReturn(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function createParticipantsPage() {
  const confirmed = PARTICIPANTS.filter((team) => team.status === '確定済み').length;
  const editing = PARTICIPANTS.length - confirmed;
  const leader = PARTICIPANTS[0];
  const section = document.createElement('section');
  section.id = ROOT_ID;
  section.className = 'participants-page card';
  section.setAttribute('aria-label', '参加チーム一覧');
  section.innerHTML = `
    <div class="participants-page-hero">
      <div>
        <p class="participants-page-kicker">TEAMS</p>
        <h2>参加チーム一覧</h2>
        <p>大会に参加しているチームの順位、布陣、状態を一覧で確認できます。</p>
      </div>
      <button type="button" class="participants-page-back">ダッシュボードへ戻る</button>
    </div>

    <div class="participants-summary-grid">
      <div><span>参加チーム</span><b>${PARTICIPANTS.length}チーム</b></div>
      <div><span>確定済み</span><b>${confirmed}チーム</b></div>
      <div><span>編成中</span><b>${editing}チーム</b></div>
      <div><span>暫定首位</span><b>${leader.team}</b></div>
    </div>

    <div class="participants-toolbar">
      <span>3か月マッチ</span>
      <span>1か月マッチ</span>
      <span>1週間マッチ</span>
      <strong>表示は暫定データです</strong>
    </div>

    <div class="participants-table-wrap">
      <table class="participants-table">
        <thead>
          <tr>
            <th>順位</th>
            <th>チーム</th>
            <th>布陣</th>
            <th>大会</th>
            <th>状態</th>
            <th>暫定リターン</th>
          </tr>
        </thead>
        <tbody>
          ${PARTICIPANTS.map((team) => `
            <tr>
              <td><span class="participants-rank rank-${team.rank <= 3 ? team.rank : 'other'}">${team.rank}</span></td>
              <td>
                <strong>${team.team}</strong>
                <small>${team.owner} / ${team.style}</small>
              </td>
              <td><b>${team.formation}</b></td>
              <td>${team.matchType}</td>
              <td><span class="participants-status ${team.status === '確定済み' ? 'locked' : 'editing'}">${team.status}</span></td>
              <td class="participants-return ${team.returnPct >= 0 ? 'positive' : 'negative'}">${formatReturn(team.returnPct)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="participants-note">
      <strong>表示ルール</strong>
      <span>現在は画面確認用の暫定データです。実データ化時に entries / entry_results と接続します。</span>
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

function applyParticipantsHeader() {
  const header = document.querySelector<HTMLElement>('.page-header');
  if (!header) return;

  const kicker = header.querySelector<HTMLElement>('.match-kicker');
  const title = header.querySelector<HTMLElement>('.header-main h1');
  const subline = header.querySelector<HTMLElement>('.header-subline');
  const chip = header.querySelector<HTMLElement>('.team-chip');

  [kicker, title, subline, chip].forEach(rememberOriginalHtml);

  if (kicker) kicker.textContent = 'TEAMS';
  if (title) title.textContent = '参加チーム';
  if (subline) {
    subline.innerHTML = `
      <span>👥 参加チーム一覧</span>
      <span>🏆 暫定順位を確認</span>
      <span>⚽ 布陣と状態を表示</span>
    `;
  }
  if (chip) chip.textContent = '参加チーム｜暫定順位｜編成状況';
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

function setActiveNav(target: 'dashboard' | 'participants') {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  links.forEach((link) => link.classList.remove('active'));
  const keyword = target === 'participants' ? '参加チーム' : 'ダッシュボード';
  const nav = links.find((link) => link.textContent?.includes(keyword));
  nav?.classList.add('active');
}

function showParticipantsPage() {
  const shell = document.querySelector('.app-shell');
  const main = document.querySelector('main.main');
  if (!shell || !main) return;

  const oldPage = document.getElementById(ROOT_ID);
  oldPage?.remove();

  const header = main.querySelector('.page-header');
  const page = createParticipantsPage();
  if (header?.nextSibling) {
    main.insertBefore(page, header.nextSibling);
  } else {
    main.appendChild(page);
  }
  page.querySelector('.participants-page-back')?.addEventListener('click', showDashboard);

  shell.classList.remove(CONTEST_ACTIVE_CLASS);
  shell.classList.remove(FORMATION_ACTIVE_CLASS);
  shell.classList.add(ACTIVE_CLASS);
  applyParticipantsHeader();
  setActiveNav('participants');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
  const shell = document.querySelector('.app-shell');
  shell?.classList.remove(ACTIVE_CLASS);
  shell?.classList.remove(CONTEST_ACTIVE_CLASS);
  shell?.classList.remove(FORMATION_ACTIVE_CLASS);
  restoreDashboardHeader();
  setActiveNav('dashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindParticipantsNavigation() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  const participantsNav = links.find((link) => link.textContent?.includes('参加チーム'));
  const dashboardNav = links.find((link) => link.textContent?.includes('ダッシュボード'));
  const contestNav = links.find((link) => link.textContent?.includes('試合モード'));
  const formationNav = links.find((link) => link.textContent?.includes('フォーメーション'));
  if (!participantsNav || participantsNav.dataset.participantsPageBound === 'true') return false;

  participantsNav.dataset.participantsPageBound = 'true';
  participantsNav.href = '#participants-page';
  participantsNav.addEventListener('click', (event) => {
    event.preventDefault();
    showParticipantsPage();
  });

  if (dashboardNav && dashboardNav.dataset.participantsPageBound !== 'true') {
    dashboardNav.dataset.participantsPageBound = 'true';
    dashboardNav.href = '#dashboard';
    dashboardNav.addEventListener('click', (event) => {
      event.preventDefault();
      showDashboard();
    });
  }

  [contestNav, formationNav].forEach((link) => {
    link?.addEventListener('click', () => {
      document.querySelector('.app-shell')?.classList.remove(ACTIVE_CLASS);
    }, { capture: true });
  });

  return true;
}

export function initParticipantsPage() {
  const tryBind = () => bindParticipantsNavigation();
  if (tryBind()) return;

  const observer = new MutationObserver(() => {
    if (tryBind()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 5000);
}
