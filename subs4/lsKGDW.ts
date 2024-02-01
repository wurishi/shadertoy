import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// oilArt - Buf A/B
//
// Main audio decoder.
// Buf B is redundant and runs the same code as Buf A but reads slightly delayed
// audio stream to increase reliability when FPS drops or high sample rate is used.
//
// Audio stream is made up of 160 samples long packets that come in buckets of 6
// packets in a row needed to have stable frequency content within ~1000 sample wide
// window to minimize frequency masking during mp3 compression. Though SoundCloud
// is streaming 128 kBps mp3 @ 44.1 kHz, in reality its closer to FM radio quality
// with 32 kHz sample rate. Thus out of 80 available frequency bands only 61 are used.
// 
// Shadertoy reads content of web audio analyzer node and clamps input buffer to 512.
// Having 6x packet redundancy helps to remedy that as well. Additionally, some
// browsers like Firefox do some funky stuff to that buffer applying some pinching
// effect around some buffer boundaries once in a while making some packets unusable.
//
// Out of 61 frequency bands fundamental (carrier) is used for packet location,
// 4 bands are used to encode block location within the image using quantized phase,
// Then 48 DCT luminance coefficients are interleaved with 8 chrominance coefficients
// representing final 496x280 image plane that gets processed further.
//
// Currently, Shadertoy doesn't provide any access to current web audio sample rate.
// iSampleRate doesn't work correctly. To solve that a pilot tone is provided
// in the beginning of the stream, its period is measured and standard sample rates
// are deduced. Supported rates are 44.1, 48, 88.2, 96 kHz.
//
// The best case is 44.1 kHz @ 60 fps. When fps drops or sample rate increased then
// we will receive fewer packets and more sparsely. That takes more stream runs
// for image to form. Meanwhile, missing block reconstruction is performed.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define PI 3.14159265

#define BUFFER_SIZE 500
#define PACKET_SIZE 160
#define RESAMPLE_WINDOW_RADIUS 7

#define DO_MINIMIZE_ERROR 1

// Fourier transform utilities.

struct FFTBand
{
    vec2 di;
    vec2 df;
    vec2 f;
};

FFTBand FFTBand_create(const float n, const int fft_size)
{
    FFTBand band;

    float fi = (float(n) / float(fft_size / 2)) * float(fft_size) * 0.5;
    float angle = 2.0 * PI * fi / float(fft_size);

    band.di = vec2(cos(angle), sin(angle));
    band.df = vec2(1.0 / float(fft_size), 0.0);
    band.f  = vec2(0.0, 0.0);

    return band;
}

void FFTBand_update(inout FFTBand band, float value)
{
    band.f += band.df * value;
    band.df = vec2(
        band.df.x * band.di.x - band.df.y * band.di.y,
        band.df.y * band.di.x + band.df.x * band.di.y
        );
}

float FFTBand_amplitude(FFTBand band)
{
    return length(band.f);
}

float FFTBand_angle(FFTBand band)
{
    return degrees(atan(band.f.y, band.f.x));
}

// Additional helpers.

float decodePhase(float x)
{
    return mod(111.0 - x, 360.0) - 20.0;
}

float angDiff(float a, float b)
{
    return mod(a - b + 180.0, 360.0) - 180.0;
}

float windowedSinc(float x, float radius)
{
    float w = abs(x) < 0.001 ? 1.0 : sin(PI * x) / (PI * x);

    // Zero-phase Hamming window
    w *= 0.54 + 0.46 * cos(PI * x / radius);

    return w;
}

vec4 loadSelf(int x, int y)
{
    return textureLod(iChannel1, (vec2(x, y) + 0.5) / iChannelResolution[1].xy, 0.0);
}

