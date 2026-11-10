# Agent Guide — Science Music Engine

> Read this file before making changes. It is the persistent project brief and handoff for future coding agents. Treat the repository's current code and tests as the source of truth; this document records intent, constraints, and the last known handoff, and must be kept current as the project evolves.

## 1. Project identity and scope

- **Repository:** [qqd99/ScienceMusicEngine](https://github.com/qqd99/ScienceMusicEngine)
- **Default branch:** `main`
- **Live app:** https://qqd99.github.io/ScienceMusicEngine/
- **Browser stack:** TypeScript, Vite, Vitest, browser-native Web Audio API.
- **Native intelligence stack:** standalone C++17 library under `cpp/`, CMake/CTest, no third-party runtime dependencies, and a stable two-pass C ABI with an opt-in packed-array WebAssembly bridge.
- **Current product:** Mathematics Music Engine / Science Music Engine — a browser laboratory that turns mathematical structures into deterministic musical events and synthesizes them into original music.

This is the active project. The earlier `qqd99/GenerativeMusic` repository was a separate Christmas-music experiment. The user explicitly chose to drop the random Christmas generator and start a new Mathematics Music Engine in this repository. **Do not resume Christmas carols, Christmas rotation, or Christmas-specific requirements here. Do not modify `GenerativeMusic` or `GiangSinhOnline` unless the user explicitly asks.**

The long-term idea may expand from mathematics into physics, chemistry, astronomy, and other scientific systems. The current application is the Mathematics Lab. Do not start a major expansion without discussing scope with the user first.

## 2. Product principles and user preferences

These are important requirements, not optional suggestions:

1. **Procedural music, not AI music.** Mathematical/scientific systems and explicit algorithms must determine the musical content. Do not use AI music generation, generative-music APIs, or third-party music-generation services.
2. **No downloaded audio samples.** Generate instruments and percussion procedurally with Web Audio oscillators, filters, envelopes, noise, and other browser-native synthesis. Do not add downloaded audio assets. Do not silently introduce sample packs or external audio services.
3. **Deterministic composition.** A fixed mathematical mode, seed, configuration, and event sequence must produce the same musical events. Never use unseeded randomness to choose fallback notes, melodies, or instrument events. The explicit “New Seed” action may choose a new seed; after that, generation must be reproducible from that seed.
4. **Mathematics is the source of musical content.** Do not turn the project into an ordinary prewritten song player with a mathematical visualizer attached. Mathematical behavior must meaningfully influence musical pitches, timing, rhythm, contour, density, or other musical parameters.
5. **Separate concerns.** Keep mathematical event generation, composition/arrangement, instrument synthesis, and playback/rendering distinct. Avoid coupling an instrument's existence to an unrelated composition toggle. The native C++ intelligence library produces symbolic score events only; it must not absorb browser audio rendering or instrument synthesis.
6. **Independent controls.** Every new user-facing sound feature must have its own clearly labeled ON/OFF control. Instrument layers must remain independently switchable and mixable. Do not make the effect so subtle that the user cannot hear the difference; demonstrate it in a meaningful A/B comparison.
7. **Live and offline parity.** The same event resolution, instrument settings, sound profile, conductor behavior, and volume settings must apply to live playback and WAV export.
8. **Ask when uncertain.** The user explicitly requested: “During development, if you have any question, stop and ask me.” Do not guess about ambiguous musical direction or make a large product decision without asking.
9. **Listen, don't just count tests.** Passing tests and a successful build do not prove that the result sounds good. Ask the user to audition important sound changes and use their feedback before layering on more features.

## 3. Current application

The Mathematics Lab currently contains four experiments:

- **Mandelbrot:** fractal escape-time values influence the generated musical sequence.
- **Euclidean rhythms:** distribute pulses mathematically across a cycle.
- **Chaos map:** logistic-map dynamics generate deterministic evolving values and musical events.
- **Shepard illusion:** overlapping octave layers create the auditory illusion of continuous ascent. Preserve this experiment's special behavior; do not force it into the ordinary 16-bar song form.

The browser UI includes mathematical visualization, a moving playhead, tempo, complexity, hybrid tonal-center controls (automatic inference or manual chromatic root), white-key/diatonic and black-key/pentatonic collections, automatic or manually overridden major/minor character, a unified Play/Stop control, live parameter updates, output volume, sound-character selection, independent feature/instrument controls, instrument mixer, and offline WAV export.

### Musical form and sound system already implemented

- The ordinary musical experiments use a **16-bar composition** with four connected four-bar movements: opening, development, climax, and reprise/cadence. At the default 128 BPM, the piece lasts about 30 seconds. The mathematical sequence shapes the opening motif, eight two-bar chord choices, development variations and climax contour; the reprise recalls the motif and resolves to the tonic.
- The composition can include sequence-derived harmonic progressions selected to support the actual piano phrase, close-voiced chord inversions/voice leading, tension-aware chord colors and tonic cadence, scale-aware bass/pad/answer/texture parts sharing one harmonic map, source-shaped drums, and procedurally synthesized kick/snare/hi-hat percussion.
- The five dedicated instrument layers are:
  - **Piano:** carries the lead melody using the selected white-key/diatonic or black-key/pentatonic note collection and the shared tonal/harmonic context.
  - **Plucked Strings:** deterministic call-and-response answers between selected lead phrases.
  - **Warm Analog:** a restrained counterline / sustained color.
  - **Cinematic Bass:** supports harmonic roots and movement.
  - **Atmospheric Pads:** sustain chord voicings and harmonic atmosphere.
- Sound character profiles: **Hybrid Cinematic** (default), **Natural / Organic**, and **Electronic / Synth**. A profile changes timbre, not the underlying mathematical event sequence.
- Each instrument has its own ON/OFF control and independent 0–150% mixer level.
- The output-volume slider controls live playback and WAV export (0–150%; current default is 115%). The shared master chain applies a fixed +14 dB post-compressor gain (about 5.01× amplitude), followed by a fast peak limiter. Live playback and WAV export must use the same chain.
- WAV export uses `OfflineAudioContext` and produces stereo 16-bit, 44.1 kHz output.
- The **Ensemble Conductor** has its own ON/OFF control and is an adaptive, score-aware conductor, not a fixed instrument scheduler or volume curve. Enabled instruments are available to it, not automatically active.
- The conductor analyzes each upcoming two-bar phrase (lead density, durations, rhythmic placement, velocity, rests and changes from the previous phrase), then selects at most two supporting roles. It carries previous decisions forward and can change roles at phrase boundaries as the musical context changes.
- Plucked answers and analog counterlines must fit genuine lead gaps and compete for the same melodic space. Bass marks selected harmonic anchors; pads frame harmony when space allows; percussion responds to phrase energy and yields downbeats already owned by bass.
- Live playback prepares the next phrase just ahead of its entrance. Offline WAV rendering walks the same deterministic phrase session from beginning to end. Preserve exact live/offline event parity and the Shepard experiment's continuous layered illusion.

### Scientific signal and synchronized timeline layer

- The shared C++17 `ScientificSignalAnalyzer` accepts 1–32 synchronized channels with equal sample counts and an optional physical sample rate. It returns per-channel mean/range/RMS/trend/activity/zero-crossing metrics, dominant period and periodicity confidence, plus physical frequency only when the sample clock is supplied.
- It divides each channel into normalized timeline frames and estimates pairwise correlation/phase relationships when channels share a stable period. The packed C ABI is additive and does not change the existing score ABI.
- The current Mathematics Lab sends its normalized mathematical sequence as one channel with an unknown physical sample rate. The UI shows mean, RMS, activity and period in sample steps, and draws a feature envelope over the same normalized timeline as the audio playhead. It must not label mathematical iteration rate as physical Hz.
- The C++ musical-intelligence phrase profiles reuse the same analyzer for RMS and activity. The TypeScript score remains the production audio generator; the signal-analysis overlay uses the C++/WASM analyzer. Future science domains can supply multiple channels and physical units without changing the timeline contract.
- Multi-channel three-phase test data validates 60 Hz recovery at 48 kHz and phase relationships of approximately ±120 degrees. These are algorithm tests, not a new power-grid experiment or a claim about the uploaded video's full soundtrack.

### Critical instrument-routing behavior

- If **one or more dedicated instruments are enabled**, the legacy/default oscillator must be bypassed. Do not let it play underneath dedicated instruments.
- If all dedicated instruments are OFF, the legacy/default synthesizer is the fallback.
- Percussion is a separate composition layer.
- Instruments must continue to work when other composition features are disabled. Use the actual melody/bass/chord events when available; otherwise derive deterministic fallback events from the mathematical sequence. Never fill gaps with random pitches.
- Current event routing in `src/audio.ts`: piano → lead, plucked strings → answer, warm analog → texture, cinematic bass → bass, atmospheric pads → pad.
- Keep live playback and offline rendering on the same resolved event path.

## 4. Code map

- `src/math.ts` — current browser-side pure mathematical generators and deterministic composition generation. Main entry point: `generateComposition()`.
- `cpp/include/science_music/scientific_signal.hpp` and `cpp/src/scientific_signal.cpp` — domain-neutral multi-channel scientific signal analysis, including periodicity, physical frequency when sample rate is known, time-window features and phase relationships.
- `cpp/include/science_music/scientific_signal_c.h` and `cpp/src/scientific_signal_c.cpp` — packed C ABI for signal summaries, normalized timeline frames and channel-pair relationships.
- `src/science/signal.ts` — typed browser representation and pure packed-ABI mapping for scientific signal analysis.
- `cpp/include/science_music/intelligence.hpp` and `cpp/src/intelligence.cpp` — standalone C++17 musical-intelligence API and implementation: tonal inference, motif development, harmony, phrase analysis, and conductor decisions.
- `cpp/include/science_music/intelligence_c.h` and `cpp/src/c_api.cpp` — two-pass struct C ABI plus a packed-array C ABI for WebAssembly; both preserve caller-owned output buffers and deterministic error codes.
- `src/wasm/bridge.ts` — Emscripten loader, safe linear-memory ownership, MIDI/beat-to-browser-event conversion, and C++ scientific-signal analysis.
- `scripts/build-wasm.sh` and `scripts/test-wasm.mjs` — Emscripten build and native-versus-WASM event parity check.
- `cpp/examples/generate_demo.cpp` — deterministic logistic-source CLI example that writes a symbolic score CSV.
- `cpp/tests/intelligence_test.cpp` and `cpp/CMakeLists.txt` — native tests and CMake build.

The C++ core is available through an opt-in A/B audition selector in the browser app. The TypeScript/Web Audio generator remains the production default; do not switch the default to C++ until the user has auditioned the candidate and explicitly approves the rollout.
- `src/audio.ts` — Web Audio synthesis, instrument settings and event resolution, ensemble conductor, live player, and OfflineAudioContext WAV renderer. Key functions include `resolveInstrumentEvents()`, `preparePlaybackEvents()`, `applyEnsembleConductor()`, `getConductorSection()`, `MusicPlayer`, and `renderCompositionWav()`.
- `src/main.ts` — browser UI, controls, live updates, visualization/playhead, and WAV export.
- `src/style.css` — UI styling.
- `tests/math.test.ts` — mathematical generation, deterministic behavior, composition, and musical-form tests.
- `tests/audio.test.ts` — instrument routing, fallbacks, conductor, and audio-event tests.
- `tests/wasm.test.ts` — packed-score mapping, role conversion, tempo conversion, and malformed-ABI checks.
- `index.html` — app entry document.
- `package.json` — development scripts and dependencies.
- `.github/workflows/deploy.yml` — GitHub Actions test/build/Pages deployment workflow.

Keep mathematical generation as pure/testable code wherever possible. Keep browser audio APIs out of pure mathematical functions.

## 5. Development workflow

Before editing:

1. Read this file and `README.md`.
2. Inspect the latest `main` commit and working tree/repository state. This handoff can become stale.
3. Inspect the relevant source and tests; do not rely only on this document or the historical chat.
4. State the intended change briefly. If requirements or musical behavior are ambiguous, stop and ask the user.

After editing:

1. Add or update focused tests for deterministic behavior, toggles, routing, timing, and live/offline parity as relevant.
2. Run:
   ```bash
   npm install
   npm test
   npm run build
   cmake -S cpp -B build/cpp -DCMAKE_BUILD_TYPE=Release
   cmake --build build/cpp --parallel
   ctest --test-dir build/cpp --output-on-failure
   ./build/cpp/science_music_demo --seed 42 --collection black --mode auto --output build/cpp/demo-score.csv
   ```
   Node.js 20+ and a C++17 compiler/CMake are required locally; GitHub Actions uses Node.js 22 and Ubuntu's native C++ toolchain.
3. Listen to the live app and export a WAV when the change affects sound. Do not claim perceptual quality, loudness calibration, or musical success based on unit tests alone.
4. Update `README.md` and this handoff when behavior, controls, architecture, commands, or status changes.
5. Verify the GitHub Actions run for the exact commit before saying CI or deployment passed. The workflow deploys GitHub Pages on pushes to `main`; do not claim a deployment succeeded while it is queued or failing.
6. Keep changes focused. Do not rewrite unrelated systems or silently remove existing experiments/features.

## 6. Current handoff / resume point

### Current C++ scientific signal and musical-intelligence modules

The user requested the next Generative Music Engine milestone to prioritize **musical intelligence** and use **C++**. A standalone, portable C++17 module has been added under `cpp/`.

- `IntelligenceEngine::generate()` accepts normalized mathematical source values and deterministic generation options, and returns a symbolic `CompositionPlan`. It does not synthesize audio.
- Tonal inference supports white-key diatonic major/minor and black-key major/minor pentatonic collections, automatic root/mode selection, independent manual root/mode overrides, and confidence/provenance metadata.
- Source analysis measures section mean, trend, movement, centroid and energy.
- A four-note source-derived motif is developed through inversion, retrograde and sequence. A seed-controlled scale-degree ornament adds repeatable variation even when the mathematical source contour is unchanged.
- Eight two-bar chord frames are selected from source-shaped harmonic palettes and aligned against the actual lead phrase. The progression begins and ends on tonic.
- The score has four connected movements over 16 bars: opening, development, climax and reprise/cadence.
- The conductor analyzes each two-bar phrase and selects at most two supporting roles. Bass and pads compete with available answer space; plucked and analog lines are mutually exclusive alternatives. Decisions carry a small continuity preference from the previous phrase.
- Pitched support notes share the resolved scale and chord frames. Percussion is a separate source-shaped rhythm role.
- `intelligence_c.h` exposes the original two-pass struct C ABI and an additive packed-array C ABI for WebAssembly (11 uint32 option words, eight doubles per event, seven doubles of tonal metadata). Both use caller-owned buffers and return deterministic status codes.
- `src/wasm/bridge.ts` is an opt-in Emscripten loader and browser-event adapter. It maps beat/MIDI data into the existing NoteEvent representation and owns/frees all linear-memory allocations.
- `src/main.ts` exposes an opt-in TypeScript-versus-WASM A/B audition selector. It passes the same generated mathematical sample values and UI controls to both engines, routes both through the same `MusicPlayer`/`renderCompositionWav` synthesis path, and keeps TypeScript selected by default. The C++ engine's own arrangement/conductor remain fixed during audition; Shepard mode is TypeScript-only.
- The C++ module is a symbolic composition core only and does not render audio. The live UI can audition it through the shared Web Audio synthesizer, but TypeScript remains the production default. Do not describe the live website as defaulting to C++ until the user approves a listening-based rollout.
- Native build: `cmake -S cpp -B build/cpp`; native tests: `ctest --test-dir build/cpp --output-on-failure`; demo: `./build/cpp/science_music_demo --seed 42 --collection black --mode auto --output score.csv`.
- GitHub Actions must run the TypeScript tests, native CMake build/CTest/demo smoke test, Emscripten build and native-versus-WASM event parity script before deployment.

### Last verified C++ musical-intelligence core

- Public API and CMake skeleton: `f3b6babb8d1ab403e312819eaede9cdba34d15aa`.
- Core implementation: `b727867b12ac0ba49ec2afe529eb8089f3c22291`.
- CLI example and native test suite: `ff9fbca63ab15b84ee07f4b5363f8411e1bd12a5`.
- CI/docs integration: `7915ea6d0d2044cc655175b2017e28ade3d01740`.
- CMake include-path correction: `1e3e7b098240e4aea50599f3d0e26b4b522818f8`.
- GitHub Actions run **#134** completed successfully: all **55 existing TypeScript tests** passed, the Vite production build passed, the C++17 library and CLI compiled, all **8 native test groups** passed under CTest, the CLI smoke test generated **164 symbolic events** across 16 bars, and GitHub Pages deployment succeeded.
- The smoke-test score demonstrated conductor variation: the climax reduced to bass-only in one phrase while opening/development/reprise phrases selected different supporting combinations. Plucked and analog answers are mutually exclusive within a phrase.
- Follow-up deterministic-variation correction: the seed now selects a subtle scale-degree ornament during motif development; a focused test confirms that changing only the seed changes the score while repeating the same seed remains identical.
- Example source: logistic map, seed 42, black-key family, automatic mode. Example chord path: `0-1-4-1-3-1-4-0`.
- The native core is symbolic only and does not render audio. The deployed browser application still uses its existing TypeScript/Web Audio implementation; the C++ module is not yet connected to the live UI.

**Current next action:** ask the user to inspect the new signal-analysis panel and listen to the existing mathematical experiments. Confirm that the activity envelope and playhead feel synchronized and that the displayed period metrics are meaningful. Keep the TypeScript music engine as the production default. Do not add a physical-science experiment or infer scientific model parameters until the user supplies/approves the source equations, units and assumptions.


### Scientific signal analysis implementation

- Development branch: `feat/scientific-signal-timeline`.
- New C++ API: `ScientificSignalAnalyzer` accepts synchronized multi-channel samples and returns signal summaries, windowed feature frames, and pairwise phase/correlation estimates.
- The C++ musical-intelligence `SourceProfile` now reuses the analyzer's RMS, activity, zero-crossing, period and periodicity features.
- The browser maps the packed C ABI into typed signal analysis and draws a window-activity envelope aligned to the audio playhead. The current math experiments are a single normalized channel with unknown physical sample rate, so no Hz is fabricated.
- C++ tests use a deterministic 60 Hz, 48 kHz three-phase signal to check period and ±120-degree phase recovery, C ABI buffer ownership, no-clock behavior, invalid input handling, and reuse of features by the conductor.

### Experimental WebAssembly bridge (opt-in score audition; TypeScript remains the production default)

- Implementation branch `feat/wasm-bridge` was merged through pull request https://github.com/qqd99/ScienceMusicEngine/pull/1. The merged main commit is `622767213e5f3dba8b153002b1a4278f8d1d62e5`.
- Main baseline before the scientific-signal branch: commit `bfea7b1067278d713993fb05fda403540ff89de8`; GitHub Actions run #143 completed successfully. The scientific-signal branch adds a second native CTest target and a three-phase C++/WASM parity smoke test; verify its exact pull-request run before merging.
- The packed entry point is declared in intelligence_c.h as sme_generate_score_packed. Its options are a fixed 11-word uint32 array; event records are eight doubles and tonal metadata is seven doubles. This avoids JavaScript depending on wasm32 C struct padding.
- The C++ C ABI remains caller-buffer-owned. JavaScript allocates source, options, count, tonal metadata and event buffers with _malloc, checks status codes, copies all returned values into JS-owned arrays, then releases every pointer in a finally block. The module retains no JS buffers.
- Emscripten builds a modularized ES module and companion .wasm file into public/wasm. Generated artifacts are ignored and are created by scripts/build-wasm.sh.
- scripts/test-wasm.mjs compares all eight event fields against the native CLI output for the same deterministic 128-value logistic source and options. Floating-point fields use a tight cross-compiler tolerance; integer fields must match exactly.
- src/wasm/bridge.ts converts C++ beat positions/durations to seconds, MIDI pitch to frequency, and C++ roles to the existing browser voices. It is an adapter only; it does not replace generateComposition(), the live player, or WAV rendering.
- Event parity does not establish audible quality. The next product decision requires listening to the C++ score through the existing synthesizer and preserving the current TypeScript fallback until the user approves a rollout.

The user approved a hybrid tonal-center system and shared musical intelligence for white-key and black-key improvisation.

The user approved a hybrid tonal-center system and shared musical intelligence for white-key and black-key improvisation.

Current implementation design:
- **White-key family:** seven-note diatonic collection, with C major/A natural minor as the familiar white-key examples. Major/minor character is inferred from the mathematical source unless the user overrides it.
- **Black-key family:** five-note pentatonic collection, with F-sharp major/D-sharp minor as the familiar black-key examples. Both major and minor pentatonic interval sets are implemented separately; the five-note collection avoids semitone and tritone intervals.
- **Hybrid tonal center:** the source contour deterministically suggests a chromatic root and major/minor character. The user can independently lock the root (12 chromatic notes) and/or major/minor character.
- The resolved tonal context (root, collection, mode and confidence) is stored on the composition alongside the shared harmonic frames.
- Piano notes are constrained to the selected collection. Chord selection is melody-aware and includes a penalty for strong-note tritone clashes. Bass, pads, plucked answers and analog counterlines use the shared chord frames; percussion remains a rhythmic role.
- Preserve legacy API behavior for callers that still supply root and scale without the new noteCollection options.
- The Shepard experiment remains a continuous chromatic octave illusion, not an ordinary scale-constrained melody.

Preserve:
- Determinism for fixed mode, seed and controls; mathematics remains the source of musical ideas.
- The 16-bar/30-second four-movement form, conductor's maximum two supporting roles per phrase, independent instrument toggles/mixer, live/offline event parity, and +14 dB master chain.
- No AI music generation or downloaded audio samples.
- Tests validate event-level relationships, not perceived musical quality; the user must audition white-key and black-key modes and all instrument layers.

**Next action:** ask the user to audition the white-key family in automatic mode, black-key family in automatic mode, and manual root/mode overrides. Listen specifically for the white-key B–F tension being intentional rather than accidental, and for every pitched accompaniment role to remain harmonically connected. Do not claim perceptual success from tests alone.

### Last verified hybrid tonal-center and shared-improvisation implementation

- Tonal inference and pentatonic scale support: `981f7ed70a35c4f074b317af9a14433ec218f46e` — “Add source-aware hybrid tonal inference”.
- UI controls and automatic/manual readout: `cc0fa8549dcc368641ac71529e2faee6657930d0` — “Expose hybrid tonal controls in the lab”.
- Focused tests, README and handoff update: `6b11f153ab4e7fe85c6c677f7b57a453182d347c` — “Test and document shared tonal improvisation”.
- Scale-aware bass movement correction: `3b6c6136c889b7c2982f2454e391dd6f47904c85` — bass's second movement note now comes from the active chord frame rather than an out-of-collection fixed interval.
- GitHub Actions run **#128** completed successfully: all **55 tests** passed (31 mathematics, 24 audio), the TypeScript/Vite production build passed, and GitHub Pages deployment succeeded.
- The UI defaults to automatic tonal center and major/minor inference. Users can independently override the chromatic root and/or tonal character. White-key mode uses diatonic major/natural minor; black-key mode uses separate major/minor pentatonic scales.
- The composition carries one resolved tonal context and shared chord frames. Piano, bass, pads, plucked answers and analog counterlines are checked against the same selected note collection. Bass approach notes remain intentionally chromatic transition notes; percussion is not a pitched role.
- Event-level tests do not establish that the music sounds good. The user must audition the new automatic and manual modes.

### Last verified harmonic-cohesion correction

- Main implementation commit: `bacf4801c3b0961ae79e782faa0330c491132580` — “Align every ensemble layer to the piano harmony”.
- Follow-up melody-anchor and Shepard-preservation commits: `6eccc590158682a3796baee7e44c0035301f3363` and `c3c5d7a0ce885a3f48e5e40ea3efe1075c2a6040`.
- GitHub Actions run **#122** completed successfully: all **51 tests** passed (28 mathematics, 23 audio), the TypeScript/Vite production build passed, and GitHub Pages deployment succeeded.
- The verified implementation scores source-approved chords against the piano phrase, publishes a shared harmonic map, uses scale-aware fallback pads/bass, and selects supporting answers from the chord active at their entrance.
- The Shepard experiment still resolves to its original continuous layers without ordinary ensemble accompaniment.
- Tests validate event-level harmonic relationships, not perceived musical quality. The user still needs to audition the live mix.

### Last verified Phase 3 composer-level intelligence

- Phase 3 implementation commit: `39c733c31323cbf638eba80ec2cf595367797cda` — “Develop mathematical motifs into expressive musical phrases”.
- Source-scope correction: `e49cc0a02cf04d6594c102680131631dfccff69b` — shares the normalized mathematical sequence with the rhythm arranger.
- GitHub Actions run **#118** completed successfully: all **49 tests** passed (27 mathematics, 22 audio), the TypeScript/Vite production build passed, and GitHub Pages deployment succeeded.
- The verified implementation includes mathematical motif extraction and transformations, tension-aware chord colors and tonic resolution, source-shaped drum accents/fills, and chord-tone ensemble responses.
- This verification applies to the Phase 3 implementation commit above; check the current branch head and its own Actions run after later changes.

### Current output-level revision

The user reported that the complete mix was barely audible even at maximum output volume and requested at least +14 dB. The master output now applies a fixed +14 dB gain after the existing compressor, followed by a fast final peak limiter. Keep this shared master chain identical for live playback and offline WAV export. The UI should make the boost visible. Do not claim a calibrated acoustic SPL or LUFS target; actual playback level still depends on device output and content.

### Last verified Phase 2 sequence-aware harmony

- Core implementation commit: `43076a6e77ca6d23fa053f2bfe87141391ae5b66` — “Make harmonic journeys respond to mathematical sequences”.
- Follow-up test correction: `75ed624796b6095ba85617e72b8419e769f869ab` — selects the final transition pickup when a climax note shares its timestamp.
- GitHub Actions run **#115** completed successfully: all **45 tests** passed (24 mathematics, 21 audio), the TypeScript/Vite production build passed, and GitHub Pages deployment succeeded.
- The conductor, 16-bar/30-second form, independent instrument controls, live/offline event path, and +14 dB master chain were preserved.
- These verification details apply to the Phase 2 code commit above. Check the current branch head and its own Actions run after any subsequent changes.

## 7. Documentation note

The current `README.md` describes the product and features, but its long feature-description section contains duplicated wording and at least one older instrument-routing description that conflicts with the current event routing above. When next editing the README, reconcile and deduplicate it against `src/audio.ts` and the tests. Do not copy stale README text into new code.

---

**Guiding principle:** make the mathematics generate the musical ideas, make the instruments express those ideas, and make the ensemble tell a coherent musical story. Every change should be deterministic, independently controllable, audibly meaningful, testable, and approved by listening—not merely plausible in code.
