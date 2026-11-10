cmake_minimum_required(VERSION 3.16)
project(ScienceMusicIntelligence VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(science_music_intelligence STATIC
    src/intelligence.cpp
    src/c_api.cpp
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

enable_testing()
add_test(NAME science_music_intelligence_tests COMMAND science_music_tests)
