let isInitialized = false;

function getLockButton() {
  return document.querySelector<HTMLButtonElement>('.lock-button');
}

function removeEntryStatus() {
  document.querySelectorAll<HTMLElement>('.entry-submit-status').forEach((element) => {
    element.remove();
  });
}

function removeCancelButtons() {
  document.querySelectorAll<HTMLButtonElement>('.cancel-entry-button').forEach((button) => {
    button.remove();
  });
}

function hasCancelSuccessStatus() {
  return Array.from(document.querySelectorAll<HTMLElement>('.entry-submit-status')).some((element) => {
    return (element.textContent || '').includes('エントリーを取り消しました');
  });
}

function resetDashboardAfterCancelSuccess() {
  if (!hasCancelSuccessStatus()) return;

  const lockButton = getLockButton();
  removeEntryStatus();
  removeCancelButtons();

  if (!lockButton) return;

  const label = lockButton.textContent?.trim() || '';
  const shouldUnlock = lockButton.dataset.entryAction === 'create-another'
    || label.includes('別チームを作る')
    || label.includes('確定を解除')
    || label.includes('エントリーを取り消す');

  if (shouldUnlock) {
    lockButton.click();
  }

  window.setTimeout(() => {
    lockButton.dataset.entryAction = 'entry';
    lockButton.classList.remove('create-another-team-button');
    if (!lockButton.textContent?.includes('チームを確定')) {
      lockButton.textContent = 'チームを確定';
    }
    removeEntryStatus();
    removeCancelButtons();
  }, 0);
}

function scheduleResetCheck() {
  [300, 800, 1500, 3000].forEach((delay) => {
    window.setTimeout(resetDashboardAfterCancelSuccess, delay);
  });
}

function handleCancelButtonClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest('.cancel-entry-button')) return;

  scheduleResetCheck();
}

export function initEntryCancelReset() {
  if (isInitialized) return;
  isInitialized = true;

  document.addEventListener('click', handleCancelButtonClick, true);
}
