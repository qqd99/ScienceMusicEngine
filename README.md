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

All experiments now include a deterministic harmonic arrangement layer: sustained chord pads, bass foundations and a mathematical lead. The synthesizer gives each role its own filter and envelope; no samples are used.

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
- The current player loops an eight-bar generated phrase; WAV export and richer synthesis are planned for later iterations.
- The app uses a hosted font stylesheet for typography; all visuals are drawn with CSS and Canvas.
