type Position = 'FW' | 'MF' | 'DF' | 'GK';
type AutoMode = 'attack' | 'balance' | 'defense' | 'random';

type AutoCandidate = {
  code: string;
  fit: Record<Position, number>;
  change: number;
  contribution: number;
  tags: string[];
};

const POSITIONS: Position[] = ['FW', 'MF', 'DF', 'GK'];

const AUTO_CANDIDATES: AutoCandidate[] = [
  { code: '285A', change: 10.1, contribution: 2.63, fit: { FW: 98, MF: 76, DF: 42, GK: 34 }, tags: ['半導体メモリ', 'IPO', '高ボラ'] },
  { code: '9984', change: 14.0, contribution: 2.20, fit: { FW: 97, MF: 68, DF: 36, GK: 30 }, tags: ['AI', '投資会社', '攻撃'] },
  { code: '6981', change: 8.9, contribution: 1.45, fit: { FW: 82, MF: 89, DF: 70, GK: 66 }, tags: ['電子部品', 'スマホ', '中盤'] },
  { code: '6976', change: 8.4, contribution: 1.32, fit: { FW: 85, MF: 78, DF: 55, GK: 48 }, tags: ['電子部品', '景気敏感', '攻撃'] },
  { code: '5803', change: -2.0, contribution: 1.08, fit: { FW: 91, MF: 76, DF: 54, GK: 48 }, tags: ['電線', 'データセンター', 'テーマ'] },
  { code: '4062', change: -5.2, contribution: 0.96, fit: { FW: 88, MF: 74, DF: 50, GK: 44 }, tags: ['半導体基板', 'AIサーバー', '攻撃'] },
  { code: '5801', change: 0.1, contribution: 0.88, fit: { FW: 80, MF: 78, DF: 66, GK: 58 }, tags: ['電線', 'インフラ', 'テーマ'] },
  { code: '6857', change: -1.9, contribution: 1.48, fit: { FW: 97, MF: 74, DF: 41, GK: 35 }, tags: ['半導体検査', 'AI', '攻撃'] },
  { code: '8035', change: 1.2, contribution: 1.42, fit: { FW: 96, MF: 80, DF: 48, GK: 42 }, tags: ['半導体製造装置', '大型株', '攻撃'] },
  { code: '6762', change: -0.1, contribution: 0.88, fit: { FW: 78, MF: 88, DF: 72, GK: 68 }, tags: ['電子部品', '電池', 'バランス'] },
  { code: '7203', change: -4.5, contribution: 1.05, fit: { FW: 74, MF: 90, DF: 82, GK: 73 }, tags: ['自動車', '大型株', '主軸'] },
  { code: '7011', change: -4.5, contribution: 1.12, fit: { FW: 82, MF: 84, DF: 78, GK: 66 }, tags: ['防衛', '重工', 'テーマ'] },
  { code: '8306', change: 0.8, contribution: 0.96, fit: { FW: 61, MF: 88, DF: 84, GK: 72 }, tags: ['銀行', '金利', '配当'] },
  { code: '5802', change: 4.7, contribution: 0.94, fit: { FW: 70, MF: 83, DF: 78, GK: 68 }, tags: ['電線', '自動車部品', '守備'] },
  { code: '5706', change: 4.3, contribution: 0.88, fit: { FW: 76, MF: 78, DF: 70, GK: 62 }, tags: ['非鉄金属', '素材', 'テーマ'] },
  { code: '3436', change: 9.5, contribution: 1.04, fit: { FW: 86, MF: 72, DF: 46, GK: 40 }, tags: ['シリコンウエハ', '半導体', '景気敏感'] },
  { code: '6920', change: -4.4, contribution: 1.02, fit: { FW: 96, MF: 66, DF: 35, GK: 30 }, tags: ['半導体検査', '高ボラ', '攻撃'] },
  { code: '6098', change: 3.1, contribution: 0.92, fit: { FW: 83, MF: 87, DF: 67, GK: 60 }, tags: ['人材', 'DX', '中盤'] },
  { code: '6146', change: -2.0, contribution: 1.00, fit: { FW: 94, MF: 78, DF: 46, GK: 42 }, tags: ['半導体装置', '高収益', '攻撃'] },
  { code: '4063', change: 0.5, contribution: 0.86, fit: { FW: 70, MF: 91, DF: 86, GK: 84 }, tags: ['素材', '高収益', '安定'] },
  { code: '9983', change: -2.2, contribution: 0.82, fit: { FW: 76, MF: 84, DF: 70, GK: 64 }, tags: ['小売', 'グローバル', '大型株'] },
  { code: '6758', change: 2.9, contribution: 0.92, fit: { FW: 89, MF: 84, DF: 63, GK: 55 }, tags: ['エンタメ', '半導体', 'ブランド'] },
  { code: '6501', change: -0.8, contribution: 0.90, fit: { FW: 78, MF: 88, DF: 82, GK: 72 }, tags: ['インフラ', 'DX', 'バランス'] },
  { code: '8316', change: 0.7, contribution: 0.82, fit: { FW: 58, MF: 86, DF: 86, GK: 74 }, tags: ['銀行', '金利', '守備'] },
  { code: '9432', change: 0.2, contribution: 0.56, fit: { FW: 45, MF: 78, DF: 92, GK: 88 }, tags: ['通信', '安定', '守備'] },
  { code: '9433', change: 0.4, contribution: 0.63, fit: { FW: 48, MF: 76, DF: 90, GK: 86 }, tags: ['通信', '配当', '安定'] },
  { code: '7741', change: 0.8, contribution: 0.76, fit: { FW: 72, MF: 86, DF: 90, GK: 94 }, tags: ['高収益', '医療', 'GK候補'] },
  { code: '7974', change: 1.1, contribution: 0.74, fit: { FW: 84, MF: 82, DF: 76, GK: 73 }, tags: ['IP', 'ゲーム', 'ブランド'] },
  { code: '6367', change: 0.7, contribution: 0.70, fit: { FW: 64, MF: 79, DF: 88, GK: 76 }, tags: ['空調', '世界展開', '守備'] },
  { code: '2782', change: 0.3, contribution: 0.50, fit: { FW: 50, MF: 68, DF: 80, GK: 72 }, tags: ['小売', '生活防衛', '安定'] },
  { code: '4816', change: 1.5, contribution: 0.64, fit: { FW: 87, MF: 75, DF: 58, GK: 50 }, tags: ['IP', 'アニメ', '成長'] },
  { code: '4478', change: 1.8, contribution: 0.58, fit: { FW: 89, MF: 67, DF: 35, GK: 30 }, tags: ['SaaS', 'グロース', '攻撃'] },
  { code: '9166', change: 2.1, contribution: 0.62, fit: { FW: 92, MF: 65, DF: 32, GK: 26 }, tags: ['エンタメ', 'M&A', '攻撃'] },
];