//

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // Discard everything outside of working area
    // to increase performance.

    if (any(greaterThan(fragCoord, vec2(500, 280-60)))) discard;

    vec2 pos = floor(fragCoord);
    vec2 last_pos = pos;
    bool is_expecting_data  = iChannelTime[0] > 1.5;
    bool is_expecting_pilot = iChannelTime[0] > 1.1 && iChannelTime[0] < 1.5;

    // Propagate decoded data down the pipeline during reduction.

    last_pos.y -=
           (56.0 <= pos.y && pos.y < 56.0 + 16.0)
        || (40.0 <= pos.y && pos.y < 40.0 + 16.0)
        || (24.0 <= pos.y && pos.y < 24.0 + 16.0)
        ?
        16.0 : 0.0;

    vec4 last_color = loadSelf(int(last_pos.x), int(last_pos.y));

    fragColor = last_color;

    // Read detected sample rate.

    float sample_rate_index = floor(0.5 + loadSelf(0, 1).w);
    float sample_rate_khz = 44.1;

    sample_rate_khz = sample_rate_index == 2.0 ? 48.0 : sample_rate_khz;
    sample_rate_khz = sample_rate_index == 3.0 ? 88.2 : sample_rate_khz;
    sample_rate_khz = sample_rate_index == 4.0 ? 96.0 : sample_rate_khz;

    // Downsample incoming sound wave by reconstructing
    // continuous signal using windowed Sinc kernel
    // and resampling @ 44.1 kHz.
    // Supported rates are 44.1, 48, 88.2, 96 kHz.

    if (pos.y == 0.0
        // Bypass FFT during pilot and inject wave directly into phase channel.
        || (pos.y == 8.0 && is_expecting_pilot)
        )
    {
        float k = pos.x;

        // Do not resample during pilot as sample rate not yet known.

        if (is_expecting_data)
        {
            k *= sample_rate_khz / 44.1;
        }

        // Windowed Sinc reconstruction and resampling.

        float v = 0.0;
        float total_weight = 0.0;
        float f = fract(k);

        for (int n = -RESAMPLE_WINDOW_RADIUS; n <= RESAMPLE_WINDOW_RADIUS; n++)
        {
            float fn = float(n);
            float weight = windowedSinc(fn - f, float(RESAMPLE_WINDOW_RADIUS));

            float source_wave =
                texture(iChannel0, vec2((floor(k) + fn + 0.5) / iChannelResolution[0].x, 0.75)).x;

            v += weight * source_wave;
            total_weight += weight;
        }

        v /= total_weight;

        // Clear area outside of buffer with virtual zero.

        if (k >= float(BUFFER_SIZE)) v = 128.0 / 255.0;

        fragColor = vec4(v * 2.0 - 1.0);
    }

    // Perform Fourier transform and convert 160 samples @ 44.1 kHz
    // into 61 complex coefficients of orthogonal bases.
    // Though SoundCloud is streaming 128 kBps MP3 @ 44.1 kHz
    // in reality audio is cutoff at around 16.something kHz.
    // Encoder is aware of that and only 61 out of 80 bases are used.

    if (8.0 <= pos.y && pos.y < 8.0 + 16.0)
    {
        int i = int(pos.x);
        int line_index = int(pos.y - 8.0);

        //  0     : fundamental.xy, dcY.xy
        //  1     : block_pos.xy, 0, 0
        //  2..13 : 48 DCT luma   coefficients including DC
        // 14..15 :  8 DCT chroma coefficients

        FFTBand coeff[4];
        vec4    ic = vec4(0);

        if (line_index ==  0) ic = vec4( 1, 6, 0, 0);
        if (line_index ==  1) ic = vec4( 2, 3, 4, 5);
        if (line_index == 14) ic = vec4( 6, 7,14,15) + 6.0;
        if (line_index == 15) ic = vec4(22,23,30,31) + 6.0;

        if (2 <= line_index && line_index <= 13)
        {
            float icoeff4 = float(line_index - 2);
            vec4  idx = icoeff4 * 4.0 + vec4(0, 1, 2, 3);

            // Chrominance coefficients are interleaved with
            // luminance for safe failure.
            // Build indexes jumping over chroma when needed.

            ic = mix(idx + 8.0, mod(idx, vec4(6)) + 8.0 * floor(idx / vec4(6.0)), vec4(lessThan(idx, vec4(24)))) + 6.0;
        }

        coeff[0] = FFTBand_create(ic.x, PACKET_SIZE);
        coeff[1] = FFTBand_create(ic.y, PACKET_SIZE);
        coeff[2] = FFTBand_create(ic.z, PACKET_SIZE);
        coeff[3] = FFTBand_create(ic.w, PACKET_SIZE);

        for (int k = 0; k < PACKET_SIZE; k++)
        {
            float v = loadSelf(i + k, 0).w;

            FFTBand_update(coeff[0], v);
            FFTBand_update(coeff[1], v);
            FFTBand_update(coeff[2], v);
            FFTBand_update(coeff[3], v);
        }

        float cf[4];

        for (int k = 0; k < 4; k++)
        {
            // Coefficient sign is encoded in phase.

            float s = FFTBand_angle(coeff[k]) >= 0.0 ? 1.0 : -1.0;
            cf[k] = s * FFTBand_amplitude(coeff[k]) * 127.0;
        }

        if (line_index == 2)
        {
            // DC coefficient is encoded with reduced amplitude
            // to minimize frequency masking during mp3 encoding
            // and interfering with meta data.

            cf[0] *= 2.0;
        }

        fragColor = vec4(cf[0], cf[1], cf[2], cf[3]);

        if (line_index == 0)
        {
            // Store fundamental and DC components as raw complex numbers
            // required by packet locator.

            fragColor = vec4(coeff[0].f.xy, coeff[1].f.xy);
        }

        if (line_index == 1)
        {
            // Decode metadata.
            // Amplitude of a low frequency signal may be altered
            // by mp3 compression quite a lot and is unreliable.
            // However constant amplitude is less prone to that.
            // Use quantized phase instead to encode
            // low and high parts of block positions.

            vec4 phi = vec4(
                decodePhase(FFTBand_angle(coeff[0])),
                decodePhase(FFTBand_angle(coeff[1])),
                decodePhase(FFTBand_angle(coeff[2])),
                decodePhase(FFTBand_angle(coeff[3]))
                );
            vec4 amp = vec4(
                FFTBand_amplitude(coeff[0]),
                FFTBand_amplitude(coeff[1]),
                FFTBand_amplitude(coeff[2]),
                FFTBand_amplitude(coeff[3])
                );

            ivec4 op = ivec4(0.425 + (phi / 45.0));
            vec2  fp = vec2(op.xz * 8 + op.yw) / 64.0;

            // Amplitudes must be in expected range.

            const vec4 lvl = vec4(3.7 / 127.0);
            const vec4 th  = vec4(0.3 / 127.0);

            bool is_amp_ok = all(lessThan(abs(amp - lvl), th));
            fp = is_amp_ok ? fp : vec2(1000);

            fragColor = vec4(fp.xy, 0, 0);
        }

        if (i >= BUFFER_SIZE - PACKET_SIZE) fragColor = vec4(0);
    }

    // Locate packets in processed data.

    if (pos.y == 72.0)
    {
        int i = int(pos.x);

        fragColor = vec4(0);

        vec4 prev = loadSelf(i - 1, 8);
        vec4 curr = loadSelf(i    , 8);
        vec4 next = loadSelf(i + 1, 8);

        // Check if we are above expected noise level.

        bool has_carrier = length(curr.xy) > (100.0 / 32767.0);
        bool has_dc =
               length(curr.zw) > (120.0 / 32767.0)
            && length(prev.zw) > (120.0 / 32767.0)
            && length(next.zw) > (120.0 / 32767.0);

        // Use fundamental frequency for coarse synchronisation.
        // It is the lowerest frequency in the stream
        // and phase shifts may occur after mp3 compression.

        if (prev.x * curr.x <= 0.0 // carrier phase crosses 90 degree point
            && ((prev.x <= curr.x  // it's rising
                 && curr.x >= 0.0) // and it's 90 but not -90 degrees.
                || is_expecting_pilot)
            )
        {
            if (has_carrier)
            {
                bool  is_valid = true;
                float max_err = 16.0;

                // Use phase of DC wave for location refinement.

                float m = has_dc ? 99.0    : 45.0;
                vec2  p = has_dc ? prev.zw : prev.xy;
                vec2  c = has_dc ? curr.zw : curr.xy;
                vec2  n = has_dc ? next.zw : next.xy;

                float l2 = degrees(atan(p.y, p.x));
                float c2 = degrees(atan(c.y, c.x));
                float r2 = degrees(atan(n.y, n.x));

                float l2_0 = abs(angDiff(l2, 90.0));
                float c2_0 = abs(angDiff(c2, 90.0));
                float r2_0 = abs(angDiff(r2, 90.0));
                float l2_1 = abs(angDiff(l2,-90.0));
                float c2_1 = abs(angDiff(c2,-90.0));
                float r2_1 = abs(angDiff(r2,-90.0));

                m = min(min(m, min(l2_0, l2_1)), min(min(c2_0, c2_1), min(r2_0, r2_1)));

                int delta = 0;

                if (m == l2_0 || m == l2_1) delta = -1;
                if (m == r2_0 || m == r2_1) delta = +1;

                if (has_dc)
                {
                    is_valid = m < max_err;
                }
                else
                {
                    // Even though DC is bellow threshold and can't be used for refinement,
                    // it can still be used for error estimation.

                    c = (delta == -1 ? prev : delta == 1 ? next : curr).zw;

                    c2 = degrees(atan(c.y, c.x));
                    c2_0 = abs(angDiff(c2, 90.0));
                    c2_1 = abs(angDiff(c2,-90.0));

                    // Overestimate by 20% so that block that has_dc can override it.
                    m = min(c2_0, c2_1) * 1.2;
                }

                float err = 0.001 + m;

                if (is_expecting_data)
                {
                    // Additional validation to account for resampling.

                    is_valid = is_valid && (
                        pos.x > float(RESAMPLE_WINDOW_RADIUS + 1)
                        && pos.x < (float(BUFFER_SIZE) - float(PACKET_SIZE) * sample_rate_khz / 44.1
                            - float(RESAMPLE_WINDOW_RADIUS + 1))
                        );
                }

                fragColor = is_valid ? vec4(10.0 + float(delta), err, 0, 0) : fragColor;
            }

            if (is_expecting_pilot && pos.x < float(BUFFER_SIZE - PACKET_SIZE))
            {
                fragColor = vec4(10, 0, 0, 0);
            }
        }
    }

    // Transform location array into array of packet locations
    // by reduction over multiple frames.

    int px = 0;
    int py = 74;

    if (pos.y == 74.0) py = 73, px = int(pos.x);
    if (pos.y == 73.0) py = 72, px = int(pos.x);

    vec2 bp[8];
    {
        // bp[] is not really an array. Can't write to it in a loop. Unroll.
        #define IBP(k)IBP1(k)IBP2(k)IBP3(k)
        #define IBP1(k) bp[k] = loadSelf(px * 8 + k, py).xy;
        #define IBP2(k) bp[k].x = floor(bp[k].x);
        // Location array stores relative deltas that we need
        // to convert to absolute positions for later stages.
        #define IBP3(k) bp[k].x += pos.y == 73.0 && bp[k].x > 0.0 ? float(px * 8 + k) : 0.0;

        IBP(0)IBP(1)IBP(2)IBP(3)IBP(4)IBP(5)IBP(6)IBP(7)
    }

    if (pos.y == 73.0 || pos.y == 74.0)
    {
        // Blocks are sparse enough that we don't worry about collisions.
        // Just grab a single location. This could be improved.

        vec2 p = vec2(0.0, 1000.0);
        float cnt = 0.0;

        for (int k = 0; k < 8; k++)
        {
            p = bp[k].x > 0.0 ? bp[k] : p;
            cnt += bp[k].x > 0.0 ? 1.0 : 0.0;
        }

        // If we have more than one block per bin then something went wrong.
        // Packets can't be that close. Reject everything.
        p = cnt > 1.0 ? vec2(0.0, 1000.0) : p;

        fragColor = vec4(p, 0, 0);
    }

    // Copy located packets into corresponding image blocks.

    if (is_expecting_data)
    {
        vec2 cpos = ((pos - vec2(0, 140-60)) / 4.0);
        cpos.y = 34.0 - cpos.y;
        vec2 lpos = fract(cpos) * 4.0;
        cpos = floor(cpos);

        int icoeff = int(lpos.x + 4.0 * lpos.y);

        if (all(lessThan(cpos, vec2(64, 35))))
        {
        #if DO_MINIMIZE_ERROR
            ivec2 cp = ivec2(cpos.xy * 4.0);
            float old_err = loadSelf(cp.x, 140-60 + 140 - 4 - (cp.y + 3)).x;
            float err = old_err > 0.0 ? min(old_err, 100.0) : 100.0;
        #endif

            for (int k = 0; k < 8; k++)
            {
                if (all(greaterThan(bp[k], vec2(0))))
                {
                    int i = int(bp[k].x - 10.0);
                    vec2 bpos = floor(64.0 * loadSelf(i, 57).xy);

                    if (all(equal(bpos, cpos)))
                    {
                    #if DO_MINIMIZE_ERROR
                        // Generally it is true that the less the phase error
                        // of fundamental and DC waves the better the quality.
                        // We keep track of the error in current block
                        // and only accept new data when the error is smaller.

                        float new_err = bp[k].y;

                        if (new_err < err)
                        {
                            err = new_err;
                            fragColor = icoeff < 12 ? loadSelf(i, 58 + icoeff) : vec4(err);
                        }
                    #else

                        fragColor = icoeff < 12 ? loadSelf(i, 58 + icoeff) : vec4(0);
                    #endif                        
                    }
                }
            }
        }
    }

    // Predict chroma blocks that have not been received yet.
    // Chroma components are 1/8th size of the luminance and
    // get bilinearly interpolated to full resolution in the
    // next stage when combined with reconstructed luminance.
    // This is needed to minimize desaturated bleeding.

    if (255.0 <= pos.x && pos.x < 335.0
        && pos.y >= 145.0 - 60.0
        && last_color.w < 0.5
        )
    {
        int x = int(pos.x);
        int y = int(pos.y);

        vec3 l = loadSelf(x-1, y).rgb;
        vec3 r = loadSelf(x+1, y).rgb;
        vec3 t = loadSelf(x, y+1).rgb;
        vec3 b = loadSelf(x, y-1).rgb;

        fragColor = vec4((l + r + t + b) / 4.0, 0);
    }

    // Decode chrominance in-place.
    // CgCo components are coded at 1/8th size of luminance
    // and represented by 8 DCT coefficients total.
    // To take advantage of hardware filtering and simplify
    // final reconstruction, perform IDCT in-place.

    if (is_expecting_data)
    {
        vec2 cpos = ((pos.yx - vec2(150-60, 260)) / 2.0);
        vec2 lpos = fract(cpos) * 2.0;
        cpos = floor(cpos);

        if (all(lessThan(cpos, vec2(64, 35))))
        {
            for (int k = 0; k < 8; k++)
            {
                if (all(greaterThan(bp[k], vec2(0))))
                {
                    int i = int(bp[k].x - 10.0);
                    vec2 bpos = floor(64.0 * loadSelf(i, 57).xy);

                    if (all(equal(bpos, cpos)))
                    {
                        vec4 a = 0.25 * loadSelf(i, 58 + 12) / vec4(1,1,2,2);
                        vec4 b = 0.25 * loadSelf(i, 58 + 13) / vec4(3,3,4,4);
                        
                        vec2 val = vec2(0);
                        
                        val = all(equal(lpos, vec2(0,0))) ? a.xy + a.zw + b.xy + b.zw : val;
                        val = all(equal(lpos, vec2(1,0))) ? a.xy - a.zw + b.xy - b.zw : val;
                        val = all(equal(lpos, vec2(0,1))) ? a.xy + a.zw - b.xy - b.zw : val;
                        val = all(equal(lpos, vec2(1,1))) ? a.xy - a.zw - b.xy + b.zw : val;

                        fragColor = vec4(-val.x + val.y, val.x, -val.x - val.y, 1);
                    }
                }
            }
        }
    }

    // Detect sample rate by checking period of pure sine wave
    // at the beginning of stream.

    if (pos.y == 1.0)
    {
        float sample_rate_index = last_color.w;

        if (is_expecting_pilot)
        {
            float f = 0.0;
            float first_sync  = 0.0;
            float second_sync = 0.0;

            for (int k = 0; k < 8; k++)
            {
                bool sync = bp[k].x > 0.0;

                first_sync  = sync && f == 0.0 ? bp[k].x : first_sync;
                second_sync = sync && f == 1.0 ? bp[k].x : second_sync;

                f += sync ? 1.0 : 0.0;
            }

            if (first_sync > 0.0 && second_sync > 0.0)
            {
                // We are measuring half period actually.
                float size = 2.0 * (second_sync - first_sync);
                float id = 0.0;

                id = abs(size - 348.0) < 10.0 ? 4.0 : id; // 96.0
                id = abs(size - 320.0) < 10.0 ? 3.0 : id; // 88.2
                id = abs(size - 174.0) <  5.0 ? 2.0 : id; // 48.0
                id = abs(size - 160.0) <  5.0 ? 1.0 : id; // 44.1

                sample_rate_index = id > 0.0 ? id : sample_rate_index;
            }
        }

        fragColor.w = sample_rate_index;
    }
}

