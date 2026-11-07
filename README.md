# Science Music Engine

A browser-based mathematics-to-sound laboratory. It turns deterministic mathematical structures into original music using the native Web Audio API.

**No AI-generated music. No downloaded audio or art assets. No third-party audio services.**

## Live app

After GitHub Pages is enabled with **Settings → Pages → Source: GitHub Actions**, every push to `main` deploys the app.

## Mathematics Lab (v1)

- **Mandelbrot explorer:** escape-time values map to scale-constrained pitch, note density and melodic contour.
- **Euclidean rhythms:** distribute k pulses across n steps.
- **Chaos map:** logistic-map dynamics generate deterministic melodic events.
- **Shepard illusion:** overlapping octave layers create a continuous-rising auditory illusion. This experiment keeps its special layered texture and is not forced into the ordinary song form.

## Composition and orchestration

Ordinary musical experiments use a deterministic eight-bar form: opening, development, climax, and ending/reprise. A four-note motif is selected from the mathematical sequence, transformed through the middle sections, raised and made denser at the climax, then recalled and resolved toward the tonic.

**Musical Arrangement** adds voice-led chords, bass movement and synthesized kick/snare/hat percussion. **Musical Expression** adds the eight-bar motif and shapes the arrangement around the phrase. These features have independent ON/OFF controls.

The five independently switchable and mixable instrument layers are:

- **Piano:** carries the mathematical lead melody.
- **Cinematic Bass:** marks selected harmonic roots and transitions.
- **Atmospheric Pads:** sustain selected chord voicings to frame the opening and resolution.
- **Plucked Strings:** answer the lead only in genuine rhythmic gaps.
- **Warm Analog:** adds an occasional counterline when the melody leaves enough space.

### Ensemble Conductor

The independently switchable **Ensemble Conductor** is a selective orchestrator, not a command for every enabled instrument to play. Enabled instruments are available to the conductor; they are not automatically active throughout the piece.

The conductor analyses the generated lead's note density, durations and rests, then selects a sparse set of complementary events:

- Bass marks selected harmonic anchors rather than repeating every available bass note.
- Pads appear at chosen structural moments rather than sustaining every chord change.
- Plucked Strings answer only when a real gap can contain the response.
- Warm Analog is limited to a rare counterline in a sufficiently long rest.
- Percussion is reserved for the transition and climax, and yields the downbeat when bass already owns it.
- No more than two supporting roles are intentionally layered beneath the lead at a time.

All decisions are deterministic for a fixed composition and instrument configuration. The same event resolver, orchestration decisions, instrument levels, sound profile and dynamics are shared by live playback and offline WAV export. Disabling the conductor bypasses its selective orchestration.

## Sound design

The **Sound Character** selector offers:

- **Hybrid Cinematic** (default): harmonic piano partials, warm filtered analog, plucked attacks, deep sub-bass and slowly evolving pads.
- **Natural / Organic:** rounder attacks and warmer filtering.
- **Electronic / Synth:** more detuning, filter movement and electronic harmonics.

Each instrument has its own ON/OFF control and 0–150% mixer level. The independent **Output Volume** slider controls both live playback and WAV export (0–150%; default 115%). A dynamics compressor helps manage peaks.

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

- Mathematical generators are pure functions and deterministic for a fixed input.
- Mathematical behavior meaningfully influences pitch, rhythm, contour and density.
- Audio is synthesized in-browser with oscillators and envelopes.
- Playback starts only after the user presses Play.
- Live playback and offline WAV export use the same prepared event list.
- No external audio assets or music-generation services are required.

## First-version limitations

- Mathematical mappings are musical interpretations, not unique scientific truths; they will be refined through listening tests.
- Shepard tones are finite layered approximations, not an actually infinite sound.
- The player loops an eight-bar generated phrase. Playback loudness still depends on the browser, operating-system and device volume.
- The app uses a hosted font stylesheet for typography; all visuals are drawn with CSS and Canvas.
