import { COMPOSITION_BARS, type Composition, type HarmonicFrame, type NoteEvent } from "./math";
export type SoundProfile = "hybrid-cinematic" | "natural" | "electronic";
export type InstrumentLevels = Record<keyof InstrumentSettings, number>;
export const DEFAULT_INSTRUMENT_LEVELS: InstrumentLevels = { piano: 0.9, analog: 0.72, plucked: 0.82, cinematicBass: 0.9, atmosphere: 0.72 };
export const DEFAULT_SOUND_PROFILE: SoundProfile = "hybrid-cinematic";

/** Fixed post-compressor gain: +14 dB = approximately 5.01x amplitude. */
export const MASTER_OUTPUT_BOOST_DB = 14;
export const MASTER_OUTPUT_BOOST = Math.pow(10, MASTER_OUTPUT_BOOST_DB / 20);

/**
 * Shared live/offline master chain. The boost is applied after compression so
 * the compressor cannot simply absorb the added gain; a fast final limiter
 * catches peaks before they reach the speakers or the WAV sample clamp.
 */
function connectMasterOutput(context: BaseAudioContext, master: GainNode) {
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.22;

  const outputGain = context.createGain();
  outputGain.gain.value = MASTER_OUTPUT_BOOST;

  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;

  master.connect(compressor).connect(outputGain).connect(limiter).connect(context.destination);
  return { compressor, outputGain, limiter };
}

export interface InstrumentSettings {
  piano: boolean;
  analog: boolean;
  plucked: boolean;
  cinematicBass: boolean;
  atmosphere: boolean;
}
export const DEFAULT_INSTRUMENTS: InstrumentSettings = {
  piano: true, analog: false, plucked: false, cinematicBass: true, atmosphere: true
};

export function hasDedicatedInstruments(instruments: InstrumentSettings): boolean {
  return Object.values(instruments).some(Boolean);
}

interface LeadGap {
  bar: number;
  start: number;
  end: number;
  source: NoteEvent;
}

/** Find real rests between melody notes, never inventing space by moving a note. */
function findLeadGaps(lead: NoteEvent[], duration: number, beat: number, minimumGapBeats: number): LeadGap[] {
  const barDuration = beat * 4;
  const ordered = [...lead].sort((a, b) => a.time - b.time);
  const gaps: LeadGap[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const source = ordered[index];
    const bar = Math.floor(source.time / barDuration);
    if (bar < 0 || bar >= COMPOSITION_BARS) continue;
    const barEnd = Math.min(duration, (bar + 1) * barDuration);
    const next = ordered[index + 1];
    const nextInBar = next && Math.floor(next.time / barDuration) === bar ? next.time : barEnd;
    const start = source.time + Math.max(0, source.duration);
    const end = Math.min(nextInBar, barEnd);
    if (end - start >= beat * minimumGapBeats) gaps.push({ bar, start, end, source });
  }
  return gaps;
}

function longestGapPerBar(gaps: LeadGap[]): Map<number, LeadGap> {
  const selected = new Map<number, LeadGap>();
  for (const gap of gaps) {
    const current = selected.get(gap.bar);
    if (!current || gap.end - gap.start > current.end - current.start) selected.set(gap.bar, gap);
  }
  return selected;
}

function chooseChordToneResponse(
  events: NoteEvent[],
  harmony: HarmonicFrame[] | undefined,
  time: number,
  beat: number,
  referenceFrequency: number,
  preferredRatio: number,
  fallbackSemitones: number
): number {
  const frame = harmonicFrameAt(harmony, time, beat * 0.5);
  const pool = frame
    ? [...frame.chordMidi, frame.colorMidi].flatMap(midi =>
        [-24, -12, 0, 12, 24, 36].map(octave => midiToFrequency(midi + octave))
      )
    : events
      .filter(event => event.voice === "pad" && event.time <= time && event.time + event.duration >= time)
      .flatMap(event => [event.frequency / 2, event.frequency, event.frequency * 2]);
  if (!pool.length) {
    return referenceFrequency * Math.pow(2, fallbackSemitones / 12);
  }
  const inRange = pool.filter(frequency =>
    frequency > referenceFrequency * 1.04 && frequency < referenceFrequency * 2.4
  );
  const candidates = inRange.length ? inRange : pool;
  const target = referenceFrequency * preferredRatio;
  return candidates.reduce((best, candidate) =>
    Math.abs(Math.log(candidate / target)) < Math.abs(Math.log(best / target)) ? candidate : best
  );
}