`;

const buffB = `
// oilArt - Buf A/B
//
// Main audio decoder.
// Buf B is redundant and runs the same code as Buf A but reads slightly delayed
// audio stream to increase reliability when FPS drops or high sample rate is used.
//
// Audio stream is made up of 160 samples long packets that come in buckets of 6
// packets in a row needed to have stable frequency content within ~1000 sample wide
// window to minimize frequency masking during mp3 compression. Though SoundCloud
// is streaming 128 kBps mp3 @ 44.1 kHz, in reality its closer to FM radio quality
// with 32 kHz sample rate. Thus out of 80 available frequency bands only 61 are used.
// 
// Shadertoy reads content of web audio analyzer node and clamps input buffer to 512.
// Having 6x packet redundancy helps to remedy that as well. Additionally, some
// browsers like Firefox do some funky stuff to that buffer applying some pinching
// effect around some buffer boundaries once in a while making some packets unusable.
//
// Out of 61 frequency bands fundamental (carrier) is used for packet location,
// 4 bands are used to encode block location within the image using quantized phase,
// Then 48 DCT luminance coefficients are interleaved with 8 chrominance coefficients
// representing final 496x280 image plane that gets processed further.
//
// Currently, Shadertoy doesn't provide any access to current web audio sample rate.
// iSampleRate doesn't work correctly. To solve that a pilot tone is provided
// in the beginning of the stream, its period is measured and standard sample rates
// are deduced. Supported rates are 44.1, 48, 88.2, 96 kHz.
//
// The best case is 44.1 kHz @ 60 fps. When fps drops or sample rate increased then
// we will receive fewer packets and more sparsely. That takes more stream runs
// for image to form. Meanwhile, missing block reconstruction is performed.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define PI 3.14159265

