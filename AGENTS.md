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
- The **Ensemble Conductor** has its own ON/OFF control and is a selective orchestrator, not merely a volume curve. Enabled instruments are available to it, not automatically active. It analyses lead density and actual rests, assigns sparse bass/pad/answer/counterline roles, and reserves percussion for the transition and climax.
- Plucked answers and analog counterlines must fit genuine gaps in the lead. Bass marks selected harmonic anchors; pads frame selected structural moments; percussion yields low-frequency downbeats when bass owns them. Keep no more than two supporting roles intentionally layered beneath the lead at once.
- Conductor selection and dynamics are deterministic and shared by live playback and OfflineAudioContext WAV export. Preserve the Shepard experiment's continuous layered illusion; do not add ordinary ensemble accompaniment to it.

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

The user auditioned the previous envelope-only Ensemble Conductor and reported: **“The conductor is not good, it just throwing everything in. It should decide when to play what and what thing suitable for the rhythm, even when every instrument are enable, not all of them should play.”**

The required direction is now clear: replace volume-only orchestration with deterministic, rhythm-aware event selection. Enabled instruments are available to the conductor, not automatically active. It must inspect the actual lead rhythm, note density and rests; choose which supporting roles belong in each phrase; leave unsuitable parts silent; and keep live playback and WAV export identical.

The selective orchestration revision should follow these rules:

- Piano remains the mathematical lead.
- Bass marks selected harmonic anchors and a cadence approach, rather than playing every candidate note.
- Pads frame selected structural moments, not every chord change.
- Plucked Strings answer only inside real lead rests.
- Warm Analog contributes a rare counterline only when a sufficiently long gap exists.
- Percussion supports the transition and climax, yields the downbeat when bass owns it, and avoids unnecessary hats over a dense melody.
- At most two supporting roles should be intentionally layered beneath the lead at once.
- The Shepard illusion must remain a special continuous texture, not an ordinary ensemble arrangement.

**Next action after the revision:** ask the user to audition the new conductor with all five instruments enabled and compare ON/OFF using the same mode and seed. Listen for whether the parts take turns, respect the melody's rests, and create a clear but uncluttered climax. Do not claim perceptual success based on tests alone. Ask for feedback before adding unrelated features.

### Historical repository snapshot

- Before the selective-orchestration revision, the latest checked commit was `cacad25807847c955dc501afa659996cbe77484a` on `main`.
- Its GitHub Actions workflow run **#101** completed successfully, including tests, build and GitHub Pages deployment.
- The pre-revision test suite contained 34 cases (14 audio tests and 20 math tests).
- These figures are historical. Always inspect the current branch head, tests and Actions run before relying on them; record the new exact commit and CI result after the revision is verified.

## 7. Documentation note

The current `README.md` describes the product and features, but its long feature-description section contains duplicated wording and at least one older instrument-routing description that conflicts with the current event routing above. When next editing the README, reconcile and deduplicate it against `src/audio.ts` and the tests. Do not copy stale README text into new code.

---

**Guiding principle:** make the mathematics generate the musical ideas, make the instruments express those ideas, and make the ensemble tell a coherent musical story. Every change should be deterministic, independently controllable, audibly meaningful, testable, and approved by listening—not merely plausible in code.
