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

const STEP_MS = 420;
const LOOP_STEPS = 32;

// Original stadium guitar-rock anthem phrase.
// This intentionally avoids copying any existing J.League/J'S THEME melody.
const LEAD_MELODY = [
  659.25, 0, 739.99, 0, 783.99, 880.00, 987.77, 0,
  880.00, 0, 783.99, 0, 739.99, 659.25, 587.33, 0,
  659.25, 0, 783.99, 0, 987.77, 1046.50, 987.77, 880.00,
  783.99, 0, 739.99, 0, 659.25, 587.33, 659.25, 0,
];

const CHANT_MELODY = [
  329.63, 0, 369.99, 0, 392.00, 440.00, 493.88, 0,
  440.00, 0, 392.00, 0, 369.99, 329.63, 293.66, 0,
  329.63, 0, 392.00, 0, 493.88, 523.25, 493.88, 440.00,
  392.00, 0, 369.99, 0, 329.63, 293.66, 329.63, 0,
];

const POWER_CHORDS = [
  [82.41, 123.47, 164.81],
  [65.41, 98.00, 130.81],
  [73.42, 110.00, 146.83],
  [61.74, 92.50, 123.47],
  [82.41, 123.47, 164.81],
  [98.00, 146.83, 196.00],
  [73.42, 110.00, 146.83],
  [82.41, 123.47, 164.81],
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
  gain.gain.value = 0.30;
  gain.connect(context.destination);

  audioContext = context;
  masterGain = gain;
  return { audioContext: context, masterGain: gain };
}

function createDistortionCurve(amount = 240) {
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
  attack = 0.02,
  releaseOffset = 0.06,
  filterFrequency = 2200,
) {
  if (!audioContext || !masterGain || frequency <= 0) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrequency, when);
  filter.Q.setValueAtTime(0.7, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + duration + releaseOffset);
}

function playLeadGuitar(frequency: number, when: number, duration = 0.46) {
  if (!audioContext || !masterGain || frequency <= 0) return;

  const oscA = audioContext.createOscillator();
  const oscB = audioContext.createOscillator();
  const drive = audioContext.createWaveShaper();
  const bandpass = audioContext.createBiquadFilter();
  const lowpass = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  oscA.type = 'sawtooth';
  oscB.type = 'triangle';
  oscA.frequency.setValueAtTime(frequency, when);
  oscB.frequency.setValueAtTime(frequency * 1.006, when);

  drive.curve = createDistortionCurve(360);
  drive.oversample = '4x';

  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1400, when);
  bandpass.Q.setValueAtTime(1.7, when);

  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(3300, when);
  lowpass.Q.setValueAtTime(0.8, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.21, when + 0.018);
  gain.gain.setValueAtTime(0.15, when + Math.max(0.03, duration - 0.09));
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  oscA.connect(drive);
  oscB.connect(drive);
  drive.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(masterGain);

  oscA.start(when);
  oscB.start(when);
  oscA.stop(when + duration + 0.05);
  oscB.stop(when + duration + 0.05);
}

function playPowerChord(frequencies: number[], when: number) {
  if (!audioContext || !masterGain) return;

  const drive = audioContext.createWaveShaper();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  drive.curve = createDistortionCurve(520);
  drive.oversample = '4x';
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1150, when);
  filter.frequency.linearRampToValueAtTime(1850, when + 0.08);
  filter.Q.setValueAtTime(0.9, when);

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.18, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.55);

  frequencies.forEach((frequency, index) => {
    const osc = audioContext!.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency * (index === 0 ? 1 : 2), when);
    osc.connect(drive);
    osc.start(when);
    osc.stop(when + 0.62);
  });

  drive.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
}

function playBass(frequency: number, when: number) {
  playTone(frequency, 0.34, 'sawtooth', 0.115, when, 0.012, 0.04, 420);
}

function playKick(when: number) {
  if (!audioContext || !masterGain) return;

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(95, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.18);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(220, when);
  filter.Q.setValueAtTime(1.2, when);

  gain.gain.setValueAtTime(0.31, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 0.34);
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
  filter.Q.setValueAtTime(0.8, when);

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
  playNoiseHit(when, 0.18, 0.13, 1700, 'bandpass');
  playNoiseHit(when + 0.018, 0.23, 0.08, 2600, 'highpass');
}

function playCrowdChant(frequency: number, when: number) {
  if (frequency <= 0) return;
  playTone(frequency, 0.56, 'triangle', 0.055, when, 0.10, 0.08, 1500);
  playTone(frequency * 1.5, 0.50, 'sine', 0.026, when + 0.012, 0.12, 0.08, 1200);
}

function playStartupCue() {
  if (!audioContext) return;
  const now = audioContext.currentTime + 0.035;
  playPowerChord(POWER_CHORDS[0], now);
  playKick(now + 0.02);
  playLeadGuitar(659.25, now + 0.18, 0.42);
  playLeadGuitar(783.99, now + 0.55, 0.48);
}

function playStep() {
  if (!audioContext || !playing) return;

  const now = audioContext.currentTime + 0.025;
  const step = stepIndex % LOOP_STEPS;
  const beat = step % 4;
  const chordIndex = Math.floor(step / 4) % POWER_CHORDS.length;
  const chord = POWER_CHORDS[chordIndex];
  const lead = LEAD_MELODY[step];
  const chant = CHANT_MELODY[step];

  if (beat === 0) playPowerChord(chord, now);
  if (beat === 0 || beat === 2) playKick(now + 0.01);
  if (beat === 1 || beat === 3) playBass(chord[0], now + 0.02);
  if (beat === 2) playSnareClap(now + 0.015);
  if (step % 2 === 0) playNoiseHit(now + 0.02, 0.07, 0.035, 4300, 'highpass');

  if (lead) playLeadGuitar(lead, now + 0.045, step % 8 === 6 ? 0.72 : 0.46);

  // After the first half of the loop, add a quiet stadium-singalong layer.
  if (step >= 16 && chant) playCrowdChant(chant, now + 0.055);

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
  window.setTimeout(playStep, 620);
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