let initialized = false;
let running = false;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function modeLabel(mode: AutoMode) {
  if (mode === 'attack') return '攻撃型';
  if (mode === 'defense') return '守備型';
  if (mode === 'random') return 'ランダム';
  return 'バランス型';
}

function hasAnyTag(candidate: AutoCandidate, tags: string[]) {
  return candidate.tags.some((tag) => tags.some((key) => tag.includes(key)));
}

function scoreCandidate(candidate: AutoCandidate, position: Position, mode: AutoMode) {
  if (mode === 'random') return Math.random() * 100;

  const fit = candidate.fit[position];
  const averageFit = POSITIONS.reduce((sum, current) => sum + candidate.fit[current], 0) / POSITIONS.length;
  const positiveChange = Math.max(candidate.change, 0);
  const calmBonus = Math.max(0, 8 - Math.abs(candidate.change));
  const contribution = candidate.contribution * 8;

  if (mode === 'attack') {
    return fit
      + positiveChange * 2.4
      + contribution
      + (hasAnyTag(candidate, ['攻撃', 'AI', '半導体', 'グロース', 'テーマ']) ? 12 : 0)
      + (position === 'FW' ? candidate.fit.FW * 0.18 : 0);
  }

  if (mode === 'defense') {
    return fit
      + calmBonus * 2.2
      + contribution * 0.7
      + (hasAnyTag(candidate, ['安定', '守備', '配当', '大型株', '通信', '銀行']) ? 14 : 0)
      + (position === 'GK' ? candidate.fit.GK * 0.2 : 0);
  }

  return fit * 0.62
    + averageFit * 0.36
    + contribution
    + calmBonus
    + (hasAnyTag(candidate, ['バランス', '大型株', '主軸', '高収益']) ? 8 : 0);
}

