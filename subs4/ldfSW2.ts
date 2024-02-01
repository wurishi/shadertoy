import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// srtuss, 2014
//
// I started making these visuals for Dave's "Tropical Beeper" track, but then the
// soundshader-feature was added. :P

vec2 rotate(vec2 p, float a)
{
	return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
}

float box(vec2 p, vec2 b)
{
	vec2 d = abs(p) - b;
	return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

#define aav (4.0 / iResolution.y)

void button(out vec4 bcol, inout vec3 acol, vec2 uv, float i1)
{
	float v; vec3 col;
	v = box(uv, vec2(0.1)) - 0.05;
	float l = length(uv);
	float shd = exp(-40.0 * max(v, 0.0));
	col = vec3(exp(l * -4.0) * 0.3 + 0.2);
	col *= 1.0 - vec3(exp(-100.0 * abs(v))) * 0.4;
	v = smoothstep(aav, 0.0, v);
	bcol = mix(vec4(0.0, 0.0, 0.0, shd * 0.5), vec4(col, 1.0), v);
	col = vec3(0.3, 1.0, 0.2) * exp(-30.0 * l * l) * 0.8 * i1;
	acol += col;
}

float f0(vec2 uv)
{
	float l = length(uv);
	return l - 0.2;
}

float f1(vec2 uv, float a)
{
	float l = length(uv);
	return l - 0.14 + sin((a + atan(uv.y, uv.x)) * 13.0) * 0.005;
}

float f2(vec2 uv, float a)
{
	uv = rotate(uv, a);
	float l = length(uv);
	float w = max(abs(uv.x + 0.12) - 0.03, abs(uv.y) - 0.01);
	return min(l - 0.1, w);
}

vec3 n0(vec2 p)
{
	vec2 h = vec2(0.01, 0.0);
	float m = -0.01;
	return normalize(vec3(max(f0(p + h.xy), m) - max(f0(p - h.xy), m), max(f0(p + h.yx), m) - max(f0(p - h.yx), m), 2.0 * h.x));
}

vec3 n1(vec2 p, float a)
{
	vec2 h = vec2(0.01, 0.0);
	return normalize(vec3(f1(p + h.xy, a) - f1(p - h.xy, a), f1(p + h.yx, a) - f1(p - h.yx, a), 2.0 * h.x));
}

vec3 n2(vec2 p, float a)
{
	vec2 h = vec2(0.005, 0.0);
	float m = -0.005;
	return normalize(vec3(max(f2(p + h.xy, a), m) - max(f2(p - h.xy, a), m), max(f2(p + h.yx, a), m) - max(f2(p - h.yx, a), m), 2.0 * h.x));
}

vec3 sun = normalize(vec3(-0.2, 0.5, 0.5));

void knob(inout vec3 bcol, inout vec3 acol, vec2 uv, float a)
{
	float v; vec3 col;
	float diff;
	float l = length(uv);
	bcol = mix(bcol, vec3(0.0), exp(max(l - 0.2, 0.0) * -20.0) * 0.5);
	v = f0(uv);
	v = smoothstep(aav, 0.0, v);
	diff = max(dot(mix(n0(uv), vec3(0.0, 0.0, 1.0), smoothstep(0.02, 0.0, l - 0.115)), sun), 0.0);
	col = vec3(diff) * 0.2;
	bcol = mix(bcol, col, v);
	bcol = mix(bcol, vec3(0.0), exp(max(l - 0.14, 0.0) * -40.0) * 0.5);
	v = f1(uv, a);//l - 0.14 + sin(atan(uv.y, uv.x) * 13.0) * 0.005;
	v = smoothstep(aav, 0.0, v);
	diff = max(dot(mix(n1(uv, a), vec3(0.0, 0.0, 1.0), smoothstep(0.02, 0.0, l - 0.115)), sun), 0.0);
	col = vec3(diff) * 0.2;//vec3(0.05);
	bcol = mix(bcol, col, v);
	v = f2(uv, a);
	v = smoothstep(aav, 0.0, v);
	diff = max(dot(mix(n2(uv, a), vec3(0.0, 0.0, 1.0), 0.0), sun), 0.0);
	col = vec3(diff) * 0.1 + 0.2;
	bcol = mix(bcol, col, v);//*/
}

float hash1(float x)
{
	return fract(sin(x * 11.1753) * 192652.37862);
}

float nse1(float x)
{
	float fl = floor(x);
	return mix(hash1(fl), hash1(fl + 1.0), smoothstep(0.0, 1.0, fract(x)));
}

float bf(float t)
{
	float v = 0.04;
	return exp(t * -30.0) + smoothstep(0.25 + v, 0.25 - v, abs(t * 2.0 - 1.0));
}

#define ITS 7

vec2 circuit(vec3 p)
{
	p = mod(p, 2.0) - 1.0;
	float w = 1e38;
	vec3 cut = vec3(1.0, 0.0, 0.0);
	vec3 e1 = vec3(-1.0);
	vec3 e2 = vec3(1.0);
	float rnd = 0.23;
	float pos, plane, cur;
	float fact = 0.9;
	float j = 0.0;
	for(int i = 0; i < ITS; i ++)
	{
		pos = mix(dot(e1, cut), dot(e2, cut), (rnd - 0.5) * fact + 0.5);
		plane = dot(p, cut) - pos;
		if(plane > 0.0)
		{
			e1 = mix(e1, vec3(pos), cut);
			rnd = fract(rnd * 19827.5719);
			cut = cut.yzx;
		}
		else
		{
			e2 = mix(e2, vec3(pos), cut);
			rnd = fract(rnd * 5827.5719);
			cut = cut.zxy;
		}
		j += step(rnd, 0.2);
		w = min(w, abs(plane));
	}
	return vec2(j / float(ITS - 1), w);
}

vec3 pixel(vec2 p, float time, float ct)
{	
	float te = ct * 9.0 / 16.0;//0.25 + (ct + 0.25) / 2.0 * 128.0 / 60.0;
	float ll = dot(p, p);
	p *= 1.0 - cos((te + 0.75) * 6.283185307179586476925286766559) * 0.01;
	vec2 pp = p;
	p = rotate(p, sin(time * 0.1) * 0.1 + nse1(time * 0.2) * 0.0);
	float r = 1.5;
	p = mod(p - r, r * 2.0) - r;
	p.x += 0.6;
	float i1 = bf(fract(0.75 + te));
	float i2 = bf(fract(0.5 + te));
	float i3 = bf(fract(0.25 + te));
	float i4 = bf(fract(0.0 + te));
	float s = time * 50.0;
	vec2 shk = (vec2(nse1(s), nse1(s + 11.0)) * 2.0 - 1.0) * exp(-5.0 * fract(te * 4.0)) * 0.1;
	pp += shk;
	p += shk;
	vec3 col = vec3(0.1);
	s = 0.2;
	float c = smoothstep(aav, 0.0, circuit(vec3(p, 0.1) * s).y / s - 0.001);
	col += vec3(c) * 0.05;
	vec4 bcol; vec3 acol = vec3(0.0);
	button(bcol, acol, p, i1);
	col = mix(col, bcol.xyz, bcol.w);
	button(bcol, acol, p - vec2(0.4, 0.0), i2);
	col = mix(col, bcol.xyz, bcol.w);
	button(bcol, acol, p - vec2(0.8, 0.0), i3);
	col = mix(col, bcol.xyz, bcol.w);
	button(bcol, acol, p - vec2(1.2, 0.0), i4);
	col = mix(col, bcol.xyz, bcol.w);
	knob(col, acol, p - vec2(1.2, -0.6), 1.9);
	knob(col, acol, p - vec2(0.4, 0.6), 0.2);
	knob(col, acol, p - vec2(0.7, -0.6), -0.5);
	vec2 q = p - vec2(0.9, 0.6);
	vec2 qq = q - vec2(0.35, 0.0);
	float v = box(qq, vec2(0.4, 0.2)) - 0.01;
	col = mix(col, vec3(0.2) * 0.8, smoothstep(aav, 0.0, v));
	col += vec3(1.0) * exp(max(v, 0.0) * -30.0) * 0.14;
	col -= vec3(1.0) * exp(dot(qq, qq) * -20.0) * 0.1;
	vec2 fr = mod(q, 0.03) - 0.015;
	vec2 id = floor(q / 0.03);
	v = box(fr, vec2(0.003)) - 0.003;
	float amp = 2.0;
	float inte = abs(id.y + sin(id.x * 0.6 + time * 4.0) * amp) - 0.8;
	acol += exp(max(v, 0.0) * -400.0) * smoothstep(0.5, 0.0, inte) * step(id.x, 21.0) * step(0.0, id.x);
	//0.018
	col += acol;
	col *= exp((length(pp) - 0.5) * -1.0) * 0.5 + 0.5;
	col = pow(col, vec3(1.2, 1.1, 1.0) * 2.0) * 4.0;
	col = pow(col, vec3(1.0 / 2.2));
	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	uv = 2.0 * uv - 1.0;
	uv.x *= iResolution.x / iResolution.y;
	vec3 col = vec3(0.0);
	float j = 0.008;
	col  = pixel(uv, iTime, iTime);
	/*col += pixel(uv, iTime + j * 1.0, iTime);
	col += pixel(uv, iTime - j * 1.0, iTime);
	col /= 3.0;//*/
	fragColor = vec4(col, 1.0);
}
`;

const sound = `
// srtuss, 2014
//
// Writing this crude 303 emulation + some percussion was the first thing i tried with the new
// soundshader-feature. The values are all tweaked by ear.

// number of synthesized harmonics (tune for quality/preformance)
#define NSPC 256

#define pi2 6.283185307179586476925286766559

// hard clipping distortion
float dist(float s, float d)
{
	return clamp(s * d, -1.0, 1.0);
}
vec2 dist(vec2 s, float d)
{
	return clamp(s * d, -1.0, 1.0);
}

// quantize
float quan(float s, float c)
{
	return floor(s / c) * c;
}

// my resonant lowpass filter's frequency response
float _filter(float h, float cut, float res)
{
	cut -= 20.0;
	float df = max(h - cut, 0.0), df2 = abs(h - cut);
	return exp(-0.005 * df * df) * 0.5 + exp(df2 * df2 * -0.1) * 2.2;
}

// hash
float nse(float x)
{
	return fract(sin(x * 110.082) * 19871.8972);
	//return fract(sin(x * 110.082) * 13485.8372);
}
float nse_slide(float x)
{
	float fl = floor(x);
	return mix(nse(fl), nse(fl + 1.0), smoothstep(0.0, 1.0, fract(x)));
}

// note number to frequency
float ntof(float n)
{
	return 440.0 * pow(2.0, (n - 69.0) / 12.0);
}

// tb303 core
vec2 synth(float tseq, float t)
{
	vec2 v = vec2(0.0);
	
	float tnote = fract(tseq);
	float dr = 0.26;
	float amp = smoothstep(0.05, 0.0, abs(tnote - dr - 0.05) - dr) * exp(tnote * -1.0);
	float seqn = nse(floor(tseq));
	//float seqn = nse_slide(tseq);
	float n = 20.0 + floor(seqn * 38.0);//50.0 + floor(time * 2.0);
	float f = ntof(n);
	
    float sqr = smoothstep(0.0, 0.01, abs(mod(t * 9.0, 64.0) - 20.0) - 20.0);
    
	float base = f;//50.0 + sin(sin(t * 0.1) * t) * 20.0;
	float flt = exp(tnote * -1.5) * 50.0 + pow(cos(t * 1.0) * 0.5 + 0.5, 4.0) * 80.0 - 0.0;
	for(int i = 0; i < NSPC; i ++)
	{
		float h = float(i + 1);
		float inten = 1.0 / h;
		//inten *= sin((pow(h, sin(t) * 0.5 + 0.5) + t * 0.5) * pi2) * 0.9 + 0.1;
		
		inten = mix(inten, inten * mod(h, 2.0), sqr);
		
		inten *= exp(-1.0 * max(2.0 - h, 0.0));// + exp(abs(h - flt) * -2.0) * 8.0;
		
		inten *= _filter(h, flt, 4.0);
		
		
		v.x += inten * sin((pi2 + 0.01) * (t * base * h));
		v.y += inten * sin(pi2 * (t * base * h));
	}
	
	
	float o = v.x * amp;//exp(max(tnote - 0.3, 0.0) * -5.0);
	
	//o = dist(o, 2.5);
	
	return vec2(dist(v * amp, 2.0));
}

// heavy 909-ish bassdrum
float kick(float tb, float time)
{
	tb = fract(tb / 4.0) * 0.5;
	float aa = 5.0;
	tb = sqrt(tb * aa) / aa;
	
	float amp = exp(max(tb - 0.15, 0.0) * -10.0);
	float v = sin(tb * 100.0 * pi2) * amp;
	v = dist(v, 4.0) * amp;
	v += nse(quan(tb, 0.001)) * nse(quan(tb, 0.00001)) * exp(tb * -20.0) * 2.5;
	return v;
}

// 909-ish open hihat
float hat(float tb)
{
	tb = fract(tb / 4.0) * 0.5;
	float aa = 4.0;
	//tb = sqrt(tb * aa) / aa;
	return nse(sin(tb * 4000.0) * 0.0001) * smoothstep(0.0, 0.01, tb - 0.25) * exp(tb * -5.0);
}

float gate1(float t)
{
	#define stp 0.0625
	float v;
	v = abs(t - 0.00 - 0.015) - 0.015;
	v = min(v, abs(t - stp*1. - 0.015) - 0.015);
	v = min(v, abs(t - stp*2. - 0.015) - 0.015);
	v = min(v, abs(t - stp*4. - 0.015) - 0.015);
	v = min(v, abs(t - stp*6. - 0.015) - 0.015);
	v = min(v, abs(t - stp*8. - 0.05) - 0.05);
	v = min(v, abs(t - stp*11. - 0.05) - 0.05);
	v = min(v, abs(t - stp*14. - 0.05) - 0.05);
	
	return smoothstep(0.001, 0.0, v);
}

vec2 synth2(float time)
{
	float tb = mod(time * 9.0, 16.0) / 16.0;
	
	float f = time * pi2 * ntof(87.0 - 12.0 + mod(tb, 4.0));
	float v = dist(sin(f + sin(f * 0.5)), 5.0) * gate1(tb);
	
	return vec2(v);
}

vec2 synth2_echo(float time, float tb)
{
	vec2 mx;
	mx = synth2(time) * 0.5;// + synth2(time) * 0.5;
	float ec = 0.3, fb = 0.6, et = 3.0 / 9.0, tm = 2.0 / 9.0;
	mx += synth2(time - et) * ec * vec2(1.0, 0.2); ec *= fb; et += tm;
	mx += synth2(time - et) * ec * vec2(0.2, 1.0); ec *= fb; et += tm;
	mx += synth2(time - et) * ec * vec2(1.0, 0.2); ec *= fb; et += tm;
	mx += synth2(time - et) * ec * vec2(0.2, 1.0); ec *= fb; et += tm;
	return mx;
}

// oldschool explosion sound fx
float expl(float tb)
{
	//tb = fract(tb / 4.0) * 0.5;
	float aa = 20.0;
	tb = sqrt(tb * aa) / aa;
	
	float amp = exp(max(tb - 0.15, 0.0) * -10.0);
	float v = nse(quan(mod(tb, 0.1), 0.0001));
	v = dist(v, 4.0) * amp;
	return v;
}

vec2 synth1_echo(float tb, float time)
{
    vec2 v;
    v = synth(tb, time) * 0.5;// + synth2(time) * 0.5;
	float ec = 0.4, fb = 0.6, et = 2.0 / 9.0, tm = 2.0 / 9.0;
	v += synth(tb, time - et) * ec * vec2(1.0, 0.5); ec *= fb; et += tm;
	v += synth(tb, time - et).yx * ec * vec2(0.5, 1.0); ec *= fb; et += tm;
	v += synth(tb, time - et) * ec * vec2(1.0, 0.5); ec *= fb; et += tm;
	v += synth(tb, time - et).yx * ec * vec2(0.5, 1.0); ec *= fb; et += tm;
	
    return v;
}

vec2 mainSound( in int samp,float time)
{
	vec2 mx = vec2(0.0);
	
	float tb = mod(time * 9.0, 16.0);
	
	
	mx = synth1_echo(tb, time) * 0.8 * smoothstep(0.0, 0.01, abs(mod(time * 9.0, 256.0) + 8.0 - 128.0) - 8.0);
	
    float hi = 1.0;
    float ki = smoothstep(0.01, 0.0, abs(mod(time * 9.0, 256.0) - 64.0 - 128.0) - 64.0);
    float s2i = 1.0 - smoothstep(0.01, 0.0, abs(mod(time * 9.0, 256.0) - 64.0 - 128.0) - 64.0);
    hi = ki;
    
    mx += expl(mod(time * 9.0, 64.0) / 4.5) * 0.4 * s2i;
    
	mx += vec2(hat(tb) * 1.5) * hi;
	
	//mx += dist(fract(tb / 16.0) * sin(ntof(77.0 - 36.0) * pi2 * time), 8.0) * 0.2;
	//mx += expl(tb) * 0.5;
	
	mx += vec2(synth2_echo(time, tb)) * 0.2 * s2i;
	
	
	mx = mix(mx, mx * (1.0 - fract(tb / 4.0) * 0.5), ki);
	float sc = sin(pi2 * tb) * 0.4 + 0.6;
	float k = kick(tb, time) * 0.8 * sc * ki;// - kick(tb, time - 0.004) * 0.5 - kick(tb, time - 0.008) * 0.25);
	
	mx += vec2(k);
	
	
	
	mx = dist(mx, 1.00);
	
	return vec2(mx);
}
`;

export default class implements iSub {
  key(): string {
    return 'ldfSW2';
  }
  name(): string {
    return 'sound - acid jam';
  }
  sort() {
    return 498;
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
}
