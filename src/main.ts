import { generateComposition, type Composition, type Mode, type NoteCollection, type TonalModeChoice } from "./math";
import { analyzeScientificSignal, generateWasmComposition, type WasmGenerationOptions } from "./wasm/bridge";
import type { ScientificSignalAnalysis } from "./science/signal";
import { DEFAULT_INSTRUMENTS, DEFAULT_INSTRUMENT_LEVELS, DEFAULT_SOUND_PROFILE, MusicPlayer, renderCompositionWav, getConductorSection, type InstrumentSettings, type InstrumentLevels, type SoundProfile } from "./audio";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
const player = new MusicPlayer();
let mode: Mode = "mandelbrot";
let playing = false;
let visualValues: number[] = [];
let animationFrame = 0;
let currentSeed = 0.314159;
type AuditionEngine = "typescript" | "wasm";
let generationToken = 0;
let auditionLoading = false;
let scientificSignalAnalysis: ScientificSignalAnalysis | undefined;
let signalAnalysisSignature = "";
let signalAnalysisRequest = 0;
let richInstrumentsEnabled = true;
let musicalArrangementEnabled = true;
let musicalExpressionEnabled = true;
let ensembleConductorEnabled = true;
let masterVolume = 1.15;
const instrumentSettings: InstrumentSettings = { ...DEFAULT_INSTRUMENTS };
const instrumentLevels: InstrumentLevels = { ...DEFAULT_INSTRUMENT_LEVELS };
let soundProfile: SoundProfile = DEFAULT_SOUND_PROFILE;
const names: Record<Mode, string> = {
  mandelbrot: "Mandelbrot explorer", euclidean: "Euclidean rhythms", chaos: "Chaos theory", shepard: "Shepard illusion"
};
const descriptions: Record<Mode, string> = {
  mandelbrot: "Trace the boundary of a fractal. Escape time becomes pitch, density and melodic contour.",
  euclidean: "Distribute a number of pulses as evenly as possible across a repeating cycle.",
  chaos: "A logistic map turns deterministic nonlinear dynamics into an evolving melodic sequence.",
  shepard: "Layered sine tones crossfade across octaves to create the illusion of endless ascent."
};
app.innerHTML = `
  <main class="shell">
    <header class="topbar"><a class="brand" href="#"><span class="brand-mark">∿</span><span>SCIENCE<span class="muted">MUSIC</span><small>ENGINE / 001</small></span></a><div class="top-meta"><span class="live-dot"></span> BROWSER AUDIO LAB <span class="divider">/</span> NO AI · NO SAMPLES</div></header>
    <section class="hero"><div class="eyebrow">MATHEMATICS → SOUND <span>FIELD NOTES 001</span></div><h1>Hear the shape<br/>of <em>mathematics.</em></h1><p class="hero-copy">An instrument for turning mathematical structures into original sound. Every note has a reason. Every pattern has a source.</p></section>
    <section class="lab-grid">
      <aside class="sidebar"><div class="section-label">01 / SELECT A SYSTEM</div><nav class="mode-list">
        <button class="mode active" data-mode="mandelbrot"><span class="mode-index">01</span><span><b>Mandelbrot</b><small>Fractal geometry</small></span><i>↗</i></button>
        <button class="mode" data-mode="euclidean"><span class="mode-index">02</span><span><b>Euclidean</b><small>Rhythm mathematics</small></span><i>↗</i></button>
        <button class="mode" data-mode="chaos"><span class="mode-index">03</span><span><b>Chaos map</b><small>Nonlinear dynamics</small></span><i>↗</i></button>
        <button class="mode" data-mode="shepard"><span class="mode-index">04</span><span><b>Shepard tone</b><small>Auditory illusion</small></span><i>↗</i></button>
      </nav><div class="sidebar-note"><span class="note-symbol">ⓘ</span><p>Generated entirely in your browser with the Web Audio API. No audio files are downloaded.</p></div></aside>
      <section class="workbench"><div class="workbench-head"><div><div class="section-label">02 / EXPERIMENT</div><h2 id="mode-title">Mandelbrot explorer</h2><p id="mode-description">${descriptions.mandelbrot}</p></div><span class="tag">PURE ALGORITHM</span></div>
        <div class="visual-panel"><div class="visual-top"><span>SEQUENCE FIELD</span><span id="visual-meta">128 STEPS · 16 BARS · 30s</span></div><canvas id="viz" width="900" height="280" aria-label="Visualization of the generated mathematical sequence"></canvas><div class="visual-legend"><span><i class="legend-line"></i> MATHEMATICAL OUTPUT</span><span id="value-readout">AWAITING GENERATION</span></div></div>
        <div class="signal-analysis-panel"><div class="visual-top"><span>SCIENTIFIC SIGNAL ANALYSIS</span><span id="signal-engine">C++17 / WASM</span></div><div class="signal-metrics"><div><span>MEAN</span><strong id="signal-mean">—</strong></div><div><span>RMS</span><strong id="signal-rms">—</strong></div><div><span>ACTIVITY</span><strong id="signal-activity">—</strong></div><div><span>PERIOD</span><strong id="signal-period">—</strong></div></div><div class="signal-timeline-label"><span>WINDOW ACTIVITY ENVELOPE</span><span id="signal-window-count">16 WINDOWS</span></div><p class="signal-note" id="signal-note">Analyzing the mathematical source with the shared C++ scientific-signal core. Physical Hz is shown only when a sample clock is supplied.</p></div>
        <div class="controls"><div class="section-label">03 / PARAMETERS</div><div class="control-grid">
          <label>Tempo <output id="bpm-value">128 BPM</output><input id="bpm" type="range" min="60" max="160" value="128"/></label>
          <label>Complexity <output id="complexity-value">55%</output><input id="complexity" type="range" min="10" max="100" value="55"/></label>
          <label>Tonal center<select id="root"><option value="auto" selected>Automatic · conductor</option><option value="60">C</option><option value="61">C♯ / D♭</option><option value="62">D</option><option value="63">D♯ / E♭</option><option value="64">E</option><option value="65">F</option><option value="66">F♯ / G♭</option><option value="67">G</option><option value="68">G♯ / A♭</option><option value="69">A</option><option value="70">A♯ / B♭</option><option value="71">B</option></select></label>
          <label>Note collection<select id="scale"><option value="white-key" selected>White-key family · 7 notes</option><option value="black-key">Black-key family · 5 notes</option></select></label>
          <label>Tonal character<select id="tonal-mode"><option value="auto" selected>Automatic · major / minor</option><option value="major">Major</option><option value="minor">Minor</option></select></label>
        </div><p class="tonality-readout" id="tonality-readout">AUTOMATIC TONAL CENTER · WHITE-KEY FAMILY</p><p class="instrument-note">The conductor reads the mathematical contour to infer a key and major/minor character. Choose a note to lock the tonal center, or lock only the character. White-key mode is diatonic; black-key mode is pentatonic. Every pitched instrument shares the resulting harmony.</p><div class="sound-profile"><label for="sound-profile">SOUND CHARACTER</label><select id="sound-profile"><option value="hybrid-cinematic" selected>Hybrid Cinematic</option><option value="natural">Natural / Organic</option><option value="electronic">Electronic / Synth</option></select><p class="instrument-note">Changes the synthesis character of all five instruments without changing the mathematical notes.</p></div><div class="feature-controls"><div class="feature-heading">04 / SOUND FEATURES</div><div class="feature-buttons"><button id="toggle-rich" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>RICH INSTRUMENTS</b><small>Overtones · brighter timbre</small></span><strong>ON</strong></button><button id="toggle-arrangement" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>MUSICAL ARRANGEMENT</b><small>Sequence-derived harmony · bass · chords · drums</small></span><strong>ON</strong></button><button id="toggle-expression" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>MUSICAL EXPRESSION</b><small>16-bar form · transitions · climax · cadence</small></span><strong>ON</strong></button><button id="toggle-conductor" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>ENSEMBLE CONDUCTOR</b><small>Selective entrances · rhythmic gaps · musical space</small></span><strong>ON</strong></button><button id="instrument-piano" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>PIANO</b><small>Lead melody · harmonic piano tone</small></span><strong>ON</strong></button><button id="instrument-analog" class="feature-toggle" type="button" aria-pressed="false"><span class="toggle-indicator"></span><span><b>WARM ANALOG</b><small>Counterline · warm sustained color</small></span><strong>OFF</strong></button><button id="instrument-plucked" class="feature-toggle" type="button" aria-pressed="false"><span class="toggle-indicator"></span><span><b>PLUCKED STRINGS</b><small>Call-and-response · plucked accents</small></span><strong>OFF</strong></button><button id="instrument-cinematicBass" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>CINEMATIC BASS</b><small>Harmonic roots · cinematic foundation</small></span><strong>ON</strong></button><button id="instrument-atmosphere" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>ATMOSPHERIC PADS</b><small>Sustained chords · evolving atmosphere</small></span><strong>ON</strong></button></div><div class="conductor-readout"><span>ENSEMBLE PHASE</span><strong id="conductor-phase">READY</strong><small id="conductor-detail">Adaptive score analysis · roles reconsidered at phrase boundaries</small></div><div class="instrument-mixer"><div class="feature-heading">INSTRUMENT MIXER</div><div class="instrument-levels"><label for="level-piano">PIANO <output id="level-piano-value">90%</output><input id="level-piano" data-instrument-level="piano" type="range" min="0" max="150" value="90"/></label><label for="level-analog">WARM ANALOG <output id="level-analog-value">72%</output><input id="level-analog" data-instrument-level="analog" type="range" min="0" max="150" value="72"/></label><label for="level-plucked">PLUCKED STRINGS <output id="level-plucked-value">82%</output><input id="level-plucked" data-instrument-level="plucked" type="range" min="0" max="150" value="82"/></label><label for="level-cinematicBass">CINEMATIC BASS <output id="level-cinematicBass-value">90%</output><input id="level-cinematicBass" data-instrument-level="cinematicBass" type="range" min="0" max="150" value="90"/></label><label for="level-atmosphere">ATMOSPHERIC PADS <output id="level-atmosphere-value">72%</output><input id="level-atmosphere" data-instrument-level="atmosphere" type="range" min="0" max="150" value="72"/></label></div></div><p class="instrument-note">Piano leads the melody; plucked strings answer between phrases; warm analog adds a quiet counterline; bass anchors harmonic roots; pads sustain the chord atmosphere. Each part is generated deterministically from the same mathematical material.</p></div><div class="seed-row"><span>DETERMINISTIC SEED</span><code id="seed-value">0.314159</code><button id="random-seed" class="text-button">↻ NEW SEED</button></div></div>
        <div class="audition-panel"><div class="feature-heading">05 / ENGINE A/B AUDITION</div><label class="audition-label" for="engine-select">GENERATOR</label><select id="engine-select"><option value="typescript" selected>TypeScript · production baseline</option><option value="wasm">C++ / WebAssembly · audition candidate</option></select><p class="instrument-note">Both engines receive the same mathematical samples, seed, tempo, tonal controls, instrument switches, sound character and mixer. Switch engines and replay to compare the arrangements.</p><p class="engine-summary" id="engine-summary">TYPESCRIPT BASELINE · READY FOR A/B COMPARISON</p><p class="engine-note" id="engine-note">Production baseline. The C++ candidate remains opt-in.</p></div><div class="volume-control"><label for="master-volume"><span>OUTPUT VOLUME</span><output id="volume-value">115%</output></label><input id="master-volume" type="range" min="0" max="150" value="115" step="1" aria-label="Master music volume"/><small class="instrument-note">+14 dB fixed master boost · peak-limited</small></div><div class="transport"><div class="transport-left"><button id="play" class="play-button" aria-pressed="false"><span id="play-icon">▶</span> <span id="play-label">PLAY TYPESCRIPT</span></button><button id="export-wav" class="export-button">↓ EXPORT WAV</button></div><div class="transport-status"><span class="status-light" id="status-light"></span><span id="status">READY TO GENERATE</span></div></div>
      </section>
    </section>
    <footer><span>SCIENCE MUSIC ENGINE <span class="muted">· MATHEMATICS LAB</span></span><span>BUILT WITH WEB AUDIO <span class="muted">· V1.0.0</span></span></footer>
  </main>`;