function getFormationCounts(): Record<Position, number> {
  const text = document.querySelector<HTMLElement>('.position-status')?.textContent || '';
  const read = (position: Position, fallback: number) => {
    const match = text.match(new RegExp(`${position}\\s+\\d+/(\\d+)`));
    const value = match ? Number(match[1]) : fallback;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  return {
    FW: read('FW', 3),
    MF: read('MF', 3),
    DF: read('DF', 4),
    GK: read('GK', 1),
  };
}

function buildLineup(mode: AutoMode, counts: Record<Position, number>) {
  const used = new Set<string>();
  const lineup: AutoCandidate[] = [];

  POSITIONS.forEach((position) => {
    const ranked = [...AUTO_CANDIDATES]
      .filter((candidate) => !used.has(candidate.code))
      .sort((a, b) => scoreCandidate(b, position, mode) - scoreCandidate(a, position, mode));

    ranked.slice(0, counts[position]).forEach((candidate) => {
      used.add(candidate.code);
      lineup.push(candidate);
    });
  });

  return lineup.slice(0, 11);
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function clearSearchFilter() {
  const input = document.querySelector<HTMLInputElement>('.custom-stock-row input');
  if (!input || input.value === '') return;
  setNativeInputValue(input, '');
  await wait(250);
}

async function clearCurrentSelection() {
  for (let index = 0; index < 20; index += 1) {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.market-table-row button, .stock-item.chosen .stock-item-head button'))
      .find((candidate) => !candidate.disabled && /(外す|選抜中)/.test(candidate.textContent || ''));
    if (!button) return;
    button.click();
    await wait(80);
  }
}

function findStockSelectButton(code: string) {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.stock-item'));
  const item = items.find((candidate) => {
    const small = candidate.querySelector('small')?.textContent || '';
    return small.trim().startsWith(code);
  });
  if (!item) return null;
  return Array.from(item.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => !button.disabled && /(選抜|候補追加)/.test(button.textContent || '')) || null;
}

function setStatus(message: string, type: 'idle' | 'success' | 'warning' | 'error' = 'idle') {
  const status = document.querySelector<HTMLElement>('[data-auto-formation-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.status = type;
}

function isTeamLocked() {
  const lockButton = document.querySelector<HTMLButtonElement>('.lock-button');
  return Boolean(lockButton?.textContent?.includes('確定を解除'));
}

async function applyAutoFormation(mode: AutoMode) {
  if (running) return;
  if (isTeamLocked()) {
    setStatus('確定済みのため自動編成できません。先に確定を解除してください。', 'warning');
    return;
  }

  running = true;
  try {
    setStatus(`${modeLabel(mode)}で自動編成しています...`, 'idle');
    await clearSearchFilter();
    await clearCurrentSelection();
    await wait(120);

    const counts = getFormationCounts();
    const lineup = buildLineup(mode, counts);
    const missed: string[] = [];

    for (const candidate of lineup) {
      const button = findStockSelectButton(candidate.code);
      if (!button) {
        missed.push(candidate.code);
        continue;
      }
      button.click();
      await wait(85);
    }

    if (missed.length > 0) {
      setStatus(`自動編成しました。一部候補が見つかりませんでした：${missed.join(', ')}`, 'warning');
      return;
    }

    setStatus(`${modeLabel(mode)}で11銘柄を自動配置しました。内容を確認してからエントリーしてください。`, 'success');
  } catch (error) {
    setStatus(`自動編成に失敗しました：${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    running = false;
  }
}

function createPanel() {
  const target = document.querySelector<HTMLElement>('.editor-wide');
  if (!target || target.querySelector('.auto-formation-panel')) return;

  const panel = document.createElement('div');
  panel.className = 'auto-formation-panel';
  panel.innerHTML = `
    <div class="auto-formation-head">
      <div>
        <strong>条件で自動編成</strong>
        <span>ゲーム用に11銘柄を自動配置します。売買推奨ではありません。</span>
      </div>
    </div>
    <div class="auto-formation-buttons">
      <button type="button" data-auto-mode="attack">攻撃型</button>
      <button type="button" data-auto-mode="balance">バランス型</button>
      <button type="button" data-auto-mode="defense">守備型</button>
      <button type="button" data-auto-mode="random">ランダム</button>
    </div>
    <p class="auto-formation-status" data-auto-formation-status data-status="idle">フォーメーションに合わせて自動配置できます。</p>
  `;

  const form = target.querySelector('.custom-stock-row');
  if (form?.nextSibling) target.insertBefore(panel, form.nextSibling);
  else target.appendChild(panel);
}

function bindActions() {
  document.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest<HTMLButtonElement>('[data-auto-mode]')
      : null;
    if (!button) return;
    event.preventDefault();
    void applyAutoFormation(button.dataset.autoMode as AutoMode);
  });
}

export function initAutoFormationWireup() {
  if (initialized) return;
  initialized = true;

  bindActions();
  const observer = new MutationObserver(createPanel);
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(createPanel, 600);
  window.setTimeout(createPanel, 1800);
}
