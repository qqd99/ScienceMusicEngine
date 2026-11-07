import { describe, expect, it } from "vitest";
import { DEFAULT_INSTRUMENTS, DEFAULT_INSTRUMENT_LEVELS, DEFAULT_SOUND_PROFILE, hasDedicatedInstruments, resolveInstrumentEvents } from "../src/audio";
import { generateComposition } from "../src/math";

describe("procedural instrument controls", () => {
  it("exposes five independently switchable instrument layers", () => {
    expect(Object.keys(DEFAULT_INSTRUMENTS).sort()).toEqual([
      "analog", "atmosphere", "cinematicBass", "piano", "plucked"
    ]);
  });

  it("starts with piano, cinematic bass and atmospheric pads enabled", () => {
    expect(DEFAULT_INSTRUMENTS).toEqual({
      piano: true,
      analog: false,
      plucked: false,
      cinematicBass: true,
      atmosphere: true
    });
  });

  it("uses the default synthesizer only when every dedicated instrument is disabled", () => {
    expect(hasDedicatedInstruments({
      piano: false, analog: false, plucked: false, cinematicBass: false, atmosphere: false
    })).toBe(false);
    expect(hasDedicatedInstruments({
      piano: false, analog: true, plucked: false, cinematicBass: false, atmosphere: false
    })).toBe(true);
  });

  it("derives deterministic bass and pad fallback notes when arrangement is disabled", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, musicalArrangement: false, musicalExpression: false
    });
    const instruments = {
      piano: false, analog: false, plucked: false, cinematicBass: true, atmosphere: true
    };
    const a = resolveInstrumentEvents(composition, instruments);
    const b = resolveInstrumentEvents(composition, instruments);
    expect(a).toEqual(b);
    expect(a.some(event => event.voice === "bass")).toBe(true);
    expect(a.some(event => event.voice === "pad")).toBe(true);
    expect(a.filter(event => event.voice === "bass")).toHaveLength(8);
    expect(a.filter(event => event.voice === "pad")).toHaveLength(16);
  });

  it("uses real arrangement bass and chords instead of generating fallback duplicates", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, musicalArrangement: true
    });
    const actualBass = composition.events.filter(event => event.voice === "bass");
    const actualPads = composition.events.filter(event => event.voice === "pad");
    const resolved = resolveInstrumentEvents(composition, {
      piano: false, analog: false, plucked: false, cinematicBass: true, atmosphere: true
    });
    expect(resolved.filter(event => event.voice === "bass")).toEqual(actualBass);
    expect(resolved.filter(event => event.voice === "pad")).toEqual(actualPads);
  });

  it("defaults to the hybrid cinematic sound profile", () => {
    expect(DEFAULT_SOUND_PROFILE).toBe("hybrid-cinematic");
  });

  it("provides independent level values for all five instruments", () => {
    expect(Object.keys(DEFAULT_INSTRUMENT_LEVELS).sort()).toEqual([
      "analog", "atmosphere", "cinematicBass", "piano", "plucked"
    ]);
    expect(Object.values(DEFAULT_INSTRUMENT_LEVELS).every(level => level > 0 && level <= 1.5)).toBe(true);
  });

  it("allows a session to change one instrument without changing the defaults", () => {
    const session = { ...DEFAULT_INSTRUMENTS };
    session.piano = false;
    session.analog = true;
    expect(session.piano).toBe(false);
    expect(session.analog).toBe(true);
    expect(DEFAULT_INSTRUMENTS.piano).toBe(true);
    expect(DEFAULT_INSTRUMENTS.analog).toBe(false);
  });
});
