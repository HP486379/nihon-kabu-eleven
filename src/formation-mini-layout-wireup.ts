type MiniDotLayout = {
  position: 'FW' | 'MF' | 'DF' | 'GK';
  left: number;
  top: number;
};

let isInitialized = false;

const MINI_LAYOUTS: Record<string, MiniDotLayout[]> = {
  '4-3-3': [
    { position: 'FW', left: 30, top: 22 },
    { position: 'FW', left: 50, top: 22 },
    { position: 'FW', left: 70, top: 22 },
    { position: 'MF', left: 30, top: 48 },
    { position: 'MF', left: 50, top: 48 },
    { position: 'MF', left: 70, top: 48 },
    { position: 'DF', left: 23, top: 74 },
    { position: 'DF', left: 41, top: 74 },
    { position: 'DF', left: 59, top: 74 },
    { position: 'DF', left: 77, top: 74 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '4-2-3-1': [
    { position: 'FW', left: 50, top: 21 },
    { position: 'MF', left: 28, top: 41 },
    { position: 'MF', left: 50, top: 41 },
    { position: 'MF', left: 72, top: 41 },
    { position: 'MF', left: 38, top: 58 },
    { position: 'MF', left: 62, top: 58 },
    { position: 'DF', left: 23, top: 75 },
    { position: 'DF', left: 41, top: 75 },
    { position: 'DF', left: 59, top: 75 },
    { position: 'DF', left: 77, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '4-4-2': [
    { position: 'FW', left: 38, top: 22 },
    { position: 'FW', left: 62, top: 22 },
    { position: 'MF', left: 23, top: 48 },
    { position: 'MF', left: 41, top: 48 },
    { position: 'MF', left: 59, top: 48 },
    { position: 'MF', left: 77, top: 48 },
    { position: 'DF', left: 23, top: 75 },
    { position: 'DF', left: 41, top: 75 },
    { position: 'DF', left: 59, top: 75 },
    { position: 'DF', left: 77, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '3-5-2': [
    { position: 'FW', left: 38, top: 22 },
    { position: 'FW', left: 62, top: 22 },
    { position: 'MF', left: 24, top: 42 },
    { position: 'MF', left: 50, top: 42 },
    { position: 'MF', left: 76, top: 42 },
    { position: 'MF', left: 38, top: 58 },
    { position: 'MF', left: 62, top: 58 },
    { position: 'DF', left: 30, top: 75 },
    { position: 'DF', left: 50, top: 75 },
    { position: 'DF', left: 70, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '3-4-3': [
    { position: 'FW', left: 30, top: 22 },
    { position: 'FW', left: 50, top: 22 },
    { position: 'FW', left: 70, top: 22 },
    { position: 'MF', left: 23, top: 48 },
    { position: 'MF', left: 41, top: 48 },
    { position: 'MF', left: 59, top: 48 },
    { position: 'MF', left: 77, top: 48 },
    { position: 'DF', left: 30, top: 75 },
    { position: 'DF', left: 50, top: 75 },
    { position: 'DF', left: 70, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '5-3-2': [
    { position: 'FW', left: 38, top: 22 },
    { position: 'FW', left: 62, top: 22 },
    { position: 'MF', left: 30, top: 48 },
    { position: 'MF', left: 50, top: 48 },
    { position: 'MF', left: 70, top: 48 },
    { position: 'DF', left: 18, top: 75 },
    { position: 'DF', left: 34, top: 75 },
    { position: 'DF', left: 50, top: 75 },
    { position: 'DF', left: 66, top: 75 },
    { position: 'DF', left: 82, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '3-4-2-1': [
    { position: 'FW', left: 50, top: 21 },
    { position: 'MF', left: 38, top: 39 },
    { position: 'MF', left: 62, top: 39 },
    { position: 'MF', left: 23, top: 56 },
    { position: 'MF', left: 41, top: 56 },
    { position: 'MF', left: 59, top: 56 },
    { position: 'MF', left: 77, top: 56 },
    { position: 'DF', left: 30, top: 75 },
    { position: 'DF', left: 50, top: 75 },
    { position: 'DF', left: 70, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
  '5-4-1': [
    { position: 'FW', left: 50, top: 22 },
    { position: 'MF', left: 23, top: 48 },
    { position: 'MF', left: 41, top: 48 },
    { position: 'MF', left: 59, top: 48 },
    { position: 'MF', left: 77, top: 48 },
    { position: 'DF', left: 18, top: 75 },
    { position: 'DF', left: 34, top: 75 },
    { position: 'DF', left: 50, top: 75 },
    { position: 'DF', left: 66, top: 75 },
    { position: 'DF', left: 82, top: 75 },
    { position: 'GK', left: 50, top: 89 },
  ],
};

function getFormationKey() {
  return document.querySelector<HTMLElement>('.formation-number')?.textContent?.trim() || '';
}

function applyMiniLayout() {
  const pitch = document.querySelector<HTMLElement>('.formation-card .formation-mini-pitch');
  if (!pitch) return;

  const layout = MINI_LAYOUTS[getFormationKey()];
  if (!layout) return;

  const dots = Array.from(pitch.querySelectorAll<HTMLElement>('.formation-mini-dot'));
  if (dots.length !== layout.length) return;

  dots.forEach((dot, index) => {
    const item = layout[index];
    dot.className = `formation-mini-dot dot-${item.position.toLowerCase()}`;
    dot.style.left = `${item.left}%`;
    dot.style.top = `${item.top}%`;
    dot.title = item.position;
  });
}

export function initFormationMiniLayout() {
  if (isInitialized) return;
  isInitialized = true;

  const observer = new MutationObserver(applyMiniLayout);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setTimeout(applyMiniLayout, 0);
}
