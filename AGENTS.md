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
- **Shepard illusion:** overlapping octave layers create the auditory illusion of continuous ascent. Preserve this experiment's special behavior; do not force it into the ordinary 16-bar song form.

The browser UI includes mathematical visualization, a moving playhead, tempo, complexity, root-note, harmonic-color and seed controls, a unified Play/Stop control, live parameter updates, output volume, sound-character selection, independent feature/instrument controls, instrument mixer, and offline WAV export.

### Musical form and sound system already implemented

- The ordinary musical experiments use a **16-bar composition** with four connected four-bar movements: opening, development, climax, and reprise/cadence. At the default 128 BPM, the piece lasts about 30 seconds. The mathematical sequence shapes the opening motif, eight two-bar chord choices, development variations and climax contour; the reprise recalls the motif and resolves to the tonic.
- The composition can include sequence-derived harmonic progressions selected to support the actual piano phrase, close-voiced chord inversions/voice leading, tension-aware chord colors and tonic cadence, scale-aware bass/pad/answer/texture parts sharing one harmonic map, source-shaped drums, and procedurally synthesized kick/snare/hi-hat percussion.
- The five dedicated instrument layers are:
  - **Piano:** carries the lead melody.
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

The user reported that not all instruments sounded harmonically connected to the piano. The concrete issue was that the chord progression was selected independently of the actual lead phrase, fallback pads used fixed major intervals regardless of the selected scale, and response notes could be selected from overlapping pad tails belonging to the previous chord.

The current harmonic-cohesion correction:
- Chooses each source-approved two-bar chord by scoring how well its diatonic triad supports the actual piano phrase, with stronger weight on accented and sustained notes. The piano remains the mathematical lead; it is not forcibly rewritten to fit a disconnected accompaniment.
- Publishes one shared eight-frame harmonic map (root, triad, color tone, start/end) on the composition. The arranged bass, pad voicings, plucked answers and analog counterlines all use that same map.
- Makes supporting responses choose from the chord active at their entrance, including the incoming chord during a transition pickup, rather than sampling every overlapping pad note.
- Makes fallback pads and bass use the same scale-aware chord frames instead of fixed major intervals or arbitrary lead-note transpositions.
- Uses root/fifth bass support; percussion remains a rhythmic rather than pitched harmony role.

Preserve:
- Determinism for fixed mode, seed and controls; mathematics and the piano phrase remain the source of musical ideas.
- The 16-bar/30-second four-movement form and the Shepard illusion's separate behavior.
- Adaptive conductor behavior (at most two support roles per two-bar phrase), independent instrument toggles/mixer, live/offline event parity, and the +14 dB master chain.
- No AI music generation or downloaded audio samples.

**Next action:** verify CI for the harmonic-cohesion correction. Then ask the user to audition piano with bass/pads, then add plucked and analog layers one at a time. Confirm the accompaniment now follows the piano's chord changes and that the selected scale remains audible in fallback mode. Tests establish event-level harmony, not perceptual quality.

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