export function resolveInstrumentEvents(composition: Composition, instruments: InstrumentSettings): NoteEvent[] {
  // Shepard layers are already a complete, carefully balanced sound event.
  // Do not turn them into an ordinary ensemble or add sequence-derived bass/pads.
  if (composition.label === "shepard") {
    return composition.events
      .filter(event => event.voice === undefined)
      .map(event => ({ ...event }));
  }

  const events = [...composition.events];
  const lead = composition.events.filter(event => (event.voice ?? "lead") === "lead");
  if (!lead.length) return events;
  const beat = composition.duration / (COMPOSITION_BARS * 4);

  // Supporting melodic parts are composed from actual rests in the lead.
  // The conductor will later choose only a few of these candidates to perform.
  const answerGaps = longestGapPerBar(findLeadGaps(lead, composition.duration, beat, 0.38));
  if (instruments.plucked) {
    for (const [bar, gap] of answerGaps) {
      const gapLength = gap.end - gap.start;
      const margin = beat * 0.08;
      const time = gap.start + margin;
      const duration = Math.min(beat * 0.34, gap.end - margin - time);
      if (duration < beat * 0.2) continue;
      const fallbackInterval = bar % 2 === 0 ? 7 : 12;
      events.push({
        time, duration,
        frequency: chooseChordToneResponse(
          events, composition.harmony, time, beat, gap.source.frequency, 1.32, fallbackInterval
        ),
        velocity: Math.max(0.045, gap.source.velocity * 0.42),
        waveform: "triangle", pan: gap.source.pan * -0.8, voice: "answer"
      });
    }
  }

  // Analog is a rarer counterline: only long rests qualify, and only one
  // candidate is created per bar. Dense passages naturally leave it silent.
  const textureGaps = longestGapPerBar(findLeadGaps(lead, composition.duration, beat, 0.72));
  if (instruments.analog) {
    for (const [bar, gap] of textureGaps) {
      const margin = beat * 0.1;
      const time = gap.start + margin;
      const duration = Math.min(beat * 0.68, gap.end - margin - time);
      if (duration < beat * 0.38) continue;
      const fallbackInterval = bar % 2 === 0 ? 12 : 7;
      events.push({
        time, duration,
        frequency: chooseChordToneResponse(
          events, composition.harmony, time, beat, gap.source.frequency, 1.68, fallbackInterval
        ),
        velocity: Math.max(0.025, gap.source.velocity * 0.16),
        waveform: "sawtooth", pan: bar % 2 === 0 ? 0.24 : -0.24, voice: "texture"
      });
    }
  }

  const hasBass = events.some(event => event.voice === "bass");
  const hasPads = events.some(event => event.voice === "pad");

  // If arrangement is disabled, derive deterministic support notes from the
  // mathematical lead. Never substitute random pitches.
  if (instruments.cinematicBass && !hasBass) {
    for (let bar = 0; bar < COMPOSITION_BARS; bar++) {
      const time = bar * beat * 4;
      const frame = harmonicFrameAt(composition.harmony, time);
      const source = lead.reduce((best, event) =>
        Math.abs(event.time - time) < Math.abs(best.time - time) ? event : best, lead[0]);
      const fallbackMidi = Math.round(69 + 12 * Math.log2(source.frequency / 440));
      const bassMidi = frame
        ? (bar % 2 === 0 ? frame.rootMidi - 12 : (frame.chordMidi[2] ?? frame.rootMidi + 7) - 24)
        : fallbackMidi - 12;
      events.push({
        time, duration: beat * 1.65, frequency: midiToFrequency(bassMidi),
        velocity: Math.max(0.12, source.velocity * 0.42), waveform: "triangle",
        pan: -0.08, voice: "bass"
      });
    }
  }
  if (instruments.atmosphere && !hasPads) {
    if (composition.harmony?.length) {
      for (const frame of composition.harmony) {
        const source = lead.reduce((best, event) =>
          Math.abs(event.time - frame.start) < Math.abs(best.time - frame.start) ? event : best, lead[0]);
        const tones = [...frame.chordMidi, frame.colorMidi];
        const pans = [-0.3, 0, 0.3, 0.12];
        tones.forEach((midi, index) => events.push({
          time: frame.start,
          duration: (frame.end - frame.start) * 0.94,
          frequency: midiToFrequency(midi),
          velocity: Math.max(0.035, source.velocity * 0.12),
          waveform: "sine", pan: pans[index] ?? 0, voice: "pad"
        }));
      }
    } else {
      for (let section = 0; section < 4; section++) {
        const time = section * composition.duration / 4;
        const source = lead.reduce((best, event) =>
          Math.abs(event.time - time) < Math.abs(best.time - time) ? event : best, lead[0]);
        for (const [semitones, pan] of [[0, -0.3], [4, 0], [7, 0.3], [11, 0.12]] as const) {
          events.push({
            time, duration: composition.duration / 4 * 0.94,
            frequency: source.frequency * Math.pow(2, semitones / 12),
            velocity: Math.max(0.035, source.velocity * 0.12),
            waveform: "sine", pan, voice: "pad"
          });
        }
      }
    }
  }
  return events.sort((a, b) => a.time - b.time);
}

export type ConductorSection = "beginning" | "development" | "climax" | "ending";
export type ConductorRole = "answer" | "texture" | "bass" | "pad" | "percussion";

export interface ConductorPhraseAnalysis {
  phraseIndex: number;
  start: number;
  end: number;
  beats: number;
  leadNotes: number;
  density: number;
  meanVelocity: number;
  meanDurationBeats: number;
  gapRatio: number;
  longestGapBeats: number;
  offbeatRatio: number;
  energy: number;
  densityChange: number;
  energyChange: number;
}

export interface ConductorPhraseDecision {
  phraseIndex: number;
  section: ConductorSection;
  analysis: ConductorPhraseAnalysis;
  roles: ConductorRole[];
  summary: string;
}

const conductorClamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function getConductorSection(progress: number): ConductorSection {
  const phase = conductorClamp(progress, 0, 0.999999);
  if (phase < 0.25) return "beginning";
  if (phase < 0.5) return "development";
  if (phase < 0.75) return "climax";
  return "ending";
}

