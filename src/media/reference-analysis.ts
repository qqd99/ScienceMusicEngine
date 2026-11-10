import { analyzeScientificSignal } from "../wasm/bridge";
import type { ScientificSignalAnalysis } from "../science/signal";

export const REFERENCE_TIMELINE_WINDOWS = 128;
export const MAX_REFERENCE_AUDIO_SECONDS = 600;
export const MAX_REFERENCE_VIDEO_SECONDS = 180;
export const MAX_REFERENCE_FILE_BYTES = 150 * 1024 * 1024;
const MAX_ANALYSIS_SAMPLES = 900_000;

export interface ReferenceVisualSample {
  timeSeconds: number;
  brightness: number;
  motion: number;
}
export interface ReferenceTimelineFrame {
  index: number;
  startSeconds: number;
  endSeconds: number;
  startFraction: number;
  endFraction: number;
  rms: number;
  waveformMinimum: number;
  waveformMaximum: number;
  activity: number;
  spectralCentroidHz: number;
  lowBandEnergy: number;
  midBandEnergy: number;
  highBandEnergy: number;
  onsetStrength: number;
  visualBrightness: number;
  visualMotion: number;
}
export interface ReferenceMediaAnalysis {
  fileName: string;
  kind: "audio" | "video";
  durationSeconds: number;
  sourceSampleRateHz: number;
  analysisSampleRateHz: number;
  sourceChannelCount: number;
  signal: ScientificSignalAnalysis | null;
  frames: ReferenceTimelineFrame[];
  estimatedTempoBpm: number | null;
  tempoConfidence: number;
  averageSpectralCentroidHz: number;
  averageRms: number;
  audioDetected: boolean;
  visualFrameCount: number;
  warnings: string[];
}
export interface SpectralFrame {
  startSample: number;
  endSample: number;
  startFraction: number;
  endFraction: number;
  rms: number;
  spectralCentroidHz: number;
  lowBandEnergy: number;
  midBandEnergy: number;
  highBandEnergy: number;
  onsetStrength: number;
}
export interface SpectralTimeline {
  frames: SpectralFrame[];
  hopSeconds: number;
  averageSpectralCentroidHz: number;
  averageRms: number;
  estimatedTempoBpm: number | null;
  tempoConfidence: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function highestPowerOfTwo(value: number): number {
  let result = 1;
  while (result * 2 <= value) result *= 2;
  return result;
}
function fft(real: Float64Array, imaginary: Float64Array): void {
  const size = real.length;
  let reversed = 0;
  for (let index = 1; index < size; index += 1) {
    let bit = size >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      const realValue = real[index];
      real[index] = real[reversed];
      real[reversed] = realValue;
      const imaginaryValue = imaginary[index];
      imaginary[index] = imaginary[reversed];
      imaginary[reversed] = imaginaryValue;
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const half = length >> 1;
    const angle = -2 * Math.PI / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

/** Estimate pulse tempo from a positive spectral-flux onset envelope. */
export function estimateTempoBpm(
  onsetEnvelope: readonly number[],
  hopSeconds: number
): { bpm: number | null; confidence: number } {
  if (onsetEnvelope.length < 24 || !Number.isFinite(hopSeconds) || hopSeconds <= 0) {
    return { bpm: null, confidence: 0 };
  }
  const center = mean(onsetEnvelope);
  const centered = onsetEnvelope.map(value => value - center);
  const minimumLag = Math.max(1, Math.floor(60 / (180 * hopSeconds)));
  const maximumLag = Math.min(
    Math.floor(centered.length / 2),
    Math.ceil(60 / (60 * hopSeconds))
  );
  if (maximumLag <= minimumLag) return { bpm: null, confidence: 0 };

  let bestScore = 0;
  let bestLag = 0;
  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let dot = 0;
    let energyA = 0;
    let energyB = 0;
    for (let index = lag; index < centered.length; index += 1) {
      const a = centered[index];
      const b = centered[index - lag];
      dot += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const denominator = Math.sqrt(energyA * energyB);
    const score = denominator > 1e-12 ? dot / denominator : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (bestLag === 0 || bestScore < 0.12) return { bpm: null, confidence: 0 };
  const bpm = clamp(60 / (bestLag * hopSeconds), 60, 180);
  return { bpm: Math.round(bpm), confidence: clamp((bestScore - 0.08) / 0.72, 0, 1) };
}

/** Windowed FFT analysis: RMS, spectral centroid, three broad bands and onset flux. */
export function analyzeSpectralTimeline(
  samples: Float32Array | Float64Array,
  sampleRateHz: number
): SpectralTimeline {
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError("Reference audio sample rate must be positive and finite.");
  }
  if (samples.length < 128) {
    throw new RangeError("Reference audio must contain at least 128 decoded samples.");
  }
  const frameSize = Math.min(2048, highestPowerOfTwo(samples.length));
  const hopSize = Math.max(64, Math.floor(frameSize / 4));
  const real = new Float64Array(frameSize);
  const imaginary = new Float64Array(frameSize);
  const window = new Float64Array(frameSize);
  const previousMagnitudes = new Float64Array(frameSize / 2 + 1);
  for (let index = 0; index < frameSize; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (frameSize - 1));
  }

  const frames: SpectralFrame[] = [];
  let weightedCentroid = 0;
  let centroidWeight = 0;
  let totalRms = 0;
  let previousMagnitudeSum = 0;
  for (let start = 0; start < samples.length; start += hopSize) {
    let squareSum = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const sample = samples[start + index] ?? 0;
      squareSum += sample * sample;
      real[index] = sample * window[index];
      imaginary[index] = 0;
    }
    fft(real, imaginary);

    let magnitudeSum = 0;
    let centroidSum = 0;
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    let positiveFlux = 0;
    for (let bin = 1; bin < previousMagnitudes.length; bin += 1) {
      const magnitude = Math.hypot(real[bin], imaginary[bin]);
      const frequency = (bin * sampleRateHz) / frameSize;
      const energy = magnitude * magnitude;
      magnitudeSum += magnitude;
      centroidSum += frequency * magnitude;
      if (frequency < 250) lowEnergy += energy;
      else if (frequency < 2_000) midEnergy += energy;
      else highEnergy += energy;
      positiveFlux += Math.max(0, magnitude - previousMagnitudes[bin]);
      previousMagnitudes[bin] = magnitude;
    }
    const totalBandEnergy = lowEnergy + midEnergy + highEnergy;
    const rms = Math.sqrt(squareSum / frameSize);
    const centroid = magnitudeSum > 1e-12 ? centroidSum / magnitudeSum : 0;
    const onsetStrength = previousMagnitudeSum > 1e-12
      ? positiveFlux / previousMagnitudeSum
      : 0;
    const end = Math.min(samples.length, start + frameSize);
    frames.push({
      startSample: start,
      endSample: end,
      startFraction: start / samples.length,
      endFraction: end / samples.length,
      rms,
      spectralCentroidHz: centroid,
      lowBandEnergy: totalBandEnergy > 1e-18 ? lowEnergy / totalBandEnergy : 0,
      midBandEnergy: totalBandEnergy > 1e-18 ? midEnergy / totalBandEnergy : 0,
      highBandEnergy: totalBandEnergy > 1e-18 ? highEnergy / totalBandEnergy : 0,
      onsetStrength
    });
    previousMagnitudeSum = magnitudeSum;
    totalRms += rms;
    if (rms > 1e-6) {
      weightedCentroid += centroid * rms;
      centroidWeight += rms;
    }
    if (start + frameSize >= samples.length) break;
  }
  const hopSeconds = hopSize / sampleRateHz;
  const tempo = estimateTempoBpm(frames.map(frame => frame.onsetStrength), hopSeconds);
  return {
    frames,
    hopSeconds,
    averageSpectralCentroidHz: centroidWeight > 0 ? weightedCentroid / centroidWeight : 0,
    averageRms: frames.length ? totalRms / frames.length : 0,
    estimatedTempoBpm: tempo.bpm,
    tempoConfidence: tempo.confidence
  };
}

function normalizeSeries(values: readonly number[]): number[] {
  if (!values.length) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (maximum - minimum < 1e-9) return values.map(() => 0.5);
  return values.map(value => clamp((value - minimum) / (maximum - minimum), 0, 1));
}

/** Convert measured reference energy and onset activity to a stable 0–1 guide contour. */
export function buildReferenceGuide(frames: readonly ReferenceTimelineFrame[]): number[] {
  if (!frames.length) return [];
  const energy = normalizeSeries(frames.map(frame => frame.rms));
  const onsets = normalizeSeries(frames.map(frame => frame.onsetStrength));
  return frames.map((_, index) => clamp(energy[index] * 0.68 + onsets[index] * 0.32, 0, 1));
}

function visualAt(
  visualFrames: readonly ReferenceVisualSample[],
  fraction: number,
  property: "brightness" | "motion"
): number {
  if (!visualFrames.length) return 0;
  const index = Math.round(fraction * (visualFrames.length - 1));
  return visualFrames[index]?.[property] ?? 0;
}

/** Keep a usable synchronized visual timeline when a video has no extractable audio track. */
export function createVisualOnlyReferenceAnalysis(metadata: {
  fileName: string;
  durationSeconds: number;
  visualFrames: readonly ReferenceVisualSample[];
  warnings?: readonly string[];
}): ReferenceMediaAnalysis {
  const windows = REFERENCE_TIMELINE_WINDOWS;
  return {
    fileName: metadata.fileName,
    kind: "video",
    durationSeconds: metadata.durationSeconds,
    sourceSampleRateHz: 0,
    analysisSampleRateHz: 0,
    sourceChannelCount: 0,
    signal: null,
    frames: Array.from({ length: windows }, (_, index) => {
      const startFraction = index / windows;
      const endFraction = (index + 1) / windows;
      const fraction = (startFraction + endFraction) * 0.5;
      return {
        index,
        startSeconds: startFraction * metadata.durationSeconds,
        endSeconds: endFraction * metadata.durationSeconds,
        startFraction,
        endFraction,
        rms: 0,
        waveformMinimum: 0,
        waveformMaximum: 0,
        activity: 0,
        spectralCentroidHz: 0,
        lowBandEnergy: 0,
        midBandEnergy: 0,
        highBandEnergy: 0,
        onsetStrength: 0,
        visualBrightness: visualAt(metadata.visualFrames, fraction, "brightness"),
        visualMotion: visualAt(metadata.visualFrames, fraction, "motion")
      };
    }),
    estimatedTempoBpm: null,
    tempoConfidence: 0,
    averageSpectralCentroidHz: 0,
    averageRms: 0,
    audioDetected: false,
    visualFrameCount: metadata.visualFrames.length,
    warnings: [...(metadata.warnings ?? []), "No audible video track was available; only visual motion was analyzed."]
  };
}

export async function analyzeReferenceSamples(
  samples: Float32Array,
  sampleRateHz: number,
  metadata: {
    fileName: string;
    kind: "audio" | "video";
    durationSeconds: number;
    sourceSampleRateHz: number;
    sourceChannelCount: number;
    visualFrames?: readonly ReferenceVisualSample[];
    warnings?: readonly string[];
  }
): Promise<ReferenceMediaAnalysis> {
  if (samples.length > MAX_ANALYSIS_SAMPLES) {
    throw new RangeError("Reference audio exceeds the safe analysis sample limit.");
  }
  const spectral = analyzeSpectralTimeline(samples, sampleRateHz);
  const warnings = [...(metadata.warnings ?? [])];
  let signal: ScientificSignalAnalysis | null = null;
  try {
    signal = await analyzeScientificSignal({
      channels: [{ id: "reference-audio", unit: "normalized amplitude", samples }],
      sampleRateHz
    }, REFERENCE_TIMELINE_WINDOWS);
  } catch (error) {
    warnings.push("C++/WebAssembly signal analysis was unavailable; browser spectral analysis is still complete.");
    console.warn("Reference C++ signal analysis unavailable:", error);
  }

  const visualFrames = metadata.visualFrames ?? [];
  const signalFrames = signal?.frames ?? [];
  const windows = REFERENCE_TIMELINE_WINDOWS;
  const timeline: ReferenceTimelineFrame[] = [];
  for (let index = 0; index < windows; index += 1) {
    const startFraction = index / windows;
    const endFraction = (index + 1) / windows;
    const spectralIndex = Math.min(
      spectral.frames.length - 1,
      Math.floor(((index + 0.5) / windows) * spectral.frames.length)
    );
    const spectralSlice = spectral.frames.length
      ? [spectral.frames[spectralIndex]]
      : [];
    const signalFrame = signalFrames[index];
    const average = (key: keyof SpectralFrame) => mean(
      spectralSlice.map(frame => Number(frame[key]))
    );
    const sampleStart = Math.floor(index * samples.length / windows);
    const sampleEnd = Math.max(sampleStart + 1, Math.floor((index + 1) * samples.length / windows));
    let waveformMinimum = 1;
    let waveformMaximum = -1;
    for (let sample = sampleStart; sample < Math.min(samples.length, sampleEnd); sample += 1) {
      waveformMinimum = Math.min(waveformMinimum, samples[sample]);
      waveformMaximum = Math.max(waveformMaximum, samples[sample]);
    }
    timeline.push({
      index,
      startSeconds: startFraction * metadata.durationSeconds,
      endSeconds: endFraction * metadata.durationSeconds,
      startFraction,
      endFraction,
      rms: signalFrame?.rms ?? average("rms"),
      waveformMinimum,
      waveformMaximum,
      activity: signalFrame?.activity ?? average("onsetStrength"),
      spectralCentroidHz: average("spectralCentroidHz"),
      lowBandEnergy: average("lowBandEnergy"),
      midBandEnergy: average("midBandEnergy"),
      highBandEnergy: average("highBandEnergy"),
      onsetStrength: average("onsetStrength"),
      visualBrightness: visualAt(visualFrames, (startFraction + endFraction) * 0.5, "brightness"),
      visualMotion: visualAt(visualFrames, (startFraction + endFraction) * 0.5, "motion")
    });
  }

  const audioDetected = spectral.averageRms > 1e-5;
  if (!audioDetected) warnings.push(
    metadata.kind === "video"
      ? "No audible audio was detected in this video; visual-motion analysis is still available."
      : "The selected audio appears silent or extremely quiet."
  );
  return {
    fileName: metadata.fileName,
    kind: metadata.kind,
    durationSeconds: metadata.durationSeconds,
    sourceSampleRateHz: metadata.sourceSampleRateHz,
    analysisSampleRateHz: sampleRateHz,
    sourceChannelCount: metadata.sourceChannelCount,
    signal,
    frames: timeline,
    estimatedTempoBpm: audioDetected ? spectral.estimatedTempoBpm : null,
    tempoConfidence: audioDetected ? spectral.tempoConfidence : 0,
    averageSpectralCentroidHz: spectral.averageSpectralCentroidHz,
    averageRms: spectral.averageRms,
    audioDetected,
    visualFrameCount: visualFrames.length,
    warnings
  };
}
