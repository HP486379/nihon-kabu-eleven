type MatchType = 'weekly' | 'monthly' | 'quarterly';

type MatchRule = {
  id: MatchType;
  label: string;
  shortLabel: string;
  badge: string;
  durationText: string;
  deadlineText: string;
  basePriceText: string;
  resultText: string;
  strategyText: string;
  ruleText: string;
};

const MATCH_RULES: MatchRule[] = [
  {
    id: 'weekly',
    label: '1週間マッチ',
    shortLabel: '短期決戦',
    badge: 'WEEKLY MATCH',
    durationText: '締切1週間後の終値で決着',
    deadlineText: '締切日の終値を基準価格にします',
    basePriceText: '締切日が休場日の場合は、直後の取引日の終値を基準にします',
    resultText: '締切1週間後が休場日の場合は、直後の取引日の終値で集計します',
    strategyText: '決算・材料・テーマ株が動きやすいライト参加向けの短期勝負です。',
    ruleText: '締切日の終値と、締切1週間後の終値を比較し、ポジション加重リターンで順位を決定します。',
  },
  {
    id: 'monthly',
    label: '1か月マッチ',
    shortLabel: '標準大会',
    badge: 'MONTHLY MATCH',
    durationText: '締切1か月後の終値で決着',
    deadlineText: '締切日の終値を基準価格にします',
    basePriceText: '締切日が休場日の場合は、直後の取引日の終値を基準にします',
    resultText: '締切1か月後が休場日の場合は、直後の取引日の終値で集計します',
    strategyText: '短期材料と銘柄選定力のバランスが出やすいメイン大会です。',
    ruleText: '締切日の終値と、締切1か月後の終値を比較し、ポジション加重リターンで順位を決定します。',
  },
  {
    id: 'quarterly',
    label: '3か月マッチ',
    shortLabel: '本格リーグ',
    badge: 'QUARTERLY MATCH',
    durationText: '締切3か月後の終値で決着',
    deadlineText: '締切日の終値を基準価格にします',
    basePriceText: '締切日が休場日の場合は、直後の取引日の終値を基準にします',
    resultText: '締切3か月後が休場日の場合は、直後の取引日の終値で集計します',
    strategyText: '業績・テーマ・地合いの読みが出やすい本格リーグです。',
    ruleText: '締切日の終値と、締切3か月後の終値を比較し、ポジション加重リターンで順位を決定します。',
  },
];

function findValueByLabel(root: ParentNode, label: string) {
  return Array.from(root.querySelectorAll('div')).find((node) => node.querySelector('span')?.textContent?.trim() === label)?.querySelector('strong');
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
    if (durationValue) durationValue.textContent = rule.durationText;
    if (deadlineValue) deadlineValue.textContent = '運営設定の締切日時';
  }

  const sideSummary = Array.from(document.querySelectorAll('.summary-block')).find((block) => block.querySelector('.label')?.textContent?.trim() === '試合名');
  const summarySubtext = sideSummary?.querySelector('.subtext');
  if (summarySubtext) summarySubtext.textContent = `${rule.label} / ${rule.durationText}`;

  const ruleBoxText = document.querySelector('.match-rule-box p');
  if (ruleBoxText) ruleBoxText.textContent = rule.ruleText;
}

function renderRulePanel(container: HTMLElement, current: MatchRule, onSelect: (rule: MatchRule) => void) {
  container.innerHTML = `
    <div class="match-rule-header">
      <div>
        <p class="match-rule-kicker">MATCH TYPE</p>
        <h3>大会タイプ</h3>
      </div>
      <span class="match-rule-badge">${current.badge}</span>
    </div>
    <div class="match-type-buttons">
      ${MATCH_RULES.map((rule) => `
        <button type="button" class="match-type-button ${rule.id === current.id ? 'selected' : ''}" data-match-type="${rule.id}">
          <strong>${rule.label}</strong>
          <small>${rule.shortLabel}</small>
        </button>
      `).join('')}
    </div>
    <div class="match-rule-grid">
      <div><span>基準価格</span><strong>${current.deadlineText}</strong><small>${current.basePriceText}</small></div>
      <div><span>集計価格</span><strong>${current.durationText}</strong><small>${current.resultText}</small></div>
      <div><span>勝敗判定</span><strong>ポジション加重リターン</strong><small>${current.ruleText}</small></div>
    </div>
    <p class="match-rule-note">${current.strategyText}</p>
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
  if (pageText.includes('1週間')) return MATCH_RULES[0];
  if (pageText.includes('1か月')) return MATCH_RULES[1];
  return MATCH_RULES[2];
}

function mountMatchDurationRules() {
  const matchStrip = document.querySelector('.match-strip');
  if (!matchStrip || document.querySelector('.match-duration-rules-card')) return false;

  let current = getInitialRule();
  const panel = document.createElement('section');
  panel.className = 'card match-duration-rules-card';
  matchStrip.insertAdjacentElement('afterend', panel);

  const apply = (rule: MatchRule) => {
    current = rule;
    updateExistingTournamentCopy(current);
    renderRulePanel(panel, current, apply);
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