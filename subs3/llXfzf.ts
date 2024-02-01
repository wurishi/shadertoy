import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//2x2 Checkerboard bicubic reconstruction with gradient evaluation
//by nimitz 2018 (twitter: @stormoid)
//License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License

/*
	In this example the left side is rendered at a lower resolution and then upscaled using standard
	filtering and the right side is rendered at full resolution, but with only half the pixels in a
	checkerboard pattern. The result is visually very similar and the base version would be rendering
	35% more total fragments than the checkerboard version for a given effect in a practical scenario.

	Instead of using the typical 4x4 checkerboards grid a 2x2 grid can be used by splitting the render buffer
	in half and offsetting the rays accordingly, this then allows for this reconstruction algorithm to be used
	while minimizing the potential costs associated with fragment discard.

	The basic idea behind this reconstruction filter is to approximate the missing pixel color by running
	a somewhat standard bicubic filtering algorithm (with slightly tweaked parameters) allowing for a wide
	enough computation to smooth out the missing information. The algorithm is split into two main branches,
	depending on the on/off state of the evaluated fragment and then fetching not only the fragments required
	for the cubic evaluation but also the next neighbors for the first reconstruction step to feed the cubic filter.
	The first idea was to simply average the neighbors to get the missing information to evaluate the cubic spline,
	but this turned out to be prone to artifacts when the input contained linear features (especially at high contrast)
	and was inducing unwanted blur to the image. The solution was to introduce a simple luminosity gradient evaluation
	step which is then used to determine the texels to be used for the reconstructed spline input. The sharpness
	of that transition can be tweaked using a smoothstep function to accomodate for different inputs.

	This technique can be applied for any fragment side effect which takes enough rendering time
	(say over 1.5ms) to offset the cost of the reconstruction algorithm and the additional buffer required.
		
	I am using a standard bilinear filter for the reference (left) side, which could be argued
	to be contributing to the lower quality of the left side, but in the vast majority of applications
	bilinear filtering is still used so I feel this is a fair comparison. 

	The left side is also scaled up for the demo, which I have to do due to shadertoy fixed buffer size
	this would likely result in a small improvement in visual fidelity for the left side in real applications
*/

//You can test at the same fragment count (same rendering speed) by adding this define in both in this tab and in Buf B
//#define SAME_FRAG_COUNT

vec4 texfetch(sampler2D tx, vec4 p) {
    vec4 rez = texture(tx, p.xy, p.w);
    return rez;
}
  
//Mitchell Netravali Reconstruction Filter
//From gpu gems (http://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch24.html)
//(slightly optimized to combine powers)
float recons(float x)
{
    #if 0
	const float B = 1./3.;
    const float C = 1./3.;
    #else
    const float B = 2./12.;
    const float C = 5./12.;
    #endif
    
  	float ax = abs(x);
    float ax2 = ax*ax;
    
    if (ax < 1.) 
    {
        return ((12. - 9.*B - 6. * C)*ax*ax2 +
                (-18. + 12.*B + 6. * C)*ax2 + (6. - 2.*B))/6.;
    } 
    else if ((ax >= 1.) && (ax < 2.)) 
    {
        return ((-B - 6. * C)*ax*ax2 + (6.*B + 30.*C) * ax2 +
               (-12. * B - 48. * C)*ax + (8.*B + 24.*C)) / 6.;
    }
    else
    {
        return 0.;
    }
}

vec4 eval(vec4 v0, vec4 v1, vec4 v2, vec4 v3, float x) {
    
    return v0*recons(x + 1.0) + v1*recons(x) + v2*recons(1.0 - x) + v3*recons(2.0 - x);
}

//--------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------

