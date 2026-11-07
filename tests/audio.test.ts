import { describe, expect, it } from "vitest";
import { applyEnsembleConductor, DEFAULT_INSTRUMENTS, DEFAULT_INSTRUMENT_LEVELS, DEFAULT_SOUND_PROFILE, getConductorSection, hasDedicatedInstruments, preparePlaybackEvents, resolveInstrumentEvents } from "../src/audio";
import { generateComposition, type NoteEvent } from "../src/math";

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
    expect(first.filter(event => event.voice === "texture").length).toBeGreaterThan(0);
    expect(first.filter(event => event.voice === "texture").length).toBeLessThan(8);
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

  it("selects complementary roles instead of stacking every enabled layer", () => {
    const duration = 32;
    const beat = 1;
    const events: NoteEvent[] = [];
    const add = (
      voice: NoteEvent["voice"],
      time: number,
      noteDuration = 0.4,
      extras: Partial<NoteEvent> = {}
    ) => events.push({
      time, duration: noteDuration, frequency: 440, velocity: 0.5,
      waveform: "sine", pan: 0, voice, ...extras
    });

    // The lead has clear gaps in development and reprise, but is dense at the climax.
    for (const [time, noteDuration] of [
      [0, 0.5], [2, 0.5],
      [8, 0.4], [9, 0.4], [10.5, 0.4], [11.5, 0.4],
      [12, 0.4], [12.5, 0.4], [14, 0.4], [15, 0.4], [15.5, 0.4],
      ...Array.from({ length: 8 }, (_, i) => [16 + i * 0.5, 0.38]),
      ...Array.from({ length: 8 }, (_, i) => [20 + i * 0.5, 0.38]),
      [24, 1], [26, 0.85], [28, 1], [30, 1.95]
    ] as number[][]) add("lead", time, noteDuration);

    // Bass offers many possible notes; the conductor should retain only anchors
    // and the final approach into the tonic.
    for (const time of [0, 2, 4, 8, 10, 16, 18, 20, 24, 28]) add("bass", time, 0.8);
    add("bass", 23.5, 0.35);

    // Four chord changes are available, but only the opening and final harmony
    // should be sustained by pads.
    for (const bar of [0, 2, 4, 6]) {
      for (const [tone, pan] of [[0, -0.3], [4, 0], [7, 0.3], [11, 0.12]]) {
        add("pad", bar * 4, 7.7, { frequency: 440 * Math.pow(2, tone / 12), pan });
      }
    }

    add("answer", 8.55, 0.35);
    add("answer", 16.45, 0.3);
    add("answer", 25.1, 0.5);
    add("texture", 13.1, 0.68);
    add("texture", 20.1, 0.5);

    for (const [time, kind] of [
      [12, "kick"], [14, "snare"], [15, "hat"],
      [16, "kick"], [17, "hat"], [18, "snare"], [19, "hat"],
      [20, "kick"], [21, "hat"], [22, "snare"], [23, "hat"]
    ] as [number, "kick" | "snare" | "hat"][]) {
      add("percussion", time, 0.06, { percussionKind: kind });
    }

    const allInstruments = {
      piano: true, analog: true, plucked: true, cinematicBass: true, atmosphere: true
    };
    const conducted = applyEnsembleConductor(events, duration, true, allInstruments);
    const find = (voice: string, time: number) =>
      conducted.find(event => event.voice === voice && Math.abs(event.time - time) < 0.001);

    expect(find("lead", 0)).toBeDefined();
    expect(find("pad", 0)).toBeDefined();
    expect(find("pad", 8)).toBeUndefined();
    expect(find("pad", 16)).toBeUndefined();
    expect(find("pad", 24)).toBeDefined();
    expect(find("bass", 0)).toBeDefined();
    expect(find("bass", 2)).toBeUndefined();
    expect(find("bass", 8)).toBeDefined();
    expect(find("bass", 16)).toBeDefined();
    expect(find("bass", 23.5)).toBeDefined();
    expect(find("answer", 8.55)).toBeDefined();
    expect(find("answer", 16.45)).toBeUndefined();
    expect(find("answer", 25.1)).toBeDefined();
    expect(find("texture", 13.1)).toBeDefined();
    expect(find("texture", 20.1)).toBeUndefined();
    expect(find("percussion", 12)).toBeDefined();
    expect(find("percussion", 16)).toBeUndefined(); // bass owns the downbeat
    expect(find("percussion", 18)).toBeDefined();
    expect(find("percussion", 20)).toBeDefined();
    expect(find("percussion", 22)).toBeDefined();
    expect(find("percussion", 0)).toBeUndefined();

    // At any instant there are at most two supporting roles beneath the lead.
    const sampleTimes = conducted.map(event => event.time + Math.min(event.duration / 2, 0.02));
    for (const time of sampleTimes) {
      const activeSupport = new Set(conducted
        .filter(event => event.time <= time && event.time + event.duration > time)
        .map(event => event.voice ?? "lead")
        .filter(voice => voice !== "lead"));
      expect(activeSupport.size).toBeLessThanOrEqual(2);
    }
    expect(find("pad", 0)!.velocityEnd).toBeLessThan(find("pad", 0)!.velocity);
  });

  it("leaves answer and counterline silent when the lead has no usable rests", () => {
    const events: NoteEvent[] = [];
    for (let time = 8; time < 16; time += 0.5) {
      events.push({
        time, duration: 0.48, frequency: 440, velocity: 0.5,
        waveform: "sine", pan: 0, voice: "lead"
      });
    }
    events.push(
      { time: 8.45, duration: 0.2, frequency: 660, velocity: 0.2, waveform: "triangle", pan: 0, voice: "answer" },
      { time: 13.1, duration: 0.3, frequency: 880, velocity: 0.2, waveform: "sawtooth", pan: 0, voice: "texture" }
    );
    const conducted = applyEnsembleConductor(events, 32);
    expect(conducted.some(event => event.voice === "answer")).toBe(false);
    expect(conducted.some(event => event.voice === "texture")).toBe(false);
  });

  it("bypasses conductor processing when its feature toggle is off", () => {
    const events = generateComposition("chaos", { seed: 0.271828 }).events;
    expect(applyEnsembleConductor(events, 16, false)).toEqual(events);
  });

  it("does not schedule disabled instrument roles when the conductor is enabled", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, musicalArrangement: true, musicalExpression: true
    });
    const prepared = preparePlaybackEvents(composition, {
      piano: true, analog: false, plucked: false, cinematicBass: true, atmosphere: false
    }, true);
    expect(prepared.some(event => event.voice === "bass")).toBe(true);
    expect(prepared.some(event => event.voice === "answer")).toBe(false);
    expect(prepared.some(event => event.voice === "texture")).toBe(false);
    expect(prepared.some(event => event.voice === "pad")).toBe(false);
  });

  it("preserves the Shepard illusion without adding ensemble accompaniment", () => {
    const composition = generateComposition("shepard", { seed: 0.314159 });
    const allInstruments = {
      piano: true, analog: true, plucked: true, cinematicBass: true, atmosphere: true
    };
    expect(resolveInstrumentEvents(composition, allInstruments)).toEqual(composition.events);
    expect(preparePlaybackEvents(composition, allInstruments, true)).toEqual(composition.events);
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
