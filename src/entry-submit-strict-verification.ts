type EntryListItem = {
  id?: string;
  entryId?: string;
  entry_id?: string;
  teamName?: string | null;
  team_name?: string | null;
};

type EntryListResult = {
  ok?: boolean;
  entries?: EntryListItem[];
  participants?: EntryListItem[];
  data?: EntryListItem[];
};

type EntrySavedEventDetail = {
  entryId?: string;
  teamName?: string;
};

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

let isInitialized = false;
let lastEntrySubmitStartedAt = 0;

function firstText(...values: unknown[]) {
  const found = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof found === 'string' ? found.trim() : '';
}

function normalizeEntryList(result: EntryListResult): EntryListItem[] {
  if (Array.isArray(result.entries)) return result.entries;
  if (Array.isArray(result.participants)) return result.participants;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

function getEntryId(entry: EntryListItem) {
  return firstText(entry.entryId, entry.entry_id, entry.id);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchEntries() {
  const response = await fetch(`${API_BASE}/api/entries?strictTs=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) return [];
  const result = await response.json().catch(() => ({})) as EntryListResult;
  return normalizeEntryList(result);
}

async function strictConfirmEntryId(entryId: string) {
  const delays = [0, 400, 1000, 1800];
  for (const delay of delays) {
    if (delay) await wait(delay);
    const entries = await fetchEntries();
    if (entries.some((entry) => getEntryId(entry) === entryId)) return true;
  }
  return false;
}

function findStatusElement(button: HTMLButtonElement | null) {
  return button?.parentElement?.querySelector<HTMLElement>('.entry-submit-status') || null;
}

function markStrictVerificationFailed(entryId: string, teamName: string) {
  const button = document.querySelector<HTMLButtonElement>('.lock-button');
  const status = findStatusElement(button);

  if (status) {
    status.textContent = `${teamName || 'このチーム'} は保存API応答後、参加チーム一覧APIで entryId=${entryId} を確認できませんでした。エントリー完了扱いにしません。`;
    status.dataset.status = 'error';
    status.style.margin = '8px 0 0';
    status.style.fontWeight = '700';
  }

  if (button) {
    button.disabled = false;
    button.dataset.entryAction = 'entry';
    button.classList.remove('create-another-team-button');
    button.textContent = 'チームを確定';
  }
}

function isEntrySubmitClick(button: HTMLButtonElement) {
  const label = button.textContent?.trim() || '';
  if (label.includes('別チームを作る') || label.includes('取り消')) return false;
  return label.includes('チームを確定') || label.includes('エントリー');
}

export function initStrictEntryVerification() {
  if (isInitialized) return;
  isInitialized = true;

  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.lock-button');
    if (!button || !isEntrySubmitClick(button)) return;
    lastEntrySubmitStartedAt = Date.now();
  }, true);

  window.addEventListener('nihon-kabu-eleven:entry-saved', (event) => {
    const detail = (event as CustomEvent<EntrySavedEventDetail>).detail || {};
    const entryId = firstText(detail.entryId);
    const teamName = firstText(detail.teamName);
    const submitStartedAt = lastEntrySubmitStartedAt;

    if (!entryId) return;

    window.setTimeout(() => {
      void (async () => {
        const visible = await strictConfirmEntryId(entryId);
        if (!visible && submitStartedAt > 0) {
          markStrictVerificationFailed(entryId, teamName);
        }
      })();
    }, 0);
  });
}
