#include "science_music/scientific_signal_c.h"
#include "science_music/scientific_signal.hpp"
#include <cmath>
#include <stdexcept>
namespace {
void write_summary(double* o,const science_music::SignalChannelSummary& s) {
    o[0]=s.mean;o[1]=s.minimum;o[2]=s.maximum;o[3]=s.rms;o[4]=s.standard_deviation;
    o[5]=s.trend_per_sample;o[6]=s.mean_absolute_delta;o[7]=s.zero_crossing_rate;
    o[8]=s.dominant_period_samples;o[9]=s.periodicity_strength;o[10]=s.dominant_frequency_hz;
}
}
extern "C" int sme_analyze_signal_packed(
    const double* samples,uint32_t sample_count,uint32_t channel_count,double sample_rate_hz,
    uint32_t frame_count,double* summaries,uint32_t summary_capacity,double* frames,
    uint32_t frame_capacity,double* relationships,uint32_t relationship_capacity,
    uint32_t* summary_count,uint32_t* frame_result_count,uint32_t* relationship_count) {
    if(!summary_count||!frame_result_count||!relationship_count)return SME_INVALID_ARGUMENT;
    *summary_count=0;*frame_result_count=0;*relationship_count=0;
    if(!samples||sample_count<2||!channel_count||channel_count>SME_SIGNAL_MAX_CHANNELS||
       static_cast<uint64_t>(sample_count)*channel_count>SME_SIGNAL_MAX_TOTAL_SAMPLES||
       !frame_count||frame_count>SME_SIGNAL_MAX_FRAMES||frame_count>sample_count||
       !std::isfinite(sample_rate_hz)||sample_rate_hz<0.0||sample_rate_hz>1e9||
       (summary_capacity&&!summaries)||(frame_capacity&&!frames)||
       (relationship_capacity&&!relationships))return SME_INVALID_ARGUMENT;
    try {
        science_music::ScientificSignal input;input.sample_rate_hz=sample_rate_hz;
        input.channels.reserve(channel_count);
        for(uint32_t c=0;c<channel_count;++c) {
            const double* first=samples+static_cast<std::size_t>(c)*sample_count;
            input.channels.emplace_back(first,first+sample_count);
        }
        science_music::SignalAnalysisOptions options;options.frame_count=frame_count;
        const auto result=science_music::ScientificSignalAnalyzer{}.analyze(input,options);
        const uint32_t needSummary=channel_count,needFrames=channel_count*frame_count;
        const uint32_t needRelationships=channel_count*(channel_count-1U)/2U;
        *summary_count=needSummary;*frame_result_count=needFrames;*relationship_count=needRelationships;
        if(summary_capacity<needSummary||frame_capacity<needFrames||
           relationship_capacity<needRelationships)return SME_BUFFER_TOO_SMALL;
        if(!summaries||!frames||(needRelationships&&!relationships))return SME_INVALID_ARGUMENT;
        for(std::size_t i=0;i<result.channels.size();++i)
            write_summary(summaries+i*SME_SIGNAL_SUMMARY_STRIDE,result.channels[i]);
        for(std::size_t i=0;i<result.frames.size();++i) {
            const auto& f=result.frames[i];double* o=frames+i*SME_SIGNAL_FRAME_STRIDE;
            o[0]=f.channel_index;o[1]=f.start_sample;o[2]=f.end_sample;o[3]=f.start_fraction;
            o[4]=f.end_fraction;o[5]=f.mean;o[6]=f.rms;o[7]=f.activity;o[8]=f.trend;o[9]=f.peak_to_peak;
        }
        for(std::size_t i=0;i<result.relationships.size();++i) {
            const auto& r=result.relationships[i];double* o=relationships+i*SME_SIGNAL_RELATIONSHIP_STRIDE;
            o[0]=r.channel_a;o[1]=r.channel_b;o[2]=r.zero_lag_correlation;
            o[3]=r.lag_samples;o[4]=r.phase_degrees;o[5]=r.confidence;
        }
        return SME_OK;
    } catch(const std::invalid_argument&) { return SME_INVALID_ARGUMENT; }
      catch(...) { return SME_INTERNAL_ERROR; }
}
