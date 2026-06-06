type Position = 'FW' | 'MF' | 'DF' | 'GK';

const POSITIONS: Position[] = ['FW', 'MF', 'DF', 'GK'];
let bypassPositionClick = false;

function getStockCodeFromCard(card: HTMLElement): string | null {
  const smallText = card.querySelector('small')?.textContent || '';
  return smallText.split('/')[0]?.trim() || null;
}

function getActivePosition(card: HTMLElement): Position | null {
  const active = card.querySelector<HTMLButtonElement>('.position-buttons button.active-position, .position-buttons button.selected, .position-buttons button[aria-pressed="true"]');
  const text = active?.textContent?.trim();
  return POSITIONS.includes(text as Position) ? text as Position : null;
}

function getActualStockCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.stock-list-card:not([data-generated-bench-card="true"]) .stock-item'));
}

function findActualStockCard(code: string): HTMLElement | null {
  return getActualStockCards().find((card) => getStockCodeFromCard(card) === code) || null;
}

function findActualChosenCardByPosition(position: Position, excludeCode?: string): HTMLElement | null {
  return getActualStockCards().find((card) => {
    const code = getStockCodeFromCard(card);
    return card.classList.contains('chosen') && code !== excludeCode && getActivePosition(card) === position;
  }) || null;
}

function clickThroughReact(button: HTMLButtonElement | null | undefined): boolean {
  if (!button) return false;
  bypassPositionClick = true;
  button.disabled = false;
  button.removeAttribute('disabled');
  button.click();
  window.setTimeout(() => {
    bypassPositionClick = false;
  }, 0);
  return true;
}

function unlockPositionButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('.stock-item.chosen .position-buttons button').forEach((button) => {
    button.disabled = false;
    button.removeAttribute('disabled');
    if (!button.title || button.title.includes('上限')) {
      button.title = 'クリックで配置変更します。満員のポジションは自動で入れ替えます。';
    }
  });
}

function handlePositionButtonClick(event: MouseEvent): void {
  if (bypassPositionClick) return;

  const target = event.target as Element | null;
  const button = target?.closest<HTMLButtonElement>('.stock-item .position-buttons button');
  const card = button?.closest<HTMLElement>('.stock-item');
  if (!button || !card || !card.classList.contains('chosen')) return;

  const code = getStockCodeFromCard(card);
  const currentPosition = getActivePosition(card);
  const nextPositionText = button.textContent?.trim();
  const nextPosition = POSITIONS.includes(nextPositionText as Position) ? nextPositionText as Position : null;

  if (!code || !currentPosition || !nextPosition || currentPosition === nextPosition) return;

  const actualCard = findActualStockCard(code);
  const actualPositionButton = actualCard
    ? Array.from(actualCard.querySelectorAll<HTMLButtonElement>('.position-buttons button')).find((item) => item.textContent?.trim() === nextPosition)
    : null;

  if (!actualCard || !actualPositionButton) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const occupiedTargetCard = findActualChosenCardByPosition(nextPosition, code);
  if (!occupiedTargetCard) {
    clickThroughReact(actualPositionButton);
    return;
  }

  const swapCode = getStockCodeFromCard(occupiedTargetCard);
  const removeSwapButton = occupiedTargetCard.querySelector<HTMLButtonElement>('.stock-item-head > button');
  if (!swapCode || !removeSwapButton) return;

  clickThroughReact(removeSwapButton);

  window.setTimeout(() => {
    const refreshedCard = findActualStockCard(code);
    const refreshedPositionButton = refreshedCard
      ? Array.from(refreshedCard.querySelectorAll<HTMLButtonElement>('.position-buttons button')).find((item) => item.textContent?.trim() === nextPosition)
      : null;
    clickThroughReact(refreshedPositionButton);

    window.setTimeout(() => {
      const swapCard = findActualStockCard(swapCode);
      const reselectSwapButton = swapCard?.querySelector<HTMLButtonElement>('.stock-item-head > button');
      clickThroughReact(reselectSwapButton);
    }, 160);
  }, 160);
}

