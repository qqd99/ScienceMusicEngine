#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v emcmake >/dev/null 2>&1 || ! command -v emcc >/dev/null 2>&1; then
  echo "Emscripten is required. Activate an Emscripten SDK environment before running this script." >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/public/wasm"
emcmake cmake \
  -S "$ROOT_DIR/cpp" \
  -B "$ROOT_DIR/build/wasm" \
  -DCMAKE_BUILD_TYPE=Release \
  -DSME_WASM_OUTPUT_DIR="$ROOT_DIR/public/wasm"

cmake --build "$ROOT_DIR/build/wasm" \
  --target science_music_wasm \
  --parallel 2
