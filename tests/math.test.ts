import { describe, expect, it } from "vitest";
import { euclideanPattern, generateComposition, logisticSequence, mandelbrotEscape } from "../src/math";
describe("mathematical generators", () => {
  it("distributes exactly k Euclidean pulses", () => {
    expect(euclideanPattern(5, 13).filter(Boolean)).toHaveLength(5);
  });
  it("is deterministic for a fixed logistic seed", () => {
    expect(logisticSequence(0.314, 3.9, 12)).toEqual(logisticSequence(0.314, 3.9, 12));
  });
  it("escapes a point outside the Mandelbrot set quickly", () => {
    expect(mandelbrotEscape(2, 2, 80)).toBeLessThan(80);
  });
  it("changes Mandelbrot values when complexity changes", () => {
    const low = generateComposition("mandelbrot", { complexity: 0.1, seed: 0.314159 });
    const high = generateComposition("mandelbrot", { complexity: 1, seed: 0.314159 });
    expect(low.values).not.toEqual(high.values);
  });
  it("uses the seed to choose a different Mandelbrot traversal", () => {
    const a = generateComposition("mandelbrot", { complexity: 0.55, seed: 0.123456 });
    const b = generateComposition("mandelbrot", { complexity: 0.55, seed: 0.987654 });
    expect(a.values).not.toEqual(b.values);
    expect(a.events).not.toEqual(b.events);
  });
  it("uses the seed to rotate Euclidean rhythms", () => {
    const a = generateComposition("euclidean", { seed: 0.1 });
    const b = generateComposition("euclidean", { seed: 0.8 });
    expect(a.values).not.toEqual(b.values);
  });
  it("arranges bass and sustained chord voices beneath the mathematical lead", () => {
    const composition = generateComposition("mandelbrot", { seed: 0.314159 });
    expect(composition.events.some(event => event.voice === "bass")).toBe(true);
    expect(composition.events.some(event => event.voice === "pad")).toBe(true);
    expect(composition.events.every((event, index, all) => index === 0 || all[index - 1].time <= event.time)).toBe(true);
  });
  it("adds phrase accents and a stronger final cadence", () => {
    const composition = generateComposition("chaos", { seed: 0.42 });
    const lead = composition.events.filter(event => event.voice === "lead");
    expect(lead.some(event => event.velocity > 0.5)).toBe(true);
    expect(lead.every(event => event.duration > 0)).toBe(true);
  });
  it("can disable the harmonic arrangement and retain only the mathematical voice", () => {
    const plain = generateComposition("mandelbrot", { musicalArrangement: false });
    expect(plain.events.every(event => event.voice === "lead")).toBe(true);
    expect(plain.musicalArrangement).toBe(false);
  });
  it("records the rich-instrument feature flag deterministically", () => {
    const rich = generateComposition("mandelbrot", { richInstruments: true });
    const dry = generateComposition("mandelbrot", { richInstruments: false });
    expect(rich.richInstruments).toBe(true);
    expect(dry.richInstruments).toBe(false);
    expect(rich.values).toEqual(dry.values);
    expect(rich.events).toEqual(dry.events);
  });
  it("adds a distinct expressive performance layer when enabled", () => {
    const plain = generateComposition("mandelbrot", { seed: 0.314159, musicalExpression: false });
    const expressive = generateComposition("mandelbrot", { seed: 0.314159, musicalExpression: true });
    expect(expressive.musicalExpression).toBe(true);
    expect(plain.musicalExpression).toBe(false);
    expect(expressive.events).not.toEqual(plain.events);
    expect(expressive.values).toEqual(plain.values);
    expect(expressive.events.some(event => event.time > 0 && event.voice === "lead")).toBe(true);
  });
  it("creates a clear eight-bar arc with a sparse opening, dense climax and tonic ending", () => {
    const composition = generateComposition("chaos", { bpm: 120, root: 60, scale: "Major", musicalExpression: true });
    const beat = 0.5;
    const lead = composition.events.filter(event => event.voice === "lead");
    const counts = Array.from({ length: 8 }, (_, bar) =>
      lead.filter(event => event.time >= bar * 4 * beat && event.time < (bar + 1) * 4 * beat).length
    );
    expect(counts[0]).toBeLessThan(counts[4]);
    expect(counts[4]).toBeGreaterThanOrEqual(8);
    const finalNote = lead.reduce((latest, event) => event.time > latest.time ? event : latest);
    expect(finalNote.frequency).toBeCloseTo(440 * Math.pow(2, (72 - 69) / 12), 5);
    expect(finalNote.time + finalNote.duration).toBeLessThanOrEqual(composition.duration);
  });
  it("recalls the opening motif after development and climax", () => {
    const composition = generateComposition("mandelbrot", {
      bpm: 120, root: 60, scale: "Major", musicalExpression: true
    });
    const lead = composition.events.filter(event => event.voice === "lead");
    const at = (seconds: number) => lead.find(event => Math.abs(event.time - seconds) < 1e-8)!;
    const opening = [at(0), at(1), at(2), at(3)];
    const reprise = [at(12), at(13), at(14), at(15)];
    expect(reprise.slice(0, 3).map(note => note.frequency))
      .toEqual(opening.slice(0, 3).map(note => note.frequency));
    expect(reprise[3].frequency).toBe(440 * Math.pow(2, (72 - 69) / 12));
  });
  it("makes the climax denser and higher than the opening", () => {
    const composition = generateComposition("chaos", { bpm: 120, musicalExpression: true });
    const lead = composition.events.filter(event => event.voice === "lead");
    const inBar = (bar: number) => lead.filter(event => event.time >= bar * 2 && event.time < (bar + 1) * 2);
    expect(inBar(4)).toHaveLength(8);
    expect(inBar(5)).toHaveLength(8);
    expect(inBar(4).length).toBeGreaterThan(inBar(0).length);
    expect(Math.min(...inBar(4).map(event => event.frequency)))
      .toBeGreaterThan(Math.min(...inBar(0).map(event => event.frequency)));
  });
  it("builds the bass and chord layers toward the climax, then releases", () => {
    const composition = generateComposition("mandelbrot", {
      bpm: 120, musicalArrangement: true, musicalExpression: true
    });
    const bass = composition.events.filter(event => event.voice === "bass");
    const pads = composition.events.filter(event => event.voice === "pad");
    const bassAtBar = (bar: number) => bass.find(event => Math.abs(event.time - bar * 2) < 1e-8)!;
    expect(bassAtBar(4).velocity).toBeGreaterThan(bassAtBar(0).velocity);
    expect(bassAtBar(7).velocity).toBeLessThan(bassAtBar(4).velocity);
    expect(pads[6].velocity).toBeGreaterThan(pads[0].velocity);
    expect(pads[9].velocity).toBeLessThan(pads[6].velocity);
  });
  it("adds a sparse drum part that becomes denser at the climax and clears for the ending", () => {
    const composition = generateComposition("chaos", {
      bpm: 120, musicalArrangement: true, musicalExpression: true
    });
    const drums = composition.events.filter(event => event.voice === "percussion");
    const inBar = (bar: number) => drums.filter(event => event.time >= bar * 2 && event.time < (bar + 1) * 2);
    expect(inBar(0).length).toBeLessThan(inBar(4).length);
    expect(inBar(4).some(event => event.percussionKind === "kick")).toBe(true);
    expect(inBar(4).some(event => event.percussionKind === "snare")).toBe(true);
    expect(inBar(7).length).toBeLessThan(inBar(4).length);
  });
  it("omits the drum arrangement when musical expression is disabled", () => {
    const composition = generateComposition("chaos", { musicalExpression: false });
    expect(composition.events.some(event => event.voice === "percussion")).toBe(false);
  });
  it("keeps musical expression deterministic for the same seed", () => {
    const a = generateComposition("chaos", { seed: 0.42, musicalExpression: true });
    const b = generateComposition("chaos", { seed: 0.42, musicalExpression: true });
    expect(a.events).toEqual(b.events);
  });
  it("creates bounded, repeatable compositions", () => {
    const a = generateComposition("chaos", { seed: 0.25 });
    const b = generateComposition("chaos", { seed: 0.25 });
    expect(a.events).toEqual(b.events);
    expect(a.events.every(e => e.frequency > 0 && e.time >= 0)).toBe(true);
  });
});