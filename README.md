# Science Music Engine

A browser-based mathematics-to-sound laboratory. It turns deterministic mathematical structures into original music using the native Web Audio API.

**No AI-generated music. No downloaded audio or art assets. No third-party audio services.** User-selected reference files are analyzed locally in the browser and are never uploaded.

## Live app

After GitHub Pages is enabled with **Settings → Pages → Source: GitHub Actions**, every push to `main` deploys the app.

## Mathematics Lab (v1)

- **Mandelbrot explorer:** escape-time values map to scale-constrained pitch, note density and melodic contour.
- **Euclidean rhythms:** distribute k pulses across n steps.
- **Chaos map:** logistic-map dynamics generate deterministic melodic events.
- **Shepard illusion:** overlapping octave layers create a continuous-rising auditory illusion. This experiment keeps its special layered texture and is not forced into the ordinary song form.

## Composition and orchestration

Ordinary musical experiments use a deterministic **16-bar form** with four connected movements: opening, development, climax, and reprise/cadence. The shared Musical Intelligence layer supports a seven-note diatonic family (the white-key analogy) and five-note major/minor pentatonic families (the black-key analogy). Tonal center and major/minor character are inferred deterministically from the mathematical source by default; users can independently lock the root and/or mode. The piano, bass, pads, plucked answers and analog counterline share the resolved tonal context and chord frames, while each keeps its own musical role. At the default 128 BPM, the piece lasts approximately **30 seconds**. The opening four-note identity is extracted from the mathematical contour, then developed through diatonic inversion, retrograde and sequence before returning in the reprise. A whole-sequence phase signature makes cyclic sources such as Euclidean rhythms produce different harmonic journeys from different seeds. Harmonic color follows a tension arc: an open add-9 opening, richer extensions as the source becomes more active, dominant preparation, and a stable tonic resolution. Each two-bar chord is selected from the mathematical source's harmonic palette and then checked against the piano phrase it must support. Bass roots and fifths, scale-aware pad voicings, plucked answers and analog counterlines all draw from the same active chord frame; transitions use the incoming chord rather than stale overlapping pad notes. Drum accents respond to source activity. Melodic pickups and pad releases connect the movements.

**Musical Arrangement** derives its eight-chord progression from the mathematical sequence, then selects the best-fitting source-approved chord for the actual piano phrase. The same shared chord frames drive voice-led voicings, bass movement, supporting answers and source-shaped percussion. **Musical Expression** develops a four-note mathematical motif through inversion, retrograde and sequence, then shapes tension, dynamics, rests and cadence around it. These features have independent ON/OFF controls.

The five independently switchable and mixable instrument layers are:

- **Piano:** carries the mathematical lead melody, using scale-constrained improvisation, motif development and stronger-beat harmonic awareness.
- **Cinematic Bass:** marks selected harmonic roots and transitions.
- **Atmospheric Pads:** sustain selected chord voicings to frame the opening and resolution.
- **Plucked Strings:** answer the lead only in genuine rhythmic gaps.
- **Warm Analog:** adds an occasional counterline when the melody leaves enough space.

### Ensemble Conductor

The independently switchable **Ensemble Conductor** is a selective orchestrator, not a command for every enabled instrument to play. Enabled instruments are available to the conductor; they are not automatically active throughout the piece.

The conductor is an **adaptive, score-aware system**, not a fixed instrument scheduler. It analyzes the next two-bar phrase before that phrase begins, comparing lead-note density, note duration, rhythmic placement, velocity, rests and recent phrase-to-phrase changes. It then selects at most two supporting roles for that phrase and carries its previous decisions forward as context.

- Bass marks selected harmonic anchors; dense phrases receive fewer bass events.
- Pads frame harmony when the lead leaves enough space.
- Plucked Strings answer only when a real melodic gap can contain the response.
- Warm Analog competes with the strings for the same melodic space and is chosen only for sufficiently open phrases.
- Percussion responds to phrase energy and rhythmic activity, yielding downbeats already owned by bass.
- The conductor can change its supporting roles at each phrase boundary as density, energy and available space change, while a small continuity preference avoids arbitrary instrument handoffs.