vec4 lerp(vec4 a, vec4 b, float x) { return mix(a,b,x); }
vec4 reconstruct(sampler2D smp, vec2 t)
{
    vec2 resl = iChannelResolution[0].xy;
    vec2 p = resl*t - 0.5;
    vec2 fp = fract(p);
    vec2 ip = floor(p);
    float isOff = mod(ip.x + ip.y + 1., 2.);

    const float smm = 0.48;
    const float smx = 0.52;
    
    if (isOff >= 1.){
        
        vec4 s99 = texfetch(smp, vec4((ip+vec2(-1,-1) + 0.5)/resl, 0,-100.0));
        vec4 s19 = texfetch(smp, vec4((ip+vec2(1,-1) + 0.5)/resl, 0,-100.0));
        vec4 s00 = texfetch(smp, vec4((ip+vec2(0,0) + 0.5)/resl, 0,-100.0));
        vec4 s20 = texfetch(smp, vec4((ip+vec2(2,0) + 0.5)/resl, 0,-100.0));
        vec4 s91 = texfetch(smp, vec4((ip+vec2(-1, 1) + 0.5)/resl, 0,-100.0));
        vec4 s11 = texfetch(smp, vec4((ip+vec2(1, 1) + 0.5)/resl, 0,-100.0));
        vec4 s02 = texfetch(smp, vec4((ip+vec2(0,2) + 0.5)/resl, 0,-100.0));
        vec4 s22 = texfetch(smp, vec4((ip+vec2(2,2) + 0.5)/resl, 0,-100.0));
        
        vec4 s08 = texfetch(smp, vec4((ip+vec2(0,-2) + 0.5)/resl, 0,-100.0));
        vec4 s28 = texfetch(smp, vec4((ip+vec2(3,-2) + 0.5)/resl, 0,-100.0));
        vec4 s39 = texfetch(smp, vec4((ip+vec2(3,-1) + 0.5)/resl, 0,-100.0));
        vec4 s80 = texfetch(smp, vec4((ip+vec2(-2,0) + 0.5)/resl, 0,-100.0));
        vec4 s31 = texfetch(smp, vec4((ip+vec2(3, 1) + 0.5)/resl, 0,-100.0));
        vec4 s82 = texfetch(smp, vec4((ip+vec2(-2, 2) + 0.5)/resl, 0,-100.0));
        vec4 s93 = texfetch(smp, vec4((ip+vec2(-1,3) + 0.5)/resl, 0,-100.0));
        vec4 s13 = texfetch(smp, vec4((ip+vec2(1,3) + 0.5)/resl, 0,-100.0));
        
        float d99 = dot(vec3(0.3333), s99.rgb);
        float d19 = dot(vec3(0.3333), s19.rgb);
        float d00 = dot(vec3(0.3333), s00.rgb);
        float d20 = dot(vec3(0.3333), s20.rgb);
        float d91 = dot(vec3(0.3333), s91.rgb);
        float d02 = dot(vec3(0.3333), s02.rgb);
        float d11 = dot(vec3(0.3333), s11.rgb);
        float d22 = dot(vec3(0.3333), s22.rgb);
        
        float is09 = (abs(d99 - d19) - abs(dot(vec3(0.3333), s08.rgb) - d00))*0.5+0.5;
        float is29 = (abs(d19 - dot(vec3(0.3333), s39.rgb)) - abs(dot(vec3(0.3333), s28.rgb) - d20))*0.5+0.5;
        float is90 = (abs(dot(vec3(0.3333), s80.rgb) - d00) - abs(d99 - d91))*0.5+0.5;
        float is10 = (abs(d00 - d20) - abs(d19 - d11))*0.5+0.5;
        float is01 = (abs(d91 - d11) - abs(d00 - d02))*0.5+0.5;
        float is21 = (abs(d11 - dot(vec3(0.3333), s31.rgb)) - abs(d20 - d22))*0.5+0.5;
        float is92 = (abs(dot(vec3(0.3333), s82.rgb) - d02) - abs(d91 - dot(vec3(0.3333), s93.rgb)))*0.5+0.5;
        float is12 = (abs(d02 - d22) - abs(d11 - dot(vec3(0.3333), s13.rgb)))*0.5+0.5;
        
        //                    X    ,     Y
        vec4 s09 = lerp(s99 + s19, s00 + s08, smoothstep(smm, smx, is09))/2.;
        vec4 s29 = lerp(s19 + s39, s20 + s28, smoothstep(smm, smx, is29))/2.;
        vec4 s90 = lerp(s80 + s00, s91 + s99, smoothstep(smm, smx, is90))/2.;
        vec4 s10 = lerp(s00 + s20, s11 + s19, smoothstep(smm, smx, is10))/2.;
        vec4 s01 = lerp(s91 + s11, s02 + s00, smoothstep(smm, smx, is01))/2.;
        vec4 s21 = lerp(s11 + s31, s22 + s20, smoothstep(smm, smx, is21))/2.;
        vec4 s92 = lerp(s82 + s02, s93 + s91, smoothstep(smm, smx, is92))/2.;
        vec4 s12 = lerp(s02 + s22, s13 + s11, smoothstep(smm, smx, is12))/2.;
        return eval(eval(s99, s09, s19, s29, fp.x), eval(s90, s00, s10, s20, fp.x),
                    eval(s91, s01, s11, s21, fp.x), eval(s92, s02, s12, s22, fp.x), fp.y);
    }
    else
    {
        vec4 s09 = texfetch(smp, vec4((ip+vec2(0,-1) + 0.5)/resl, 0,-100.0));
        vec4 s29 = texfetch(smp, vec4((ip+vec2(2,-1) + 0.5)/resl, 0,-100.0));
        vec4 s90 = texfetch(smp, vec4((ip+vec2(-1,0) + 0.5)/resl, 0,-100.0));
        vec4 s10 = texfetch(smp, vec4((ip+vec2(1,0) + 0.5)/resl, 0,-100.0));
        vec4 s01 = texfetch(smp, vec4((ip+vec2(0, 1) + 0.5)/resl, 0,-100.0));
        vec4 s21 = texfetch(smp, vec4((ip+vec2(2, 1) + 0.5)/resl, 0,-100.0));
        vec4 s92 = texfetch(smp, vec4((ip+vec2(-1,2) + 0.5)/resl, 0,-100.0));
        vec4 s12 = texfetch(smp, vec4((ip+vec2(1,2) + 0.5)/resl, 0,-100.0));
        
        vec4 s89 = texfetch(smp, vec4((ip+vec2(-2,-1) + 0.5)/resl, 0,-100.0));
        vec4 s98 = texfetch(smp, vec4((ip+vec2(-1,-2) + 0.5)/resl, 0,-100.0));
        vec4 s18 = texfetch(smp, vec4((ip+vec2(1,-2) + 0.5)/resl, 0,-100.0));
        vec4 s30 = texfetch(smp, vec4((ip+vec2(3,0) + 0.5)/resl, 0,-100.0));
        vec4 s81 = texfetch(smp, vec4((ip+vec2(-2, 1) + 0.5)/resl, 0,-100.0));
        vec4 s03 = texfetch(smp, vec4((ip+vec2(0, 3) + 0.5)/resl, 0,-100.0));
        vec4 s23 = texfetch(smp, vec4((ip+vec2(2,3) + 0.5)/resl, 0,-100.0));
        vec4 s32 = texfetch(smp, vec4((ip+vec2(3,2) + 0.5)/resl, 0,-100.0));
        
        float d09 = dot(vec3(0.3333), s09.rgb);
        float d90 = dot(vec3(0.3333), s90.rgb);
        float d29 = dot(vec3(0.3333), s29.rgb);
        float d10 = dot(vec3(0.3333), s10.rgb);
        float d01 = dot(vec3(0.3333), s01.rgb);
        float d21 = dot(vec3(0.3333), s21.rgb);
        float d92 = dot(vec3(0.3333), s92.rgb);
        float d12 = dot(vec3(0.3333), s12.rgb);
        
        float is99 = (abs(dot(vec3(0.3333), s89.rgb) - d09) - abs(dot(vec3(0.3333), s98.rgb) - d90))*0.5+0.5; 
        float is19 = (abs(d09 - d29) - abs(dot(vec3(0.3333), s18.rgb) - d10))*0.5+0.5; 
        float is00 = (abs(d90 - d10) - abs(d09 - d01))*0.5+0.5; 
        float is20 = (abs(d10 - dot(vec3(0.3333), s30.rgb)) - abs(d29 - d21))*0.5+0.5; 
        float is91 = (abs(dot(vec3(0.3333), s81.rgb) - d01) - abs(d90 - d92))*0.5+0.5; 
        float is11 = (abs(d01 - d21) - abs(d10 - d12))*0.5+0.5; 
        float is02 = (abs(d92 - d12) - abs(d01 - dot(vec3(0.3333), s03.rgb)))*0.5+0.5; 
        float is22 = (abs(d12 - dot(vec3(0.3333), s32.rgb)) - abs(d21 - dot(vec3(0.3333), s23.rgb)))*0.5+0.5; 
        
        //                    X    ,     Y
        vec4 s99 = lerp(s89 + s09, s90 + s98, smoothstep(smm, smx, is99))/2.;
        vec4 s19 = lerp(s09 + s29, s10 + s18, smoothstep(smm, smx, is19))/2.;
        vec4 s00 = lerp(s90 + s10, s01 + s09, smoothstep(smm, smx, is00))/2.;
        vec4 s20 = lerp(s10 + s30, s21 + s29, smoothstep(smm, smx, is20))/2.;
        vec4 s91 = lerp(s81 + s01, s92 + s90, smoothstep(smm, smx, is91))/2.;
        vec4 s11 = lerp(s01 + s21, s12 + s10, smoothstep(smm, smx, is11))/2.;
        vec4 s02 = lerp(s92 + s12, s03 + s01, smoothstep(smm, smx, is02))/2.;
        vec4 s22 = lerp(s12 + s32, s23 + s21, smoothstep(smm, smx, is22))/2.;
        
        return eval(eval(s99, s09, s19, s29, fp.x), eval(s90, s00, s10, s20, fp.x),
                    eval(s91, s01, s11, s21, fp.x), eval(s92, s02, s12, s22, fp.x), fp.y);
    }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 q = fragCoord.xy/iResolution.xy;
    vec3 col = vec3(0);
    
    if (q.x > 0.5)
    {
    	col = reconstruct(iChannel0, q - vec2(0.5,0.)).xyz;
        vec3 colb= texfetch(iChannel0, vec4(q - vec2(0.5,0.),0.,0.)).rgb;
        col = mix(col, colb, smoothstep(0.85,0.95, cos(iTime*0.6+1.)));
    }
    else
    {
        #ifdef SAME_FRAG_COUNT
        col = texture(iChannel1, q*.7071, -99.).rgb;
        #else
        col = texture(iChannel1, q*.82, -99.).rgb;
        #endif
    }
    
    col *= smoothstep( 0.0, 0.004, abs(q.x-0.5));
	fragColor = vec4( col, 1.0 );
}
`;

const buffA = `
#define time iTime

