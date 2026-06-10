export const LOCAL_SUBMITTED_ENTRIES_KEY = 'nihon-kabu-eleven:submitted-participants';

export function clearLocalSubmittedEntries() {
  try {
    window.localStorage.removeItem(LOCAL_SUBMITTED_ENTRIES_KEY);
  } catch (_error) {
    // localStorage cleanup is best-effort only.
  }
}
