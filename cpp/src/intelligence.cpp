#include "science_music/intelligence.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <stdexcept>
#include <utility>

namespace science_music {
namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kGoldenAngle = 2.399963229728653;

double clamp01(double value) {
    return std::isfinite(value) ? std::clamp(value, 0.0, 1.0) : 0.5;
}

int wrap(int value, int length) {
    const int remainder = value % length;
    return remainder < 0 ? remainder + length : remainder;
}

double mean_of(const std::vector<double>& values) {
    if (values.empty()) return 0.5;
    return std::accumulate(values.begin(), values.end(), 0.0) /
        static_cast<double>(values.size());
}

std::vector<int> scale_for(NoteCollection collection, TonalMode mode) {
    if (collection == NoteCollection::WhiteKey) {
        return mode == TonalMode::Major
            ? std::vector<int>{0, 2, 4, 5, 7, 9, 11}
            : std::vector<int>{0, 2, 3, 5, 7, 8, 10};
    }
    return mode == TonalMode::Major
        ? std::vector<int>{0, 2, 4, 7, 9}
        : std::vector<int>{0, 3, 5, 7, 10};
}

std::vector<int> chord_offsets(NoteCollection collection, TonalMode mode) {
    if (collection == NoteCollection::WhiteKey) return {0, 2, 4};
    return mode == TonalMode::Major
        ? std::vector<int>{0, 2, 3}
        : std::vector<int>{0, 1, 3};
}

bool contains(const std::vector<int>& values, int value) {
    return std::find(values.begin(), values.end(), value) != values.end();
}

SourceProfile analyze_range(
    const std::vector<double>& source,
    std::size_t requested_start,
    std::size_t requested_end
) {
    SourceProfile result;
    if (source.empty()) return result;

    const std::size_t start = std::min(requested_start, source.size() - 1);
    const std::size_t end = std::max(
        start + 1, std::min(requested_end, source.size())
    );
    std::vector<double> segment(
        source.begin() + static_cast<std::ptrdiff_t>(start),
        source.begin() + static_cast<std::ptrdiff_t>(end)
    );
    if (segment.empty()) segment.push_back(0.5);

    result.mean = mean_of(segment);
    const std::size_t quarter = std::max<std::size_t>(1, segment.size() / 4);
    const double first = std::accumulate(
        segment.begin(),
        segment.begin() + static_cast<std::ptrdiff_t>(quarter),
        0.0
    ) / static_cast<double>(quarter);
    const double last = std::accumulate(
        segment.end() - static_cast<std::ptrdiff_t>(quarter),
        segment.end(),
        0.0
    ) / static_cast<double>(quarter);
    result.trend = last - first;

    double movement = 0.0;
    for (std::size_t i = 1; i < segment.size(); ++i) {
        movement += std::abs(segment[i] - segment[i - 1]);
    }
    result.movement = movement /
        static_cast<double>(std::max<std::size_t>(1, segment.size() - 1));

    double weighted = 0.0;
    double total = 0.0;
    for (std::size_t i = 0; i < segment.size(); ++i) {
        weighted += segment[i] *
            static_cast<double>(i) /
            static_cast<double>(std::max<std::size_t>(1, segment.size() - 1));
        total += segment[i];
    }
    result.centroid = total > 1e-9 ? weighted / total : 0.5;
    result.energy = clamp01(
        result.mean * 0.45 + result.movement * 1.2 +
        std::abs(result.trend) * 0.3
    );
    return result;
}

SourceProfile analyze_section(
    const std::vector<double>& source,
    int section
) {
    const auto size = source.size();
    if (size == 0) return {};
    const auto start = static_cast<std::size_t>(section) * size / 8;
    const auto end = std::max(
        start + 1,
        (static_cast<std::size_t>(section) + 1) * size / 8
    );
    return analyze_range(source, start, end);
}

double tonal_score(
    const std::vector<double>& source,
    int root,
    NoteCollection collection,
    TonalMode mode
) {
    const auto intervals = scale_for(collection, mode);
    const int third = mode == TonalMode::Minor ? 3 : 4;
    double score = 0.0;
    double total_weight = 0.0;

    for (std::size_t i = 0; i < source.size(); ++i) {
        const double value = clamp01(source[i]);
        const double previous = i > 0 ? clamp01(source[i - 1]) : value;
        const double contour = clamp01(0.5 + (value - previous) * 1.5);
        const double beat_phase = static_cast<double>(i % 8) / 7.0;
        const int source_pitch = static_cast<int>(std::lround(
            value * 6.5 + contour * 2.5 + beat_phase * 2.8
        ));
        const int relative = wrap(source_pitch - root, 12);
        const double weight = 1.0 +
            (i % 8 == 0 ? 0.35 : 0.0) +
            std::min(1.0, std::abs(value - previous) * 2.0) * 0.2;

        score += weight * (contains(intervals, relative) ? 1.0 : -0.85);
        if (relative == 0) score += weight * 0.12;
        if (relative == third) score += weight * 0.10;
        if (relative == 7) score += weight * 0.08;
        total_weight += weight;
    }

    return score / std::max(1.0, total_weight);
}

TonalContext infer_tonality(
    const std::vector<double>& source,
    const GenerationOptions& options
) {
    if (options.root_pitch_class &&
        (*options.root_pitch_class < 0 || *options.root_pitch_class > 11)) {
        throw std::invalid_argument("root_pitch_class must be in [0, 11]");
    }

    const std::vector<int> roots = options.root_pitch_class
        ? std::vector<int>{*options.root_pitch_class}
        : std::vector<int>{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11};
    const std::vector<TonalMode> modes = options.mode
        ? std::vector<TonalMode>{*options.mode}
        : std::vector<TonalMode>{TonalMode::Major, TonalMode::Minor};

    const double seed_fraction =
        static_cast<double>(options.seed % 1000003ULL) / 1000003.0;
    const int preferred_root = wrap(static_cast<int>(std::floor(
        (mean_of(source) * 0.57 + seed_fraction * 0.43) * 12.0
    )), 12);

    struct Candidate { int root; TonalMode mode; double score; };
    std::vector<Candidate> candidates;
    for (const int root : roots) {
        for (const auto mode : modes) {
            const int distance = std::min(
                wrap(root - preferred_root, 12),
                wrap(preferred_root - root, 12)
            );
            const double score = tonal_score(
                source, root, options.collection, mode
            ) + static_cast<double>(6 - distance) * 0.0001;
            candidates.push_back({root, mode, score});
        }
    }

    std::stable_sort(
        candidates.begin(), candidates.end(),
        [](const Candidate& a, const Candidate& b) {
            if (std::abs(a.score - b.score) > 1e-12) return a.score > b.score;
            if (a.root != b.root) return a.root < b.root;
            return a.mode == TonalMode::Major && b.mode == TonalMode::Minor;
        }
    );

    const auto& winner = candidates.front();
    TonalContext result;
    result.root_pitch_class = winner.root;
    result.root_midi = 60 + winner.root;
    result.collection = options.collection;
    result.mode = winner.mode;
    result.scale_intervals = scale_for(options.collection, winner.mode);
    result.confidence = candidates.size() > 1
        ? std::clamp(winner.score - candidates[1].score, 0.0, 1.0)
        : 1.0;
    result.center_was_manual = options.root_pitch_class.has_value();
    result.mode_was_manual = options.mode.has_value();
    return result;
}

Motif derive_motif(
    const std::vector<double>& source,
    const std::vector<int>& scale
) {
    const std::size_t length = scale.size();
    const std::size_t opening_count = std::min<std::size_t>(32, source.size());
    std::vector<double> opening(
        source.begin(),
        source.begin() + static_cast<std::ptrdiff_t>(opening_count)
    );
    if (opening.empty()) opening.push_back(0.5);

    const std::array<double, 4> positions{{0.0, 1.0 / 3.0, 2.0 / 3.0, 1.0}};
    std::array<double, 4> samples{};
    std::array<int, 4> sampled_degrees{};

    for (std::size_t i = 0; i < 4; ++i) {
        const auto index = static_cast<std::size_t>(std::lround(
            positions[i] * static_cast<double>(opening.size() - 1)
        ));
        samples[i] = opening[std::min(index, opening.size() - 1)];
        sampled_degrees[i] = static_cast<int>(std::lround(
            samples[i] * static_cast<double>(length - 1)
        ));
    }

    Motif result;
    result.degrees[0] = wrap(
        static_cast<int>(std::floor(mean_of(source) * length)),
        static_cast<int>(length)
    );

    for (int i = 1; i < 4; ++i) {
        int interval = std::clamp(
            sampled_degrees[static_cast<std::size_t>(i)] -
                sampled_degrees[static_cast<std::size_t>(i - 1)],
            -3, 3
        );
        if (interval == 0) {
            interval = std::clamp(static_cast<int>(std::lround(
                (samples[static_cast<std::size_t>(i)] -
                 samples[static_cast<std::size_t>(i - 1)]) *
                static_cast<double>(length - 1) * 2.0
            )), -2, 2);
        }
        result.degrees[static_cast<std::size_t>(i)] = wrap(
            result.degrees[static_cast<std::size_t>(i - 1)] + interval,
            static_cast<int>(length)
        );
    }

    const bool flat = std::all_of(
        result.degrees.begin() + 1,
        result.degrees.end(),
        [&](int value) { return value == result.degrees[0]; }
    );
    if (flat) {
        const int base = result.degrees[0];
        result.degrees = {{
            base, wrap(base + 2, static_cast<int>(length)),
            wrap(base + 4, static_cast<int>(length)),
            wrap(base + 2, static_cast<int>(length))
        }};
    }
    return result;
}

MotifTransformations transform_motif(const Motif& motif, int length) {
    MotifTransformations result;
    for (int i = 0; i < 4; ++i) {
        const auto index = static_cast<std::size_t>(i);
        result.inversion[index] = wrap(
            2 * motif.degrees[0] - motif.degrees[index], length
        );
        result.retrograde[index] = motif.degrees[
            static_cast<std::size_t>(3 - i)
        ];
        result.sequence[index] = wrap(
            motif.degrees[index] + 2, length
        );
    }
    return result;
}

using Palette = std::array<std::vector<int>, 8>;

Palette harmony_palette(NoteCollection collection, TonalMode mode) {
    if (collection == NoteCollection::WhiteKey && mode == TonalMode::Minor) {
        return {{{0}, {5,3,1}, {3,6,2}, {2,4,4},
                 {0,5,3}, {5,3,1}, {4,4,6}, {0}}};
    }
    if (collection == NoteCollection::BlackKey && mode == TonalMode::Minor) {
        return {{{0}, {3,1,4}, {2,4,1}, {1,3,4},
                 {0,2,3}, {3,1,2}, {4,2,3}, {0}}};
    }
    if (collection == NoteCollection::BlackKey) {
        return {{{0}, {3,2,1}, {2,4,3}, {4,2,4},
                 {0,2,3}, {3,1,2}, {4,4,3}, {0}}};
    }
    return {{{0}, {5,3,1}, {2,5,1}, {2,4,4},
             {0,5,2}, {3,5,1}, {4,4,6}, {0}}};
}

double sequence_phase(const std::vector<double>& source) {
    const double center = mean_of(source);
    double real = 0.0;
    double imaginary = 0.0;
    for (std::size_t i = 0; i < source.size(); ++i) {
        const double angle = static_cast<double>(i + 1) * kGoldenAngle;
        const double value = source[i] - center;
        real += value * std::cos(angle);
        imaginary += value * std::sin(angle);
    }
    if (std::hypot(real, imaginary) <= 1e-9) return 0.5;
    double angle = std::atan2(imaginary, real);
    if (angle < 0.0) angle += 2.0 * kPi;
    return angle / (2.0 * kPi);
}

std::array<int, 8> derive_progression(
    const std::vector<double>& source,
    const TonalContext& tonal
) {
    const auto palette = harmony_palette(tonal.collection, tonal.mode);
    const double phase = sequence_phase(source);
    std::array<int, 8> result{};

    for (int section = 0; section < 8; ++section) {
        const auto& choices = palette[static_cast<std::size_t>(section)];
        if (choices.size() == 1) {
            result[static_cast<std::size_t>(section)] = choices.front();
            continue;
        }

        const auto profile = analyze_section(source, section);
        const double character = clamp01(
            profile.mean * 0.30 +
            (profile.trend * 1.5 + 0.5) * 0.22 +
            clamp01(profile.movement * 2.5) * 0.18 +
            profile.centroid * 0.30
        );
        const double phrase_phase = std::fmod(
            phase + static_cast<double>(section) * 0.17320508075688773,
            1.0
        );
        const double selector = std::min(
            0.999, character * 0.55 + phrase_phase * 0.45
        );
        const auto index = std::min(
            choices.size() - 1,
            static_cast<std::size_t>(std::floor(selector * choices.size()))
        );
        result[static_cast<std::size_t>(section)] = choices[index];
    }
    return result;
}

int pitch_class(int midi) { return wrap(midi, 12); }

std::array<int, 3> chord_for_degree(
    int degree,
    const TonalContext& tonal
) {
    const auto offsets = chord_offsets(tonal.collection, tonal.mode);
    const int length = static_cast<int>(tonal.scale_intervals.size());
    std::array<int, 3> chord{};

    for (std::size_t i = 0; i < chord.size(); ++i) {
        const int index = degree + offsets[i];
        chord[i] = tonal.root_midi + 12 +
            tonal.scale_intervals[static_cast<std::size_t>(wrap(index, length))] +
            (index / length) * 12;
    }
    return chord;
}

double note_weight(const MusicalEvent& event) {
    const int slot = wrap(
        static_cast<int>(std::lround(
            std::fmod(event.start_beat, 4.0) / 0.5
        )),
        8
    );
    return (slot % 2 == 0 ? 2.2 : 1.0) *
        (event.duration_beats >= 0.75 ? 1.25 : 1.0) *
        (0.8 + event.velocity * 0.4);
}

void align_progression(
    std::array<int, 8>& progression,
    const std::vector<MusicalEvent>& lead,
    const TonalContext& tonal
) {
    const auto palette = harmony_palette(tonal.collection, tonal.mode);
    const auto offsets = chord_offsets(tonal.collection, tonal.mode);
    const int length = static_cast<int>(tonal.scale_intervals.size());

    for (int section = 1; section < 7; ++section) {
        std::vector<const MusicalEvent*> phrase;
        double total_weight = 0.0;
        for (const auto& event : lead) {
            if (event.start_beat >= section * 8.0 &&
                event.start_beat < (section + 1) * 8.0) {
                phrase.push_back(&event);
                total_weight += note_weight(event);
            }
        }
        if (phrase.empty() || total_weight <= 0.0) continue;

        const int preferred = progression[static_cast<std::size_t>(section)];
        const auto& choices = palette[static_cast<std::size_t>(section)];

        auto score = [&](int degree) {
            std::array<int, 3> chord_classes{};
            for (std::size_t i = 0; i < offsets.size(); ++i) {
                const int index = degree + offsets[i];
                chord_classes[i] = pitch_class(
                    tonal.root_pitch_class +
                    tonal.scale_intervals[static_cast<std::size_t>(wrap(index, length))]
                );
            }

            double fit = 0.0;
            for (const auto* event : phrase) {
                int nearest = 12;
                bool tritone = false;
                for (const int tone : chord_classes) {
                    const int difference = std::abs(pitch_class(event->midi_pitch) - tone);
                    const int distance = std::min(difference, 12 - difference);
                    nearest = std::min(nearest, distance);
                    tritone = tritone || distance == 6;
                }
                const double weight = note_weight(*event);
                fit += weight * (nearest == 0 ? 1.0 : nearest <= 2 ? 0.3 : 0.0);
                if (tritone) fit -= weight * 0.22;
            }
            fit /= total_weight;
            if (degree == preferred) fit += 0.12;
            return fit;
        };

        int best = choices.front();
        double best_score = score(best);
        for (const int candidate : choices) {
            const double candidate_score = score(candidate);
            if (candidate_score > best_score + 1e-9) {
                best = candidate;
                best_score = candidate_score;
            }
        }
        progression[static_cast<std::size_t>(section)] = best;
    }
}

double tension_for(const SourceProfile& profile, int section) {
    constexpr std::array<double, 8> arc{{
        0.12, 0.20, 0.32, 0.46, 0.62, 0.78, 0.96, 0.04
    }};
    const double source_energy = clamp01(
        profile.movement * 1.6 + std::abs(profile.trend) * 1.2
    );
    return clamp01(
        arc[static_cast<std::size_t>(section)] * 0.82 +
        source_energy * 0.18
    );
}

int midi_for_degree(const TonalContext& tonal, int degree, int octave_offset) {
    const int length = static_cast<int>(tonal.scale_intervals.size());
    const int octave = static_cast<int>(std::floor(
        static_cast<double>(degree) / length
    ));
    const int index = wrap(degree, length);
    return tonal.root_midi +
        tonal.scale_intervals[static_cast<std::size_t>(index)] +
        (octave + octave_offset) * 12;
}

void push_event(
    std::vector<MusicalEvent>& events,
    double start,
    double duration,
    int pitch,
    double velocity,
    double pan,
    InstrumentRole role,
    int phrase,
    bool accent = false
) {
    if (duration <= 0.0) return;
    events.push_back({
        start, duration, pitch,
        std::clamp(velocity, 0.0, 1.0),
        std::clamp(pan, -1.0, 1.0),
        role, phrase, accent
    });
}

void push_lead(
    std::vector<MusicalEvent>& events,
    const TonalContext& tonal,
    int bar,
    int slot,
    int degree,
    int octave,
    double velocity,
    double duration,
    bool accent = false
) {
    const int section = bar / 2;
    const double pan = std::sin((bar * 8 + slot) * 0.23) * 0.24;
    push_event(
        events, bar * 4.0 + slot * 0.5, duration,
        midi_for_degree(tonal, degree, octave),
        velocity, pan, InstrumentRole::Lead, section, accent
    );
}

struct LeadGap {
    double start = 0.0;
    double end = 0.0;
    const MusicalEvent* preceding = nullptr;
    double length() const { return std::max(0.0, end - start); }
};

LeadGap find_longest_gap(
    const std::vector<MusicalEvent>& events,
    int section
) {
    const double section_start = section * 8.0;
    const double section_end = section_start + 8.0;
    std::vector<const MusicalEvent*> lead;

    for (const auto& event : events) {
        if (event.role == InstrumentRole::Lead &&
            event.start_beat < section_end &&
            event.start_beat + event.duration_beats > section_start) {
            lead.push_back(&event);
        }
    }

    std::sort(lead.begin(), lead.end(),
        [](const MusicalEvent* a, const MusicalEvent* b) {
            return a->start_beat < b->start_beat;
        });

    LeadGap best;
    for (std::size_t i = 0; i < lead.size(); ++i) {
        const auto* current = lead[i];
        const double start = std::max(
            section_start, current->start_beat + current->duration_beats
        );
        const double next_start = i + 1 < lead.size()
            ? lead[i + 1]->start_beat
            : section_end;
        const double end = std::min(section_end, next_start);
        if (end - start > best.length()) best = {start, end, current};
    }
    return best;
}

bool has_role(
    const std::vector<InstrumentRole>& roles,
    InstrumentRole role
) {
    return std::find(roles.begin(), roles.end(), role) != roles.end();
}

std::vector<InstrumentRole> conduct(
    const SourceProfile& source,
    double energy,
    double density,
    double gap,
    int section,
    const GenerationOptions& options,
    const std::vector<InstrumentRole>& previous
) {
    struct Candidate { InstrumentRole role; double score; };
    std::vector<Candidate> candidates;
    const bool edge = section == 0 || section == 7;
    constexpr double continuity = 0.075;

    if (options.enable_bass) {
        double score = 0.30 + (1.0 - density) * 0.12 +
            source.movement * 0.18 + energy * 0.18 + (edge ? 0.10 : 0.0);
        if (has_role(previous, InstrumentRole::Bass)) score += continuity;
        candidates.push_back({InstrumentRole::Bass, score});
    }

    if (options.enable_pad) {
        double score = 0.34 + (1.0 - density) * 0.24 +
            (1.0 - source.movement) * 0.12 + (edge ? 0.10 : 0.0);
        if (has_role(previous, InstrumentRole::Pad)) score += continuity;
        candidates.push_back({InstrumentRole::Pad, score});
    }

    // The two answer instruments compete for one melodic slot.
    Candidate answer{InstrumentRole::Plucked, -1.0};

    if (options.enable_plucked && gap >= 0.38) {
        answer.score = 0.36 + std::min(gap, 1.5) * 0.20 +
            (1.0 - density) * 0.12 + source.movement * 0.06;
        if (has_role(previous, InstrumentRole::Plucked)) {
            answer.score += continuity;
        }
    }

    if (options.enable_analog && gap >= 0.72) {
        double analog_score = 0.34 + std::min(gap, 2.0) * 0.17 +
            (1.0 - density) * 0.10 +
            (source.movement > 0.20 ? 0.08 : 0.0);
        if (has_role(previous, InstrumentRole::Analog)) {
            analog_score += continuity;
        }
        if (analog_score > answer.score) {
            answer = {InstrumentRole::Analog, analog_score};
        }
    }

    if (answer.score >= 0.0) candidates.push_back(answer);

    std::stable_sort(candidates.begin(), candidates.end(),
        [](const Candidate& a, const Candidate& b) {
            return a.score > b.score;
        });

    std::vector<InstrumentRole> selected;
    for (const auto& candidate : candidates) {
        if (candidate.score < 0.48 || selected.size() >= 2) break;
        selected.push_back(candidate.role);
    }
    return selected;
}

std::array<int, 3> voice_lead(
    const std::array<int, 3>& chord,
    const std::array<int, 3>& previous
) {
    std::array<int, 3> best = chord;
    double best_cost = std::numeric_limits<double>::infinity();

    for (int inversion = 0; inversion < 3; ++inversion) {
        std::array<int, 3> candidate{};

        for (int voice = 0; voice < 3; ++voice) {
            int note = chord[static_cast<std::size_t>((voice + inversion) % 3)];
            if (voice + inversion >= 3) note += 12;

            int chosen = note;
            int distance = std::numeric_limits<int>::max();
            for (const int shift : {-12, 0, 12, 24}) {
                const int moved = note + shift;
                const int current = std::abs(
                    moved - previous[static_cast<std::size_t>(voice)]
                );
                if (current < distance) {
                    chosen = moved;
                    distance = current;
                }
            }
            candidate[static_cast<std::size_t>(voice)] = chosen;
        }

        std::sort(candidate.begin(), candidate.end());
        double cost = 0.0;
        for (std::size_t i = 0; i < 3; ++i) {
            const double movement = std::abs(candidate[i] - previous[i]);
            cost += movement + std::max(0.0, movement - 7.0) * 0.5;
        }
        if (cost < best_cost) {
            best_cost = cost;
            best = candidate;
        }
    }
    return best;
}

int chord_response_pitch(
    const std::array<int, 3>& chord,
    int reference,
    int preferred_interval
) {
    std::vector<int> candidates;
    for (const int note : chord) {
        for (const int octave : {-12, 0, 12, 24}) {
            candidates.push_back(note + octave);
        }
    }

    std::vector<int> in_range;
    for (const int note : candidates) {
        if (note > reference + 2 && note < reference + 19) {
            in_range.push_back(note);
        }
    }
    if (!in_range.empty()) candidates = std::move(in_range);

    const int target = reference + preferred_interval;
    return *std::min_element(candidates.begin(), candidates.end(),
        [target](int a, int b) {
            return std::abs(a - target) < std::abs(b - target);
        });
}

void generate_percussion(CompositionPlan& plan, bool enabled) {
    if (!enabled) return;

    constexpr std::array<double, 16> arc{{
        0.18, 0.22, 0.25, 0.30, 0.38, 0.44, 0.50, 0.56,
        0.78, 0.88, 0.96, 0.90, 0.56, 0.46, 0.34, 0.12
    }};

    for (int bar = 0; bar < kCompositionBars; ++bar) {
        const auto size = plan.source_values.size();
        const auto start = static_cast<std::size_t>(bar) * size / 16;
        const auto end = std::max(
            start + 1,
            static_cast<std::size_t>(bar + 1) * size / 16
        );
        const auto profile = analyze_range(plan.source_values, start, end);
        const int section = bar / 2;
        const double energy = clamp01(
            arc[static_cast<std::size_t>(bar)] * 0.62 +
            profile.mean * 0.16 + profile.movement * 0.50 +
            plan.phrases[static_cast<std::size_t>(section)].energy * 0.12
        );

        if (bar < 15) {
            push_event(plan.events, bar * 4.0, 0.22, 36,
                0.18 + energy * 0.48, 0.0,
                InstrumentRole::Percussion, section, true);
        }

        const bool climax = bar >= 8 && bar <= 11;
        if ((bar % 4 == 1 || bar % 4 == 3 || climax) && bar < 15) {
            push_event(plan.events, bar * 4.0 + 2.0, 0.16, 38,
                0.10 + energy * 0.36, 0.0,
                InstrumentRole::Percussion, section, true);
        }

        std::size_t peak = 0;
        for (std::size_t i = start + 1; i < end; ++i) {
            if (plan.source_values[i] > plan.source_values[start + peak]) {
                peak = i - start;
            }
        }

        if (end > start &&
            plan.source_values[start + peak] > profile.mean + 0.16 &&
            peak > 0 && peak != 4 && bar < 15) {
            push_event(
                plan.events,
                bar * 4.0 + static_cast<double>(peak) * 0.5,
                0.055,
                peak % 2 == 0 ? 42 : 36,
                0.08 + energy * 0.20,
                0.12,
                InstrumentRole::Percussion,
                section
            );
        }

        if (climax) {
            if (profile.movement > 0.08 || bar % 2 == 0) {
                push_event(plan.events, bar * 4.0 + 1.0, 0.055, 42,
                    0.08 + energy * 0.14, 0.18,
                    InstrumentRole::Percussion, section);
            }
            if (profile.movement > 0.06 || bar % 2 == 1) {
                push_event(plan.events, bar * 4.0 + 3.0, 0.055, 42,
                    0.08 + energy * 0.15, -0.18,
                    InstrumentRole::Percussion, section);
            }
        } else if (profile.movement > 0.12 && bar < 15) {
            push_event(plan.events, bar * 4.0 +
                (profile.trend >= 0.0 ? 1.0 : 3.0),
                0.055, 42, 0.06 + energy * 0.14, 0.18,
                InstrumentRole::Percussion, section);
        }

        if ((bar == 3 || bar == 7 || bar == 11) && bar < 15) {
            push_event(plan.events, bar * 4.0 +
                (profile.trend >= 0.0 ? 3.5 : 3.0),
                0.055, profile.movement > 0.1 ? 38 : 42,
                0.10 + energy * 0.20, 0.0,
                InstrumentRole::Percussion, section);
        }
    }
}

} // namespace

