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
  it("creates bounded, repeatable compositions", () => {
    const a = generateComposition("chaos", { seed: 0.25 });
    const b = generateComposition("chaos", { seed: 0.25 });
    expect(a.events).toEqual(b.events);
    expect(a.events.every(e => e.frequency > 0 && e.time >= 0)).toBe(true);
  });
});