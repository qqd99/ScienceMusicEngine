import { describe, expect, it } from "vitest";
import { applyEnsembleConductor, DEFAULT_INSTRUMENTS, DEFAULT_INSTRUMENT_LEVELS, DEFAULT_SOUND_PROFILE, getConductorSection, hasDedicatedInstruments, preparePlaybackEvents, resolveInstrumentEvents } from "../src/audio";
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

  it("creates separate deterministic call-and-response and analog texture parts", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, musicalArrangement: true, musicalExpression: true
    });
    const settings = {
      piano: true, analog: true, plucked: true, cinematicBass: true, atmosphere: true
    };
    const first = resolveInstrumentEvents(composition, settings);
    const second = resolveInstrumentEvents(composition, settings);
    expect(first).toEqual(second);
    expect(first.some(event => event.voice === "lead")).toBe(true);
    expect(first.some(event => event.voice === "answer")).toBe(true);
    expect(first.filter(event => event.voice === "texture")).toHaveLength(8);
    expect(first.some(event => event.voice === "bass")).toBe(true);
    expect(first.some(event => event.voice === "pad")).toBe(true);
  });

  it("does not create string answers or analog counterlines when those instruments are off", () => {
    const composition = generateComposition("chaos", { seed: 0.271828 });
    const events = resolveInstrumentEvents(composition, {
      piano: true, analog: false, plucked: false, cinematicBass: false, atmosphere: false
    });
    expect(events.some(event => event.voice === "answer")).toBe(false);
    expect(events.some(event => event.voice === "texture")).toBe(false);
  });

  it("maps normalized playback progress to the four conductor sections", () => {
    expect(getConductorSection(0)).toBe("beginning");
    expect(getConductorSection(0.249)).toBe("beginning");
    expect(getConductorSection(0.25)).toBe("development");
    expect(getConductorSection(0.5)).toBe("climax");
    expect(getConductorSection(0.75)).toBe("ending");
    expect(getConductorSection(0.99)).toBe("ending");
  });

  it("stages instrument entrances, builds the climax and clears layers for the ending", () => {
    const roles = ["lead", "answer", "texture", "bass", "pad", "percussion"] as const;
    const events = roles.flatMap(voice => [0, 2, 4, 7].map(time => ({
      time, duration: 0.5, frequency: 440, velocity: 0.5,
      waveform: "sine" as OscillatorType, pan: 0, voice
    })));
    const conducted = applyEnsembleConductor(events, 8);
    const find = (voice: string, time: number) =>
      conducted.find(event => event.voice === voice && event.time === time);

    expect(find("lead", 0)).toBeDefined();
    expect(find("lead", 4)!.velocity).toBeGreaterThan(find("lead", 0)!.velocity);
    expect(find("lead", 7)!.velocity).toBeLessThan(find("lead", 4)!.velocity);
    expect(find("answer", 0)).toBeUndefined();
    expect(find("answer", 2)).toBeDefined();
    expect(find("answer", 4)!.velocity).toBeGreaterThan(find("answer", 2)!.velocity);
    expect(find("answer", 7)).toBeUndefined();
    expect(find("texture", 0)).toBeUndefined();
    expect(find("texture", 2)).toBeDefined();
    expect(find("texture", 7)).toBeUndefined();
    expect(find("bass", 4)!.velocity).toBeGreaterThan(find("bass", 7)!.velocity);
    expect(find("pad", 4)!.velocity).toBeGreaterThan(find("pad", 7)!.velocity);
    expect(find("percussion", 0)).toBeUndefined();
    expect(find("percussion", 4)).toBeDefined();
    expect(find("percussion", 7)).toBeUndefined();
  });

  it("bypasses conductor processing when its feature toggle is off", () => {
    const events = generateComposition("chaos", { seed: 0.271828 }).events;
    expect(applyEnsembleConductor(events, 16, false)).toEqual(events);
  });

  it("uses one deterministic conducted event list for playback and WAV preparation", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, musicalArrangement: true, musicalExpression: true
    });
    const allInstruments = {
      piano: true, analog: true, plucked: true, cinematicBass: true, atmosphere: true
    };
    const liveEvents = preparePlaybackEvents(composition, allInstruments, true);
    const exportEvents = preparePlaybackEvents(composition, allInstruments, true);
    expect(liveEvents).toEqual(exportEvents);
    expect(liveEvents.some(event => event.voice === "answer")).toBe(true);
    expect(liveEvents.some(event => event.voice === "texture")).toBe(true);
    expect(liveEvents.some(event => event.voice === "percussion" && event.time >= composition.duration * 0.5)).toBe(true);
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
