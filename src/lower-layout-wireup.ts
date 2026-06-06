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
    ['FW', 'MF', 'DF', 'GK'].forEach((label) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = label;
      chip.disabled = true;
      chip.className = label === position ? 'selected active-position' : 'position-option';
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

function applyLowerLayout(): void {
  const main = document.querySelector('.main') as HTMLElement | null;
  const marketData = document.querySelector('.market-data-card') as HTMLElement | null;
  const stockList = document.querySelector('.stock-list-card:not([data-generated-bench-card="true"])') as HTMLElement | null;
  if (!main || !marketData || !stockList) return;

  const title = stockList.querySelector('h3');
  const isSearchMode = title?.textContent?.includes('検索結果') || false;

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
  applyLowerLayout();
  window.setInterval(applyLowerLayout, 500);
}