const $ = <T extends HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
const canvas = $("#viz") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
function options() {
  const center = ($("#root") as HTMLSelectElement).value;
  return {
    bpm: Number(($("#bpm") as HTMLInputElement).value),
    complexity: Number(($("#complexity") as HTMLInputElement).value) / 100,
    root: center === "auto" ? 60 : Number(center),
    tonalCenter: center === "auto" ? "auto" as const : Number(center),
    noteCollection: ($("#scale") as HTMLSelectElement).value as NoteCollection,
    tonalMode: ($("#tonal-mode") as HTMLSelectElement).value as TonalModeChoice,
    seed: currentSeed,
    richInstruments: richInstrumentsEnabled,
    musicalArrangement: musicalArrangementEnabled,
    musicalExpression: musicalExpressionEnabled
  };
}

function selectedEngine(): AuditionEngine {
  return ($("#engine-select") as HTMLSelectElement).value as AuditionEngine;
}
function updatePlayButtonState() {
  const button = $("#play") as HTMLButtonElement;
  const isPlaying = player.isPlaying;
  $("#play-icon").textContent = isPlaying ? "■" : "▶";
  $("#play-label").textContent = auditionLoading
    ? (selectedEngine() === "wasm" ? "LOADING C++ / WASM…" : "STARTING AUDIO…")
    : isPlaying
      ? "STOP AUDITION"
      : selectedEngine() === "wasm" ? "PLAY C++ / WASM" : "PLAY TYPESCRIPT";
  button.disabled = auditionLoading;
  button.classList.toggle("is-playing", isPlaying);
  button.setAttribute("aria-pressed", String(isPlaying));
}
function updateEngineSummary(composition?: Composition) {
  const engine = selectedEngine();
  const label = engine === "wasm" ? "C++ / WASM CANDIDATE" : "TYPESCRIPT BASELINE";
  const bpm = Number(($("#bpm") as HTMLInputElement).value);
  const seed = Math.round(currentSeed * 1_000_000);
  const tonal = composition?.tonality
    ? " · " + composition.tonality.scale.toUpperCase()
    : "";
  const eventCount = composition ? " · " + composition.events.length + " SCORE EVENTS" : "";
  $("#engine-summary").textContent = label + " · " + bpm + " BPM · SEED " + seed + tonal + eventCount;
}
function updateEngineControls() {
  const select = $("#engine-select") as HTMLSelectElement;
  const wasmOption = select.querySelector<HTMLOptionElement>('option[value="wasm"]')!;
  wasmOption.disabled = mode === "shepard";
  if (mode === "shepard" && select.value === "wasm") select.value = "typescript";

  const wasmSelected = selectedEngine() === "wasm";
  for (const id of ["toggle-arrangement", "toggle-expression", "toggle-conductor"]) {
    const control = $<HTMLButtonElement>("#" + id);
    control.disabled = wasmSelected;
    control.title = wasmSelected
      ? "The C++ engine uses its own built-in arrangement, 16-bar form and phrase conductor."
      : "";
  }
  $("#engine-note").textContent = wasmSelected
    ? "C++ uses its own arrangement and phrase conductor. The three TypeScript-only structure toggles are paused during this audition."
    : mode === "shepard"
      ? "The Shepard illusion is a dedicated TypeScript experiment and is not part of the C++ score engine."
      : "Production baseline. The C++ candidate remains opt-in; no production engine has been changed.";
  updatePlayButtonState();
  updateEngineSummary();
}
function wasmGenerationOptions(): WasmGenerationOptions {
  const center = ($("#root") as HTMLSelectElement).value;
  return {
    // Preserve a stable integer counterpart to the fractional UI seed.
    seed: Math.round(currentSeed * 1_000_000),
    bpm: Number(($("#bpm") as HTMLInputElement).value),
    collection: ($("#scale") as HTMLSelectElement).value as NoteCollection,
    rootPitchClass: center === "auto" ? "auto" : Number(center) % 12,
    mode: ($("#tonal-mode") as HTMLSelectElement).value as TonalModeChoice,
    enableBass: instrumentSettings.cinematicBass,
    enablePad: instrumentSettings.atmosphere,
    enablePlucked: instrumentSettings.plucked,
    enableAnalog: instrumentSettings.analog,
    enablePercussion: true
  };
}
async function generateAuditionComposition(
  engine: AuditionEngine,
  sourceComposition: Composition
): Promise<Composition> {
  if (engine === "typescript") return sourceComposition;
  if (mode === "shepard") {
    throw new Error("The C++ engine does not implement the dedicated Shepard illusion.");
  }
  const composition = await generateWasmComposition(
    sourceComposition.values,
    wasmGenerationOptions()
  );
  return {
    ...composition,
    richInstruments: richInstrumentsEnabled,
    musicalArrangement: musicalArrangementEnabled,
    musicalExpression: musicalExpressionEnabled
  };
}
function updateSignalAnalysisReadout(analysis?: ScientificSignalAnalysis) {
  const summary = analysis?.channels[0];
  if (!summary) {
    $("#signal-mean").textContent = "—";
    $("#signal-rms").textContent = "—";
    $("#signal-activity").textContent = "—";
    $("#signal-period").textContent = "—";
    $("#signal-window-count").textContent = "16 WINDOWS";
    return;
  }
  $("#signal-mean").textContent = summary.mean.toFixed(3);
  $("#signal-rms").textContent = summary.rms.toFixed(3);
  $("#signal-activity").textContent = summary.meanAbsoluteDelta.toFixed(4);
  $("#signal-period").textContent = summary.dominantPeriodSamples > 0
    ? summary.dominantPeriodSamples + " STEPS"
    : "APERIODIC";
  $("#signal-window-count").textContent =
    analysis.frames.length + " WINDOWS · SHARED TIMELINE";
  const frequency = summary.dominantFrequencyHz > 0
    ? " · " + summary.dominantFrequencyHz.toFixed(2) + " Hz"
    : " · NO PHYSICAL SAMPLE CLOCK";
  $("#signal-note").textContent =
    "C++17 / WASM · " + analysis.sampleCount + " SAMPLES · " +
    summary.periodicityStrength.toFixed(2) + " PERIODICITY CONFIDENCE" +
    frequency + " · " + (summary.unit || "UNITLESS SOURCE");
}
function requestScientificSignalAnalysis(values: number[]) {
  const signature = mode + "|" + values.join(",");
  if (signature === signalAnalysisSignature) return;
  signalAnalysisSignature = signature;
  scientificSignalAnalysis = undefined;
  const request = ++signalAnalysisRequest;
  $("#signal-engine").textContent = "ANALYZING";
  updateSignalAnalysisReadout();
  void analyzeScientificSignal({
    channels: [{ id: "mathematical-output", unit: "normalized", samples: values }],
    sampleRateHz: 0
  }, 16).then(analysis => {
    if (request !== signalAnalysisRequest) return;
    scientificSignalAnalysis = analysis;
    $("#signal-engine").textContent = "C++17 / WASM";
    updateSignalAnalysisReadout(analysis);
    render();
  }).catch(error => {
    if (request !== signalAnalysisRequest) return;
    $("#signal-engine").textContent = "UNAVAILABLE";
    $("#signal-note").textContent =
      "C++ signal analysis could not load. Build the optional module with npm run build:wasm. " +
      "The mathematical visualization and TypeScript audio engine remain available.";
    console.warn("Scientific signal analysis unavailable:", error);
  });
}
function drawSignalActivityTrack() {
  if (!scientificSignalAnalysis) return;
  const frames = scientificSignalAnalysis.frames.filter(
    frame => frame.channelId === "mathematical-output"
  );
  if (!frames.length) return;
  const maximum = Math.max(1e-9, ...frames.map(frame => frame.activity));
  const h = canvas.height, w = canvas.width;
  for (const frame of frames) {
    const ratio = Math.max(0, Math.min(1, frame.activity / maximum));
    const x = frame.startFraction * w;
    const width = Math.max(1, (frame.endFraction - frame.startFraction) * w - 1);
    const barHeight = 3 + ratio * 8;
    ctx.fillStyle = "rgba(132,194,175," + (0.22 + ratio * 0.58) + ")";
    ctx.fillRect(x, h - 9 - barHeight, width, barHeight);
  }
}
function render() {
  const comp = generateComposition(mode, options());
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0d151e"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(143,170,190,.12)"; ctx.lineWidth = 1;
  for (let y = 35; y < h; y += 42) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  const values = comp.values;
  visualValues = values;
  requestScientificSignalAnalysis(values);
  if (mode === "shepard") {
    $("#tonality-readout").textContent = "SHEPARD · CONTINUOUS CHROMATIC OCTAVE LAYERS";
  } else if (comp.tonality) {
    const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
    const tonal = comp.tonality;
    const centerLabel = tonal.centerSource === "automatic" ? "AUTO CENTER" : "MANUAL CENTER";
    const modeLabel = tonal.modeSource === "automatic" ? "AUTO MODE" : "MANUAL MODE";
    $("#tonality-readout").textContent =
      `${centerLabel} · ${noteNames[tonal.rootPitchClass]} ${tonal.scale.toUpperCase()} · ${modeLabel}`;
  }
  if (mode === "euclidean") {
    const cx = w/2, cy = h/2, radius = 90;
    ctx.strokeStyle = "rgba(128,190,177,.28)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();
    values.forEach((v,i) => { const a = i/values.length*Math.PI*2-Math.PI/2; const r = v ? radius+20 : radius+5; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,v?5:2,0,Math.PI*2); ctx.fillStyle = v?"#8bc9b6":"#344652"; ctx.fill(); });
  } else {
    const gradient = ctx.createLinearGradient(0,0,w,0); gradient.addColorStop(0,"#64b5a4"); gradient.addColorStop(1,"#b7a2df");
    ctx.beginPath();
    values.forEach((v,i) => { const x=i/(values.length-1)*w; const y=h-30-v*(h-65); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); });
    ctx.strokeStyle=gradient;ctx.lineWidth=2.5;ctx.stroke();
    values.forEach((v,i)=>{if(i%4===0){const x=i/(values.length-1)*w,y=h-30-v*(h-65);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle="#b7a2df";ctx.fill();}});
  }
  drawSignalActivityTrack();
  $("#visual-meta").textContent = `${values.length} STEPS · 16 BARS · ${Math.round(comp.duration)}s`;
  $("#value-readout").textContent = `MIN ${Math.min(...values).toFixed(3)}  /  MAX ${Math.max(...values).toFixed(3)}`;
  if (player.isPlaying) drawPlayhead(player.getProgress());
}
function drawPlayhead(progress: number) {
  if (!visualValues.length) return;
  const w = canvas.width, h = canvas.height;
  const timelineX = progress * w;
  ctx.strokeStyle = "rgba(244,213,138,.42)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(timelineX, h - 25); ctx.lineTo(timelineX, h); ctx.stroke();
  if (mode === "euclidean") {
    const cx = w/2, cy = h/2, radius = 90, angle = progress * Math.PI * 2 - Math.PI/2;
    const x = cx + Math.cos(angle) * (radius + 20), y = cy + Math.sin(angle) * (radius + 20);
    ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fillStyle="rgba(131,197,178,.18)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle="#f4d58a"; ctx.fill();
    ctx.strokeStyle="#fff0c2"; ctx.lineWidth=1.5; ctx.stroke();
    return;
  }
  const position = progress * (visualValues.length - 1);
  const index = Math.floor(position), fraction = position - index;
  const value = visualValues[index] + ((visualValues[Math.min(index+1,visualValues.length-1)] - visualValues[index]) * fraction);
  const x = progress * w, y = h - 30 - value * (h - 65);
  ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.fillStyle="rgba(244,213,138,.18)"; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle="#f4d58a"; ctx.fill();
  ctx.strokeStyle="#fff0c2"; ctx.lineWidth=1.5; ctx.stroke();
}
function animatePlayhead() {
  if (!player.isPlaying) { cancelAnimationFrame(animationFrame); animationFrame=0; return; }
  render();
  const engine = selectedEngine();
  $("#conductor-phase").textContent = getConductorSection(player.getProgress()).toUpperCase();
  const decision = player.getCurrentConductorDecision();
  $("#conductor-detail").textContent = engine === "wasm"
    ? "C++ phrase plan · native arrangement and conductor"
    : ensembleConductorEnabled
      ? (decision?.summary ?? "Analyzing the next phrase…")
      : "Conductor bypassed · original arrangement";
  animationFrame=requestAnimationFrame(animatePlayhead);
}
async function updateLiveComposition() {
  if (!player.isPlaying) {
    updateEngineSummary();
    return;
  }
  const request = ++generationToken;
  try {
    const sourceComposition = generateComposition(mode, options());
    const composition = await generateAuditionComposition(selectedEngine(), sourceComposition);
    if (request !== generationToken || !player.isPlaying) return;
    player.update(composition, masterVolume, instrumentSettings, soundProfile, instrumentLevels, ensembleConductorEnabled);
    updateEngineSummary(composition);
  } catch (error) {
    if (request === generationToken) {
      $("#status").textContent = "ENGINE UPDATE FAILED";
      console.error(error);
    }
  }
}
function setMode(next: Mode) {
  mode = next;
  updateEngineControls();
  app.querySelectorAll<HTMLButtonElement>(".mode").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  $("#mode-title").textContent=names[mode];$("#mode-description").textContent=descriptions[mode];render();void updateLiveComposition();
}
 app.querySelectorAll<HTMLButtonElement>(".mode").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode as Mode)));
