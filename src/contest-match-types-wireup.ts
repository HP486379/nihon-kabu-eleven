type ContestMatchType = {
  key: 'one-week' | 'one-month' | 'three-month';
  title: string;
  badge: string;
  duration: string;
  finishBasis: string;
  role: string;
  note: string;
};

const CONTEST_MATCH_TYPES: ContestMatchType[] = [
  {
    key: 'one-week',
    title: '1週間マッチ',
    badge: 'SHORT',
    duration: '締切1週間後',
    finishBasis: '対象日の終値ベース',
    role: '短期決戦。話題株・決算・テーマ株の瞬発力が出やすいモード。',
    note: 'ライト参加向き',
  },
  {
    key: 'one-month',
    title: '1か月マッチ',
    badge: 'STANDARD',
    duration: '締切1か月後',
    finishBasis: '対象日の終値ベース',
    role: '短期の勢いと銘柄選定力のバランスを見る標準モード。',
    note: 'メイン大会向き',
  },
  {
    key: 'three-month',
    title: '3か月マッチ',
    badge: 'LEAGUE',
    duration: '締切3か月後',
    finishBasis: '対象日の終値ベース',
    role: 'テーマ性・業績期待・地合い耐性まで見える本格リーグ。',
    note: '本格派向き',
  },
];

const CONTEST_RULE_TEXT = '締切日の終値を基準価格とし、1週間後・1か月後・3か月後の対象取引日の終値で集計します。終了予定日が休場日の場合は、次に取得できる取引日の終値を使用します。順位はポジション加重リターンで決定します。';

function setText(selector: string, text: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.textContent = text;
}

function buildMatchTypesSection() {
  const section = document.createElement('section');
  section.className = 'contest-match-types-card card';
  section.setAttribute('aria-label', '大会モード');

  section.innerHTML = `
    <div class="contest-match-types-header">
      <div>
        <p class="contest-match-types-kicker">CONTEST TYPES</p>
        <h3>大会モード</h3>
      </div>
      <p>締切後の終値を使って、期間別にチームの実力を判定します。</p>
    </div>
    <div class="contest-match-type-grid">
      ${CONTEST_MATCH_TYPES.map((matchType) => `
        <article class="contest-match-type contest-match-type-${matchType.key}">
          <div class="contest-match-type-topline">
            <span>${matchType.badge}</span>
            <small>${matchType.note}</small>
          </div>
          <h4>${matchType.title}</h4>
          <dl>
            <div><dt>集計日</dt><dd>${matchType.duration}</dd></div>
            <div><dt>価格基準</dt><dd>${matchType.finishBasis}</dd></div>
          </dl>
          <p>${matchType.role}</p>
        </article>
      `).join('')}
    </div>
    <div class="contest-rule-note">
      <strong>共通ルール</strong>
      <span>${CONTEST_RULE_TEXT}</span>
    </div>
  `;

  return section;
}

function updateExistingContestCopy() {
  const headerSubline = document.querySelectorAll<HTMLElement>('.header-subline span');
  if (headerSubline[0]) headerSubline[0].textContent = '🏆 1週間 / 1か月 / 3か月マッチ';
  if (headerSubline[1]) headerSubline[1].textContent = '📅 締切後の指定期間終値で集計';
  if (headerSubline[2]) headerSubline[2].textContent = '📈 ポジション加重リターンで勝負';

  const stripItems = document.querySelectorAll<HTMLElement>('.match-strip > div');
  if (stripItems[0]) {
    const label = stripItems[0].querySelector<HTMLElement>('span');
    const value = stripItems[0].querySelector<HTMLElement>('strong');
    if (label) label.textContent = '大会形式';
    if (value) value.textContent = '1週間・1か月・3か月マッチ';
  }
  if (stripItems[2]) {
    const label = stripItems[2].querySelector<HTMLElement>('span');
    const value = stripItems[2].querySelector<HTMLElement>('strong');
    if (label) label.textContent = '集計基準';
    if (value) value.textContent = '締切後の対象取引日終値';
  }

  setText('.match-rule-box p', CONTEST_RULE_TEXT);
  setText('.chart-footnote', '※ 表示中のリターンは参考値です。大会結果は各マッチの対象取引日終値で確定します。');

  const compactRecord = document.querySelector<HTMLElement>('.side-card .compact-record');
  const compactSubtext = document.querySelector<HTMLElement>('.side-card .compact-record + .subtext');
  if (compactRecord) compactRecord.textContent = '日本株代表カップ';
  if (compactSubtext) compactSubtext.textContent = '1週間 / 1か月 / 3か月の3形式で開催';
}

function insertContestMatchTypes() {
  if (document.querySelector('.contest-match-types-card')) return;

  const matchStrip = document.querySelector<HTMLElement>('.match-strip.card');
  if (!matchStrip?.parentElement) return;

  matchStrip.insertAdjacentElement('afterend', buildMatchTypesSection());
}

export function initContestMatchTypes() {
  const apply = () => {
    try {
      updateExistingContestCopy();
      insertContestMatchTypes();
    } catch (error) {
      console.warn('[contest-match-types] skipped', error);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    window.setTimeout(apply, 0);
  }

  window.setTimeout(apply, 250);
}
