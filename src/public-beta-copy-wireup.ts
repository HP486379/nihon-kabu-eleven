const PUBLIC_BETA_LABEL = 'W杯日本初戦記念 β公開';
const RESULTS_AUTO_TEXT = '結果は大会終了後に自動集計されます';

function replaceTextContent(element: HTMLElement, from: string, to: string) {
  if (element.childElementCount > 0) return;
  if (!element.textContent?.includes(from)) return;
  element.textContent = element.textContent.replace(from, to);
}

function replaceBetaCopy() {
  document.querySelectorAll<HTMLElement>('*').forEach((element) => {
    replaceTextContent(element, '限定公開', PUBLIC_BETA_LABEL);
    replaceTextContent(element, '集計実行は管理者/開発環境のみ', RESULTS_AUTO_TEXT);
    replaceTextContent(element, '集計実行は管理者/開発環境でのみ利用できます。', RESULTS_AUTO_TEXT);
    replaceTextContent(element, '通常公開画面では集計実行は無効です。結果表示のみ行います。', 'β公開中は結果表示のみ行います。集計は運営側で実施します。');
    replaceTextContent(element, '集計結果が空の場合は「集計を実行」を押してください。', '集計結果が空の場合は、運営側の集計後に表示されます。');
  });
}

function ensureBetaHeaderBadge() {
  const headerMain = document.querySelector<HTMLElement>('.page-header .header-main');
  if (!headerMain || headerMain.querySelector('.public-beta-badge')) return;

  const badge = document.createElement('div');
  badge.className = 'team-chip public-beta-badge';
  badge.textContent = '⚽ W杯日本初戦記念 β公開中';
  headerMain.appendChild(badge);
}

function applyPublicBetaCopy() {
  replaceBetaCopy();
  ensureBetaHeaderBadge();
}

export function initPublicBetaCopyWireup() {
  applyPublicBetaCopy();

  const observer = new MutationObserver(() => applyPublicBetaCopy());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
