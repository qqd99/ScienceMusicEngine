#include "science_music/intelligence.hpp"
#include "science_music/intelligence_c.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {
void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}

std::vector<double> logistic_source(std::uint64_t seed) {
    double x = 0.21 + static_cast<double>(seed % 1000003ULL) / 1000003.0 * 0.57;
    std::vector<double> result;
    result.reserve(128);
    for (int i = 0; i < 128; ++i) {
        x = 3.91 * x * (1.0 - x);
        result.push_back(x);
    }
    return result;
}

bool same_events(
    const std::vector<science_music::MusicalEvent>& a,
    const std::vector<science_music::MusicalEvent>& b
) {
    if (a.size() != b.size()) return false;
    for (std::size_t i = 0; i < a.size(); ++i) {
        const auto& x = a[i];
        const auto& y = b[i];
        if (std::abs(x.start_beat - y.start_beat) > 1e-12 ||
            std::abs(x.duration_beats - y.duration_beats) > 1e-12 ||
            x.midi_pitch != y.midi_pitch ||
            std::abs(x.velocity - y.velocity) > 1e-12 ||
            std::abs(x.pan - y.pan) > 1e-12 ||
            x.role != y.role || x.phrase_index != y.phrase_index ||
            x.accent != y.accent) return false;
    }
    return true;
}

void test_determinism_and_source_sensitivity() {
    science_music::GenerationOptions options;
    options.seed = 314159;
    const science_music::IntelligenceEngine engine;
    const auto source = logistic_source(options.seed);
    const auto a = engine.generate(source, options);
    const auto b = engine.generate(source, options);

    require(same_events(a.events, b.events), "fixed inputs must produce identical events");
    require(a.harmonic_progression == b.harmonic_progression, "fixed inputs must produce identical harmony");
    require(a.motif.degrees == b.motif.degrees, "fixed inputs must produce identical motifs");

    options.seed = 98765;
    const auto other_seed = engine.generate(logistic_source(options.seed), options);
    require(!same_events(a.events, other_seed.events), "different seeds must change the generated score");

    const auto shared_source = logistic_source(777);
    science_music::GenerationOptions variation_a;
    science_music::GenerationOptions variation_b;
    variation_a.seed = 42;
    variation_b.seed = 43;
    const auto same_source_a = engine.generate(shared_source, variation_a);
    const auto same_source_b = engine.generate(shared_source, variation_b);
    require(!same_events(same_source_a.events, same_source_b.events),
        "seed-controlled ornaments must vary the score even when the source contour is unchanged");
    require(same_events(
        same_source_a.events,
        engine.generate(shared_source, variation_a).events
    ), "seed-controlled ornaments must remain deterministic");

    auto reversed = source;
    std::reverse(reversed.begin(), reversed.end());
    options.seed = 314159;
    const auto other_source = engine.generate(reversed, options);
    require(!same_events(a.events, other_source.events), "different mathematical contours must change the score");
}

void test_motif_transformations() {
    science_music::GenerationOptions options;
    options.seed = 271828;
    const science_music::IntelligenceEngine engine;
    const auto score = engine.generate(logistic_source(options.seed), options);
    const auto& motif = score.motif.degrees;
    const auto& transform = score.motif_transformations;
    const int length = static_cast<int>(score.tonality.scale_intervals.size());

    for (int i = 0; i < 4; ++i) {
        const auto index = static_cast<std::size_t>(i);
        const int inverted = ((2 * motif[0] - motif[index]) % length + length) % length;
        const int sequenced = (motif[index] + 2) % length;
        require(transform.inversion[index] == inverted, "inversion must reflect around the motif's first degree");
        require(transform.retrograde[index] == motif[static_cast<std::size_t>(3 - i)], "retrograde must reverse the motif");
        require(transform.sequence[index] == sequenced, "sequence must transpose by two scale degrees");
    }
}

