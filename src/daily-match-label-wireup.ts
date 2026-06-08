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

function ensureChip(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((toolbar) => {
    const hasDaily = Array.from(toolbar.querySelectorAll('span')).some((span) => span.textContent?.trim() === DAILY_MATCH_LABEL);
    if (hasDaily) return;

    const dailyChip = document.createElement('span');
    dailyChip.textContent = DAILY_MATCH_LABEL;
    toolbar.insertBefore(dailyChip, toolbar.querySelector('span'));
  });
}

function normalizeDailyMatchLabels() {
  normalizeText(document.body);
  ensureChip('.participants-toolbar');
  ensureChip('.results-toolbar');
}

export function initDailyMatchLabelWireup() {
  normalizeDailyMatchLabels();
  new MutationObserver(normalizeDailyMatchLabels).observe(document.body, { childList: true, subtree: true });
}
