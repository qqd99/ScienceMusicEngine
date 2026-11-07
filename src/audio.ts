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
    const pan = ctx.createStereoPanner();
    osc.type = event.waveform;
    osc.frequency.setValueAtTime(event.frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, event.velocity), at + 0.025);
    gain.gain.setValueAtTime(Math.max(0.0002, event.velocity), at + Math.max(0.04, event.duration * 0.65));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + event.duration);
    pan.pan.setValueAtTime(event.pan, at);
    osc.connect(gain).connect(pan).connect(master);
    this.active.add(osc);
    osc.onended = () => { this.active.delete(osc); osc.disconnect(); gain.disconnect(); pan.disconnect(); };
    osc.start(at);
    osc.stop(at + event.duration + 0.03);
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