import type { Composition, NoteEvent } from "./math";
export class MusicPlayer {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private active = new Set<OscillatorNode>();
  private playing = false;
  private cycleStart = 0;
  private cursor = 0;
  private composition: Composition | null = null;
  private master: GainNode | null = null;
  async play(composition: Composition, volume = 0.7): Promise<void> {
    this.stop();
    const Context = window.AudioContext;
    this.context ??= new Context();
    if (this.context.state === "suspended") await this.context.resume();
    const ctx = this.context;
    this.composition = composition;
    this.master = ctx.createGain();
    this.master.gain.value = Math.max(0, Math.min(1, volume));
    this.master.connect(ctx.destination);
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
    if (!ctx || !master || this.active.size >= 32) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const voice = event.voice ?? "lead";
    const peak = Math.max(0.0002, event.velocity);
    const attack = voice === "pad" ? Math.min(0.55, event.duration * 0.3) : voice === "bass" ? 0.018 : 0.025;
    const release = voice === "pad" ? Math.min(0.7, event.duration * 0.35) : 0.08;
    const holdEnd = Math.max(at + attack + 0.02, at + event.duration - release);
    osc.type = event.waveform;
    osc.frequency.setValueAtTime(event.frequency, at);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voice === "pad" ? 1900 : voice === "bass" ? 520 : 6200, at);
    filter.Q.setValueAtTime(voice === "lead" ? 0.65 : 0.35, at);
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
  update(composition: Composition, volume = 0.7): void {
    if (!this.playing || !this.context) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    // Preserve the current musical phase while changing tempo or mathematical
    // parameters. Re-anchor the new cycle to the same normalized position.
    const phase = this.getProgress();
    const oldMaster = this.master;
    const nextMaster = ctx.createGain();
    nextMaster.gain.setValueAtTime(0.0001, now);
    nextMaster.gain.exponentialRampToValueAtTime(Math.max(0.0002, Math.min(1, volume)), now + 0.12);
    nextMaster.connect(ctx.destination);
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
    window.setTimeout(() => oldMaster?.disconnect(), 80);
  }
  get isPlaying(): boolean { return this.playing; }
}