function eventBar(event: NoteEvent, barDuration: number): number {
  return Math.max(0, Math.min(COMPOSITION_BARS - 1, Math.floor(event.time / barDuration)));
}

function eventFitsLeadGap(event: NoteEvent, lead: NoteEvent[], duration: number, beat: number): boolean {
  const bar = eventBar(event, beat * 4);
  const gaps = findLeadGaps(
    lead.filter(note => eventBar(note, beat * 4) === bar),
    duration, beat, 0.12
  );
  const margin = beat * 0.035;
  return gaps.some(gap =>
    event.time >= gap.start + margin &&
    event.time + event.duration <= gap.end - margin
  );
}

function instrumentAvailable(voice: ConductorRole, instruments?: InstrumentSettings): boolean {
  if (!instruments) return true;
  if (voice === "answer") return instruments.plucked;
  if (voice === "texture") return instruments.analog;
  if (voice === "bass") return instruments.cinematicBass;
  if (voice === "pad") return instruments.atmosphere;
  return true;
}

function analyzeConductorPhrase(
  events: NoteEvent[],
  phraseIndex: number,
  start: number,
  end: number,
  beat: number,
  previousDensity: number | null,
  previousEnergy: number | null
): ConductorPhraseAnalysis {
  const lead = events
    .filter(event => (event.voice ?? "lead") === "lead")
    .sort((a, b) => a.time - b.time);
  const phraseLength = Math.max(0, end - start);
  const beats = phraseLength / Math.max(beat, 0.000001);
  const gaps: number[] = [];
  let occupiedUntil = start;

  for (const event of lead) {
    const noteStart = Math.max(start, event.time);
    const noteEnd = Math.min(end, event.time + Math.max(0, event.duration));
    if (noteStart > occupiedUntil) gaps.push(noteStart - occupiedUntil);
    occupiedUntil = Math.max(occupiedUntil, noteEnd);
  }
  if (occupiedUntil < end) gaps.push(end - occupiedUntil);

  const meanVelocity = lead.length
    ? lead.reduce((sum, event) => sum + event.velocity, 0) / lead.length
    : 0;
  const meanDurationBeats = lead.length
    ? lead.reduce((sum, event) => sum + event.duration / Math.max(beat, 0.000001), 0) / lead.length
    : 0;
  const density = lead.length / Math.max(1, beats);
  const gapRatio = phraseLength > 0
    ? conductorClamp(gaps.reduce((sum, gap) => sum + gap, 0) / phraseLength)
    : 0;
  const longestGapBeats = (gaps.length ? Math.max(...gaps) : 0) / Math.max(beat, 0.000001);
  const offbeatRatio = lead.length
    ? lead.filter(event => {
        const phase = ((event.time / beat) % 1 + 1) % 1;
        return phase > 0.12 && phase < 0.88;
      }).length / lead.length
    : 0;
  const energy = conductorClamp((conductorClamp(density / 1.8) * 0.55) + meanVelocity * 0.45);

  return {
    phraseIndex, start, end, beats, leadNotes: lead.length, density,
    meanVelocity, meanDurationBeats, gapRatio, longestGapBeats, offbeatRatio,
    energy,
    densityChange: previousDensity === null ? 0 : density - previousDensity,
    energyChange: previousEnergy === null ? 0 : energy - previousEnergy
  };
}

function scoreConductorRoles(
  events: NoteEvent[],
  lead: NoteEvent[],
  analysis: ConductorPhraseAnalysis,
  duration: number,
  beat: number,
  instruments: InstrumentSettings | undefined,
  previousRoles: ConductorRole[]
): ConductorRole[] {
  if (analysis.leadNotes === 0) return [];

  const has = (role: ConductorRole) => events.some(event => event.voice === role);
  const hasUsableAnswer = events.some(event =>
    event.voice === "answer" && eventFitsLeadGap(event, lead, duration, beat)
  );
  const hasUsableTexture = events.some(event =>
    event.voice === "texture" && eventFitsLeadGap(event, lead, duration, beat)
  );
  const openSpace = analysis.gapRatio;
  const lowDensity = 1 - conductorClamp(analysis.density / 1.6);
  const densityPressure = conductorClamp((analysis.density - 0.9) / 0.9);
  const longGap = conductorClamp(analysis.longestGapBeats / 1.5);
  const recovering = conductorClamp(-analysis.densityChange / 0.75);
  const building = conductorClamp(analysis.densityChange / 0.75);
  const structuralPhrase = analysis.phraseIndex % 2 === 0 ? 1 : 0;
  const middlePhrase = analysis.phraseIndex % 2 === 1 ? 1 : 0;

  const scores: Array<{ role: ConductorRole; score: number; threshold: number }> = [];
  const add = (role: ConductorRole, rawScore: number, threshold: number) => {
    if (!instrumentAvailable(role, instruments)) return;
    // Preserve continuity where the musical context still supports a role;
    // strong changes in density and available space can still replace it.
    const continuityBonus = previousRoles.includes(role)
      ? (role === "bass" || role === "percussion" ? 0.05 : 0.08)
      : 0;
    const score = rawScore + continuityBonus;
    if (score >= threshold) scores.push({ role, score, threshold });
  };

  if (has("bass")) {
    add("bass", 0.76 + 0.08 * (1 - openSpace) + 0.04 * lowDensity, 0.5);
  }
  if (has("pad")) {
    add("pad",
      0.18 + 0.45 * openSpace + 0.18 * longGap +
      0.18 * structuralPhrase - 0.32 * densityPressure,
      0.48
    );
  }
  if (hasUsableAnswer) {
    add("answer",
      0.16 + 0.5 * longGap + 0.22 * openSpace +
      0.12 * recovering - 0.26 * densityPressure,
      0.48
    );
  }
  if (hasUsableTexture) {
    const exceptionalSpace = conductorClamp((analysis.longestGapBeats - 1.4) / 0.8);
    add("texture",
      0.08 + 0.55 * conductorClamp((analysis.longestGapBeats - 0.7) / 1.2) +
      0.18 * openSpace + 0.1 * recovering + 0.16 * exceptionalSpace -
      0.28 * densityPressure,
      0.5
    );
  }
  if (has("percussion")) {
    const climaxPhrase = analysis.phraseIndex === 4 || analysis.phraseIndex === 5 ? 0.2 : 0;
    add("percussion",
      0.16 + 0.22 * analysis.energy + 0.18 * analysis.offbeatRatio +
      0.24 * building + 0.12 * middlePhrase + climaxPhrase - 0.24 * densityPressure,
      0.46
    );
  }

  const priority: Record<ConductorRole, number> = {
    bass: 0, pad: 1, answer: 2, texture: 3, percussion: 4
  };
  scores.sort((a, b) => b.score - a.score || priority[a.role] - priority[b.role]);

  const selected: ConductorRole[] = [];
  for (const candidate of scores) {
    if (selected.length >= 2) break;
    // Strings and analog counterlines compete for the same melodic space.
    if ((candidate.role === "answer" && selected.includes("texture")) ||
        (candidate.role === "texture" && selected.includes("answer"))) continue;
    selected.push(candidate.role);
  }
  return selected;
}

