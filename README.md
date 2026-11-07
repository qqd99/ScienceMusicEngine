# Science Music Engine

A browser-based mathematics-to-sound laboratory. It turns deterministic mathematical structures into original music using the native Web Audio API.

**No AI-generated music. No downloaded audio or art assets. No third-party audio services.**

## Live app
After GitHub Pages is enabled with **Settings → Pages → Source: GitHub Actions**, every push to `main` deploys the app.

## Mathematics Lab (v1)
- **Mandelbrot explorer:** escape-time values mapped to scale-constrained pitch, note density and contour.
- **Euclidean rhythms:** evenly distribute k pulses across n steps.
- **Chaos map:** logistic map dynamics mapped to melodic events.
- **Shepard illusion:** overlapping octave layers create an endlessly rising auditory illusion.

All experiments include independently switchable sound features. **Rich Instruments** adds an audible octave overtone and brighter, more resonant lead timbre. **Musical Arrangement** adds smoothly voice-led chord inversions with diatonic seventh color, bass movement and a synthesized kick/snare/hat part. Major and minor modes use distinct functional progressions that return to the tonic. When Musical Expression is enabled, the accompaniment follows the eight-bar arc: restrained opening, rising bass and chord energy, denser percussion at the climax, then a reduced final section. Bass approach notes lead into chord changes. The drum sounds are synthesized from oscillators and deterministic noise; no samples are downloaded. **Musical Expression** composes a deliberate eight-bar form around a four-note motif selected from the mathematical sequence and shapes the accompaniment dynamics and percussion density to match its sections. The five independent instrument layers are **Piano** (bell-like partials and natural decay), **Warm Analog** (detuned sawtooth and resonant filtering), **Plucked Strings** (fast-decay triangle pluck), **Cinematic Bass** (sub-octave sine layer), and **Atmospheric Pads** (detuned, slow-swell chord layer). Each has its own ON/OFF control. The layers are synthesized with Web Audio oscillators and envelopes, and are applied consistently to live playback and offline WAV export. The opening states it, the next bars vary its intervals and rhythm, bars five and six sequence it in a higher register for the climax, and the final two bars recall its opening contour before resolving to a sustained tonic cadence. The Shepard experiment retains its continuous-rising illusion rather than being forced into this song form. Each feature has its own ON/OFF control, and all settings are respected by live playback and WAV export. No samples are used.

The independent **Output Volume** slider controls live playback and WAV export from 0% to 150%. A dynamics compressor helps keep higher settings listenable without uncontrolled peaks. Use **Export WAV** to render the current eight-bar composition offline as a stereo 16-bit, 44.1 kHz WAV file. Export does not require starting live playback.

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
- Audio is synthesized in-browser with oscillators and envelopes.
- Playback is started only after the user presses Play.
- No external audio assets are required.
- Web Audio look-ahead scheduling uses AudioContext time rather than animation frames.

## First-version limitations
- The initial mappings are intentionally musical interpretations, not unique scientific truths; controls and mappings will be refined through listening tests.
- Shepard tones are finite layered approximations, not an actually infinite sound.
- The current player loops an eight-bar generated phrase. The output-volume control includes compression, but playback loudness still depends on the browser, operating-system and device volume.
- The app uses a hosted font stylesheet for typography; all visuals are drawn with CSS and Canvas.
