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

const char* sme_intelligence_version(void) {
    return "1.0.0";
}

} // extern "C"