function selectConductorPhraseEvents(
  events: NoteEvent[],
  roles: ConductorRole[],
  analysis: ConductorPhraseAnalysis,
  duration: number,
  beat: number
): NoteEvent[] {
  const start = analysis.start;
  const end = analysis.end;
  const barDuration = beat * 4;
  const lead = events.filter(event => (event.voice ?? "lead") === "lead");
  const gaps = findLeadGaps(lead, duration, beat, 0.12);
  const selected: NoteEvent[] = [];
  const add = (event: NoteEvent | undefined) => {
    if (event && !selected.includes(event)) selected.push(event);
  };
  const gapLengthFor = (event: NoteEvent) => {
    const gap = gaps.find(candidate =>
      event.time >= candidate.start + beat * 0.035 &&
      event.time + event.duration <= candidate.end - beat * 0.035
    );
    return gap ? gap.end - gap.start : 0;
  };

  for (const role of roles) {
    const candidates = events.filter(event => event.voice === role).sort((a, b) => a.time - b.time);
    if (role === "bass") {
      const cadenceApproach = candidates.find(event =>
        event.duration < beat * 0.7 &&
        event.time >= end - beat * 0.8 &&
        !selected.includes(event)
      );
      const anchors = candidates.filter(event => {
        const offset = (event.time - start) % barDuration;
        return Math.min(Math.abs(offset), Math.abs(barDuration - offset)) <= beat * 0.12;
      });
      const anchorLimit = cadenceApproach && analysis.gapRatio > 0.2
        ? 1
        : analysis.density > 1.3 ? 1 : 2;
      anchors.slice(0, anchorLimit).forEach(add);
      if (!anchors.length) add(candidates[0]);
      if (cadenceApproach && selected.filter(event => event.voice === "bass").length < 2 &&
          analysis.gapRatio > 0.2) add(cadenceApproach);
    } else if (role === "pad") {
      const chord = candidates.filter(event => Math.abs(event.time - start) <= beat * 0.1);
      (chord.length ? chord : candidates.slice(0, 4)).slice(0, 4).forEach(add);
    } else if (role === "answer" || role === "texture") {
      const best = candidates
        .map(event => ({ event, gap: gapLengthFor(event) }))
        .filter(candidate => candidate.gap > 0)
        .sort((a, b) => b.gap - a.gap || a.event.time - b.event.time)[0];
      add(best?.event);
    } else if (role === "percussion") {
      const bassOwnsDownbeats = roles.includes("bass")
        ? candidatesForBassDownbeats(events, start, end, barDuration, beat)
        : [];
      const hits = candidates.filter(event => {
        const kind = event.percussionKind ?? "kick";
        if (kind === "kick" && bassOwnsDownbeats.some(time => Math.abs(time - event.time) <= beat * 0.12)) return false;
        if (kind === "hat" && (analysis.density > 1.2 || analysis.gapRatio < 0.32)) return false;
        if (kind === "snare" && analysis.density > 2.2) return false;
        return true;
      });
      const kick = hits.find(event => (event.percussionKind ?? "kick") === "kick");
      const snare = hits.find(event => event.percussionKind === "snare");
      const hat = hits.find(event => event.percussionKind === "hat");
      add(kick);
      if (snare && (!kick || snare.time - kick.time >= beat)) add(snare);
      else if (hat && analysis.gapRatio > 0.35) add(hat);
      if (selected.filter(event => event.voice === "percussion").length < 2 && hat &&
          analysis.gapRatio > 0.45 && analysis.density < 1.1) add(hat);
    }
  }
  return selected.sort((a, b) => a.time - b.time);
}

