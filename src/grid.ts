import type { Composition, NoteEvent } from "./math";

/** Scene ordering and equations displayed in the 67-second reference video. */
export const GRID_DURATION_SECONDS = 67;
export const GRID_FREQUENCY_HZ = 60;
export const GRID_STAGES = [
  { id: "sine", from: 0, to: 5, equation: "u(t) = sin(2π · 60t)" },
  { id: "three-phase", from: 5, to: 12, equation: "uₖ = sin(ωt − 2πk/3); Σuₖ = 0" },
  { id: "peak-load", from: 12, to: 21, equation: "P(t) = p₁ + p₂ + … + pₙ ≤ Pmax" },
  { id: "transformer", from: 21, to: 25, equation: "B(t) = tanh(g sin(ωt)) / tanh(g)" },
  { id: "line-sag", from: 25, to: 33, equation: "yₙ = A sin(nπx/L) cos(2πfₙt); fₙ = n√(T/μ)/(2L)" },
  { id: "arc-fault", from: 33, to: 40, equation: "v_arc(t) = Vₐ sgn(sin(ωt))" },
  { id: "alarm", from: 40, to: 47, equation: "Δf = −f₀ ΔP t / (2H)" },
  { id: "load-shed", from: 47, to: 53, equation: "f = f₀ + (Pgen − Pload)/D" },
  { id: "cascade", from: 53, to: 63, equation: "N(g+1) = k N(g), k > 1" },
  { id: "blackout", from: 63, to: 67, equation: "u(t) = sin(2πft), f → 0" }
] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const TAU = 2 * Math.PI;
export function gridVoltage(t: number, f = GRID_FREQUENCY_HZ): number {
  return Math.sin(TAU * f * t);
}
export function gridThreePhase(t: number, phaseIndex: 0 | 1 | 2, f = GRID_FREQUENCY_HZ): number {
  return Math.sin(TAU * f * t - TAU * phaseIndex / 3);
}
export function gridPowerLoad(t: number): number {
  const districtDemand = [0.14, 0.12, 0.16, 0.13, 0.17, 0.15, 0.13];
  const switchedOn = clamp(Math.floor((t - 12) / 1.25) + 1, 0, districtDemand.length);
  return 0.40 + districtDemand.slice(0, switchedOn).reduce((sum, demand) => sum + demand, 0);
}
export function gridTransformerFlux(t: number, gain: number): number {
  const g = Math.max(0.0001, gain);
  return Math.tanh(g * gridVoltage(t)) / Math.tanh(g);
}
export function gridLineFrequency(n: number, length: number, tension: number, massPerLength: number): number {
  return n / (2 * length) * Math.sqrt(tension / massPerLength);
}
export function gridLineDisplacement(
  n: number, x: number, t: number, amplitude = 1, length = 1, tension = 14400, massPerLength = 1
): number {
  return amplitude * Math.sin(n * Math.PI * x / length) *
    Math.cos(TAU * gridLineFrequency(n, length, tension, massPerLength) * t);
}
export function gridArcVoltage(t: number, amplitude = 1): number {
  return amplitude * Math.sign(gridVoltage(t));
}
export function gridSwingFrequency(f0: number, deltaPower: number, elapsed: number, inertia: number): number {
  return f0 - f0 * deltaPower * elapsed / (2 * inertia);
}
export function gridLoadShedFrequency(f0: number, generation: number, demand: number, damping: number): number {
  return f0 + (generation - demand) / damping;
}
export function gridCascadePopulation(initial: number, multiplier: number, generation: number): number {
  return initial * Math.pow(multiplier, generation);
}

/** Smooth, reference-shaped physical-frequency trajectory; its parameters are illustrative. */
export function gridFrequencyAt(t: number): number {
  const s = clamp(t, 0, GRID_DURATION_SECONDS);
  if (s < 40) return GRID_FREQUENCY_HZ - 0.014 * s;
  const alarmStart = GRID_FREQUENCY_HZ - 0.014 * 40;
  if (s < 47) return gridSwingFrequency(alarmStart, 0.015, s - 40, 10);
  if (s < 53) {
    const elapsed = s - 47;
    const demand = 1.12 - Math.floor(elapsed) * 0.008 + elapsed * 0.006;
    return gridLoadShedFrequency(59.2, 1, demand, 0.3);
  }
  const shedEnd = gridLoadShedFrequency(59.2, 1, 1.12 - 5 * 0.008 + 6 * 0.006, 0.3);
  if (s < 63) return shedEnd - 0.055 * (Math.pow(2, (s - 53) * 0.42) - 1);
  const collapseStart = shedEnd - 0.055 * (Math.pow(2, 10 * 0.42) - 1);
  return Math.max(0, collapseStart * (1 - Math.pow((s - 63) / 4, 3)));
}
export function gridStageAt(t: number): typeof GRID_STAGES[number] {
  return GRID_STAGES.find(stage => t >= stage.from && t < stage.to) ?? GRID_STAGES[GRID_STAGES.length - 1];
}

