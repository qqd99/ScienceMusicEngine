import { mapPackedScientificSignal, type ScientificSignalAnalysis, type ScientificSignalInput } from "../science/signal";
import type {
  Composition,
  NoteCollection,
  NoteEvent,
  TonalContext,
  TonalModeChoice
} from "../math";

const SME_OK = 0;
const SME_BUFFER_TOO_SMALL = 1;
const SME_PACKED_OPTION_COUNT = 11;
const SME_EVENT_STRIDE = 8;
const SME_TONALITY_STRIDE = 7;
const MAX_SOURCE_VALUES = 1_000_000;
const MAX_SCORE_EVENTS = 100_000;
const MAX_SIGNAL_CHANNELS = 32;
const MAX_TOTAL_SIGNAL_SAMPLES = 1_000_000;
const SIGNAL_SUMMARY_STRIDE = 11;
const SIGNAL_FRAME_STRIDE = 10;
const SIGNAL_RELATIONSHIP_STRIDE = 6;

type Voice = NonNullable<NoteEvent["voice"]>;

export interface WasmGenerationOptions {
  seed?: number | bigint;
  bpm?: number;
  collection?: NoteCollection;
  rootPitchClass?: number | "auto";
  mode?: TonalModeChoice;
  enableBass?: boolean;
  enablePad?: boolean;
  enablePlucked?: boolean;
  enableAnalog?: boolean;
  enablePercussion?: boolean;
}

interface ResolvedOptions {
  seed: bigint;
  bpm: number;
  collection: NoteCollection;
  rootPitchClass: number | "auto";
  mode: TonalModeChoice;
  enableBass: boolean;
  enablePad: boolean;
  enablePlucked: boolean;
  enableAnalog: boolean;
  enablePercussion: boolean;
}

export interface ScienceMusicWasmModule {
  HEAPF64: Float64Array;
  HEAPU32: Uint32Array;
  _malloc(byteLength: number): number;
  _free(pointer: number): void;
  _sme_generate_score_packed(
    sourcePointer: number,
    sourceCount: number,
    optionsPointer: number,
    optionCount: number,
    outputPointer: number,
    outputCapacity: number,
    outputCountPointer: number,
    outputTonalityPointer: number
  ): number;
  _sme_analyze_signal_packed(
    samplesPointer: number,
    sampleCount: number,
    channelCount: number,
    sampleRateHz: number,
    frameCount: number,
    summariesPointer: number,
    summaryCapacity: number,
    framesPointer: number,
    frameCapacity: number,
    relationshipsPointer: number,
    relationshipCapacity: number,
    summaryCountPointer: number,
    frameCountPointer: number,
    relationshipCountPointer: number
  ): number;
}

type ModuleFactory = (options: {
  locateFile(path: string, prefix?: string): string;
}) => Promise<ScienceMusicWasmModule>;

let modulePromise: Promise<ScienceMusicWasmModule> | undefined;

async function instantiateWasmModule(): Promise<ScienceMusicWasmModule> {
  const baseUrl = import.meta.env.BASE_URL;
  const moduleUrl = baseUrl + "wasm/science_music_wasm.js";
  const wasmUrl = baseUrl + "wasm/science_music_wasm.wasm";
  const imported = await import(/* @vite-ignore */ moduleUrl) as {
    default?: ModuleFactory;
  };
  if (typeof imported.default !== "function") {
    throw new Error("The Science Music WebAssembly factory was not exported.");
  }
  return imported.default({
    locateFile: (path: string) => path.endsWith(".wasm")
      ? wasmUrl
      : baseUrl + "wasm/" + path
  });
}

/** Load the optional Emscripten module once; a failed load can be retried. */
export async function loadWasmModule(): Promise<ScienceMusicWasmModule> {
  if (modulePromise) return modulePromise;
  const pending = instantiateWasmModule();
  modulePromise = pending;
  void pending.catch(() => {
    if (modulePromise === pending) modulePromise = undefined;
  });
  return pending;
}