function candidatesForBassDownbeats(
  events: NoteEvent[],
  start: number,
  end: number,
  barDuration: number,
  beat: number
): number[] {
  return events
    .filter(event => event.voice === "bass" && event.time >= start && event.time < end)
    .filter(event => {
      const offset = (event.time - start) % barDuration;
      return Math.min(Math.abs(offset), Math.abs(barDuration - offset)) <= beat * 0.12;
    })
    .map(event => event.time);
}

function shapeConductedEvent(
  event: NoteEvent,
  analysis: ConductorPhraseAnalysis
): NoteEvent {
  const voice = event.voice ?? "lead";
  const roleGain: Record<string, number> = {
    lead: conductorClamp(0.92 + analysis.energy * 0.12 + analysis.energyChange * 0.04, 0.88, 1.08),
    bass: 0.88,
    pad: 0.72,
    answer: 0.82,
    texture: 0.68,
    percussion: 0.9
  };
  const phraseGain = roleGain[voice] ?? 1;
  const velocity = conductorClamp(event.velocity * phraseGain, 0.001, 1);
  const endVelocity = conductorClamp((event.velocityEnd ?? event.velocity) * phraseGain, 0.001, 1);
  return {
    ...event,
    velocity,
    ...(event.velocityEnd !== undefined || voice === "pad" ? { velocityEnd: endVelocity } : {})
  };
}

function conductPhrase(
  events: NoteEvent[],
  analysis: ConductorPhraseAnalysis,
  duration: number,
  beat: number,
  instruments: InstrumentSettings | undefined,
  previousRoles: ConductorRole[]
): { events: NoteEvent[]; decision: ConductorPhraseDecision } {
  const lead = events.filter(event => (event.voice ?? "lead") === "lead");
  const roles = scoreConductorRoles(events, lead, analysis, duration, beat, instruments, previousRoles);
  const supportEvents = selectConductorPhraseEvents(events, roles, analysis, duration, beat);
  const supportSet = new Set(supportEvents);
  const knownRoles = new Set(["answer", "texture", "bass", "pad", "percussion"]);
  const kept = events.filter(event => {
    const voice = event.voice ?? "lead";
    return voice === "lead" || supportSet.has(event) || !knownRoles.has(voice);
  });
  const names: Record<ConductorRole, string> = {
    answer: "Strings answer",
    texture: "Analog counterline",
    bass: "Bass anchors harmony",
    pad: "Pads frame the harmony",
    percussion: "Percussion marks the pulse"
  };
  const summary = roles.length
    ? "Piano leads · " + roles.map(role => names[role]).join(" · ")
    : "Piano alone · leave musical space";
  const decision: ConductorPhraseDecision = {
    phraseIndex: analysis.phraseIndex,
    section: getConductorSection((analysis.phraseIndex + 0.5) / (COMPOSITION_BARS / 2)),
    analysis,
    roles,
    summary
  };
  return {
    events: kept.map(event => shapeConductedEvent(event, analysis)).sort((a, b) => a.time - b.time),
    decision
  };
}

/**
 * Stateful, score-aware conductor. It analyzes and decides one two-bar phrase
 * at a time, carrying context forward from the previous phrase. Live playback
 * asks it for the next phrase just before that phrase begins; offline rendering
 * walks the same session from beginning to end for exact parity.
 */
export class AdaptiveConductorSession {
  private readonly phrases: NoteEvent[][];
  private readonly phraseDuration: number;
  private readonly phraseCount: number;
  private nextPhraseIndex = 0;
  private previousRoles: ConductorRole[] = [];
  private previousDensity: number | null = null;
  private previousEnergy: number | null = null;
  private readonly decisions: Array<ConductorPhraseDecision | null>;
  private readonly duration: number;
  private readonly beat: number;

  constructor(
    events: NoteEvent[],
    duration: number,
    private readonly instruments?: InstrumentSettings,
    private readonly enabled = true
  ) {
    this.duration = Math.max(0, duration);
    this.beat = this.duration / (COMPOSITION_BARS * 4);
    this.phraseCount = this.duration > 0 ? COMPOSITION_BARS / 2 : 0;
    this.phraseDuration = this.phraseCount ? this.duration / this.phraseCount : 0;
    this.phrases = Array.from({ length: this.phraseCount }, () => []);
    this.decisions = Array.from({ length: this.phraseCount }, () => null);
    for (const event of events) {
      if (!this.phraseCount) break;
      const index = Math.max(0, Math.min(this.phraseCount - 1, Math.floor(event.time / this.phraseDuration)));
      this.phrases[index].push(event);
    }
    this.phrases.forEach(phrase => phrase.sort((a, b) => a.time - b.time));
  }

