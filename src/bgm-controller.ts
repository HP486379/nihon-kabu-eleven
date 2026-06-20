const STORAGE_KEY = 'nihon-kabu-eleven:bgm-enabled';

type BgmState = 'on' | 'off';
type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
type OscType = OscillatorType;

let initialized = false;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let loopTimer: number | null = null;
let stepIndex = 0;
let playing = false;

const STEP_MS = 920;

const CHORD_SEQUENCE = [
  [130.81, 196.00, 261.63, 329.63],
  [98.00, 196.00, 246.94, 392.00],
  [110.00, 220.00, 261.63, 440.00],
  [87.31, 174.61, 220.00, 349.23],
  [98.00, 196.00, 246.94, 392.00],
  [130.81, 196.00, 261.63, 329.63],
];

const BELL_SEQUENCE = [
  523.25, 659.25, 783.99, 987.77,
  880.00, 783.99, 659.25, 587.33,
  523.25, 0, 392.00, 0,
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

  const audioWindow = window as AudioWindow;
  const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('このブラウザはWeb Audioに対応していません。');
  }

  const context = new AudioContextCtor();
  const gain = context.createGain();
  gain.gain.value = 0.34;
  gain.connect(context.destination);

  audioContext = context;
  masterGain = gain;
  return { audioContext: context, masterGain: gain };
}

function playTone(
  frequency: number,
  duration: number,
  type: OscType,
  gainValue: number,
  when: number,
  attack = 0.08,
  releaseOffset = 0.08,
) {
  if (!audioContext || !masterGain || frequency <= 0) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(type === 'sine' ? 1100 : 1800, when);
  filter.Q.setValueAtTime(0.5, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + duration + releaseOffset);
}

function playChord(frequencies: number[], when: number) {
  frequencies.forEach((frequency, index) => {
    const octaveShift = index === 0 ? 0.5 : 1;
    const gain = index === 0 ? 0.13 : 0.055;
    playTone(frequency * octaveShift, 3.4, index === 0 ? 'sine' : 'triangle', gain, when + index * 0.025, 0.45, 0.4);
  });
}

function playBell(frequency: number, when: number) {
  if (!frequency) return;
  playTone(frequency, 1.15, 'sine', 0.105, when, 0.018, 0.22);
  playTone(frequency * 2.01, 0.78, 'triangle', 0.034, when + 0.012, 0.018, 0.18);
  playTone(frequency * 3.02, 0.46, 'sine', 0.018, when + 0.018, 0.012, 0.14);
}

function playTimpani(when: number) {
  if (!audioContext || !masterGain) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(82, when);
  osc.frequency.exponentialRampToValueAtTime(46, when + 0.34);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(260, when);
  filter.Q.setValueAtTime(0.9, when);

  gain.gain.setValueAtTime(0.32, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.58);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.64);
}

function playSoftNoiseSwell(when: number) {
  if (!audioContext || !masterGain) return;

  const bufferSize = Math.floor(audioContext.sampleRate * 1.1);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index += 1) {
    data[index] = (Math.random() * 2 - 1) * 0.18;
  }

  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, when);
  filter.Q.setValueAtTime(0.4, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.045, when + 0.38);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);

  noise.buffer = buffer;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  noise.start(when);
  noise.stop(when + 1.15);
}

function playStartupCue() {
  if (!audioContext) return;
  const now = audioContext.currentTime + 0.03;
  playChord(CHORD_SEQUENCE[0], now);
  playBell(523.25, now + 0.22);
  playBell(783.99, now + 0.56);
  playTimpani(now + 0.04);
}

function playStep() {
  if (!audioContext || !playing) return;

  const now = audioContext.currentTime + 0.035;
  const chord = CHORD_SEQUENCE[stepIndex % CHORD_SEQUENCE.length];
  const bell = BELL_SEQUENCE[stepIndex % BELL_SEQUENCE.length];

  playChord(chord, now);

  if (stepIndex % 2 === 0) playTimpani(now + 0.02);
  if (stepIndex % 3 === 0) playSoftNoiseSwell(now + 0.08);
  playBell(bell, now + 0.42);

  stepIndex = (stepIndex + 1) % Math.max(CHORD_SEQUENCE.length, BELL_SEQUENCE.length);
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

  if (graph.audioContext.state === 'suspended') {
    throw new Error('ブラウザが音声再生を一時停止しています。もう一度BGMボタンを押してください。');
  }

  if (playing) return;
  playing = true;
  stepIndex = 0;
  writeStoredState('on');
  updateButton(button);
  playStartupCue();
  window.setTimeout(playStep, 950);
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
