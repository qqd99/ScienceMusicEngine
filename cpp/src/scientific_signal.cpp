#include "science_music/scientific_signal.hpp"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>
namespace science_music { namespace {
constexpr std::size_t kMaxChannels=32, kMaxSamples=1000000;
constexpr std::uint32_t kMaxFrames=256;
constexpr double kEpsilon=1e-12, kPeriodThreshold=0.30;
double mean(const std::vector<double>& x) {
    return x.empty()?0.0:std::accumulate(x.begin(),x.end(),0.0)/x.size();
}
double rms(const std::vector<double>& x) {
    if(x.empty()) return 0.0;
    double sum=0.0; for(double v:x) sum+=v*v;
    return std::sqrt(sum/x.size());
}
double activity(const std::vector<double>& x) {
    if(x.size()<2) return 0.0;
    double sum=0.0; for(std::size_t i=1;i<x.size();++i) sum+=std::abs(x[i]-x[i-1]);
    return sum/(x.size()-1);
}
struct Detrended { std::vector<double> values; double slope=0.0; };
Detrended detrend(const std::vector<double>& x) {
    Detrended out; out.values.resize(x.size()); if(x.empty()) return out;
    const double m=mean(x), center=(x.size()-1)*0.5;
    double numerator=0.0, denominator=0.0;
    for(std::size_t i=0;i<x.size();++i) {
        const double at=static_cast<double>(i)-center;
        numerator+=at*(x[i]-m); denominator+=at*at;
    }
    out.slope=denominator>kEpsilon?numerator/denominator:0.0;
    for(std::size_t i=0;i<x.size();++i)
        out.values[i]=x[i]-m-out.slope*(static_cast<double>(i)-center);
    return out;
}
double correlation(const std::vector<double>& a,const std::vector<double>& b,int lag) {
    const std::size_t n=a.size();
    const std::size_t sa=lag<0?static_cast<std::size_t>(-lag):0;
    const std::size_t sb=lag>0?static_cast<std::size_t>(lag):0;
    if(sa>=n||sb>=n) return 0.0;
    const std::size_t overlap=n-std::max(sa,sb);
    if(overlap<2) return 0.0;
    double dot=0.0, ea=0.0, eb=0.0;
    for(std::size_t i=0;i<overlap;++i) {
        const double x=a[sa+i], y=b[sb+i];
        dot+=x*y; ea+=x*x; eb+=y*y;
    }
    const double den=std::sqrt(ea*eb);
    return den>kEpsilon?dot/den:0.0;
}
std::pair<std::uint32_t,double> period_of(const std::vector<double>& x) {
    if(x.size()<6) return {0,0.0};
    const std::size_t maxLag=x.size()/2;
    if(maxLag<3) return {0,0.0};
    std::vector<double> corr(maxLag+2,0.0);
    for(std::size_t lag=1;lag<=maxLag;++lag) {
        double dot=0.0,ea=0.0,eb=0.0;
        for(std::size_t i=0;i+lag<x.size();++i) {
            const double a=x[i],b=x[i+lag]; dot+=a*b;ea+=a*a;eb+=b*b;
        }
        const double den=std::sqrt(ea*eb);
        corr[lag]=den>kEpsilon?dot/den:0.0;
    }
    for(std::size_t lag=2;lag<maxLag;++lag) {
        const double v=corr[lag];
        if(v>=kPeriodThreshold&&v>=corr[lag-1]&&v>=corr[lag+1])
            return {static_cast<std::uint32_t>(lag),std::clamp(v,0.0,1.0)};
    }
    double best=0.0;std::size_t bestLag=0;
    for(std::size_t lag=2;lag<=maxLag;++lag) if(corr[lag]>best){best=corr[lag];bestLag=lag;}
    return best>=0.55?std::make_pair(static_cast<std::uint32_t>(bestLag),std::clamp(best,0.0,1.0))
                     :std::make_pair(0U,0.0);
}
SignalChannelSummary summarize(const std::vector<double>& x,double sampleRate) {
    SignalChannelSummary out;if(x.empty())return out;
    out.mean=mean(x);const auto mm=std::minmax_element(x.begin(),x.end());
    out.minimum=*mm.first;out.maximum=*mm.second;out.rms=rms(x);
    double variance=0.0;for(double v:x){const double d=v-out.mean;variance+=d*d;}
    out.standard_deviation=std::sqrt(variance/x.size());
    const auto dt=detrend(x);out.trend_per_sample=dt.slope;out.mean_absolute_delta=activity(x);
    if(x.size()>1) {
        std::size_t crossings=0;
        for(std::size_t i=1;i<x.size();++i) {
            const double a=x[i-1]-out.mean,b=x[i]-out.mean;
            if((a<0.0&&b>=0.0)||(a>=0.0&&b<0.0))++crossings;
        }
        out.zero_crossing_rate=static_cast<double>(crossings)/(x.size()-1);
    }
    const auto p=period_of(dt.values);out.dominant_period_samples=p.first;out.periodicity_strength=p.second;
    if(p.first&&sampleRate>0.0)out.dominant_frequency_hz=sampleRate/p.first;
    return out;
}
SignalFeatureFrame frame_of(const std::vector<double>& x,std::uint32_t channel,
                            std::size_t start,std::size_t end) {
    SignalFeatureFrame out;out.channel_index=channel;
    out.start_sample=static_cast<std::uint32_t>(start);out.end_sample=static_cast<std::uint32_t>(end);
    out.start_fraction=static_cast<double>(start)/x.size();
    out.end_fraction=static_cast<double>(end)/x.size();
    std::vector<double> w(x.begin()+static_cast<std::ptrdiff_t>(start),
                          x.begin()+static_cast<std::ptrdiff_t>(end));
    out.mean=mean(w);out.rms=rms(w);out.activity=activity(w);
    const auto mm=std::minmax_element(w.begin(),w.end());out.peak_to_peak=*mm.second-*mm.first;
    if(w.size()>1) {
        const std::size_t q=std::max<std::size_t>(1,w.size()/4);
        const double first=std::accumulate(w.begin(),w.begin()+static_cast<std::ptrdiff_t>(q),0.0)/q;
        const double last=std::accumulate(w.end()-static_cast<std::ptrdiff_t>(q),w.end(),0.0)/q;
        out.trend=last-first;
    }
    return out;
}
SignalRelationship relate(const std::vector<double>& x,const std::vector<double>& y,
                          const SignalChannelSummary& sx,const SignalChannelSummary& sy,
                          std::uint32_t a,std::uint32_t b) {
    SignalRelationship out;out.channel_a=a;out.channel_b=b;
    const auto dx=detrend(x).values,dy=detrend(y).values;
    out.zero_lag_correlation=correlation(dx,dy,0);
    if(!sx.dominant_period_samples||!sy.dominant_period_samples)return out;
    const double pa=sx.dominant_period_samples,pb=sy.dominant_period_samples;
    const double period=(pa+pb)*0.5;
    if(std::abs(pa-pb)>std::max(2.0,period*0.05))return out;
    const int radius=std::max(1,static_cast<int>(std::lround(period*0.5)));
    double best=-1.0;int bestLag=0;
    for(int lag=-radius;lag<=radius;++lag) {
        const double c=correlation(dx,dy,lag);
        if(c>best){best=c;bestLag=lag;}
    }
    if(best<=0.0)return out;
    out.lag_samples=bestLag;
    out.phase_degrees=std::remainder(out.lag_samples/period*360.0,360.0);
    out.confidence=std::clamp(best,0.0,1.0)*std::min(sx.periodicity_strength,sy.periodicity_strength);
    return out;
}
} // namespace

SignalAnalysis ScientificSignalAnalyzer::analyze(const ScientificSignal& signal,
                                                   const SignalAnalysisOptions& options) const {
    if(signal.channels.empty()||signal.channels.size()>kMaxChannels)
        throw std::invalid_argument("signal must contain between 1 and 32 channels");
    if(!std::isfinite(signal.sample_rate_hz)||signal.sample_rate_hz<0.0||signal.sample_rate_hz>1e9)
        throw std::invalid_argument("sample_rate_hz must be zero or finite and at most 1e9");
    const std::size_t n=signal.channels.front().size();
    if(n<2||n>kMaxSamples||signal.channels.size()*n>kMaxSamples)
        throw std::invalid_argument("signal sample count is outside the supported range");
    if(options.frame_count==0||options.frame_count>kMaxFrames||options.frame_count>n)
        throw std::invalid_argument("frame_count must be between 1 and min(256, sample_count)");
    for(const auto& channel:signal.channels) {
        if(channel.size()!=n)throw std::invalid_argument("all channels must have equal sample counts");
        if(std::any_of(channel.begin(),channel.end(),[](double v){return !std::isfinite(v);}))
            throw std::invalid_argument("signal samples must all be finite");
    }
    SignalAnalysis out;out.sample_count=static_cast<std::uint32_t>(n);out.sample_rate_hz=signal.sample_rate_hz;
    out.channels.reserve(signal.channels.size());
    out.frames.reserve(signal.channels.size()*options.frame_count);
    for(std::size_t c=0;c<signal.channels.size();++c) {
        const auto& samples=signal.channels[c];out.channels.push_back(summarize(samples,signal.sample_rate_hz));
        for(std::uint32_t f=0;f<options.frame_count;++f) {
            const std::size_t start=static_cast<std::size_t>(f)*n/options.frame_count;
            const std::size_t end=static_cast<std::size_t>(f+1)*n/options.frame_count;
            out.frames.push_back(frame_of(samples,static_cast<std::uint32_t>(c),start,end));
        }
    }
    for(std::size_t a=0;a<signal.channels.size();++a)
        for(std::size_t b=a+1;b<signal.channels.size();++b)
            out.relationships.push_back(relate(signal.channels[a],signal.channels[b],
                out.channels[a],out.channels[b],static_cast<std::uint32_t>(a),static_cast<std::uint32_t>(b)));
    return out;
}
} // namespace science_music
