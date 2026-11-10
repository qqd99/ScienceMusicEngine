#ifndef SCIENCE_MUSIC_SCIENTIFIC_SIGNAL_C_H
#define SCIENCE_MUSIC_SCIENTIFIC_SIGNAL_C_H
#include "science_music/intelligence_c.h"
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
enum {
    SME_SIGNAL_SUMMARY_STRIDE = 11,
    SME_SIGNAL_FRAME_STRIDE = 10,
    SME_SIGNAL_RELATIONSHIP_STRIDE = 6,
    SME_SIGNAL_MAX_CHANNELS = 32,
    SME_SIGNAL_MAX_TOTAL_SAMPLES = 1000000,
    SME_SIGNAL_MAX_FRAMES = 256
};
/*
 * Input is a channel-major sample matrix. Summary records (11 doubles):
 * mean, min, max, RMS, standard deviation, trend/sample, mean absolute delta,
 * zero-crossing rate, dominant period in samples, periodicity strength,
 * dominant frequency Hz (zero if the physical sample clock is unknown).
 * Frame records (10 doubles): channel, start/end sample, start/end fraction,
 * mean, RMS, activity, trend, peak-to-peak.
 * Pair records (6 doubles): channel A/B, zero-lag correlation, signed lag,
 * phase degrees (B relative to A), phase confidence.
 * Capacities count records. Query counts with null buffers/capacity zero.
 * Insufficient capacity returns SME_BUFFER_TOO_SMALL without partial writes.
 */
int sme_analyze_signal_packed(
    const double* channel_major_samples, uint32_t sample_count,
    uint32_t channel_count, double sample_rate_hz, uint32_t frame_count,
    double* output_summaries, uint32_t summary_capacity,
    double* output_frames, uint32_t frame_capacity,
    double* output_relationships, uint32_t relationship_capacity,
    uint32_t* output_summary_count, uint32_t* output_frame_count,
    uint32_t* output_relationship_count
);
#ifdef __cplusplus
}
#endif
#endif
