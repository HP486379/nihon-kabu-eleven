const POST_ENTRY_LABELS = [
  '別チームを作る',
  'チームを作り直す',
  'エントリーを取り消す',
  '確定を解除',
  '解除',
];

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

export function initPostEntryButtonRemoval() {
  removePostEntryButtons();

  const observer = new MutationObserver(removePostEntryButtons);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener('nihon-kabu-eleven:entry-saved', removePostEntryButtons);
  window.addEventListener('focus', removePostEntryButtons);
  document.addEventListener('visibilitychange', removePostEntryButtons);
  window.setTimeout(removePostEntryButtons, 0);
  window.setTimeout(removePostEntryButtons, 300);
}
