const SHOGI_FRONTLINE_ICON_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#321b06"/>
      <stop offset="1" stop-color="#0b0618"/>
    </linearGradient>
    <linearGradient id="piece" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#ffe5a8"/>
      <stop offset="1" stop-color="#d0912d"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <path d="M32 7l22 11v31L32 60 10 49V18L32 7z" fill="#08040d" stroke="#ffcf65" stroke-width="3"/>
  <path d="M32 14l14 8-4 27H22l-4-27 14-8z" fill="url(#piece)" stroke="#fff1bd" stroke-width="2"/>
  <text x="32" y="40" text-anchor="middle" font-size="26" font-weight="900" font-family="serif" fill="#1b0f05">将</text>
  <path d="M14 50h36" stroke="#ff4470" stroke-width="3" stroke-linecap="round" opacity=".85"/>
</svg>
`)}`;

type TickerItem = {
  label: string;
  labelClass: 'entry' | 'live' | 'ad';
  text: string;
  iconSrc?: string;
  iconAlt?: string;
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
  const visibility = chip.split('｜').at(-1)?.trim() || 'W杯日本初戦記念 β公開';
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
    {
      label: '広告',
      labelClass: 'ad',
      iconSrc: 'https://time-to-sell-web-2.vercel.app/assets/icon.png',
      iconAlt: '売り時くん',
      text: '売り時くん｜インデックス投資の売り時をゆるく見える化',
    },
    {
      label: '広告',
      labelClass: 'ad',
      iconSrc: SHOGI_FRONTLINE_ICON_SRC,
      iconAlt: '将棋戦線',
      text: '将棋戦線｜完全無料で遊べる戦略ボードゲーム',
    },
  ];
}

function createTickerElement(items: TickerItem[]) {
  const section = document.createElement('section');
  section.className = 'contest-ticker';
  section.setAttribute('aria-label', '現在募集中・開催中の大会と関連アプリ情報');

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

    const label = document.createElement('b');
    label.className = `contest-ticker__label contest-ticker__label--${item.labelClass}`;
    label.textContent = item.label;
    row.appendChild(label);

    if (item.iconSrc) {
      const icon = document.createElement('img');
      icon.className = 'contest-ticker__icon';
      icon.src = item.iconSrc;
      icon.alt = item.iconAlt || '';
      icon.loading = 'lazy';
      icon.decoding = 'async';
      icon.addEventListener('error', () => icon.remove());
      row.appendChild(icon);
    }

    const text = document.createElement('span');
    text.textContent = item.text;
    row.appendChild(text);
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
