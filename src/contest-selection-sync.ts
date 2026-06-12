import { setCurrentMatchType, type MatchType } from './lib/contestContext';

let isInitialized = false;

function isMatchType(value: string | undefined): value is MatchType {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'quarterly';
}

function isParticipantsPageActive() {
  return document.querySelector<HTMLElement>('.app-shell')?.classList.contains('participants-page-mode') === true;
}

function syncSelectedChip() {
  // 参加チーム一覧表示中は、一覧側のタブが大会タイプの正本。
  // 背後に残っているダッシュボード側の selected chip で上書きしない。
  if (isParticipantsPageActive()) return;

  const selected = document.querySelector<HTMLElement>('.match-type-chip.selected');
  const matchType = selected?.dataset.matchType;
  if (!isMatchType(matchType)) return;
  setCurrentMatchType(matchType);
}

export function initContestSelectionSync() {
  if (isInitialized) return;
  isInitialized = true;

  document.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.match-type-chip') : null;
    const matchType = button?.dataset.matchType;
    if (!isMatchType(matchType)) return;

    window.setTimeout(() => {
      setCurrentMatchType(matchType);
    }, 0);
  }, true);

  const observer = new MutationObserver(() => syncSelectedChip());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.setTimeout(syncSelectedChip, 300);
  window.setTimeout(syncSelectedChip, 1200);
}