function resolveOptions(input: WasmGenerationOptions): ResolvedOptions {
  const seedInput = input.seed ?? 314159;
  let seed: bigint;
  if (typeof seedInput === "bigint") {
    seed = seedInput;
  } else {
    if (!Number.isSafeInteger(seedInput) || seedInput < 0) {
      throw new RangeError("WASM seed must be a non-negative safe integer or bigint.");
    }
    seed = BigInt(seedInput);
  }
  if (seed < 0n || seed > 0xffffffffffffffffn) {
    throw new RangeError("WASM seed must fit an unsigned 64-bit integer.");
  }

  const bpm = input.bpm ?? 128;
  if (!Number.isInteger(bpm) || bpm < 45 || bpm > 180) {
    throw new RangeError("WASM tempo must be an integer from 45 to 180 BPM.");
  }

  const collection = input.collection ?? "white-key";
  if (collection !== "white-key" && collection !== "black-key") {
    throw new TypeError("Unknown WASM note collection.");
  }

  const rootPitchClass = input.rootPitchClass ?? "auto";
  if (rootPitchClass !== "auto" &&
      (!Number.isInteger(rootPitchClass) || rootPitchClass < 0 || rootPitchClass > 11)) {
    throw new RangeError("Root pitch class must be 'auto' or an integer from 0 to 11.");
  }

  const mode = input.mode ?? "auto";
  if (mode !== "auto" && mode !== "major" && mode !== "minor") {
    throw new TypeError("Unknown WASM tonal mode.");
  }

  return {
    seed,
    bpm,
    collection,
    rootPitchClass,
    mode,
    enableBass: input.enableBass ?? true,
    enablePad: input.enablePad ?? true,
    enablePlucked: input.enablePlucked ?? true,
    enableAnalog: input.enableAnalog ?? true,
    enablePercussion: input.enablePercussion ?? true
  };
}

function normalizeSourceValues(sourceValues: readonly number[]): Float64Array {
  if (sourceValues.length > MAX_SOURCE_VALUES) {
    throw new RangeError("WASM source exceeds the one-million-value safety limit.");
  }
  const normalized = new Float64Array(sourceValues.length);
  for (let index = 0; index < sourceValues.length; index += 1) {
    const value = sourceValues[index];
    if (!Number.isFinite(value)) {
      throw new TypeError("WASM source values must all be finite numbers.");
    }
    normalized[index] = Math.min(1, Math.max(0, value));
  }
  return normalized;
}

const ROLE_VOICES: readonly Voice[] = [
  "lead", "bass", "pad", "answer", "texture", "percussion"
];

const ROLE_WAVEFORMS: Record<Voice, OscillatorType> = {
  lead: "triangle",
  bass: "triangle",
  pad: "sine",
  answer: "triangle",
  texture: "sawtooth",
  percussion: "square",
  // Reserved for the dedicated TypeScript physical-signal renderer; never emitted by C++.
  grid: "sine"
};

const DRUM_KINDS: Record<number, NonNullable<NoteEvent["percussionKind"]>> = {
  36: "kick",
  38: "snare",
  42: "hat"
};

