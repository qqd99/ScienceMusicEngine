import { describe, expect, it } from "vitest";
import { AdaptiveConductorSession, applyEnsembleConductor, DEFAULT_INSTRUMENTS, DEFAULT_INSTRUMENT_LEVELS, DEFAULT_SOUND_PROFILE, getConductorSection, hasDedicatedInstruments, MASTER_OUTPUT_BOOST, MASTER_OUTPUT_BOOST_DB, preparePlaybackEvents, resolveInstrumentEvents } from "../src/audio";
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
    expect(a.filter(event => event.voice === "bass")).toHaveLength(16);
    expect(a.filter(event => event.voice === "pad")).toHaveLength(32);
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
    expect(first.filter(event => event.voice === "texture").length).toBeLessThan(16);
    expect(first.some(event => event.voice === "bass")).toBe(true);
    expect(first.some(event => event.voice === "pad")).toBe(true);
  });

  it("makes plucked responses land on chord tones from the active pad voicing", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, musicalArrangement: true, musicalExpression: true
    });
    const resolved = resolveInstrumentEvents(composition, {
      piano: true, analog: true, plucked: true, cinematicBass: true, atmosphere: true
    });
    const answers = resolved.filter(event => event.voice === "answer");
    const textures = resolved.filter(event => event.voice === "texture");
    const pitchClass = (frequency: number) =>
      ((Math.round(69 + 12 * Math.log2(frequency / 440)) % 12) + 12) % 12;
    const frameAt = (time: number) => {
      const beat = composition.duration / (16 * 4);
      const next = composition.harmony!.find(frame => frame.start > time + 1e-8);
      return next && time >= next.start - beat * 0.5 - 1e-8
        ? next
        : composition.harmony!.find(frame => time >= frame.start - 1e-8 && time < frame.end - 1e-8)!;
    };
    expect(answers.length).toBeGreaterThan(0);
    for (const event of [...answers, ...textures]) {
      const frame = frameAt(event.time);
      const chord = [...frame.chordMidi, frame.colorMidi].map(note => note % 12);
      expect(chord).toContain(pitchClass(event.frequency));
    }
  });
  it("builds fallback bass and pads from the selected scale's shared chord frames", () => {
    const composition = generateComposition("mandelbrot", {
      seed: 0.314159, scale: "Minor", musicalArrangement: false, musicalExpression: true
    });
    const resolved = resolveInstrumentEvents(composition, {
      piano: true, analog: false, plucked: false, cinematicBass: true, atmosphere: true
    });
    const pads = resolved.filter(event => event.voice === "pad");
    const bass = resolved.filter(event => event.voice === "bass");
    const pitchClass = (frequency: number) =>
      ((Math.round(69 + 12 * Math.log2(frequency / 440)) % 12) + 12) % 12;
    expect(pads).toHaveLength(32);
    expect(bass).toHaveLength(16);
    for (const frame of composition.harmony!) {
      const framePads = pads.filter(event => event.time === frame.start);
      const chord = [...frame.chordMidi, frame.colorMidi].map(note => note % 12);
      expect(framePads).toHaveLength(4);
      expect(framePads.every(event => chord.includes(pitchClass(event.frequency)))).toBe(true);
    }
    for (const event of bass) {
      const bar = Math.round(event.time / (composition.duration / 16));
      const frame = composition.harmony![Math.floor(bar / 2)];
      const allowed = [frame.rootMidi - 12, (frame.chordMidi[2] ?? frame.rootMidi + 7) - 24]
        .map(note => ((note % 12) + 12) % 12);
      expect(allowed).toContain(pitchClass(event.frequency));
    }
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

  it("adapts orchestration to phrase density, rests and changing musical energy", () => {
    const duration = 64;
    const beat = 1;
    const events: NoteEvent[] = [];
    const add = (
      voice: NoteEvent["voice"],
      time: number,
      noteDuration = 0.4,
      extras: Partial<NoteEvent> = {}
    ) => events.push({
      time, duration: noteDuration, frequency: 440, velocity: 0.58,
      waveform: "sine", pan: 0, voice, ...extras
    });

    // Phrase 1: open melody with room for harmonic support and a response.
    for (const time of [0, 2, 4, 6]) add("lead", time, 0.5);
    for (const time of [0, 4]) add("bass", time, 1.1);
    for (const tone of [0, 4, 7, 11]) {
      add("pad", 0, 7.7, { frequency: 440 * Math.pow(2, tone / 12) });
    }
    add("answer", 0.8, 0.35);
    add("answer", 4.8, 0.35);
    add("texture", 1.0, 0.4);
    add("texture", 5.0, 0.4);

    // Phrase 2: dense melody. The conductor should reduce harmonic clutter and
    // use only selected rhythmic support instead of adding answering melodies.
    for (let i = 0; i < 16; i++) add("lead", 8 + i * 0.5, 0.42);
    // Deliberately place percussion before bass at the same downbeat.
    add("percussion", 8, 0.06, { percussionKind: "kick" });
    add("bass", 8, 1.1);
    add("pad", 8, 7.7);
    add("answer", 8.45, 0.2);
    add("texture", 8.45, 0.2);
    add("percussion", 10, 0.06, { percussionKind: "snare" });
    add("percussion", 12, 0.06, { percussionKind: "kick" });
    add("bass", 12, 1.1);
    add("percussion", 14, 0.06, { percussionKind: "snare" });

    // Phrase 3: the lead opens up again. The conductor should notice the
    // density drop and reconsider which supporting role is useful.
    for (const time of [16, 18, 20, 22]) add("lead", time, 0.5);
    for (const time of [16, 20]) add("bass", time, 1.1);
    for (const tone of [0, 4, 7]) add("pad", 16, 7.7, { frequency: 440 * Math.pow(2, tone / 12) });
    add("answer", 16.8, 0.35);
    add("texture", 17.0, 0.4);

    // Phrase 4: spacious reprise and cadence.
    for (const time of [24, 26, 28, 30]) add("lead", time, 0.5);
    for (const time of [24, 28]) add("bass", time, 1.1);
    for (const tone of [0, 4, 7]) add("pad", 24, 7.7, { frequency: 440 * Math.pow(2, tone / 12) });
    add("answer", 24.8, 0.35);
    add("texture", 25.0, 0.4);

    const allInstruments = {
      piano: true, analog: true, plucked: true, cinematicBass: true, atmosphere: true
    };
    const session = new AdaptiveConductorSession(events, duration, allInstruments, true);
    const conducted = session.prepareAll();
    const decisions = [0, 1, 2, 3].map(index => session.getDecision(index)!);

    expect(decisions[0].analysis.density).toBeLessThan(decisions[1].analysis.density);
    expect(decisions[0].analysis.gapRatio).toBeGreaterThan(decisions[1].analysis.gapRatio);
    expect(decisions[1].analysis.densityChange).toBeGreaterThan(0);
    expect(decisions[2].analysis.densityChange).toBeLessThan(0);
    expect(decisions.every(decision => decision.roles.length <= 2)).toBe(true);
    expect(decisions[0].roles).not.toEqual(decisions[1].roles);
    expect(decisions[1].roles).toContain("percussion");
    expect(decisions[2].roles).toContain("answer");

    const find = (voice: string, time: number) =>
      conducted.find(event => event.voice === voice && Math.abs(event.time - time) < 0.001);
    expect(find("lead", 8)).toBeDefined();
    expect(find("answer", 8.45)).toBeUndefined(); // Dense melody leaves no answer space.
    expect(find("texture", 8.45)).toBeUndefined();
    expect(find("percussion", 8)).toBeUndefined(); // Bass owns the downbeat.
    expect(find("percussion", 10)).toBeDefined();
    expect(conducted.every(event => event.voice === "lead" || decisions.some(decision =>
      decision.roles.includes(event.voice as "answer" | "texture" | "bass" | "pad" | "percussion")
    ))).toBe(true);
  });

  it("uses the analog counterline when an unusually long rest makes it suitable", () => {
    const events: NoteEvent[] = [
      { time: 0, duration: 0.3, frequency: 440, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 3, duration: 0.3, frequency: 494, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 6, duration: 0.3, frequency: 523, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 1, duration: 0.5, frequency: 659, velocity: 0.2, waveform: "sawtooth", pan: 0.2, voice: "texture" }
    ];
    const session = new AdaptiveConductorSession(events, 64, {
      piano: true, analog: true, plucked: false, cinematicBass: false, atmosphere: false
    }, true);
    const conducted = session.prepareAll();
    expect(session.getDecision(0)!.roles).toContain("texture");
    expect(conducted.some(event => event.voice === "texture")).toBe(true);
  });

  it("prepares adaptive decisions phrase by phrase without duplicate events", () => {
    const events: NoteEvent[] = [
      { time: 0, duration: 0.5, frequency: 440, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 2, duration: 0.5, frequency: 494, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 8, duration: 0.5, frequency: 523, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 8.5, duration: 0.5, frequency: 587, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" },
      { time: 9, duration: 0.5, frequency: 659, velocity: 0.5, waveform: "sine", pan: 0, voice: "lead" }
    ];
    const instruments = {
      piano: true, analog: false, plucked: false, cinematicBass: false, atmosphere: false
    };
    const session = new AdaptiveConductorSession(events, 64, instruments, true);
    const firstPhrase = session.prepareThrough(7.99);
    expect(session.getDecision(0)).not.toBeNull();
    expect(session.getDecision(1)).toBeNull();
    const secondPhrase = session.prepareThrough(8);
    expect(session.getDecision(1)).not.toBeNull();
    expect(session.prepareThrough(8)).toEqual([]);
    const rest = session.prepareThrough(64);
    const incremental = [...firstPhrase, ...secondPhrase, ...rest];
    expect(incremental).toEqual(applyEnsembleConductor(events, 64, true, instruments));
  });

  it("keeps at most two supporting roles active and leaves unusable melodic gaps silent", () => {
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
    const session = new AdaptiveConductorSession(events, 64, undefined, true);
    const conducted = session.prepareAll();
    expect(conducted.some(event => event.voice === "answer")).toBe(false);
    expect(conducted.some(event => event.voice === "texture")).toBe(false);
    expect(session.getDecision(1)!.roles).toEqual([]);
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
    const conducted = applyEnsembleConductor(events, 64);
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
    const originalLayers = composition.events.filter(event => event.voice === undefined);
    expect(composition.events.some(event => event.voice === "bass" || event.voice === "pad")).toBe(true);
    expect(resolveInstrumentEvents(composition, allInstruments)).toEqual(originalLayers);
    expect(preparePlaybackEvents(composition, allInstruments, true)).toEqual(originalLayers);
    expect(originalLayers.every(event => event.voice === undefined)).toBe(true);
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
    expect(liveEvents.some(event => event.voice === "percussion" && event.time >= composition.duration * 0.5)).toBe(true);
    for (let phrase = 0; phrase < 8; phrase++) {
      const start = phrase * composition.duration / 8;
      const end = (phrase + 1) * composition.duration / 8;
      const phraseRoles = new Set(liveEvents
        .filter(event => event.time >= start && event.time < end && event.voice !== "lead")
        .map(event => event.voice));
      expect(phraseRoles.size).toBeLessThanOrEqual(2);
    }
  });

  it("applies a fixed +14 dB master output gain after compression", () => {
    expect(MASTER_OUTPUT_BOOST_DB).toBe(14);
    expect(MASTER_OUTPUT_BOOST).toBeCloseTo(5.011872, 5);
    expect(20 * Math.log10(MASTER_OUTPUT_BOOST)).toBeCloseTo(14, 5);
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