$("#engine-select").addEventListener("change", () => {
  updateEngineControls();
  void updateLiveComposition();
});
function setFeatureButton(id: string, enabled: boolean) {
  const button = $(`#${id}`) as HTMLButtonElement;
  button.classList.toggle("enabled", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  button.querySelector("strong")!.textContent = enabled ? "ON" : "OFF";
}
$("#sound-profile").addEventListener("change", () => { soundProfile = ($("#sound-profile") as HTMLSelectElement).value as SoundProfile; updateLiveComposition(); });
app.querySelectorAll<HTMLInputElement>("[data-instrument-level]").forEach(input => input.addEventListener("input", () => { const key = input.dataset.instrumentLevel as keyof InstrumentLevels; instrumentLevels[key] = Number(input.value) / 100; $("#level-" + key + "-value").textContent = input.value + "%"; if (player.isPlaying) updateLiveComposition(); }));
$("#toggle-rich").addEventListener("click", () => {
  richInstrumentsEnabled = !richInstrumentsEnabled;
  setFeatureButton("toggle-rich", richInstrumentsEnabled);
  render(); updateLiveComposition();
});
(["piano","analog","plucked","cinematicBass","atmosphere"] as const).forEach(instrument => {
  const id = "instrument-" + instrument;
  app.querySelector<HTMLButtonElement>("#" + id)!.addEventListener("click", () => {
    instrumentSettings[instrument] = !instrumentSettings[instrument];
    setFeatureButton(id, instrumentSettings[instrument]);
    updateLiveComposition();
  });
});
$("#toggle-conductor").addEventListener("click", () => {
  ensembleConductorEnabled = !ensembleConductorEnabled;
  setFeatureButton("toggle-conductor", ensembleConductorEnabled);
  $("#conductor-phase").textContent = ensembleConductorEnabled ? (player.isPlaying ? getConductorSection(player.getProgress()).toUpperCase() : "READY") : "BYPASSED";
  $("#conductor-detail").textContent = ensembleConductorEnabled
    ? "Adaptive score analysis · roles reconsidered at phrase boundaries"
    : "Conductor bypassed · original arrangement";
  updateLiveComposition();
});
$("#toggle-expression").addEventListener("click", () => {
  musicalExpressionEnabled = !musicalExpressionEnabled;
  setFeatureButton("toggle-expression", musicalExpressionEnabled);
  render(); updateLiveComposition();
});
$("#toggle-arrangement").addEventListener("click", () => {
  musicalArrangementEnabled = !musicalArrangementEnabled;
  setFeatureButton("toggle-arrangement", musicalArrangementEnabled);
  render(); updateLiveComposition();
});
["bpm","complexity","root","scale","tonal-mode"].forEach(id=>$(`#${id}`).addEventListener("input",()=>{
  if(id==="bpm")$("#bpm-value").textContent=( $("#bpm") as HTMLInputElement).value+" BPM";
  if(id==="complexity")$("#complexity-value").textContent=( $("#complexity") as HTMLInputElement).value+"%";
  render();updateLiveComposition();
}));
$("#master-volume").addEventListener("input", () => {
  masterVolume = Number(($("#master-volume") as HTMLInputElement).value) / 100;
  $("#volume-value").textContent = Math.round(masterVolume * 100) + "%";
  if (player.isPlaying) player.setVolume(masterVolume);
});
$("#random-seed").addEventListener("click",()=>{currentSeed=Number(Math.random().toFixed(6));$("#seed-value").textContent=currentSeed.toFixed(6);render();updateLiveComposition();});
$("#play").addEventListener("click",async()=>{
  if(player.isPlaying){
    generationToken++;
    player.stop();playing=false;cancelAnimationFrame(animationFrame);animationFrame=0;
    updatePlayButtonState();
    $("#status").textContent="STOPPED";$("#status-light").classList.remove("on");$("#conductor-phase").textContent=ensembleConductorEnabled?"READY":"BYPASSED";
    return;
  }
  if (auditionLoading) return;
  const request = ++generationToken;
  const engine = selectedEngine();
  auditionLoading = true;
  updatePlayButtonState();
  try {
    const sourceComposition = generateComposition(mode, options());
    const composition = await generateAuditionComposition(engine, sourceComposition);
    if (request !== generationToken) return;
    await player.play(composition, masterVolume, instrumentSettings, soundProfile, instrumentLevels, ensembleConductorEnabled);
    playing=true;
    updatePlayButtonState();
    updateEngineSummary(composition);
    const engineLabel = engine === "wasm" ? "C++ / WASM" : "TYPESCRIPT";
    $("#status").textContent=`PLAYING · ${engineLabel} · ${composition.events.length} EVENTS · ${Math.round(composition.duration)}s`;
    $("#status-light").classList.add("on");
    animatePlayhead();
  } catch(error){
    if (request === generationToken) {
      $("#status").textContent = engine === "wasm" ? "WASM GENERATION FAILED" : "AUDIO COULD NOT START";
      console.error(error);
    }
  } finally {
    if (request === generationToken) {
      auditionLoading = false;
      updatePlayButtonState();
    }
  }
});
$("#export-wav").addEventListener("click", async () => {
  const button = $("#export-wav") as HTMLButtonElement;
  button.disabled = true;
  button.textContent = selectedEngine() === "wasm" ? "RENDERING WASM WAV…" : "RENDERING WAV…";
  try {
    const engine = selectedEngine();
    const sourceComposition = generateComposition(mode, options());
    const composition = await generateAuditionComposition(engine, sourceComposition);
    const wav = await renderCompositionWav(composition, masterVolume, instrumentSettings, soundProfile, instrumentLevels, ensembleConductorEnabled);
    const url = URL.createObjectURL(wav);
    const link = document.createElement("a");
    link.href = url;
    link.download = `science-music-${mode}-${selectedEngine()}-${Date.now()}.wav`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    button.textContent = "✓ WAV EXPORTED";
  } catch (error) {
    console.error(error);
    button.textContent = "EXPORT FAILED";
  } finally {
    window.setTimeout(() => { button.disabled = false; button.textContent = "↓ EXPORT WAV"; }, 1800);
  }
});
window.addEventListener("beforeunload",()=>player.stop());
updateEngineControls();
render();