/** Pure conversion from the packed C ABI representation to browser events. */
export function mapPackedScore(
  packedEvents: ArrayLike<number>,
  packedTonality: ArrayLike<number>,
  sourceValues: readonly number[],
  bpm: number
): Composition {
  if (!Number.isInteger(bpm) || bpm < 45 || bpm > 180) {
    throw new RangeError("WASM tempo must be an integer from 45 to 180 BPM.");
  }
  if (packedEvents.length % SME_EVENT_STRIDE !== 0) {
    throw new TypeError("Packed WASM event data has an invalid record length.");
  }
  if (packedTonality.length < SME_TONALITY_STRIDE) {
    throw new TypeError("Packed WASM tonal metadata is incomplete.");
  }

  const secondsPerBeat = 60 / bpm;
  const events: NoteEvent[] = [];
  for (let offset = 0; offset < packedEvents.length; offset += SME_EVENT_STRIDE) {
    const startBeat = packedEvents[offset];
    const durationBeats = packedEvents[offset + 1];
    const midiPitch = packedEvents[offset + 2];
    const velocity = packedEvents[offset + 3];
    const pan = packedEvents[offset + 4];
    const role = packedEvents[offset + 5];
    const phraseIndex = packedEvents[offset + 6];
    const accent = packedEvents[offset + 7];

    const fields = [
      startBeat, durationBeats, midiPitch, velocity, pan,
      role, phraseIndex, accent
    ];
    if (fields.some(value => !Number.isFinite(value))) {
      throw new TypeError("Packed WASM event contains a non-finite field.");
    }
    if (startBeat < 0 || durationBeats <= 0 ||
        !Number.isInteger(midiPitch) || midiPitch < 0 || midiPitch > 127 ||
        !Number.isInteger(role) || role < 0 || role >= ROLE_VOICES.length ||
        !Number.isInteger(phraseIndex) || phraseIndex < 0 ||
        (accent !== 0 && accent !== 1)) {
      throw new TypeError("Packed WASM event contains an invalid value.");
    }

    const voice = ROLE_VOICES[role];
    const event: NoteEvent = {
      time: startBeat * secondsPerBeat,
      duration: durationBeats * secondsPerBeat,
      frequency: 440 * Math.pow(2, (midiPitch - 69) / 12),
      velocity: Math.min(1, Math.max(0, velocity)),
      waveform: ROLE_WAVEFORMS[voice],
      pan: Math.min(1, Math.max(-1, pan)),
      voice,
      phraseIndex,
      accent: accent === 1
    };
    if (voice === "percussion") {
      event.percussionKind = DRUM_KINDS[midiPitch] ?? "kick";
    }
    events.push(event);
  }

  const rootPitchClass = packedTonality[0];
  const rootMidi = packedTonality[1];
  const collectionCode = packedTonality[2];
  const modeCode = packedTonality[3];
  const confidence = packedTonality[4];
  const centerWasManual = packedTonality[5];
  const modeWasManual = packedTonality[6];

  if (![rootPitchClass, rootMidi, collectionCode, modeCode, confidence,
        centerWasManual, modeWasManual].every(Number.isFinite) ||
      !Number.isInteger(rootPitchClass) || rootPitchClass < 0 || rootPitchClass > 11 ||
      !Number.isInteger(rootMidi) || !Number.isInteger(collectionCode) ||
      (collectionCode !== 0 && collectionCode !== 1) ||
      !Number.isInteger(modeCode) || (modeCode !== 0 && modeCode !== 1) ||
      (centerWasManual !== 0 && centerWasManual !== 1) ||
      (modeWasManual !== 0 && modeWasManual !== 1)) {
    throw new TypeError("Packed WASM tonal metadata contains an invalid value.");
  }

  const collection: NoteCollection = collectionCode === 0 ? "white-key" : "black-key";
  const mode = modeCode === 0 ? "major" : "minor";
  const scale = collection === "white-key"
    ? (mode === "major" ? "Major" : "Minor")
    : (mode === "major" ? "Major Pentatonic" : "Minor Pentatonic");
  const tonality: TonalContext = {
    rootMidi,
    rootPitchClass,
    scale,
    collection,
    mode,
    centerSource: centerWasManual === 1 ? "manual" : "automatic",
    modeSource: modeWasManual === 1 ? "manual" : "automatic",
    confidence: Math.min(1, Math.max(0, confidence))
  };

  return {
    events,
    duration: 16 * 4 * secondsPerBeat,
    values: [...sourceValues],
    label: "wasm",
    richInstruments: true,
    musicalArrangement: true,
    musicalExpression: true,
    tonality
  };
}

/**
 * Generate a symbolic score with the C++ core. This is opt-in and does not
 * change the existing TypeScript composition or live-playback path.
 */

/**
 * Analyze synchronized scientific channels in the C++ core. Frame fractions
 * map onto the same normalized timeline used by the visualizer and music.
 */