#define BUFFER_SIZE 500
#define PACKET_SIZE 160
#define RESAMPLE_WINDOW_RADIUS 7

#define DO_MINIMIZE_ERROR 1

// Fourier transform utilities.

struct FFTBand
{
    vec2 di;
    vec2 df;
    vec2 f;
};

FFTBand FFTBand_create(const float n, const int fft_size)
{
    FFTBand band;

    float fi = (float(n) / float(fft_size / 2)) * float(fft_size) * 0.5;
    float angle = 2.0 * PI * fi / float(fft_size);

    band.di = vec2(cos(angle), sin(angle));
    band.df = vec2(1.0 / float(fft_size), 0.0);
    band.f  = vec2(0.0, 0.0);

    return band;
}

void FFTBand_update(inout FFTBand band, float value)
{
    band.f += band.df * value;
    band.df = vec2(
        band.df.x * band.di.x - band.df.y * band.di.y,
        band.df.y * band.di.x + band.df.x * band.di.y
        );
}

float FFTBand_amplitude(FFTBand band)
{
    return length(band.f);
}

float FFTBand_angle(FFTBand band)
{
    return degrees(atan(band.f.y, band.f.x));
}

// Additional helpers.

float decodePhase(float x)
{
    return mod(111.0 - x, 360.0) - 20.0;
}

float angDiff(float a, float b)
{
    return mod(a - b + 180.0, 360.0) - 180.0;
}

float windowedSinc(float x, float radius)
{
    float w = abs(x) < 0.001 ? 1.0 : sin(PI * x) / (PI * x);

    // Zero-phase Hamming window
    w *= 0.54 + 0.46 * cos(PI * x / radius);

    return w;
}

vec4 loadSelf(int x, int y)
{
    return textureLod(iChannel1, (vec2(x, y) + 0.5) / iChannelResolution[1].xy, 0.0);
}

