type TeamSuffix = 'ジャパン' | 'イレブン' | 'FC' | '代表' | 'ユナイテッド';

const TEAM_SUFFIXES: TeamSuffix[] = ['ジャパン', 'イレブン', 'FC', '代表', 'ユナイテッド'];
const DEFAULT_SUFFIX: TeamSuffix = 'ジャパン';
const EMPTY_TEAM_PLACEHOLDER = 'チーム名を入力（例：半導体）';
const SEARCH_PLACEHOLDER = '銘柄名・証券コードで検索して追加（例：7951 / 7203）';

let initialized = false;
let activeSuffix: TeamSuffix = DEFAULT_SUFFIX;

function findTeamEditorCard(): HTMLElement | null {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h3'));
  const heading = headings.find((item) => item.textContent?.trim() === 'チーム編成');
  return heading?.closest<HTMLElement>('.card') || heading?.parentElement || null;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function stripKnownSuffix(value: string) {
  const trimmed = value.trim();
  const suffix = TEAM_SUFFIXES.find((candidate) => trimmed.endsWith(candidate));
  return suffix ? trimmed.slice(0, -suffix.length).trim() : trimmed;
}

function readCurrentSuffix(value: string): TeamSuffix {
  const trimmed = value.trim();
  return TEAM_SUFFIXES.find((candidate) => trimmed.endsWith(candidate)) || DEFAULT_SUFFIX;
}

function findInputs(card: HTMLElement) {
  const inputs = Array.from(card.querySelectorAll<HTMLInputElement>('input'));
  const teamInput = inputs.find((input) => input.placeholder.includes('ツヨシ') || input.value.trim() === 'ツヨシ') || inputs[0] || null;
  const searchInput = card.querySelector<HTMLInputElement>('form input') || inputs.find((input) => input !== teamInput) || null;
  return { teamInput, searchInput };
}

function createSuffixSelect(currentSuffix: TeamSuffix) {
  const select = document.createElement('select');
  select.className = 'team-name-suffix-select';
  select.setAttribute('aria-label', 'チーム呼称');
  TEAM_SUFFIXES.forEach((suffix) => {
    const option = document.createElement('option');
    option.value = suffix;
    option.textContent = suffix;
    option.selected = suffix === currentSuffix;
    select.appendChild(option);
  });
  return select;
}

function patchTeamChip(baseInput: HTMLInputElement, suffixSelect: HTMLSelectElement) {
  const chip = document.querySelector<HTMLElement>('.team-chip');
  if (!chip) return;

  const parts = chip.textContent?.split('｜') || [];
  if (parts.length < 2) return;

  const baseName = stripKnownSuffix(baseInput.value);
  const displayName = baseName ? `${baseName}${suffixSelect.value}` : `マイ${suffixSelect.value}`;
  chip.textContent = [displayName, ...parts.slice(1)].join('｜');
}

function syncDisplayName(baseInput: HTMLInputElement, suffixSelect: HTMLSelectElement) {
  const baseName = stripKnownSuffix(baseInput.value);
  activeSuffix = suffixSelect.value as TeamSuffix;

  if (!baseName) {
    setNativeInputValue(baseInput, '');
    patchTeamChip(baseInput, suffixSelect);
    return;
  }

  if (suffixSelect.value === 'ジャパン') {
    setNativeInputValue(baseInput, baseName);
  } else {
    setNativeInputValue(baseInput, `${baseName}${suffixSelect.value}`);
  }
  patchTeamChip(baseInput, suffixSelect);
}

function applyTeamNameControls() {
  const card = findTeamEditorCard();
  if (!card) return false;

  const { teamInput, searchInput } = findInputs(card);
  if (!teamInput) return false;

  teamInput.placeholder = EMPTY_TEAM_PLACEHOLDER;
  teamInput.classList.add('team-name-base-input');

  if (teamInput.value.trim() === 'ツヨシ') {
    setNativeInputValue(teamInput, '');
  }

  if (searchInput) {
    searchInput.placeholder = SEARCH_PLACEHOLDER;
  }

  let suffixSelect = card.querySelector<HTMLSelectElement>('.team-name-suffix-select');
  if (!suffixSelect) {
    const currentSuffix = readCurrentSuffix(teamInput.value);
    activeSuffix = currentSuffix;
    suffixSelect = createSuffixSelect(currentSuffix);
    const row = document.createElement('div');
    row.className = 'team-name-inline-row';

    const hint = document.createElement('span');
    hint.className = 'team-name-inline-hint';
    hint.textContent = '＋';

    teamInput.parentNode?.insertBefore(row, teamInput);
    row.appendChild(teamInput);
    row.appendChild(hint);
    row.appendChild(suffixSelect);

    suffixSelect.addEventListener('change', () => syncDisplayName(teamInput, suffixSelect));
    teamInput.addEventListener('blur', () => syncDisplayName(teamInput, suffixSelect));
    teamInput.addEventListener('input', () => window.setTimeout(() => patchTeamChip(teamInput, suffixSelect), 0));
  } else {
    suffixSelect.value = activeSuffix;
  }

  patchTeamChip(teamInput, suffixSelect);
  initialized = true;
  return true;
}

export function initTeamNameSuffixPreview() {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      const done = applyTeamNameControls();
      if (done && initialized && attempts > 3) {
        window.clearInterval(timer);
      }
      if (attempts > 80) {
        window.clearInterval(timer);
      }
    } catch (error) {
      console.warn('[team-name-suffix-preview] skipped:', error);
      window.clearInterval(timer);
    }
  }, 100);
}