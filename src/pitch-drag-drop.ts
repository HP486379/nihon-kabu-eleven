type PitchPosition = 'FW' | 'MF' | 'DF' | 'GK';

const ROW_TO_POSITION: Record<string, PitchPosition> = {
  'row-fw': 'FW',
  'row-mf': 'MF',
  'row-df': 'DF',
  'row-gk': 'GK',
};

let activeCode: string | null = null;
let activePosition: PitchPosition | null = null;
let isInitialized = false;

function findPositionFromRow(row: Element | null): PitchPosition | null {
  if (!row) return null;
  const match = Object.keys(ROW_TO_POSITION).find((className) => row.classList.contains(className));
  return match ? ROW_TO_POSITION[match] : null;
}

function findStockCardByCode(code: string): HTMLElement | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.stock-item'));
  return cards.find((card) => {
    const text = card.textContent || '';
    return text.includes(code);
  }) || null;
}

function getPlayerCode(card: Element | null): string | null {
  return card?.querySelector('small')?.textContent?.trim() || null;
}

function getRowCodes(row: Element | null) {
  if (!row) return [];
  return Array.from(row.querySelectorAll<HTMLElement>('.player-card'))
    .map((card) => getPlayerCode(card))
    .filter((code): code is string => Boolean(code));
}

function findCurrentPositionByCode(code: string): PitchPosition | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.pitch-row'));
  const row = rows.find((candidate) => getRowCodes(candidate).includes(code));
  return findPositionFromRow(row || null);
}

function findMarketRowByCode(code: string): HTMLElement | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.market-table-row'));
  return rows.find((row) => (row.textContent || '').includes(code)) || null;
}

function findRemoveButtonByCode(code: string): HTMLButtonElement | null {
  const row = findMarketRowByCode(code);
  const buttons = Array.from(row?.querySelectorAll<HTMLButtonElement>('button') || []);
  return buttons.find((button) => button.textContent?.trim() === '外す' && !button.disabled) || null;
}

function findSelectButtonByCode(code: string): HTMLButtonElement | null {
  const stockCard = findStockCardByCode(code);
  const button = stockCard?.querySelector<HTMLButtonElement>('.stock-item-head > button');
  if (!button || button.disabled) return null;
  const label = button.textContent?.trim() || '';
  return label === '選抜' || label === '候補追加' || label === '検索して追加' ? button : button;
}

function clickPositionButton(code: string, position: PitchPosition) {
  const stockCard = findStockCardByCode(code);
  if (!stockCard) return false;

  const buttons = Array.from(stockCard.querySelectorAll<HTMLButtonElement>('.position-buttons button'));
  const target = buttons.find((button) => button.textContent?.trim() === position);
  if (!target || target.disabled) return false;

  target.click();
  return true;
}

function wait(ms = 80) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function swapIntoFullPosition(code: string, targetRow: HTMLElement, targetPosition: PitchPosition) {
  const sourcePosition = activePosition || findCurrentPositionByCode(code);
  if (!sourcePosition || sourcePosition === targetPosition) return false;

  const swapCode = getRowCodes(targetRow).find((candidate) => candidate !== code);
  if (!swapCode) return false;

  const removeButton = findRemoveButtonByCode(code);
  if (!removeButton) return false;

  removeButton.click();
  await wait();

  const movedSwapTarget = clickPositionButton(swapCode, sourcePosition);
  if (!movedSwapTarget) {
    const restoreButton = findSelectButtonByCode(code);
    restoreButton?.click();
    await wait();
    return false;
  }

  await wait();

  const restoreButton = findSelectButtonByCode(code);
  if (!restoreButton) return false;
  restoreButton.click();
  await wait();

  const finalPosition = findCurrentPositionByCode(code);
  if (finalPosition === targetPosition) return true;

  return clickPositionButton(code, targetPosition);
}

async function moveOrSwap(code: string, targetRow: HTMLElement, targetPosition: PitchPosition) {
  const moved = clickPositionButton(code, targetPosition);
  if (moved) return true;

  const swapped = await swapIntoFullPosition(code, targetRow, targetPosition);
  if (swapped) {
    targetRow.classList.add('drop-swapped-row');
    window.setTimeout(() => targetRow.classList.remove('drop-swapped-row'), 550);
    return true;
  }

  return false;
}

function makePlayerCardsDraggable() {
  document.querySelectorAll<HTMLElement>('.player-card').forEach((card) => {
    if (card.dataset.dragReady === 'true') return;
    const code = getPlayerCode(card);
    if (!code) return;

    card.dataset.dragReady = 'true';
    card.draggable = true;
    card.setAttribute('title', 'ドラッグしてFW/MF/DF/GKへ移動。満員なら入れ替えます');

    card.addEventListener('dragstart', (event) => {
      activeCode = code;
      activePosition = findPositionFromRow(card.closest('.pitch-row'));
      card.classList.add('dragging-player-card');
      event.dataTransfer?.setData('text/plain', code);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      activeCode = null;
      activePosition = null;
      card.classList.remove('dragging-player-card');
      document.querySelectorAll('.pitch-row.drag-over-row').forEach((row) => row.classList.remove('drag-over-row'));
    });
  });
}

function setupPitchRows() {
  document.querySelectorAll<HTMLElement>('.pitch-row').forEach((row) => {
    if (row.dataset.dropReady === 'true') return;
    row.dataset.dropReady = 'true';

    row.addEventListener('dragover', (event) => {
      const position = findPositionFromRow(row);
      if (!position || !activeCode) return;
      event.preventDefault();
      row.classList.add('drag-over-row');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-row');
    });

    row.addEventListener('drop', (event) => {
      event.preventDefault();
      row.classList.remove('drag-over-row');
      const position = findPositionFromRow(row);
      const code = activeCode || event.dataTransfer?.getData('text/plain');
      if (!position || !code) return;

      void moveOrSwap(code, row, position).then((moved) => {
        if (!moved) {
          row.classList.add('drop-rejected-row');
          window.setTimeout(() => row.classList.remove('drop-rejected-row'), 450);
        }
      });
    });
  });
}

function refreshDragAndDrop() {
  makePlayerCardsDraggable();
  setupPitchRows();
}

export function initPitchDragDrop() {
  if (isInitialized) return;
  isInitialized = true;

  const observer = new MutationObserver(refreshDragAndDrop);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(refreshDragAndDrop, 0);
}
