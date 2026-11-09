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