//

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // Discard everything outside of working area
    // to increase performance.

    if (any(greaterThan(fragCoord, vec2(500, 280-60)))) discard;

    vec2 pos = floor(fragCoord);
    vec2 last_pos = pos;
    bool is_expecting_data  = iChannelTime[0] > 1.5;
    bool is_expecting_pilot = iChannelTime[0] > 1.1 && iChannelTime[0] < 1.5;

    // Propagate decoded data down the pipeline during reduction.

    last_pos.y -=
           (56.0 <= pos.y && pos.y < 56.0 + 16.0)
        || (40.0 <= pos.y && pos.y < 40.0 + 16.0)
        || (24.0 <= pos.y && pos.y < 24.0 + 16.0)
        ?
        16.0 : 0.0;

    vec4 last_color = loadSelf(int(last_pos.x), int(last_pos.y));

    fragColor = last_color;

    // Read detected sample rate.

    float sample_rate_index = floor(0.5 + loadSelf(0, 1).w);
    float sample_rate_khz = 44.1;

    sample_rate_khz = sample_rate_index == 2.0 ? 48.0 : sample_rate_khz;
    sample_rate_khz = sample_rate_index == 3.0 ? 88.2 : sample_rate_khz;
    sample_rate_khz = sample_rate_index == 4.0 ? 96.0 : sample_rate_khz;

    // Downsample incoming sound wave by reconstructing
    // continuous signal using windowed Sinc kernel
    // and resampling @ 44.1 kHz.
    // Supported rates are 44.1, 48, 88.2, 96 kHz.

    if (pos.y == 0.0
        // Bypass FFT during pilot and inject wave directly into phase channel.
        || (pos.y == 8.0 && is_expecting_pilot)
        )
    {
        float k = pos.x;

        // Do not resample during pilot as sample rate not yet known.

        if (is_expecting_data)
        {
            k *= sample_rate_khz / 44.1;
        }

        // Windowed Sinc reconstruction and resampling.

        float v = 0.0;
        float total_weight = 0.0;
        float f = fract(k);

        for (int n = -RESAMPLE_WINDOW_RADIUS; n <= RESAMPLE_WINDOW_RADIUS; n++)
        {
            float fn = float(n);
            float weight = windowedSinc(fn - f, float(RESAMPLE_WINDOW_RADIUS));

            float source_wave =
                texture(iChannel0, vec2((floor(k) + fn + 0.5) / iChannelResolution[0].x, 0.75)).x;

            v += weight * source_wave;
            total_weight += weight;
        }

        v /= total_weight;

        // Clear area outside of buffer with virtual zero.

        if (k >= float(BUFFER_SIZE)) v = 128.0 / 255.0;

        fragColor = vec4(v * 2.0 - 1.0);
    }

    // Perform Fourier transform and convert 160 samples @ 44.1 kHz
    // into 61 complex coefficients of orthogonal bases.
    // Though SoundCloud is streaming 128 kBps MP3 @ 44.1 kHz
    // in reality audio is cutoff at around 16.something kHz.
    // Encoder is aware of that and only 61 out of 80 bases are used.

    if (8.0 <= pos.y && pos.y < 8.0 + 16.0)
    {
        int i = int(pos.x);
        int line_index = int(pos.y - 8.0);

        //  0     : fundamental.xy, dcY.xy
        //  1     : block_pos.xy, 0, 0
        //  2..13 : 48 DCT luma   coefficients including DC
        // 14..15 :  8 DCT chroma coefficients

        FFTBand coeff[4];
        vec4    ic = vec4(0);

        if (line_index ==  0) ic = vec4( 1, 6, 0, 0);
        if (line_index ==  1) ic = vec4( 2, 3, 4, 5);
        if (line_index == 14) ic = vec4( 6, 7,14,15) + 6.0;
        if (line_index == 15) ic = vec4(22,23,30,31) + 6.0;

        if (2 <= line_index && line_index <= 13)
        {
            float icoeff4 = float(line_index - 2);
            vec4  idx = icoeff4 * 4.0 + vec4(0, 1, 2, 3);

            // Chrominance coefficients are interleaved with
            // luminance for safe failure.
            // Build indexes jumping over chroma when needed.

            ic = mix(idx + 8.0, mod(idx, vec4(6)) + 8.0 * floor(idx / vec4(6.0)), vec4(lessThan(idx, vec4(24)))) + 6.0;
        }

        coeff[0] = FFTBand_create(ic.x, PACKET_SIZE);
        coeff[1] = FFTBand_create(ic.y, PACKET_SIZE);
        coeff[2] = FFTBand_create(ic.z, PACKET_SIZE);
        coeff[3] = FFTBand_create(ic.w, PACKET_SIZE);

        for (int k = 0; k < PACKET_SIZE; k++)
        {
            float v = loadSelf(i + k, 0).w;

            FFTBand_update(coeff[0], v);
            FFTBand_update(coeff[1], v);
            FFTBand_update(coeff[2], v);
            FFTBand_update(coeff[3], v);
        }

        float cf[4];

        for (int k = 0; k < 4; k++)
        {
            // Coefficient sign is encoded in phase.

            float s = FFTBand_angle(coeff[k]) >= 0.0 ? 1.0 : -1.0;
            cf[k] = s * FFTBand_amplitude(coeff[k]) * 127.0;
        }

        if (line_index == 2)
        {
            // DC coefficient is encoded with reduced amplitude
            // to minimize frequency masking during mp3 encoding
            // and interfering with meta data.

            cf[0] *= 2.0;
        }

        fragColor = vec4(cf[0], cf[1], cf[2], cf[3]);

        if (line_index == 0)
        {
            // Store fundamental and DC components as raw complex numbers
            // required by packet locator.

            fragColor = vec4(coeff[0].f.xy, coeff[1].f.xy);
        }

        if (line_index == 1)
        {
            // Decode metadata.
            // Amplitude of a low frequency signal may be altered
            // by mp3 compression quite a lot and is unreliable.
            // However constant amplitude is less prone to that.
            // Use quantized phase instead to encode
            // low and high parts of block positions.

            vec4 phi = vec4(
                decodePhase(FFTBand_angle(coeff[0])),
                decodePhase(FFTBand_angle(coeff[1])),
                decodePhase(FFTBand_angle(coeff[2])),
                decodePhase(FFTBand_angle(coeff[3]))
                );
            vec4 amp = vec4(
                FFTBand_amplitude(coeff[0]),
                FFTBand_amplitude(coeff[1]),
                FFTBand_amplitude(coeff[2]),
                FFTBand_amplitude(coeff[3])
                );

            ivec4 op = ivec4(0.425 + (phi / 45.0));
            vec2  fp = vec2(op.xz * 8 + op.yw) / 64.0;

            // Amplitudes must be in expected range.

            const vec4 lvl = vec4(3.7 / 127.0);
            const vec4 th  = vec4(0.3 / 127.0);

            bool is_amp_ok = all(lessThan(abs(amp - lvl), th));
            fp = is_amp_ok ? fp : vec2(1000);

            fragColor = vec4(fp.xy, 0, 0);
        }

        if (i >= BUFFER_SIZE - PACKET_SIZE) fragColor = vec4(0);
    }

    // Locate packets in processed data.

    if (pos.y == 72.0)
    {
        int i = int(pos.x);

        fragColor = vec4(0);

        vec4 prev = loadSelf(i - 1, 8);
        vec4 curr = loadSelf(i    , 8);
        vec4 next = loadSelf(i + 1, 8);

        // Check if we are above expected noise level.

        bool has_carrier = length(curr.xy) > (100.0 / 32767.0);
        bool has_dc =
               length(curr.zw) > (120.0 / 32767.0)
            && length(prev.zw) > (120.0 / 32767.0)
            && length(next.zw) > (120.0 / 32767.0);

        // Use fundamental frequency for coarse synchronisation.
        // It is the lowerest frequency in the stream
        // and phase shifts may occur after mp3 compression.

        if (prev.x * curr.x <= 0.0 // carrier phase crosses 90 degree point
            && ((prev.x <= curr.x  // it's rising
                 && curr.x >= 0.0) // and it's 90 but not -90 degrees.
                || is_expecting_pilot)
            )
        {
            if (has_carrier)
            {
                bool  is_valid = true;
                float max_err = 16.0;

                // Use phase of DC wave for location refinement.

                float m = has_dc ? 99.0    : 45.0;
                vec2  p = has_dc ? prev.zw : prev.xy;
                vec2  c = has_dc ? curr.zw : curr.xy;
                vec2  n = has_dc ? next.zw : next.xy;

                float l2 = degrees(atan(p.y, p.x));
                float c2 = degrees(atan(c.y, c.x));
                float r2 = degrees(atan(n.y, n.x));

                float l2_0 = abs(angDiff(l2, 90.0));
                float c2_0 = abs(angDiff(c2, 90.0));
                float r2_0 = abs(angDiff(r2, 90.0));
                float l2_1 = abs(angDiff(l2,-90.0));
                float c2_1 = abs(angDiff(c2,-90.0));
                float r2_1 = abs(angDiff(r2,-90.0));

                m = min(min(m, min(l2_0, l2_1)), min(min(c2_0, c2_1), min(r2_0, r2_1)));

                int delta = 0;

                if (m == l2_0 || m == l2_1) delta = -1;
                if (m == r2_0 || m == r2_1) delta = +1;

                if (has_dc)
                {
                    is_valid = m < max_err;
                }
                else
                {
                    // Even though DC is bellow threshold and can't be used for refinement,
                    // it can still be used for error estimation.

                    c = (delta == -1 ? prev : delta == 1 ? next : curr).zw;

                    c2 = degrees(atan(c.y, c.x));
                    c2_0 = abs(angDiff(c2, 90.0));
                    c2_1 = abs(angDiff(c2,-90.0));

                    // Overestimate by 20% so that block that has_dc can override it.
                    m = min(c2_0, c2_1) * 1.2;
                }

                float err = 0.001 + m;

                if (is_expecting_data)
                {
                    // Additional validation to account for resampling.

                    is_valid = is_valid && (
                        pos.x > float(RESAMPLE_WINDOW_RADIUS + 1)
                        && pos.x < (float(BUFFER_SIZE) - float(PACKET_SIZE) * sample_rate_khz / 44.1
                            - float(RESAMPLE_WINDOW_RADIUS + 1))
                        );
                }

                fragColor = is_valid ? vec4(10.0 + float(delta), err, 0, 0) : fragColor;
            }

            if (is_expecting_pilot && pos.x < float(BUFFER_SIZE - PACKET_SIZE))
            {
                fragColor = vec4(10, 0, 0, 0);
            }
        }
    }

    // Transform location array into array of packet locations
    // by reduction over multiple frames.

    int px = 0;
    int py = 74;

    if (pos.y == 74.0) py = 73, px = int(pos.x);
    if (pos.y == 73.0) py = 72, px = int(pos.x);

    vec2 bp[8];
    {
        // bp[] is not really an array. Can't write to it in a loop. Unroll.
        #define IBP(k)IBP1(k)IBP2(k)IBP3(k)
        #define IBP1(k) bp[k] = loadSelf(px * 8 + k, py).xy;
        #define IBP2(k) bp[k].x = floor(bp[k].x);
        // Location array stores relative deltas that we need
        // to convert to absolute positions for later stages.
        #define IBP3(k) bp[k].x += pos.y == 73.0 && bp[k].x > 0.0 ? float(px * 8 + k) : 0.0;

        IBP(0)IBP(1)IBP(2)IBP(3)IBP(4)IBP(5)IBP(6)IBP(7)
    }

    if (pos.y == 73.0 || pos.y == 74.0)
    {
        // Blocks are sparse enough that we don't worry about collisions.
        // Just grab a single location. This could be improved.

        vec2 p = vec2(0.0, 1000.0);
        float cnt = 0.0;

        for (int k = 0; k < 8; k++)
        {
            p = bp[k].x > 0.0 ? bp[k] : p;
            cnt += bp[k].x > 0.0 ? 1.0 : 0.0;
        }

        // If we have more than one block per bin then something went wrong.
        // Packets can't be that close. Reject everything.
        p = cnt > 1.0 ? vec2(0.0, 1000.0) : p;

        fragColor = vec4(p, 0, 0);
    }

    // Copy located packets into corresponding image blocks.

    if (is_expecting_data)
    {
        vec2 cpos = ((pos - vec2(0, 140-60)) / 4.0);
        cpos.y = 34.0 - cpos.y;
        vec2 lpos = fract(cpos) * 4.0;
        cpos = floor(cpos);

        int icoeff = int(lpos.x + 4.0 * lpos.y);

        if (all(lessThan(cpos, vec2(64, 35))))
        {
        #if DO_MINIMIZE_ERROR
            ivec2 cp = ivec2(cpos.xy * 4.0);
            float old_err = loadSelf(cp.x, 140-60 + 140 - 4 - (cp.y + 3)).x;
            float err = old_err > 0.0 ? min(old_err, 100.0) : 100.0;
        #endif

            for (int k = 0; k < 8; k++)
            {
                if (all(greaterThan(bp[k], vec2(0))))
                {
                    int i = int(bp[k].x - 10.0);
                    vec2 bpos = floor(64.0 * loadSelf(i, 57).xy);

                    if (all(equal(bpos, cpos)))
                    {
                    #if DO_MINIMIZE_ERROR
                        // Generally it is true that the less the phase error
                        // of fundamental and DC waves the better the quality.
                        // We keep track of the error in current block
                        // and only accept new data when the error is smaller.

                        float new_err = bp[k].y;

                        if (new_err < err)
                        {
                            err = new_err;
                            fragColor = icoeff < 12 ? loadSelf(i, 58 + icoeff) : vec4(err);
                        }
                    #else

                        fragColor = icoeff < 12 ? loadSelf(i, 58 + icoeff) : vec4(0);
                    #endif                        
                    }
                }
            }
        }
    }

    // Predict chroma blocks that have not been received yet.
    // Chroma components are 1/8th size of the luminance and
    // get bilinearly interpolated to full resolution in the
    // next stage when combined with reconstructed luminance.
    // This is needed to minimize desaturated bleeding.

    if (255.0 <= pos.x && pos.x < 335.0
        && pos.y >= 145.0 - 60.0
        && last_color.w < 0.5
        )
    {
        int x = int(pos.x);
        int y = int(pos.y);

        vec3 l = loadSelf(x-1, y).rgb;
        vec3 r = loadSelf(x+1, y).rgb;
        vec3 t = loadSelf(x, y+1).rgb;
        vec3 b = loadSelf(x, y-1).rgb;

        fragColor = vec4((l + r + t + b) / 4.0, 0);
    }

    // Decode chrominance in-place.
    // CgCo components are coded at 1/8th size of luminance
    // and represented by 8 DCT coefficients total.
    // To take advantage of hardware filtering and simplify
    // final reconstruction, perform IDCT in-place.

    if (is_expecting_data)
    {
        vec2 cpos = ((pos.yx - vec2(150-60, 260)) / 2.0);
        vec2 lpos = fract(cpos) * 2.0;
        cpos = floor(cpos);

        if (all(lessThan(cpos, vec2(64, 35))))
        {
            for (int k = 0; k < 8; k++)
            {
                if (all(greaterThan(bp[k], vec2(0))))
                {
                    int i = int(bp[k].x - 10.0);
                    vec2 bpos = floor(64.0 * loadSelf(i, 57).xy);

                    if (all(equal(bpos, cpos)))
                    {
                        vec4 a = 0.25 * loadSelf(i, 58 + 12) / vec4(1,1,2,2);
                        vec4 b = 0.25 * loadSelf(i, 58 + 13) / vec4(3,3,4,4);
                        
                        vec2 val = vec2(0);
                        
                        val = all(equal(lpos, vec2(0,0))) ? a.xy + a.zw + b.xy + b.zw : val;
                        val = all(equal(lpos, vec2(1,0))) ? a.xy - a.zw + b.xy - b.zw : val;
                        val = all(equal(lpos, vec2(0,1))) ? a.xy + a.zw - b.xy - b.zw : val;
                        val = all(equal(lpos, vec2(1,1))) ? a.xy - a.zw - b.xy + b.zw : val;

                        fragColor = vec4(-val.x + val.y, val.x, -val.x - val.y, 1);
                    }
                }
            }
        }
    }

    // Detect sample rate by checking period of pure sine wave
    // at the beginning of stream.

    if (pos.y == 1.0)
    {
        float sample_rate_index = last_color.w;

        if (is_expecting_pilot)
        {
            float f = 0.0;
            float first_sync  = 0.0;
            float second_sync = 0.0;

            for (int k = 0; k < 8; k++)
            {
                bool sync = bp[k].x > 0.0;

                first_sync  = sync && f == 0.0 ? bp[k].x : first_sync;
                second_sync = sync && f == 1.0 ? bp[k].x : second_sync;

                f += sync ? 1.0 : 0.0;
            }

            if (first_sync > 0.0 && second_sync > 0.0)
            {
                // We are measuring half period actually.
                float size = 2.0 * (second_sync - first_sync);
                float id = 0.0;

                id = abs(size - 348.0) < 10.0 ? 4.0 : id; // 96.0
                id = abs(size - 320.0) < 10.0 ? 3.0 : id; // 88.2
                id = abs(size - 174.0) <  5.0 ? 2.0 : id; // 48.0
                id = abs(size - 160.0) <  5.0 ? 1.0 : id; // 44.1

                sample_rate_index = id > 0.0 ? id : sample_rate_index;
            }
        }

        fragColor.w = sample_rate_index;
    }
    fragColor.w = 1.;
}

