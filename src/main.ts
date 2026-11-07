import { generateComposition, type Mode } from "./math";
import { DEFAULT_INSTRUMENTS, DEFAULT_INSTRUMENT_LEVELS, DEFAULT_SOUND_PROFILE, MusicPlayer, renderCompositionWav, type InstrumentSettings, type InstrumentLevels, type SoundProfile } from "./audio";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
const player = new MusicPlayer();
let mode: Mode = "mandelbrot";
let playing = false;
let visualValues: number[] = [];
let animationFrame = 0;
let currentSeed = 0.314159;
let richInstrumentsEnabled = true;
let musicalArrangementEnabled = true;
let musicalExpressionEnabled = true;
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
        <div class="visual-panel"><div class="visual-top"><span>SEQUENCE FIELD</span><span id="visual-meta">64 STEPS · 8 BARS</span></div><canvas id="viz" width="900" height="280" aria-label="Visualization of the generated mathematical sequence"></canvas><div class="visual-legend"><span><i class="legend-line"></i> MATHEMATICAL OUTPUT</span><span id="value-readout">AWAITING GENERATION</span></div></div>
        <div class="controls"><div class="section-label">03 / PARAMETERS</div><div class="control-grid">
          <label>Tempo <output id="bpm-value">108 BPM</output><input id="bpm" type="range" min="60" max="160" value="108"/></label>
          <label>Complexity <output id="complexity-value">55%</output><input id="complexity" type="range" min="10" max="100" value="55"/></label>
          <label>Root note<select id="root"><option value="60">C</option><option value="62">D</option><option value="64">E</option><option value="65">F</option><option value="67">G</option><option value="69">A</option><option value="71">B</option></select></label>
          <label>Harmonic color<select id="scale"><option>Lydian</option><option>Major</option><option>Minor</option><option>Pentatonic</option></select></label>
        </div><div class="sound-profile"><label for="sound-profile">SOUND CHARACTER</label><select id="sound-profile"><option value="hybrid-cinematic" selected>Hybrid Cinematic</option><option value="natural">Natural / Organic</option><option value="electronic">Electronic / Synth</option></select><p class="instrument-note">Changes the synthesis character of all five instruments without changing the mathematical notes.</p></div><div class="feature-controls"><div class="feature-heading">04 / SOUND FEATURES</div><div class="feature-buttons"><button id="toggle-rich" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>RICH INSTRUMENTS</b><small>Overtones · brighter timbre</small></span><strong>ON</strong></button><button id="toggle-arrangement" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>MUSICAL ARRANGEMENT</b><small>Bass · chords · drums · phrase accents</small></span><strong>ON</strong></button><button id="toggle-expression" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>MUSICAL EXPRESSION</b><small>8-bar form · motif · climax · cadence</small></span><strong>ON</strong></button><button id="instrument-piano" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>PIANO</b><small>Lead melody · harmonic piano tone</small></span><strong>ON</strong></button><button id="instrument-analog" class="feature-toggle" type="button" aria-pressed="false"><span class="toggle-indicator"></span><span><b>WARM ANALOG</b><small>Counterline · warm sustained color</small></span><strong>OFF</strong></button><button id="instrument-plucked" class="feature-toggle" type="button" aria-pressed="false"><span class="toggle-indicator"></span><span><b>PLUCKED STRINGS</b><small>Call-and-response · plucked accents</small></span><strong>OFF</strong></button><button id="instrument-cinematicBass" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>CINEMATIC BASS</b><small>Harmonic roots · cinematic foundation</small></span><strong>ON</strong></button><button id="instrument-atmosphere" class="feature-toggle enabled" type="button" aria-pressed="true"><span class="toggle-indicator"></span><span><b>ATMOSPHERIC PADS</b><small>Sustained chords · evolving atmosphere</small></span><strong>ON</strong></button></div><div class="instrument-mixer"><div class="feature-heading">INSTRUMENT MIXER</div><div class="instrument-levels"><label for="level-piano">PIANO <output id="level-piano-value">90%</output><input id="level-piano" data-instrument-level="piano" type="range" min="0" max="150" value="90"/></label><label for="level-analog">WARM ANALOG <output id="level-analog-value">72%</output><input id="level-analog" data-instrument-level="analog" type="range" min="0" max="150" value="72"/></label><label for="level-plucked">PLUCKED STRINGS <output id="level-plucked-value">82%</output><input id="level-plucked" data-instrument-level="plucked" type="range" min="0" max="150" value="82"/></label><label for="level-cinematicBass">CINEMATIC BASS <output id="level-cinematicBass-value">90%</output><input id="level-cinematicBass" data-instrument-level="cinematicBass" type="range" min="0" max="150" value="90"/></label><label for="level-atmosphere">ATMOSPHERIC PADS <output id="level-atmosphere-value">72%</output><input id="level-atmosphere" data-instrument-level="atmosphere" type="range" min="0" max="150" value="72"/></label></div></div><p class="instrument-note">Piano leads the melody; plucked strings answer between phrases; warm analog adds a quiet counterline; bass anchors harmonic roots; pads sustain the chord atmosphere. Each part is generated deterministically from the same mathematical material.</p></div><div class="seed-row"><span>DETERMINISTIC SEED</span><code id="seed-value">0.314159</code><button id="random-seed" class="text-button">↻ NEW SEED</button></div></div>
        <div class="volume-control"><label for="master-volume"><span>OUTPUT VOLUME</span><output id="volume-value">115%</output></label><input id="master-volume" type="range" min="0" max="150" value="115" step="1" aria-label="Master music volume"/></div><div class="transport"><div class="transport-left"><button id="play" class="play-button"><span>▶</span> PLAY EXPERIMENT</button><button id="export-wav" class="export-button">↓ EXPORT WAV</button></div><div class="transport-status"><span class="status-light" id="status-light"></span><span id="status">READY TO GENERATE</span></div></div>
      </section>
    </section>
    <footer><span>SCIENCE MUSIC ENGINE <span class="muted">· MATHEMATICS LAB</span></span><span>BUILT WITH WEB AUDIO <span class="muted">· V1.0.0</span></span></footer>
  </main>`;
const $ = <T extends HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
const canvas = $("#viz") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
function options() { return { bpm: Number(($("#bpm") as HTMLInputElement).value), complexity: Number(($("#complexity") as HTMLInputElement).value) / 100, root: Number(($("#root") as HTMLSelectElement).value), scale: ($("#scale") as HTMLSelectElement).value, seed: currentSeed, richInstruments: richInstrumentsEnabled, musicalArrangement: musicalArrangementEnabled, musicalExpression: musicalExpressionEnabled }; }
function render() {
  const comp = generateComposition(mode, options());
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0d151e"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(143,170,190,.12)"; ctx.lineWidth = 1;
  for (let y = 35; y < h; y += 42) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  const values = comp.values;
  visualValues = values;
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
  $("#visual-meta").textContent = `${values.length} STEPS · 8 BARS`;
  $("#value-readout").textContent = `MIN ${Math.min(...values).toFixed(3)}  /  MAX ${Math.max(...values).toFixed(3)}`;
  if (player.isPlaying) drawPlayhead(player.getProgress());
}
function drawPlayhead(progress: number) {
  if (!visualValues.length) return;
  const w = canvas.width, h = canvas.height;
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
  animationFrame=requestAnimationFrame(animatePlayhead);
}
function updateLiveComposition() {
  const comp=generateComposition(mode,options());
  if (player.isPlaying) player.update(comp, masterVolume, instrumentSettings, soundProfile, instrumentLevels);
}
function setMode(next: Mode) {
  mode = next;
  app.querySelectorAll<HTMLButtonElement>(".mode").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  $("#mode-title").textContent=names[mode];$("#mode-description").textContent=descriptions[mode];render();updateLiveComposition();
}
 app.querySelectorAll<HTMLButtonElement>(".mode").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode as Mode)));
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
["bpm","complexity","root","scale"].forEach(id=>$(`#${id}`).addEventListener("input",()=>{
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
  const button=$("#play") as HTMLButtonElement;
  if(player.isPlaying){
    player.stop();playing=false;cancelAnimationFrame(animationFrame);animationFrame=0;
    button.innerHTML="<span>▶</span> PLAY EXPERIMENT";button.classList.remove("is-playing");button.setAttribute("aria-pressed","false");
    $("#status").textContent="STOPPED";$("#status-light").classList.remove("on");
    return;
  }
  try {
    await player.play(generateComposition(mode,options()), masterVolume, instrumentSettings, soundProfile, instrumentLevels);playing=true;
    button.innerHTML="<span>■</span> STOP EXPERIMENT";button.classList.add("is-playing");button.setAttribute("aria-pressed","true");
    $("#status").textContent="PLAYING · LIVE 8-BAR SEQUENCE";$("#status-light").classList.add("on");
    animatePlayhead();
  } catch(error){$("#status").textContent="AUDIO COULD NOT START";console.error(error);}
});
$("#export-wav").addEventListener("click", async () => {
  const button = $("#export-wav") as HTMLButtonElement;
  button.disabled = true;
  button.textContent = "RENDERING WAV…";
  try {
    const composition = generateComposition(mode, options());
    const wav = await renderCompositionWav(composition, masterVolume, instrumentSettings, soundProfile, instrumentLevels);
    const url = URL.createObjectURL(wav);
    const link = document.createElement("a");
    link.href = url;
    link.download = `science-music-${mode}-${Date.now()}.wav`;
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
render();