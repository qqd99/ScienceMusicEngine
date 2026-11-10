#include "science_music/intelligence.hpp"
#include "science_music/intelligence_c.h"

#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
std::vector<double> logistic_source(std::uint64_t seed) {
    const double unit = static_cast<double>(seed % 1000003ULL) / 1000003.0;
    double x = 0.18 + unit * 0.62;
    std::vector<double> values;
    values.reserve(128);
    for (int i = 0; i < 128; ++i) {
        x = 3.91 * x * (1.0 - x);
        values.push_back(x);
    }
    return values;
}

void write_csv(
    const science_music::CompositionPlan& score,
    const std::string& path
) {
    std::ofstream output(path);
    if (!output) throw std::runtime_error("Cannot open score output: " + path);
    output << std::setprecision(17);
    output << "start_beat,duration_beats,midi_pitch,velocity,pan,role,phrase_index,accent\n";
    for (const auto& event : score.events) {
        output << event.start_beat << ','
               << event.duration_beats << ','
               << event.midi_pitch << ','
               << event.velocity << ','
               << event.pan << ','
               << science_music::to_string(event.role) << ','
               << event.phrase_index << ','
               << (event.accent ? 1 : 0) << '\n';
    }
}
}

int main(int argc, char** argv) {
    science_music::GenerationOptions options;
    std::string output_path = "generative_score.csv";

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--seed" && i + 1 < argc) {
            options.seed = std::stoull(argv[++i]);
        } else if (arg == "--bpm" && i + 1 < argc) {
            options.bpm = std::stoi(argv[++i]);
        } else if (arg == "--collection" && i + 1 < argc) {
            const std::string value = argv[++i];
            if (value == "white") options.collection = science_music::NoteCollection::WhiteKey;
            else if (value == "black") options.collection = science_music::NoteCollection::BlackKey;
            else throw std::invalid_argument("--collection must be white or black");
        } else if (arg == "--root" && i + 1 < argc) {
            const std::string value = argv[++i];
            if (value != "auto") options.root_pitch_class = std::stoi(value);
        } else if (arg == "--mode" && i + 1 < argc) {
            const std::string value = argv[++i];
            if (value == "major") options.mode = science_music::TonalMode::Major;
            else if (value == "minor") options.mode = science_music::TonalMode::Minor;
            else if (value != "auto") throw std::invalid_argument("--mode must be auto, major or minor");
        } else if (arg == "--output" && i + 1 < argc) {
            output_path = argv[++i];
        } else if (arg == "--help") {
            std::cout
                << "Science Music Engine C++ intelligence demo\n"
                << "  --seed N --bpm N --collection white|black\n"
                << "  --root auto|0..11 --mode auto|major|minor\n"
                << "  --output score.csv\n";
            return 0;
        } else {
            throw std::invalid_argument("Unknown or incomplete argument: " + arg);
        }
    }

    const auto source = logistic_source(options.seed);
    const science_music::IntelligenceEngine engine;
    const auto score = engine.generate(source, options);
    write_csv(score, output_path);

    std::cout
        << "Science Music Engine C++ Musical Intelligence "
        << sme_intelligence_version() << '\n'
        << "Tonal center: MIDI " << score.tonality.root_midi
        << ", " << science_music::to_string(score.tonality.collection)
        << ", " << science_music::to_string(score.tonality.mode)
        << ", confidence " << score.tonality.confidence << '\n'
        << "Motif degrees: ";

    for (std::size_t i = 0; i < score.motif.degrees.size(); ++i) {
        if (i) std::cout << ',';
        std::cout << score.motif.degrees[i];
    }

    std::cout << "\nChord path: ";
    for (std::size_t i = 0; i < score.harmonic_progression.size(); ++i) {
        if (i) std::cout << '-';
        std::cout << score.harmonic_progression[i];
    }

    std::cout << "\nConductor decisions:\n";
    for (const auto& phrase : score.phrases) {
        std::cout << "  phrase " << phrase.index << " ("
                  << science_music::to_string(phrase.movement)
                  << ", density " << phrase.lead_density << "): ";
        if (phrase.active_support.empty()) {
            std::cout << "lead only";
        } else {
            for (std::size_t i = 0; i < phrase.active_support.size(); ++i) {
                if (i) std::cout << ", ";
                std::cout << science_music::to_string(phrase.active_support[i]);
            }
        }
        std::cout << '\n';
    }

    std::cout << "Generated " << score.events.size()
              << " symbolic events across " << score.bars
              << " bars. CSV: " << output_path << '\n';
    return 0;
}
