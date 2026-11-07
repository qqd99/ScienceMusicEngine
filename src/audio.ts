import type { Composition, NoteEvent } from "./math";
function schedulePercussion(
  context: BaseAudioContext,
  event: NoteEvent,
  at: number,
  destination: AudioNode,
  onEnded?: () => void
): AudioScheduledSourceNode {
  const kind = event.percussionKind ?? "kick";
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const pan = context.createStereoPanner();
  const duration = Math.max(0.035, event.duration);
  const peak = Math.max(0.0001, event.velocity);
  let source: AudioScheduledSourceNode;
  if (kind === "kick") {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(132, at);
    oscillator.frequency.exponentialRampToValueAtTime(46, at + duration * 0.72);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source = oscillator;
  } else {
    const frames = Math.max(128, Math.ceil(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    let state = (Math.floor(event.time * 1_000_000) ^ (kind === "snare" ? 0x5a17 : 0x71c3)) >>> 0;
    for (let i = 0; i < frames; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      data[i] = ((state >>> 0) / 2147483648) - 1;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    filter.type = kind === "snare" ? "bandpass" : "highpass";
    filter.frequency.setValueAtTime(kind === "snare" ? 1850 : 7200, at);
    filter.Q.setValueAtTime(kind === "snare" ? 0.8 : 0.45, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + (kind === "snare" ? 0.004 : 0.001));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source = noise;
  }
  pan.pan.setValueAtTime(event.pan, at);
  source.connect(filter).connect(gain).connect(pan).connect(destination);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); onEnded?.(); };
  source.start(at);
  source.stop(at + duration + 0.005);
  return source;
}

export class MusicPlayer {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private playing = false;
  private cycleStart = 0;
  private cursor = 0;
  private composition: Composition | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  async play(composition: Composition, volume = 1.15): Promise<void> {
    this.stop();
    const Context = window.AudioContext;
    this.context ??= new Context();
    if (this.context.state === "suspended") await this.context.resume();
    const ctx = this.context;
    this.composition = composition;
    this.master = ctx.createGain();
    this.master.gain.value = Math.max(0, Math.min(1.5, volume));
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.compressor.connect(ctx.destination);
    this.master.connect(this.compressor);
    this.cycleStart = ctx.currentTime + 0.08;
    this.cursor = 0;
    this.playing = true;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 35);
  }
  private schedule(): void {
    const ctx = this.context, comp = this.composition;
    if (!ctx || !comp || !this.playing) return;
    const horizon = ctx.currentTime + 0.18;
    while (this.cycleStart + comp.duration < ctx.currentTime - 0.5) {
      this.cycleStart += comp.duration;
      this.cursor = 0;
    }
    while (this.cursor < comp.events.length) {
      const event = comp.events[this.cursor];
      const at = this.cycleStart + event.time;
      if (at > horizon) break;
      if (at >= ctx.currentTime - 0.03) this.playNote(event, at);
      this.cursor++;
    }
    if (this.cursor >= comp.events.length && ctx.currentTime >= this.cycleStart + comp.duration - 0.18) {
      this.cycleStart += comp.duration;
      this.cursor = 0;
    }
  }
  private playNote(event: NoteEvent, at: number): void {
    const ctx = this.context, master = this.master;
    if (!ctx || !master || this.active.size >= 48) return;
    if (event.voice === "percussion") {
      let drum!: AudioScheduledSourceNode;
      drum = schedulePercussion(ctx, event, at, master, () => this.active.delete(drum));
      this.active.add(drum);
      return;
    }
    const osc = ctx.createOscillator();
    const rich = this.composition?.richInstruments ?? true;
    const shimmer = rich && (event.voice ?? "lead") === "lead" ? ctx.createOscillator() : null;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const voice = event.voice ?? "lead";
    const peak = Math.max(0.0002, event.velocity);
    const attack = voice === "pad" ? Math.min(0.55, event.duration * 0.3) : voice === "bass" ? 0.018 : 0.025;
    const release = voice === "pad" ? Math.min(0.7, event.duration * 0.35) : 0.08;
    const holdEnd = Math.max(at + attack + 0.02, at + event.duration - release);
    osc.type = voice === "bass" ? "triangle" : voice === "pad" ? "sine" : rich ? event.waveform : "sine";
    osc.frequency.setValueAtTime(event.frequency, at);
    if (shimmer) {
      shimmer.type = "triangle";
      shimmer.frequency.setValueAtTime(event.frequency * 2.003, at);
      shimmer.detune.setValueAtTime(-4, at);
      const overtoneGain = ctx.createGain();
      overtoneGain.gain.value = 0.68;
      shimmer.connect(overtoneGain).connect(filter);
      shimmer.start(at);
      shimmer.stop(at + event.duration + 0.03);
      this.active.add(shimmer);
      shimmer.onended = () => { this.active.delete(shimmer); shimmer.disconnect(); overtoneGain.disconnect(); };
    }
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voice === "pad" ? 2600 : voice === "bass" ? 680 : rich ? 9000 : 2400, at);
    filter.Q.setValueAtTime(rich && voice === "lead" ? 1.35 : 0.35, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, holdEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + event.duration);
    pan.pan.setValueAtTime(event.pan, at);
    osc.connect(filter).connect(gain).connect(pan).connect(master);
    this.active.add(osc);
    osc.onended = () => { this.active.delete(osc); osc.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
    osc.start(at);
    osc.stop(at + event.duration + 0.03);
  }
  update(composition: Composition, volume = 1.15): void {
    if (!this.playing || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    // Preserve the current musical phase while changing tempo or mathematical
    // parameters. Re-anchor the new cycle to the same normalized position.
    const phase = this.getProgress();
    const oldMaster = this.master;
    const nextMaster = ctx.createGain();
    nextMaster.gain.setValueAtTime(0.0001, now);
    nextMaster.gain.exponentialRampToValueAtTime(Math.max(0.0002, Math.min(1.5, volume)), now + 0.12);
    nextMaster.connect(this.compressor ?? ctx.destination);
    oldMaster?.gain.cancelScheduledValues(now);
    oldMaster?.gain.setTargetAtTime(0.0001, now, 0.035);
    this.master = nextMaster;
    this.composition = composition;
    this.cycleStart = now - phase * composition.duration;
    const elapsedInCycle = phase * composition.duration;
    this.cursor = composition.events.findIndex(event => event.time >= elapsedInCycle + 0.025);
    if (this.cursor < 0) this.cursor = composition.events.length;
    this.schedule();
    window.setTimeout(() => oldMaster?.disconnect(), 220);
  }
  setVolume(volume: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1.5, volume)), now, 0.025);
  }
  getProgress(): number {
    const ctx = this.context, comp = this.composition;
    if (!ctx || !comp || !this.playing || comp.duration <= 0) return 0;
    const elapsed = ctx.currentTime - this.cycleStart;
    if (elapsed < 0) return 0;
    return (elapsed % comp.duration) / comp.duration;
  }
  stop(): void {
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const now = this.context?.currentTime ?? 0;
    for (const osc of this.active) {
      try { osc.stop(now + 0.015); } catch { /* already stopped */ }
    }
    this.active.clear();
    const oldMaster = this.master;
    oldMaster?.gain.setTargetAtTime(0, now, 0.025);
    this.master = null;
    const compressor = this.compressor;
    this.compressor = null;
    window.setTimeout(() => { oldMaster?.disconnect(); compressor?.disconnect(); }, 100);
  }
  get isPlaying(): boolean { return this.playing; }
}

