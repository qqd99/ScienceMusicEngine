import { describe, expect, it } from "vitest";
import {
  analyzeSpectralTimeline,
  averageSpectralWindow,
  downsampleForSignalCore,
  buildReferenceGuide,
  estimateTempoBpm,
  type ReferenceTimelineFrame
} from "../src/media/reference-analysis";

describe("reference media signal analysis", () => {
  it("recovers the spectral centroid of a clean 440 Hz reference tone", () => {
    const sampleRate = 8192;
    const samples = new Float32Array(sampleRate);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = 0.7 * Math.sin(2 * Math.PI * 440 * index / sampleRate);
    }
    const analysis = analyzeSpectralTimeline(samples, sampleRate);
    expect(analysis.frames.length).toBeGreaterThan(8);
    expect(analysis.averageSpectralCentroidHz).toBeGreaterThan(430);
    expect(analysis.averageSpectralCentroidHz).toBeLessThan(450);
    expect(analysis.averageRms).toBeGreaterThan(0.45);
    expect(analysis.frames.every(frame =>
      Math.abs(frame.lowBandEnergy + frame.midBandEnergy + frame.highBandEnergy - 1) < 1e-5
    )).toBe(true);
  });

  it("estimates a 120 BPM pulse train from spectral onset activity", () => {
    const hopSeconds = 0.01;
    const onset = new Array(2400).fill(0);
    for (let index = 0; index < onset.length; index += 50) {
      onset[index] = 1;
      if (index + 1 < onset.length) onset[index + 1] = 0.25;
    }
    const estimate = estimateTempoBpm(onset, hopSeconds);
    expect(estimate.bpm).toBe(120);
    expect(estimate.confidence).toBeGreaterThan(0.5);
  });

  it("does not invent a tempo or centroid for silence", () => {
    const analysis = analyzeSpectralTimeline(new Float32Array(4096), 8192);
    expect(analysis.averageRms).toBe(0);
    expect(analysis.averageSpectralCentroidHz).toBe(0);
    expect(analysis.estimatedTempoBpm).toBeNull();
    expect(analysis.tempoConfidence).toBe(0);
  });

  it("builds a deterministic normalized reference guide from energy and onsets", () => {
    const frames = Array.from({ length: 128 }, (_, index) => ({
      index,
      startSeconds: index,
      endSeconds: index + 1,
      startFraction: index / 128,
      endFraction: (index + 1) / 128,
      rms: index / 127,
      waveformMinimum: -index / 127,
      waveformMaximum: index / 127,
      activity: index % 2,
      spectralCentroidHz: 400,
      lowBandEnergy: 0.5,
      midBandEnergy: 0.3,
      highBandEnergy: 0.2,
      onsetStrength: index % 2,
      visualBrightness: 0,
      visualMotion: 0
    })) satisfies ReferenceTimelineFrame[];
    const first = buildReferenceGuide(frames);
    const second = buildReferenceGuide(frames);
    expect(first).toEqual(second);
    expect(first).toHaveLength(128);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
    expect(first[0]).toBeLessThan(first[127]);
  });

  it("averages every spectral frame across its matching timeline window", () => {
    const frames = [
      { startSample: 0, endSample: 100, startFraction: 0, endFraction: 0.25,
        rms: 0.1, spectralCentroidHz: 100, lowBandEnergy: 1, midBandEnergy: 0,
        highBandEnergy: 0, onsetStrength: 0.2 },
      { startSample: 100, endSample: 200, startFraction: 0.25, endFraction: 0.5,
        rms: 0.3, spectralCentroidHz: 300, lowBandEnergy: 0, midBandEnergy: 1,
        highBandEnergy: 0, onsetStrength: 0.4 },
      { startSample: 200, endSample: 300, startFraction: 0.5, endFraction: 0.75,
        rms: 0.5, spectralCentroidHz: 500, lowBandEnergy: 0, midBandEnergy: 0,
        highBandEnergy: 1, onsetStrength: 0.6 },
      { startSample: 300, endSample: 400, startFraction: 0.75, endFraction: 1,
        rms: 0.7, spectralCentroidHz: 700, lowBandEnergy: 0.5, midBandEnergy: 0.5,
        highBandEnergy: 0, onsetStrength: 0.8 }
    ];
    const firstHalf = averageSpectralWindow(frames, 0, 0.5);
    expect(firstHalf.rms).toBeCloseTo(0.2, 12);
    expect(firstHalf.spectralCentroidHz).toBeCloseTo(200, 12);
    expect(firstHalf.lowBandEnergy).toBeCloseTo(0.5, 12);
    expect(firstHalf.midBandEnergy).toBeCloseTo(0.5, 12);
    expect(firstHalf.highBandEnergy).toBe(0);
    expect(firstHalf.onsetStrength).toBeCloseTo(0.3, 12);
    expect(averageSpectralWindow(frames, 0.25, 0.75).spectralCentroidHz).toBe(400);
  });

  it("keeps the C++ signal buffer bounded without reducing the browser FFT sample clock", () => {
    const samples = Float32Array.from({ length: 1_000 }, (_, index) => Math.sin(index * 0.1));
    const reduced = downsampleForSignalCore(samples, 12_000, 200);
    expect(reduced.samples).toHaveLength(200);
    expect(reduced.factor).toBe(5);
    expect(reduced.sampleRateHz).toBe(2_400);
    expect(reduced.samples[0]).toBeCloseTo(
      samples.slice(0, 5).reduce((sum, value) => sum + value, 0) / 5
    );
    const unchanged = downsampleForSignalCore(samples, 12_000, 1_000);
    expect(unchanged.samples).toBe(samples);
    expect(unchanged.sampleRateHz).toBe(12_000);
  });

  it("rejects invalid sample rates and undersized decoded audio", () => {
    expect(() => analyzeSpectralTimeline(new Float32Array(128), 0)).toThrow(/sample rate/);
    expect(() => analyzeSpectralTimeline(new Float32Array(32), 8192)).toThrow(/128 decoded samples/);
  });
});
