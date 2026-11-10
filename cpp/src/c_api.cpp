#include "science_music/intelligence_c.h"
#include "science_music/intelligence.hpp"

#include <stdexcept>
#include <vector>

extern "C" {

int sme_generate_score(
    const double* source_values,
    size_t source_count,
    const SME_GenerationOptions* options,
    SME_Event* output_events,
    size_t output_capacity,
    size_t* output_count,
    SME_TonalContext* output_tonality
) {
    if (output_count == nullptr) return SME_INVALID_ARGUMENT;
    if (source_count > 0 && source_values == nullptr) {
        return SME_INVALID_ARGUMENT;
    }

    try {
        science_music::GenerationOptions config;

        if (options != nullptr) {
            config.seed = options->seed;
            config.bpm = options->bpm == 0 ? 128 : options->bpm;

            if (options->collection != SME_WHITE_KEY &&
                options->collection != SME_BLACK_KEY) {
                return SME_INVALID_ARGUMENT;
            }
            config.collection = options->collection == SME_BLACK_KEY
                ? science_music::NoteCollection::BlackKey
                : science_music::NoteCollection::WhiteKey;

            if (options->root_pitch_class >= 0) {
                config.root_pitch_class = options->root_pitch_class;
            } else if (options->root_pitch_class != SME_AUTO) {
                return SME_INVALID_ARGUMENT;
            }

            if (options->mode == SME_MAJOR) {
                config.mode = science_music::TonalMode::Major;
            } else if (options->mode == SME_MINOR) {
                config.mode = science_music::TonalMode::Minor;
            } else if (options->mode != SME_AUTO) {
                return SME_INVALID_ARGUMENT;
            }

            config.enable_bass = options->enable_bass != 0;
            config.enable_pad = options->enable_pad != 0;
            config.enable_plucked = options->enable_plucked != 0;
            config.enable_analog = options->enable_analog != 0;
            config.enable_percussion = options->enable_percussion != 0;
        }

        std::vector<double> source;
        if (source_count > 0) {
            source.assign(source_values, source_values + source_count);
        }

        const science_music::IntelligenceEngine engine;
        const auto score = engine.generate(source, config);
        *output_count = score.events.size();

        if (output_tonality != nullptr) {
            output_tonality->root_pitch_class = score.tonality.root_pitch_class;
            output_tonality->root_midi = score.tonality.root_midi;
            output_tonality->collection = static_cast<int>(score.tonality.collection);
            output_tonality->mode = static_cast<int>(score.tonality.mode);
            output_tonality->confidence = score.tonality.confidence;
            output_tonality->center_was_manual = score.tonality.center_was_manual ? 1 : 0;
            output_tonality->mode_was_manual = score.tonality.mode_was_manual ? 1 : 0;
        }

        if (output_capacity < score.events.size()) return SME_BUFFER_TOO_SMALL;
        if (!score.events.empty() && output_events == nullptr) {
            return SME_BUFFER_TOO_SMALL;
        }

        for (size_t i = 0; i < score.events.size(); ++i) {
            const auto& input = score.events[i];
            auto& output = output_events[i];
            output.start_beat = input.start_beat;
            output.duration_beats = input.duration_beats;
            output.midi_pitch = input.midi_pitch;
            output.velocity = input.velocity;
            output.pan = input.pan;
            output.role = static_cast<int>(input.role);
            output.phrase_index = input.phrase_index;
            output.accent = input.accent ? 1 : 0;
        }
        return SME_OK;
    } catch (const std::invalid_argument&) {
        return SME_INVALID_ARGUMENT;
    } catch (...) {
        return SME_INTERNAL_ERROR;
    }
}


int sme_generate_score_packed(
    const double* source_values,
    uint32_t source_count,
    const uint32_t* option_values,
    uint32_t option_count,
    double* output_events,
    uint32_t output_capacity,
    uint32_t* output_count,
    double* output_tonality
) {
    if (output_count == nullptr) return SME_INVALID_ARGUMENT;
    *output_count = 0;

    if ((source_count > 0 && source_values == nullptr) ||
        option_values == nullptr ||
        option_count != SME_PACKED_OPTION_COUNT ||
        (output_capacity > 0 && output_events == nullptr)) {
        return SME_INVALID_ARGUMENT;
    }

    if (option_values[SME_PACKED_BPM] < 45U ||
        option_values[SME_PACKED_BPM] > 180U ||
        option_values[SME_PACKED_COLLECTION] > SME_BLACK_KEY ||
        option_values[SME_PACKED_ROOT] > 12U ||
        option_values[SME_PACKED_MODE] > 2U ||
        option_values[SME_PACKED_ENABLE_BASS] > 1U ||
        option_values[SME_PACKED_ENABLE_PAD] > 1U ||
        option_values[SME_PACKED_ENABLE_PLUCKED] > 1U ||
        option_values[SME_PACKED_ENABLE_ANALOG] > 1U ||
        option_values[SME_PACKED_ENABLE_PERCUSSION] > 1U) {
        return SME_INVALID_ARGUMENT;
    }

    try {
        SME_GenerationOptions options{};
        options.seed =
            static_cast<uint64_t>(option_values[SME_PACKED_SEED_LOW]) |
            (static_cast<uint64_t>(option_values[SME_PACKED_SEED_HIGH]) << 32U);
        options.bpm = static_cast<int>(option_values[SME_PACKED_BPM]);
        options.collection = static_cast<int>(option_values[SME_PACKED_COLLECTION]);
        options.root_pitch_class = option_values[SME_PACKED_ROOT] == 12U
            ? SME_AUTO
            : static_cast<int>(option_values[SME_PACKED_ROOT]);
        options.mode = option_values[SME_PACKED_MODE] == 2U
            ? SME_AUTO
            : static_cast<int>(option_values[SME_PACKED_MODE]);
        options.enable_bass = static_cast<int>(option_values[SME_PACKED_ENABLE_BASS]);
        options.enable_pad = static_cast<int>(option_values[SME_PACKED_ENABLE_PAD]);
        options.enable_plucked = static_cast<int>(option_values[SME_PACKED_ENABLE_PLUCKED]);
        options.enable_analog = static_cast<int>(option_values[SME_PACKED_ENABLE_ANALOG]);
        options.enable_percussion = static_cast<int>(option_values[SME_PACKED_ENABLE_PERCUSSION]);

        std::size_t required = 0;
        SME_TonalContext tonality{};
        const int query_status = sme_generate_score(
            source_values, static_cast<std::size_t>(source_count), &options,
            nullptr, 0, &required, &tonality
        );
        if (query_status != SME_BUFFER_TOO_SMALL && query_status != SME_OK) {
            return query_status;
        }
        if (required > UINT32_MAX) return SME_INTERNAL_ERROR;

        *output_count = static_cast<uint32_t>(required);
        if (output_tonality != nullptr) {
            output_tonality[0] = static_cast<double>(tonality.root_pitch_class);
            output_tonality[1] = static_cast<double>(tonality.root_midi);
            output_tonality[2] = static_cast<double>(tonality.collection);
            output_tonality[3] = static_cast<double>(tonality.mode);
            output_tonality[4] = tonality.confidence;
            output_tonality[5] = static_cast<double>(tonality.center_was_manual);
            output_tonality[6] = static_cast<double>(tonality.mode_was_manual);
        }

        if (output_capacity < required) return SME_BUFFER_TOO_SMALL;
        if (required > 0 && output_events == nullptr) return SME_INVALID_ARGUMENT;

        std::vector<SME_Event> events(required);
        std::size_t written = 0;
        const int fill_status = sme_generate_score(
            source_values, static_cast<std::size_t>(source_count), &options,
            events.empty() ? nullptr : events.data(), events.size(),
            &written, &tonality
        );
        if (fill_status != SME_OK) return fill_status;
        if (written != required) return SME_INTERNAL_ERROR;

        for (std::size_t i = 0; i < written; ++i) {
            const auto& event = events[i];
            double* packed = output_events + i * SME_PACKED_EVENT_STRIDE;
            packed[0] = event.start_beat;
            packed[1] = event.duration_beats;
            packed[2] = static_cast<double>(event.midi_pitch);
            packed[3] = event.velocity;
            packed[4] = event.pan;
            packed[5] = static_cast<double>(event.role);
            packed[6] = static_cast<double>(event.phrase_index);
            packed[7] = static_cast<double>(event.accent);
        }
        return SME_OK;
    } catch (...) {
        return SME_INTERNAL_ERROR;
    }
}

const char* sme_intelligence_version(void) {
    return "1.0.0";
}

} // extern "C"