export async function analyzeScientificSignal(
  input: ScientificSignalInput,
  requestedFrameCount = 16
): Promise<ScientificSignalAnalysis> {
  const channels = input.channels;
  if (!Array.isArray(channels) || channels.length < 1 ||
      channels.length > MAX_SIGNAL_CHANNELS) {
    throw new RangeError("Scientific signal must contain between one and 32 channels.");
  }
  const sampleCount = channels[0]?.samples.length ?? 0;
  if (!Number.isInteger(sampleCount) || sampleCount < 2 ||
      sampleCount * channels.length > MAX_TOTAL_SIGNAL_SAMPLES) {
    throw new RangeError("Scientific signal sample count is outside the supported range.");
  }
  if (!Number.isInteger(requestedFrameCount) || requestedFrameCount < 1 ||
      requestedFrameCount > 256 || requestedFrameCount > sampleCount) {
    throw new RangeError("Signal frame count must be between one and min(256, sample count).");
  }
  const sampleRateHz = input.sampleRateHz ?? 0;
  if (!Number.isFinite(sampleRateHz) || sampleRateHz < 0 ||
      sampleRateHz > 1_000_000_000) {
    throw new RangeError("Signal sample rate must be zero or a finite value up to 1e9 Hz.");
  }

  const ids = new Set<string>();
  const flattened = new Float64Array(sampleCount * channels.length);
  channels.forEach((channel, channelIndex) => {
    if (!channel.id.trim() || ids.has(channel.id)) {
      throw new TypeError("Scientific signal channel IDs must be non-empty and unique.");
    }
    ids.add(channel.id);
    if (channel.samples.length !== sampleCount) {
      throw new TypeError("All scientific signal channels must have the same sample count.");
    }
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const value = channel.samples[sample];
      if (!Number.isFinite(value)) {
        throw new TypeError("Scientific signal samples must all be finite numbers.");
      }
      flattened[channelIndex * sampleCount + sample] = value;
    }
  });

  const relationshipCount = channels.length * (channels.length - 1) / 2;
  const frameCapacity = channels.length * requestedFrameCount;
  const module = await loadWasmModule();
  const allocations: number[] = [];
  const allocate = (byteLength: number): number => {
    const pointer = module._malloc(Math.max(1, byteLength));
    if (!pointer) throw new Error("WebAssembly signal-analysis allocation failed.");
    allocations.push(pointer);
    return pointer;
  };

  try {
    const samplesPointer = allocate(flattened.byteLength);
    const summariesPointer = allocate(
      channels.length * SIGNAL_SUMMARY_STRIDE * Float64Array.BYTES_PER_ELEMENT
    );
    const framesPointer = allocate(
      frameCapacity * SIGNAL_FRAME_STRIDE * Float64Array.BYTES_PER_ELEMENT
    );
    const relationshipsPointer = relationshipCount > 0
      ? allocate(relationshipCount * SIGNAL_RELATIONSHIP_STRIDE * Float64Array.BYTES_PER_ELEMENT)
      : 0;
    const countsPointer = allocate(3 * Uint32Array.BYTES_PER_ELEMENT);

    module.HEAPF64.set(flattened, samplesPointer / Float64Array.BYTES_PER_ELEMENT);
    const status = module._sme_analyze_signal_packed(
      samplesPointer,
      sampleCount,
      channels.length,
      sampleRateHz,
      requestedFrameCount,
      summariesPointer,
      channels.length,
      framesPointer,
      frameCapacity,
      relationshipsPointer,
      relationshipCount,
      countsPointer,
      countsPointer + Uint32Array.BYTES_PER_ELEMENT,
      countsPointer + 2 * Uint32Array.BYTES_PER_ELEMENT
    );
    if (status !== SME_OK) {
      throw new Error("C++ scientific signal analysis failed with status " + status + ".");
    }

    const countOffset = countsPointer / Uint32Array.BYTES_PER_ELEMENT;
    const summaryCount = module.HEAPU32[countOffset];
    const frameCount = module.HEAPU32[countOffset + 1];
    const actualRelationshipCount = module.HEAPU32[countOffset + 2];
    if (summaryCount !== channels.length ||
        frameCount !== frameCapacity ||
        actualRelationshipCount !== relationshipCount) {
      throw new Error("C++ scientific signal analysis returned inconsistent record counts.");
    }

    const summariesOffset = summariesPointer / Float64Array.BYTES_PER_ELEMENT;
    const framesOffset = framesPointer / Float64Array.BYTES_PER_ELEMENT;
    const relationshipsOffset = relationshipsPointer / Float64Array.BYTES_PER_ELEMENT;
    const packedSummaries = Float64Array.from(module.HEAPF64.subarray(
      summariesOffset, summariesOffset + summaryCount * SIGNAL_SUMMARY_STRIDE
    ));
    const packedFrames = Float64Array.from(module.HEAPF64.subarray(
      framesOffset, framesOffset + frameCount * SIGNAL_FRAME_STRIDE
    ));
    const packedRelationships = relationshipCount > 0
      ? Float64Array.from(module.HEAPF64.subarray(
        relationshipsOffset,
        relationshipsOffset + actualRelationshipCount * SIGNAL_RELATIONSHIP_STRIDE
      ))
      : new Float64Array();

    return mapPackedScientificSignal(
      packedSummaries, packedFrames, packedRelationships,
      channels, sampleCount, sampleRateHz
    );
  } finally {
    for (let index = allocations.length - 1; index >= 0; index -= 1) {
      module._free(allocations[index]);
    }
  }
}