/** Display samples summarize the stage functions, not a fabricated physical sample clock. */
export function gridTimelineValue(t: number): number {
  const stage = gridStageAt(t).id;
  if (stage === "sine") return 0.5 + 0.44 * gridVoltage(t);
  if (stage === "three-phase") return 0.5 + 0.44 * gridThreePhase(t, 0);
  if (stage === "peak-load") return clamp(gridPowerLoad(t) / 1.4, 0, 1);
  if (stage === "transformer") return 0.5 + 0.44 * gridTransformerFlux(t, 1.8 + (t - 21) * 0.85);
  if (stage === "line-sag") return 0.5 + 0.44 * gridLineDisplacement(1, 0.5, t);
  if (stage === "arc-fault") return 0.5 + 0.43 * gridArcVoltage(t);
  if (stage === "alarm") return 0.5 + 0.44 * gridVoltage(t, gridFrequencyAt(t));
  if (stage === "load-shed") return 0.5 + 0.36 * gridVoltage(t, gridFrequencyAt(t));
  if (stage === "cascade") return clamp(1 - gridCascadePopulation(1, 2, Math.floor((t - 53) / 1.6)) / 90, 0, 1);
  return 0.5 + 0.44 * gridVoltage(t, gridFrequencyAt(t)) * Math.pow((67 - t) / 4, 2);
}

/** Grid-specific oscillator score, avoiding the unrelated piano/16-bar song pipeline. */
export function generateGridComposition(): Composition {
  const events: NoteEvent[] = [];
  const add = (
    time: number, duration: number, frequency: number, velocity: number,
    gridKind: NonNullable<NoteEvent["gridKind"]>, pan = 0, extra: Partial<NoteEvent> = {}
  ) => events.push({
    time, duration, frequency, velocity, waveform: "sine", pan, voice: "grid", gridKind, ...extra
  });
  // Reference spectral peaks: electrical fundamental and 2nd, 4th, 8th harmonics.
  add(0, 66.98, 60, 0.022, "fundamental");
  add(0, 66.98, 120, 0.011, "harmonic", -0.14);
  add(0, 66.98, 240, 0.011, "harmonic", 0.14);
  add(0, 66.98, 480, 0.016, "harmonic", 0.08);
  // Additional deterministic harmonics fill the reference's upper-frequency energy.
  for (const [ratio, level] of [[6,0.0065],[7,0.0065],[9,0.0055],[10,0.0055],[12,0.0075],
    [14,0.0045],[16,0.007],[20,0.005],[24,0.0045],[30,0.003],[32,0.0035],
    [40,0.0035],[48,0.0024],[60,0.0018]] as const) {
    add(0, 66.98, 60 * ratio, level, "harmonic", Math.sin(ratio) * 0.3);
  }

  for (let k = 0; k < 3; k++) {
    add(5, 7, 60, 0.018, "phase", (k - 1) * 0.65, { gridPhase: -TAU * k / 3 });
  }
  for (let t = 12; t < 21; t += 1.25) {
    const load = gridPowerLoad(t + 0.05);
    add(t, 0.96, 60 * (1 + load * 1.4), 0.018 + load * 0.007, "load", (load - 0.85) * 0.5);
    add(t + 0.55, 0.3, 60 * (2 + load), 0.012, "load", -0.27);
  }
  for (let t = 21; t < 25; t++) {
    add(t, 0.99, gridFrequencyAt(t), 0.025, "transformer", 0, { gridDrive: 1.8 + (t - 21) * 0.85 });
  }
  // f_n = n/(2L) sqrt(T/μ). Here L=1 and T/μ=14400, so f1=60 Hz.
  for (let n = 1; n <= 4; n++) {
    add(25, 8, gridLineFrequency(n, 1, 14400, 1), 0.018 / Math.sqrt(n), "line", n % 2 ? -0.4 : 0.4);
  }
  for (let j = 0; j < 32; j++) {
    const time = 33 + j * 7 / 32;
    const irregularity = ((j * 37) % 11) / 11;
    add(time, 0.085 + irregularity * 0.10, gridFrequencyAt(time),
      0.015 + irregularity * 0.013, "arc", (j % 2 ? -1 : 1) * 0.56);
    if (j % 2 === 0) add(time, 0.10, 900 + (j % 5) * 220, 0.015, "fault-noise", (j % 3 - 1) * 0.5);
  }
  for (let j = 0; j < 18; j++) {
    const time = 40 + j * 7 / 18;
    add(time, 0.24, 4 * gridFrequencyAt(time), 0.024, "alarm", j % 2 ? -0.24 : 0.24);
  }
  for (let j = 0; j < 6; j++) {
    const time = 47 + j;
    add(time, 0.48, 2 * gridFrequencyAt(time), 0.020 * (1 - j / 14), "load-shed", (j % 2 - 0.5) * 0.6);
    add(time + 0.5, 0.18, 4 * gridFrequencyAt(time), 0.012, "load-shed", 0.3);
  }
  // N(g+1)=2N(g): one, two, four, eight, sixteen, thirty-two faults.
  for (let generation = 0; generation <= 5; generation++) {
    const count = gridCascadePopulation(1, 2, generation);
    const width = 1.65;
    for (let j = 0; j < count; j++) {
      const time = 53 + generation * width + j * width / count;
      if (time >= 63) break;
      add(time, Math.min(0.21, width / count * 0.9), gridFrequencyAt(time) * (2 + generation * 0.5),
        0.024 / Math.sqrt(count), "cascade", j % 2 ? -0.67 : 0.67);
    }
  }
  add(63, 3.98, gridFrequencyAt(63), 0.015, "blackout");
  events.sort((a, b) => a.time - b.time);
  return {
    events,
    duration: GRID_DURATION_SECONDS,
    values: Array.from({ length: 128 }, (_, i) => gridTimelineValue((i + 0.37) / 128 * GRID_DURATION_SECONDS)),
    label: "grid",
    richInstruments: false,
    musicalArrangement: false,
    musicalExpression: false
  };
}
