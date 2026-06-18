const ROOT_ID = 'team-detail-page';

function createHostElement() {
  const page = document.createElement('section');
  page.id = ROOT_ID;
  page.className = 'team-detail-page card';
  page.setAttribute('aria-label', 'チーム詳細');
  return page;
}

function insertAfter(parent: Element, target: Element, child: Element) {
  if (target.nextSibling) parent.insertBefore(child, target.nextSibling);
  else parent.appendChild(child);
}

function ensureTeamDetailHost() {
  const existing = document.getElementById(ROOT_ID);
  if (existing) return existing;

  const page = createHostElement();
  const main = document.querySelector('main.main') || document.querySelector('main') || document.querySelector('.main');
  const mainHeader = main?.querySelector('.page-header');

  if (main) {
    if (mainHeader) insertAfter(main, mainHeader, page);
    else main.appendChild(page);
    return page;
  }

  const anyHeader = document.querySelector('.page-header');
  if (anyHeader?.parentElement) {
    insertAfter(anyHeader.parentElement, anyHeader, page);
    return page;
  }

  const shell = document.querySelector('.app-shell');
  if (shell) {
    shell.appendChild(page);
    return page;
  }

  const root = document.getElementById('root');
  if (root) {
    root.appendChild(page);
    return page;
  }

  document.body.appendChild(page);
  return page;
}

function isTeamDetailRoute() {
  return /^#\/teams\/(daily|weekly|monthly|quarterly)\/[^/?#]+$/.test(window.location.hash)
    || /^#\/teams\/[^/?#]+$/.test(window.location.hash);
}

export function initTeamDetailHostGuard() {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest('.team-detail-open')) return;
    ensureTeamDetailHost();
  }, true);

  window.addEventListener('hashchange', () => {
    if (!isTeamDetailRoute()) return;
    ensureTeamDetailHost();
  });

  window.setTimeout(() => {
    if (!isTeamDetailRoute()) return;
    ensureTeamDetailHost();
  }, 0);
}
