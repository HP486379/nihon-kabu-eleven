type PitchPosition = 'FW' | 'MF' | 'DF' | 'GK';

const ROW_TO_POSITION: Record<string, PitchPosition> = {
  'row-fw': 'FW',
  'row-mf': 'MF',
  'row-df': 'DF',
  'row-gk': 'GK',
};

let activeCode: string | null = null;
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

function clickPositionButton(code: string, position: PitchPosition) {
  const stockCard = findStockCardByCode(code);
  if (!stockCard) return false;

  const buttons = Array.from(stockCard.querySelectorAll<HTMLButtonElement>('.position-buttons button'));
  const target = buttons.find((button) => button.textContent?.trim() === position);
  if (!target || target.disabled) return false;

  target.click();
  return true;
}

function makePlayerCardsDraggable() {
  document.querySelectorAll<HTMLElement>('.player-card').forEach((card) => {
    if (card.dataset.dragReady === 'true') return;
    const code = card.querySelector('small')?.textContent?.trim();
    if (!code) return;

    card.dataset.dragReady = 'true';
    card.draggable = true;
    card.setAttribute('title', 'ドラッグしてFW/MF/DF/GKへ移動');

    card.addEventListener('dragstart', (event) => {
      activeCode = code;
      card.classList.add('dragging-player-card');
      event.dataTransfer?.setData('text/plain', code);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      activeCode = null;
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

      const moved = clickPositionButton(code, position);
      if (!moved) {
        row.classList.add('drop-rejected-row');
        window.setTimeout(() => row.classList.remove('drop-rejected-row'), 450);
      }
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
