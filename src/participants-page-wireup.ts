import { fetchParticipants, type ParticipantItem } from './lib/participantsApi';

const ROOT_ID = 'participants-page';
const ACTIVE_CLASS = 'participants-page-mode';
const CONTEST_ACTIVE_CLASS = 'contest-list-mode';
const FORMATION_ACTIVE_CLASS = 'formation-page-mode';
const RESULTS_ACTIVE_CLASS = 'results-page-mode';
const HEADER_ORIGINAL_KEY = 'contestListOriginalHtml';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatReturn(value: number | null) {
  if (value === null) return '集計待ち';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getReturnClass(value: number | null) {
  if (value === null) return 'neutral';
  return value >= 0 ? 'positive' : 'negative';
}

function isLockedStatus(status: string) {
  return status.includes('確定') || status.includes('完了') || status.toLowerCase().includes('locked');
}

function renderSummary(participants: ParticipantItem[]) {
  const confirmed = participants.filter((team) => isLockedStatus(team.status)).length;
  const editing = Math.max(participants.length - confirmed, 0);
  const leader = participants[0];

  return `
    <div><span>参加チーム</span><b>${participants.length}チーム</b></div>
    <div><span>確定済み</span><b>${confirmed}チーム</b></div>
    <div><span>編成中</span><b>${editing}チーム</b></div>
    <div><span>暫定首位</span><b>${leader ? escapeHtml(leader.team) : '-'}</b></div>
  `;
}

function renderRows(participants: ParticipantItem[]) {
  if (participants.length === 0) {
    return `
      <tr>
        <td colspan="6">
          <div class="participants-empty-state">
            <strong>まだ参加チームがありません</strong>
            <span>チームを確定すると、この一覧にAPI経由で表示されます。</span>
          </div>
        </td>
      </tr>
    `;
  }

  return participants.map((team) => {
    const locked = isLockedStatus(team.status);
    return `
      <tr>
        <td><span class="participants-rank rank-${team.rank <= 3 ? team.rank : 'other'}">${team.rank}</span></td>
        <td>
          <strong>${escapeHtml(team.team)}</strong>
          <small>${escapeHtml(team.owner)} / ${escapeHtml(team.style)}</small>
        </td>
        <td><b>${escapeHtml(team.formation)}</b></td>
        <td>${escapeHtml(team.matchType)}</td>
        <td><span class="participants-status ${locked ? 'locked' : 'editing'}">${escapeHtml(team.status)}</span></td>
        <td class="participants-return ${getReturnClass(team.returnPct)}">${formatReturn(team.returnPct)}</td>
      </tr>
    `;
  }).join('');
}

function renderParticipants(page: HTMLElement, participants: ParticipantItem[]) {
  const summary = page.querySelector<HTMLElement>('.participants-summary-grid');
  const body = page.querySelector<HTMLElement>('[data-participants-body]');
  const note = page.querySelector<HTMLElement>('[data-participants-note]');
  const toolbarStatus = page.querySelector<HTMLElement>('[data-participants-source]');

  if (summary) summary.innerHTML = renderSummary(participants);
  if (body) body.innerHTML = renderRows(participants);
  if (toolbarStatus) toolbarStatus.textContent = 'API実データを表示中';
  if (note) {
    note.innerHTML = '<strong>表示ルール</strong><span>API / Supabase に保存されたエントリーを取得し、ポジション加重リターン順に表示します。未集計のチームは「集計待ち」として表示します。</span>';
  }
}

function renderParticipantsError(page: HTMLElement, message: string) {
  const body = page.querySelector<HTMLElement>('[data-participants-body]');
  const toolbarStatus = page.querySelector<HTMLElement>('[data-participants-source]');
  const note = page.querySelector<HTMLElement>('[data-participants-note]');

  if (toolbarStatus) toolbarStatus.textContent = 'API取得エラー';
  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="participants-error-state">
            <strong>参加チームの取得に失敗しました</strong>
            <span>${escapeHtml(message)}</span>
          </div>
        </td>
      </tr>
    `;
  }
  if (note) {
    note.innerHTML = '<strong>確認ポイント</strong><span>バックエンドの GET /api/entries が有効か、Vercel の VITE_API_BASE が Render のAPI URLを向いているか確認してください。</span>';
  }
}

async function loadParticipants(page: HTMLElement) {
  try {
    const participants = await fetchParticipants();
    renderParticipants(page, participants);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderParticipantsError(page, message);
  }
}

function createParticipantsPage() {
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
      <div><span>参加チーム</span><b>読み込み中</b></div>
      <div><span>確定済み</span><b>-</b></div>
      <div><span>編成中</span><b>-</b></div>
      <div><span>暫定首位</span><b>-</b></div>
    </div>

    <div class="participants-toolbar">
      <span>デイリーマッチ</span>
      <span>1週間マッチ</span>
      <span>1か月マッチ</span>
      <span>3か月マッチ</span>
      <strong data-participants-source>APIから取得中...</strong>
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
        <tbody data-participants-body>
          <tr>
            <td colspan="6">
              <div class="participants-loading-state">参加チームを読み込んでいます...</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="participants-note" data-participants-note>
      <strong>表示ルール</strong>
      <span>API / Supabase に保存された参加チームを取得します。</span>
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
  shell.classList.remove(RESULTS_ACTIVE_CLASS);
  shell.classList.add(ACTIVE_CLASS);
  applyParticipantsHeader();
  setActiveNav('participants');
  void loadParticipants(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
  const shell = document.querySelector('.app-shell');
  shell?.classList.remove(ACTIVE_CLASS);
  shell?.classList.remove(CONTEST_ACTIVE_CLASS);
  shell?.classList.remove(FORMATION_ACTIVE_CLASS);
  shell?.classList.remove(RESULTS_ACTIVE_CLASS);
  restoreDashboardHeader();
  setActiveNav('dashboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindParticipantsNavigation() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a'));
  const participantsNav = links.find((link) => link.textContent?.includes('参加チーム'));
  const dashboardNav = links.find((link) => link.textContent?.includes('ダッシュボード'));
  const otherNavs = links.filter((link) => ['試合モード', 'フォーメーション', '結果発表'].some((label) => link.textContent?.includes(label)));
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

  otherNavs.forEach((link) => {
    link.addEventListener('click', () => {
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
