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

// Modern soccer-game style: rhythm first, short synth hooks, no quoted song melody.
const STEP_MS = 150;
const LOOP_STEPS = 64;

const ROOT_SEQUENCE = [
  65.41, 73.42, 82.41, 87.31,
  98.00, 110.00, 98.00, 87.31,
];

const STADIUM_HOOK = [
  0, 0, 523.25, 0, 587.33, 0, 659.25, 0,
  783.99, 0, 659.25, 587.33, 523.25, 0, 0, 0,
  0, 0, 523.25, 0, 587.33, 0, 698.46, 0,
  783.99, 0, 698.46, 659.25, 587.33, 0, 0, 0,
  0, 0, 659.25, 0, 783.99, 0, 880.00, 0,
  987.77, 0, 880.00, 783.99, 698.46, 0, 0, 0,
  0, 0, 783.99, 0, 880.00, 0, 1046.50, 0,
  987.77, 0, 880.00, 783.99, 659.25, 0, 0, 0,
];

const BASS_PATTERN = [
  1, 0, 0, 1,
  0, 0, 1, 0,
  1, 0, 1, 0,
  0, 0, 1, 0,
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
  gain.gain.value = 0.28;
  gain.connect(context.destination);

  audioContext = context;
  masterGain = gain;
  return { audioContext: context, masterGain: gain };
}

function createDistortionCurve(amount = 140) {
  const sampleCount = 44100;
  const curve = new Float32Array(sampleCount);
  const deg = Math.PI / 180;

  for (let index = 0; index < sampleCount; index += 1) {
    const x = (index * 2) / sampleCount - 1;
    curve[index] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }

  return curve;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscType,
  gainValue: number,
  when: number,
  attack = 0.01,
  releaseOffset = 0.03,
  filterFrequency = 1800,
) {
  if (!audioContext || !masterGain || frequency <= 0) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrequency, when);
  filter.Q.setValueAtTime(0.8, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + duration + releaseOffset);
}

function playStadiumLead(frequency: number, when: number, duration = 0.18) {
  if (!audioContext || !masterGain || frequency <= 0) return;

  const oscA = audioContext.createOscillator();
  const oscB = audioContext.createOscillator();
  const drive = audioContext.createWaveShaper();
  const bandpass = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  oscA.type = 'sawtooth';
  oscB.type = 'square';
  oscA.frequency.setValueAtTime(frequency, when);
  oscB.frequency.setValueAtTime(frequency * 0.997, when);

  drive.curve = createDistortionCurve(190);
  drive.oversample = '4x';

  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1900, when);
  bandpass.frequency.linearRampToValueAtTime(2500, when + duration * 0.5);
  bandpass.Q.setValueAtTime(1.8, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.16, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  oscA.connect(drive);
  oscB.connect(drive);
  drive.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(masterGain);

  oscA.start(when);
  oscB.start(when);
  oscA.stop(when + duration + 0.03);
  oscB.stop(when + duration + 0.03);
}

function playSynthStab(root: number, when: number) {
  if (!audioContext || !masterGain) return;

  const frequencies = [root * 2, root * 3, root * 4];
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, when);
  filter.frequency.linearRampToValueAtTime(2600, when + 0.08);
  filter.frequency.exponentialRampToValueAtTime(700, when + 0.34);
  filter.Q.setValueAtTime(1.4, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.10, when + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.36);

  frequencies.forEach((frequency, index) => {
    const osc = audioContext!.createOscillator();
    osc.type = index === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(frequency * (index === 2 ? 1.005 : 1), when);
    osc.connect(filter);
    osc.start(when);
    osc.stop(when + 0.40);
  });

  filter.connect(gain);
  gain.connect(masterGain);
}

function playBass(root: number, when: number, accent = false) {
  if (!audioContext || !masterGain) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const frequency = root * (accent ? 2 : 1);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(frequency, when);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.96, when + 0.20);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(accent ? 520 : 360, when);
  filter.Q.setValueAtTime(1.3, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.13 : 0.10, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.29);
}

function playKick(when: number) {
  if (!audioContext || !masterGain) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(115, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.15);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(230, when);
  filter.Q.setValueAtTime(1.1, when);

  gain.gain.setValueAtTime(0.32, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.28);
}

function playNoiseHit(when: number, duration: number, gainValue: number, filterFrequency: number, filterType: BiquadFilterType) {
  if (!audioContext || !masterGain) return;

  const bufferSize = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, when);
  filter.Q.setValueAtTime(0.9, when);

  gain.gain.setValueAtTime(gainValue, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  noise.buffer = buffer;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  noise.start(when);
  noise.stop(when + duration + 0.02);
}

function playSnareClap(when: number) {
  playNoiseHit(when, 0.12, 0.10, 1700, 'bandpass');
  playNoiseHit(when + 0.018, 0.16, 0.07, 3300, 'highpass');
}

function playHat(when: number, open = false) {
  playNoiseHit(when, open ? 0.10 : 0.035, open ? 0.045 : 0.025, open ? 7200 : 6200, 'highpass');
}

function playRiser(when: number) {
  if (!audioContext || !masterGain) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, when);
  osc.frequency.linearRampToValueAtTime(880, when + 0.85);
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, when);
  filter.frequency.linearRampToValueAtTime(3600, when + 0.85);
  filter.Q.setValueAtTime(2.4, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.linearRampToValueAtTime(0.055, when + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.90);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.95);
}

function playStartupCue() {
  if (!audioContext) return;
  const now = audioContext.currentTime + 0.035;
  playKick(now);
  playSynthStab(ROOT_SEQUENCE[0], now + 0.02);
  playStadiumLead(659.25, now + 0.18, 0.14);
  playStadiumLead(783.99, now + 0.34, 0.14);
  playStadiumLead(987.77, now + 0.50, 0.20);
}

function playStep() {
  if (!audioContext || !playing) return;

  const now = audioContext.currentTime + 0.035;
  const step = stepIndex % LOOP_STEPS;
  const barStep = step % 16;
  const root = ROOT_SEQUENCE[Math.floor(step / 8) % ROOT_SEQUENCE.length];
  const hook = STADIUM_HOOK[step];

  if (barStep === 0 || barStep === 4 || barStep === 8 || barStep === 12) playKick(now);
  if (barStep === 4 || barStep === 12) playSnareClap(now + 0.01);
  if (step % 2 === 0) playHat(now + 0.008, barStep === 14);
  if (BASS_PATTERN[barStep]) playBass(root, now + 0.015, barStep === 0 || barStep === 8);
  if (barStep === 0 || barStep === 10) playSynthStab(root, now + 0.02);
  if (hook) playStadiumLead(hook, now + 0.025, barStep % 8 === 2 ? 0.22 : 0.16);
  if (barStep === 15 && step >= 48) playRiser(now + 0.01);

  stepIndex = (stepIndex + 1) % LOOP_STEPS;
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
  window.setTimeout(playStep, 520);
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
