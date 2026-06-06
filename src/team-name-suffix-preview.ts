type TeamSuffix = 'ジャパン' | 'イレブン' | 'FC' | '代表' | 'ユナイテッド';

const TEAM_SUFFIXES: TeamSuffix[] = ['ジャパン', 'イレブン', 'FC', '代表', 'ユナイテッド'];
const DEFAULT_SUFFIX: TeamSuffix = 'ジャパン';

function findTeamEditorCard(): HTMLElement | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.editor-card'));
  return cards.find((card) => card.querySelector('h3')?.textContent?.trim() === 'チーム編成') || null;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
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

function syncDisplayName(baseInput: HTMLInputElement, suffixSelect: HTMLSelectElement) {
  const baseName = stripKnownSuffix(baseInput.value);
  if (!baseName) {
    setNativeInputValue(baseInput, '');
    return;
  }
  setNativeInputValue(baseInput, `${baseName}${suffixSelect.value}`);
}

function updateSearchPlaceholder(card: HTMLElement) {
  const searchInput = card.querySelector<HTMLInputElement>('form input');
  if (!searchInput) return;
  searchInput.placeholder = '銘柄名・証券コードで検索して追加（例：7951 / 7203）';
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

export function initTeamNameSuffixPreview() {
  window.setTimeout(() => {
    try {
      const card = findTeamEditorCard();
      if (!card || card.querySelector('.team-name-inline-row')) return;

      const inputs = Array.from(card.querySelectorAll<HTMLInputElement>('input'));
      const teamInput = inputs[0];
      if (!teamInput) return;

      teamInput.placeholder = '例：半導体';
      if (teamInput.value.trim() === 'ツヨシ') {
        setNativeInputValue(teamInput, '');
      }

      const currentSuffix = readCurrentSuffix(teamInput.value);
      const suffixSelect = createSuffixSelect(currentSuffix);
      const row = document.createElement('div');
      row.className = 'team-name-inline-row';

      const hint = document.createElement('span');
      hint.className = 'team-name-inline-hint';
      hint.textContent = '＋';

      teamInput.classList.add('team-name-base-input');
      teamInput.parentNode?.insertBefore(row, teamInput);
      row.appendChild(teamInput);
      row.appendChild(hint);
      row.appendChild(suffixSelect);

      suffixSelect.addEventListener('change', () => syncDisplayName(teamInput, suffixSelect));
      teamInput.addEventListener('blur', () => syncDisplayName(teamInput, suffixSelect));
      updateSearchPlaceholder(card);
    } catch (error) {
      console.warn('[team-name-suffix-preview] skipped:', error);
    }
  }, 0);
}
