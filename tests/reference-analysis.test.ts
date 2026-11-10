import { describe, expect, it } from "vitest";
import {
  analyzeSpectralTimeline,
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

  it("rejects invalid sample rates and undersized decoded audio", () => {
    expect(() => analyzeSpectralTimeline(new Float32Array(128), 0)).toThrow(/sample rate/);
    expect(() => analyzeSpectralTimeline(new Float32Array(32), 8192)).toThrow(/128 decoded samples/);
  });
});
