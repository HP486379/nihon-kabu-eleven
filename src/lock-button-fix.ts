function hasElevenPlayers() {
  return document.querySelectorAll('.player-card').length === 11;
}

function updateLockButtonAvailability() {
  const button = document.querySelector<HTMLButtonElement>('.lock-button');
  if (!button) return;

  if (hasElevenPlayers()) {
    button.disabled = false;
    button.removeAttribute('disabled');
    button.classList.add('lock-button-ready');
  } else {
    button.classList.remove('lock-button-ready');
  }
}

function setDomLocked(locked: boolean) {
  document.body.classList.toggle('team-dom-locked', locked);
  const button = document.querySelector<HTMLButtonElement>('.lock-button');
  if (button) {
    button.textContent = locked ? '確定を解除' : 'チームを確定';
    button.classList.toggle('locked', locked);
  }

  const chip = document.querySelector<HTMLElement>('.team-chip');
  if (chip) {
    chip.textContent = chip.textContent?.replace(locked ? '編成中' : 'チーム確定済み', locked ? 'チーム確定済み' : '編成中') || '';
  }
}

let domLocked = false;

function installLockButtonFix() {
  updateLockButtonAvailability();

  const observer = new MutationObserver(() => {
    updateLockButtonAvailability();
    if (domLocked) setDomLocked(true);
  });

  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('.lock-button');
    if (!button || !button.classList.contains('lock-button-ready')) return;

    event.preventDefault();
    event.stopPropagation();

    if (!hasElevenPlayers()) return;
    domLocked = !domLocked;
    setDomLocked(domLocked);
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installLockButtonFix);
} else {
  installLockButtonFix();
}
