export type Mode = "mandelbrot" | "euclidean" | "chaos" | "shepard";
export const COMPOSITION_BARS = 16;
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
interface SequenceSectionProfile {
  mean: number;
  trend: number;
  movement: number;
  centroid: number;
}

function analyzeSequenceSection(values: readonly number[], section: number): SequenceSectionProfile {
  const source = values.length ? values : [0.5];
  const start = Math.floor(section * source.length / 8);
  const end = Math.max(start + 1, Math.floor((section + 1) * source.length / 8));
  const segment = source.slice(start, end).map(value => clamp(value, 0, 1));
  const safe = segment.length ? segment : [0.5];
  const mean = safe.reduce((sum, value) => sum + value, 0) / safe.length;
  const quarter = Math.max(1, Math.floor(safe.length / 4));
  const first = safe.slice(0, quarter), last = safe.slice(-quarter);
  const trend = last.reduce((sum, value) => sum + value, 0) / last.length -
    first.reduce((sum, value) => sum + value, 0) / first.length;
  const movement = safe.slice(1).reduce(
    (sum, value, index) => sum + Math.abs(value - safe[index]), 0
  ) / Math.max(1, safe.length - 1);
  const total = safe.reduce((sum, value) => sum + value, 0);
  const centroid = total > 1e-9
    ? safe.reduce((sum, value, index) => sum + value * (index / Math.max(1, safe.length - 1)), 0) / total
    : 0.5;
  return { mean, trend, movement, centroid };
}

