const STORAGE_KEY = 'nihon-kabu-eleven:bgm-enabled';

type BgmState = 'on' | 'off';

type OscType = OscillatorType;

let initialized = false;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let loopTimer: number | null = null;
let stepIndex = 0;
let playing = false;

const STEP_MS = 145;
const LEAD_SEQUENCE = [
  659.25, 0, 783.99, 0,
  880.00, 987.77, 880.00, 783.99,
  659.25, 0, 739.99, 0,
  783.99, 880.00, 987.77, 1174.66,
];

const BASS_SEQUENCE = [
  164.81, 0, 196.00, 0,
  220.00, 0, 196.00, 0,
  146.83, 0, 174.61, 0,
  196.00, 0, 220.00, 0,
];

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

function ensureAudioGraph() {
  if (audioContext && masterGain) return { audioContext, masterGain };

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.value = 0.18;
  gain.connect(context.destination);

  audioContext = context;
  masterGain = gain;
  return { audioContext: context, masterGain: gain };
}

function playTone(frequency: number, duration: number, type: OscType, gainValue: number, when: number) {
  if (!audioContext || !masterGain || frequency <= 0) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function playKick(when: number) {
  if (!audioContext || !masterGain) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(92, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.14);

  gain.gain.setValueAtTime(0.16, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.18);
}

function playHat(when: number) {
  if (!audioContext || !masterGain) return;

  const bufferSize = audioContext.sampleRate * 0.035;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index += 1) {
    data[index] = (Math.random() * 2 - 1) * 0.45;
  }

  const noise = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.045, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
  noise.buffer = buffer;
  noise.connect(gain);
  gain.connect(masterGain);
  noise.start(when);
  noise.stop(when + 0.04);
}

function playStep() {
  if (!audioContext || !playing) return;

  const now = audioContext.currentTime + 0.025;
  const lead = LEAD_SEQUENCE[stepIndex % LEAD_SEQUENCE.length];
  const bass = BASS_SEQUENCE[stepIndex % BASS_SEQUENCE.length];

  if (lead) playTone(lead, 0.09, 'square', 0.055, now);
  if (bass) playTone(bass, 0.12, 'triangle', 0.07, now);
  if (stepIndex % 4 === 0) playKick(now);
  if (stepIndex % 2 === 1) playHat(now);

  stepIndex = (stepIndex + 1) % LEAD_SEQUENCE.length;
}

function updateButton(button: HTMLButtonElement) {
  button.dataset.bgmState = playing ? 'on' : 'off';
  button.setAttribute('aria-pressed', playing ? 'true' : 'false');
  button.innerHTML = playing
    ? '<span class="bgm-toggle-icon">♪</span><span>BGM ON</span>'
    : '<span class="bgm-toggle-icon">♪</span><span>BGM OFF</span>';
}

async function startBgm(button: HTMLButtonElement) {
  const graph = ensureAudioGraph();
  await graph.audioContext.resume();

  if (playing) return;
  playing = true;
  stepIndex = 0;
  writeStoredState('on');
  updateButton(button);
  playStep();
  loopTimer = window.setInterval(playStep, STEP_MS);
}

function stopBgm(button: HTMLButtonElement) {
  playing = false;
  writeStoredState('off');
  if (loopTimer !== null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
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