function makeBenchCard(positionStatus: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'card stock-list-card generated-bench-card';
  card.setAttribute('data-generated-bench-card', 'true');

  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';

  const title = document.createElement('h3');
  title.textContent = 'ベンチ入りメンバー（日本株代表候補リスト）';

  const status = document.createElement('div');
  status.className = 'position-status';
  status.textContent = positionStatus;

  titleRow.append(title, status);

  const grid = document.createElement('div');
  grid.className = 'stock-grid generated-bench-grid';

  const rows = Array.from(document.querySelectorAll('.market-table-row')) as HTMLElement[];
  rows.forEach((row) => {
    const item = document.createElement('article');
    item.className = 'stock-item chosen generated-bench-item';

    const name = row.querySelector('strong')?.textContent?.trim() || '選抜メンバー';
    const codeAndPosition = row.querySelector('small')?.textContent?.trim() || '';
    const position = codeAndPosition.split('/')[1]?.trim() || '';

    const head = document.createElement('div');
    head.className = 'stock-item-head';

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.textContent = '選抜中';
    badge.disabled = true;

    const nameBox = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = name;
    const small = document.createElement('small');
    small.textContent = codeAndPosition;
    nameBox.append(strong, small);
    head.append(badge, nameBox);

    const description = document.createElement('p');
    description.textContent = '検索中も表示する選抜済みメンバー';

    const positions = document.createElement('div');
    positions.className = 'position-buttons';
    POSITIONS.forEach((label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = label;
      chip.className = label === position ? 'selected active-position' : 'position-option';
      chip.title = '検索中は、同じ銘柄が検索結果に表示されている場合のみ配置変更できます。';
      positions.appendChild(chip);
    });

    item.append(head, description, positions);
    grid.appendChild(item);
  });

  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'helper-text';
    empty.textContent = '選抜メンバーはまだありません。';
    grid.appendChild(empty);
  }

  card.append(titleRow, grid);
  return card;
}

function removeGeneratedBenchCard(): void {
  document.querySelector('[data-generated-bench-card="true"]')?.remove();
}

function initMarketDataToggle(): void {
  const marketData = document.querySelector('.market-data-card') as HTMLElement | null;
  const titleRow = marketData?.querySelector('.card-title-row') as HTMLElement | null;
  if (!marketData || !titleRow || marketData.dataset.marketToggleReady === 'true') return;

  marketData.dataset.marketToggleReady = 'true';
  marketData.classList.remove('is-market-expanded');
  titleRow.setAttribute('role', 'button');
  titleRow.setAttribute('tabindex', '0');
  titleRow.setAttribute('title', 'クリックで実データ一覧を開閉します');
  titleRow.addEventListener('click', () => {
    marketData.classList.toggle('is-market-expanded');
  });
  titleRow.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    marketData.classList.toggle('is-market-expanded');
  });
}

function applyLowerLayout(): void {
  const main = document.querySelector('.main') as HTMLElement | null;
  const marketData = document.querySelector('.market-data-card') as HTMLElement | null;
  const stockList = document.querySelector('.stock-list-card:not([data-generated-bench-card="true"])') as HTMLElement | null;
  if (!main || !marketData || !stockList) return;

  const title = stockList.querySelector('h3');
  const isSearchMode = title?.textContent?.includes('検索結果') || false;

  initMarketDataToggle();
  unlockPositionButtons();

  if (isSearchMode) {
    const positionStatus = stockList.querySelector('.position-status')?.textContent || '';
    removeGeneratedBenchCard();
    const bench = makeBenchCard(positionStatus);
    main.insertBefore(bench, marketData);
    main.insertBefore(marketData, stockList);
    return;
  }

  removeGeneratedBenchCard();
  if (title) title.textContent = 'ベンチ入りメンバー（日本株代表候補リスト）';
  main.insertBefore(stockList, marketData);
}

export function initLowerLayoutWireup(): void {
  document.addEventListener('click', handlePositionButtonClick, true);
  applyLowerLayout();
  window.setInterval(applyLowerLayout, 500);
}
