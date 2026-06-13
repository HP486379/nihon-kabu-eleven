const FORMATION_CLASS_PREFIX = 'formation-view-';
const FORMATION_CLASS_RE = /^formation-view-/;

function normalizeFormationClass(label: string) {
  return `${FORMATION_CLASS_PREFIX}${label.trim().replace(/[^0-9-]/g, '')}`;
}

function applyFormationClass() {
  const formationLabel = document.querySelector<HTMLElement>('.formation-number')?.textContent || '';
  const pitchPlayers = document.querySelector<HTMLElement>('.pitch-players');
  const pitchStage = document.querySelector<HTMLElement>('.pitch-stage');
  const normalized = normalizeFormationClass(formationLabel);

  [pitchPlayers, pitchStage].forEach((target) => {
    if (!target) return;
    Array.from(target.classList)
      .filter((className) => FORMATION_CLASS_RE.test(className))
      .forEach((className) => target.classList.remove(className));

    if (normalized !== FORMATION_CLASS_PREFIX) {
      target.classList.add(normalized);
    }
  });
}

export function initFormationPitchClassWireup() {
  applyFormationClass();

  const observer = new MutationObserver(() => applyFormationClass());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
