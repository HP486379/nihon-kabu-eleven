const STORAGE_KEY = 'nihon-kabu-eleven:bgm-enabled';
const BGM_SRC = '/public/audio/dashboard_bgm_nihon_kabu_eleven_edm_stadium_mix_128bpm_60s.mp3';

type BgmState = 'on' | 'off';

let initialized = false;
let audioElement: HTMLAudioElement | null = null;
let playing = false;

function readStoredState(): BgmState {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on' ? 'on' : 'off';
  } catch (_error) {
    return 'off';
  }
}

function writeStoredState(state: BgmState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch (_error) {
    // localStorage is best-effort only.
  }
}

function ensureAudioElement() {
  if (audioElement) return audioElement;

  const audio = new Audio(BGM_SRC);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.28;

  audio.addEventListener('ended', () => {
    if (!audio.loop) playing = false;
  });

  audio.addEventListener('error', () => {
    playing = false;
    writeStoredState('off');
    console.warn('BGM audio failed to load', BGM_SRC, audio.error);
  });

  audioElement = audio;
  return audio;
}

function updateButton(button: HTMLButtonElement) {
  button.dataset.bgmState = playing ? 'on' : 'off';
  button.setAttribute('aria-pressed', playing ? 'true' : 'false');
  button.innerHTML = playing
    ? '<span class="bgm-toggle-icon">♪</span><span>BGM ON</span>'
    : '<span class="bgm-toggle-icon">♪</span><span>BGM OFF</span>';
}

async function startBgm(button: HTMLButtonElement) {
  const audio = ensureAudioElement();
  if (playing) return;

  audio.currentTime = audio.currentTime || 0;
  await audio.play();

  playing = true;
  writeStoredState('on');
  updateButton(button);
}

function stopBgm(button: HTMLButtonElement) {
  playing = false;
  writeStoredState('off');

  if (audioElement) {
    audioElement.pause();
  }

  updateButton(button);
}

function createToggleButton() {
  if (document.querySelector('.bgm-toggle-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bgm-toggle-button';
  button.setAttribute('aria-label', 'BGMのオンオフを切り替える');
  button.setAttribute('aria-pressed', 'false');
  button.dataset.bgmState = 'off';
  updateButton(button);

  button.addEventListener('click', () => {
    if (playing) {
      stopBgm(button);
      return;
    }

    void startBgm(button).catch((error) => {
      stopBgm(button);
      button.dataset.bgmState = 'error';
      button.textContent = 'BGM ERROR';
      window.setTimeout(() => updateButton(button), 1400);
      console.warn('BGM start failed', error);
    });
  });

  document.body.appendChild(button);
}

export function initBgmController() {
  if (initialized) return;
  initialized = true;

  createToggleButton();

  if (readStoredState() === 'on') {
    // Browser autoplay rules require a user gesture, so we keep the first view silent.
    writeStoredState('off');
  }
}