mat2 m2 = mat2( 0.80,  0.60, -0.60,  0.80 );

vec2 hash( vec2 p )
{
	p = vec2( dot(p,vec2(127.1,311.7)),
			  dot(p,vec2(269.5,183.3)) );

	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

vec3 simplex2D( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2 i = floor(p + (p.x + p.y)*K1);
	
    vec2 a = p - i + (i.x + i.y)*K2;
    vec2 o = mix(vec2(1.0, 0.0), vec2(0.0,1.0), step(a.x,a.y));
    vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;
    
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0 );

    vec3 h2 = h*h;
    vec3 h4 = h2*h2;
    
    vec2 r0 = hash(i + 0.0);
    vec2 r1 = hash(i + o);
    vec2 r2 = hash(i + 1.0);
    
    float va = dot(a, r0);
    float vb = dot(b, r1);
    float vc = dot(c, r2);
    
    vec3 n = h4*vec3(va, vb, vc);
    
    vec2 gr = a*h2.x*h.x*va;
    gr += b*h2.y*h.y*vb;
    gr += c*h2.z*h.z*vc;
    gr *= -8.0;
    gr += h4.x*r0 + h4.y*r1 + h4.z*r2;
    gr *= 35.0;

    return vec3(dot(n, vec3(70.0)), gr);
	
}

