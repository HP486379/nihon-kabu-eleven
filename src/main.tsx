import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPitchDragDrop } from './pitch-drag-drop';
import { initMemberLabelOverrides } from './member-label-overrides';
import { initEntrySubmit } from './entry-submit-wireup';
import { initContestTicker } from './contest-ticker-wireup';
import { initFormationMiniLayout } from './formation-mini-layout-wireup';
import { initLowerLayoutWireup } from './lower-layout-wireup';
import { initTeamNameSuffixWireup } from './team-name-suffix-wireup';
import './styles.css';
import './market-data.css';
import './layout-fixes.css';
import './dashboard-polish.css';
import './formation-mini-rows.css';
import './position-control-fixes.css';
import './pitch-drag-drop.css';
import './member-label-overrides.css';
import './sidebar-scale-tuning.css';
import './contest-ticker.css';
import './contest-ticker-neon.css';
import './contest-layout-cleanup.css';
import './lower-layout-fixes.css';
import './team-name-suffix.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initPitchDragDrop();
initMemberLabelOverrides();
initEntrySubmit();
initContestTicker();
initFormationMiniLayout();
initLowerLayoutWireup();
initTeamNameSuffixWireup();
