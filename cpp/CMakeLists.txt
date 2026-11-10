cmake_minimum_required(VERSION 3.16)
project(ScienceMusicIntelligence VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(science_music_intelligence STATIC
    src/intelligence.cpp
    src/c_api.cpp
    src/scientific_signal.cpp
    src/scientific_signal_c.cpp
)
target_include_directories(science_music_intelligence PUBLIC
    include
)
set_target_properties(science_music_intelligence PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(science_music_intelligence PRIVATE
        -Wall -Wextra -Wpedantic
    )
endif()

add_executable(science_music_demo examples/generate_demo.cpp)
target_link_libraries(science_music_demo PRIVATE science_music_intelligence)

add_executable(science_music_tests tests/intelligence_test.cpp)
target_link_libraries(science_music_tests PRIVATE science_music_intelligence)

add_executable(science_music_signal_tests tests/scientific_signal_test.cpp)
target_link_libraries(science_music_signal_tests PRIVATE science_music_intelligence)

enable_testing()
add_test(NAME science_music_intelligence_tests COMMAND science_music_tests)
add_test(NAME science_music_signal_tests COMMAND science_music_signal_tests)

if(EMSCRIPTEN)
    set(SME_WASM_OUTPUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../public/wasm" CACHE PATH
        "Directory for the browser-loadable WebAssembly module")
    file(MAKE_DIRECTORY "${SME_WASM_OUTPUT_DIR}")

    add_executable(science_music_wasm src/wasm_entry.cpp)
    target_link_libraries(science_music_wasm PRIVATE science_music_intelligence)
    set_target_properties(science_music_wasm PROPERTIES
        OUTPUT_NAME science_music_wasm
        RUNTIME_OUTPUT_DIRECTORY "${SME_WASM_OUTPUT_DIR}"
    )
    target_link_options(science_music_wasm PRIVATE
        "-sMODULARIZE=1"
        "-sEXPORT_ES6=1"
        "-sENVIRONMENT=web,worker,node"
        "-sALLOW_MEMORY_GROWTH=1"
        "-sNO_EXIT_RUNTIME=1"
        "-sFILESYSTEM=0"
        "-sEXPORTED_FUNCTIONS=['_main','_sme_generate_score_packed','_sme_analyze_signal_packed','_malloc','_free']"
    )
endif()
