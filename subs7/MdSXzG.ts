import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const sound = `
// Terminator - sound (FM synthesis + MIDI)
// Created by Dmitry Andreev - and'2014
// Original theme composed by Brad Fiedel
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define DO_DELAY        (1)
#define DO_UNISON       (1)
#define MASTER_VOLUME   (0.70)
#define BPM             (86.0)
#define STEP            (4.0 * BPM / 60.0)

// Sound track data

#define N(x, s) if (t < float(s) / STEP) { return vec2(x, t); } t -= float(s) / STEP;

vec2 rhythm_pat(float t)
{
    N(1,1) N(1,2) N(1,2) N(1,1) N(1,2) N(2,2) N(3,2)

    return vec2(0.0);
}

vec2 lead_pat(float t)
{
    N(74,1) N(76,2) N(77,15) N(76,4) N(72,2) N(65,24)
    N(74,1) N(76,2) N(77,15) N(76,4) N(72,2) N(81,12) N(79,12)
    N(74,1) N(76,2) N(77,15) N(76,4) N(72,2) N(67,24)
    N(65,22)N(62,2) N(65,12) N(64,12)

    return vec2(0.0);
}

vec2 pad_pat(float t)
{
    N(74,24) N(70,24) N(74,24) N(72,24) N(70,24) N(72,24) N(70,24) N(72,24)

    return vec2(0.0);
}

// Synth utilities

float note2Freq(float note)
{
    if (note == 0.0) return 0.0;

    return 16.35 * pow(1.059463, note);
}

float env_ad(float t, float attack, float decay)
{
    float env = (1.0 - exp(-t * attack)) * exp(-t * decay);

    float t_max = log((attack + decay) / decay) / attack;
    float env_max = (1.0 - exp(-t_max * attack)) * exp(-t_max * decay);

    return env / env_max;
}

float loop(float t, float steps)
{
    return mod(t, steps / STEP);
}

#if DO_UNISON
#define UNISON(count,w,wfunc,t,f0,df,dp,v0,dv) U1(count)U2(dp)U3(df)U4(wfunc,t,f0)U5(dv)U6(w,v0)
    #define U1(count) { const int c = (count); for (int i = 0; i < c; i++) {
    #define U2(dp)          float up = (dp) * float(i) / float(c);
    #define U3(df)          float uf = 1.0 + (df) * float(i) / float(c);
    #define U4(wfunc,t,f0)  vec2  x  = vec2(wfunc((t), (f0) * uf, up)) / float(c);
    #define U5(dv)          float a  = (dv) * ((float(i) / float(c - 1)) * 2.0 - 1.0);
    #define U6(w,v0)        w += x * vec2((v0) + a, (v0) - a); } }
#else
#define UNISON(count,w,wfunc,t,f0,df,dp,v0,dv) w += (v0) * wfunc((t), (f0), 0.0);
#endif

// Waveforms

float sine(float x)
{
    return sin(6.2831 * x);
}

float tsaw(float x, float q)
{
    // (saw) 0.0 <= q <= 0.5 (tri)

    float f = fract(x) - q;
    f /= (f >= 0.0 ? 1.0 : 0.0) - q;

    return f * 2.0 - 1.0;
}

// Instruments

float wave_pad(float t, float f0, float p0)
{
    float op1 = tsaw(p0 + t * f0 * 0.5000, 0.02);
    float op2 = tsaw(p0 + t * f0 * 0.5086, 0.02);

    return op1 - op2;
}

vec2 ins_pad(float t, float f0)
{
    vec2 w = vec2(0.0);

    UNISON(3, w, wave_pad, t, f0, 0.003, 0.1, 0.6, 0.4);

    return w;
}

float wave_bass(float t, float f0, float p0)
{
    float op4 = tsaw(p0 + t * f0 * 10.000, 0.01) * (exp(-t * 10.0) + 0.01);
    float op3 = tsaw(p0 + t * f0 * 1.0012 + op4 * 0.17, 0.2);
    float op2 = tsaw(p0 + t * f0 * 0.5008 + op4 * 0.09, 0.2);
    float op1 = sine(p0 + t * f0 * 1.0000 + op4 * 0.16);

    op1 *= env_ad(t, 30.0, 3.0);
    op2 *= env_ad(t, 10.0, 5.0);
    op3 *= env_ad(t, 10.0, 5.0);

    return op1 * 0.92 + op2 * 0.54 + op3 * 0.42;
}

vec2 ins_bass(float t, float f0)
{
    vec2 w = vec2(0.0);

    UNISON(5, w, wave_bass, t, f0, 0.002, 0.01, 1.0, 0.0);

    return w;
}

float wave_lead(float t, float f0, float p0)
{
    float op4 = tsaw(p0 + t * f0 * 10.000, 0.3) * (exp(-t * 10.0) + 0.01);
    float op3 = tsaw(p0 + t * f0 * 1.0012 + op4 * 0.22, 0.01);
    float op2 = tsaw(p0 + t * f0 * 0.5008 + op4 * 0.22, 0.02);
    float op1 = tsaw(p0 + t * f0 * 1.0000 + op4 * 0.22, 0.03);

    op1 *= env_ad(t, 4.0, 0.2);
    op2 *= env_ad(t, 6.0, 0.5);
    op3 *= env_ad(t, 6.0, 1.0);

    return op1 * 0.75 + op2 * 0.4 + op3 * 0.26;
}

vec2 ins_lead(float t, float f0)
{
    vec2 w = vec2(0.0);

    UNISON(5, w, wave_lead, t, f0, 0.01, 0.3, 0.6, 0.4);

    return w;
}

vec2 ins_drum(float t, float f0)
{
    float f1 = f0 * (exp(-t * 8.0) * 1.5 + 0.5);

    // Hihat
    float op5 = sine(t * f0 * 2.8020             ) * exp(-t * 1.0);
    float op4 = sine(t * f0 * 2.5000 + op5 * 1.12);
    float op3 = sine(t * f0 * 15.000 + op4 * 0.92) * exp(-t * 14.0);

    // Hihat rebounce
    op3 *= t < 0.02 ? (exp(-t * 40.0) * 0.8 + 0.2) : 1.0;

    // Drum
    float op2 = sine(t * f0 * 2.0000             ) * exp(-t * 40.0);
    float op1 = sine(t * f1 * 1.0000 + op2 * 0.20) * pow(clamp(1.2 - t * 2.0, 0.0, 1.0), 0.5);

    return vec2(op1 + op3 * 0.2);
}

vec2 ins_snare(float t, float f0)
{
    float op3 = sine(t * f0 * 2.8020) * exp(-t * 1.0);
    float op2 = sine(t * f0 * 2.5000 + op3 * 1.00);
    float op1 = sine(t * f0 * 18.000 + op2 * 0.72);

    return vec2(op1 * exp(-t * 5.5));
}

float wave_bell(float t, float f0)
{
    float op3 = sine(f0 * t * 6.0000             ) * exp(-t * 5.0);
    float op2 = sine(f0 * t * 7.2364 + op3 * 0.20);
    float op1 = sine(f0 * t * 2.0000 + op2 * 0.13) * exp(-t * 2.0);

    return op1;
}

//

struct Mixer
{
    vec2  lead;
    vec2  lead2;
    vec2  lead3;
    vec2  pad;
    vec2  bass;
    vec2  drum;
    vec2  snare;
    vec2  bell;
};

vec2 synthWave(float t, Mixer m)
{
    vec2 w = vec2(0.0);
    vec2 n = vec2(0.0);
    float fq = 0.0;

    // Lead
    n = lead_pat(loop(t, 192.0));
    fq = note2Freq(n.x) * 0.25;
    w += m.lead  * ins_lead(n.y, fq);
    w += m.lead2 * ins_lead(n.y, fq * 0.5);

    n = lead_pat(loop(t - 12.0 / STEP, 192.0));
    fq = note2Freq(n.x) * 0.5;
    w += m.lead3 * ins_pad(n.y, fq) * exp(-n.y * 3.0);

    // String pad
    n = pad_pat(loop(t, 192.0));
    fq = note2Freq(n.x) / 8.0;
    w += m.pad * ins_pad(n.y, fq);

    n = rhythm_pat(loop(t, 12.0));

    // Compress dynamic range
    w *= 1.0 - exp(-n.y * 8.0) * 0.7;

    // Bass
    w += m.bass * ins_bass(n.y, fq * 0.5);
    w += m.bass * ins_bass(n.y, fq * 1.0) * 0.3;

    // Drum
    if (n.x >= 1.0) w += m.drum * ins_drum(n.y, n.x == 2.0 ? 116.5 : 130.8);

    // Snare
    if (n.x >= 2.0) w += m.snare * ins_snare(n.y, 116.75) * (n.x == 3.0 ? 0.7 : 1.0);

    // Bell
    w += m.bell * vec2(wave_bell(loop(t, 12.0), 175.0));

    return w;
}

vec2 mainSound( in int samp,float t)
{
    Mixer m;
    m.lead  = vec2(1.0, 0.7) * 1.2;
    m.lead2 = vec2(0.7, 1.0) * 0.7;
    m.lead3 = vec2(0.4, 0.9) * 0.5;
    m.pad   = vec2(1.0, 1.0) * 0.7;
    m.bass  = vec2(0.8, 1.0) * 0.28;
    m.drum  = vec2(1.0, 0.9) * 0.34;
    m.snare = vec2(0.9, 1.0) * 0.16;
    m.bell  = vec2(1.0, 0.8) * 0.14;

    vec2 w = synthWave(t, m);

    #if DO_DELAY
        m.lead  = vec2(0.3, 0.4) * 1.2;
        m.lead2 = vec2(1.0, 0.5) * 0.35;
        m.lead3 = vec2(0.8, 0.2) * 0.4;
        m.pad   = vec2(0.8, 0.5) * 0.2;
        m.bass  = vec2(0.3, 0.2) * 0.25;
        m.drum  = vec2(0.3, 0.4) * 0.4;
        m.snare = vec2(1.0, 0.5) * 0.1;
        m.bell  = vec2(0.8, 1.0) * 0.1;

        w += synthWave(t - (3.0 / STEP), m);
    #endif

    // Fade-in / fade-out
    w *= pow(clamp(t * 0.2, 0.0, 1.0), 2.0);
    w *= pow(clamp((60.0 - t) * 0.2, 0.0, 1.0), 2.0);

    w = clamp(w * MASTER_VOLUME, -1.0, 1.0);

    return w;
}`;