float estep( float x, float k, float n )
{
    return exp( -k*pow(abs(x),n) );
}

float map( in vec2 p)
{
    float a = 0.0;
    float z = 1.;
	vec2  d = vec2(0.0);
    for( int i=0; i<10; i++ )
    {
        vec3 n = simplex2D(p*0.5);
        d += pow(abs(n.yz),vec2(1.))*10.*sign(n.yz);
        d *= .7;
        
        a += z * (sin(n.x/(dot(d,d)+5.)*8.)*1.+0.6);     
		z *= -.75;
        p = m2*p*1.36;
        
    }   
    a = 1.-estep(a,2.5,1.)*1.;
    
    return a;
}

float map2( in vec2 p)
{
    float a = 0.0;
    float z = 1.;
	vec2  d = vec2(0.0);
    for( int i=0; i<9; i++ )
    {
        vec3 n = simplex2D(p*0.75);
        d += abs(n.yz)*7.*sign(n.yz);
        d *= .65;
        a += z * (sin(n.x/(dot(d,d)+2.)*7.)*.4+.8);
		z *= -.85;
        p = m2*p*1.4;
        
    }
    
    return a;
}

vec3 normal(in vec2 p)
{
    const vec2 e = vec2(0.0065,0.);
    return normalize( vec3( map(p+e.xy) - map(p-e.xy), 0.05, map( p+e.yx)-map(p-e.yx) ) );
}

vec3 tex(in vec2 p)
{
    p *= 2.5;
    vec3 col = vec3(0);
    float rz = map(p);
    rz = 3.-rz;
    vec2 dd = vec2(0.7,-.75);
    float dif = clamp(dot( normal(p),(vec3(dd.x,0.1,dd.y)) )*0.5+0.5,0.0,1.0);
    
    rz= pow(abs(rz),.72);
    col = 1.45-(sin(vec3(.24*rz*rz+0.4 ,0.75*rz, 1.55)+rz*1.1+3.8))*0.9;
    col *= dif*map2(p*1.)*1.8;
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy-0.5;
	p.x *= iResolution.x/iResolution.y;
	p *= 1.6;
	
    
    float isOff = mod(fragCoord.x + fragCoord.y, 2.);
    
    vec3 col = vec3(0);
    
    if (isOff > 0.5)
		col = tex(p+time*0.1 + 10.);
    
	fragColor = vec4(col,1.0);
}
`;

const buffB = `
//2x2 Checkerboard bicubic reconstruction with gradient evaluation
//by nimitz 2018 (twitter: @stormoid)
//License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License

