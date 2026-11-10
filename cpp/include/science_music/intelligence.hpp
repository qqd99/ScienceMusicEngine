#pragma once
#include <array>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace science_music {
constexpr int kCompositionBars = 16;
constexpr int kHarmonicSections = 8;

enum class NoteCollection { WhiteKey = 0, BlackKey = 1 };
enum class TonalMode { Major = 0, Minor = 1 };
enum class Movement { Opening = 0, Development = 1, Climax = 2, Reprise = 3 };
enum class InstrumentRole { Lead = 0, Bass = 1, Pad = 2, Plucked = 3, Analog = 4, Percussion = 5 };

struct GenerationOptions {
    std::uint64_t seed = 314159;
    int bpm = 128;
    NoteCollection collection = NoteCollection::WhiteKey;
    std::optional<int> root_pitch_class;
    std::optional<TonalMode> mode;
    bool enable_bass = true;
    bool enable_pad = true;
    bool enable_plucked = true;
    bool enable_analog = true;
    bool enable_percussion = true;
};

struct TonalContext {
    int root_pitch_class = 0;
    int root_midi = 60;
    NoteCollection collection = NoteCollection::WhiteKey;
    TonalMode mode = TonalMode::Major;
    std::vector<int> scale_intervals;
    double confidence = 0.0;
    bool center_was_manual = false;
    bool mode_was_manual = false;
};

struct SourceProfile {
    double mean = 0.5;
    double trend = 0.0;
    double movement = 0.0;
    double centroid = 0.5;
    double energy = 0.0;
    double rms = 0.0;
    double activity = 0.0;
    double zero_crossing_rate = 0.0;
    std::uint32_t dominant_period_samples = 0;
    double periodicity_strength = 0.0;
};

struct Motif { std::array<int, 4> degrees{{0, 2, 4, 2}}; };

struct MotifTransformations {
    std::array<int, 4> inversion{{0, 0, 0, 0}};
    std::array<int, 4> retrograde{{0, 0, 0, 0}};
    std::array<int, 4> sequence{{0, 0, 0, 0}};
};

struct HarmonicFrame {
    int section = 0;
    double start_beat = 0.0;
    double duration_beats = 8.0;
    int degree = 0;
    int root_midi = 60;
    std::array<int, 3> chord_midi{{72, 76, 79}};
    int color_midi = 81;
    double tension = 0.0;
};

struct PhrasePlan {
    int index = 0;
    int start_bar = 0;
    int bars = 2;
    Movement movement = Movement::Opening;
    SourceProfile source;
    double energy = 0.0;
    double lead_density = 0.0;
    double longest_gap_beats = 0.0;
    std::vector<InstrumentRole> active_support;
};

struct MusicalEvent {
    double start_beat = 0.0;
    double duration_beats = 0.0;
    int midi_pitch = 60;
    double velocity = 0.0;
    double pan = 0.0;
    InstrumentRole role = InstrumentRole::Lead;
    int phrase_index = 0;
    bool accent = false;
};

struct CompositionPlan {
    int bpm = 128;
    int bars = kCompositionBars;
    std::uint64_t seed = 314159;
    std::vector<double> source_values;
    TonalContext tonality;
    Motif motif;
    MotifTransformations motif_transformations;
    std::array<int, kHarmonicSections> harmonic_progression{};
    std::vector<SourceProfile> section_profiles;
    std::vector<HarmonicFrame> harmony;
    std::vector<PhrasePlan> phrases;
    std::vector<MusicalEvent> events;
};

class IntelligenceEngine {
public:
    CompositionPlan generate(
        const std::vector<double>& source_values,
        const GenerationOptions& options = {}
    ) const;
};

std::string to_string(NoteCollection collection);
std::string to_string(TonalMode mode);
std::string to_string(Movement movement);
std::string to_string(InstrumentRole role);
} // namespace science_music
