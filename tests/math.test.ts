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
  it("creates bounded, repeatable compositions", () => {
    const a = generateComposition("chaos", { seed: 0.25 });
    const b = generateComposition("chaos", { seed: 0.25 });
    expect(a.events).toEqual(b.events);
    expect(a.events.every(e => e.frequency > 0 && e.time >= 0)).toBe(true);
  });
});