void test_tonal_collections_and_manual_overrides() {
    const science_music::IntelligenceEngine engine;
    for (const auto collection : {
        science_music::NoteCollection::WhiteKey,
        science_music::NoteCollection::BlackKey
    }) {
        science_music::GenerationOptions options;
        options.seed = 618034;
        options.collection = collection;
        const auto score = engine.generate(logistic_source(options.seed), options);
        const auto& intervals = score.tonality.scale_intervals;

        for (const auto& event : score.events) {
            if (event.role == science_music::InstrumentRole::Percussion) continue;
            const int relative = (
                (event.midi_pitch - score.tonality.root_pitch_class) % 12 + 12
            ) % 12;
            require(
                std::find(intervals.begin(), intervals.end(), relative) != intervals.end(),
                "all pitched instruments must share the selected scale"
            );
        }

        if (collection == science_music::NoteCollection::BlackKey) {
            for (std::size_t i = 0; i < intervals.size(); ++i) {
                for (std::size_t j = i + 1; j < intervals.size(); ++j) {
                    const int diff = std::abs(intervals[i] - intervals[j]);
                    const int distance = std::min(diff, 12 - diff);
                    require(distance != 1, "pentatonic notes must not contain semitone pairs");
                    require(distance != 6, "pentatonic notes must not contain tritone pairs");
                }
            }
        }
    }

    science_music::GenerationOptions manual;
    manual.seed = 123;
    manual.collection = science_music::NoteCollection::BlackKey;
    manual.root_pitch_class = 6;
    manual.mode = science_music::TonalMode::Major;
    const auto locked = engine.generate(logistic_source(123), manual);
    require(locked.tonality.root_pitch_class == 6, "manual root must be honored");
    require(locked.tonality.mode == science_music::TonalMode::Major, "manual mode must be honored");
    require(locked.tonality.center_was_manual && locked.tonality.mode_was_manual,
        "manual override provenance must be exposed");

    manual.root_pitch_class.reset();
    manual.mode = science_music::TonalMode::Minor;
    const auto mode_only = engine.generate(logistic_source(123), manual);
    require(!mode_only.tonality.center_was_manual, "root can remain automatic");
    require(mode_only.tonality.mode_was_manual, "mode can be independently locked");
    require(mode_only.tonality.mode == science_music::TonalMode::Minor, "minor override must be honored");
}

void test_harmonic_form_and_conductor() {
    const science_music::IntelligenceEngine engine;
    science_music::GenerationOptions options;
    const auto score = engine.generate(logistic_source(42), options);

    require(score.bars == 16, "composition must retain the 16-bar form");
    require(score.harmony.size() == 8, "sixteen bars must contain eight two-bar harmonic frames");
    require(score.harmonic_progression.front() == 0, "opening chord must establish tonic");
    require(score.harmonic_progression.back() == 0, "final chord must resolve to tonic");
    require(score.phrases.size() == 8, "conductor must plan eight two-bar phrases");

    const std::array<science_music::Movement, 8> expected{{
        science_music::Movement::Opening,
        science_music::Movement::Opening,
        science_music::Movement::Development,
        science_music::Movement::Development,
        science_music::Movement::Climax,
        science_music::Movement::Climax,
        science_music::Movement::Reprise,
        science_music::Movement::Reprise
    }};

    for (std::size_t i = 0; i < score.harmony.size(); ++i) {
        require(score.harmony[i].section == static_cast<int>(i), "harmonic frames must be ordered");
        require(std::abs(score.harmony[i].start_beat - i * 8.0) < 1e-12,
            "each harmonic frame must begin at a two-bar boundary");
    }

    for (std::size_t i = 0; i < score.phrases.size(); ++i) {
        const auto& phrase = score.phrases[i];
        require(phrase.movement == expected[i], "four connected movements must be preserved");
        require(phrase.active_support.size() <= 2, "conductor must select at most two support roles");
        require(phrase.index == static_cast<int>(i), "phrase indices must be stable");
    }
}

void test_instrument_availability_and_answer_competition() {
    const science_music::IntelligenceEngine engine;
    science_music::GenerationOptions options;
    options.seed = 314159;
    options.enable_bass = true;
    options.enable_pad = false;
    options.enable_plucked = false;
    options.enable_analog = true;
    const auto score = engine.generate(logistic_source(options.seed), options);

    bool selected = false;
    for (const auto& phrase : score.phrases) {
        require(phrase.active_support.size() <= 2, "support-role limit must never be exceeded");
        for (const auto role : phrase.active_support) {
            require(role == science_music::InstrumentRole::Bass ||
                    role == science_music::InstrumentRole::Analog,
                "conductor must not select disabled roles");
            selected = true;
        }
    }
    require(selected, "an enabled supporting instrument should play when suitable");

    options.enable_bass = false;
    options.enable_analog = false;
    options.enable_pad = false;
    options.enable_plucked = false;
    const auto lead_only = engine.generate(logistic_source(options.seed), options);
    for (const auto& phrase : lead_only.phrases) {
        require(phrase.active_support.empty(), "disabled support instruments must leave a lead-only phrase");
    }
    require(std::none_of(lead_only.events.begin(), lead_only.events.end(),
        [](const science_music::MusicalEvent& event) {
            return event.role == science_music::InstrumentRole::Bass ||
                event.role == science_music::InstrumentRole::Pad ||
                event.role == science_music::InstrumentRole::Plucked ||
                event.role == science_music::InstrumentRole::Analog;
        }), "disabled instruments must not emit events");

    options.enable_plucked = true;
    options.enable_analog = true;
    const auto answers = engine.generate(logistic_source(options.seed), options);
    for (const auto& phrase : answers.phrases) {
        require(!(std::find(phrase.active_support.begin(), phrase.active_support.end(),
                    science_music::InstrumentRole::Plucked) != phrase.active_support.end() &&
                  std::find(phrase.active_support.begin(), phrase.active_support.end(),
                    science_music::InstrumentRole::Analog) != phrase.active_support.end()),
            "plucked and analog answers must compete for the same phrase slot");
    }
}

