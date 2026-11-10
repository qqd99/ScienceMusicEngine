#pragma once
#include <cstdint>
#include <vector>
namespace science_music {
struct ScientificSignal {
    double sample_rate_hz = 0.0; // Zero means the physical sample clock is unknown.
    std::vector<std::vector<double>> channels; // Channel-major, equal-length sample arrays.
};
struct SignalChannelSummary {
    double mean = 0.0, minimum = 0.0, maximum = 0.0, rms = 0.0;
    double standard_deviation = 0.0, trend_per_sample = 0.0;
    double mean_absolute_delta = 0.0, zero_crossing_rate = 0.0;
    std::uint32_t dominant_period_samples = 0;
    double periodicity_strength = 0.0, dominant_frequency_hz = 0.0;
};
struct SignalFeatureFrame {
    std::uint32_t channel_index = 0, start_sample = 0, end_sample = 0;
    double start_fraction = 0.0, end_fraction = 1.0;
    double mean = 0.0, rms = 0.0, activity = 0.0, trend = 0.0, peak_to_peak = 0.0;
};
struct SignalRelationship {
    std::uint32_t channel_a = 0, channel_b = 0;
    double zero_lag_correlation = 0.0, lag_samples = 0.0;
    double phase_degrees = 0.0, confidence = 0.0;
};
struct SignalAnalysis {
    std::uint32_t sample_count = 0;
    double sample_rate_hz = 0.0;
    std::vector<SignalChannelSummary> channels;
    std::vector<SignalFeatureFrame> frames; // Channel-major, then ascending time.
    std::vector<SignalRelationship> relationships;
};
struct SignalAnalysisOptions { std::uint32_t frame_count = 16; };
class ScientificSignalAnalyzer {
public:
    SignalAnalysis analyze(const ScientificSignal& signal,
                           const SignalAnalysisOptions& options = {}) const;
};
} // namespace science_music
