#ifndef SCIENCE_MUSIC_INTELLIGENCE_C_H
#define SCIENCE_MUSIC_INTELLIGENCE_C_H
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

enum { SME_OK = 0, SME_BUFFER_TOO_SMALL = 1, SME_INVALID_ARGUMENT = -1, SME_INTERNAL_ERROR = -2 };
enum { SME_WHITE_KEY = 0, SME_BLACK_KEY = 1 };
enum { SME_MAJOR = 0, SME_MINOR = 1, SME_AUTO = -1 };
enum { SME_ROLE_LEAD = 0, SME_ROLE_BASS = 1, SME_ROLE_PAD = 2, SME_ROLE_PLUCKED = 3, SME_ROLE_ANALOG = 4, SME_ROLE_PERCUSSION = 5 };

typedef struct SME_GenerationOptions {
    uint64_t seed;
    int bpm;
    int collection;
    int root_pitch_class; /* -1 = automatic, otherwise 0..11 */
    int mode;              /* -1 = automatic, 0 = major, 1 = minor */
    int enable_bass;
    int enable_pad;
    int enable_plucked;
    int enable_analog;
    int enable_percussion;
} SME_GenerationOptions;

typedef struct SME_Event {
    double start_beat;
    double duration_beats;
    int midi_pitch;
    double velocity;
    double pan;
    int role;
    int phrase_index;
    int accent;
} SME_Event;

typedef struct SME_TonalContext {
    int root_pitch_class;
    int root_midi;
    int collection;
    int mode;
    double confidence;
    int center_was_manual;
    int mode_was_manual;
} SME_TonalContext;

/*
 * Generate a symbolic score from normalized mathematical source values.
 * Query required capacity with output_events=NULL and output_capacity=0.
 * source_values may be NULL only when source_count is zero. output_count is
 * required; options may be NULL to use defaults. No memory is retained.
 */
int sme_generate_score(
    const double* source_values,
    size_t source_count,
    const SME_GenerationOptions* options,
    SME_Event* output_events,
    size_t output_capacity,
    size_t* output_count,
    SME_TonalContext* output_tonality
);
/*
 * WebAssembly-friendly packed ABI. This avoids depending on compiler-specific
 * C struct layout when JavaScript writes directly into linear memory.
 *
 * option_values has SME_PACKED_OPTION_COUNT uint32 values:
 *   seed low word, seed high word, bpm, collection (0 white / 1 black),
 *   root (0..11, 12 = automatic), mode (0 major / 1 minor / 2 automatic),
 *   enable bass, pad, plucked, analog, percussion (each 0 or 1).
 *
 * output_events is output_capacity records of SME_PACKED_EVENT_STRIDE doubles:
 *   start beat, duration beats, MIDI pitch, velocity, pan, role,
 *   phrase index, accent.
 *
 * output_tonality, when non-null, receives SME_PACKED_TONALITY_STRIDE doubles:
 *   root pitch class, root MIDI, collection, mode, confidence,
 *   center-was-manual, mode-was-manual.
 *
 * Query required event capacity with output_events=NULL and capacity=0.
 * output_capacity is measured in events, not doubles. No memory is retained.
 */
enum {
    SME_PACKED_OPTION_COUNT = 11,
    SME_PACKED_EVENT_STRIDE = 8,
    SME_PACKED_TONALITY_STRIDE = 7,
    SME_PACKED_SEED_LOW = 0,
    SME_PACKED_SEED_HIGH = 1,
    SME_PACKED_BPM = 2,
    SME_PACKED_COLLECTION = 3,
    SME_PACKED_ROOT = 4,
    SME_PACKED_MODE = 5,
    SME_PACKED_ENABLE_BASS = 6,
    SME_PACKED_ENABLE_PAD = 7,
    SME_PACKED_ENABLE_PLUCKED = 8,
    SME_PACKED_ENABLE_ANALOG = 9,
    SME_PACKED_ENABLE_PERCUSSION = 10
};

int sme_generate_score_packed(
    const double* source_values,
    uint32_t source_count,
    const uint32_t* option_values,
    uint32_t option_count,
    double* output_events,
    uint32_t output_capacity,
    uint32_t* output_count,
    double* output_tonality
);

const char* sme_intelligence_version(void);

#ifdef __cplusplus
}
#endif
#endif