`;

const buffC = `
// oilArt - Buf C
//
// Take DCT luminance coefficients from decoders that correspond to blocks with
// smaller error, perform standard JPEG-like de-zigzagging and apply
// Inverse Discrete Cosine Transform (IDCT) to get reconstructed luminance.
// Then add interpolated chrominance that was reconstructed by corresponding
// decoder to build final 496x280 image.
//
// Perform continious reconstruction (fill-in) of missing blocks in a stylized way
// by scattering exising blocks around. And play brush-like revealing effect
// on newly arrived blocks.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define STYLIZED_FILLIN    1
#define DO_FILLIN_MISSING  1
#define DO_PAINING_EFFECT  1
#define DO_DUAL_DECODING   1

#define PI 3.14159265

vec4 loadA(int x, int y)
{
    return textureLod(iChannel0, (vec2(x, y) + 0.5) / iChannelResolution[0].xy, 0.0);
}

vec4 loadB(int x, int y)
{
    return textureLod(iChannel1, (vec2(x, y) + 0.5) / iChannelResolution[1].xy, 0.0);
}

vec4 sampleSelf(vec2 pos)
{
    return textureLod(iChannel2, pos / iChannelResolution[2].xy, 0.0);
}

vec4 dct(vec2 cpos, vec4 x, vec4 y)
{
    vec4 wx = 2.0 * cos(PI * x * float(cpos.x * 2.0 + 1.0) / 16.0);
    vec4 wy = 2.0 * cos(PI * y * float(cpos.y * 2.0 + 1.0) / 16.0);

    const float a = 0.17677669; // sqrt(1.0 / (4.0 * 8.0));
    const float b = 0.25;       // sqrt(1.0 / (2.0 * 8.0));

    wx.x *= x.x == 0.0 ? a : b;
    wx.y *= x.y == 0.0 ? a : b;
    wx.z *= x.z == 0.0 ? a : b;
    wx.w *= x.w == 0.0 ? a : b;

    wy.x *= y.x == 0.0 ? a : b;
    wy.y *= y.y == 0.0 ? a : b;
    wy.z *= y.z == 0.0 ? a : b;
    wy.w *= y.w == 0.0 ? a : b;

    return wx * wy;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (any(greaterThan(fragCoord, vec2(500, 280)))) discard;

    vec2 bpos = floor(fragCoord / 8.0);
    vec2 cpos = fract(floor(fragCoord) / 8.0) * 8.0;
    cpos.y = 7.0 - cpos.y;

    vec4 old = sampleSelf(bpos * 8.0 + 0.5);

    int cx = int(bpos.x * 4.0);
    int cy = int(bpos.y * 4.0) + 140-60;

    vec4 chroma = vec4(0);
    vec4 val4 = vec4(0);
    vec4 c[12];

    bool is_best_A = true;
    float blockA = loadA(cx+0, cy-3).x;
    float blockB = loadB(cx+0, cy-3).x;

#if DO_DUAL_DECODING
    // Take the best result of two decoders.

    if (blockA > 0.0 && blockB > 0.0)
    {
        is_best_A = blockA <= blockB;
    }
    else if (blockA > 0.0)
    {
        is_best_A = true;
    }
    else
    {
        is_best_A = false;
    }
#else
    is_best_A = true;
#endif

    if (is_best_A)
    {
        chroma = texture(iChannel0, (vec2(260+70, 150-60) + vec2(-1,1) * fragCoord.yx / 4.0) / iChannelResolution[0].xy);
    }
#if DO_DUAL_DECODING
    else
    {
        chroma = texture(iChannel1, (vec2(260+70, 150-60) + vec2(-1,1) * fragCoord.yx / 4.0) / iChannelResolution[1].xy);
    }

    #define C(x,y) (is_best_A ? loadA(cx+x, cy+y) : loadB(cx+x, cy+y))
#else
    #define C(x,y) (loadA(cx+x, cy+y))
#endif

    // 8x8 IDCT of luminance with standard Jpeg zigzag.

    val4 += C(0, 0) * dct(cpos, vec4(0,1,0,0), vec4(0,0,1,2));
    val4 += C(1, 0) * dct(cpos, vec4(1,2,3,2), vec4(1,0,0,1));
    val4 += C(2, 0) * dct(cpos, vec4(1,0,0,1), vec4(2,3,4,3));
    val4 += C(3, 0) * dct(cpos, vec4(2,3,4,5), vec4(2,1,0,0));
    val4 += C(0,-1) * dct(cpos, vec4(4,3,2,1), vec4(1,2,3,4));
    val4 += C(1,-1) * dct(cpos, vec4(0,0,1,2), vec4(5,6,5,4));
    val4 += C(2,-1) * dct(cpos, vec4(3,4,5,6), vec4(3,2,1,0));
    val4 += C(3,-1) * dct(cpos, vec4(7,6,5,4), vec4(0,1,2,3));
    val4 += C(0,-2) * dct(cpos, vec4(3,2,1,0), vec4(4,5,6,7));
    val4 += C(1,-2) * dct(cpos, vec4(1,2,3,4), vec4(7,6,5,4));
    val4 += C(2,-2) * dct(cpos, vec4(5,6,7,7), vec4(3,2,1,2));
    val4 += C(3,-2) * dct(cpos, vec4(6,5,4,3), vec4(3,4,5,6));

    float val = 0.5 + dot(val4, vec4(0.135));

    fragColor = vec4(clamp(val + chroma * 0.55, 0.0, 1.0));

#if DO_PAINING_EFFECT
    // Simple brush-like strokes in empty areas.

    vec2 offs = vec2(
        cos((fragCoord.x + fragCoord.y) * 0.05) * 3.0 + 0.0 -
        cos((fragCoord.x + fragCoord.y) * 3.47) * 0.5,
        sin((fragCoord.x - fragCoord.y) * 0.05) * 3.0 + 3.0 -
        sin((fragCoord.x - fragCoord.y) * 3.47) * 0.5
        );

    float noise = textureLod(iChannel3, (floor(fragCoord) + 0.5) / iChannelResolution[3].xy, 0.0).x;
    vec4 prev = sampleSelf(fragCoord + offs * (0.1 + 0.9 * noise));

    fragColor.rgb = mix(prev.rgb, fragColor.rgb, old.a * old.a);
#endif

    fragColor.rgb = clamp(fragColor.rgb, 0.0, 1.0);

#if DO_FILLIN_MISSING || DO_PAINING_EFFECT
    float block = is_best_A ? blockA : blockB;

    fragColor.a = old.a;

    if (block <= 0.0001)
    {
    #if STYLIZED_FILLIN
        vec2 noise2 = texture(iChannel3, (floor(fragCoord * 1.9) + 0.5) / iChannelResolution[3].xy).xy;
        fragCoord += (noise2 * 2.0 - 1.0) * 2.5;
        fragCoord = min(fragCoord, vec2(498, 278));
    #endif

        // Diffuse surrounding if block doesn't exist.

        fragCoord = min(fragCoord, vec2(498, 278));

        vec3 c  = sampleSelf(fragCoord).rgb;
        vec3 v0 = sampleSelf(fragCoord + vec2(-1, 0)).rgb;
        vec3 v1 = sampleSelf(fragCoord + vec2( 1, 0)).rgb;
        vec3 v2 = sampleSelf(fragCoord + vec2( 0,-1)).rgb;
        vec3 v3 = sampleSelf(fragCoord + vec2( 0, 1)).rgb;

        vec3 avg = (v0 + v1 + v2 + v3) * 0.25;
        float wx = abs(v0.g - v1.g);
        float wy = abs(v2.g - v3.g);

        // Make it less uniform by using horizontal and vertical gradients.
    #if DO_FILLIN_MISSING
        fragColor.xyz = wx > wy ?
              mix(avg, (v0 + v1) * 0.5, 0.75)
            : mix(avg, (v2 + v3) * 0.5, 0.75);

        fragColor.rgb = mix(fragColor.rgb, (v3 * 8.0 + v2 * 6.0 + v0 + v1) / 16.0, 0.5);
    #endif
    }
    else
    {
        // Advance time of existing block for painting effect.
        fragColor.a = min(1.0, old.a + (1.0 / 45.0));
    }
#endif

    // Initialize with paper color.
    fragColor = iFrame == 0 ? vec4(0.815, 0.815, 0.815, 0) : fragColor;

    fragColor.a = 1.;
}

