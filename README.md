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

Ordinary musical experiments use a deterministic **16-bar form** with four connected movements: opening, development, climax, and reprise/cadence. At the default 128 BPM, the composition lasts approximately **30 seconds**. A four-note motif is selected from the mathematical sequence, transformed through the middle sections, raised and made denser at the climax, then recalled and resolved toward the tonic. Short melodic pickups, bass anticipations, overlapping chord-pad releases and percussion fills connect the movements rather than letting them sound like separate blocks.

**Musical Arrangement** adds voice-led chords, bass movement and synthesized kick/snare/hat percussion. **Musical Expression** adds the 16-bar motif and shapes the arrangement around the phrase. These features have independent ON/OFF controls.

The five independently switchable and mixable instrument layers are:

- **Piano:** carries the mathematical lead melody.
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

- Mathematical generators are pure functions and deterministic for a fixed input.
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
