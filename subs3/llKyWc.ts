import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define NOISE_TYPE 1

#define SCROLL_COORDS
#define DIAGONAL_DERIVATIVES
#define SHOW_FOURIER
#define SIZE (floor(iResolution.y/2.25)*2.)

const float globalScale = 1.;


uint baseHash(uvec2 p)
{
    uint h32 = p.y + 374761393U + p.x*3266489917U;
    h32 = 2246822519U*(h32^(h32 >> 15));
    h32 = 3266489917U*(h32^(h32 >> 13));
    return h32^(h32 >> 16);
}

float hash12(vec2 x)
{
    uint n = baseHash(uvec2(ivec2(x)));
    return float(n)*(1.0/float(0xffffffffU));
}

vec2 hash22(vec2 x)
{
    uint n = baseHash(uvec2(ivec2(x)));
    uvec2 rz = uvec2(n, n*48271U);
    return vec2(rz.xy & uvec2(0x7fffffffU))/float(0x7fffffff);
}

vec4 hash42(vec2 x)
{
    uint n = baseHash(uvec2(ivec2(x)));
    uint n2 = n*48271U;
    uvec4 rz = uvec4(n, n*16807U, n*n*48271U, n*n*69621U);
    return vec4(rz & uvec4(0x7fffffffU))/float(0x7fffffff);
}
`;

let buffA = `
float nuttall(float x, float w)
{
    const float pi = 3.14159265358979;
    if (abs(x) > w)
        return 0.;
    //Standard Nuttall
    //return 0.355768 - 0.487396*cos(pi*x/w + pi) + 0.144232*cos(2.*pi*x/w) - 0.012604*cos(3.*pi*x/w + pi*3.);
    return 0.365 - (0.5)*cos(pi*x/w + pi) + (0.135)*cos(2.*pi*x/w);
}

float orbitNoise(vec2 p)
{
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float rz = 0.;
    float orbitRadius = .75;

    //16 taps
    for (int j = -1; j <= 2; j++)
    for (int i = -1; i <= 2; i++)
    {
        vec2 dp = vec2(j,i);
        vec4 rn = hash42(dp + ip) - 0.5;
        vec2 op = fp - dp + rn.zw*orbitRadius;
        rz += nuttall(length(op),1.85)*dot(rn.xy*1.7, op);
    }
    return rz*0.5+0.5;
    //return smoothstep(-1.0, 1.0,rz);
}

vec4 powX(float x) {float x2 = x*x; return vec4(x2*x, x2, x, 1.0); }
vec4 MNParamsA(float B, float C){ return vec4(12. - 9.*B - 6.*C, -18. + 12.*B + 6.*C, 0.0, 6. -2.*B)/6.; }
vec4 MNParamsB(float B, float C){ return vec4(-B -6.*C, 6.*B + 30.*C, -12.*B - 48.*C, 8.*B + 24.*C)/6.; }

float eval(float c0, float c1, float c2, float c3, float x) 
{    
    const float B = .8;
    const float C = 0.25;
    vec4 pA = MNParamsA(B, C);
    vec4 pB = MNParamsB(B, C);
    
    return c0*dot(pB, powX(x + 1.0)) + c1*dot(pA, powX(x)) +
           c2*dot(pA, powX(1.0 - x)) + c3*dot(pB, powX(2.0 - x));
}

float bicubicNoise(in vec2 p)
{
    vec2 fp = fract(p);
    vec2 ip = floor(p);
    
    float s99 = hash12(ip+vec2(-1,-1)), s19 = hash12(ip+vec2(1,-1));
    float s00 = hash12(ip+vec2(0,0)),   s20 = hash12(ip+vec2(2,0));
    float s91 = hash12(ip+vec2(-1, 1)), s11 = hash12(ip+vec2(1, 1));
    float s02 = hash12(ip+vec2(0,2)),   s22 = hash12(ip+vec2(2,2));
    float s09 = hash12(ip+vec2(0,-1)),  s29 = hash12(ip+vec2(2,-1));
    float s90 = hash12(ip+vec2(-1,0)),  s10 = hash12(ip+vec2(1,0));
    float s01 = hash12(ip+vec2(0,1)),   s21 = hash12(ip+vec2(2,1));
    float s92 = hash12(ip+vec2(-1,2)),  s12 = hash12(ip+vec2(1,2));
    
    float rz =  eval(eval(s99, s09, s19, s29, fp.x), eval(s90, s00, s10, s20, fp.x),
                eval(s91, s01, s11, s21, fp.x), eval(s92, s02, s12, s22, fp.x), fp.y);
    
    //return rz;
    return smoothstep(0.0,1.,rz);
}

