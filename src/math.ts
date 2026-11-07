export type Mode = "mandelbrot" | "euclidean" | "chaos" | "shepard";
export interface NoteEvent {
  time: number;
  duration: number;
  frequency: number;
  velocity: number;
  waveform: OscillatorType;
  pan: number;
}
export interface Composition {
  events: NoteEvent[];
  duration: number;
  values: number[];
  label: string;
}
const SCALES: Record<string, number[]> = {
  "Lydian": [0, 2, 4, 6, 7, 9, 11],
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Minor": [0, 2, 3, 5, 7, 8, 10],
  "Pentatonic": [0, 2, 4, 7, 9]
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
function scaleNote(value: number, root: number, scale: string): number {
  const notes = SCALES[scale] ?? SCALES.Lydian;
  const degree = Math.floor(clamp(value, 0, 0.9999) * notes.length * 2);
  return root + 12 + Math.floor(degree / notes.length) * 12 + notes[degree % notes.length];
}
export function euclideanPattern(pulses: number, steps: number, rotation = 0): boolean[] {
  const n = Math.max(1, Math.floor(steps));
  const k = clamp(Math.floor(pulses), 0, n);
  const r = ((Math.floor(rotation) % n) + n) % n;
  return Array.from({ length: n }, (_, i) => Math.floor(((i + r) * k) / n) !== Math.floor(((i + r - 1) * k) / n));
}
export function mandelbrotEscape(cx: number, cy: number, maxIterations = 64): number {
  let x = 0, y = 0, iteration = 0;
  while (x * x + y * y <= 4 && iteration < maxIterations) {
    const nextX = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = nextX;
    iteration++;
  }
  return iteration;
}
export function logisticSequence(seed: number, r: number, count: number): number[] {
  let x = clamp(seed, 0.001, 0.999);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    x = r * x * (1 - x);
    out.push(clamp(x, 0, 1));
  }
  return out;
}
export function generateComposition(mode: Mode, options: {
  bpm?: number; root?: number; scale?: string; complexity?: number; seed?: number;
} = {}): Composition {
  const bpm = clamp(options.bpm ?? 108, 45, 180);
  const root = options.root ?? 60;
  const scale = options.scale ?? "Lydian";
  const complexity = clamp(options.complexity ?? 0.55, 0.1, 1);
  const seed = options.seed ?? 0.314159;
  const beat = 60 / bpm;
  const bars = 8;
  const steps = bars * 8;
  const duration = bars * 4 * beat;
  const events: NoteEvent[] = [];
  const values: number[] = [];
  const add = (step: number, value: number, velocity = 0.35, length = 0.42, wave: OscillatorType = "sine") => {
    const note = scaleNote(value, root, scale);
    events.push({ time: step * beat / 2, duration: length * beat, frequency: midiHz(note), velocity, waveform: wave, pan: Math.sin(step * 0.37) * 0.55 });
  };
  if (mode === "euclidean") {
    const pulses = Math.round(steps * (0.08 + complexity * 0.42));
    const rotation = Math.floor(seed * 10_007) % steps;
    const pattern = euclideanPattern(pulses, steps, rotation);
    pattern.forEach((hit, i) => {
      values.push(hit ? 1 : 0);
      if (hit) {
        add(i, (i % 8 === 0 ? 0.88 : 0.18 + ((i * 7) % 11) / 16), i % 8 === 0 ? 0.72 : 0.34, 0.28, i % 8 === 0 ? "triangle" : "sine");
      }
    });
  } else if (mode === "chaos") {
    const sequence = logisticSequence(seed, 3.72 + complexity * 0.27, steps);
    sequence.forEach((v, i) => { values.push(v); add(i, v, 0.2 + v * 0.38, 0.55, "triangle"); });
  } else if (mode === "mandelbrot") {
    // Complexity controls iteration depth and the vertical sweep through the set.
    // Seed controls the deterministic path through the complex plane.
    const maxIterations = Math.round(24 + complexity * 176);
    const seedPhase = ((Math.floor(seed * 1_000_003) % 10_007) / 10_007) * Math.PI * 2;
    const xShift = Math.sin(seedPhase) * 0.22;
    const yCenter = Math.cos(seedPhase * 1.37) * 0.24;
    const sweep = 0.035 + complexity * 0.23;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // Traverse a horizontal slice near the interesting cardioid/bulb boundary,
      // with a seeded, gentle vertical modulation so seeds alter the sampled path.
      const x = -1.95 + t * 2.65 + xShift;
      const y = yCenter + Math.sin(t * Math.PI * (1.5 + complexity * 2.5) + seedPhase) * sweep;
      const escape = mandelbrotEscape(x, y, maxIterations);
      const value = escape / maxIterations;
      values.push(value);
      if (escape < maxIterations || i % Math.max(1, Math.round(7 - complexity * 5)) === 0) {
        add(i, value, 0.18 + value * 0.42, 0.7, "sine");
      }
    }
  } else {
    // A Shepard illusion: overlapping octave layers rise while their envelopes crossfade.
    for (let i = 0; i < steps; i++) {
      const phase = i / steps;
      values.push(phase);
      const seedOffset = (seed % 1 + 1) % 1;
      for (let layer = 0; layer < 3; layer++) {
        const octavePosition = (phase * 2 + layer / 3 + seedOffset) % 1;
        const midi = root + 12 + octavePosition * 12;
        const center = 0.5;
        const envelope = Math.pow(Math.max(0, Math.cos((octavePosition - center) * Math.PI)), 1.7);
        events.push({ time: i * beat / 2, duration: beat * 0.72, frequency: midiHz(midi), velocity: 0.16 * envelope, waveform: "sine", pan: (layer - 1) * 0.48 });
      }
    }
  }
  return { events, duration, values, label: mode };
}