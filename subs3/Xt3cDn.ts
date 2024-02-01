import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#if 1
uint baseHash(uvec3 p)
{
    p = 1103515245U*((p.xyz >> 1U)^(p.yzx));
    uint h32 = 1103515245U*((p.x^p.z)^(p.y>>3U));
    return h32^(h32 >> 16);
}

uint baseHash(uint p)
{
    p = 1103515245U*((p >> 1U)^(p));
    uint h32 = 1103515245U*((p)^(p>>3U));
    return h32^(h32 >> 16);
}
#else
//XXHash32 based (https://github.com/Cyan4973/xxHash)
uint baseHash(uvec3 p)
{
	const uint PRIME32_2 = 2246822519U, PRIME32_3 = 3266489917U;
	const uint PRIME32_4 = 668265263U, PRIME32_5 = 374761393U;
	uint h32 =  p.z + PRIME32_5 + p.x*PRIME32_3;
	h32 = PRIME32_4*((h32 << 17) | (h32 >> (32 - 17)));
	h32 += p.y * PRIME32_3;
	h32 = PRIME32_4*((h32 << 17) | (h32 >> (32 - 17))); //Initial testing suggests this line could be omitted for extra perf
    h32 = PRIME32_2*(h32^(h32 >> 15));
    h32 = PRIME32_3*(h32^(h32 >> 13));
    return h32^(h32 >> 16);
}

uint baseHash(uint p)
{
	const uint PRIME32_2 = 2246822519U, PRIME32_3 = 3266489917U;
	const uint PRIME32_4 = 668265263U, PRIME32_5 = 374761393U;
	uint h32 = p + PRIME32_5;
	h32 = PRIME32_4*((h32 << 17) | (h32 >> (32 - 17))); //Initial testing suggests this line could be omitted for extra perf
    h32 = PRIME32_2*(h32^(h32 >> 15));
    h32 = PRIME32_3*(h32^(h32 >> 13));
    return h32^(h32 >> 16);
}
#endif

//---------------------3D input---------------------
float hash13(uvec3 x)
{
    uint n = baseHash(x);
    return float(n)*(1.0/float(0xffffffffU));
}

vec2 hash23(uvec3 x)
{
    uint n = baseHash(x);
    uvec2 rz = uvec2(n, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec2((rz.xy >> 1) & uvec2(0x7fffffffU))/float(0x7fffffff);
}

vec3 hash33(uvec3 x)
{
    uint n = baseHash(x);
    uvec3 rz = uvec3(n, n*16807U, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec3((rz >> 1) & uvec3(0x7fffffffU))/float(0x7fffffff);
}

vec4 hash43(uvec3 x)
{
    uint n = baseHash(x);
    uvec4 rz = uvec4(n, n*16807U, n*48271U, n*69621U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec4((rz >> 1) & uvec4(0x7fffffffU))/float(0x7fffffff);
}

//---------------------1D input---------------------
float hash11(uint x)
{
    uint n = baseHash(x);
    return float(n)*(1.0/float(0xffffffffU));
}

vec2 hash21(uint x)
{
    uint n = baseHash(x);
    uvec2 rz = uvec2(n, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec2((rz.xy >> 1) & uvec2(0x7fffffffU))/float(0x7fffffff);
}

vec3 hash31(uint x)
{
    uint n = baseHash(x);
    uvec3 rz = uvec3(n, n*16807U, n*48271U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec3((rz >> 1) & uvec3(0x7fffffffU))/float(0x7fffffff);
}

vec4 hash41(uint x)
{
    uint n = baseHash(x);
    uvec4 rz = uvec4(n, n*16807U, n*48271U, n*69621U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec4((rz >> 1) & uvec4(0x7fffffffU))/float(0x7fffffff);
}

#if 1
//Modified from: iq's "Integer Hash - III"
//Faster than "full" xxHash and good quality
uint baseHash(uvec2 p)
{
    p = 1103515245U*((p >> 1U)^(p.yx));
    uint h32 = 1103515245U*((p.x)^(p.y>>3U));
    return h32^(h32 >> 16);
}
#else
//XXHash32 based (https://github.com/Cyan4973/xxHash)
//Slower, higher quality
uint baseHash(uvec2 p)
{
    const uint PRIME32_2 = 2246822519U, PRIME32_3 = 3266489917U;
	const uint PRIME32_4 = 668265263U, PRIME32_5 = 374761393U;
    uint h32 = p.y + PRIME32_5 + p.x*PRIME32_3;
    h32 = PRIME32_4*((h32 << 17) | (h32 >> (32 - 17))); //Initial testing suggests this line could be omitted for extra perf
    h32 = PRIME32_2*(h32^(h32 >> 15));
    h32 = PRIME32_3*(h32^(h32 >> 13));
    return h32^(h32 >> 16);
}
#endif

//---------------------2D input---------------------

float hash12(uvec2 x)
{
    uint n = baseHash(x);
    return float(n)*(1.0/float(0xffffffffU));
}

vec2 hash22(uvec2 x)
{
    uint n = baseHash(x);
    uvec2 rz = uvec2(n, n*48271U);
    return vec2((rz.xy >> 1) & uvec2(0x7fffffffU))/float(0x7fffffff);
}

vec3 hash32(uvec2 x)
{
    uint n = baseHash(x);
    uvec3 rz = uvec3(n, n*16807U, n*48271U);
    return vec3((rz >> 1) & uvec3(0x7fffffffU))/float(0x7fffffff);
}

vec4 hash42(uvec2 x)
{
    uint n = baseHash(x);
    uvec4 rz = uvec4(n, n*16807U, n*48271U, n*69621U); //see: http://random.mat.sbg.ac.at/results/karl/server/node4.html
    return vec4((rz >> 1) & uvec4(0x7fffffffU))/float(0x7fffffff);
}

//--------------------------------------------------


//Example taking an arbitrary float value as input
/*
	This is only possible since the hash quality is high enough so that
	raw float input doesn't break the process when the raw bits are used
*/
vec4 hash42(vec2 x)
{
    uint n = baseHash(floatBitsToUint(x));
    uvec4 rz = uvec4(n, n*16807U, n*48271U, n*69621U);
    return vec4((rz >> 1) & uvec4(0x7fffffffU))/float(0x7fffffff);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    vec2 p = fragCoord/iResolution.xy;
    p.x *= iResolution.x/iResolution.y;
    
    //float input
    //fragColor = hash42(p);
    
    //2D input
    fragColor = hash42(uvec2(fragCoord));
    
    //1D input
    //fragColor = hash41(uint(fragCoord.x + fragCoord.y*900.));
    
    //3D input
    //fragColor = hash43(uvec3(fragCoord.xy, uint(fragCoord.y)*0xffffU));
}

`;

export default class implements iSub {
  key(): string {
    return 'Xt3cDn';
  }
  name(): string {
    return 'Quality hashes collection WebGL2';
  }
  sort() {
    return 326;
  }
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
}