float valueNoise(vec2 p)
{
    vec2 ip = floor(p);
    vec2 fp = fract(p);
	vec2 ramp = fp*fp*(3.0-2.0*fp);

    float rz= mix( mix( hash12(ip + vec2(0.0,0.0)), hash12(ip + vec2(1.0,0.0)), ramp.x),
                   mix( hash12(ip + vec2(0.0,1.0)), hash12(ip + vec2(1.0,1.0)), ramp.x), ramp.y);
    
    return rz;
}

vec2 hashz( vec2 p ) // replace this by something better
{
	p = vec2( dot(p,vec2(127.1,311.7)),
			  dot(p,vec2(269.5,183.3)) );

	//return -1.0 + 2.0*fract(sin(p)*43758.5453123);
    return normalize(-1.0 + 2.0*fract(sin(p)*43758.5453123) + 1e-7);
}

float simplex( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2 i = floor( p + (p.x+p.y)*K1 );
	
    vec2 a = p - i + (i.x+i.y)*K2;
    vec2 o = step(a.yx,a.xy);    
    vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;

    vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

	vec3 n = h*h*h*h*vec3( dot(a,hashz(i+0.0)), dot(b,hashz(i+o)), dot(c,hashz(i+1.0)));

    return dot( n, vec3(80.0) )*0.5+0.5;
	
}

vec2 hashg(vec2 x) { return hash22(x)*2.0-1.0;}