Live playback prepares each upcoming phrase just ahead of its entrance. Offline WAV rendering walks the same deterministic conductor session from beginning to end, preserving exact event parity. Identical composition, seed and instrument settings produce identical decisions. Disabling the conductor bypasses its orchestration.

## Scientific Signal Layer (v1.1)

A reusable C++17 signal-analysis module now sits between scientific source data and musical/visual interpretation. It accepts one or more synchronized channels, an optional physical sample rate, and a requested number of timeline windows. The analysis reports mean, range, RMS, trend, activity, zero-crossing rate, dominant period, periodicity confidence, and physical frequency when a sample clock is known. Multi-channel analysis also estimates pairwise correlation and phase offset when both channels have a sufficiently clear shared period.

The packed C ABI and WebAssembly adapter return channel summaries, time-normalized feature frames, and pairwise relationships. The browser displays the current mathematical source's mean, RMS, activity and period, plus a window-activity envelope aligned to the same normalized playhead used by playback. The C++ musical-intelligence phrase profiles reuse this analyzer's RMS and activity measurements, so conductor analysis and the visual signal track share one feature definition.

The current Mathematics Lab supplies one normalized mathematical channel with no physical sample clock. It therefore reports periods in sample steps and deliberately does **not** invent a frequency in Hz. The multi-channel API is ready for future physical models (for example, three-phase electrical signals), but no power-grid or other new science experiment has been added yet.

## Reference Media Analysis (v1.2)

The Mathematics Lab includes a local reference-media panel for supported audio and video formats. Audio files are decoded with the browser's Web Audio API. Video files are played through a local Web Audio capture path to extract their audio track, then sampled at up to 96 timestamps to estimate brightness and frame-to-frame visual motion. Video audio capture runs in real time; audio-file decoding and analysis are offline after the file is selected.

The analysis timeline aligns 128 windows of audio RMS/activity, spectral centroid, low/mid/high-band energy and onset strength with sampled video motion. Each timeline window averages every overlapping FFT frame rather than sampling a single point. A windowed FFT estimates spectral centroid and broad frequency-band balance; onset-envelope autocorrelation provides a tempo estimate with a confidence score. The C++/WebAssembly scientific analyzer supplies the shared signal summary and normalized timeline features. If the WASM module is unavailable, browser-side spectral analysis still completes and reports that limitation.

- Audio references: maximum 10 minutes and 150 MB.
- Video references: maximum 3 minutes and 150 MB, because browser audio capture must run in real time.
- Audio is downmixed to mono and resampled to a 12 kHz browser FFT clock (up to 7.2 million samples for the 10-minute limit). A separate box-filtered copy is decimated to at most 900,000 samples for the bounded C++/WASM ABI, with its sample rate adjusted to preserve physical-frequency interpretation. The original file remains local and is available in the preview player.
- Video frame motion is an image-difference measurement from small local frame samples, not object recognition or semantic scene understanding.
- Tempo is an estimate, not guaranteed ground truth. Silent, ambiguous or rhythmically irregular recordings may have no confident BPM.
- **Reference-guided composition** is optional. When enabled, the estimated tempo is used only when confidence is sufficient, and a 24% blend of normalized reference energy/onset contour influences the mathematical source sequence. Mathematics remains the primary source; the raw recording is not turned into copied notes or used as an instrument sample.
- The dedicated Shepard illusion is not reference-guided, preserving its continuous octave-layer behavior.


## Power-grid reference experiment (sound-first prototype)

Select **Power grid · 60 Hz** in the Mathematics Lab for a dedicated **67-second** mathematical reconstruction of the user-provided power-grid video. This is a separate experiment: the generic 16-bar composition, C++ score audition, pentatonic/diatonic keys, reference-contour blend, adaptive conductor, piano, and other conventional instrument parts do **not** reshape its sound. Output volume and WAV export still use the shared live/offline Web Audio path.

