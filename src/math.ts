export type Mode = "mandelbrot" | "euclidean" | "chaos" | "shepard";
export interface NoteEvent {
  time: number;
  duration: number;
  frequency: number;
  velocity: number;
  waveform: OscillatorType;
  pan: number;
  voice?: "lead" | "bass" | "pad";
}
export interface Composition {
  events: NoteEvent[];
  duration: number;
  values: number[];
  label: string;
  richInstruments: boolean;
  musicalArrangement: boolean;
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
  richInstruments?: boolean; musicalArrangement?: boolean;
} = {}): Composition {
  const bpm = clamp(options.bpm ?? 108, 45, 180);
  const root = options.root ?? 60;
  const scale = options.scale ?? "Lydian";
  const complexity = clamp(options.complexity ?? 0.55, 0.1, 1);
  const seed = options.seed ?? 0.314159;
  const richInstruments = options.richInstruments ?? true;
  const musicalArrangement = options.musicalArrangement ?? true;
  const beat = 60 / bpm;
  const bars = 8;
  const steps = bars * 8;
  const duration = bars * 4 * beat;
  const events: NoteEvent[] = [];
  const values: number[] = [];
  const add = (step: number, value: number, velocity = 0.35, length = 0.42, wave: OscillatorType = "sine") => {
    const note = scaleNote(value, root, scale);
    const beatInBar = step % 8;
    const bar = Math.floor(step / 8);
    const phraseAccent = musicalArrangement ? (beatInBar === 0 ? 1.42 : beatInBar === 4 ? 1.16 : 1) : 1;
    const cadenceAccent = musicalArrangement && bar === 7 && beatInBar >= 4 ? 1.3 : 1;
    const phraseVelocity = clamp(velocity * phraseAccent * cadenceAccent, 0.08, 0.92);
    const phraseLength = length * (musicalArrangement ? (beatInBar === 0 ? 1.28 : beatInBar === 7 ? 0.68 : 1) : 1);
    events.push({ time: step * beat / 2, duration: phraseLength * beat, frequency: midiHz(note), velocity: phraseVelocity, waveform: wave, pan: Math.sin(step * 0.37) * 0.55, voice: "lead" });
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
  // Optional harmonic foundation: four two-bar chords and bass pulses.
  if (musicalArrangement) {
  const scaleNotes = SCALES[scale] ?? SCALES.Lydian;
  const progression = scale === "Minor" ? [0, 5, 2, 6] : [0, 4, 5, 3];
  for (let section = 0; section < 4; section++) {
    // The average mathematical output gently selects nearby harmonic colors;
    // the functional progression keeps the result musically grounded.
    const sectionValues = values.slice(section * 16, (section + 1) * 16);
    const mean = sectionValues.length ? sectionValues.reduce((sum, value) => sum + value, 0) / sectionValues.length : 0.5;
    const dataNudge = Math.round((mean - 0.5) * 2);
    const degree = (progression[section] + (section === 0 || section === 3 ? 0 : dataNudge + scaleNotes.length)) % scaleNotes.length;
    const chordRoot = root + scaleNotes[degree % scaleNotes.length];
    const thirdIndex = degree + 2;
    const fifthIndex = degree + 4;
    const chordThird = root + scaleNotes[thirdIndex % scaleNotes.length] + (thirdIndex >= scaleNotes.length ? 12 : 0);
    const chordFifth = root + scaleNotes[fifthIndex % scaleNotes.length] + (fifthIndex >= scaleNotes.length ? 12 : 0);
    const chordTime = section * 2 * 4 * beat;
    for (const [tone, pan] of [[chordRoot + 12, -0.32], [chordThird + 12, 0], [chordFifth + 12, 0.32]] as const) {
      events.push({ time: chordTime, duration: 7.7 * beat, frequency: midiHz(tone), velocity: 0.075, waveform: "triangle", pan, voice: "pad" });
    }
    for (let bar = 0; bar < 2; bar++) {
      const bassTime = chordTime + bar * 4 * beat;
      events.push({ time: bassTime, duration: 1.65 * beat, frequency: midiHz(chordRoot - 12), velocity: 0.24, waveform: "triangle", pan: -0.08, voice: "bass" });
      events.push({ time: bassTime + 2 * beat, duration: 1.25 * beat, frequency: midiHz(chordRoot - 12), velocity: 0.15, waveform: "triangle", pan: 0.08, voice: "bass" });
    }
  }
  }
  events.sort((a, b) => a.time - b.time);
  return { events, duration, values, label: mode, richInstruments, musicalArrangement };
}