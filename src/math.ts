export type Mode = "mandelbrot" | "euclidean" | "chaos" | "shepard";
export interface NoteEvent {
  time: number;
  duration: number;
  frequency: number;
  velocity: number;
  velocityEnd?: number;
  waveform: OscillatorType;
  pan: number;
  voice?: "lead" | "answer" | "texture" | "bass" | "pad" | "percussion";
  percussionKind?: "kick" | "snare" | "hat";
}
export interface Composition {
  events: NoteEvent[];
  duration: number;
  values: number[];
  label: string;
  richInstruments: boolean;
  musicalArrangement: boolean;
  musicalExpression: boolean;
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
  richInstruments?: boolean; musicalArrangement?: boolean; musicalExpression?: boolean;
} = {}): Composition {
  const bpm = clamp(options.bpm ?? 108, 45, 180);
  const root = options.root ?? 60;
  const scale = options.scale ?? "Lydian";
  const complexity = clamp(options.complexity ?? 0.55, 0.1, 1);
  const seed = options.seed ?? 0.314159;
  const richInstruments = options.richInstruments ?? true;
  const musicalArrangement = options.musicalArrangement ?? true;
  const musicalExpression = options.musicalExpression ?? true;
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
  // A recognizable four-note motif is stated, transformed, intensified, then
  // recalled. The mathematical sequence chooses its intervals; the form chooses
  // when and how those intervals return.
  if (musicalExpression && mode !== "shepard") {
    const scaleNotes = SCALES[scale] ?? SCALES.Lydian;
    const source = values.length ? values : Array.from({ length: steps }, (_, i) => i / steps);
    const degreeAt = (step: number) => {
      const raw = source[step % source.length] ?? 0.5;
      const shaped = clamp(raw * 0.68 + (step % 8) / 7 * 0.32, 0, 0.999);
      return Math.floor(shaped * scaleNotes.length);
    };
    const motif = [0, 2, 4, 6].map(degreeAt);
    const sectionGain = [0.44, 0.52, 0.64, 0.72, 0.96, 0.9, 0.58, 0.38];
    for (let i = events.length - 1; i >= 0; i--) {
      if ((events[i].voice ?? "lead") === "lead") events.splice(i, 1);
    }
    const addLead = (bar: number, slot: number, degree: number, opts: {
      octave?: number; velocity?: number; durationBeats?: number; wave?: OscillatorType;
    } = {}) => {
      const midi = root + (opts.octave ?? 1) * 12 + scaleNotes[((degree % scaleNotes.length) + scaleNotes.length) % scaleNotes.length];
      events.push({
        time: bar * 4 * beat + slot * 0.5 * beat,
        duration: (opts.durationBeats ?? 0.62) * beat,
        frequency: midiHz(midi),
        velocity: clamp(opts.velocity ?? sectionGain[bar] * 0.78, 0.06, 0.94),
        waveform: opts.wave ?? "sine",
        pan: Math.sin((bar * 8 + slot) * 0.23) * 0.24,
        voice: "lead"
      });
    };

    // A: statement. The same four-note contour spans bars 1 and 2.
    addLead(0, 0, motif[0], { velocity: sectionGain[0] * 0.9, durationBeats: 1.05 });
    addLead(0, 4, motif[1], { velocity: sectionGain[0] * 0.78, durationBeats: 0.8 });
    addLead(1, 0, motif[2], { velocity: sectionGain[1] * 0.86, durationBeats: 1.0 });
    addLead(1, 4, motif[3], { velocity: sectionGain[1] * 0.82, durationBeats: 0.9 });

    // B: development. Keep the motif's contour but vary intervals and rhythm.
    const development = [
      { bar: 2, slots: [0, 2, 5, 7], degrees: [motif[0], motif[1] + 1, motif[2], motif[3]] },
      { bar: 3, slots: [0, 1, 4, 6, 7], degrees: [motif[0], motif[1], motif[2] + 1, motif[3], motif[2]] }
    ];
    for (const phrase of development) {
      phrase.slots.forEach((slot, i) => addLead(phrase.bar, slot, phrase.degrees[i], {
        velocity: sectionGain[phrase.bar] * (slot === 0 ? 0.92 : 0.74),
        durationBeats: 0.42 + (i % 2) * 0.12
      }));
    }

    // C: climax. The motif is sequenced more quickly in a higher register.
    const climaxContour = [motif[0], motif[1], motif[2] + 1, motif[3] + 1, motif[2], motif[3], motif[1] + 1, motif[3] + 2];
    for (const bar of [4, 5]) {
      climaxContour.forEach((degree, i) => addLead(bar, i, degree + (bar === 5 ? 1 : 0), {
        octave: 2,
        velocity: sectionGain[bar] * (i === 0 || i === 4 ? 0.96 : 0.82),
        durationBeats: 0.38,
        wave: "triangle"
      }));
    }

    // D: reprise and cadence. Recall the opening rhythm and contour, then
    // replace the final motif tone with the tonic and let it ring to bar end.
    addLead(6, 0, motif[0], { velocity: sectionGain[6] * 0.9, durationBeats: 1.0 });
    addLead(6, 4, motif[1], { velocity: sectionGain[6] * 0.78, durationBeats: 0.85 });
    addLead(7, 0, motif[2], { velocity: sectionGain[7] * 0.82, durationBeats: 1.0 });
    addLead(7, 4, 0, { velocity: 0.48, durationBeats: 1.95, wave: "triangle" });
  }
  // Optional harmonic foundation: four two-bar chords and bass pulses.
  if (musicalArrangement) {
  const scaleNotes = SCALES[scale] ?? SCALES.Lydian;
  const progression = scale === "Minor" ? [0, 5, 3, 0] : [0, 3, 4, 0];
  const accompanimentArc = [0.38, 0.48, 0.62, 0.74, 1.0, 0.94, 0.55, 0.28];
  const chordRoots: number[] = [];
  let previousVoicing = [root + 12, root + 16, root + 19];
  for (let section = 0; section < 4; section++) {
    // The average mathematical output gently selects nearby harmonic colors;
    // the functional progression keeps the result musically grounded.
    const sectionValues = values.slice(section * 16, (section + 1) * 16);
    const mean = sectionValues.length ? sectionValues.reduce((sum, value) => sum + value, 0) / sectionValues.length : 0.5;
    const degree = progression[section];
    const chordRoot = root + scaleNotes[degree % scaleNotes.length];
    chordRoots.push(chordRoot);
    const triad = [0, 2, 4].map(offset => {
      const index = degree + offset;
      return root + 12 + scaleNotes[index % scaleNotes.length] + (index >= scaleNotes.length ? 12 : 0);
    });
    const previous = section === 0 ? [root + 12, root + 16, root + 19] : previousVoicing;
    const candidates = [0, 1, 2].map(inversion => {
      const rotated = [...triad.slice(inversion), ...triad.slice(0, inversion).map(note => note + 12)];
      return rotated.map((note, voice) => {
        const target = previous[voice];
        return [note - 12, note, note + 12, note + 24]
          .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      });
    });
    const voicing = candidates.sort((a, b) =>
      a.reduce((sum, note, i) => sum + Math.abs(note - previous[i]), 0) -
      b.reduce((sum, note, i) => sum + Math.abs(note - previous[i]), 0)
    )[0];
    previousVoicing = voicing;
    const seventhIndex = degree + 6;
    const seventh = root + 12 + scaleNotes[seventhIndex % scaleNotes.length] +
      (seventhIndex >= scaleNotes.length ? 12 : 0);
    const chordTime = section * 2 * 4 * beat;
    for (let voice = 0; voice < 3; voice++) {
      const tone = voicing[voice];
      const pan = (voice - 1) * 0.3;
      const sectionLevel = musicalExpression ? [0.52, 0.72, 1, 0.42][section] : 1;
      events.push({ time: chordTime, duration: 7.7 * beat, frequency: midiHz(tone), velocity: 0.085 * sectionLevel, waveform: "triangle", pan, voice: "pad" });
    }
    // A soft diatonic seventh adds color without muddying the triad.
    events.push({ time: chordTime, duration: 7.7 * beat, frequency: midiHz(seventh), velocity: 0.026 * (0.7 + mean * 0.5), waveform: "sine", pan: 0.12, voice: "pad" });
    for (let bar = 0; bar < 2; bar++) {
      const absoluteBar = section * 2 + bar;
      const bassTime = chordTime + bar * 4 * beat;
      const arc = musicalExpression ? accompanimentArc[absoluteBar] : 1;
      events.push({ time: bassTime, duration: 1.65 * beat, frequency: midiHz(chordRoot - 12), velocity: 0.24 * arc, waveform: "triangle", pan: -0.08, voice: "bass" });
      events.push({ time: bassTime + 2 * beat, duration: 1.25 * beat, frequency: midiHz(chordRoot - 12), velocity: 0.15 * arc, waveform: "triangle", pan: 0.08, voice: "bass" });
    }
  }
    // Bass approaches the next chord just before each two-bar harmonic change.
    for (let section = 0; section < 3; section++) {
      const bar = section * 2 + 1;
      const arc = musicalExpression ? accompanimentArc[bar] : 1;
      events.push({
        time: (section + 1) * 8 * beat - 0.5 * beat,
        duration: 0.38 * beat,
        frequency: midiHz(chordRoots[section + 1] - 12),
        velocity: 0.11 * arc,
        waveform: "triangle",
        pan: 0,
        voice: "bass"
      });
    }
    if (musicalExpression) {
      const drumBars = [
        [{ slot: 0, kind: "kick" as const, level: 0.34 }],
        [{ slot: 0, kind: "kick" as const, level: 0.42 }],
        [{ slot: 0, kind: "kick" as const, level: 0.5 }, { slot: 4, kind: "snare" as const, level: 0.26 }],
        [{ slot: 0, kind: "kick" as const, level: 0.58 }, { slot: 4, kind: "snare" as const, level: 0.34 }, { slot: 6, kind: "hat" as const, level: 0.12 }],
        [{ slot: 0, kind: "kick" as const, level: 0.78 }, { slot: 2, kind: "hat" as const, level: 0.2 }, { slot: 4, kind: "snare" as const, level: 0.52 }, { slot: 6, kind: "hat" as const, level: 0.2 }],
        [{ slot: 0, kind: "kick" as const, level: 0.74 }, { slot: 2, kind: "hat" as const, level: 0.18 }, { slot: 3, kind: "kick" as const, level: 0.34 }, { slot: 4, kind: "snare" as const, level: 0.5 }, { slot: 6, kind: "hat" as const, level: 0.2 }],
        [{ slot: 0, kind: "kick" as const, level: 0.42 }, { slot: 4, kind: "snare" as const, level: 0.22 }],
        [{ slot: 0, kind: "kick" as const, level: 0.24 }]
      ];
      drumBars.forEach((hits, bar) => hits.forEach(hit => {
        events.push({
          time: bar * 4 * beat + hit.slot * 0.5 * beat,
          duration: hit.kind === "kick" ? 0.22 : hit.kind === "snare" ? 0.16 : 0.055,
          frequency: hit.kind === "kick" ? 90 : hit.kind === "snare" ? 180 : 6200,
          velocity: hit.level,
          waveform: hit.kind === "kick" ? "sine" : hit.kind === "snare" ? "triangle" : "square",
          pan: hit.kind === "hat" ? 0.18 : 0,
          voice: "percussion",
          percussionKind: hit.kind
        });
      }));
    }
  }
  events.sort((a, b) => a.time - b.time);
  return { events, duration, values, label: mode, richInstruments, musicalArrangement, musicalExpression };
}