export async function renderCompositionWav(composition: Composition, volume = 1.15): Promise<Blob> {
  const sampleRate = 44100;
  const tailSeconds = 1.25;
  const frameCount = Math.ceil((composition.duration + tailSeconds) * sampleRate);
  const offline = new OfflineAudioContext(2, frameCount, sampleRate);
  const master = offline.createGain();
  master.gain.value = Math.max(0, Math.min(1.5, volume));
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.22;
  master.connect(compressor).connect(offline.destination);

  for (const event of composition.events) {
    const voice = event.voice ?? "lead";
    const at = Math.max(0, event.time);
    const end = Math.min(composition.duration + tailSeconds, at + Math.max(0.04, event.duration));
    const duration = end - at;
    if (duration <= 0) continue;
    if (event.voice === "percussion") {
      schedulePercussion(offline, event, at, master);
      continue;
    }
    const oscillator = offline.createOscillator();
    const filter = offline.createBiquadFilter();
    const gain = offline.createGain();
    const pan = offline.createStereoPanner();
    oscillator.type = voice === "bass" ? "triangle" : voice === "pad" ? "sine" : composition.richInstruments ? event.waveform : "sine";
    oscillator.frequency.setValueAtTime(event.frequency, at);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voice === "pad" ? 2600 : voice === "bass" ? 680 : composition.richInstruments ? 9000 : 2400, at);
    const attack = voice === "pad" ? Math.min(0.55, duration * 0.3) : voice === "bass" ? 0.018 : 0.025;
    const release = voice === "pad" ? Math.min(0.7, duration * 0.35) : 0.08;
    const peak = Math.max(0.0002, event.velocity);
    const holdEnd = Math.max(at + attack + 0.02, end - release);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, holdEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    pan.pan.setValueAtTime(event.pan, at);
    oscillator.connect(filter).connect(gain).connect(pan).connect(master);
    if (voice === "lead" && composition.richInstruments) {
      const overtone = offline.createOscillator();
      const overtoneGain = offline.createGain();
      overtone.type = "triangle";
      overtone.frequency.setValueAtTime(event.frequency * 2.003, at);
      overtone.detune.setValueAtTime(-4, at);
      overtoneGain.gain.value = 0.68;
      overtone.connect(overtoneGain).connect(filter);
      overtone.start(at);
      overtone.stop(end + 0.03);
    }
    oscillator.start(at);
    oscillator.stop(end + 0.03);
  }

  const rendered = await offline.startRendering();
  const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
  const wav = new ArrayBuffer(44 + rendered.length * 4);
  const view = new DataView(wav);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + rendered.length * 4, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, rendered.length * 4, true);
  let offset = 44;
  for (let i = 0; i < rendered.length; i++) {
    for (let channel = 0; channel < 2; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([wav], { type: "audio/wav" });
}