  prepareThrough(time: number): NoteEvent[] {
    const prepared: NoteEvent[] = [];
    while (this.nextPhraseIndex < this.phraseCount) {
      const phraseIndex = this.nextPhraseIndex;
      const start = phraseIndex * this.phraseDuration;
      if (start > time + 0.000001) break;
      const end = phraseIndex === this.phraseCount - 1
        ? this.duration
        : (phraseIndex + 1) * this.phraseDuration;
      const phraseEvents = this.phrases[phraseIndex];
      const analysis = analyzeConductorPhrase(
        phraseEvents, phraseIndex, start, end, this.beat,
        this.previousDensity, this.previousEnergy
      );

      if (this.enabled) {
        const conducted = conductPhrase(
          phraseEvents, analysis, this.duration, this.beat,
          this.instruments, this.previousRoles
        );
        prepared.push(...conducted.events);
        this.decisions[phraseIndex] = conducted.decision;
        this.previousRoles = [...conducted.decision.roles];
      } else {
        this.decisions[phraseIndex] = {
          phraseIndex,
          section: getConductorSection((phraseIndex + 0.5) / this.phraseCount),
          analysis,
          roles: [],
          summary: "Conductor bypassed"
        };
        prepared.push(...phraseEvents.map(event => ({ ...event })));
        this.previousRoles = [];
      }

      this.previousDensity = analysis.density;
      this.previousEnergy = analysis.energy;
      this.nextPhraseIndex++;
    }
    return prepared.sort((a, b) => a.time - b.time);
  }

  prepareAll(): NoteEvent[] {
    return this.prepareThrough(Number.POSITIVE_INFINITY);
  }

  getDecision(phraseIndex: number): ConductorPhraseDecision | null {
    return this.decisions[phraseIndex] ?? null;
  }
}

function createConductorSession(
  composition: Composition,
  instruments: InstrumentSettings,
  conductorEnabled: boolean
): AdaptiveConductorSession {
  const resolved = resolveInstrumentEvents(composition, instruments);
  const available = hasDedicatedInstruments(instruments) ? instruments : undefined;
  const enabled = conductorEnabled && composition.label !== "shepard";
  return new AdaptiveConductorSession(resolved, composition.duration, available, enabled);
}

export function applyEnsembleConductor(
  events: NoteEvent[],
  duration: number,
  enabled = true,
  instruments?: InstrumentSettings
): NoteEvent[] {
  return new AdaptiveConductorSession(events, duration, instruments, enabled).prepareAll();
}

export function preparePlaybackEvents(
  composition: Composition,
  instruments: InstrumentSettings,
  conductorEnabled = true
): NoteEvent[] {
  return createConductorSession(composition, instruments, conductorEnabled).prepareAll();
}

