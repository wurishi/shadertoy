import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
//Colors of noise by nimitz (2018) (twitter: @stormoid)

#define SIZE (400.)
//#define FBM
//#define ANIMATE
//#define RING_FILTER
`;

let buffA = `
//Colors of noise by nimitz (2018) (twitter: @stormoid)

#if 0
//Based on XXhash32 (https://github.com/Cyan4973/xxHash)
float hash(uvec2 p)
{
    const uint PRIME32_1 = 2654435761U;
	const uint PRIME32_2 = 2246822519U;
	const uint PRIME32_3 = 3266489917U;
	const uint PRIME32_4 = 668265263U;
	const uint PRIME32_5 = 374761393U;
    uint h32 = p.y + PRIME32_5;
    h32 += p.x * PRIME32_3;
    h32 = ((h32 << 17) | (h32 >> (32 - 17))) * PRIME32_4;
    h32 ^= h32 >> 15;
    h32 *= PRIME32_2;
    h32 ^= h32 >> 13;
    h32 *= PRIME32_3;
    h32 ^= h32 >> 16;
    return float(h32) * (1.0/float(0xffffffffU));
}
#else
float hash( uvec2 x )
{
    uvec2 q = 1103515245U * ( (x>>1U) ^ (x.yx   ) );
    uint  n = 1103515245U * ( (q.x  ) ^ (q.y>>3U) );
    return float(n) * (1.0/float(0xffffffffU));
}
#endif

vec2 cmul (vec2 a,float b) { return mat2(a,-a.y,a.x) * vec2(cos(b),sin(b)); } 

void mainImage( out vec4 fragColor, vec2 fragCoord )
{
   	fragColor = vec4(0,0,0,1);
    
    if(fragCoord.x > SIZE || fragCoord.y > SIZE) 
        discard;
        
    for(float i = 0.; i < SIZE; i++)  
    {
        vec2 xn = hash(uvec2(i + 0.5, fragCoord.y))*vec2(1,0);
        vec2 yn = texelFetch(iChannel0, ivec2(fragCoord.x, i + 0.5), 0).ba;
        vec2 a = - 6.2831853 * (fragCoord - 0.5 - SIZE/2.) * i/SIZE;
        fragColor.ba += cmul(xn, a.x);
        fragColor.rg += cmul(yn, a.y);
    }
    
    fragColor.ba /= SIZE;
    fragColor.a = 1.;
}
`;

let buffB = `
//Colors of noise by nimitz (2018) (twitter: @stormoid)
//Processing


//Can be different shapes
float shape(vec2 p)
{
    return length(p);
}

