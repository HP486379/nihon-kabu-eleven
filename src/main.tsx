import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPitchDragDrop } from './pitch-drag-drop';
import { initMemberLabelOverrides } from './member-label-overrides';
import { initEntrySubmit } from './entry-submit-wireup';
import { initPostEntryButtonRemoval } from './post-entry-button-removal';
import { initContestTicker } from './contest-ticker-wireup';
import { initFormationMiniLayout } from './formation-mini-layout-wireup';
import { initLowerLayoutWireup } from './lower-layout-wireup';
import { initTeamNameSuffixPreview } from './team-name-suffix-preview';
import { initMatchDurationRules } from './match-duration-rules-wireup';
import { initContestSelectionSync } from './contest-selection-sync';
import { initContestListPage } from './contest-list-page-wireup';
import { initFormationPage } from './formation-page-wireup';
import { initParticipantsPage } from './participants-page-wireup';
import { initParticipantsMatchTabs } from './participants-match-tabs-wireup';
import { initDashboardParticipantSummary } from './dashboard-participant-summary-wireup';
import { initDashboardParticipantRanking } from './dashboard-participant-ranking-wireup';
import { initDashboardCardMarketPeriodSync } from './dashboard-card-market-period-sync';
import { initTeamDetailPage } from './team-detail-page-wireup';
import { initMarketDataPeriodFetchPatch } from './market-data-period-fetch-patch';
import { initResultsPage } from './results-page-wireup';
import { initDailyMatchLabelWireup } from './daily-match-label-wireup';
import { initFormationPitchClassWireup } from './formation-pitch-class-wireup';
import { initPublicBetaCopyWireup } from './public-beta-copy-wireup';
import './styles.css';
import './market-data.css';
import './layout-fixes.css';
import './dashboard-polish.css';
import './entry-actions.css';
import './formation-mini-rows.css';
import './position-control-fixes.css';
import './pitch-drag-drop.css';
import './member-label-overrides.css';
import './contest-ticker.css';
import './contest-ticker-neon.css';
import './contest-layout-cleanup.css';
import './lower-layout-fixes.css';
import './team-name-suffix-preview.css';
import './match-duration-rules.css';
import './contest-list-page.css';
import './formation-page.css';
import './participants-page.css';
import './results-page.css';
import './dashboard-layout-tuning.css';
import './dashboard-formation-fit.css';
import './dashboard-pitch-balance.css';
import './pitch-line-details.css';
import './pitch-player-glass.css';
import './sidebar-logo-icon.css';
import './team-detail-page.css';
import './team-detail-pitch-view.css';

const USER_NAME_STORAGE_KEY = 'nihon-kabu-eleven:user-name';

function normalizeUserName(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function isValidUserName(value: string) {
  return /^[a-z0-9_-]{3,24}$/.test(value);
}

function readUserName() {
  try {
    return normalizeUserName(window.localStorage.getItem(USER_NAME_STORAGE_KEY) || '');
  } catch (_error) {
    return '';
  }
}

function writeUserName(value: string) {
  try {
    window.localStorage.setItem(USER_NAME_STORAGE_KEY, value);
  } catch (_error) {
    // localStorage is best-effort only.
  }
}

function setEntryGuardStatus(button: HTMLButtonElement, message: string, type: 'warning' | 'error') {
  const parent = button.parentElement;
  if (!parent) return;

  let status = parent.querySelector<HTMLElement>('.entry-submit-status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'entry-submit-status helper-text';
    status.setAttribute('aria-live', 'polite');
    parent.appendChild(status);
  }

  status.textContent = message;
  status.dataset.status = type;
  status.style.margin = '8px 0 0';
  status.style.fontWeight = '700';
}

function initUserNameEntryGuard() {
  document.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.lock-button') : null;
    if (!button || button.disabled) return;

    const label = button.textContent?.trim() || '';
    const isEntryAction = !label.includes('別チームを作る')
      && !label.includes('チームを作り直す')
      && !label.includes('取り消')
      && (label.includes('チームを確定') || label.includes('エントリー'));
    if (!isEntryAction || isValidUserName(readUserName())) return;

    const raw = window.prompt('ユーザーネームを登録してください。半角英数字・ハイフン・アンダースコアで3〜24文字です。例：Taro');
    if (raw === null) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setEntryGuardStatus(button, 'ユーザーネーム登録が必要です。キャンセルしたため、エントリーは保存していません。', 'warning');
      return;
    }

    const normalized = normalizeUserName(raw);
    if (!isValidUserName(normalized)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setEntryGuardStatus(button, 'ユーザーネームは半角英数字・ハイフン・アンダースコアで3〜24文字にしてください。', 'error');
      return;
    }

    writeUserName(normalized);
  }, true);
}

initMarketDataPeriodFetchPatch();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initUserNameEntryGuard();
initPitchDragDrop();
initMemberLabelOverrides();
initEntrySubmit();
initPostEntryButtonRemoval();
initContestTicker();
initFormationMiniLayout();
initFormationPitchClassWireup();
initLowerLayoutWireup();
initTeamNameSuffixPreview();
initMatchDurationRules();
initContestSelectionSync();
initContestListPage();
initFormationPage();
initParticipantsPage();
initParticipantsMatchTabs();
initDashboardParticipantSummary();
initDashboardParticipantRanking();
initDashboardCardMarketPeriodSync();
initTeamDetailPage();
initResultsPage();
initDailyMatchLabelWireup();
initPublicBetaCopyWireup();
