import { calculateResults, fetchEntryResults, getCurrentPeriodId, type EntryResultItem, type ResultsApiResult } from './lib/resultsApi';
import { getContestLabel, getCurrentMatchType, setCurrentMatchType, type MatchType } from './lib/contestContext';

type ResultItem = {
  rank: number;
  rankOrder: number;
  team: string;
  owner: string;
  formation: string;
  matchType: string;
  periodId: string;
  resultPct: number;
  status: string;
  highlight: string;
  calculatedAt: string;
};

type ResultPageEnv = {
  DEV?: boolean;
  VITE_ENABLE_RESULT_CALC?: string;
};

const ROOT_ID = 'results-page';
const ACTIVE_CLASS = 'results-page-mode';
const CONTEST_ACTIVE_CLASS = 'contest-list-mode';
const FORMATION_ACTIVE_CLASS = 'formation-page-mode';
const PARTICIPANTS_ACTIVE_CLASS = 'participants-page-mode';
const HEADER_ORIGINAL_KEY = 'contestListOriginalHtml';
const APP_ENV = (import.meta as ImportMeta & { env?: ResultPageEnv }).env;
const RESULT_CALC_ENABLED = APP_ENV?.DEV === true || String(APP_ENV?.VITE_ENABLE_RESULT_CALC || '').toLowerCase() === 'true';
const RESULT_MATCH_TYPES: MatchType[] = ['daily', 'weekly', 'monthly', 'quarterly'];
let activeResultsMatchType: MatchType = 'daily';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace('%', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatPct(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isMatchType(value: string | null | undefined): value is MatchType {
  return Boolean(value && RESULT_MATCH_TYPES.includes(value as MatchType));
}

function normalizeResultStatus(value: string) {
  if (value === 'final') return '確定結果';
  if (value === 'provisional') return '暫定結果';
  return value || '結果';
}

function getResultPct(result: EntryResultItem) {
  const directPct = toNumber(result.returnPct ?? result.return_pct ?? result.teamReturn ?? result.team_return);
  if (directPct !== null) return directPct;

  const weightedReturn = toNumber(result.weightedReturn ?? result.weighted_return);
  return weightedReturn === null ? null : weightedReturn * 100;
}

function toResultItem(result: EntryResultItem, index: number, fallbackMatchType: MatchType, fallbackPeriodId: string): ResultItem | null {
  const resultPct = getResultPct(result);
  if (resultPct === null) return null;

  const rank = toNumber(result.rank) ?? index + 1;
  const rankOrder = toNumber(result.rankOrder ?? result.rank_order) ?? index + 1;
  const matchType = firstText(result.matchType, result.match_type) || fallbackMatchType;
  const periodId = firstText(result.periodId, result.period_id) || fallbackPeriodId;
  const status = firstText(result.resultStatus, result.result_status) || 'provisional';

  return {
    rank,
    rankOrder,
    team: firstText(result.teamName, result.team_name) || `エントリー ${index + 1}`,
    owner: firstText(result.userName, result.user_name) || '参加チーム',
    formation: firstText(result.formation) || '-',
    matchType: isMatchType(matchType) ? getContestLabel(matchType) : matchType,
    periodId,
    resultPct,
    status: normalizeResultStatus(status),
    highlight: resultPct >= 0 ? 'ポジション加重リターンでプラス着地' : 'ポジション加重リターンでマイナス着地',
    calculatedAt: firstText(result.calculatedAt, result.calculated_at),
  };
}

function normalizeResults(payload: ResultsApiResult, matchType: MatchType, periodId: string) {
  return (payload.results || [])
    .map((result, index) => toResultItem(result, index, matchType, periodId))
    .filter((item): item is ResultItem => item !== null)
    .sort((a, b) => a.rankOrder - b.rankOrder);
}

function renderChampion(results: ResultItem[]) {
  const champion = results[0];
  if (!champion) {
    return `
      <div class="results-champion-card results-champion-empty">
        <div class="results-cup">🏆</div>
        <div>
          <span>WAITING</span>
          <h3>結果集計待ち</h3>
          <p>entry_results に集計結果が保存されると、ここに優勝チームが表示されます。</p>
        </div>
        <strong>-</strong>
      </div>
    `;
  }

  return `
    <div class="results-champion-card">
      <div class="results-cup">🏆</div>
      <div>
        <span>WINNER</span>
        <h3>${escapeHtml(champion.team)}</h3>
        <p>${escapeHtml(champion.matchType)} / ${escapeHtml(champion.periodId)} / ${escapeHtml(champion.highlight)}</p>
      </div>
      <strong>${formatPct(champion.resultPct)}</strong>
    </div>
  `;
}

function renderSummary(results: ResultItem[], totalResults: number) {
  const champion = results[0];
  const average = results.length > 0 ? results.reduce((sum, item) => sum + item.resultPct, 0) / results.length : null;
  const positiveCount = results.filter((item) => item.resultPct >= 0).length;

  return `
    <div><span>結果件数</span><b>${totalResults}チーム</b></div>
    <div><span>優勝リターン</span><b>${champion ? formatPct(champion.resultPct) : '-'}</b></div>
    <div><span>平均リターン</span><b>${average === null ? '-' : formatPct(average)}</b></div>
    <div><span>プラス着地</span><b>${results.length > 0 ? `${positiveCount}チーム` : '-'}</b></div>
  `;
}

function renderPodium(results: ResultItem[]) {
  if (results.length === 0) {
    return `
      <div class="results-empty-state results-empty-podium">
        <strong>まだ集計結果はありません</strong>
        <span>選択中の大会タイプ・期間IDに対応する entry_results が保存されると、表彰台と順位表が表示されます。</span>
      </div>
    `;
  }

  return results.slice(0, 3).map((team) => `
    <article class="results-podium-card rank-${team.rank}">
      <div class="results-medal">${team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : '🥉'}</div>
      <h3>${escapeHtml(team.team)}</h3>
      <p>${escapeHtml(team.owner)} / ${escapeHtml(team.status)}</p>
      <strong class="${team.resultPct >= 0 ? 'positive' : 'negative'}">${formatPct(team.resultPct)}</strong>
    </article>
  `).join('');
}

function renderRows(results: ResultItem[]) {
  if (results.length === 0) {
    return `
      <tr>
        <td colspan="7">
          <div class="results-empty-state">
            <strong>まだ結果はありません</strong>
            <span>集計後に /api/results の正式結果をもとに表示します。</span>
          </div>
        </td>
      </tr>
    `;
  }

  return results.map((team) => `
    <tr>
      <td><span class="results-rank rank-${team.rank <= 3 ? team.rank : 'other'}">${team.rank}</span></td>
      <td>
        <strong>${escapeHtml(team.team)}</strong>
        <small>${escapeHtml(team.owner)}</small>
      </td>
      <td><b>${escapeHtml(team.formation)}</b></td>
      <td>${escapeHtml(team.matchType)}<small>${escapeHtml(team.periodId)}</small></td>
      <td><span class="results-status fixed">${escapeHtml(team.status)}</span></td>
      <td class="results-return ${team.resultPct >= 0 ? 'positive' : 'negative'}">${formatPct(team.resultPct)}</td>
      <td>${escapeHtml(team.calculatedAt ? `計算 ${formatDateTime(team.calculatedAt)}` : team.highlight)}</td>
    </tr>
  `).join('');
}

function renderResults(page: HTMLElement, payload: ResultsApiResult, matchType: MatchType, periodId: string) {
  const results = normalizeResults(payload, matchType, periodId);
  const totalResults = typeof payload.count === 'number' ? payload.count : results.length;
  const championSlot = page.querySelector<HTMLElement>('[data-results-champion]');
  const summary = page.querySelector<HTMLElement>('.results-summary-grid');
  const podium = page.querySelector<HTMLElement>('[data-results-podium]');
  const body = page.querySelector<HTMLElement>('[data-results-body]');
  const source = page.querySelector<HTMLElement>('[data-results-source]');
  const note = page.querySelector<HTMLElement>('[data-results-note]');

  if (championSlot) championSlot.innerHTML = renderChampion(results);
  if (summary) summary.innerHTML = renderSummary(results, totalResults);
  if (podium) podium.innerHTML = renderPodium(results);
  if (body) body.innerHTML = renderRows(results);
  if (source) source.textContent = results.length > 0
    ? `${getContestLabel(matchType)} / ${periodId}：正式結果を表示中`
    : `${getContestLabel(matchType)} / ${periodId}：集計結果待ち`;
  if (note) {
    note.innerHTML = '<strong>集計ルール</strong><span>結果発表は /api/results から取得した entry_results の正式結果だけを表示します。</span>';
  }
}

function renderResultsError(page: HTMLElement, message: string) {
  const championSlot = page.querySelector<HTMLElement>('[data-results-champion]');
  const body = page.querySelector<HTMLElement>('[data-results-body]');
  const podium = page.querySelector<HTMLElement>('[data-results-podium]');
  const source = page.querySelector<HTMLElement>('[data-results-source]');
  const note = page.querySelector<HTMLElement>('[data-results-note]');

  if (championSlot) championSlot.innerHTML = renderChampion([]);
  if (podium) {
    podium.innerHTML = `
      <div class="results-error-state results-empty-podium">
        <strong>結果データの取得に失敗しました</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }
  if (body) {
    body.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="results-error-state">
            <strong>結果データの取得に失敗しました</strong>
            <span>${escapeHtml(message)}</span>
          </div>
        </td>
      </tr>
    `;
  }
  if (source) source.textContent = 'API取得エラー';
  if (note) {
    note.innerHTML = '<strong>確認ポイント</strong><span>Render 側の GET /api/results が有効か、entry_results に正式結果が保存されているか確認してください。</span>';
  }
}

async function loadResults(page: HTMLElement, matchType: MatchType = activeResultsMatchType) {
  const periodId = getCurrentPeriodId(matchType);
  try {
    const payload = await fetchEntryResults({ matchType, periodId });
    renderResults(page, payload, matchType, periodId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderResultsError(page, message);
  }
}

function setCalculateStatus(page: HTMLElement, message: string, type: 'idle' | 'loading' | 'success' | 'error' | 'disabled' = 'idle') {
  const status = page.querySelector<HTMLElement>('[data-results-calculate-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.status = type;
}

async function handleCalculateResults(page: HTMLElement) {
  if (!RESULT_CALC_ENABLED) {
    setCalculateStatus(page, '集計実行は管理者/開発環境でのみ利用できます。', 'disabled');
    return;
  }

  const button = page.querySelector<HTMLButtonElement>('[data-results-calculate-button]');
  if (!button) return;

  button.disabled = true;
  const periodId = getCurrentPeriodId(activeResultsMatchType);
  setCalculateStatus(page, `${getContestLabel(activeResultsMatchType)} / ${periodId} を集計中です。数十秒かかる場合があります。`, 'loading');

  try {
    const result = await calculateResults({ matchType: activeResultsMatchType, periodId, resultStatus: 'provisional' });
    setCalculateStatus(page, `集計完了：${result.count ?? 0}チームの結果を保存しました。`, 'success');
    await loadResults(page, activeResultsMatchType);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCalculateStatus(page, `集計失敗：${message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

function renderCalculateAction() {
  if (RESULT_CALC_ENABLED) {
    return '<button type="button" class="results-calculate-button" data-results-calculate-button>集計を実行</button>';
  }

  return '<span class="results-calculate-disabled">集計実行は管理者/開発環境のみ</span>';
}

function renderCalculateStatus() {
  if (RESULT_CALC_ENABLED) {
    return `
      <div class="results-calculate-status" data-results-calculate-status data-status="idle">
        集計結果が空の場合は「集計を実行」を押してください。
      </div>
    `;
  }

  return `
    <div class="results-calculate-status" data-results-calculate-status data-status="disabled">
      通常公開画面では集計実行は無効です。結果表示のみ行います。
    </div>
  `;
}

function renderResultsTabs(activeMatchType: MatchType) {
  return RESULT_MATCH_TYPES.map((matchType) => `
    <button
      type="button"
      class="results-match-tab ${matchType === activeMatchType ? 'selected' : ''}"
      data-results-match-type="${matchType}"
    >${getContestLabel(matchType)}</button>
  `).join('');
}

function setResultsTabState(page: HTMLElement, activeMatchType: MatchType) {
  page.querySelectorAll<HTMLButtonElement>('[data-results-match-type]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.resultsMatchType === activeMatchType);
  });
}

function bindResultsTabs(page: HTMLElement) {
  page.querySelectorAll<HTMLButtonElement>('[data-results-match-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMatchType = button.dataset.resultsMatchType;
      if (!isMatchType(nextMatchType)) return;
      activeResultsMatchType = nextMatchType;
      setCurrentMatchType(nextMatchType);
      setResultsTabState(page, nextMatchType);
      void loadResults(page, nextMatchType);
    });
  });
}

function createResultsPage() {
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
      <div class="results-page-actions">
        ${renderCalculateAction()}
        <button type="button" class="results-page-back">ダッシュボードへ戻る</button>
      </div>
    </div>

    ${renderCalculateStatus()}

    <div data-results-champion>
      <div class="results-champion-card results-champion-empty">
        <div class="results-cup">🏆</div>
        <div>
          <span>LOADING</span>
          <h3>結果を読み込み中</h3>
          <p>/api/results から正式結果を取得しています。</p>
        </div>
        <strong>-</strong>
      </div>
    </div>

    <div class="results-summary-grid">
      <div><span>結果件数</span><b>読み込み中</b></div>
      <div><span>優勝リターン</span><b>-</b></div>
      <div><span>平均リターン</span><b>-</b></div>
      <div><span>プラス着地</span><b>-</b></div>
    </div>

    <div class="results-toolbar">
      ${renderResultsTabs(activeResultsMatchType)}
      <strong data-results-source>APIから取得中...</strong>
    </div>

    <div class="results-podium" data-results-podium>
      <div class="results-loading-state results-empty-podium">結果データを読み込んでいます...</div>
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
            <th>計算</th>
          </tr>
        </thead>
        <tbody data-results-body>
          <tr>
            <td colspan="7">
              <div class="results-loading-state">結果データを読み込んでいます...</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="results-note" data-results-note>
      <strong>集計ルール</strong>
      <span>/api/results の正式結果を取得します。</span>
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
  if (chip) chip.textContent = '結果発表｜正式結果｜大会成績';
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

  activeResultsMatchType = getCurrentMatchType();
  document.getElementById(ROOT_ID)?.remove();

  const header = main.querySelector('.page-header');
  const page = createResultsPage();
  if (header?.nextSibling) {
    main.insertBefore(page, header.nextSibling);
  } else {
    main.appendChild(page);
  }
  page.querySelector('.results-page-back')?.addEventListener('click', showDashboard);
  page.querySelector('[data-results-calculate-button]')?.addEventListener('click', () => {
    void handleCalculateResults(page);
  });
  bindResultsTabs(page);

  shell.classList.remove(CONTEST_ACTIVE_CLASS);
  shell.classList.remove(FORMATION_ACTIVE_CLASS);
  shell.classList.remove(PARTICIPANTS_ACTIVE_CLASS);
  shell.classList.add(ACTIVE_CLASS);
  applyResultsHeader();
  setActiveNav('results');
  void loadResults(page, activeResultsMatchType);
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
  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const link = target?.closest<HTMLAnchorElement>('.sidebar-nav a');
    if (!link) return;

    const label = link.textContent || '';
    if (label.includes('結果発表')) {
      event.preventDefault();
      showResultsPage();
      return;
    }

    if (label.includes('ダッシュボード')) {
      event.preventDefault();
      showDashboard();
      return;
    }

    if (['試合モード', 'フォーメーション', '参加チーム'].some((item) => label.includes(item))) {
      document.querySelector('.app-shell')?.classList.remove(ACTIVE_CLASS);
    }
  });
}