float linstep(in float mn, in float mx, in float x)
{
	return clamp((x - mn)/(mx - mn), 0., 1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord/iResolution.xy;
    vec2 p = fragCoord/SIZE - 0.5;
    
    if(fragCoord.x > SIZE || fragCoord.y > SIZE) return;
    
    vec4 col = texture(iChannel0, q).rgba;
    
    vec2 mo = iMouse.xy/iResolution.xy;
    mo = (mo==vec2(.0))?mo=vec2(0.37,0.8):mo;
    float shrp = mo.y*mo.y;
    
#ifdef FBM    
    float shp = shape(p*(2. - mo.y*1.));
    float w = 0.07 + mo.x*0.05;
    float filt = smoothstep(w,0., abs(shp + 0.07));
    filt = max(filt, 0.25*smoothstep(w,0., abs(shp + 0.05)));
    filt = max(filt, 0.06*smoothstep(w,0., abs(shp + 0.02)));
    filt = max(filt, 0.012*smoothstep(w,0., abs(shp - 0.03)));
    filt = max(filt, 0.006*smoothstep(w,0., abs(shp - 0.06)));
    filt = max(filt, 0.003*smoothstep(w,0., abs(shp - 0.09)));
    filt = max(filt, 0.002*smoothstep(w,0., abs(shp - 0.12)));
    filt = max(filt, 0.0015*smoothstep(w,0., abs(shp - 0.15)));
    filt = max(filt, 0.0008*smoothstep(w,0., abs(shp - 0.2)));
    filt = max(filt, 0.0005*smoothstep(w,0., abs(shp - 0.25)));
	col.rg *= filt;
#else
#ifndef RING_FILTER
    if (mo.x < 0.5)
        col.rg *= smoothstep(0.5,0.5 + shrp*0.9, sin(shape(p*1.5) + mo.x*2.8 + 1.8)*0.5+0.5);
    else
        col.rg *= smoothstep(0.5,0.5+shrp*0.5, sin(shape(p*1.5) + (mo.x)*3.2 + 3.6)*0.5+0.5);
#else
    col.rg *= smoothstep(0.5 + shrp*0.3,0.5 - shrp*0.3, abs(shape(p*1.5)-mo.x)*0.5+(0.5));
#endif
#endif
	
    
    #ifdef ANIMATE
    //animation (phase rotation)
    float r = length(col.rg);
    float a = atan(col.g,col.r);
    a *= iTime;
    col.rg = vec2(r*cos(a), r*sin(a));
    #endif
    
    //TODO polar sinusoidal or spiral test
    
    fragColor = vec4(col.rg, 1,1);
}
`;

let buffC = `
vec2 cmul (vec2 a,float b) { return mat2(a,-a.y,a.x)*vec2(cos(b), sin(b)); }
//#define Wrap(a) (fract((a + SIZE*0.5)/SIZE)*SIZE)
#define Wrap(uv)   mod(uv+SIZE/2.,SIZE)                    // wrap [-1/2,1/2] to [0,1]

void mainImage( out vec4 fragColor, vec2 fragCoord )
{
    fragColor = vec4(0);
    
    if(fragCoord.x > SIZE || fragCoord.y > SIZE) 
        discard;

    for(float i = 0.; i < SIZE; i++)
    {
        float m = Wrap(i);
        vec2 xn = texelFetch(iChannel0, ivec2(m + 0.5, fragCoord.y), 0).rg;
        vec2 yn = texelFetch(iChannel1, ivec2(fragCoord.x, m + 0.5), 0).ba;
        vec2 ang =  6.2831853 *  Wrap(fragCoord-.5) * i/SIZE;   
        fragColor.ba += cmul(xn, ang.x);
        fragColor.rg += cmul(yn, ang.y);
    }
    
    fragColor.ba /= SIZE;
    //fragColor.rg = clamp(fragColor.rg,0.0,1.);
    fragColor.rg = abs(fragColor.rg); //Should be incorrect, but gives best results
    fragColor.a = 1.;
}
`;

let buffD = `
//Colors of noise by nimitz (2018) (twitter: @stormoid)

//Renomalization

void mainImage( out vec4 fragColor, vec2 fragCoord )
{
    fragColor = vec4(0);
    
    float power = 0.;
    
    if(fragCoord.x > 1. || fragCoord.y > SIZE) 
        discard;

    float minX = 10.;
    float maxX = -10.;
    
    vec2 bY = texelFetch(iChannel1, ivec2(fragCoord.x, fragCoord.y), 0).ba;
    float minY = bY.x;
    float maxY = bY.y;
    
    for(float i = 0.; i < SIZE; i++)
    {
        vec2 x = texelFetch(iChannel0, ivec2(i + 0.5, fragCoord.y), 0).rg;
        vec2 y = texelFetch(iChannel1, ivec2(fragCoord.x, i + 0.5), 0).ba;
        
        minX = min(minX, x.x);
        maxX = max(maxX, x.x);
        minY = min(minY, y.x);
        maxY = max(maxY, y.y);     
    }
    
    fragColor.ba = vec2(minX, maxX);
    fragColor.rg = vec2(minY, maxY);
    fragColor.a = 1.;
}
`;

let fragment = `
float renormalize(float c)
{
    vec2 nx = texelFetch(iChannel2, ivec2(0, 0), 0).rg;
    float range = nx.y - nx.x;
    float offset = nx.x;
    return (c - nx.x)*1./range;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord/iResolution.xy;
    vec3 col = vec3(0);
    vec2 mo = iMouse.xy/iResolution.xy;
    mo = (mo==vec2(.0))?mo=vec2(0.3,0.7):mo;
    
    if (p.x < 0.5)
    {
        col = texture(iChannel0, p).rgg;
        col.b = max(col.r,col.g)*(atan(col.r, col.g)+3.14159265)/6.2831583;
        col = pow(col,vec3(0.5));
    }
    else
    {
        p.x -= 0.5;
        col = renormalize(texture(iChannel1, p).r) * vec3(1.0);
    }
    
    fragColor = vec4(col,1.0);
}
`;

fragment = common + fragment;
buffA = common + buffA;
buffB = common + buffB;
buffC = common + buffC;
buffD = common + buffD;

export default class implements iSub {
  key(): string {
    return 'ldyfRV';
  }
  name(): string {
    return 'Colors of noise';
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
      { type: 1, f: buffB, fi: 1 },
      { type: 1, f: buffC, fi: 2 },
      { type: 1, f: buffD, fi: 3 },
    ];
  }
}
