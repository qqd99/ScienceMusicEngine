import { describe, expect, it } from "vitest";
import { mapPackedScore } from "../src/wasm/bridge";
import { mapPackedScientificSignal } from "../src/science/signal";

describe("WebAssembly score adapter", () => {
  it("converts packed MIDI events into the browser event representation", () => {
    const packedEvents = [
      0, 1, 60, 0.5, -0.25, 0, 2, 1,
      4, 0.5, 36, 0.7, 0, 5, 1, 0
    ];
    const packedTonality = [0, 60, 0, 0, 0.75, 0, 1];
    const composition = mapPackedScore(
      packedEvents, packedTonality, [0.25, 0.75], 120
    );

    expect(composition.label).toBe("wasm");
    expect(composition.duration).toBe(32);
    expect(composition.values).toEqual([0.25, 0.75]);
    expect(composition.events).toHaveLength(2);
    expect(composition.events[0]).toMatchObject({
      time: 0,
      duration: 0.5,
      velocity: 0.5,
      pan: -0.25,
      voice: "lead",
      phraseIndex: 2,
      accent: true
    });
    expect(composition.events[0].frequency).toBeCloseTo(
      440 * Math.pow(2, (60 - 69) / 12), 12
    );
    expect(composition.events[1]).toMatchObject({
      time: 2,
      duration: 0.25,
      voice: "percussion",
      percussionKind: "kick",
      accent: false
    });
    expect(composition.tonality).toMatchObject({
      rootPitchClass: 0,
      rootMidi: 60,
      collection: "white-key",
      mode: "major",
      scale: "Major",
      centerSource: "automatic",
      modeSource: "manual"
    });
  });

  it("maps each C++ support role to the existing browser voice", () => {
    const packedEvents = [
      0, 1, 48, 0.4, 0, 1, 0, 0,
      1, 1, 60, 0.4, 0, 2, 0, 0,
      2, 1, 72, 0.4, 0, 3, 0, 0,
      3, 1, 76, 0.4, 0, 4, 0, 0
    ];
    const composition = mapPackedScore(
      packedEvents, [0, 60, 0, 0, 0.5, 0, 0], [], 128
    );
    expect(composition.events.map(event => event.voice)).toEqual([
      "bass", "pad", "answer", "texture"
    ]);
  });

  it("maps C++ scientific signal summaries and frames onto channel IDs", () => {
    const analysis = mapPackedScientificSignal(
      [0.5, -1, 1, 0.707, 0.5, 0.01, 0.2, 0.1, 4, 0.95, 0],
      [
        0, 0, 2, 0, 0.5, 0.4, 0.5, 0.2, 0.1, 1,
        0, 2, 4, 0.5, 1, 0.6, 0.7, 0.1, -0.05, 0.8
      ],
      [],
      [{ id: "grid-a", unit: "V", samples: [0, 1, 0, -1] }],
      4,
      0
    );
    expect(analysis.channels[0]).toMatchObject({
      channelId: "grid-a",
      unit: "V",
      mean: 0.5,
      dominantPeriodSamples: 4,
      dominantFrequencyHz: 0
    });
    expect(analysis.frames).toHaveLength(2);
    expect(analysis.frames[1]).toMatchObject({
      channelId: "grid-a",
      startFraction: 0.5,
      endFraction: 1,
      activity: 0.1
    });
  });

  it("rejects malformed scientific signal frames and channel relationships", () => {
    const summary = [0, -1, 1, 0.7, 0.5, 0, 0.2, 0.1, 0, 0, 0];
    expect(() => mapPackedScientificSignal(
      summary,
      [0, 0, 4, 0, 0.5, 0, 0, 0, 0, 0],
      [],
      [{ id: "a", samples: [0, 1, 0, -1] }],
      4,
      0
    )).toThrow(/timeline range/);
    expect(() => mapPackedScientificSignal(
      [...summary, ...summary],
      [],
      [1, 0, 0, 0, 0, 1],
      [{ id: "a", samples: [0, 1, 0, -1] }, { id: "b", samples: [1, 0, -1, 0] }],
      4,
      0
    )).toThrow(/channel pair/);
  });

  it("rejects malformed event and tonal records", () => {
    expect(() => mapPackedScore(
      [0, 1, 60], [0, 60, 0, 0, 0.5, 0, 0], [], 128
    )).toThrow(/record length/);
    expect(() => mapPackedScore(
      [0, 1, 60, 0.5, 0, 9, 0, 0],
      [0, 60, 0, 0, 0.5, 0, 0], [], 128
    )).toThrow(/invalid value/);
    expect(() => mapPackedScore(
      [], [0, 60, 9, 0, 0.5, 0, 0], [], 128
    )).toThrow(/tonal metadata/);
  });
});
