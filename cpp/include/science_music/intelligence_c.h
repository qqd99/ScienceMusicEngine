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
const char* sme_intelligence_version(void);

#ifdef __cplusplus
}
#endif
#endif
