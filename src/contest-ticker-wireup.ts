type TickerItem = {
  label: string;
  labelClass: 'entry' | 'live';
  text: string;
};

let isInitialized = false;

function textOf(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() || '';
}

function normalizeDateText(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^締切\s*/, '').trim();
}

function buildTickerItems(): TickerItem[] {
  const tournamentName = textOf('.match-kicker') || '日本株代表カップ';
  const subline = Array.from(document.querySelectorAll<HTMLElement>('.header-subline span')).map((node) => node.textContent?.trim() || '');
  const duration = subline.find((value) => value.includes('リーグ'))?.replace('🏆', '').trim() || '3か月リーグ';
  const resultDate = subline.find((value) => value.includes('結果発表'))?.replace('📅', '').trim() || '結果発表：2026/09/11';
  const chip = textOf('.team-chip');
  const visibility = chip.split('｜').at(-1)?.trim() || '限定公開';
  const stripItems = Array.from(document.querySelectorAll<HTMLElement>('.match-strip div'));
  const deadline = stripItems
    .find((item) => item.querySelector('span')?.textContent?.includes('締切'))
    ?.querySelector('strong')?.textContent?.trim();
  const deadlineText = normalizeDateText(deadline || '2026/09/11');

  return [
    {
      label: '現在募集中',
      labelClass: 'entry',
      text: `${tournamentName}｜${duration}｜締切 ${deadlineText}｜${visibility}`,
    },
    {
      label: '開催中',
      labelClass: 'live',
      text: `${tournamentName}｜${resultDate}｜日次終値ベースで勝負`,
    },
  ];
}

function createTickerElement(items: TickerItem[]) {
  const section = document.createElement('section');
  section.className = 'contest-ticker';
  section.setAttribute('aria-label', '現在募集中・開催中の大会');

  const inner = document.createElement('div');
  inner.className = 'contest-ticker__inner';

  const head = document.createElement('div');
  head.className = 'contest-ticker__head';
  head.innerHTML = '<span>JPX MATCH BOARD</span><strong>大会速報</strong>';

  const viewport = document.createElement('div');
  viewport.className = 'contest-ticker__viewport';

  const track = document.createElement('div');
  track.className = 'contest-ticker__track';

  const renderItems = [...items, ...items, ...items];
  renderItems.forEach((item, index) => {
    const row = document.createElement('span');
    row.className = 'contest-ticker__item';
    row.innerHTML = `<b class="contest-ticker__label contest-ticker__label--${item.labelClass}">${item.label}</b><span>${item.text}</span>`;
    row.setAttribute('aria-hidden', index >= items.length ? 'true' : 'false');
    track.appendChild(row);
  });

  viewport.appendChild(track);
  inner.append(head, viewport);
  section.appendChild(inner);
  return section;
}

function mountTicker() {
  const header = document.querySelector<HTMLElement>('.match-header');
  if (!header || document.querySelector('.contest-ticker')) return;

  const ticker = createTickerElement(buildTickerItems());
  header.insertAdjacentElement('afterend', ticker);
}

export function initContestTicker() {
  if (isInitialized) return;
  isInitialized = true;

  const observer = new MutationObserver(mountTicker);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(mountTicker, 0);
}
