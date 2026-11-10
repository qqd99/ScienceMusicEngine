import { describe, expect, it } from "vitest";
import { mapPackedScientificSignal } from "../src/science/signal";

describe("scientific signal ABI mapping", () => {
  it("maps summaries and normalized frames to stable channel identifiers", () => {
    const analysis = mapPackedScientificSignal(
      [0.5, -1, 1, 0.707, 0.5, 0.01, 0.2, 0.1, 4, 0.95, 0],
      [
        0, 0, 2, 0, 0.5, 0.4, 0.5, 0.2, 0.1, 1,
        0, 2, 4, 0.5, 1, 0.6, 0.7, 0.1, -0.05, 0.8
      ],
      [],
      [{ id: "grid-a", unit: "V", samples: [0, 1, 0, -1] }],
      4, 0
    );
    expect(analysis.channels[0]).toMatchObject({
      channelId: "grid-a", unit: "V", mean: 0.5,
      dominantPeriodSamples: 4, dominantFrequencyHz: 0
    });
    expect(analysis.frames).toHaveLength(2);
    expect(analysis.frames[1]).toMatchObject({
      channelId: "grid-a", startFraction: 0.5, endFraction: 1, activity: 0.1
    });
  });

  it("rejects invalid frame ranges and malformed channel-pair relationships", () => {
    const summary = [0, -1, 1, 0.7, 0.5, 0, 0.2, 0.1, 0, 0, 0];
    expect(() => mapPackedScientificSignal(
      summary, [0, 0, 5, 0, 0.5, 0, 0, 0, 0, 0], [],
      [{ id: "a", samples: [0, 1, 0, -1] }], 4, 0
    )).toThrow(/timeline range/);
    expect(() => mapPackedScientificSignal(
      [...summary, ...summary], [],
      [1, 0, 0, 0, 0, 1],
      [{ id: "a", samples: [0, 1, 0, -1] }, { id: "b", samples: [1, 0, -1, 0] }],
      4, 0
    )).toThrow(/channel pair/);
  });
});