function scheduleInstrumentLayer(
  context: BaseAudioContext,
  event: NoteEvent,
  instrument: keyof InstrumentSettings,
  atTime: number,
  destination: AudioNode,
  onEnded?: (source: AudioScheduledSourceNode) => void,
  profile: SoundProfile = DEFAULT_SOUND_PROFILE,
  level = 1
): AudioScheduledSourceNode | null {
  const voice = event.voice ?? "lead";
  if (instrument === "piano" && voice !== "lead") return null;
  if (instrument === "plucked" && voice !== "answer") return null;
  if (instrument === "analog" && voice !== "texture") return null;
  if (instrument === "cinematicBass" && voice !== "bass") return null;
  if (instrument === "atmosphere" && voice !== "pad") return null;
  const at = Math.max(0, atTime);
  const end = at + Math.max(0.08, event.duration);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const pan = context.createStereoPanner();
  const peak = Math.max(0.0001, event.velocity * Math.max(0, Math.min(1.5, level)));
  const peakEnd = Math.max(0.0001, (event.velocityEnd ?? event.velocity) * Math.max(0, Math.min(1.5, level)));
  oscillator.frequency.setValueAtTime(event.frequency, at);
  const natural = profile === "natural";
  const electronic = profile === "electronic";
  filter.type = "lowpass";
  pan.pan.setValueAtTime(event.pan, at);

  if (instrument === "piano") {
    if (profile === "hybrid-cinematic") {
      const real = new Float32Array([0, 1, 0.42, 0.2, 0.11, 0.055, 0.025]);
      const imag = new Float32Array(real.length);
      oscillator.setPeriodicWave(context.createPeriodicWave(real, imag, { disableNormalization: false }));
    } else {
      oscillator.type = natural ? "triangle" : "sine";
    }
    filter.frequency.setValueAtTime(natural ? 6800 : electronic ? 4200 : 5200, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * (natural ? 0.48 : 0.38), at + 0.004);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * (electronic ? 0.13 : 0.035)), Math.min(end - 0.015, at + (natural ? 0.55 : 0.28)));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  } else if (instrument === "analog") {
    oscillator.type = natural ? "triangle" : "sawtooth";
    oscillator.detune.setValueAtTime(electronic ? -13 : -5, at);
    filter.frequency.setValueAtTime(natural ? 1500 : electronic ? 3200 : 2100, at);
    filter.frequency.exponentialRampToValueAtTime(natural ? 850 : electronic ? 1250 : 980, Math.max(at + 0.08, end - 0.04));
    filter.Q.setValueAtTime(electronic ? 4.2 : natural ? 0.8 : 2.2, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * (electronic ? 0.22 : natural ? 0.12 : 0.17), at + 0.045);
    gain.gain.linearRampToValueAtTime(peakEnd * 0.17, Math.max(at + 0.06, end - 0.09));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  } else if (instrument === "plucked") {
    if (profile === "hybrid-cinematic") {
      const real = new Float32Array([0, 1, 0.25, 0.12, 0.06, 0.025]);
      oscillator.setPeriodicWave(context.createPeriodicWave(real, new Float32Array(real.length)));
    } else {
      oscillator.type = natural ? "sine" : "triangle";
    }
    filter.frequency.setValueAtTime(natural ? 2600 : electronic ? 5200 : 3600, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * (natural ? 0.3 : 0.42), at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(at + 0.07, Math.min(end, at + (electronic ? 0.7 : natural ? 0.34 : 0.48))));
  } else if (instrument === "cinematicBass") {
    oscillator.type = electronic ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(event.frequency * (electronic ? 0.25 : 0.5), at);
    oscillator.frequency.exponentialRampToValueAtTime(event.frequency * (electronic ? 0.23 : 0.46), at + 0.12);
    filter.frequency.setValueAtTime(electronic ? 230 : natural ? 110 : 145, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * (electronic ? 0.68 : natural ? 0.48 : 0.58), at + 0.035);
    gain.gain.linearRampToValueAtTime(peakEnd * 0.58, Math.max(at + 0.05, end - 0.12));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    oscillator.type = electronic ? "sawtooth" : "sine";
    oscillator.detune.setValueAtTime(electronic ? -15 : natural ? -3 : -8, at);
    filter.frequency.setValueAtTime(electronic ? 2600 : natural ? 1200 : 1800, at);
    filter.frequency.linearRampToValueAtTime(electronic ? 3400 : natural ? 900 : 1450, end);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak * (electronic ? 0.28 : natural ? 0.16 : 0.22), at + Math.min(0.8, event.duration * 0.45));
    gain.gain.linearRampToValueAtTime(peakEnd * 0.22, Math.max(at + 0.05, end - 0.45));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  oscillator.connect(filter).connect(gain).connect(pan).connect(destination);
  oscillator.onended = () => {
    oscillator.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect();
    onEnded?.(oscillator);
  };
  oscillator.start(at);
  oscillator.stop(end + 0.025);
  return oscillator;
}

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
  private playbackEvents: NoteEvent[] = [];
  private conductorSession: AdaptiveConductorSession | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private outputGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private instruments: InstrumentSettings = { ...DEFAULT_INSTRUMENTS };
  private profile: SoundProfile = DEFAULT_SOUND_PROFILE;
  private levels: InstrumentLevels = { ...DEFAULT_INSTRUMENT_LEVELS };
  private conductorEnabled = true;
  async play(composition: Composition, volume = 1.15, instruments: InstrumentSettings = DEFAULT_INSTRUMENTS, profile: SoundProfile = DEFAULT_SOUND_PROFILE, levels: InstrumentLevels = DEFAULT_INSTRUMENT_LEVELS, conductorEnabled = true): Promise<void> {
    this.stop();
    const Context = window.AudioContext;
    this.context ??= new Context();
    if (this.context.state === "suspended") await this.context.resume();
    const ctx = this.context;
    this.composition = composition;
    this.instruments = { ...instruments };
    this.profile = profile;
    this.levels = { ...levels };
    this.conductorEnabled = conductorEnabled;
    this.resetConductorSession();
    this.master = ctx.createGain();
    this.master.gain.value = Math.max(0, Math.min(1.5, volume));
    const output = connectMasterOutput(ctx, this.master);
    this.compressor = output.compressor;
    this.outputGain = output.outputGain;
    this.limiter = output.limiter;
    this.cycleStart = ctx.currentTime + 0.08;
    this.cursor = 0;
    this.playing = true;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 35);
  }
  private resetConductorSession(): void {
    const composition = this.composition;
    if (!composition) {
      this.conductorSession = null;
      this.playbackEvents = [];
      this.cursor = 0;
      return;
    }
    const resolved = resolveInstrumentEvents(composition, this.instruments);
    const available = hasDedicatedInstruments(this.instruments) ? this.instruments : undefined;
    const enabled = this.conductorEnabled && composition.label !== "shepard";
    this.conductorSession = new AdaptiveConductorSession(
      resolved, composition.duration, available, enabled
    );
    this.playbackEvents = [];
    this.cursor = 0;
  }
  private schedule(): void {
    const ctx = this.context, comp = this.composition;
    if (!ctx || !comp || !this.playing) return;
    const horizon = ctx.currentTime + 0.18;
    while (this.cycleStart + comp.duration < ctx.currentTime - 0.5) {
      this.cycleStart += comp.duration;
      this.resetConductorSession();
    }
    const elapsedHorizon = Math.max(0, horizon - this.cycleStart);
    const nextPhraseEvents = this.conductorSession?.prepareThrough(elapsedHorizon) ?? [];
    if (nextPhraseEvents.length) this.playbackEvents.push(...nextPhraseEvents);
    while (this.cursor < this.playbackEvents.length) {
      const event = this.playbackEvents[this.cursor];
      const at = this.cycleStart + event.time;
      if (at > horizon) break;
      if (at >= ctx.currentTime - 0.03) this.playNote(event, at);
      this.cursor++;
    }
    if (this.cursor >= this.playbackEvents.length && ctx.currentTime >= this.cycleStart + comp.duration - 0.18) {
      this.cycleStart += comp.duration;
      this.resetConductorSession();
    }
  }
  private playNote(event: NoteEvent, at: number): void {
    const ctx = this.context, master = this.master;
    if (!ctx || !master || this.active.size >= 64) return;
    if (event.voice === "percussion") {
      let drum!: AudioScheduledSourceNode;
      drum = schedulePercussion(ctx, event, at, master, () => this.active.delete(drum));
      this.active.add(drum);
      return;
    }
    const dedicatedEnabled = hasDedicatedInstruments(this.instruments);
    for (const instrument of Object.keys(this.instruments) as (keyof InstrumentSettings)[]) {
      if (!this.instruments[instrument] || this.active.size >= 64) continue;
      let layer!: AudioScheduledSourceNode;
      const scheduled = scheduleInstrumentLayer(ctx, event, instrument, at, master, source => this.active.delete(source), this.profile, this.levels[instrument]);
      if (scheduled) { layer = scheduled; this.active.add(layer); }
    }
    if (dedicatedEnabled) return;
    const osc = ctx.createOscillator();
    const rich = this.composition?.richInstruments ?? true;
    const shimmer = rich && (event.voice ?? "lead") === "lead" ? ctx.createOscillator() : null;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const pan = ctx.createStereoPanner();
    const voice = event.voice ?? "lead";
    const peak = Math.max(0.0002, event.velocity);
    const peakEnd = Math.max(0.0002, event.velocityEnd ?? event.velocity);
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
    gain.gain.linearRampToValueAtTime(peakEnd, holdEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + event.duration);
    pan.pan.setValueAtTime(event.pan, at);
    osc.connect(filter).connect(gain).connect(pan).connect(master);
    this.active.add(osc);
    osc.onended = () => { this.active.delete(osc); osc.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
    osc.start(at);
    osc.stop(at + event.duration + 0.03);
  }
  update(composition: Composition, volume = 1.15, instruments: InstrumentSettings = this.instruments, profile: SoundProfile = this.profile, levels: InstrumentLevels = this.levels, conductorEnabled = this.conductorEnabled): void {
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
    this.instruments = { ...instruments };
    this.profile = profile;
    this.levels = { ...levels };
    this.conductorEnabled = conductorEnabled;
    this.resetConductorSession();
    this.cycleStart = now - phase * composition.duration;
    const elapsedInCycle = phase * composition.duration;
    this.playbackEvents = this.conductorSession?.prepareThrough(elapsedInCycle + 0.18) ?? [];
    this.cursor = this.playbackEvents.findIndex(event => event.time >= elapsedInCycle + 0.025);
    if (this.cursor < 0) this.cursor = this.playbackEvents.length;
    this.schedule();
    window.setTimeout(() => oldMaster?.disconnect(), 220);
  }
  setVolume(volume: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1.5, volume)), now, 0.025);
  }
  getCurrentConductorDecision(): ConductorPhraseDecision | null {
    if (!this.composition || this.composition.label === "shepard") return null;
    const phraseIndex = Math.min(COMPOSITION_BARS / 2 - 1, Math.floor(this.getProgress() * (COMPOSITION_BARS / 2)));
    return this.conductorSession?.getDecision(phraseIndex) ?? null;
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
    this.conductorSession = null;
    this.playbackEvents = [];
    this.cursor = 0;
    const oldMaster = this.master;
    oldMaster?.gain.setTargetAtTime(0, now, 0.025);
    this.master = null;
    const compressor = this.compressor;
    const outputGain = this.outputGain;
    const limiter = this.limiter;
    this.compressor = null;
    this.outputGain = null;
    this.limiter = null;
    window.setTimeout(() => {
      oldMaster?.disconnect();
      compressor?.disconnect();
      outputGain?.disconnect();
      limiter?.disconnect();
    }, 100);
  }
  get isPlaying(): boolean { return this.playing; }
}