/** Derive a deterministic, scale-aware chord path from the mathematical sequence. */
export function deriveHarmonicProgression(values: readonly number[], scale = "Lydian"): number[] {
  const source = values.length ? values.map(value => clamp(value, 0, 1)) : [0.5];
  const globalMean = source.reduce((sum, value) => sum + value, 0) / source.length;
  let real = 0, imaginary = 0;
  source.forEach((value, index) => {
    const centered = value - globalMean;
    const angle = (index + 1) * 2.399963229728653;
    real += centered * Math.cos(angle);
    imaginary += centered * Math.sin(angle);
  });
  const phase = Math.hypot(real, imaginary) > 1e-9
    ? ((Math.atan2(imaginary, real) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)
    : 0.5;

  const palettes = scale === "Minor"
    ? [[0], [5, 3, 1], [3, 6, 2], [2, 4, 4], [0, 5, 3], [5, 3, 1], [4, 4, 6], [0]]
    : scale === "Pentatonic"
      ? [[0], [3, 2, 1], [2, 4, 3], [4, 2, 4], [0, 2, 3], [3, 1, 2], [4, 4, 3], [0]]
      : [[0], [5, 3, 1], [2, 5, 1], [2, 4, 4], [0, 5, 2], [3, 5, 1], [4, 4, 6], [0]];

  return palettes.map((candidates, section) => {
    if (candidates.length === 1) return candidates[0];
    const profile = analyzeSequenceSection(source, section);
    const localCharacter = clamp(
      profile.mean * 0.3 + (profile.trend * 1.5 + 0.5) * 0.22 +
      clamp(profile.movement * 2.5, 0, 1) * 0.18 + profile.centroid * 0.3,
      0, 0.999
    );
    const phrasePhase = (phase + section * 0.17320508075688773) % 1;
    const selector = clamp(localCharacter * 0.55 + phrasePhase * 0.45, 0, 0.999);
    return candidates[Math.floor(selector * candidates.length)];
  });
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
  const bpm = clamp(options.bpm ?? 128, 45, 180);
  const root = options.root ?? 60;
  const scale = options.scale ?? "Lydian";
  const complexity = clamp(options.complexity ?? 0.55, 0.1, 1);
  const seed = options.seed ?? 0.314159;
  const richInstruments = options.richInstruments ?? true;
  const musicalArrangement = options.musicalArrangement ?? true;
  const musicalExpression = options.musicalExpression ?? true;
  const beat = 60 / bpm;
  const bars = COMPOSITION_BARS;
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
  // A recognizable four-note motif now unfolds over four connected
  // four-bar movements: statement, development, climax, and reprise/cadence.
  // The final bar of each movement contains a pickup into the next movement.
  const scaleNotes = SCALES[scale] ?? SCALES.Lydian;
  const chordProgression = deriveHarmonicProgression(values, scale);

  if (musicalExpression && mode !== "shepard") {
    const source = values.length ? values : Array.from({ length: steps }, (_, i) => i / steps);
    const degreeAt = (step: number) => {
      const raw = source[step % source.length] ?? 0.5;
      const shaped = clamp(raw * 0.68 + (step % 8) / 7 * 0.32, 0, 0.999);
      return Math.floor(shaped * scaleNotes.length);
    };
    const motif = [0, 2, 4, 6].map(degreeAt);
    const sectionGain = [
      0.38, 0.42, 0.46, 0.5,
      0.56, 0.62, 0.68, 0.74,
      0.84, 0.94, 1.0, 0.96,
      0.78, 0.68, 0.52, 0.3
    ];
    for (let i = events.length - 1; i >= 0; i--) {
      if ((events[i].voice ?? "lead") === "lead") events.splice(i, 1);
    }
    const addLead = (bar: number, slot: number, degree: number, opts: {
      octave?: number; velocity?: number; durationBeats?: number; wave?: OscillatorType;
    } = {}) => {
      const scaleDegree = ((degree % scaleNotes.length) + scaleNotes.length) % scaleNotes.length;
      const midi = root + (opts.octave ?? 1) * 12 + scaleNotes[scaleDegree];
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

    // I. Opening: let the motif breathe before stating it more clearly.
    addLead(0, 0, motif[0], { velocity: sectionGain[0] * 0.9, durationBeats: 1.2 });
    addLead(0, 4, motif[1], { velocity: sectionGain[0] * 0.78, durationBeats: 0.95 });
    addLead(1, 0, motif[2], { velocity: sectionGain[1] * 0.86, durationBeats: 1.1 });
    addLead(1, 4, motif[3], { velocity: sectionGain[1] * 0.82, durationBeats: 0.95 });
    [motif[0], motif[1], motif[2], motif[3]].forEach((degree, i) =>
      addLead(2, i * 2, degree, {
        velocity: sectionGain[2] * (i === 0 ? 0.9 : 0.72),
        durationBeats: 0.72
      })
    );
    addLead(3, 0, motif[2], { velocity: sectionGain[3] * 0.8, durationBeats: 0.8 });
    addLead(3, 4, motif[3], { velocity: sectionGain[3] * 0.76, durationBeats: 0.55 });

    // II. Development: fragment, vary and reassemble the motif.
    const development = [
      { bar: 4, slots: [0, 2, 5, 7], degrees: [motif[0], motif[1] + 1, motif[2], motif[3]] },
      { bar: 5, slots: [0, 1, 4, 6, 7], degrees: [motif[0], motif[1], motif[2] + 1, motif[3], motif[2]] },
      { bar: 6, slots: [0, 2, 4, 6], degrees: [motif[1], motif[2], motif[3] + 1, motif[2]] },
      { bar: 7, slots: [0, 2, 4], degrees: [motif[0], motif[2], motif[3]] }
    ];
    for (const phrase of development) {
      const profile = analyzeSequenceSection(source, Math.floor(phrase.bar / 2));
      const directionalShift = profile.trend > 0.08 ? 1 : profile.trend < -0.08 ? -1 : 0;
      const ornamentShift = profile.movement > 0.36 ? 1 : 0;
      phrase.slots.forEach((slot, i) => {
        const sourceDegree = phrase.degrees[i];
        const phraseDegree = sourceDegree + (i % 2 === 1
          ? directionalShift : i === 2 ? ornamentShift : 0);
        addLead(phrase.bar, slot, phraseDegree, {
          velocity: sectionGain[phrase.bar] * (slot === 0 ? 0.92 : 0.74),
          durationBeats: 0.42 + (i % 2) * 0.12
        });
      });
    }

    // III. Climax: the sequence's own level and direction shape its melodic arc.
    const climaxValues = source.slice(64, 96);
    const climaxMean = climaxValues.reduce((sum, value) => sum + value, 0) / Math.max(1, climaxValues.length);
    const overallMean = source.reduce((sum, value) => sum + value, 0) / source.length;
    const climaxQuarter = Math.max(1, Math.floor(climaxValues.length / 4));
    const climaxTrend = climaxValues.slice(-climaxQuarter).reduce((sum, value) => sum + value, 0) / climaxQuarter -
      climaxValues.slice(0, climaxQuarter).reduce((sum, value) => sum + value, 0) / climaxQuarter;
    const climaxLift = climaxMean >= overallMean ? 2 : 1;
    const climaxTurn = climaxTrend >= 0 ? 1 : -1;
    const climaxContour = [
      motif[0], motif[1], motif[2] + climaxLift, motif[3] + climaxLift,
      motif[2] + climaxTurn, motif[3] + climaxTurn,
      motif[1] + climaxLift, motif[3] + climaxLift + climaxTurn
    ];
    for (const bar of [8, 9, 10, 11]) {
      climaxContour.forEach((degree, i) => addLead(bar, i, degree + (bar === 9 || bar === 10 ? 1 : 0), {
        octave: 2,
        velocity: sectionGain[bar] * (i === 0 || i === 4 ? 0.96 : 0.82),
        durationBeats: bar === 11 ? 0.32 : 0.38,
        wave: "triangle"
      }));
    }

    // IV. Reprise: bring the original contour back down, then resolve.
    addLead(12, 0, motif[0], { velocity: sectionGain[12] * 0.9, durationBeats: 1.15 });
    addLead(12, 4, motif[1], { velocity: sectionGain[12] * 0.78, durationBeats: 0.95 });
    addLead(13, 0, motif[2], { velocity: sectionGain[13] * 0.86, durationBeats: 1.1 });
    addLead(13, 4, motif[3], { velocity: sectionGain[13] * 0.78, durationBeats: 0.95 });
    addLead(14, 0, motif[0], { velocity: sectionGain[14] * 0.82, durationBeats: 1.0 });
    addLead(14, 4, motif[1], { velocity: sectionGain[14] * 0.68, durationBeats: 0.85 });
    addLead(14, 6, scaleNotes.length - 1, { velocity: 0.34, durationBeats: 0.3 });
    addLead(15, 0, 0, { velocity: 0.38, durationBeats: 3.82, wave: "triangle" });

    // Transitional pickups point toward the next harmonic destination.
    for (const bar of [3, 7, 11]) {
      const nextChordIndex = Math.floor((bar + 1) / 2);
      const targetDegree = chordProgression[nextChordIndex];
      const transitionGain = sectionGain[bar];
      addLead(bar, 6, targetDegree - 1, {
        velocity: transitionGain * 0.66, durationBeats: 0.28
      });
      addLead(bar, 7, targetDegree, {
        velocity: transitionGain * 0.78, durationBeats: 0.26
      });
    }
  }

  // Optional harmonic foundation: eight two-bar chords, voice-led bass motion,
  // overlapping pad releases and anticipations into every new harmony.
  if (musicalArrangement) {
    const accompanimentArc = [
      0.34, 0.4, 0.46, 0.52,
      0.58, 0.64, 0.7, 0.76,
      0.92, 1.0, 1.0, 0.94,
      0.74, 0.62, 0.46, 0.28
    ];
    const chordLevels = [0.42, 0.5, 0.58, 0.68, 0.82, 1.0, 0.72, 0.38];
    const chordRoots: number[] = [];
    let previousVoicing = [root + 12, root + 16, root + 19];

    for (let section = 0; section < 8; section++) {
      const profile = analyzeSequenceSection(values, section);
      const degree = chordProgression[section];
      const chordRoot = root + scaleNotes[degree % scaleNotes.length];
      chordRoots.push(chordRoot);
      const triad = [0, 2, 4].map(offset => {
        const index = degree + offset;
        return root + 12 + scaleNotes[index % scaleNotes.length] +
          (index >= scaleNotes.length ? 12 : 0);
      });
      const previous = section === 0 ? [root + 12, root + 16, root + 19] : previousVoicing;
      const candidates = [0, 1, 2].map(inversion => {
        const rotated = [...triad.slice(inversion), ...triad.slice(0, inversion).map(note => note + 12)];
        return rotated.map((note, voice) => {
          const target = previous[voice];
          return [note - 12, note, note + 12, note + 24]
            .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
        }).sort((a, b) => a - b);
      });
      const voiceLeadingCost = (candidate: number[]) => candidate.reduce((sum, note, voice) => {
        const movement = Math.abs(note - previous[voice]);
        return sum + movement + Math.max(0, movement - 7) * 0.5;
      }, 0);
      const voicing = candidates.sort((a, b) =>
        voiceLeadingCost(a) - voiceLeadingCost(b)
      )[0];
      previousVoicing = voicing;
      const seventhIndex = degree + 6;
      const seventh = root + 12 + scaleNotes[seventhIndex % scaleNotes.length] +
        (seventhIndex >= scaleNotes.length ? 12 : 0);
      const chordTime = section * 8 * beat;
      const chordDuration = (section === 7 ? 8 : 8.48) * beat;
      const sequenceLevel = 0.84 + profile.mean * 0.2 + profile.movement * 0.12;
      const chordLevel = chordLevels[section] * sequenceLevel;

      for (let voice = 0; voice < 3; voice++) {
        const tone = voicing[voice];
        const pan = (voice - 1) * 0.3;
        const velocity = 0.078 * chordLevel;
        events.push({
          time: chordTime, duration: chordDuration, frequency: midiHz(tone),
          velocity, velocityEnd: section === 7 ? 0.002 : velocity * 0.3,
          waveform: "triangle", pan, voice: "pad"
        });
      }
      const seventhVelocity = 0.02 * (0.7 + profile.mean * 0.5) * chordLevel;
      events.push({
        time: chordTime, duration: chordDuration, frequency: midiHz(seventh),
        velocity: seventhVelocity, velocityEnd: section === 7 ? 0.001 : seventhVelocity * 0.3,
        waveform: "sine", pan: 0.12, voice: "pad"
      });

      for (let bar = 0; bar < 2; bar++) {
        const absoluteBar = section * 2 + bar;
        const bassTime = chordTime + bar * 4 * beat;
        const arc = musicalExpression ? accompanimentArc[absoluteBar] : 0.72;
        events.push({
          time: bassTime, duration: 1.55 * beat, frequency: midiHz(chordRoot - 12),
          velocity: 0.22 * arc * (0.86 + profile.mean * 0.22 + profile.movement * 0.12), waveform: "triangle", pan: -0.08, voice: "bass"
        });
        events.push({
          time: bassTime + 2 * beat, duration: 1.05 * beat, frequency: midiHz(chordRoot - 5),
          velocity: 0.13 * arc * (0.86 + profile.mean * 0.22 + profile.movement * 0.12), waveform: "triangle", pan: 0.08, voice: "bass"
        });
      }
    }

    // A short bass approach anticipates every two-bar chord change.
    for (let section = 1; section < 8; section++) {
      const bar = section * 2 - 1;
      const time = section * 8 * beat - 0.5 * beat;
      const profile = analyzeSequenceSection(values, section);
      const arc = (musicalExpression ? accompanimentArc[bar] : 0.72) *
        (0.86 + profile.mean * 0.22 + profile.movement * 0.12);
      events.push({
        time, duration: 0.36 * beat, frequency: midiHz(chordRoots[section] - 13),
        velocity: 0.12 * arc, waveform: "triangle", pan: 0, voice: "bass"
      });
    }

    if (musicalExpression) {
      const drumBars: Array<Array<{ slot: number; kind: "kick" | "snare" | "hat"; level: number }>> = [
        [{ slot: 0, kind: "kick", level: 0.26 }],
        [{ slot: 0, kind: "kick", level: 0.28 }],
        [{ slot: 0, kind: "kick", level: 0.32 }, { slot: 4, kind: "snare", level: 0.16 }],
        [{ slot: 0, kind: "kick", level: 0.38 }, { slot: 4, kind: "snare", level: 0.2 }, { slot: 6, kind: "hat", level: 0.1 }, { slot: 7, kind: "snare", level: 0.22 }],
        [{ slot: 0, kind: "kick", level: 0.4 }],
        [{ slot: 0, kind: "kick", level: 0.44 }, { slot: 4, kind: "snare", level: 0.22 }],
        [{ slot: 0, kind: "kick", level: 0.48 }, { slot: 6, kind: "hat", level: 0.12 }],
        [{ slot: 0, kind: "kick", level: 0.54 }, { slot: 4, kind: "snare", level: 0.28 }, { slot: 6, kind: "hat", level: 0.14 }, { slot: 7, kind: "snare", level: 0.25 }],
        [{ slot: 0, kind: "kick", level: 0.7 }, { slot: 2, kind: "hat", level: 0.18 }, { slot: 4, kind: "snare", level: 0.42 }, { slot: 6, kind: "hat", level: 0.18 }],
        [{ slot: 0, kind: "kick", level: 0.74 }, { slot: 2, kind: "hat", level: 0.18 }, { slot: 4, kind: "snare", level: 0.44 }, { slot: 6, kind: "hat", level: 0.18 }],
        [{ slot: 0, kind: "kick", level: 0.78 }, { slot: 2, kind: "hat", level: 0.2 }, { slot: 3, kind: "kick", level: 0.3 }, { slot: 4, kind: "snare", level: 0.48 }, { slot: 6, kind: "hat", level: 0.2 }],
        [{ slot: 0, kind: "kick", level: 0.74 }, { slot: 2, kind: "hat", level: 0.18 }, { slot: 4, kind: "snare", level: 0.44 }, { slot: 6, kind: "hat", level: 0.18 }, { slot: 7, kind: "snare", level: 0.3 }],
        [{ slot: 0, kind: "kick", level: 0.46 }, { slot: 4, kind: "snare", level: 0.22 }],
        [{ slot: 0, kind: "kick", level: 0.4 }],
        [{ slot: 0, kind: "kick", level: 0.32 }, { slot: 4, kind: "snare", level: 0.16 }],
        [{ slot: 0, kind: "kick", level: 0.22 }]
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