const DAILY_MATCH_LABEL = 'デイリーマッチ';
const OLD_DAILY_LABEL = 'デイリーカップ';

function normalizeText(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('*').forEach((element) => {
    if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
      const current = element.textContent || '';
      if (current.includes(OLD_DAILY_LABEL)) {
        element.textContent = current.replaceAll(OLD_DAILY_LABEL, DAILY_MATCH_LABEL);
      }
    }
  });
}

function cleanupParticipantsToolbar() {
  document.querySelectorAll<HTMLElement>('.participants-toolbar').forEach((toolbar) => {
    if (!toolbar.querySelector('.participants-match-tab')) return;

    toolbar.querySelectorAll('span').forEach((span) => {
      if (span.textContent?.trim() === DAILY_MATCH_LABEL) span.remove();
    });
  });
}

function normalizeDailyMatchLabels() {
  normalizeText(document.body);
  cleanupParticipantsToolbar();
}

export function initDailyMatchLabelWireup() {
  normalizeDailyMatchLabels();
  new MutationObserver(normalizeDailyMatchLabels).observe(document.body, { childList: true, subtree: true });
}