const fragment = `
// Terminator - sample based image compression/synthesis
// Created by Dmitry Andreev - and'2014
// Original image author is unknown
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define DO_DEBLOCKING   (1)
#define EDGE_WIDTH      (0.3)

#define DO_MUSIC_SYNC   (1)
#define BPM             (86.0)
#define STEP            (4.0 * BPM / 60.0)

//

#define BITS_ZERO       (0.5)
#define BITS_INVALID    (0.0)
#define BITS_UNDEFINED  (-1.0)

vec3 decodeBlock(float bits)
{
    vec3 block;

    // 27 bits encoded into single-precision float

    // 5 bits in exponent
    block.z = ceil(log2(bits));
    bits *= exp2(-block.z);
    block.z *= 16.0;

    // 22 bits in fraction
    float m = bits * 2.0 - 1.0;

    // 4 bits
    m *= 16.0;
    float s_lo = floor(m);
    block.z += s_lo;
    m -= s_lo;

    // 9 bits
    m *= 512.0;
    block.x = floor(m);
    m -= block.x;

    // 9 bits
    m *= 512.0;
    block.y = floor(m);
    
    block.z /= 64.0;

    return block;
}

void marchBlock(float cx, float fx, inout float x, inout vec4 queue, float bits)
{
#if DO_DEBLOCKING
    float p_x = fx - x;

    if (-EDGE_WIDTH <= p_x && p_x <= 1.0 + EDGE_WIDTH)
    {
        queue = vec4(bits, queue.xyz);
    }
#else
    if (cx == x)
    {
        queue.x = bits;
    }
#endif

    x += 1.0;
}

void marchBlock4(float cx, float fx, inout float x, inout vec4 queue, vec4 bits4)
{
    marchBlock(cx, fx, x, queue, bits4.x);
    marchBlock(cx, fx, x, queue, bits4.y);
    marchBlock(cx, fx, x, queue, bits4.z);
    marchBlock(cx, fx, x, queue, bits4.w);
}

float decodeImage(vec2 uv)
{
    vec4 queue = vec4(BITS_UNDEFINED);
    vec2 fuv = uv * 20.0;
    vec2 cuv = floor(fuv);

    #define IMAGE_BEGIN float y = 0.0; Y { float x = 0.0;
    #if DO_DEBLOCKING
        #define Y if (-EDGE_WIDTH <= fuv.y - y && fuv.y - y <= 1.0 + EDGE_WIDTH)
    #else
        #define Y if (cuv.y == y)
    #endif
    #define Z 0.0
    #define B(a) marchBlock(cuv.x, fuv.x, x, queue, a);
    #define X(a,b,c,d) marchBlock4(cuv.x, fuv.x, x, queue, vec4(a,b,c,d));
    #define N } y += 1.0; Y { float x = 0.0;
    #define IMAGE_END }

    IMAGE_BEGIN
    X(Z,Z,12.48025513,18.2613678)X(14.55870438,6.4048748,17.06652451,8189.82226563)
    X(6.64134884,162.78988647,42.91783905,5626.46972656)X(138525.59375,41.58642578,
    427024.375,206.58035278)X(0.82521808,0.58115995,0.54984903,Z)N X(Z,Z,3.21994638,
    374.97113037)X(47.06005096,6.6500082,6.66856098,4.66808987)X(196.37216187,
    471.1897583,684.98742676,11.20445633)X(100.19213867,9.69522667,7.01455688,
    51.12378693)X(0.76100445,0.59846497,0.56898916,Z)N X(Z,Z,6.73963928,
    184.06173706)X(6.17000294,6.16762161,34.79045868,25.27668762)X(930.35900879,
    331.53057861,7.34244347,125.59954834)X(8822640.0,14.7493,0.86116517,0.73653173)
    X(0.91958272,0.78233111,0.56941533,Z)N X(Z,Z,7.70942402,22.54719925)X(
    6.16273594,6.66906738,30.16192627,26.56917953)X(5.59261036,25.13958359,
    7.50785732,51.06975555)X(19.83830643,5.86814499,130.51177979,10.68081856)X(
    2.26279306,1.44382572,0.5412612,Z)N X(Z,0.71245921,29.23391724,336.51696777)X(
    8.27663422,11.38800812,16264.00390625,37.98600006)X(36.36175537,50.1639328,
    18.65235138,309.19873047)X(5.35594463,6.71129417,2.66041708,14.39523888)X(
    3.85929012,0.93375599,0.58633459,Z)N X(Z,0.61626613,1475.71728516,228.77694702)
    X(2.55040169,95.86024475,19.71884537,9.71647453)X(18.89545441,8.4233017,
    13.23942947,3.10345316)X(0.71536052,0.67326164,1.52043891,3.21422815)X(
    0.83683252,0.61685026,0.96152639,Z)N X(Z,0.71823466,15846.22851563,754.53967285)
    X(7.5705471,167.31500244,29.48733902,3.09635162)X(0.61997092,12.00100708,
    7.98631287,1.11398435)X(Z,0.62180436,0.74705958,5.1868782)X(0.64646959,
    0.75673223,0.58568811,Z)N X(Z,0.67056167,1603.71826172,6.65928555)X(
    3197.65527344,37.43402863,5778.38574219,253.33746338)X(31.59008789,696.93566895,
    273.3081665,23.33766556)X(24.32575226,0.80796397,0.7020582,1.79647732)X(
    1.27429724,4.49099731,0.57186365,Z)N X(Z,Z,710.64233398,7.15544987)X(6.91371441,
    6.91957474,6.89853382,6.92926693)X(23.09988022,80376992.0,152584.875,7.48430824)
    X(16.50580597,3.788692,635.37353516,1648.5925293)X(3.55959558,83.21722412,
    0.61234903,Z)N X(Z,Z,171.69506836,1156.21923828)X(6.16518211,6.40245628,
    7.17294693,14.13828468)X(18.67840958,1172.390625,432.48254395,158.15060425)X(
    12.95686531,4.29670238,2.809762,1.47285676)X(7.59644127,2.34375715,0.58340371,Z)
    N X(Z,Z,0.77805448,285.9395752)X(46.76708984,329.05633545,40.74362946,
    5.14218807)X(17.26757813,294558.125,288468.125,55.34296417)X(1.33408022,
    1.37154174,5.10602283,4.67366695)X(75.48953247,1.49300027,0.5593617,Z)N X(Z,Z,Z,
    7.80799294)X(208.13833618,1470.85473633,235.62542725,47.32849884)X(240.76251221,
    2220.765625,927.98876953,1.66552591)X(134.46755981,15.88366127,11.24720001,
    0.56877398)X(0.6827234,Z,Z,Z)N X(Z,Z,0.71001613,48.4316864)X(14.01960182,
    27.09380722,7.66266632,5.9078455)X(3020.68261719,1.63931131,119.55056763,
    2.57971573)X(9.10432243,6.80336666,43.77991486,0.57664371)X(Z,Z,Z,Z)N X(Z,Z,
    0.74839866,10.62334061)X(4.83821011,5.66174793,6.17294502,6.15004253)X(
    733.91320801,1724.19995117,79.79507446,431.83599854)X(31.82691956,4.29700756,
    0.94168246,0.63888454)X(Z,Z,Z,Z)N X(Z,Z,Z,3.22923422)X(311.45129395,5.66371346,
    18.12118912,16.68878937)X(31.68878937,211.53329468,670.53845215,1031.296875)X(
    10.79068565,9.89238548,0.86601806,0.74643874)X(Z,Z,Z,Z)N X(Z,Z,Z,Z)X(
    21.89968109,461.93914795,33289.515625,3675.40087891)X(990.66320801,
    2024.31567383,1933.90625,1613.90600586)X(1044076.0,49.61504364,2.49238491,
    0.64432311)X(Z,Z,Z,Z)N X(Z,Z,Z,Z)X(0.74595618,52.33689117,6.1441803,5.67983627)
    X(4.340662,4054.76269531,51.38542175,29.69271088)X(104.26261902,13.4964962,
    1.40177608,Z)X(Z,Z,Z,Z)N X(Z,Z,Z,Z)X(Z,0.6495769,92.17546082,99.30880737)X(
    1288.65771484,80.27352905,105.20147705,5556.79882813)X(1596.3894043,8.20837402,
    0.69294262,Z)X(Z,Z,Z,Z)N X(Z,Z,Z,Z)X(Z,0.58872199,25.63039017,21377.45703125)X(
    5.91131783,5.40443707,5.67446423,5.92495346)X(84.6421051,2.92709684,0.58853912,
    Z)X(Z,Z,Z,Z)N X(Z,Z,Z,Z)X(Z,Z,0.71402991,16.63234329)X(115.51925659,
    165.67263794,170.56344604,55.76744843)X(6.15610218,1.05525684,Z,Z)X(Z,Z,Z,Z)
    IMAGE_END

    float luma = 0.0;

#if DO_DEBLOCKING
    const float s = EDGE_WIDTH;

    float t_x = fuv.x - cuv.x;
    float t_y = fuv.y - cuv.y;

    bool is_left_edge   = t_x < s;
    bool is_right_edge  = t_x > 1.0 - s;
    bool is_bottom_edge = t_y > 1.0 - s;
    bool is_top_edge    = t_y < s;
    bool no_fadeout_x   = false;
    bool no_fadeout_y   = false;

    if (is_top_edge && cuv.y == 0.0) no_fadeout_y = true;

    is_top_edge    = is_top_edge    && cuv.y >  0.0;
    is_bottom_edge = is_bottom_edge && cuv.y < 19.0;

    if (is_right_edge)
    {
        queue.xyzw = queue.yxwz;
    }

    if (is_bottom_edge)
    {
        if (queue.z == BITS_UNDEFINED)
        {
            queue.xyzw = queue.yxwz;
        }
        else
        {
            queue.xyzw = queue.zwxy;
        }
    }

    vec2 duv[4];
    duv[0] = duv[1] = duv[2] = duv[3] = vec2(0.0);

    if (queue.y != BITS_UNDEFINED && queue.z == BITS_UNDEFINED)
    {
        if (is_left_edge)   duv[1].x = +1.0;
        if (is_right_edge)  duv[1].x = -1.0;
        if (is_top_edge)    duv[1].y = +1.0;
        if (is_bottom_edge) duv[1].y = -1.0;
    }

    if (queue.w != BITS_UNDEFINED)
    {
        duv[1].x = t_x > 0.5 ? -1.0 : +1.0;
        duv[2].y = t_y > 0.5 ? -1.0 : +1.0;
        duv[3].x = t_x > 0.5 ? -1.0 : +1.0;
        duv[3].y = t_y > 0.5 ? -1.0 : +1.0;
    }

    queue = max(vec4(BITS_ZERO), queue);

    for (int i = 0; i < 4; i++)
    {
        vec3 block = decodeBlock(queue[i]);

        vec2 p = uv * 20.0 - cuv + duv[i];
        vec2 tc= (block.xy + p * 10.0) / 512.0;
        vec2 d = 1.0 - clamp((abs(p - 0.5) - 0.5 + s) / (s * 2.0), 0.0, 1.0);

        if (no_fadeout_x) d.x = 1.0;
        if (no_fadeout_y) d.y = 1.0;

        d = smoothstep(0.0, 1.0, d);
        float falloff = d.x * d.y;

        luma += falloff * texture(iChannel0, tc, -32.0).g * block.z;
    }
#else

    queue = max(vec4(BITS_ZERO), queue);
    vec3 block = decodeBlock(queue.x);
    vec2 p = uv * 20.0 - cuv;
    luma = texture(iChannel0, (block.xy + p * 10.0) / 512.0, -32.0).g * block.z;

#endif

    return luma;
}

vec2 rhythm_pat(float t)
{
    float n = 0.0;
    float lt = 0.0;

    #define T(x, s) if (t >= 0.0 && t < float(s)) n = float(x), lt = t; t -= float(s);
    T(1,1) T(1,2) T(1,2) T(1,1) T(1,2) T(2,2) T(2,2)

    return vec2(n, lt);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float res = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord.xy + vec2((res - iResolution.x) * 0.5, 0.0)) / res;
    uv.y = 1.0 - uv.y;
    vec2 ouv = uv;

    float t = iTime;
    vec3 dist = texture(iChannel1, uv.yy + vec2(0.0, t)).rgb;

    float sm = clamp(4.0 * sin(uv.y * 1.0 + iTime * 1.0 ) - 3.9, 0.0, 1.0);
    sm = pow(sm, 5.0);
    uv.x += sm * 2000.0 * (dist.r * 2.0 - 0.75);

    // Make composition a bit less symmetric
    uv.x += 0.1;

    float luma = decodeImage(uv);

    // Colorize and add effects
    vec3 clr = vec3(luma);

    float mask = clamp(uv.x * 2.0 - 0.5, 0.0, 1.0);
    mask = smoothstep(0.0, 1.0, mask);

    #if DO_MUSIC_SYNC
        vec2 mus = rhythm_pat(mod(t * STEP, 12.0));
        float my = 0.25 + 0.5 * mus.x * pow(clamp(1.0 - mus.y / STEP, 0.0, 1.0), 6.0);
        my = mix(0.0, my, pow(clamp(t * 0.2, 0.0, 1.0), 1.0));
        my = mix(1.0, my, pow(clamp((60.0 - t) * 0.2, 0.0, 1.0), 2.0));
        float y = mix(my, 1.0, luma);
    #else
        float y = 1.0;
    #endif

    vec3 clr_r = pow(clr, mix(vec3(1.5, 1.0, 0.6), vec3(1.0), luma)) * y;
    vec3 clr_l = pow(clr, mix(vec3(1.3, 1.0, 0.7), vec3(1.5, 1.6, 2.0), luma));
    clr = mix(clr_l * 1.08, clr_r * 0.9, mask);

    // sRGB to Linear
    clr *= clr;

    // Add some detail in shadows
    float detail = texture(iChannel1, 2.0 * uv).y;
    clr *= 1.0 + 1.5 * pow(abs(1.0 - luma), 2.0) * vec3(detail);

    // Draw red glowing eye
    vec2 d = uv - vec2(0.73, 0.29);
    float eye_amp = 0.75 + 0.25 * sin(iTime * 2.0);
    d *= 1.0 + 0.015 * cos(atan(d.y, d.x) * 6.0);

    clr += eye_amp * vec3(2.0, 0.05, 0.01)
        * (pow(clamp(0.9 - 1200.0 * dot(d,d), 0.0, 1.0), 2.0)
        + 0.8 * pow(1.0 / (1.0 + 2000.0 * dot(d,d)), 2.0)) * (0.75 + 0.25 * detail);

    // Right eye highlight
    vec2 duv = vec2(sin(t * 17.34), cos(t * 13.15)) * 0.0005;
    d = (uv + duv - vec2(0.74, 0.283)) * vec2(1.0, 2.3);
    clr += 0.6 * pow(clamp(0.9 - 1200.0 * dot(d,d), 0.0, 1.0), 8.0)
        * vec3(0.5, 1.0, 1.5) * (0.75 + 0.25 * detail);

    // Left eye highlight
    d = (uv + duv - vec2(0.31, 0.283)) * vec2(1.0, 2.0);
    clr += 0.1 * pow(clamp(0.9 - 1200.0 * dot(d,d), 0.0, 1.0), 12.0)
        * vec3(0.8, 1.3, 1.5) * (0.75 + 0.25 * detail);

    // Tape-like distortion
    vec3 dist2 = texture(iChannel1,
        vec2(0.5, 1.0) * ouv + vec2(sin(-t) * 11.234, 17.11 * cos(-t))).rgb;
    clr += sm * dist2.r * 3800.0 * vec3(0.15, 0.30, 1.0);

    // CRT-like flickering
    clr *= 1.1 + 0.1 * sin(ouv.y * 6.0 + t * 33.0) * (1.0 - luma);

    // Linear to sRGB
    clr = sqrt(max(vec3(0.0), clr));

    fragColor = vec4(clr, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdSXzG';
  }
  name(): string {
    return 'Terminator';
  }
  sort() {
    return 702;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
      {
        ...webglUtils.TEXTURE6,
        ...webglUtils.NO_FLIP_Y,
        ...webglUtils.TEXTURE_MIPMAPS,
      },
      {
        ...webglUtils.DEFAULT_NOISE,
        ...webglUtils.NO_FLIP_Y,
        ...webglUtils.TEXTURE_MIPMAPS,
      }, //
    ];
  }
}