void test_percussion_is_independent_and_source_shaped() {
    const science_music::IntelligenceEngine engine;
    science_music::GenerationOptions options;
    options.seed = 1234;
    const auto source = logistic_source(options.seed);
    auto reversed = source;
    std::reverse(reversed.begin(), reversed.end());

    const auto a = engine.generate(source, options);
    const auto b = engine.generate(reversed, options);
    std::vector<std::pair<double, int>> drums_a, drums_b;

    for (const auto& event : a.events) {
        if (event.role == science_music::InstrumentRole::Percussion)
            drums_a.emplace_back(event.start_beat, event.midi_pitch);
    }
    for (const auto& event : b.events) {
        if (event.role == science_music::InstrumentRole::Percussion)
            drums_b.emplace_back(event.start_beat, event.midi_pitch);
    }

    require(!drums_a.empty(), "percussion should be generated by default");
    require(drums_a != drums_b, "mathematical contour should shape percussion accents");

    options.enable_percussion = false;
    const auto no_drums = engine.generate(source, options);
    require(std::none_of(no_drums.events.begin(), no_drums.events.end(),
        [](const science_music::MusicalEvent& event) {
            return event.role == science_music::InstrumentRole::Percussion;
        }), "percussion must have an independent enable switch");
}

void test_c_api_two_pass_buffer_contract() {
    const auto source = logistic_source(9876);
    SME_GenerationOptions options{};
    options.seed = 9876;
    options.bpm = 120;
    options.collection = SME_BLACK_KEY;
    options.root_pitch_class = SME_AUTO;
    options.mode = SME_AUTO;
    options.enable_bass = 1;
    options.enable_pad = 1;
    options.enable_plucked = 1;
    options.enable_analog = 1;
    options.enable_percussion = 1;

    std::size_t required = 0;
    SME_TonalContext tonal{};
    const int query = sme_generate_score(
        source.data(), source.size(), &options,
        nullptr, 0, &required, &tonal
    );

    require(query == SME_BUFFER_TOO_SMALL, "C ABI size query must report required capacity");
    require(required > 0, "C ABI must report a nonzero event count");
    require(tonal.collection == SME_BLACK_KEY, "C ABI must expose note collection");

    std::vector<SME_Event> output(required);
    std::size_t written = 0;
    const int result = sme_generate_score(
        source.data(), source.size(), &options,
        output.data(), output.size(), &written, &tonal
    );

    require(result == SME_OK, "C ABI must fill a sufficiently large event buffer");
    require(written == required, "C ABI must return the written event count");
    require(output.front().role == SME_ROLE_LEAD, "C ABI must expose symbolic roles");
    require(std::string(sme_intelligence_version()) == "1.0.0", "C ABI version must be stable");
}

void test_invalid_inputs() {
    const science_music::IntelligenceEngine engine;
    science_music::GenerationOptions options;
    options.bpm = 20;
    bool rejected = false;
    try {
        (void)engine.generate(logistic_source(1), options);
    } catch (const std::invalid_argument&) {
        rejected = true;
    }
    require(rejected, "tempo outside supported range must be rejected");

    options = {};
    options.root_pitch_class = 12;
    rejected = false;
    try {
        (void)engine.generate(logistic_source(1), options);
    } catch (const std::invalid_argument&) {
        rejected = true;
    }
    require(rejected, "invalid root pitch class must be rejected");
}

} // namespace

int main() {
    try {
        test_determinism_and_source_sensitivity();
        test_motif_transformations();
        test_tonal_collections_and_manual_overrides();
        test_harmonic_form_and_conductor();
        test_instrument_availability_and_answer_competition();
        test_percussion_is_independent_and_source_shaped();
        test_c_api_two_pass_buffer_contract();
        test_invalid_inputs();
        std::cout << "All C++ musical intelligence tests passed.\n";
        return EXIT_SUCCESS;
    } catch (const std::exception& error) {
        std::cerr << "Test failure: " << error.what() << '\n';
        return EXIT_FAILURE;
    }
}
