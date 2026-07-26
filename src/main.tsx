import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AppErrorBoundary from './AppErrorBoundary';
import { initPitchDragDrop } from './pitch-drag-drop';
import { initMemberLabelOverrides } from './member-label-overrides';
import './styles.css';
import './market-data.css';
import './layout-fixes.css';
import './dashboard-polish.css';
import './formation-mini-rows.css';
import './position-control-fixes.css';
import './pitch-drag-drop.css';
import './member-label-overrides.css';
import './sidebar-scale-tuning.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

function initDomWireups() {
  initPitchDragDrop();
  initMemberLabelOverrides();
}

window.setTimeout(initDomWireups, 3000);
