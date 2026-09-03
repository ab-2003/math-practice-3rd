/**
 * SOUND, SYNTHESISED.
 *
 * Nothing is shipped as a file. Same reason the creatures are drawn: the
 * bundle stays tiny for offline, and a missing asset cannot fail silently,
 * because there is no asset. Cloudflare Pages answers an unknown path with
 * index.html at status 200, so a missing mp3 would play HTML as audio and
 * simply be quiet forever with nothing thrown.
 *
 * LAW: the wrong-answer sound is a soft neutral tone. Never a buzzer, never
 * a descending "wah", never anything a boy could read as disappointment.
 */

let ctx: AudioContext | null = null;
let muted = false;

export const setMuted = (m: boolean): void => { muted = m; };
export const isMuted = (): boolean => muted;

const make = (): AudioContext | null => {
  try {
    return new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch { return null; } // a device with no audio must never break the app
};

/** Throw the old context away and build a fresh one. The last resort. */
const rebuild = (): void => {
  const old = ctx;
  ctx = make();
  void ctx?.resume().catch(() => undefined);
  try { void old?.close(); } catch { /* already gone */ }
};

/**
 * iOS never allows audio without a gesture, so the context is created on the
 * first touch and resumed on every subsequent one. Retry forever rather than
 * assuming the first unlock took. Resume from ANY state that is not running:
 * Safari parks a backgrounded context in "interrupted", which is not in the
 * spec and is not "suspended".
 */
export const unlock = (): void => {
  ctx ??= make();
  if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
};

/**
 * WAKING UP (Andy's iPad, 2026-09-03: "close the iPad, wake it, open the
 * app, sound is gone until you kill and reopen"). Locking the device parks
 * the context in "interrupted" or "suspended" and nothing brings it back on
 * its own, because the app itself never restarted. Worse, an interrupted
 * context sometimes resumes into silence: the state reads "running" while
 * its clock stands still. So this resumes, then CHECKS the clock actually
 * moved, and rebuilds the context if it did not.
 */
export const wake = (): void => {
  if (!ctx) return; // never armed; the next touch builds it
  const before = ctx.currentTime;
  void ctx.resume().catch(() => rebuild());
  window.setTimeout(() => {
    if (!ctx) return;
    if (ctx.state !== "running" || ctx.currentTime <= before) rebuild();
  }, 400);
};

// For the probes: the context's state and clock, and a way to interrupt it.
(window as unknown as Record<string, unknown>).__sfx = {
  state: (): string => ctx?.state ?? "none",
  time: (): number => ctx?.currentTime ?? 0,
  interrupt: (): Promise<void> | undefined => ctx?.suspend(),
};

const env = (
  type: OscillatorType, freq: number, at: number, dur: number, gain: number,
  slideTo?: number,
): void => {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + at);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + at + dur);
  }
  g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + at);
  osc.stop(ctx.currentTime + at + dur + 0.02);
};

/** Filtered noise: the grit under a skate sound. */
const noise = (at: number, dur: number, gain: number, cutoff: number): void => {
  if (!ctx || muted) return;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, Math.max(1, frames), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + at);
};