CompositionPlan IntelligenceEngine::generate(
    const std::vector<double>& source_values,
    const GenerationOptions& options
) const {
    if (options.bpm < 45 || options.bpm > 180) {
        throw std::invalid_argument("bpm must be in [45, 180]");
    }

    std::vector<double> source;
    if (source_values.empty()) {
        source.assign(128, 0.5);
    } else {
        source.reserve(source_values.size());
        for (const double value : source_values) source.push_back(clamp01(value));
    }

    CompositionPlan plan;
    plan.bpm = options.bpm;
    plan.seed = options.seed;
    plan.source_values = source;
    plan.tonality = infer_tonality(source, options);
    plan.motif = derive_motif(source, plan.tonality.scale_intervals);
    plan.motif_transformations = transform_motif(
        plan.motif,
        static_cast<int>(plan.tonality.scale_intervals.size())
    );

    for (int section = 0; section < 8; ++section) {
        plan.section_profiles.push_back(analyze_section(source, section));
    }
    plan.harmonic_progression = derive_progression(source, plan.tonality);

    constexpr std::array<double, 16> gain{{
        0.38, 0.42, 0.46, 0.50,
        0.56, 0.62, 0.68, 0.74,
        0.84, 0.94, 1.00, 0.96,
        0.78, 0.68, 0.52, 0.30
    }};
    const auto& m = plan.motif.degrees;
    const auto& x = plan.motif_transformations;

    // I. Opening: state the motif, then make its identity clearer.
    push_lead(plan.events, plan.tonality, 0, 0, m[0], 1, gain[0] * 0.90, 1.20, true);
    push_lead(plan.events, plan.tonality, 0, 4, m[1], 1, gain[0] * 0.78, 0.95);
    push_lead(plan.events, plan.tonality, 1, 0, m[2], 1, gain[1] * 0.86, 1.10);
    push_lead(plan.events, plan.tonality, 1, 4, m[3], 1, gain[1] * 0.82, 0.95);
    for (int i = 0; i < 4; ++i) {
        push_lead(plan.events, plan.tonality, 2, i * 2, m[static_cast<std::size_t>(i)],
            1, gain[2] * (i == 0 ? 0.90 : 0.72), 0.72, i == 0);
    }
    push_lead(plan.events, plan.tonality, 3, 0, m[2], 1, gain[3] * 0.80, 0.80);
    push_lead(plan.events, plan.tonality, 3, 4, m[3], 1, gain[3] * 0.76, 0.55);

    // II. Development: fragmentation, inversion, retrograde and sequence.
    const std::array<std::array<int, 5>, 4> degrees{{
        {{m[0], m[1], m[2], m[3], m[0]}},
        {{x.inversion[0], x.inversion[1], x.inversion[2], x.inversion[3], x.inversion[2]}},
        {{x.retrograde[0], x.retrograde[1], x.retrograde[2], x.retrograde[3], x.retrograde[0]}},
        {{x.sequence[0], x.sequence[1], x.sequence[2], x.sequence[3], x.sequence[0]}}
    }};
    const std::array<std::array<int, 5>, 4> slots{{
        {{0, 2, 5, 7, 0}},
        {{0, 1, 4, 6, 7}},
        {{0, 2, 4, 6, 0}},
        {{0, 2, 4, 0, 0}}
    }};
    constexpr std::array<int, 4> counts{{4, 5, 4, 3}};

    for (int phrase = 0; phrase < 4; ++phrase) {
        const int bar = 4 + phrase;
        const auto& profile = plan.section_profiles[static_cast<std::size_t>(bar / 2)];
        const int direction = profile.trend > 0.08 ? 1 :
            profile.trend < -0.08 ? -1 : 0;
        const int ornament = profile.movement > 0.36 ? 1 : 0;

        for (int i = 0; i < counts[static_cast<std::size_t>(phrase)]; ++i) {
            const int slot = slots[static_cast<std::size_t>(phrase)][static_cast<std::size_t>(i)];
            // A seed-controlled scale-degree ornament adds repeatable variation
            // without abandoning the source-derived motif or selected note set.
            const int seed_ornament = static_cast<int>(
                (options.seed + static_cast<std::uint64_t>(phrase)) % 3ULL
            ) - 1;
            const int shift = (i % 2 == 1 ? direction : (i == 2 ? ornament : 0)) +
                (i == 2 ? seed_ornament : 0);
            push_lead(
                plan.events, plan.tonality, bar, slot,
                degrees[static_cast<std::size_t>(phrase)][static_cast<std::size_t>(i)] + shift,
                1, gain[static_cast<std::size_t>(bar)] * (slot == 0 ? 0.92 : 0.74),
                0.42 + (i % 2) * 0.12, slot == 0
            );
        }
    }

    // III. Climax: the source's own mean and trend shape the melodic lift.
    const auto climax = analyze_range(
        source, std::min<std::size_t>(64, source.size() - 1),
        std::min<std::size_t>(96, source.size())
    );
    const int lift = climax.mean >= mean_of(source) ? 2 : 1;
    const int turn = climax.trend >= 0.0 ? 1 : -1;
    const std::array<int, 8> contour{{
        m[0], m[1], m[2] + lift, m[3] + lift,
        x.inversion[3] + lift + turn,
        x.inversion[2] + lift + turn,
        x.retrograde[1] + lift,
        x.retrograde[0] + lift + turn
    }};

    for (int bar = 8; bar <= 11; ++bar) {
        for (int i = 0; i < 8; ++i) {
            push_lead(
                plan.events, plan.tonality, bar, i,
                contour[static_cast<std::size_t>(i)] +
                    ((bar == 9 || bar == 10) ? 1 : 0),
                2,
                gain[static_cast<std::size_t>(bar)] *
                    ((i == 0 || i == 4) ? 0.96 : 0.82),
                bar == 11 ? 0.32 : 0.38,
                i == 0 || i == 4
            );
        }
    }

    // IV. Reprise: recall the motif and resolve to tonic.
    push_lead(plan.events, plan.tonality, 12, 0, m[0], 1, gain[12] * 0.90, 1.15, true);
    push_lead(plan.events, plan.tonality, 12, 4, m[1], 1, gain[12] * 0.78, 0.95);
    push_lead(plan.events, plan.tonality, 13, 0, m[2], 1, gain[13] * 0.86, 1.10);
    push_lead(plan.events, plan.tonality, 13, 4, m[3], 1, gain[13] * 0.78, 0.95);
    push_lead(plan.events, plan.tonality, 14, 0, m[0], 1, gain[14] * 0.82, 1.00);
    push_lead(plan.events, plan.tonality, 14, 4, m[1], 1, gain[14] * 0.68, 0.85);
    push_lead(plan.events, plan.tonality, 14, 6,
        static_cast<int>(plan.tonality.scale_intervals.size()) - 1,
        1, 0.34, 0.30);
    push_lead(plan.events, plan.tonality, 15, 0, 0, 1, 0.38, 3.82, true);

    // Short diatonic pickups connect the four movements.
    for (const int bar : {3, 7, 11}) {
        const int next_section = (bar + 1) / 2;
        const int target = plan.harmonic_progression[
            static_cast<std::size_t>(next_section)
        ];
        push_lead(plan.events, plan.tonality, bar, 6,
            target - 1, 1, gain[static_cast<std::size_t>(bar)] * 0.66, 0.28);
        push_lead(plan.events, plan.tonality, bar, 7,
            target, 1, gain[static_cast<std::size_t>(bar)] * 0.78, 0.26, true);
    }

    std::vector<MusicalEvent> lead;
    for (const auto& event : plan.events) {
        if (event.role == InstrumentRole::Lead) lead.push_back(event);
    }
    align_progression(plan.harmonic_progression, lead, plan.tonality);

    // One shared two-bar chord map feeds every pitched supporting role.
    for (int section = 0; section < 8; ++section) {
        const auto& profile = plan.section_profiles[static_cast<std::size_t>(section)];
        const int degree = plan.harmonic_progression[static_cast<std::size_t>(section)];
        const double tension = tension_for(profile, section);
        const auto chord = chord_for_degree(degree, plan.tonality);
        const int scale_length = static_cast<int>(plan.tonality.scale_intervals.size());
        const int color_offset = section == 0 ? 1 :
            section == 7 ? 0 :
            (scale_length >= 7 && tension >= 0.55 ? 6 : 4);
        int color = midi_for_degree(plan.tonality, degree + color_offset, 1);

        if (section > 0 && section < 7) {
            const double start = section * 8.0;
            const double end = start + 8.0;
            const MusicalEvent* anchor = nullptr;
            double best_weight = -1.0;

            for (const auto& event : lead) {
                if (event.start_beat >= start && event.start_beat < end) {
                    const double weight = note_weight(event);
                    if (weight > best_weight) {
                        best_weight = weight;
                        anchor = &event;
                    }
                }
            }

            if (anchor) {
                const bool chord_member = std::any_of(
                    chord.begin(), chord.end(),
                    [&](int note) {
                        return pitch_class(note) == pitch_class(anchor->midi_pitch);
                    }
                );
                if (!chord_member) {
                    const double center = std::accumulate(
                        chord.begin(), chord.end(), 0.0
                    ) / 3.0;
                    const std::array<int, 3> options{{
                        anchor->midi_pitch - 12,
                        anchor->midi_pitch,
                        anchor->midi_pitch + 12
                    }};
                    color = *std::min_element(
                        options.begin(), options.end(),
                        [center](int a, int b) {
                            return std::abs(a - center) < std::abs(b - center);
                        }
                    );
                }
            }
        }

        HarmonicFrame frame;
        frame.section = section;
        frame.start_beat = section * 8.0;
        frame.duration_beats = section == 7 ? 8.0 : 8.15;
        frame.degree = degree;
        frame.root_midi = midi_for_degree(plan.tonality, degree, 0);
        frame.chord_midi = chord;
        frame.color_midi = color;
        frame.tension = tension;
        plan.harmony.push_back(frame);
    }

    // Adaptive conductor: analyze the score, carry a small continuity bias,
    // and select at most two supporting roles for each two-bar phrase.
    for (int section = 0; section < 8; ++section) {
        const auto& profile = plan.section_profiles[static_cast<std::size_t>(section)];
        int lead_count = 0;
        for (const auto& event : lead) {
            if (event.start_beat >= section * 8.0 &&
                event.start_beat < (section + 1) * 8.0) {
                ++lead_count;
            }
        }

        const double density = clamp01(static_cast<double>(lead_count) / 12.0);
        const auto gap = find_longest_gap(plan.events, section);
        const double energy = tension_for(profile, section);
        const std::vector<InstrumentRole> previous = plan.phrases.empty()
            ? std::vector<InstrumentRole>{}
            : plan.phrases.back().active_support;

        PhrasePlan phrase;
        phrase.index = section;
        phrase.start_bar = section * 2;
        phrase.movement = static_cast<Movement>(section / 2);
        phrase.source = profile;
        phrase.energy = energy;
        phrase.lead_density = density;
        phrase.longest_gap_beats = gap.length();
        phrase.active_support = conduct(
            profile, energy, density, gap.length(),
            section, options, previous
        );
        plan.phrases.push_back(phrase);
    }

    // Render-ready symbolic parts. This module does not synthesize waveforms.
    std::array<int, 3> previous_voicing = plan.harmony.front().chord_midi;

    for (int section = 0; section < 8; ++section) {
        const auto& phrase = plan.phrases[static_cast<std::size_t>(section)];
        const auto& frame = plan.harmony[static_cast<std::size_t>(section)];
        const double start = section * 8.0;
        const double energy = phrase.energy;

        if (has_role(phrase.active_support, InstrumentRole::Bass)) {
            push_event(plan.events, start, 1.55, frame.root_midi - 12,
                0.22 * (0.72 + energy * 0.55), -0.08,
                InstrumentRole::Bass, section, true);
            push_event(plan.events, start + 4.0, 1.05, frame.chord_midi[2] - 24,
                0.13 * (0.72 + energy * 0.55), 0.08,
                InstrumentRole::Bass, section);

            if (section < 7 && has_role(
                plan.phrases[static_cast<std::size_t>(section + 1)].active_support,
                InstrumentRole::Bass
            )) {
                const int next_degree = plan.harmony[
                    static_cast<std::size_t>(section + 1)
                ].degree;
                push_event(plan.events, start + 7.5, 0.36,
                    midi_for_degree(plan.tonality, next_degree - 1, -1),
                    0.12 * (0.72 + energy * 0.55), 0.0,
                    InstrumentRole::Bass, section);
            }
        }

        if (has_role(phrase.active_support, InstrumentRole::Pad)) {
            const auto voicing = voice_lead(frame.chord_midi, previous_voicing);
            previous_voicing = voicing;

            for (int voice = 0; voice < 3; ++voice) {
                push_event(
                    plan.events, start, frame.duration_beats,
                    voicing[static_cast<std::size_t>(voice)],
                    0.078 * (0.65 + energy * 0.55),
                    (voice - 1) * 0.30,
                    InstrumentRole::Pad, section
                );
            }

            if (section > 0 && section < 7 && frame.tension > 0.38) {
                push_event(plan.events, start, frame.duration_beats,
                    frame.color_midi,
                    (0.012 + frame.tension * 0.024) * (0.65 + energy * 0.55),
                    0.12, InstrumentRole::Pad, section);
            }
        }

        const auto gap = find_longest_gap(plan.events, section);
        if (gap.preceding &&
            has_role(phrase.active_support, InstrumentRole::Plucked) &&
            gap.length() >= 0.38) {
            const int pitch = chord_response_pitch(
                frame.chord_midi, gap.preceding->midi_pitch, 7
            );
            push_event(
                plan.events,
                gap.start + std::min(0.08, gap.length() * 0.10),
                std::min(0.45, gap.length() * 0.50),
                pitch,
                gap.preceding->velocity * 0.42,
                -gap.preceding->pan * 0.8,
                InstrumentRole::Plucked, section
            );
        }

        if (gap.preceding &&
            has_role(phrase.active_support, InstrumentRole::Analog) &&
            gap.length() >= 0.72) {
            const std::array<int, 3> choices{{
                frame.color_midi - 12, frame.color_midi, frame.color_midi + 12
            }};
            const int target = gap.preceding->midi_pitch + 5;
            const int pitch = *std::min_element(
                choices.begin(), choices.end(),
                [target](int a, int b) {
                    return std::abs(a - target) < std::abs(b - target);
                }
            );
            push_event(
                plan.events,
                gap.start + 0.10,
                std::min(1.0, gap.length() * 0.75),
                pitch,
                0.24 * (0.65 + energy * 0.35),
                -gap.preceding->pan * 0.65,
                InstrumentRole::Analog, section
            );
        }
    }

    generate_percussion(plan, options.enable_percussion);

    std::stable_sort(
        plan.events.begin(), plan.events.end(),
        [](const MusicalEvent& a, const MusicalEvent& b) {
            if (a.start_beat != b.start_beat) return a.start_beat < b.start_beat;
            return static_cast<int>(a.role) < static_cast<int>(b.role);
        }
    );

    return plan;
}

std::string to_string(NoteCollection value) {
    return value == NoteCollection::WhiteKey ? "white-key" : "black-key";
}
std::string to_string(TonalMode value) {
    return value == TonalMode::Major ? "major" : "minor";
}
std::string to_string(Movement value) {
    switch (value) {
        case Movement::Opening: return "opening";
        case Movement::Development: return "development";
        case Movement::Climax: return "climax";
        case Movement::Reprise: return "reprise";
    }
    return "unknown";
}
std::string to_string(InstrumentRole value) {
    switch (value) {
        case InstrumentRole::Lead: return "lead";
        case InstrumentRole::Bass: return "bass";
        case InstrumentRole::Pad: return "pad";
        case InstrumentRole::Plucked: return "plucked";
        case InstrumentRole::Analog: return "analog";
        case InstrumentRole::Percussion: return "percussion";
    }
    return "unknown";
}

} // namespace science_music