`;

const fragment = `
// oilArt - Image
//
// Final shader in the pipeline. Draw thumbnail when resolution is too small
// or when in sort of preview mode. Fit image to avoid cropping.
// Increase sharpness and additionally refine edges without introducing ringing.
// Render decoder's internal state for debugging.
// 
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define DO_SHARPEN       1
#define DO_OILIFY        1

#define DEBUG_DECODER    0
#define DEBUG_SAMPLERATE 0

//

void drawThumbnail(out vec4 fragColor, in vec2 fragCoord)
{
    // 3rd order 2D polynomial.

    vec3 c0  = vec3(  0.94,  0.70,  0.43);
    vec3 c1  = vec3(  0.41,  0.52, -0.06);
    vec3 c2  = vec3( -1.39, -0.94,  2.21);
    vec3 c3  = vec3(  0.78,  0.51, -1.62);
    vec3 c4  = vec3( -0.75, -0.96, -0.79);
    vec3 c5  = vec3(  6.46, 10.74,  1.49);
    vec3 c6  = vec3(-11.55,-21.27, -0.07);
    vec3 c7  = vec3(  5.77, 11.48, -0.64);
    vec3 c8  = vec3(  1.14,  1.16,  3.35);
    vec3 c9  = vec3(-11.94,-22.10,-14.41);
    vec3 c10 = vec3( 23.46, 48.26, 21.20);
    vec3 c11 = vec3(-12.36,-27.09,-10.25);
    vec3 c12 = vec3( -0.70, -0.62, -2.90);
    vec3 c13 = vec3(  5.93, 12.16, 14.62);
    vec3 c14 = vec3(-11.05,-26.58,-24.21);
    vec3 c15 = vec3(  5.60, 14.77, 12.52);

    vec2  t = floor(fragCoord / 12.0) * 12.0 / iResolution.xy;
    float x = t.x;
    float y = 1.0 - t.y;

    vec3 f = vec3(
           ( c0 + ( c1 + ( c2 +  c3*x)*x)*x) +
        y*(( c4 + ( c5 + ( c6 +  c7*x)*x)*x) +
        y*(( c8 + ( c9 + (c10 + c11*x)*x)*x) +
        y*( c12 + (c13 + (c14 + c15*x)*x)*x))));

    vec3 clr = smoothstep(0.0, 1.0, f*f*f*f);

    // Playback triangle.

    vec2 tc = fragCoord / iResolution.xy;
    vec2 p = 1.5 * (tc - 0.5) * vec2(1.0, iResolution.y / iResolution.x);
    float d = length( p );

    clr = mix(clr, vec3(0), 0.6 * clamp(23.0 - 128.0 * d, 0.0, 1.0));
    clr = mix(clr, vec3(1), clamp(3.0 - 128.0 * abs(0.5 - d * 3.0), 0.0, 1.0));

    p *= 1.5;
    p += vec2(0.06, 0);

    float m = dot(p, vec2(2.0, 0.0));
    m = min(m, dot(p + vec2(0.0, 0.15), vec2(-0.8, 1.0)));
    m = min(m, dot(p + vec2(0.0,-0.15), vec2(-0.8,-1.0)));
    m = max(m, 0.0);

    fragColor.rgb = mix(clr, vec3(1.0), vec3(m * 200.0));
}

