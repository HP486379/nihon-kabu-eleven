const POST_ENTRY_LABELS = [
  '別チームを作る',
  'チームを作り直す',
  'エントリーを取り消す',
  '確定を解除',
  '解除',
];

let isCleanupScheduled = false;

function isPostEntryButton(button: HTMLButtonElement) {
  const label = button.textContent?.trim() || '';
  return button.dataset.entryAction === 'post-entry'
    || POST_ENTRY_LABELS.some((text) => label.includes(text));
}

function removePostEntryButtons() {
  document.querySelectorAll<HTMLButtonElement>('.lock-button').forEach((button) => {
    if (!isPostEntryButton(button)) return;

    const parent = button.parentElement;
    parent?.querySelector<HTMLButtonElement>('.cancel-entry-button')?.remove();
    button.remove();
  });
}

function scheduleRemovePostEntryButtons(delayMs = 0) {
  if (isCleanupScheduled) return;
  isCleanupScheduled = true;

  window.setTimeout(() => {
    isCleanupScheduled = false;
    removePostEntryButtons();
  }, delayMs);
}

export function initPostEntryButtonRemoval() {
  removePostEntryButtons();

  const observer = new MutationObserver(() => scheduleRemovePostEntryButtons(50));
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('nihon-kabu-eleven:entry-saved', () => scheduleRemovePostEntryButtons());
  window.addEventListener('focus', () => scheduleRemovePostEntryButtons());
  document.addEventListener('visibilitychange', () => scheduleRemovePostEntryButtons());
  window.setTimeout(removePostEntryButtons, 0);
  window.setTimeout(removePostEntryButtons, 300);
}
