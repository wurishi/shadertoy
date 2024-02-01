import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define MAX_HASH 9.0
//#define VIS_HASH 2

//#define ANIMATE

//note: remaps v to [0;1] in interval [a;b]
float remap( float a, float b, float v )
{
	return clamp( (v-a) / (b-a), 0.0, 1.0 );
}
//note: quantizes in l levels
float truncate( float a, float l )
{
	return floor(a*l)/l;
}

uvec4 fnv(uvec4 seed) {
    uvec4 h = (0x6A7F8FAAu^seed)*0x01000193u;
    h = ((h.wxyz>>11u)^h^seed.yzwx)*0x01000193u;
    h = ((h.zwxy>>7u)^h^seed.yxwz)*0x01000193u;
    return h;
}
#define I2F (1./float(0xFFFFFFFFu))


uint lcg(uint value)
{
    //static uint value = 1;
    //value *= 1664525U;
    //value += 1013904223U;
    value *= 0xae3cc725u;
    value += 0x9fe72885u;
    return value;
}

uint hash12_xor_int(uint x, uint y)
{
	//note: improved constants by MBR, https://twitter.com/marc_b_reynolds/status/924771187070308352
    #define W0 0x3504f335u    // 15 | 101 | 41*79*274627
	#define W1 0x8fc1ecd5u  // 18 | 101 | 5*482370193
    
	#define M  741103597u    // 13*83*686843

    x *= W0;   // x' = Fx(x)
    y *= W1;   // y' = Fy(y)

    //note: hash2-improvement from MBR
    //x += W1;   // some odd constant
    //y += W0;   // some odd constant

    x ^= y;    // combine
    x *= M;    // MLCG constant

    //note: murmur-like finalizer, suggestion: https://twitter.com/funny_falcon/status/923270464394481664
	x ^= x >> 16; //note: this appears to be enough?
	//x *= M;
	//x ^= x >> 16;
    
  	return x;
}
float hash12_xor_float( vec2 seed )
{
    uint hi = hash12_xor_int( uint(seed.x), uint(seed.y) );
    return float(hi) * (1.0/4294967296.0);
}

uint wang_hash_ui( uint seed )
{
    seed = (seed ^ 61u) ^ (seed >> 16);
    seed *= 9u;
    seed = seed ^ (seed >> 4);
    seed *= 0x27d4eb2du;
    seed = seed ^ (seed >> 15);
    return seed;
}

float wang_hash_f(inout uint seed)
{
    float r = float(wang_hash_ui(seed)) * (1.0 / 4294967296.0);
    //seed += 10u;
    return r;
}

// A single iteration of Bob Jenkins' One-At-A-Time hashing algorithm.
uint JenkinsHash( uint x)
{
    x += (x << 10u);
    x ^= (x >>  6u);
    x += (x <<  3u);
    x ^= (x >> 11u);
    x += (x << 15u);
    return x;
}
// Compound versions of the hashing algorithm.
uint JenkinsHash( uvec2 v)
{
    return JenkinsHash(v.x ^ JenkinsHash(v.y));
}

uint baseHash(uvec2 p)
{
    p = 1103515245U*((p >> 1U)^(p.yx));
    uint h32 = 1103515245U*((p.x)^(p.y>>3U));
    return h32^(h32 >> 16);
}

// bias: 0.020888578919738908 = minimal theoretic limit
uint triple32(uint x)
{
    x ^= x >> 17;
    x *= 0xed5ad4bbU;
    x ^= x >> 11;
    x *= 0xac4c1b51U;
    x ^= x >> 15;
    x *= 0x31848babU;
    x ^= x >> 14;
    return x;
}

uvec2 pcg2d(uvec2 v)
{
    v = v * 1664525u + 1013904223u;

    v.x += v.y * 1664525u;
    v.y += v.x * 1664525u;

    v = v ^ (v>>16u);

    v.x += v.y * 1664525u;
    v.y += v.x * 1664525u;

    v = v ^ (v>>16u);

    return v;
}
uvec4 pcg4d(uvec4 v)
{
	v = v * 1664525u + 1013904223u;

    v.x += v.y*v.w;
    v.y += v.z*v.x;
    v.z += v.x*v.y;
    v.w += v.y*v.z;

    v.x += v.y*v.w;
    v.y += v.z*v.x;
    v.z += v.x*v.y;
    v.w += v.y*v.z;

    v = v ^ (v>>16u);

    return v;
}

vec4 pcg4d_f( vec4 v )
{
    return (1.0/float(0xffffffffu)) * vec4(pcg4d( uvec4(floatBitsToUint(v.x),
                  			 							floatBitsToUint(v.y),
                  			 							floatBitsToUint(v.z),
                  			 							floatBitsToUint(v.w)) ));
}

uint hashIQ(uint n)
{
    // integer hash copied from Hugo Elias
    n = (n << 13U) ^ n;
    return n * (n * n * 15731U + 789221U) + 1376312589U;
}
// Integer Hash - III
uint iqint3(uvec2 x)
{
    uvec2 q = 1103515245U * ( (x>>1U) ^ (x.yx   ) );
    uint  n = 1103515245U * ( (q.x  ) ^ (q.y>>3U) );
    n = n ^ (n>>16u); //note: nimitz finalizer
    return n;
}
float hashIQf(uint n)
{
    n = hashIQ( n );
    return float(n & 0x7fffffffU) / float(0x7fffffff);
}


float hash12_float(vec2 p)
{
    #define HASHSCALE1 .1031
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}
float hash12_float_classic(vec2 p)
{
    // Two typical hashes...
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    
    // This one is better, but it still stretches out quite quickly...
    // But it's really quite bad on my Mac(!)
    //return fract(sin(dot(p, vec2(1.0,113.0)))*43758.5453123);
}