export const sfx = {
  /** A digit going into the keypad. Barely there. */
  tap: (): void => env("square", 420, 0, 0.04, 0.05),
  /**
   * A trick landing. `step` is the position in the line (0..4) and walks the
   * pitch upward, so a chain is AUDIBLE as a chain and the fifth landing
   * already sounds like arrival. Correctness-linked only, never speed:
   * identical for a retrieved and a derived answer, which keeps the ear as
   * blind to the difference as the eye.
   */
  land: (step = 0): void => {
    const lift = 1 + step * 0.13;
    env("triangle", 300 * lift, 0, 0.09, 0.18, 720 * lift);
    noise(0.03, 0.13, 0.11, 2600);
  },
  /** The correct-answer chime, stepping up the scale with the line. */
  chime: (step = 0): void => {
    const lift = Math.pow(2, (step * 2) / 12);
    env("sine", 1047 * lift, 0, 0.16, 0.12);
    env("sine", 1319 * lift, 0.06, 0.18, 0.11);
    env("triangle", 1568 * lift, 0.12, 0.26, 0.1);
  },
  /** TODAY'S WORK DONE: the one true fanfare. Played once a day, at the
   *  moment the daily dose is reached, and nowhere else, so it stays special. */
  dailyJingle: (): void => {
    [392, 523, 659, 784].forEach((f, i) => env("triangle", f, i * 0.11, 0.3, 0.14));
    env("triangle", 1047, 0.44, 0.55, 0.16);
    env("sine", 262, 0.44, 0.6, 0.09, 330);
    noise(0.5, 0.35, 0.06, 3200);
  },
  /** The speed run's own finale: quick, bright, and NOT the daily fanfare,
   *  which stays reserved for the day's work. */
  speedFanfare: (): void => {
    [523, 659, 784].forEach((f, i) => env("square", f, i * 0.07, 0.18, 0.1));
    env("triangle", 1047, 0.24, 0.4, 0.15);
    noise(0.26, 0.3, 0.08, 2800);
  },
  /** The bonus round announcing itself: a prize should sound like one. */
  bonusSting: (): void => {
    [659, 784, 988, 1319].forEach((f, i) => env("triangle", f, i * 0.09, 0.3, 0.13));
    env("sine", 330, 0, 0.5, 0.08, 392);
  },
  /** A whole line landed. */
  line: (): void => {
    [523, 659, 784, 1047].forEach((f, i) => env("triangle", f, i * 0.07, 0.22, 0.15));
    noise(0.02, 0.3, 0.07, 1800);
  },
  /**
   * A bail. Soft, low, warm, over in a moment. Bailing is normal in skating
   * and the sound has to agree with that.
   */
  bail: (): void => env("sine", 196, 0, 0.22, 0.1, 160),
  /** He typed the answer back after a bail. Gentle confirmation, not applause. */
  recover: (): void => env("triangle", 440, 0, 0.12, 0.12, 587),
  /** A creature unlocking. */
  roar: (): void => {
    env("sawtooth", 90, 0, 0.55, 0.16, 62);
    env("sawtooth", 135, 0.02, 0.5, 0.09, 96);
    noise(0, 0.5, 0.09, 700);
  },
  coin: (): void => env("square", 880, 0, 0.07, 0.08, 1320),

  // ---- THE SKATE PARK (0.19.0): its own kit, no music ----------------------
  /** The pop of an ollie: a wooden click, bigger for a bigger charge. */
  pop: (charge = 0): void => {
    env("square", 220 + charge * 120, 0, 0.05, 0.09 + charge * 0.05, 140);
    noise(0, 0.05 + charge * 0.04, 0.12, 1800);
  },
  /** A trick starting: a short whoosh, pitched by how long the trick is. */
  whoosh: (ms = 300): void => {
    noise(0, Math.min(0.45, ms / 1000), 0.09, 900 + (700 - ms));
    env("sine", 520, 0, Math.min(0.4, ms / 1000), 0.05, 380);
  },
  /** Wheels back on the ground. */
  thud: (): void => { env("triangle", 150, 0, 0.09, 0.14, 90); noise(0, 0.08, 0.1, 1200); },
  /** The rail under the trucks, one buzz per call; the screen calls it on a beat. */
  grindTick: (): void => { noise(0, 0.12, 0.08, 3400); env("sawtooth", 180, 0, 0.1, 0.035, 170); },
  /** A bail in the park: a crunch, low and short. Bailing is normal in skating. */
  crash: (): void => { noise(0, 0.22, 0.16, 500); env("sine", 120, 0, 0.25, 0.1, 70); },
  /** A chain banking: a rising run, one note per link, brighter for bigger. */
  bank: (mult = 1): void => {
    const n = Math.max(1, Math.min(5, mult));
    for (let i = 0; i < n; i++) env("triangle", 523 * Math.pow(2, (i * 4) / 12), i * 0.07, 0.16, 0.12);
    if (n >= 3) noise(n * 0.07, 0.25, 0.06, 2800);
  },
  /** A kicker launch: a rising sweep. */
  launch: (): void => { env("sine", 200, 0, 0.3, 0.1, 620); noise(0, 0.2, 0.06, 1400); },
  /** Time's up in the park: a two-note horn, warm, not a buzzer. */
  horn: (): void => { env("triangle", 392, 0, 0.35, 0.14); env("triangle", 523, 0.3, 0.55, 0.15); },
  /** A DAILY TOKEN dropping: three bright ticks and a shimmer. */
  token: (): void => {
    [988, 1319, 1976].forEach((f, i) => env("square", f, i * 0.08, 0.14, 0.07));
    env("sine", 2637, 0.26, 0.5, 0.06);
    noise(0.24, 0.3, 0.04, 5000);
  },
};