//Fully procedural texture, for testing


//#define SAME_FRAG_COUNT

#define time iTime

mat2 m2 = mat2( 0.80,  0.60, -0.60,  0.80 );

vec2 hash( vec2 p )
{
	p = vec2( dot(p,vec2(127.1,311.7)),
			  dot(p,vec2(269.5,183.3)) );

	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

vec3 simplex2D( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2 i = floor(p + (p.x + p.y)*K1);
	
    vec2 a = p - i + (i.x + i.y)*K2;
    vec2 o = mix(vec2(1.0, 0.0), vec2(0.0,1.0), step(a.x,a.y));
    vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;
    
    vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0 );

    vec3 h2 = h*h;
    vec3 h4 = h2*h2;
    
    vec2 r0 = hash(i + 0.0);
    vec2 r1 = hash(i + o);
    vec2 r2 = hash(i + 1.0);
    
    float va = dot(a, r0);
    float vb = dot(b, r1);
    float vc = dot(c, r2);
    
    vec3 n = h4*vec3(va, vb, vc);
    
    vec2 gr = a*h2.x*h.x*va;
    gr += b*h2.y*h.y*vb;
    gr += c*h2.z*h.z*vc;
    gr *= -8.0;
    gr += h4.x*r0 + h4.y*r1 + h4.z*r2;
    gr *= 35.0;

    return vec3(dot(n, vec3(70.0)), gr);
	
}

float estep( float x, float k, float n )
{
    return exp( -k*pow(abs(x),n) );
}

float map( in vec2 p)
{
    float a = 0.0;
    float z = 1.;
	vec2  d = vec2(0.0);
    for( int i=0; i<10; i++ )
    {
        vec3 n = simplex2D(p*0.5);
        d += pow(abs(n.yz),vec2(1.))*10.*sign(n.yz);
        d *= .7;
        
        a += z * (sin(n.x/(dot(d,d)+5.)*8.)*1.+0.6);     
		z *= -.75;
        p = m2*p*1.36;
        
    }   
    a = 1.-estep(a,2.5,1.)*1.;
    
    return a;
}

float map2( in vec2 p)
{
    float a = 0.0;
    float z = 1.;
	vec2  d = vec2(0.0);
    for( int i=0; i<9; i++ )
    {
        vec3 n = simplex2D(p*0.75);
        d += abs(n.yz)*7.*sign(n.yz);
        d *= .65;
        a += z * (sin(n.x/(dot(d,d)+2.)*7.)*.4+.8);
		z *= -.85;
        p = m2*p*1.4;
        
    }
    
    return a;
}

vec3 normal(in vec2 p)
{
    const vec2 e = vec2(0.0065,0.);
    return normalize( vec3( map(p+e.xy) - map(p-e.xy), 0.05, map( p+e.yx)-map(p-e.yx) ) );
}

vec3 tex(in vec2 p)
{
    p *= 2.5;
    vec3 col = vec3(0);
    float rz = map(p);
    rz = 3.-rz;
    vec2 dd = vec2(0.7,-.75);
    float dif = clamp(dot( normal(p),(vec3(dd.x,0.1,dd.y)) )*0.5+0.5,0.0,1.0);
    
    rz= pow(abs(rz),.72);
    col = 1.45-(sin(vec3(.24*rz*rz+0.4 ,0.75*rz, 1.55)+rz*1.1+3.8))*0.9;
    col *= dif*map2(p*1.)*1.8;
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 p = fragCoord.xy / iResolution.xy;
    
    #ifdef SAME_FRAG_COUNT
    p *= 1.6/0.7071;
    p -= 0.5*1.6;
    p.x *= iResolution.x/iResolution.y;
    #else
    p *= 1.6/0.82;
    p -= 0.5*1.6;
    p.x *= iResolution.x/iResolution.y;
    #endif
    
   
    float isOff = mod(fragCoord.x + fragCoord.y, 2.);
    
    vec3 col = vec3(0);
	col = tex(p+time*0.1 + 10.);
    
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'llXfzf';
  }
  name(): string {
    return 'Checkerboard reconstruction';
  }
  sort() {
    return 334;
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
  channels() {
    return [
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffB, fi: 1 }, //
    ];
  }
}
