import { describe, expect, it } from "vitest";
import {
  GRID_DURATION_SECONDS, GRID_STAGES, generateGridComposition, gridArcVoltage, gridCascadePopulation,
  gridFrequencyAt, gridLineDisplacement, gridLineFrequency, gridLoadShedFrequency,
  gridPowerLoad, gridStageAt, gridSwingFrequency, gridThreePhase, gridTransformerFlux, gridVoltage
} from "../src/grid";
import { preparePlaybackEvents, resolveInstrumentEvents } from "../src/audio";
import { DEFAULT_INSTRUMENTS } from "../src/audio";

describe("67-second power-grid reference", () => {
  it("generates physical 60 Hz voltage, not a 60 BPM piano score", () => {
    expect(gridVoltage(0)).toBeCloseTo(0, 12);
    expect(gridVoltage(1 / 240)).toBeCloseTo(1, 12);
    expect(gridVoltage(1 / 120)).toBeCloseTo(0, 12);
  });
  it("uses exact 120 degree phase offsets that sum to zero", () => {
    for (const t of [0, 0.001, 0.0037, 1.23456]) {
      expect(gridThreePhase(t, 0) + gridThreePhase(t, 1) + gridThreePhase(t, 2)).toBeCloseTo(0, 10);
    }
  });
  it("sums rising load and clips the sine with tanh", () => {
    expect(gridPowerLoad(20)).toBeGreaterThan(gridPowerLoad(12));
    expect(gridPowerLoad(20)).toBeGreaterThan(1);
    expect(gridTransformerFlux(1 / 240, 5)).toBeCloseTo(1, 12);
  });
  it("uses the standing-wave line and square arc formulas", () => {
    expect(gridLineFrequency(2, 1, 14400, 1)).toBe(120);
    expect(gridLineDisplacement(1, 0, 0)).toBeCloseTo(0);
    expect(gridLineDisplacement(1, 0.5, 0)).toBeCloseTo(1);
    expect(gridArcVoltage(1 / 240)).toBe(1);
    expect(gridArcVoltage(3 / 240)).toBe(-1);
  });
  it("models imbalance, the swing equation, a doubling cascade and final blackout", () => {
    expect(gridSwingFrequency(60, 0.1, 2, 6)).toBeCloseTo(59);
    expect(gridLoadShedFrequency(60, 1.1, 1, 0.5)).toBeCloseTo(60.2);
    expect(gridCascadePopulation(1, 2, 5)).toBe(32);
    expect(gridFrequencyAt(0)).toBe(60);
    expect(gridFrequencyAt(45)).toBeLessThan(gridFrequencyAt(40));
    expect(gridFrequencyAt(65)).toBeLessThan(gridFrequencyAt(60));
    expect(gridFrequencyAt(67)).toBe(0);
  });
  it("maps a continuous, ten-stage, 67-second timeline", () => {
    expect(GRID_STAGES[0].from).toBe(0);
    expect(GRID_STAGES[GRID_STAGES.length - 1].to).toBe(GRID_DURATION_SECONDS);
    for (let i = 0; i < GRID_STAGES.length - 1; i++) {
      expect(GRID_STAGES[i].to).toBe(GRID_STAGES[i + 1].from);
    }
    expect(gridStageAt(6).id).toBe("three-phase");
    expect(gridStageAt(64).id).toBe("blackout");
  });
  it("keeps deterministic grid score, dedicated routing and live/WAV preparation identical", () => {
    const a = generateGridComposition();
    expect(a).toEqual(generateGridComposition());
    expect(a.duration).toBe(67);
    expect(a.values).toHaveLength(128);
    expect(a.label).toBe("grid");
    expect(a.events.slice(0, 4).map(event => event.frequency)).toEqual([60, 120, 240, 480]);
    expect(a.events.every(event => event.voice === "grid" &&
      event.time >= 0 && event.time + event.duration <= 67)).toBe(true);
    expect(a.events.some(event => event.gridKind === "transformer")).toBe(true);
    expect(a.events.some(event => event.gridKind === "fault-noise")).toBe(true);
    expect(resolveInstrumentEvents(a, DEFAULT_INSTRUMENTS)).toEqual(a.events);
    expect(preparePlaybackEvents(a, DEFAULT_INSTRUMENTS, true)).toEqual(
      preparePlaybackEvents(a, DEFAULT_INSTRUMENTS, false)
    );
  });
});
