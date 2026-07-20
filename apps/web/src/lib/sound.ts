'use client';

/**
 * Generative sound engine (Web Audio, zero assets). Every cue is synthesised on
 * the fly so the bundle stays tiny and the feel stays premium — soft UI clicks,
 * a satisfying rising cash-out, a bright win arpeggio scaled to the multiplier,
 * a dull loss thud, and a golden jackpot fanfare.
 *
 * SSR-safe: the AudioContext is created lazily on the first real interaction.
 */

let ctx: AudioContext | null = null;
let enabled = true;

const KEY = 'soltrend-sound';

export function initSoundPref() {
  if (typeof window === 'undefined') return;
  const v = window.localStorage.getItem(KEY);
  enabled = v === null ? true : v === '1';
}

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, on ? '1' : '0');
  if (on) void resume();
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

async function resume() {
  const c = ac();
  if (c && c.state === 'suspended') await c.resume();
}

function tone(
  freq: number,
  start: number,
  dur: number,
  {
    type = 'sine',
    gain = 0.14,
    to = freq,
  }: { type?: OscillatorType; gain?: number; to?: number } = {},
) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const guard = () => enabled && !!ac();

export const sfx = {
  click() {
    if (!guard()) return;
    void resume();
    tone(420, 0, 0.05, { type: 'triangle', gain: 0.05 });
  },
  bet() {
    if (!guard()) return;
    void resume();
    tone(240, 0, 0.09, { type: 'square', gain: 0.06, to: 180 });
  },
  tick(rate = 1) {
    if (!guard()) return;
    tone(600 + rate * 40, 0, 0.03, { type: 'sine', gain: 0.03 });
  },
  cashout() {
    if (!guard()) return;
    void resume();
    tone(520, 0, 0.16, { type: 'sine', gain: 0.12, to: 900 });
    tone(780, 0.05, 0.16, { type: 'sine', gain: 0.08, to: 1200 });
  },
  loss() {
    if (!guard()) return;
    void resume();
    tone(180, 0, 0.22, { type: 'sawtooth', gain: 0.08, to: 70 });
  },
  /** Win arpeggio; brighter + longer the bigger the multiplier. */
  win(mult = 2) {
    if (!guard()) return;
    void resume();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    const n = Math.min(4, 2 + Math.floor(Math.log2(Math.max(2, mult))));
    for (let i = 0; i < n; i++) tone(notes[i], i * 0.06, 0.18, { type: 'triangle', gain: 0.11 });
  },
  jackpot() {
    if (!guard()) return;
    void resume();
    const seq = [659.25, 783.99, 987.77, 1318.5, 1567.98];
    seq.forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'sawtooth', gain: 0.1 }));
    seq.forEach((f, i) => tone(f * 1.005, i * 0.08, 0.3, { type: 'triangle', gain: 0.06 }));
  },
  levelUp() {
    if (!guard()) return;
    void resume();
    [440, 587.33, 880].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'triangle', gain: 0.1 }));
  },
};
