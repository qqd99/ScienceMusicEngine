import type { NoteEvent } from "./math";
import { gridFrequencyAt, GRID_DURATION_SECONDS } from "./grid";

/** Shared live / offline physical grid synthesizer; contains no copied audio or samples. */
export function scheduleGridEvent(
  context: BaseAudioContext,
  event: NoteEvent,
  at: number,
  destination: AudioNode,
  onEnded?: (source: AudioScheduledSourceNode) => void
): AudioScheduledSourceNode {
  const kind = event.gridKind ?? "fundamental";
  const duration = Math.max(0.005, event.duration);
  const end = at + duration;
  const frequency = Math.max(0.1, event.frequency);
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const pan = context.createStereoPanner();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(
    kind === "fault-noise" ? 2500 : kind === "arc" || kind === "cascade" ? 2300 : 1400, at
  );
  pan.pan.setValueAtTime(event.pan, at);
  const amplitude = Math.max(0.0001, event.velocity);
  const attack = Math.min(0.025, duration * 0.12);
  const release = Math.min(0.06, duration * 0.27);
  gain.gain.setValueAtTime(0.00001, at);
  gain.gain.linearRampToValueAtTime(amplitude, at + attack);
  if (kind === "fundamental" || kind === "harmonic") {
    // The failing grid drops every partial to silence at the blackout.
    const decayAt = at + Math.max(0, 63 - event.time);
    if (decayAt < end) {
      gain.gain.setValueAtTime(amplitude, decayAt);
      gain.gain.linearRampToValueAtTime(0.00001, end);
    } else {
      gain.gain.setValueAtTime(amplitude, Math.max(at + attack, end - release));
      gain.gain.linearRampToValueAtTime(0.00001, end);
    }
  } else {
    gain.gain.setValueAtTime(amplitude, Math.max(at + attack, end - release));
    gain.gain.linearRampToValueAtTime(0.00001, end);
  }

  const isNoise = kind === "fault-noise";
  let source: AudioScheduledSourceNode;
  if (isNoise) {
    // Reproducible procedural arc noise; never store or playback the reference track.
    const sampleRate = context.sampleRate;
    const count = Math.max(1, Math.ceil(sampleRate * duration));
    const buffer = context.createBuffer(1, count, sampleRate);
    const data = buffer.getChannelData(0);
    let state = ((Math.floor(event.time * 100000) + 1) * 2654435761) >>> 0;
    for (let i = 0; i < count; i++) {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      data[i] = (state / 0xffffffff) * 2 - 1;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    source = noise;
    noise.connect(filter);
  } else {
    const oscillator = context.createOscillator();
    source = oscillator;
    if (kind === "arc" || kind === "cascade") {
      oscillator.type = "square"; // sign(sin(ωt))
    } else if (kind === "load-shed" || kind === "alarm") {
      oscillator.type = "triangle";
    } else if (kind === "phase") {
      // cos/sin partials produce exact ±120° phase offsets.
      const phase = event.gridPhase ?? 0;
      const real = new Float32Array([0, Math.sin(phase)]);
      const imag = new Float32Array([0, Math.cos(phase)]);
      oscillator.setPeriodicWave(context.createPeriodicWave(real, imag));
    } else {
      oscillator.type = "sine";
    }

    if (kind === "fundamental" || kind === "harmonic" || kind === "phase") {
      const multiplier = kind === "harmonic" ? event.frequency / 60 : 1;
      // Follow f(t) continuously, rather than stepping between tempered notes.
      oscillator.frequency.setValueAtTime(
        Math.max(0.1, gridFrequencyAt(event.time) * multiplier), at
      );
      for (let offset = 0.25; offset < duration; offset += 0.25) {
        oscillator.frequency.linearRampToValueAtTime(
          Math.max(0.1, gridFrequencyAt(event.time + offset) * multiplier), at + offset
        );
      }
      oscillator.frequency.linearRampToValueAtTime(
        Math.max(0.1, gridFrequencyAt(Math.min(GRID_DURATION_SECONDS, event.time + duration)) * multiplier), end
      );
    } else {
      oscillator.frequency.setValueAtTime(frequency, at);
    }

    if (kind === "transformer") {
      const drive = Math.max(0.01, event.gridDrive ?? 2);
      const shaper = context.createWaveShaper();
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i++) {
        curve[i] = Math.tanh(drive * (i / 512 - 1)) / Math.tanh(drive);
      }
      shaper.curve = curve;
      shaper.oversample = "2x";
      oscillator.connect(shaper).connect(filter);
    } else {
      oscillator.connect(filter);
    }
  }

  filter.connect(gain).connect(pan).connect(destination);
  source.onended = () => {
    source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect();
    onEnded?.(source);
  };
  source.start(at);
  source.stop(end + (isNoise ? 0 : 0.015));
  return source;
}