export async function generateWasmComposition(
  sourceValues: readonly number[],
  inputOptions: WasmGenerationOptions = {}
): Promise<Composition> {
  const options = resolveOptions(inputOptions);
  const normalizedValues = normalizeSourceValues(sourceValues);
  const wasm = await loadWasmModule();
  const allocations: number[] = [];

  const allocate = (byteLength: number): number => {
    const pointer = wasm._malloc(Math.max(1, byteLength));
    if (!pointer) throw new Error("WebAssembly could not allocate linear memory.");
    allocations.push(pointer);
    return pointer;
  };

  try {
    const sourcePointer = allocate(normalizedValues.byteLength);
    if (normalizedValues.length > 0) {
      wasm.HEAPF64.set(normalizedValues, sourcePointer / Float64Array.BYTES_PER_ELEMENT);
    }

    const optionValues = new Uint32Array([
      Number(options.seed & 0xffffffffn),
      Number((options.seed >> 32n) & 0xffffffffn),
      options.bpm,
      options.collection === "white-key" ? 0 : 1,
      options.rootPitchClass === "auto" ? 12 : options.rootPitchClass,
      options.mode === "major" ? 0 : options.mode === "minor" ? 1 : 2,
      options.enableBass ? 1 : 0,
      options.enablePad ? 1 : 0,
      options.enablePlucked ? 1 : 0,
      options.enableAnalog ? 1 : 0,
      options.enablePercussion ? 1 : 0
    ]);
    if (optionValues.length !== SME_PACKED_OPTION_COUNT) {
      throw new Error("Internal WebAssembly options layout mismatch.");
    }

    const optionsPointer = allocate(optionValues.byteLength);
    wasm.HEAPU32.set(optionValues, optionsPointer / Uint32Array.BYTES_PER_ELEMENT);
    const outputCountPointer = allocate(Uint32Array.BYTES_PER_ELEMENT);
    const outputTonalityPointer = allocate(
      SME_TONALITY_STRIDE * Float64Array.BYTES_PER_ELEMENT
    );

    const queryStatus = wasm._sme_generate_score_packed(
      sourcePointer, normalizedValues.length,
      optionsPointer, optionValues.length,
      0, 0, outputCountPointer, outputTonalityPointer
    );
    if (queryStatus !== SME_BUFFER_TOO_SMALL && queryStatus !== SME_OK) {
      throw new Error("WebAssembly score query failed with status " + queryStatus + ".");
    }

    const eventCount = wasm.HEAPU32[
      outputCountPointer / Uint32Array.BYTES_PER_ELEMENT
    ];
    if (eventCount > MAX_SCORE_EVENTS) {
      throw new RangeError("WASM score exceeds the one-hundred-thousand-event safety limit.");
    }

    const outputPointer = allocate(
      eventCount * SME_EVENT_STRIDE * Float64Array.BYTES_PER_ELEMENT
    );
    const fillStatus = wasm._sme_generate_score_packed(
      sourcePointer, normalizedValues.length,
      optionsPointer, optionValues.length,
      outputPointer, eventCount,
      outputCountPointer, outputTonalityPointer
    );
    if (fillStatus !== SME_OK) {
      throw new Error("WebAssembly score generation failed with status " + fillStatus + ".");
    }

    const written = wasm.HEAPU32[
      outputCountPointer / Uint32Array.BYTES_PER_ELEMENT
    ];
    if (written !== eventCount) {
      throw new Error("WebAssembly returned an inconsistent event count.");
    }

    const eventStart = outputPointer / Float64Array.BYTES_PER_ELEMENT;
    const eventEnd = eventStart + written * SME_EVENT_STRIDE;
    const tonalStart = outputTonalityPointer / Float64Array.BYTES_PER_ELEMENT;
    const tonalEnd = tonalStart + SME_TONALITY_STRIDE;
    const packedEvents = Array.from(wasm.HEAPF64.subarray(eventStart, eventEnd));
    const packedTonality = Array.from(wasm.HEAPF64.subarray(tonalStart, tonalEnd));

    return mapPackedScore(
      packedEvents,
      packedTonality,
      Array.from(normalizedValues),
      options.bpm
    );
  } finally {
    for (let index = allocations.length - 1; index >= 0; index -= 1) {
      wasm._free(allocations[index]);
    }
  }
}
