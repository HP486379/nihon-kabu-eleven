type MatchType = 'weekly' | 'monthly' | 'quarterly';

type MatchRule = {
  id: MatchType;
  label: string;
  shortLabel: string;
  compactLabel: string;
  durationText: string;
  deadlineText: string;
  resultText: string;
  strategyText: string;
  ruleText: string;
};

const MATCH_RULES: MatchRule[] = [
  {
    id: 'weekly',
    label: '1週間マッチ',
    shortLabel: '短期決戦',
    compactLabel: '1週間',
    durationText: '締切1週間後の終値で決着',
    deadlineText: '締切日の終値を基準価格にします',
    resultText: '締切1週間後が休場日の場合は、直後の取引日の終値で集計します',
    strategyText: '短期決戦。決算・材料・テーマ株が動きやすいライト参加向けです。',
    ruleText: '締切日の終値と、締切1週間後の終値を比較し、ポジション加重リターンで順位を決定します。',
  },
  {
    id: 'monthly',
    label: '1か月マッチ',
    shortLabel: '標準大会',
    compactLabel: '1か月',
    durationText: '締切1か月後の終値で決着',
    deadlineText: '締切日の終値を基準価格にします',
    resultText: '締切1か月後が休場日の場合は、直後の取引日の終値で集計します',
    strategyText: '標準大会。短期材料と銘柄選定力のバランスが出やすい期間です。',
    ruleText: '締切日の終値と、締切1か月後の終値を比較し、ポジション加重リターンで順位を決定します。',
  },
  {
    id: 'quarterly',
    label: '3か月マッチ',
    shortLabel: '本格リーグ',
    compactLabel: '3か月',
    durationText: '締切3か月後の終値で決着',
    deadlineText: '締切日の終値を基準価格にします',
    resultText: '締切3か月後が休場日の場合は、直後の取引日の終値で集計します',
    strategyText: '本格リーグ。業績・テーマ・地合いの読みが出やすい期間です。',
    ruleText: '締切日の終値と、締切3か月後の終値を比較し、ポジション加重リターンで順位を決定します。',
  },
];

function findValueByLabel(root: ParentNode, label: string) {
  return Array.from(root.querySelectorAll('div')).find((node) => node.querySelector('span')?.textContent?.trim() === label)?.querySelector('strong') as HTMLElement | null;
}

function updateExistingTournamentCopy(rule: MatchRule) {
  const headerSubline = document.querySelector('.header-subline');
  const headerItems = headerSubline ? Array.from(headerSubline.querySelectorAll('span')) : [];
  if (headerItems[0]) headerItems[0].textContent = `🏆 ${rule.label}`;
  if (headerItems[1]) headerItems[1].textContent = `📅 ${rule.durationText}`;
  if (headerItems[2]) headerItems[2].textContent = '📈 日次終値ベースで勝負';

  const matchStrip = document.querySelector('.match-strip');
  if (matchStrip) {
    const durationValue = findValueByLabel(matchStrip, '試合期間');
    const deadlineValue = findValueByLabel(matchStrip, '締切');
    const judgeValue = findValueByLabel(matchStrip, '判定方式');
    if (durationValue) {
      durationValue.textContent = rule.durationText;
      durationValue.dataset.matchDuration = rule.durationText;
    }
    if (deadlineValue) deadlineValue.textContent = '運営設定の締切日時';
    if (judgeValue) judgeValue.textContent = 'ポジション加重リターン';
  }

  const sideSummary = Array.from(document.querySelectorAll('.summary-block')).find((block) => block.querySelector('.label')?.textContent?.trim() === '試合名');
  const summarySubtext = sideSummary?.querySelector('.subtext');
  if (summarySubtext) summarySubtext.textContent = `${rule.label} / ${rule.durationText}`;

  const ruleBoxText = document.querySelector('.match-rule-box p');
  if (ruleBoxText) ruleBoxText.textContent = rule.ruleText;
}

function renderCompactSelector(container: HTMLElement, current: MatchRule, onSelect: (rule: MatchRule) => void) {
  container.innerHTML = `
    <span>大会タイプ</span>
    ${MATCH_RULES.map((rule) => `
      <button type="button" class="match-type-chip ${rule.id === current.id ? 'selected' : ''}" data-match-type="${rule.id}" title="${rule.label}：${rule.strategyText}">
        <strong>${rule.compactLabel}</strong><small>${rule.shortLabel}</small>
      </button>
    `).join('')}
    <em>${current.deadlineText}。${current.resultText}。</em>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-match-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = MATCH_RULES.find((rule) => rule.id === button.dataset.matchType);
      if (next) onSelect(next);
    });
  });
}

function getInitialRule(): MatchRule {
  const pageText = document.body.textContent ?? '';
  if (pageText.includes('3か月') || pageText.includes('3ヶ月')) return MATCH_RULES[2];
  if (pageText.includes('1か月') || pageText.includes('1ヶ月')) return MATCH_RULES[1];
  if (pageText.includes('1週間')) return MATCH_RULES[0];
  return MATCH_RULES[2];
}

function mountMatchDurationRules() {
  const matchStrip = document.querySelector('.match-strip') as HTMLElement | null;
  if (!matchStrip) return false;

  document.querySelector('.match-duration-rules-card')?.remove();
  matchStrip.classList.add('match-strip-duration-enabled');

  let current = getInitialRule();
  let selector = matchStrip.querySelector<HTMLElement>('.match-type-inline');
  if (!selector) {
    selector = document.createElement('div');
    selector.className = 'match-type-inline';
    selector.setAttribute('aria-label', '大会タイプ選択');
    matchStrip.appendChild(selector);
  }

  const apply = (rule: MatchRule) => {
    current = rule;
    updateExistingTournamentCopy(current);
    renderCompactSelector(selector, current, apply);
  };

  apply(current);
  return true;
}

export function initMatchDurationRules() {
  const tryMount = () => mountMatchDurationRules();

  if (tryMount()) return;

  let tries = 0;
  const maxTries = 60;
  const timer = window.setInterval(() => {
    tries += 1;
    if (tryMount() || tries >= maxTries) {
      window.clearInterval(timer);
    }
  }, 100);

  const observer = new MutationObserver(() => {
    if (tryMount()) observer.disconnect();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      tryMount();
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }
}