void oilify3(inout vec2 h[16], float d, vec2 tc, vec2 tc_max)
{
    vec3 c = texture(iChannel1, min(tc / iResolution.xy, tc_max)).rgb;

    float luma = dot(c, vec3(0.33));
    float L = floor(0.5 + luma * 15.0 + d);

    #define H(n) h[n] += L == float(n) ? vec2(luma, 1) : vec2(0);

    H(0)H(1)H(2)H(3)H(4)H(5)H(6)H(7)
    H(8)H(9)H(10)H(11)H(12)H(13)H(14)H(15)
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    if (iResolution.x < 500.0 || iResolution.y < 280.0)
    {
        drawThumbnail(fragColor, fragCoord);
        return;
    }

    // Fit image to touch screen from inside.

    vec2 img_res = vec2(496, 279);
    vec2 res = iResolution.xy / img_res;
    vec2 img_size = img_res * min(res.x, res.y);
    vec2 img_org = 0.5 * (iResolution.xy - img_size);
    vec2 tc = (fragCoord - img_org) / img_size;

    fragColor = texture(iChannel1, tc * img_res / iResolution.xy);

    #if DO_SHARPEN
    {
        // Regular high-pass filter to recover some sharpness.

        fragColor *= 8.0;
        fragColor -= texture(iChannel1, min((tc * img_res + vec2( 1,0)) / iResolution.xy, vec2(img_res) / iChannelResolution[1].xy));
        fragColor -= texture(iChannel1, min((tc * img_res + vec2(-1,0)) / iResolution.xy, vec2(img_res) / iChannelResolution[1].xy));
        fragColor -= texture(iChannel1, min((tc * img_res + vec2(0, 1)) / iResolution.xy, vec2(img_res) / iChannelResolution[1].xy));
        fragColor -= texture(iChannel1, min((tc * img_res + vec2(0,-1)) / iResolution.xy, vec2(img_res) / iChannelResolution[1].xy));
        fragColor *= 0.25;
    }
    #endif

    #if DO_OILIFY
    {
        // Additinal edge sharpening assuming it is a painting.
        // Effect similar to GIMP's Oilify.
        // Calculate 16 bin histogram for 3x3 neighborhood
        // and pick averaged color of bin that had most pixels.

        vec2 h[16];

        for (int i = 0; i < 16; i++) h[i] = vec2(0);

        // Add some noise to hide low bin count.

        float d = 0.5 * texture(iChannel2, 0.95 * fragCoord / iChannelResolution[2].xy).x;

        for (int y = -1; y <= 1; y++)
        {
            oilify3(h, d, tc * img_res + vec2(-1, y), img_res / iChannelResolution[1].xy);
            oilify3(h, d, tc * img_res + vec2( 0, y), img_res / iChannelResolution[1].xy);
            oilify3(h, d, tc * img_res + vec2( 1, y), img_res / iChannelResolution[1].xy);
        }

        vec2 q = vec2(0);

        #define Q(n) q = h[n].y > q.y ? h[n] : q;

        Q(0)Q(1)Q(2)Q(3)
        Q(4)Q(5)Q(6)Q(7)
        Q(8)Q(9)Q(10)Q(11)
        Q(12)Q(13)Q(14)Q(15)

        vec4 org = texture(iChannel1, tc * img_res / iResolution.xy);
        float luma = dot(org.rgb, vec3(0.33));
        vec3 clr = org.rgb - luma + q.x / q.y;

        fragColor.rgb = mix(fragColor.rgb, clr.rgb, 0.3);

        float emb =
            texture(iChannel2, 0.95 * (fragCoord + vec2(0.5, -0.5)) / iChannelResolution[2].xy).x -
            texture(iChannel2, 0.95 * (fragCoord - vec2(0.5, -0.5)) / iChannelResolution[2].xy).x;

        fragColor.rgb *= 0.95 + 0.20 * d + 0.1 * emb;
    }
    #endif

    // Add black bars around the image when needed.

    fragColor = any(greaterThan(abs(tc - 0.5), vec2(0.5))) ? vec4(0) : fragColor;

    #if DEBUG_DECODER
    {
        fragColor = texture(iChannel0, fragCoord.xy / iResolution.xy);
        if (all(equal(fragColor, vec4(0)))) fragColor = vec4(0.5,0,0,0);
    }
    #endif

    #if DEBUG_SAMPLERATE
    {
        if (fragCoord.x > iResolution.x - 5.0)
        {
            float n = texture(iChannel0, vec2(0.5, 1.5) / iChannelResolution[0].xy).w;
            fragColor.xyz = mix(fragColor.xyz, vec3(1,0,0), 0.5 * float(fragCoord.y < n * 20.0));
            fragColor.xyz = mix(fragColor.xyz, vec3(1,0,0), pow(fract(fragCoord.y / 20.0), 8.0));
        }
    }
    #endif

    fragColor.a = 1.;
}

`;

export default class implements iSub {
  key(): string {
    return 'lsKGDW';
  }
  name(): string {
    return 'oilArt';
  }
  // sort() {
  //   return 0;
  // }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [
      // { type: 3 }, //
      // webglUtils.DEFAULT_NOISE,
      { type: 1, f: buffA, fi: 1 },
      { type: 1, f: buffB, fi: 2 },
      { type: 1, f: buffC, fi: 3 },
    ];
  }
}
