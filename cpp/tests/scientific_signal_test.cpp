#include "science_music/scientific_signal.hpp"
#include "science_music/scientific_signal_c.h"
#include "science_music/intelligence.hpp"
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>
namespace {
constexpr double pi=3.14159265358979323846;
void require(bool ok,const std::string& message){if(!ok)throw std::runtime_error(message);}
science_music::ScientificSignal three_phase() {
    science_music::ScientificSignal s;s.sample_rate_hz=48000.0;s.channels.resize(3);
    for(auto& c:s.channels)c.reserve(4800);
    for(int i=0;i<4800;++i) {
        const double t=static_cast<double>(i)/s.sample_rate_hz,a=2*pi*60.0*t;
        s.channels[0].push_back(std::sin(a));
        s.channels[1].push_back(std::sin(a-2*pi/3));
        s.channels[2].push_back(std::sin(a+2*pi/3));
    }
    return s;
}
void test_frequency_phase_and_timeline() {
    const auto s=three_phase();science_music::SignalAnalysisOptions o;o.frame_count=16;
    const auto a=science_music::ScientificSignalAnalyzer{}.analyze(s,o);
    require(a.sample_count==4800&&a.channels.size()==3,"sample/channel metadata must be preserved");
    require(a.frames.size()==48&&a.relationships.size()==3,"all channel frames and pairs must be analyzed");
    for(const auto& c:a.channels) {
        require(c.dominant_period_samples==800,"60 Hz at 48 kHz must have an 800-sample period");
        require(std::abs(c.dominant_frequency_hz-60.0)<1e-9,"sample rate and period must recover 60 Hz");
        require(std::abs(c.rms-std::sqrt(0.5))<1e-6,"sine RMS must be close to 1/sqrt(2)");
        require(c.periodicity_strength>0.98,"clean periodic signals must have high periodicity confidence");
    }
    require(std::abs(a.relationships[0].phase_degrees-120.0)<1.0,"phase B relative to A must be about +120 degrees");
    require(std::abs(a.relationships[1].phase_degrees+120.0)<1.0,"phase C relative to A must be about -120 degrees");
    require(a.relationships[0].confidence>0.95,"phase confidence must be high for clean periodic channels");
    require(a.frames.front().start_sample==0&&a.frames.front().start_fraction==0.0,"first frame starts at zero");
    require(a.frames.back().end_sample==4800&&a.frames.back().end_fraction==1.0,"last frame ends at one");
}
void test_unknown_clock_and_constant_signal() {
    science_music::ScientificSignal s;s.channels={{0,1,0,1,0,1,0,1}};
    science_music::SignalAnalysisOptions o;o.frame_count=4;
    const auto periodic=science_music::ScientificSignalAnalyzer{}.analyze(s,o);
    require(periodic.channels[0].dominant_period_samples==2,"sample period must work without physical sample rate");
    require(periodic.channels[0].dominant_frequency_hz==0.0,"unknown sample clock must not invent Hz");
    s.channels={{4,4,4,4,4,4,4,4}};
    const auto constant=science_music::ScientificSignalAnalyzer{}.analyze(s,o);
    require(constant.channels[0].dominant_period_samples==0,"constant input must not invent a period");
}
void test_music_intelligence_reuses_signal_features() {
    std::vector<double> source;double x=0.314159;
    for(int i=0;i<128;++i){x=3.91*x*(1.0-x);source.push_back(x);}
    science_music::ScientificSignal s;s.channels.push_back(source);
    science_music::SignalAnalysisOptions o;o.frame_count=8;
    const auto analysis=science_music::ScientificSignalAnalyzer{}.analyze(s,o);
    const auto score=science_music::IntelligenceEngine{}.generate(source);
    require(score.section_profiles.size()==8,"musical intelligence retains eight analyzed source sections");
    for(std::size_t i=0;i<8;++i) {
        require(std::abs(score.section_profiles[i].rms-analysis.frames[i].rms)<1e-12,
            "conductor source profile RMS reuses the shared analyzer");
        require(std::abs(score.section_profiles[i].activity-analysis.frames[i].activity)<1e-12,
            "conductor source profile activity reuses the shared analyzer");
        require(score.section_profiles[i].periodicity_strength>=0.0&&
                score.section_profiles[i].periodicity_strength<=1.0,
            "periodicity confidence is bounded");
    }
}
void test_validation() {
    const science_music::ScientificSignalAnalyzer analyzer;science_music::ScientificSignal s;
    s.channels={{0,1,0},{0,1}};
    bool rejected=false;try{(void)analyzer.analyze(s);}catch(const std::invalid_argument&){rejected=true;}
    require(rejected,"mismatched channel lengths are rejected");
    s.channels={{0,std::numeric_limits<double>::quiet_NaN()}};
    rejected=false;try{(void)analyzer.analyze(s);}catch(const std::invalid_argument&){rejected=true;}
    require(rejected,"non-finite samples are rejected");
    s.channels={{0,1,0}};science_music::SignalAnalysisOptions o;o.frame_count=4;
    rejected=false;try{(void)analyzer.analyze(s,o);}catch(const std::invalid_argument&){rejected=true;}
    require(rejected,"frame count cannot exceed sample count");
}
void test_packed_abi() {
    const auto s=three_phase();std::vector<double> input;
    for(const auto& c:s.channels)input.insert(input.end(),c.begin(),c.end());
    std::uint32_t sc=0,fc=0,rc=0;
    const int query=sme_analyze_signal_packed(input.data(),4800,3,48000.0,16,
        nullptr,0,nullptr,0,nullptr,0,&sc,&fc,&rc);
    require(query==SME_BUFFER_TOO_SMALL&&sc==3&&fc==48&&rc==3,"packed query returns exact record counts");
    std::vector<double> summaries(sc*SME_SIGNAL_SUMMARY_STRIDE),frames(fc*SME_SIGNAL_FRAME_STRIDE),
        relations(rc*SME_SIGNAL_RELATIONSHIP_STRIDE);
    const int status=sme_analyze_signal_packed(input.data(),4800,3,48000.0,16,
        summaries.data(),sc,frames.data(),fc,relations.data(),rc,&sc,&fc,&rc);
    require(status==SME_OK,"packed C ABI fills adequate output buffers");
    require(std::abs(summaries[10]-60.0)<1e-9,"packed summary exposes physical frequency");
    require(std::abs(relations[4]-120.0)<1.0,"packed relationships expose phase");
    std::vector<double> tooSmall(fc*SME_SIGNAL_FRAME_STRIDE,-9.0);
    std::uint32_t a=0,b=0,c=0;
    const int small=sme_analyze_signal_packed(input.data(),4800,3,48000.0,16,
        summaries.data(),sc,tooSmall.data(),fc-1,relations.data(),rc,&a,&b,&c);
    require(small==SME_BUFFER_TOO_SMALL&&tooSmall[0]==-9.0,
        "undersized output buffers fail without partial writes");
}
}
int main(){
    try{
        test_frequency_phase_and_timeline();test_unknown_clock_and_constant_signal();
        test_music_intelligence_reuses_signal_features();test_validation();test_packed_abi();
        std::cout<<"All scientific signal tests passed.\n";return EXIT_SUCCESS;
    }catch(const std::exception& e){std::cerr<<"Scientific signal test failure: "<<e.what()<<'\n';return EXIT_FAILURE;}
}