The original video displays ten stages and equations, reproduced as pure functions in `src/grid.ts`: `u(t)=sin(2π·60t)`; three equally spaced 120° phases; `P(t)=Σp_i`; clipped transformer flux `tanh(g sin ωt)/tanh g`; vibrating wire modes `y_n=A sin(nπx/L) cos(2πf_nt)`, `f_n=n√(T/μ)/(2L)`; arc square wave `sgn(sin ωt)`; frequency swing `Δf=−f₀ΔPt/(2H)`; load-shedding imbalance `f=f₀+(Pgen−Pload)/D`; cascade `N_(g+1)=kN_g`; and a frequency/voltage collapse toward silence.

The shared `src/grid-audio.ts` synthesizer follows the physical frequency curve and uses the reference's prominent spectral partials around **60, 120, 240, and 480 Hz** plus strictly procedural clipping, arcing, pulses, and fault noise. `tests/grid.test.ts` checks the formulas, deterministic event routing and live/export event-list parity. No reference video or audio is committed to the repository, and no imported recording is used as a synthesizer sample.

**Accuracy boundary:** The equations and 67-second narrative stages come from the actual video, but their tension, inertia, load levels, exact scene boundaries, timbre envelopes, mix, and sound effects are inferred/approximated rather than recovered from a project source file. This is an equation-faithful reconstruction, **not** a waveform-identical transcription. Listen and compare against the reference recording before claiming a perceptual match. If it still differs, prioritize sound comparison and calibration, not more general arrangement features.

## C++ Musical Intelligence Core (v1.0)

The repository now also contains a standalone **C++17 composition-intelligence library** in `cpp/`. It accepts normalized mathematical source values and produces a deterministic symbolic score; it does not synthesize waveforms or replace the existing browser engine yet.

The native core includes:

- Automatic or manually overridden tonal-center and major/minor inference for white-key diatonic and black-key pentatonic collections.
- Source-contour analysis (mean, trend, movement, centroid and energy).
- Four-note motif extraction with inversion, retrograde and sequence development.
- Eight source-shaped two-bar chord frames, aligned to the generated lead phrase.
- A connected 16-bar opening/development/climax/reprise form.
- A phrase-aware conductor that selects at most two supporting roles and makes plucked/analog answers compete for the same melodic space.
- Scale-aware bass, pad and melodic answer events, plus independently enabled source-shaped percussion.
- A stable two-pass struct C ABI plus a packed-array C ABI for WebAssembly, with explicit caller-owned buffers and deterministic error codes.

Build and test the native module (requires CMake and a C++17 compiler):

```bash
cmake -S cpp -B build/cpp -DCMAKE_BUILD_TYPE=Release
cmake --build build/cpp --parallel
ctest --test-dir build/cpp --output-on-failure
```

Generate a deterministic symbolic score CSV:

```bash
./build/cpp/science_music_demo --seed 42 --collection black --mode auto --output score.csv
```

The CSV contains beat positions, durations, MIDI pitches, velocities, panning, musical roles and phrase identifiers. It is an event score, not an audio file. The browser now includes an opt-in A/B audition selector for the experimental WebAssembly engine; the TypeScript/Web Audio generator remains the production default until the user approves a switch after listening.

### A/B audition mode

The app includes an opt-in engine selector for comparing the TypeScript baseline with the C++/WebAssembly candidate. Select **C++ / WebAssembly · audition candidate** and use the same Play / Export WAV controls. Both engines receive the same TypeScript-generated mathematical sample sequence, UI seed, tempo, root/mode, note collection, instrument switches, sound profile, mixer levels and master volume. The WASM engine converts its symbolic MIDI score into the existing browser audio events and uses the same Web Audio synthesizer and WAV renderer.

