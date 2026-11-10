export interface ScientificSignalChannelInput {
  id: string;
  unit?: string;
  samples: readonly number[];
}
export interface ScientificSignalInput {
  channels: readonly ScientificSignalChannelInput[];
  /** Zero means the physical sample clock is unknown. */
  sampleRateHz?: number;
}
export interface SignalChannelSummary {
  channelId: string;
  unit: string;
  mean: number;
  minimum: number;
  maximum: number;
  rms: number;
  standardDeviation: number;
  trendPerSample: number;
  meanAbsoluteDelta: number;
  zeroCrossingRate: number;
  dominantPeriodSamples: number;
  periodicityStrength: number;
  dominantFrequencyHz: number;
}
export interface SignalFeatureFrame {
  channelId: string;
  startSample: number;
  endSample: number;
  startFraction: number;
  endFraction: number;
  mean: number;
  rms: number;
  activity: number;
  trend: number;
  peakToPeak: number;
}
export interface SignalRelationship {
  channelA: string;
  channelB: string;
  zeroLagCorrelation: number;
  lagSamples: number;
  phaseDegrees: number;
  confidence: number;
}
export interface ScientificSignalAnalysis {
  sampleCount: number;
  sampleRateHz: number;
  channels: SignalChannelSummary[];
  frames: SignalFeatureFrame[];
  relationships: SignalRelationship[];
}
const SUMMARY_STRIDE=11, FRAME_STRIDE=10, RELATIONSHIP_STRIDE=6;
function finite(values:ArrayLike<number>,label:string):void {
  for(let i=0;i<values.length;i++) if(!Number.isFinite(values[i]))
    throw new TypeError(label+" contains a non-finite value.");
}
/** Pure mapping from the packed C++ signal-analysis ABI to typed browser data. */
export function mapPackedScientificSignal(
  summaries:ArrayLike<number>,frames:ArrayLike<number>,relationships:ArrayLike<number>,
  channels:readonly Pick<ScientificSignalChannelInput,"id"|"unit">[],
  sampleCount:number,sampleRateHz:number
):ScientificSignalAnalysis {
  if(!Number.isInteger(sampleCount)||sampleCount<2)throw new RangeError("Signal sample count must be at least two.");
  if(!Number.isFinite(sampleRateHz)||sampleRateHz<0)throw new RangeError("Signal sample rate must be zero or finite.");
  if(channels.length<1||channels.length>32)throw new RangeError("Signal analysis requires one to 32 channels.");
  if(new Set(channels.map(c=>c.id)).size!==channels.length||channels.some(c=>!c.id.trim()))
    throw new TypeError("Signal channel IDs must be non-empty and unique.");
  if(summaries.length!==channels.length*SUMMARY_STRIDE||
     frames.length%FRAME_STRIDE!==0||relationships.length%RELATIONSHIP_STRIDE!==0)
    throw new TypeError("Packed signal analysis has an invalid record length.");
  finite(summaries,"Packed summaries");finite(frames,"Packed frames");finite(relationships,"Packed relationships");
  if((frames.length/FRAME_STRIDE)%channels.length!==0||
     relationships.length/RELATIONSHIP_STRIDE!==channels.length*(channels.length-1)/2)
    throw new TypeError("Packed signal record counts are inconsistent.");

  const channelSummaries=channels.map((channel,index)=>{
    const o=index*SUMMARY_STRIDE,period=summaries[o+8],strength=summaries[o+9],frequency=summaries[o+10];
    if(!Number.isInteger(period)||period<0||strength<0||strength>1||frequency<0)
      throw new TypeError("Packed signal summary contains an invalid metric.");
    return {
      channelId:channel.id,unit:channel.unit??"",mean:summaries[o],minimum:summaries[o+1],
      maximum:summaries[o+2],rms:summaries[o+3],standardDeviation:summaries[o+4],
      trendPerSample:summaries[o+5],meanAbsoluteDelta:summaries[o+6],
      zeroCrossingRate:summaries[o+7],dominantPeriodSamples:period,
      periodicityStrength:strength,dominantFrequencyHz:frequency
    };
  });
  const featureFrames:SignalFeatureFrame[]=[];
  for(let o=0;o<frames.length;o+=FRAME_STRIDE) {
    const channel=frames[o],start=frames[o+1],end=frames[o+2],from=frames[o+3],to=frames[o+4];
    if(!Number.isInteger(channel)||channel<0||channel>=channels.length||
       !Number.isInteger(start)||!Number.isInteger(end)||start<0||end>sampleCount||start>=end||
       from<0||to>1||from>=to)
      throw new TypeError("Packed signal frame contains an invalid timeline range.");
    featureFrames.push({
      channelId:channels[channel].id,startSample:start,endSample:end,
      startFraction:from,endFraction:to,mean:frames[o+5],rms:frames[o+6],
      activity:frames[o+7],trend:frames[o+8],peakToPeak:frames[o+9]
    });
  }
  const relations:SignalRelationship[]=[];
  for(let o=0;o<relationships.length;o+=RELATIONSHIP_STRIDE) {
    const a=relationships[o],b=relationships[o+1],confidence=relationships[o+5];
    if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<=a||b>=channels.length||
       confidence<0||confidence>1)
      throw new TypeError("Packed signal relationship contains an invalid channel pair.");
    relations.push({
      channelA:channels[a].id,channelB:channels[b].id,
      zeroLagCorrelation:relationships[o+2],lagSamples:relationships[o+3],
      phaseDegrees:relationships[o+4],confidence
    });
  }
  return {sampleCount,sampleRateHz,channels:channelSummaries,frames:featureFrames,relationships:relations};
}