// ====================================================

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	
    int idx = int( floor( 8.0 * uv.x ) + 8.0 * floor( 4.0 * uv.y ) );
    //fragColor = vec4( vec3(idx)/(8.0*4.0), 1.0 ); return; //DBG
    
    //vec2 seed = fragCoord.xy;
    vec2 seed = mod( fragCoord.xy, vec2(iResolution.x/8.0, iResolution.y/4.0) );
    //fragColor = vec4(seed/iResolution.xy,0.0,1.0); return; //DBG

    #if defined( ANIMATE )
    seed += 100.0 * iTime;
    #endif //ANIMATE
    
    int hashindex = int( mod( 0.5*iTime, (MAX_HASH+1.0) ) );
    #if defined( VIS_HASH )
    hashindex = VIS_HASH; //DBG
    #endif

    if ( iMouse.z > 0.5 )
        hashindex = int( iMouse.x / iResolution.x * (MAX_HASH+1.0) );
    
    vec3 dbgcol = vec3(0.0,0.0,0.0);
    vec3 c = vec3(0.0);
    if ( hashindex <= 4 )
    {
        uint hi;
        if ( hashindex == 0 )
        {
            hi = hash12_xor_int( uint(seed.x), uint(seed.y) ); //32b hash
            
            //hi = baseHash( uvec2(seed) );
            dbgcol = vec3(1,0,0);
        }
        else if ( hashindex == 1 )
        {
            uint wang_seed = uint(fragCoord.y * iResolution.x + fragCoord.x);
            hi = wang_hash_ui( wang_seed*100u ); //32b hash
            
            //hi = JenkinsHash( uvec2(seed)*100u );
            dbgcol = vec3(0,1,0);
        }
        else if ( hashindex == 2 )
        {

            //hi = iqint3( uvec2(seed) );
        	hi = triple32( uint(seed.x) + triple32( uint(seed.y) ) );
            dbgcol = vec3(0,0,1);
        }
        else if ( hashindex == 3 )
        {
        	hi = lcg( uint(seed.x) + lcg( uint(seed.y) ) );    
            dbgcol = vec3(1,1,0);
        }
        else if ( hashindex == 4 )
        {
            //hi = pcg2d( uvec2(seed) ).x;
            hi = fnv( uvec4(seed.x, seed.y, 1, 1) ).x;
            dbgcol = vec3(0.1,0.5,0.75);
        }

        uint bit = uint(idx);
        uint bitmask = 1u<<bit;
        float bitplane = float( (hi & bitmask)>>bit );
        c = vec3(bitplane);
    }
    else if ( hashindex <= 8 )
    {
        float hf;
        if ( hashindex == 5) {
        	hf = hash12_float( seed );
            dbgcol = vec3(1,0,1);
        }
        else if ( hashindex == 6 )
        {
            hf = hash12_float_classic(seed);
        	
            dbgcol = vec3(0,1,1);
        }
        else if ( hashindex == 7 )
        {
            hf = hashIQf( uint(seed.x) + uint(hashIQ(uint(seed.y))) );
            dbgcol = vec3(1,1,1);
        }
        else if ( hashindex == 8 )
        {
            hf = hash12_xor_float( seed );
            dbgcol = vec3(0.5,0.5,0.5);
        }
            
        //fragColor = vec4( vec3(hf), 1.0 ); return; //DBG
        
        //uint hi = uint(hf * 4294967296.0); //32b
        //uint hi = uint(hf * 16777216.0); //24b
        //uint hi = uint(hf * 65536.0); //16b
        uint hi = floatBitsToUint( hf ); //note: vis float-representation directly
        
        uint bit = uint(idx);
        uint bitmask = 1u<<bit;
		float bitplane = float( (hi & bitmask)>>bit );
        c = vec3( bitplane );
        
        //note: mark floatbits sign, exp, frac
        if ( bit==31u)
            c *= vec3(0.5, 0.6, 0.7 );
        else if ( bit > 22u ) //sign
            c *= vec3(0.6, 0.7, 0.5); //exp
        else
            c *= vec3(0.7, 0.6, 0.5); //frac
    }
    else if ( hashindex == 9 )
    {
        //TODO: hmm....

        //note: vis each of the 8bit bitplanes in the blue-noise texture
        float hf = texelFetch( iChannel0, ivec2(seed.xy), 0 ).r; //8bit "hash", [0;1]
        uint hi = uint( 255.0 * hf ); //8bit, [0;255]

        uint bit = uint( idx );
        uint bitmask = 1u<<bit;
        float bitplane = float( (hi & bitmask)>>bit );

        c = vec3(bitplane, bitplane, bitplane);
        //c = vec3(hf);
        //c = vec3( float(hi)/255.0 );
        
        dbgcol = vec3(0.7,0.6,0.5);
    }

    
    fragColor = vec4( vec3(c), 1.0 );

    //lines
    float ll = step( 10.0/iResolution.x, 1.0-abs(2.0*fract(8.0*uv.x)-1.0))
    		 * step( 10.0/iResolution.y, 1.0-abs(2.0*fract(4.0*uv.y)-1.0));
    
    fragColor.rgb = mix( dbgcol, fragColor.rgb, ll );
}
`;

export default class implements iSub {
  key(): string {
    return 'lt2yDm';
  }
  name(): string {
    return 'hash: visualising bitplanes';
  }
  sort() {
    return 402;
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
    return [webglUtils.DEFAULT_NOISE];
  }
}
