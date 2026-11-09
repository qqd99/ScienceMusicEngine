import { describe, expect, it } from "vitest";
import { deriveHarmonicProgression, deriveMusicalMotif, euclideanPattern, generateComposition, logisticSequence, mandelbrotEscape, resolveTonalCenter, transformMusicalMotif } from "../src/math";
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
  it("infers deterministic major/minor tonal centers from source contours", () => {
    const values = logisticSequence(0.314159, 3.91, 128);
    for (const collection of ["white-key", "black-key"] as const) {
      const first = resolveTonalCenter(values, collection, "auto", "auto", 0.314159);
      const second = resolveTonalCenter(values, collection, "auto", "auto", 0.314159);
      expect(first).toEqual(second);
      expect(first.centerSource).toBe("automatic");
      expect(first.modeSource).toBe("automatic");
      expect(first.rootPitchClass).toBeGreaterThanOrEqual(0);
      expect(first.rootPitchClass).toBeLessThan(12);
      expect(collection === "white-key"
        ? ["Major", "Minor"].includes(first.scale)
        : ["Major Pentatonic", "Minor Pentatonic"].includes(first.scale)
      ).toBe(true);
    }
  });
  it("allows independent manual overrides of tonal center and major/minor character", () => {
    const values = logisticSequence(0.271828, 3.88, 128);
    const manualRoot = resolveTonalCenter(values, "black-key", 66, "auto");
    expect(manualRoot.rootMidi).toBe(66);
    expect(manualRoot.rootPitchClass).toBe(6);
    expect(manualRoot.centerSource).toBe("manual");
    expect(manualRoot.modeSource).toBe("automatic");
    expect(["Major Pentatonic", "Minor Pentatonic"]).toContain(manualRoot.scale);

    const manualMode = resolveTonalCenter(values, "white-key", "auto", "minor");
    expect(manualMode.scale).toBe("Minor");
    expect(manualMode.mode).toBe("minor");
    expect(manualMode.centerSource).toBe("automatic");
    expect(manualMode.modeSource).toBe("manual");
  });
  it("keeps piano notes inside the selected white-key or black-key note collection", () => {
    const intervals: Record<string, number[]> = {
      Major: [0, 2, 4, 5, 7, 9, 11],
      Minor: [0, 2, 3, 5, 7, 8, 10],
      "Major Pentatonic": [0, 2, 4, 7, 9],
      "Minor Pentatonic": [0, 3, 5, 7, 10]
    };
    for (const collection of ["white-key", "black-key"] as const) {
      const composition = generateComposition("chaos", {
        seed: 0.314159, noteCollection: collection, tonalCenter: "auto",
        tonalMode: "auto", musicalArrangement: true, musicalExpression: true
      });
      const tonal = composition.tonality!;
      const allowed = intervals[tonal.scale];
      const lead = composition.events.filter(event => event.voice === "lead");
      expect(lead.length).toBeGreaterThan(0);
      expect(lead.every(event => {
        const midi = Math.round(69 + 12 * Math.log2(event.frequency / 440));
        return allowed.includes(((midi - tonal.rootPitchClass) % 12 + 12) % 12);
      })).toBe(true);
      if (collection === "black-key") {
        for (let i = 0; i < allowed.length; i++) {
          for (let j = i + 1; j < allowed.length; j++) {
            const distance = Math.min((allowed[j] - allowed[i] + 12) % 12, (allowed[i] - allowed[j] + 12) % 12);
            expect(distance).not.toBe(1);
            expect(distance).not.toBe(6);
          }
        }
      }
    }
  });
  it("extracts deterministic, seed-sensitive motifs from mathematical contours", () => {
    const seeds = [0.314159, 0.271828, 0.618034, 0.123456];
    for (const mode of ["mandelbrot", "euclidean", "chaos"] as const) {
      const motifs = seeds.map(seed => {
        const composition = generateComposition(mode, { seed, scale: "Major" });
        return deriveMusicalMotif(composition.values, "Major");
      });
      expect(new Set(motifs.map(motif => motif.join(","))).size).toBeGreaterThan(1);
      for (const motif of motifs) {
        expect(motif).toHaveLength(4);
        expect(motif.every(degree => degree >= 0 && degree < 7)).toBe(true);
      }
    }
  });
  it("develops a motif through inversion, retrograde and diatonic sequence", () => {
    expect(transformMusicalMotif([1, 3, 4, 6], 7)).toEqual({
      inversion: [1, 6, 5, 3],
      retrograde: [6, 4, 3, 1],
      sequence: [3, 5, 6, 1]
    });
  });
  it("derives seed-sensitive chord journeys from all three mathematical sources", () => {
    const seeds = [0.314159, 0.271828, 0.618034, 0.123456];
    for (const mode of ["mandelbrot", "euclidean", "chaos"] as const) {
      const journeys = seeds.map(seed => {
        const composition = generateComposition(mode, { seed, scale: "Major" });
        return deriveHarmonicProgression(composition.values, "Major");
      });
      expect(new Set(journeys.map(journey => journey.join(","))).size).toBeGreaterThan(1);
      for (const journey of journeys) {
        expect(journey).toHaveLength(8);
        expect(journey[0]).toBe(0);
        expect(journey[7]).toBe(0);
        expect(journey.every(degree => degree >= 0 && degree < 7)).toBe(true);
      }
    }
  });
  it("keeps sequence-derived harmony inside each selected scale", () => {
    const composition = generateComposition("chaos", { seed: 0.618034 });
    for (const scale of ["Lydian", "Major", "Minor", "Pentatonic", "Major Pentatonic", "Minor Pentatonic"]) {
      const progression = deriveHarmonicProgression(composition.values, scale);
      const scaleLength = scale.includes("Pentatonic") || scale === "Pentatonic" ? 5 : 7;
      expect(progression.every(degree => degree >= 0 && degree < scaleLength)).toBe(true);
      expect(progression[0]).toBe(0);
      expect(progression[7]).toBe(0);
    }
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
  it("creates a connected 16-bar arc with a sparse opening, rising climax and tonic ending", () => {
    const composition = generateComposition("chaos", { bpm: 120, root: 60, scale: "Major", musicalExpression: true });
    const beat = 0.5;
    const barDuration = 4 * beat;
    const lead = composition.events.filter(event => event.voice === "lead");
    const counts = Array.from({ length: 16 }, (_, bar) =>
      lead.filter(event => event.time >= bar * barDuration && event.time < (bar + 1) * barDuration).length
    );
    expect(counts[0]).toBeLessThan(counts[8]);
    expect(counts[8]).toBeGreaterThanOrEqual(8);
    expect(counts[12]).toBeLessThan(counts[8]);
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
    const reprise = [at(24), at(25), at(26), at(27)];
    expect(reprise.map(note => note.frequency))
      .toEqual(opening.map(note => note.frequency));
    expect(at(30).frequency).toBeCloseTo(440 * Math.pow(2, (72 - 69) / 12), 8);
  });
  it("makes the four-bar climax denser and higher than the opening", () => {
    const composition = generateComposition("chaos", { bpm: 120, musicalExpression: true });
    const lead = composition.events.filter(event => event.voice === "lead");
    const inBar = (bar: number) => lead.filter(event => event.time >= bar * 2 && event.time < (bar + 1) * 2);
    expect(inBar(8)).toHaveLength(8);
    expect(inBar(9)).toHaveLength(8);
    expect(inBar(8).length).toBeGreaterThan(inBar(0).length);
    expect(Math.min(...inBar(8).map(event => event.frequency)))
      .toBeGreaterThan(Math.min(...inBar(0).map(event => event.frequency)));
  });
  it("returns to the tonic harmony and uses four-voice chord colors", () => {
    const composition = generateComposition("mandelbrot", {
      bpm: 120, root: 60, scale: "Major", musicalArrangement: true
    });
    const pads = composition.events.filter(event => event.voice === "pad");
    const first = pads.filter(event => event.time === 0).map(event => Math.round(69 + 12 * Math.log2(event.frequency / 440)) % 12).sort();
    const final = pads.filter(event => event.time === 28).map(event => Math.round(69 + 12 * Math.log2(event.frequency / 440)) % 12).sort();
    expect(first).toContain(2); // Opening add-9 color.
    expect(final).toContain(0); // Final chord doubles the tonic, not the leading tone.
    expect(final).not.toContain(11);
    expect(pads.filter(event => event.time === 0)).toHaveLength(4);
  });
  it("builds bass and pad energy toward the climax, then releases for the reprise", () => {
    const composition = generateComposition("mandelbrot", {
      bpm: 120, musicalArrangement: true, musicalExpression: true
    });
    const bass = composition.events.filter(event => event.voice === "bass");
    const pads = composition.events.filter(event => event.voice === "pad");
    const bassAtBar = (bar: number) => bass.find(event => Math.abs(event.time - bar * 2) < 1e-8)!;
    const padLevelAt = (time: number) => Math.max(...pads.filter(event => event.time === time).map(event => event.velocity));
    expect(bassAtBar(8).velocity).toBeGreaterThan(bassAtBar(0).velocity);
    expect(bassAtBar(15).velocity).toBeLessThan(bassAtBar(8).velocity);
    expect(padLevelAt(20)).toBeGreaterThan(padLevelAt(0));
    expect(padLevelAt(28)).toBeLessThan(padLevelAt(20));
    expect(pads[0].duration).toBeGreaterThan(8 * 0.5);
  });
  it("adds sparse drums, a fuller climax and fills that lead into the next movement", () => {
    const composition = generateComposition("chaos", {
      bpm: 120, musicalArrangement: true, musicalExpression: true
    });
    const drums = composition.events.filter(event => event.voice === "percussion");
    const inBar = (bar: number) => drums.filter(event => event.time >= bar * 2 && event.time < (bar + 1) * 2);
    expect(inBar(0).length).toBeLessThan(inBar(8).length);
    expect(inBar(8).some(event => event.percussionKind === "kick")).toBe(true);
    expect(inBar(8).some(event => event.percussionKind === "snare")).toBe(true);
    expect(inBar(15).length).toBeLessThan(inBar(8).length);
    for (const bar of [3, 7, 11]) {
      expect(inBar(bar).some(event => event.time >= bar * 2 + 1.5)).toBe(true);
    }
  });
  it("lets mathematical activity reshape drum accents while keeping a stable phrase pulse", () => {
    const a = generateComposition("chaos", { seed: 0.314159 }).events
      .filter(event => event.voice === "percussion");
    const b = generateComposition("chaos", { seed: 0.618034 }).events
      .filter(event => event.voice === "percussion");
    expect(a.some(event => event.percussionKind === "kick" && event.time === 0)).toBe(true);
    expect(a.map(event => [event.time, event.percussionKind]))
      .not.toEqual(b.map(event => [event.time, event.percussionKind]));
    expect(a).toEqual(generateComposition("chaos", { seed: 0.314159 }).events
      .filter(event => event.voice === "percussion"));
  });
  it("omits the drum arrangement when musical expression is disabled", () => {
    const composition = generateComposition("chaos", { musicalExpression: false });
    expect(composition.events.some(event => event.voice === "percussion")).toBe(false);
  });
  it("targets a 30-second default and connects the four movements with pickups and harmonic overlaps", () => {
    const composition = generateComposition("mandelbrot");
    const beat = 60 / 128;
    const barDuration = beat * 4;
    const lead = composition.events.filter(event => event.voice === "lead");
    const bass = composition.events.filter(event => event.voice === "bass");
    const pads = composition.events.filter(event => event.voice === "pad");
    expect(composition.duration).toBeCloseTo(30, 8);
    expect(composition.values).toHaveLength(128);
    expect(Math.max(...lead.map(event => event.time))).toBeGreaterThan(27);
    for (const bar of [3, 7, 11]) {
      expect(lead.some(event =>
        event.time >= bar * barDuration + 3 * beat &&
        event.time < (bar + 1) * barDuration
      )).toBe(true);
    }
    for (let chord = 1; chord < 8; chord++) {
      const anticipation = chord * 8 * beat - 0.5 * beat;
      expect(bass.some(event => Math.abs(event.time - anticipation) < 1e-8)).toBe(true);
    }
    expect(pads.some(event => event.duration > 8 * beat)).toBe(true);
  });
  it("uses the sequence-derived chord path for bass roots and movement pickups", () => {
    const root = 60;
    const bpm = 120;
    const beat = 60 / bpm;
    const scaleNotes = [0, 2, 4, 5, 7, 9, 11];
    const composition = generateComposition("chaos", {
      bpm, root, scale: "Major", seed: 0.271828, musicalArrangement: true, musicalExpression: true
    });
    const progression = composition.harmony!.map(frame => frame.degree);
    const bass = composition.events.filter(event => event.voice === "bass");
    const lead = composition.events.filter(event => event.voice === "lead");
    const midi = (frequency: number) => Math.round(69 + 12 * Math.log2(frequency / 440));
    progression.forEach((degree, section) => {
      const anchorTime = section * 8 * beat;
      const anchor = bass.find(event => Math.abs(event.time - anchorTime) < 1e-8)!;
      expect(midi(anchor.frequency)).toBe(root + scaleNotes[degree] - 12);
    });
    for (const bar of [3, 7, 11]) {
      const nextSection = Math.floor((bar + 1) / 2);
      const pickup = lead.filter(event =>
        Math.abs(event.time - (bar * 4 * beat + 7 * 0.5 * beat)) < 1e-8
      ).slice(-1)[0]!;
      expect(midi(pickup.frequency)).toBe(root + 12 + scaleNotes[progression[nextSection]]);
    }
  });
  it("chooses each two-bar chord to support the actual piano phrase", () => {
    for (const scale of ["Lydian", "Major", "Minor", "Pentatonic"]) {
      for (const mode of ["mandelbrot", "euclidean", "chaos"] as const) {
        const composition = generateComposition(mode, {
          seed: 0.314159, scale, musicalArrangement: true, musicalExpression: true
        });
        const harmony = composition.harmony!;
        const beat = composition.duration / (16 * 4);
        const pitchClass = (frequency: number) =>
          ((Math.round(69 + 12 * Math.log2(frequency / 440)) % 12) + 12) % 12;
        for (const frame of harmony) {
          const phrase = composition.events.filter(event =>
            event.voice === "lead" && event.time >= frame.start && event.time < frame.end
          );
          const strong = phrase.filter(event => {
            const position = ((event.time % (beat * 4)) + beat * 4) % (beat * 4);
            return Math.round(position / (beat / 2)) % 2 === 0;
          });
          if (!strong.length) continue;
          if (frame.degree !== 0 || frame.start === 0) {
            const chord = [...frame.chordMidi, frame.colorMidi].map(note => note % 12);
            expect(strong.some(event => chord.includes(pitchClass(event.frequency)))).toBe(true);
          }
        }
      }
    }
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