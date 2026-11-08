import { describe, expect, it } from "vitest";
import { deriveHarmonicProgression, euclideanPattern, generateComposition, logisticSequence, mandelbrotEscape } from "../src/math";
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
    for (const scale of ["Lydian", "Major", "Minor", "Pentatonic"]) {
      const progression = deriveHarmonicProgression(composition.values, scale);
      const scaleLength = scale === "Pentatonic" ? 5 : 7;
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
    expect(first).toEqual(final);
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
    const progression = deriveHarmonicProgression(composition.values, "Major");
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