const TEAM_SUFFIX_OPTIONS = ['ジャパン', 'イレブン', 'FC', '代表', 'ユナイテッド'];

function findTeamEditorCard() {
  return Array.from(document.querySelectorAll<HTMLElement>('.editor-card')).find((card) => {
    const title = card.querySelector('h3')?.textContent?.trim() || '';
    return title === 'チーム編成';
  }) || null;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function getTeamStatusTail(chip: HTMLElement) {
  const parts = (chip.textContent || '').split('｜');
  return parts.length > 1 ? `｜${parts.slice(1).join('｜')}` : '';
}

function buildTeamName(baseName: string, suffix: string) {
  const base = baseName.trim();
  if (!base) return `マイ${suffix}`;
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

function updateTeamChip(input: HTMLInputElement, suffixSelect: HTMLSelectElement) {
  const chip = document.querySelector<HTMLElement>('.team-chip');
  if (!chip) return;

  const tail = getTeamStatusTail(chip);
  const nextText = `${buildTeamName(input.value, suffixSelect.value)}${tail}`;
  if (chip.textContent !== nextText) chip.textContent = nextText;
}

function setupTeamNameControls() {
  const card = findTeamEditorCard();
  if (!card) return;

  const input = card.querySelector<HTMLInputElement>(':scope > input');
  if (!input) return;

  input.classList.add('team-base-name-input');
  input.placeholder = '例：ツヨシ / 半導体 / 高配当';

  if (input.dataset.defaultCleared !== 'true' && input.value.trim() === 'ツヨシ') {
    input.dataset.defaultCleared = 'true';
    setNativeInputValue(input, '');
  }

  let suffixSelect = card.querySelector<HTMLSelectElement>('.team-name-suffix-select');
  if (!suffixSelect) {
    suffixSelect = document.createElement('select');
    suffixSelect.className = 'team-name-suffix-select';
    suffixSelect.setAttribute('aria-label', 'チーム呼称');
    TEAM_SUFFIX_OPTIONS.forEach((suffix) => {
      const option = document.createElement('option');
      option.value = suffix;
      option.textContent = suffix;
      suffixSelect?.appendChild(option);
    });
    input.insertAdjacentElement('afterend', suffixSelect);
  }

  suffixSelect.disabled = input.disabled;

  const searchInput = card.querySelector<HTMLInputElement>('.custom-stock-row input');
  if (searchInput) {
    searchInput.placeholder = '銘柄名・証券コードで検索して追加（例：7951 / 7203）';
  }

  if (input.dataset.teamSuffixReady !== 'true') {
    input.dataset.teamSuffixReady = 'true';
    input.addEventListener('input', () => updateTeamChip(input, suffixSelect));
  }

  if (suffixSelect.dataset.teamSuffixReady !== 'true') {
    suffixSelect.dataset.teamSuffixReady = 'true';
    suffixSelect.addEventListener('change', () => updateTeamChip(input, suffixSelect));
  }

  updateTeamChip(input, suffixSelect);
}

export function initTeamNameSuffixWireup() {
  const observer = new MutationObserver(setupTeamNameControls);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(setupTeamNameControls, 0);
  window.setTimeout(setupTeamNameControls, 250);
}
