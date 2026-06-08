type Position = 'FW' | 'MF' | 'DF' | 'GK';

type FormationForEntry = {
  key: string;
  counts: Record<Position, number>;
  weights: Record<Position, number>;
};

type SelectedEntryStock = {
  code: string;
  name: string;
  market: string;
  position?: Position;
};

export type EntryMemberPayload = {
  stockCode: string;
  stockName: string;
  market: string;
  position: Position;
  slotOrder: number;
  weight: number;
};

export type EntryPayload = {
  contestId: string;
  teamName: string;
  formation: string;
  members: EntryMemberPayload[];
};

export type SubmitEntryResult = {
  ok?: boolean;
  status?: string;
  entryId?: string;
  message?: string;
  error?: string;
  details?: string | null;
};

export type CancelEntryResult = {
  ok?: boolean;
  status?: string;
  entry?: unknown;
  message?: string;
  error?: string;
  details?: string | null;
};

export const DEV_CONTEST_ID = '5345b8eb-e9ec-4b4b-9549-35b3c4135003';

const API_BASE = ((import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || 'http://localhost:3001').replace(/\/$/, '');

function getMemberWeight(formation: FormationForEntry, position: Position) {
  const count = formation.counts[position];
  if (!count) return 0;
  return formation.weights[position] / count;
}

async function parseApiResponse<T>(response: Response, fallbackLabel: string): Promise<T> {
  const result = await response.json().catch(() => ({})) as T & { ok?: boolean; message?: string; error?: string; details?: string | null; errors?: string[] };

  if (!response.ok || result.ok === false) {
    const detailText = Array.isArray(result.errors)
      ? result.errors.join(' / ')
      : typeof result.details === 'string'
        ? result.details
        : '';
    const baseMessage = result.message || result.error || `${fallbackLabel} ${response.status}`;
    const message = detailText ? `${baseMessage}: ${detailText}` : baseMessage;
    throw new Error(message);
  }

  return result;
}

export function buildEntryPayload({
  contestId = DEV_CONTEST_ID,
  teamName,
  formation,
  selected,
}: {
  contestId?: string;
  teamName: string;
  formation: FormationForEntry;
  selected: SelectedEntryStock[];
}): EntryPayload {
  return {
    contestId,
    teamName,
    formation: formation.key,
    members: selected.map((stock, index) => {
      const position = stock.position || 'MF';
      return {
        stockCode: stock.code,
        stockName: stock.name,
        market: stock.market,
        position,
        slotOrder: index + 1,
        weight: getMemberWeight(formation, position),
      };
    }),
  };
}

export async function submitEntry(payload: EntryPayload): Promise<SubmitEntryResult> {
  const response = await fetch(`${API_BASE}/api/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<SubmitEntryResult>(response, 'entries api');
}

export async function cancelEntry(contestId = DEV_CONTEST_ID): Promise<CancelEntryResult> {
  const response = await fetch(`${API_BASE}/api/entries/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contestId }),
  });

  return parseApiResponse<CancelEntryResult>(response, 'entries cancel api');
}