The C++ engine owns its own arrangement, phrase conductor and 16-bar structure, so the TypeScript-only arrangement, expression and conductor toggles are paused during a WASM audition. The Shepard illusion remains TypeScript-only. The selector defaults to TypeScript; the live product is not switched by this audition feature. Compare both versions by replaying them at the same settings and seed. Subjective sound quality still requires a human listening test.

### Experimental WebAssembly bridge

The C ABI also exposes a packed-array entry point so JavaScript can pass source values and generation options without relying on compiler-specific C struct offsets. The TypeScript adapter in src/wasm/bridge.ts loads the Emscripten module on demand and maps symbolic MIDI events into the browser engine's existing NoteEvent representation (beats to seconds, MIDI to frequency, and C++ roles to browser voices).

This bridge is deliberately opt-in. It adds a separate engine selector for audition and does not replace generateComposition() or change the production default. Native/WASM event parity passes in CI, and both engines use the existing synthesizer; the TypeScript/Web Audio engine remains the default until the C++ score has been auditioned and a live engine switch is explicitly approved.

Requirements: Node.js 20+, CMake, a C++17 compiler, and Emscripten 3.1.74. Build the native reference executable first, then compile and test the WASM target:

    cmake -S cpp -B build/cpp -DCMAKE_BUILD_TYPE=Release
    cmake --build build/cpp --parallel
    npm run build:wasm
    npm run test:wasm
    npm run build

The build creates public/wasm/science_music_wasm.js and public/wasm/science_music_wasm.wasm (both ignored build artifacts). The parity script compares every symbolic event from the native C++ CLI with the WebAssembly output for the same deterministic source, seed, tempo, collection, and options. This verifies event-level cross-target parity, not perceived sound quality or audio-rendering parity.

## Sound design

The **Sound Character** selector offers:

- **Hybrid Cinematic** (default): harmonic piano partials, warm filtered analog, plucked attacks, deep sub-bass and slowly evolving pads.
- **Natural / Organic:** rounder attacks and warmer filtering.
- **Electronic / Synth:** more detuning, filter movement and electronic harmonics.

Each instrument has its own ON/OFF control and 0–150% mixer level. The independent **Output Volume** slider controls both live playback and WAV export (0–150%; default 115%). The shared master chain adds a fixed **+14 dB post-compressor output boost** (about 5.01× amplitude), followed by a fast peak limiter to protect the output. The same chain is used for live playback and WAV export.

Use **Export WAV** to render the current composition offline as stereo 16-bit, 44.1 kHz audio. Export does not require starting live playback. All instruments and percussion are synthesized with Web Audio oscillators, filters, envelopes and deterministic noise; no samples are downloaded.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Run checks and build:

```bash
npm test
npm run build
```

## Design principles

- Mathematical generators and automatic tonal-center inference are pure functions and deterministic for a fixed input.
- The native C++17 intelligence core uses the same principles: fixed source + seed + options produce the same symbolic composition.
- Composition intelligence returns a shared score representation; sound synthesis and audio rendering remain separate modules.
- The shared musical context exposes the selected note collection, root, mode and chord frames to every pitched instrument.
- White-key/diatonic improvisation can use deliberate tension; black-key/pentatonic improvisation avoids semitone and tritone intervals by construction.
- Mathematical behavior meaningfully influences pitch, rhythm, contour and density.
- Audio is synthesized in-browser with oscillators and envelopes.
- Playback starts only after the user presses Play.
- Live playback and offline WAV export use the same prepared event list.
- No external audio assets or music-generation services are required.

## First-version limitations

- Mathematical mappings are musical interpretations, not unique scientific truths; they will be refined through listening tests.
- Shepard tones are finite layered approximations, not an actually infinite sound.
- The player loops a 16-bar generated phrase (about 30 seconds at the default tempo). Playback loudness still depends on the browser, operating-system and device volume.
- The app uses a hosted font stylesheet for typography; all visuals are drawn with CSS and Canvas.
