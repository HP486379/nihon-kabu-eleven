import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPitchDragDrop } from './pitch-drag-drop';
import { initMemberLabelOverrides } from './member-label-overrides';
import { initEntrySubmit } from './entry-submit-wireup';
import { initContestTicker } from './contest-ticker-wireup';
import { initFormationMiniLayout } from './formation-mini-layout-wireup';
import { initLowerLayoutWireup } from './lower-layout-wireup';
import { initTeamNameSuffixPreview } from './team-name-suffix-preview';
import { initMatchDurationRules } from './match-duration-rules-wireup';
import { initContestListPage } from './contest-list-page-wireup';
import { initFormationPage } from './formation-page-wireup';
import { initParticipantsPage } from './participants-page-wireup';
import { initResultsPage } from './results-page-wireup';
import { initDailyMatchLabelWireup } from './daily-match-label-wireup';
import { rememberSubmittedParticipant } from './lib/participantsApi';
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

const rememberedEntryKeys = new Set<string>();

function readText(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function syncVisibleCompletedEntry() {
  const teamName = readText('.team-chip').split('｜')[0]?.trim() || '';
  const formation = readText('.formation-number');
  const pageText = document.body.textContent || '';
  if (!teamName || !formation) return;
  if (!pageText.includes('エントリー完了') || !pageText.includes(teamName)) return;

  const key = `${teamName}|${formation}`;
  if (rememberedEntryKeys.has(key)) return;
  rememberedEntryKeys.add(key);

  rememberSubmittedParticipant({
    teamName,
    formation,
    status: '確定済み',
    matchType: '第1回 日本株代表イレブン杯',
  });
}

function initVisibleEntrySync() {
  window.addEventListener('nihon-kabu-eleven:entry-saved', syncVisibleCompletedEntry);
  const observer = new MutationObserver(syncVisibleCompletedEntry);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(syncVisibleCompletedEntry, 0);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initPitchDragDrop();
initMemberLabelOverrides();
initEntrySubmit();
initVisibleEntrySync();
initContestTicker();
initFormationMiniLayout();
initLowerLayoutWireup();
initTeamNameSuffixPreview();
initMatchDurationRules();
initContestListPage();
initFormationPage();
initParticipantsPage();
initResultsPage();
initDailyMatchLabelWireup();
