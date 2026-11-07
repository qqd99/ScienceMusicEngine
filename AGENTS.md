# Agent Guide — Science Music Engine

> Read this file before making changes. It is the persistent project brief and handoff for future coding agents. Treat the repository's current code and tests as the source of truth; this document records intent, constraints, and the last known handoff, and must be kept current as the project evolves.

## 1. Project identity and scope

- **Repository:** [qqd99/ScienceMusicEngine](https://github.com/qqd99/ScienceMusicEngine)
- **Default branch:** `main`
- **Live app:** https://qqd99.github.io/ScienceMusicEngine/
- **Local stack:** TypeScript, Vite, Vitest, browser-native Web Audio API.
- **Current product:** Mathematics Music Engine / Science Music Engine — a browser laboratory that turns mathematical structures into deterministic musical events and synthesizes them into original music.

This is the active project. The earlier `qqd99/GenerativeMusic` repository was a separate Christmas-music experiment. The user explicitly chose to drop the random Christmas generator and start a new Mathematics Music Engine in this repository. **Do not resume Christmas carols, Christmas rotation, or Christmas-specific requirements here. Do not modify `GenerativeMusic` or `GiangSinhOnline` unless the user explicitly asks.**

The long-term idea may expand from mathematics into physics, chemistry, astronomy, and other scientific systems. The current application is the Mathematics Lab. Do not start a major expansion without discussing scope with the user first.

## 2. Product principles and user preferences

These are important requirements, not optional suggestions:

1. **Procedural music, not AI music.** Mathematical/scientific systems and explicit algorithms must determine the musical content. Do not use AI music generation, generative-music APIs, or third-party music-generation services.
2. **No downloaded audio samples.** Generate instruments and percussion procedurally with Web Audio oscillators, filters, envelopes, noise, and other browser-native synthesis. Do not add downloaded audio assets. Do not silently introduce sample packs or external audio services.
3. **Deterministic composition.** A fixed mathematical mode, seed, configuration, and event sequence must produce the same musical events. Never use unseeded randomness to choose fallback notes, melodies, or instrument events. The explicit “New Seed” action may choose a new seed; after that, generation must be reproducible from that seed.
4. **Mathematics is the source of musical content.** Do not turn the project into an ordinary prewritten song player with a mathematical visualizer attached. Mathematical behavior must meaningfully influence musical pitches, timing, rhythm, contour, density, or other musical parameters.
5. **Separate concerns.** Keep mathematical event generation, composition/arrangement, instrument synthesis, and playback/rendering distinct. Avoid coupling an instrument's existence to an unrelated composition toggle.
6. **Independent controls.** Every new user-facing sound feature must have its own clearly labeled ON/OFF control. Instrument layers must remain independently switchable and mixable. Do not make the effect so subtle that the user cannot hear the difference; demonstrate it in a meaningful A/B comparison.
7. **Live and offline parity.** The same event resolution, instrument settings, sound profile, conductor behavior, and volume settings must apply to live playback and WAV export.
8. **Ask when uncertain.** The user explicitly requested: “During development, if you have any question, stop and ask me.” Do not guess about ambiguous musical direction or make a large product decision without asking.
9. **Listen, don't just count tests.** Passing tests and a successful build do not prove that the result sounds good. Ask the user to audition important sound changes and use their feedback before layering on more features.

## 3. Current application

The Mathematics Lab currently contains four experiments:

- **Mandelbrot:** fractal escape-time values influence the generated musical sequence.
- **Euclidean rhythms:** distribute pulses mathematically across a cycle.
- **Chaos map:** logistic-map dynamics generate deterministic evolving values and musical events.
- **Shepard illusion:** overlapping octave layers create the auditory illusion of continuous ascent. Preserve this experiment's special behavior; do not force it into the ordinary eight-bar song form.

The browser UI includes mathematical visualization, a moving playhead, tempo, complexity, root-note, harmonic-color and seed controls, a unified Play/Stop control, live parameter updates, output volume, sound-character selection, independent feature/instrument controls, instrument mixer, and offline WAV export.

### Musical form and sound system already implemented

- The ordinary musical experiments use an **eight-bar composition** with a recognizable motif: opening, development, climax, and ending/reprise. The motif is varied during development, raised and made denser at the climax, then recalled and resolved toward the tonic.
- The composition can include harmonic arrangement, chord inversions/voice leading, bass movement, and procedurally synthesized kick/snare/hi-hat percussion.
- The five dedicated instrument layers are:
  - **Piano:** carries the lead melody.
  - **Plucked Strings:** deterministic call-and-response answers between selected lead phrases.
  - **Warm Analog:** a restrained counterline / sustained color.
  - **Cinematic Bass:** supports harmonic roots and movement.
  - **Atmospheric Pads:** sustain chord voicings and harmonic atmosphere.
- Sound character profiles: **Hybrid Cinematic** (default), **Natural / Organic**, and **Electronic / Synth**. A profile changes timbre, not the underlying mathematical event sequence.
- Each instrument has its own ON/OFF control and independent 0–150% mixer level.
- The output-volume slider controls live playback and WAV export (0–150%; current default is 115%). A compressor helps manage peaks.
- WAV export uses `OfflineAudioContext` and produces stereo 16-bit, 44.1 kHz output.
- The **Ensemble Conductor** has its own ON/OFF control. It shapes a performance arc across the eight bars: piano establishes the opening; supporting voices enter during development; the ensemble and percussion build in bars five and six; supporting layers retreat while the lead resolves.
- The conductor uses deterministic, per-voice dynamic envelopes and start/end velocity values so sustained notes can swell or fade without being retriggered. The Shepard experiment retains its continuous-rise illusion.

### Critical instrument-routing behavior

- If **one or more dedicated instruments are enabled**, the legacy/default oscillator must be bypassed. Do not let it play underneath dedicated instruments.
- If all dedicated instruments are OFF, the legacy/default synthesizer is the fallback.
- Percussion is a separate composition layer.
- Instruments must continue to work when other composition features are disabled. Use the actual melody/bass/chord events when available; otherwise derive deterministic fallback events from the mathematical sequence. Never fill gaps with random pitches.
- Current event routing in `src/audio.ts`: piano → lead, plucked strings → answer, warm analog → texture, cinematic bass → bass, atmospheric pads → pad.
- Keep live playback and offline rendering on the same resolved event path.

## 4. Code map

- `src/math.ts` — pure mathematical generators and deterministic composition generation. Main entry point: `generateComposition()`. Defines modes, compositions, and note events.
- `src/audio.ts` — Web Audio synthesis, instrument settings and event resolution, ensemble conductor, live player, and OfflineAudioContext WAV renderer. Key functions include `resolveInstrumentEvents()`, `preparePlaybackEvents()`, `applyEnsembleConductor()`, `getConductorSection()`, `MusicPlayer`, and `renderCompositionWav()`.
- `src/main.ts` — browser UI, controls, live updates, visualization/playhead, and WAV export.
- `src/style.css` — UI styling.
- `tests/math.test.ts` — mathematical generation, deterministic behavior, composition, and musical-form tests.
- `tests/audio.test.ts` — instrument routing, fallbacks, conductor, and audio-event tests.
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
   ```
   Node.js 20+ is required locally; the GitHub Actions workflow currently uses Node.js 22.
3. Listen to the live app and export a WAV when the change affects sound. Do not claim perceptual quality, loudness calibration, or musical success based on unit tests alone.
4. Update `README.md` and this handoff when behavior, controls, architecture, commands, or status changes.
5. Verify the GitHub Actions run for the exact commit before saying CI or deployment passed. The workflow deploys GitHub Pages on pushes to `main`; do not claim a deployment succeeded while it is queued or failing.
6. Keep changes focused. Do not rewrite unrelated systems or silently remove existing experiments/features.

## 6. Current handoff / resume point

The last user request in the preceding conversation was **“Do it”**, referring to a proposed **dynamic Ensemble Conductor** that makes instruments enter, build, peak, retreat, and interact across the composition's beginning, development, climax, and ending.

That implementation is already present on `main`. The current implementation includes:

- A separate Ensemble Conductor toggle.
- Per-voice envelopes for lead, answer, texture, bass, pad, and percussion.
- Deterministic interpolation across the eight-bar arc.
- Event start and end velocity shaping, including sustained-note automation.
- Shared conductor processing for live playback and offline WAV export.
- Tests for conductor sections, voice dynamics, and sustained-note behavior.

**First next action:** do not immediately add another feature. Ask the user to audition the live app with Ensemble Conductor ON and OFF and evaluate whether the staged entrances, build, climax, and release are clearly audible and musically convincing. Ask what they hear if the result is not right, then adjust the implementation to that feedback.

If the user approves the conductor, discuss the next musical priority with them. Possible directions already discussed include improving instrument realism/expressiveness and deepening the ensemble's musical interaction. Do not assume which direction they want next.

### Last verified repository snapshot

- Snapshot checked: 2026-11-07.
- Branch: `main`.
- Latest commit at time of writing: `6c9190bca0875567c28b917da91b8994b21db861` — “Clarify instrument event routing and clean conductor documentation formatting”.
- Latest GitHub Actions workflow run checked: run **#100**, completed with conclusion **success** for that commit. The workflow runs `npm install`, `npm test`, `npm run build`, then deploys GitHub Pages.
- Current test files contain **34 test cases** in total (14 audio tests and 20 math tests) at this snapshot. Recount after future changes.
- This is a historical snapshot, not a guarantee of the current state. Always check the latest commit and workflow run before relying on these values.

## 7. Documentation note

The current `README.md` describes the product and features, but its long feature-description section contains duplicated wording and at least one older instrument-routing description that conflicts with the current event routing above. When next editing the README, reconcile and deduplicate it against `src/audio.ts` and the tests. Do not copy stale README text into new code.

---

**Guiding principle:** make the mathematics generate the musical ideas, make the instruments express those ideas, and make the ensemble tell a coherent musical story. Every change should be deterministic, independently controllable, audibly meaningful, testable, and approved by listening—not merely plausible in code.
