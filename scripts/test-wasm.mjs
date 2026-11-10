import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeDemo = join(root, "build", "cpp", "science_music_demo");
const wasmJavaScript = join(root, "public", "wasm", "science_music_wasm.js");
const wasmBinary = join(root, "public", "wasm", "science_music_wasm.wasm");
const csvPath = join(root, "build", "cpp", "wasm-parity.csv");

for (const path of [nativeDemo, wasmJavaScript, wasmBinary]) {
  assert.ok(existsSync(path), "Required build artifact is missing: " + path);
}

const seed = 42;
execFileSync(nativeDemo, [
  "--seed", String(seed),
  "--bpm", "128",
  "--collection", "black",
  "--root", "auto",
  "--mode", "auto",
  "--output", csvPath
], { cwd: root, stdio: "inherit" });

const roleIds = new Map([
  ["lead", 0],
  ["bass", 1],
  ["pad", 2],
  ["plucked", 3],
  ["analog", 4],
  ["percussion", 5]
]);
const csvLines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
assert.ok(csvLines.length > 1, "Native CLI did not produce score events.");
const nativeEvents = csvLines.slice(1).map(line => {
  const fields = line.split(",");
  assert.equal(fields.length, 8, "Native CSV row has an unexpected shape.");
  assert.ok(roleIds.has(fields[5]), "Unknown native event role: " + fields[5]);
  return [
    Number(fields[0]),
    Number(fields[1]),
    Number(fields[2]),
    Number(fields[3]),
    Number(fields[4]),
    roleIds.get(fields[5]),
    Number(fields[6]),
    Number(fields[7])
  ];
});

const loaded = await import(pathToFileURL(wasmJavaScript).href);
assert.equal(typeof loaded.default, "function", "Emscripten ES module has no default factory.");
const wasm = await loaded.default({
  locateFile: path => path.endsWith(".wasm") ? wasmBinary : path
});
const allocations = [];
const allocate = byteLength => {
  const pointer = wasm._malloc(Math.max(1, byteLength));
  assert.ok(pointer, "WebAssembly allocation failed.");
  allocations.push(pointer);
  return pointer;
};

try {
  const source = new Float64Array(128);
  const unit = (seed % 1000003) / 1000003;
  let x = 0.18 + unit * 0.62;
  for (let index = 0; index < source.length; index += 1) {
    x = 3.91 * x * (1 - x);
    source[index] = x;
  }

  const options = new Uint32Array([
    seed, 0, 128, 1, 12, 2, 1, 1, 1, 1, 1
  ]);
  const sourcePointer = allocate(source.byteLength);
  wasm.HEAPF64.set(source, sourcePointer / Float64Array.BYTES_PER_ELEMENT);
  const optionsPointer = allocate(options.byteLength);
  wasm.HEAPU32.set(options, optionsPointer / Uint32Array.BYTES_PER_ELEMENT);
  const countPointer = allocate(Uint32Array.BYTES_PER_ELEMENT);
  const tonalityPointer = allocate(7 * Float64Array.BYTES_PER_ELEMENT);

  const queryStatus = wasm._sme_generate_score_packed(
    sourcePointer, source.length,
    optionsPointer, options.length,
    0, 0, countPointer, tonalityPointer
  );
  assert.equal(queryStatus, 1, "WASM two-pass query should request an event buffer.");

  const eventCount = wasm.HEAPU32[countPointer / Uint32Array.BYTES_PER_ELEMENT];
  assert.equal(eventCount, nativeEvents.length, "Native and WASM event counts differ.");
  const eventsPointer = allocate(
    eventCount * 8 * Float64Array.BYTES_PER_ELEMENT
  );
  const fillStatus = wasm._sme_generate_score_packed(
    sourcePointer, source.length,
    optionsPointer, options.length,
    eventsPointer, eventCount,
    countPointer, tonalityPointer
  );
  assert.equal(fillStatus, 0, "WASM event-buffer fill failed.");
  assert.equal(
    wasm.HEAPU32[countPointer / Uint32Array.BYTES_PER_ELEMENT],
    eventCount,
    "WASM returned an inconsistent event count."
  );

  const start = eventsPointer / Float64Array.BYTES_PER_ELEMENT;
  const actualEvents = Array.from(
    wasm.HEAPF64.subarray(start, start + eventCount * 8)
  );
  const integerFields = new Set([2, 5, 6, 7]);
  const tolerance = 1e-9;

  for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
    for (let field = 0; field < 8; field += 1) {
      const actual = actualEvents[eventIndex * 8 + field];
      const expected = nativeEvents[eventIndex][field];
      const context = "event " + eventIndex + ", field " + field;
      assert.ok(Number.isFinite(actual), "Non-finite WASM value at " + context);
      if (integerFields.has(field)) {
        assert.equal(actual, expected, "Integer parity mismatch at " + context);
      } else {
        assert.ok(
          Math.abs(actual - expected) <= tolerance,
          "Floating-point parity mismatch at " + context +
            ": native=" + expected + ", wasm=" + actual
        );
      }
    }
  }

  console.log(
    "Native/WebAssembly event parity passed for " + eventCount +
    " events (seed 42, 128 BPM, black-key, automatic tonality)."
  );
} finally {
  for (let index = allocations.length - 1; index >= 0; index -= 1) {
    wasm._free(allocations[index]);
  }
}