float gradientNoise( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
	
	vec2 u = f*f*(3.0-2.0*f);

    float rz =  mix( mix( dot( hashg( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ), 
                     dot( hashg( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( hashg( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ), 
                     dot( hashg( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
    
    //return rz*0.75+0.5;
    return smoothstep(-.9,.9,rz);
}

float fbm(vec2 p)
{
    float rz = 0.;
    float amp = 1.95;
    for (int i = 0; i < 7; i++)
    {
        rz += orbitNoise(p*1.)/amp;
        //rz += bicubicNoise(p*1.3)/amp;
        //rz += gradientNoise(p*.6)/amp;
        //rz += valueNoise(p)/amp;
        //rz += simplex(p*.35)/amp;
        amp *= 2.;
        p *= 2.06;
    }
    //return rz;
    return smoothstep(0.,1.,rz); 
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
#ifdef SHOW_FOURIER
    if(fragCoord.x > SIZE)
    {
        fragColor = vec4(0);
        return;
    }
#endif
    vec2 p = fragCoord/iResolution.xy;
    vec2 q = p;
	p.x *= iResolution.x/iResolution.y;
    
#ifdef SCROLL_COORDS
    p += vec2(1,1.5)*iTime*0.03;
#endif
    
    if (fragCoord.y > SIZE)
        p*=0.75;
    
    vec3 col = vec3(0);
    
    p *= globalScale;
    
#if (NOISE_TYPE == 1)
    col = orbitNoise(p*40.)*vec3(1);
#elif (NOISE_TYPE == 2)
    col = bicubicNoise(p*55.)*vec3(1);
#elif (NOISE_TYPE == 3)
    col = valueNoise(p*40.)*vec3(1);
#elif (NOISE_TYPE == 4)
    col = gradientNoise(p*25.)*vec3(1);
#elif (NOISE_TYPE == 5)
    col = simplex(p*14.)*vec3(1);
#elif (NOISE_TYPE == 6)
    col = fbm(p*20.)*vec3(1);
#endif
    
    //if (col.x >= 1. || col.x <= 0.) col = vec3(1,0,0); //Range check
    col = clamp(col, 0.,1.);
    
    fragColor = vec4(col,1.0);
}
`;

let buffB = `
vec2 cmul (vec2 a,float b) { return mat2(a,-a.y,a.x) * vec2(cos(b),sin(b)); } 

void mainImage(out vec4 fragColor, vec2 fragCoord )
{
   	fragColor = vec4(0);
    
#ifdef SHOW_FOURIER
    if(fragCoord.x > SIZE || fragCoord.y > SIZE) return;
    
    for(float i = 0.; i < SIZE; i++)  
	{
		vec2 xn = texelFetch(iChannel0, ivec2(i, fragCoord.y), 0).rr;
        vec2 yn = texelFetch(iChannel1, ivec2(fragCoord.x, i), 0).ba;
		vec2 ang = - 6.2831853 * (fragCoord-.5 -SIZE/2.) * i/SIZE;
		fragColor.zw += cmul(xn, ang.x);
		fragColor.xy += cmul(yn, ang.y);
    }
#endif
}`;

let fragment = `
//2D Signal Inspector
//by nimitz 2018 (twitter: @stormoid)

//The noise/signal type can be changed in the Common tab
//and the code for the signal generation is in Buffer A

/*
	Tools to help design 2D functions. Here used for noise design, but can be 
	used for SDFs, Hashes, Image filters or any function that takes 2D input.

	The display is as follow:
		Top left: Averaged distribution of the signal in the [0..1] range with
				  reference bars at 1/4, 1/2 and 3/4

		Bottom left: Preview of the signal itself, coordinates are slowly moving by
					 default, can be turned off in the Common tab

		Top right: First and second derivatives of a slice of the signal, to see
				   at a glance the continuity of the signal, uses horizontal (X aligned)
				   slices by default, can be switched to diagonal slices in the common tab

		Bottom right: 2D discrete fourier transform of the input, useful to see the
					  signal's frequency distribution and potential anisotropy


		To increase the size/resolution of the DFT, increase the globalSize to shrink the 
		feature size to help get a better picture over the signal's main frequqncy range


		An interesting note regarding the noise distributions: For noises/signals with
		too narrow a distribution a simple smoothstep (or a more complex filter) can
		be used as a primitive form of "gain compression" to flatten the distribution.
		Especially useful when building FBM noise from narrow distributed noises 
		(such as gradient noise) so that the end result isn't in a very short value range.
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord/iResolution.xy;
    
    vec3 col = vec3(0);
    
#ifdef SHOW_FOURIER
    if (q.x > 0.5)
    {
        vec2 dft = textureLod(iChannel1, q-vec2(0.5,0.0), 0.).xy;
        float amp = length(dft) / SIZE; 
        col = vec3(amp);
    }	
    else
#endif
    {
        col = textureLod(iChannel0, q, 0.).rgb;
        //col = length(col)*vec3(0.577);
    }
    
    //Distribution plot
    float tot = 0.;
    if (fragCoord.y> SIZE && fragCoord.x < SIZE)
    {
        const float bands = 60.;
        float bt = floor(fragCoord.x*bands/SIZE);
        float pt = (floor((fragCoord.x)*bands/SIZE)+0.5)/bands;
        const float width = 6.;
        for (float j = 0.; j<=width; j++)
        for (float i = 0.; i<SIZE; i++)
        {
            float v = texelFetch(iChannel0, ivec2(bt+j, i + 0.5), 0).x;
            if (abs(v-pt) < .5/bands)
            	tot += 1.;
        }
        tot /= SIZE*width;
        col.rgb = vec3(smoothstep(0.00,1.,tot*SIZE-fragCoord.y + SIZE + 1.))*vec3(.4,.4,.5);
        col.rgb += vec3(smoothstep(1.,0.,abs(tot*SIZE-fragCoord.y + SIZE + 0.5)))*vec3(.8,.8,.8);
        if(fragCoord.y < (SIZE+50.))
        {
        	col.rgb = max(col.rgb, vec3(0.9,0.6,0.1)*vec3(smoothstep(1.4,0.,abs(fragCoord.x - SIZE/2.))));
        	col.rgb = max(col.rgb, vec3(0.55,0.5,0.4)*vec3(smoothstep(1.4,0.,abs(abs(fragCoord.x - SIZE/2.)-SIZE/4.))));
        }
    }
    
    //First and second derivatives plot
    if (fragCoord.y> SIZE && fragCoord.x > SIZE)
    {
        col = vec3(1);
#ifndef DIAGONAL_DERIVATIVES 
        //Horizontal derivatives
        float t0 = texelFetch(iChannel0, ivec2(fragCoord.x - SIZE, SIZE),0).x;
        float t1 = texelFetch(iChannel0, ivec2(fragCoord.x-1. - SIZE, SIZE),0).x;
        float t2 = texelFetch(iChannel0, ivec2(fragCoord.x+1. - SIZE, SIZE),0).x;
#else
        //Diagonal derivative
        float t0 = texelFetch(iChannel0, ivec2(fragCoord.x - SIZE, SIZE+1.),0).x;
        float t1 = texelFetch(iChannel0, ivec2(fragCoord.x-1. - SIZE, SIZE),0).x;
        float t2 = texelFetch(iChannel0, ivec2(fragCoord.x+1. - SIZE, SIZE+2.),0).x;
#endif
        float dr = (t0 - t1)*iResolution.x*0.00025/globalScale;
        float dr2 = (t1 + t2 - t0*2.)*iResolution.x*0.001/globalScale;
    
        col.rgb = smoothstep(1.5,.0, abs(dr*SIZE-fragCoord.y + SIZE + 35.))*vec3(1.0,0.7,0.3);
        col.rgb += smoothstep(1.5,.0, abs(dr2*SIZE-fragCoord.y + SIZE + 10.))*vec3(0.5,0.7,1);
    
    }
    
    col *= smoothstep(0.,1.7,abs(fragCoord.y-SIZE+1.));

    fragColor = vec4(col,1.0);
}
`;

fragment = common + fragment;
buffA = common + buffA;
buffB = common + buffB;

export default class implements iSub {
  key(): string {
    return 'llKyWc';
  }
  name(): string {
    return '2D Signal Inspector';
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
      { type: 1, f: buffA, fi: 0 }, //
      // { type: 1, f: buffB, fi: 0 }, //
    ];
  }
}