export async function renderCompositionWav(composition: Composition, volume = 1.15, instruments: InstrumentSettings = DEFAULT_INSTRUMENTS, profile: SoundProfile = DEFAULT_SOUND_PROFILE, levels: InstrumentLevels = DEFAULT_INSTRUMENT_LEVELS, conductorEnabled = true): Promise<Blob> {
  const sampleRate = 44100;
  const tailSeconds = 1.25;
  const frameCount = Math.ceil((composition.duration + tailSeconds) * sampleRate);
  const offline = new OfflineAudioContext(2, frameCount, sampleRate);
  const master = offline.createGain();
  master.gain.value = Math.max(0, Math.min(1.5, volume));
  connectMasterOutput(offline, master);

  const dedicatedEnabled = Object.values(instruments).some(Boolean);
  const playbackEvents = preparePlaybackEvents(composition, instruments, conductorEnabled);
  for (const event of playbackEvents) {
    const voice = event.voice ?? "lead";
    const at = Math.max(0, event.time);
    const end = Math.min(composition.duration + tailSeconds, at + Math.max(0.04, event.duration));
    const duration = end - at;
    if (duration <= 0) continue;
    if (event.voice === "percussion") {
      schedulePercussion(offline, event, at, master);
      continue;
    }
    for (const instrument of Object.keys(instruments) as (keyof InstrumentSettings)[]) {
      if (instruments[instrument]) scheduleInstrumentLayer(offline, event, instrument, at, master, undefined, profile, levels[instrument]);
    }
    if (dedicatedEnabled) continue;
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
    const peakEnd = Math.max(0.0002, event.velocityEnd ?? event.velocity);
    const holdEnd = Math.max(at + attack + 0.02, end - release);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.linearRampToValueAtTime(peakEnd, holdEnd);
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
