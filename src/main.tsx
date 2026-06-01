import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './market-data.css';
import './layout-fixes.css';
import './dashboard-polish.css';
import './formation-mini-rows.css';
import './position-control-fixes.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
