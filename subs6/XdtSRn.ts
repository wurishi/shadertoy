import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define USE_LPV_OCCLUSION 1
#define USE_LPV_BOUNCE 1
#define USE_TRIQUADRATIC_INTERPOLATION 1

#define LIGHT_Z 9.0
const ivec3 lpvsizei = ivec3(32);
const vec3 lpvsize = vec3(lpvsizei);

float packfragcoord2 (vec2 p, vec2 s) {
    return floor(p.y) * s.x + p.x;
}
vec2 unpackfragcoord2 (float p, vec2 s) {
    float x = mod(p, s.x);
    float y = (p - x) / s.x + 0.5;
    return vec2(x,y);
}
ivec2 unpackfragcoord2 (int p, ivec2 s) {
    int x = p % s.x;
    int y = (p - x) / s.x;
    return ivec2(x,y);
}
float packfragcoord3 (vec3 p, vec3 s) {
    return floor(p.z) * s.x * s.y + floor(p.y) * s.x + p.x;
}
int packfragcoord3 (ivec3 p, ivec3 s) {
    return p.z * s.x * s.y + p.y * s.x + p.x;
}
vec3 unpackfragcoord3 (float p, vec3 s) {
    float x = mod(p, s.x);
    float y = mod((p - x) / s.x, s.y);
    float z = (p - x - floor(y) * s.x) / (s.x * s.y);
    return vec3(x,y+0.5,z+0.5);
}



vec2 min2(vec2 a, vec2 b) {
    return (a.x <= b.x)?a:b;
}

vec2 max2(vec2 a, vec2 b) {
    return (a.x > b.x)?a:b;
}

float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}

float sdCylinder( vec3 p, float s )
{
  return length(p.xz)-s;
}

float sdTorus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

vec2 plane( vec3 p) {
    return vec2(p.y+1.0,4.0);
}

vec2 doModel( vec3 p, float iTime ) {
	
    vec2 d = plane(p);
    
    vec2 q = vec2(sdSphere(p - vec3(0.0,0.0,-0.8), 1.0),1.0);
    q = max2(q, vec2(-sdCylinder(p - vec3(0.0,0.0,-0.8), 0.5),2.0));
    d = min2(d, q);
    
    d = min2(d, vec2(sdBox(p - vec3(0.0,0.0,2.2), vec3(2.0,4.0,0.3)),2.0));
    d = min2(d, vec2(sdBox(p - vec3(0.0,0.0,-2.2), vec3(2.0,4.0,0.3)),3.0));
    d = min2(d, vec2(sdBox(p - vec3(-2.2,0.0,0.0), vec3(0.3,4.0,2.0)),1.0));
    
    q = vec2(sdBox(p - vec3(-1.0,0.0,1.0), vec3(0.5,1.0,0.5)),1.0);
    q = max2(q, vec2(-sdBox(p - vec3(-0.5,0.5,0.5), vec3(0.5,0.7,0.5)),3.0));
    
    d = min2(d, q);
    
    d = min2(d, vec2(sdTorus(p.yxz - vec3(-0.5 + sin(iTime*0.25),1.4,0.5), vec2(1.0, 0.3)),1.0));
    
    return d;
}
vec3 calcNormal( in vec3 pos, float iTime )
{
    const float eps = 0.002;             // precision of the normal computation

    const vec3 v1 = vec3( 1.0,-1.0,-1.0);
    const vec3 v2 = vec3(-1.0,-1.0, 1.0);
    const vec3 v3 = vec3(-1.0, 1.0,-1.0);
    const vec3 v4 = vec3( 1.0, 1.0, 1.0);

	return normalize( v1*doModel( pos + v1*eps, iTime ).x + 
					  v2*doModel( pos + v2*eps, iTime ).x + 
					  v3*doModel( pos + v3*eps, iTime ).x + 
					  v4*doModel( pos + v4*eps, iTime ).x );
}
vec4 doMaterial( in vec3 pos, float iTime )
{
    float k = doModel(pos, iTime).y;
    
    vec3 c = vec3(0.0);
    
    c = mix(c, vec3(1.0,1.0,1.0), float(k == 1.0));
    c = mix(c, vec3(1.0,0.2,0.1), float(k == 2.0));
    c = mix(c, vec3(0.1,0.3,1.0), float(k == 3.0));
    c = mix(c, vec3(0.3,0.15,0.1), float(k == 4.0));
    c = mix(c, vec3(0.4,1.0,0.1), float(k == 5.0));
    
    return vec4(c,0.0);
}



vec4 sh_project(vec3 n) {
    return vec4(
        n,
        0.57735026918963);
}

float sh_dot(vec4 a, vec4 b) {
    return max(dot(a,b),0.0);
}

// 3 / (4 * pi)
const float m3div4pi = 0.23873241463784;
float sh_flux(float d) {
	return d * m3div4pi;
}

#ifndef M_DIVPI
#define M_DIVPI 0.3183098861837907
#endif

float sh_shade(vec4 vL, vec4 vN) {
    return sh_flux(sh_dot(vL, vN)) * M_DIVPI;
}

#define SHSharpness 1.0 // 2.0
vec4 sh_irradiance_probe(vec4 v) {
    const float sh_c0 = (2.0 - SHSharpness) * 1.0;
    const float sh_c1 = SHSharpness * 2.0 / 3.0;
    return vec4(v.xyz * sh_c1, v.w * sh_c0);
}

float shade_probe(vec4 sh, vec4 shn) {
    return sh_shade(sh_irradiance_probe(sh), shn);
}

///////////////////////////////////////////////

// ACES fitted
// from https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl

const mat3 ACESInputMat = mat3(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutputMat = mat3(
     1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
);

vec3 RRTAndODTFit(vec3 v)
{
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

vec3 ACESFitted(vec3 color)
{
    color = color * ACESInputMat;

    // Apply RRT and ODT
    color = RRTAndODTFit(color);

    color = color * ACESOutputMat;

    // Clamp to [0, 1]
    color = clamp(color, 0.0, 1.0);

    return color;
}

//---------------------------------------------------------------------------------

float linear_srgb(float x) {
    return mix(1.055*pow(x, 1./2.4) - 0.055, 12.92*x, step(x,0.0031308));
}
vec3 linear_srgb(vec3 x) {
    return mix(1.055*pow(x, vec3(1./2.4)) - 0.055, 12.92*x, step(x,vec3(0.0031308)));
}

float srgb_linear(float x) {
    return mix(pow((x + 0.055)/1.055,2.4), x / 12.92, step(x,0.04045));
}
vec3 srgb_linear(vec3 x) {
    return mix(pow((x + 0.055)/1.055,vec3(2.4)), x / 12.92, step(x,vec3(0.04045)));
}


`;

const buffA = `
// geometry volume (stores occlusion coefficients)

///////////////////


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float posidx = packfragcoord2(fragCoord.xy, iResolution.xy);
    if (posidx < (lpvsize.x * lpvsize.y * lpvsize.z)) {
	    vec3 pos = unpackfragcoord3(posidx,lpvsize);
        float offset = -0.5;
        vec3 tpos = (pos + offset) / lpvsize;
        vec3 wpos = (tpos * 2.0 - 1.0) * 2.5 + vec3(0.0,1.0,0.0);
        float r = 1.0 * 1.7320508075689 / lpvsize.x;
		float d = doModel(wpos, iTime).x;
        
        if (d > r) {
	        fragColor = vec4(0.0);
        } else {
            float opacity = 1.0 - max(d, 0.0) / r;
            fragColor = sh_project(calcNormal(wpos, iTime)) * opacity;
            fragColor.a = 1.;
        }
    } else {
        fragColor = vec4(0.0,0.0,0.0,0.0);
    }
}`;

const buffB = `
// albedo volume for bounces

///////////////////


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float posidx = packfragcoord2(fragCoord.xy, iResolution.xy);
    if (posidx < (lpvsize.x * lpvsize.y * lpvsize.z)) {
	    vec3 pos = unpackfragcoord3(posidx,lpvsize);
        float offset = -0.5;
        vec3 tpos = (pos + offset) / lpvsize;
        vec3 wpos = (tpos * 2.0 - 1.0) * 2.5 + vec3(0.0,1.0,0.0);
        fragColor = doMaterial(wpos, iTime);
        fragColor.a = 1.;
    } else {
        fragColor = vec4(0.0,0.0,0.0,0.0);
    }
}`;

const buffC = `
// iterative light propagation, one step per frame

///////////////////

vec4 fetch_gv(vec3 p) {
    if ((min(p.x,min(p.y,p.z)) < 0.5) || (max(p.x,max(p.y,p.z)) > (lpvsize.x - 0.5)))
        return vec4(0.0);
    float posidx = packfragcoord3(p, lpvsize);
    vec2 uv = unpackfragcoord2(posidx, iChannelResolution[0].xy) / iChannelResolution[0].xy;
    return texture(iChannel0, uv);
}

float numvoxels;
float channel;
vec3 cmix;

float fetch_av(vec3 p) {
    if ((min(p.x,min(p.y,p.z)) < 0.5) || (max(p.x,max(p.y,p.z)) > (lpvsize.x - 0.5)))
        return 0.0;
    float posidx = packfragcoord3(p, lpvsize);
    vec2 uv = unpackfragcoord2(posidx, iChannelResolution[1].xy) / iChannelResolution[1].xy;
    return dot(texture(iChannel1, uv).rgb, cmix);
}

vec4 fetch_lpv(vec3 p) {
    if ((min(p.x,min(p.y,p.z)) < 0.5) || (max(p.x,max(p.y,p.z)) > (lpvsize.x - 0.5)))
        return vec4(0.0);
    float posidx = packfragcoord3(p, lpvsize) + channel * numvoxels;
    vec2 uv = unpackfragcoord2(posidx, iChannelResolution[2].xy) / iChannelResolution[2].xy;
    return texture(iChannel2, uv);
}

//#if USE_LPV_OCCLUSION || USE_LPV_BOUNCE
vec4 gv4[6];
vec4 gv[8];
//#if USE_LPV_BOUNCE
float bc4[6];
float bc[8];
//#endif // USE_LPV_BOUNCE
//#endif // USE_LPV_OCCLUSION || USE_LPV_BOUNCE

//angle = (4.0*atan(sqrt(11.0)/33.0));
const float solid_angle_front = 0.4006696846462392 * m3div4pi;
//angle = (-M_PI/3.0+2.0*atan(sqrt(11.0)*3.0/11.0));
const float solid_angle_side = 0.4234313544367392 * m3div4pi;

// 6 * (solid_angle_side * 4 + solid_angle_front) = 4 * PI

vec4 accum_face(vec4 shcoeffs, int i, int j, int dim, int face_dim, 
                vec3 p, vec3 offset, vec3 face_offset,
                vec4 gvcoeffs, vec4 gvrefcoeffs, float gvrefcolor) {
    if (i == j) return vec4(0.0);

    vec3 dirw = normalize(face_offset - offset);
    
    float solid_angle = (dim == face_dim)?solid_angle_front:solid_angle_side;
    
    vec4 outdirsh = sh_project(dirw);
    vec4 indirsh = outdirsh;
    vec4 invindirsh = sh_project(-dirw);
    
	// how much flux has been received
    float influx = sh_dot(shcoeffs, indirsh) * solid_angle;
   
    // how much flux will be occluded
    #if USE_LPV_OCCLUSION
    float occluded = sh_dot(gvcoeffs, indirsh);
    #else
    float occluded = 0.0;
    #endif
    
    // how much flux will be passed on
    float outflux = influx * (1.0 - occluded);
    
    vec4 result = outdirsh * outflux; 
    
    // how much flux will be reflected
    #if USE_LPV_BOUNCE
    vec4 rvec = gvrefcoeffs;
    float reflected = outflux * sh_dot(rvec, invindirsh);
    if (reflected > 0.0) {
        result += rvec * (reflected * gvrefcolor);
    }
    #endif    
    
    return result;
}
    
vec4 sample_neighbors( int i, int dim, vec3 p, vec3 offset, vec4 gvcoeffs) {
    vec4 shcoeffs = fetch_lpv(p + offset);
	vec4 shsumcoeffs = vec4(0.0);
    
    vec3 e = vec3(-0.5,0.5,0.0);
    shsumcoeffs += accum_face(shcoeffs, i, 0, dim, 2, p, offset, e.zzx, gvcoeffs, gv4[0], bc4[0]);
    shsumcoeffs += accum_face(shcoeffs, i, 1, dim, 2, p, offset, e.zzy, gvcoeffs, gv4[1], bc4[1]);
    shsumcoeffs += accum_face(shcoeffs, i, 2, dim, 1, p, offset, e.zxz, gvcoeffs, gv4[2], bc4[2]);
    shsumcoeffs += accum_face(shcoeffs, i, 3, dim, 1, p, offset, e.zyz, gvcoeffs, gv4[3], bc4[3]);
    shsumcoeffs += accum_face(shcoeffs, i, 4, dim, 0, p, offset, e.xzz, gvcoeffs, gv4[4], bc4[4]);
    shsumcoeffs += accum_face(shcoeffs, i, 5, dim, 0, p, offset, e.yzz, gvcoeffs, gv4[5], bc4[5]);
    return shsumcoeffs;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float posidx = packfragcoord2(fragCoord.xy, iResolution.xy);
    numvoxels = lpvsize.x * lpvsize.y * lpvsize.z;
    channel = floor(posidx / numvoxels);
    posidx -= channel * numvoxels;
    cmix = vec3(
        float(channel == 0.0),
        float(channel == 1.0),
        float(channel == 2.0));
    if ((iFrame != 0) && (posidx < numvoxels)) {
	    vec3 pos = unpackfragcoord3(posidx,lpvsize);
        vec3 tpos = pos / lpvsize;
        // 28.0
        if ((floor(pos.y) == (lpvsize.y - LIGHT_Z)) && ((length(tpos.xz - 0.5) - 0.3) < 0.0)) {
		   	float lightcolor = dot(cmix,vec3(1.0,1.0,1.0));
        	fragColor = sh_project(vec3(0.0,-1.0,0.0)) * 50.0 * lightcolor;
        } else {
            vec4 shsumcoeffs = vec4(0.0);
            vec3 e = vec3(-1.0,1.0,0.0);
            
            #if USE_LPV_OCCLUSION || USE_LPV_BOUNCE
            vec2 w = vec2(0.0,1.0);
            gv[0] = fetch_gv(pos + w.xxx);
            gv[1] = fetch_gv(pos + w.xxy);
            gv[2] = fetch_gv(pos + w.xyx);
            gv[3] = fetch_gv(pos + w.xyy);
            gv[4] = fetch_gv(pos + w.yxx);
            gv[5] = fetch_gv(pos + w.yxy);
            gv[6] = fetch_gv(pos + w.yyx);
            gv[7] = fetch_gv(pos + w.yyy);

            #if USE_LPV_BOUNCE
            bc[0] = fetch_av(pos + w.xxx);
            bc[1] = fetch_av(pos + w.xxy);
            bc[2] = fetch_av(pos + w.xyx);
            bc[3] = fetch_av(pos + w.xyy);
            bc[4] = fetch_av(pos + w.yxx);
            bc[5] = fetch_av(pos + w.yxy);
            bc[6] = fetch_av(pos + w.yyx);
            bc[7] = fetch_av(pos + w.yyy);
            #endif    

            gv4[0] = (gv[0]+gv[1]+gv[2]+gv[3])*0.25;
            gv4[1] = (gv[4]+gv[5]+gv[6]+gv[7])*0.25;
            gv4[2] = (gv[0]+gv[4]+gv[1]+gv[5])*0.25;
            gv4[3] = (gv[2]+gv[6]+gv[3]+gv[7])*0.25;
            gv4[4] = (gv[0]+gv[2]+gv[4]+gv[6])*0.25;
            gv4[5] = (gv[1]+gv[3]+gv[5]+gv[7])*0.25;

            #if USE_LPV_BOUNCE
            bc4[0] = (bc[0]+bc[1]+bc[2]+bc[3])*0.25;
            bc4[1] = (bc[4]+bc[5]+bc[6]+bc[7])*0.25;
            bc4[2] = (bc[0]+bc[4]+bc[1]+bc[5])*0.25;
            bc4[3] = (bc[2]+bc[6]+bc[3]+bc[7])*0.25;
            bc4[4] = (bc[0]+bc[2]+bc[4]+bc[6])*0.25;
            bc4[5] = (bc[1]+bc[3]+bc[5]+bc[7])*0.25;
            #endif

            #endif // USE_LPV_OCCLUSION || USE_LPV_BOUNCE 
            
            
            shsumcoeffs += sample_neighbors(0, 2, pos, e.zzx, gv4[0]);
            shsumcoeffs += sample_neighbors(1, 2, pos, e.zzy, gv4[1]);
            shsumcoeffs += sample_neighbors(2, 1, pos, e.zxz, gv4[2]);
            shsumcoeffs += sample_neighbors(3, 1, pos, e.zyz, gv4[3]);
            shsumcoeffs += sample_neighbors(4, 0, pos, e.xzz, gv4[4]);
            shsumcoeffs += sample_neighbors(5, 0, pos, e.yzz, gv4[5]);
        
            fragColor = shsumcoeffs;
            fragColor.a = 1.;
        }
    } else {
        fragColor = vec4(0.0,0.0,0.0,0.0);
    }
}`;

const fragment = `
/*

after
Light Propagation Volumes in CryEngine 3, Anton Kaplanyan
http://advances.realtimerendering.com/s2009/Light_Propagation_Volumes.pdf

also helpful for reference:
Light Propagation Volumes - Annotations, Andreas Kirsch (2010)
http://blog.blackhc.net/wp-content/uploads/2010/07/lpv-annotations.pdf

*/

vec4 sample_lpv(vec3 p, float channel) {
    p = clamp(p * lpvsize, vec3(0.5), lpvsize - 0.5);
    float posidx = packfragcoord3(p, lpvsize) + channel * (lpvsize.x * lpvsize.y * lpvsize.z);
    vec2 uv = unpackfragcoord2(posidx, iChannelResolution[0].xy) / iChannelResolution[0].xy;
    return texture(iChannel2, uv);    
}

vec4 fetch_lpv(ivec3 p, int channel) {
    p = clamp(p, ivec3(0), lpvsizei - 1);
    int posidx = packfragcoord3(p, lpvsizei) + channel * (lpvsizei.x * lpvsizei.y * lpvsizei.z);
    ivec2 uv = unpackfragcoord2(posidx, ivec2(iChannelResolution[0].xy));
    return texelFetch(iChannel2, uv, 0);    
}

vec3 fetch_lpv(ivec3 p, vec4 shn) {
    vec4 shr = fetch_lpv(p, 0);
    vec4 shg = fetch_lpv(p, 1);
    vec4 shb = fetch_lpv(p, 2);
    return vec3(
        shade_probe(shr, shn),
        shade_probe(shg, shn),
        shade_probe(shb, shn));
}

float dot_weight(vec3 a, vec3 b) {
	a = vec3(
        (a.x + a.y)*0.5,
        a.y,
        (a.y + a.z)*0.5);
    return dot(a, b);
}

vec3 interpolate(vec3 a, vec3 b, vec3 c, float x) {
	float rx = 1.0 - x;
    vec3 q = vec3(
        rx*rx, 
        2.0*rx*x,
    	x*x);
    return
        vec3(
            dot_weight(vec3(a.x,b.x,c.x), q),
            dot_weight(vec3(a.y,b.y,c.y), q),
            dot_weight(vec3(a.z,b.z,c.z), q));
}

vec3 sample_lpv_trilin(vec3 pf, vec4 shn) {
#if USE_TRIQUADRATIC_INTERPOLATION
    // use triquadratic interpolation
    pf = pf * lpvsize;
    ivec3 p = ivec3(pf);
    ivec3 e = ivec3(-1, 0, 1);
    vec3 p000 = fetch_lpv(p + e.xxx, shn);
    vec3 p001 = fetch_lpv(p + e.xxy, shn);
    vec3 p002 = fetch_lpv(p + e.xxz, shn);
    vec3 p010 = fetch_lpv(p + e.xyx, shn);
    vec3 p011 = fetch_lpv(p + e.xyy, shn);
    vec3 p012 = fetch_lpv(p + e.xyz, shn);
    vec3 p020 = fetch_lpv(p + e.xzx, shn);
    vec3 p021 = fetch_lpv(p + e.xzy, shn);
    vec3 p022 = fetch_lpv(p + e.xzz, shn);

    vec3 p100 = fetch_lpv(p + e.yxx, shn);
    vec3 p101 = fetch_lpv(p + e.yxy, shn);
    vec3 p102 = fetch_lpv(p + e.yxz, shn);
    vec3 p110 = fetch_lpv(p + e.yyx, shn);
    vec3 p111 = fetch_lpv(p + e.yyy, shn);
    vec3 p112 = fetch_lpv(p + e.yyz, shn);
    vec3 p120 = fetch_lpv(p + e.yzx, shn);
    vec3 p121 = fetch_lpv(p + e.yzy, shn);
    vec3 p122 = fetch_lpv(p + e.yzz, shn);
    
    vec3 p200 = fetch_lpv(p + e.zxx, shn);
    vec3 p201 = fetch_lpv(p + e.zxy, shn);
    vec3 p202 = fetch_lpv(p + e.zxz, shn);
    vec3 p210 = fetch_lpv(p + e.zyx, shn);
    vec3 p211 = fetch_lpv(p + e.zyy, shn);
    vec3 p212 = fetch_lpv(p + e.zyz, shn);
    vec3 p220 = fetch_lpv(p + e.zzx, shn);
    vec3 p221 = fetch_lpv(p + e.zzy, shn);
    vec3 p222 = fetch_lpv(p + e.zzz, shn);

    vec3 w = fract(pf);
    
    vec3 y00 = interpolate(p000, p001, p002, w.z);
    vec3 y01 = interpolate(p010, p011, p012, w.z);
    vec3 y02 = interpolate(p020, p021, p022, w.z);

    vec3 y10 = interpolate(p100, p101, p102, w.z);
    vec3 y11 = interpolate(p110, p111, p112, w.z);
    vec3 y12 = interpolate(p120, p121, p122, w.z);

    vec3 y20 = interpolate(p200, p201, p202, w.z);
    vec3 y21 = interpolate(p210, p211, p212, w.z);
    vec3 y22 = interpolate(p220, p221, p222, w.z);

    vec3 x0 = interpolate(y00, y01, y02, w.y);
    vec3 x1 = interpolate(y10, y11, y12, w.y);
    vec3 x2 = interpolate(y20, y21, y22, w.y);

    return interpolate(x0, x1, x2, w.x);

#else
    pf = pf * lpvsize - 0.5;
    ivec3 p = ivec3(pf);
    ivec2 e = ivec2(0,1);
    vec3 p000 = fetch_lpv(p + e.xxx, shn);
    vec3 p001 = fetch_lpv(p + e.xxy, shn);
    vec3 p010 = fetch_lpv(p + e.xyx, shn);
    vec3 p011 = fetch_lpv(p + e.xyy, shn);
    vec3 p100 = fetch_lpv(p + e.yxx, shn);
    vec3 p101 = fetch_lpv(p + e.yxy, shn);
    vec3 p110 = fetch_lpv(p + e.yyx, shn);
    vec3 p111 = fetch_lpv(p + e.yyy, shn);

    vec3 w = fract(pf);
    

    vec3 q = 1.0 - w;

    vec2 h = vec2(q.x,w.x);
    vec4 k = vec4(h*q.y, h*w.y);
    vec4 s = k * q.z;
    vec4 t = k * w.z;
        
    return
          p000*s.x + p100*s.y + p010*s.z + p110*s.w
        + p001*t.x + p101*t.y + p011*t.z + p111*t.w;
#endif
}

void doCamera( out vec3 camPos, out vec3 camTar, in float time, in float mouseX )
{
    float an = 1.5 + sin(time * 0.37) * 0.4;
	camPos = vec3(4.5*sin(an),2.0,4.5*cos(an));
    camTar = vec3(0.0,0.0,0.0);
}

vec3 doBackground( void )
{
    return vec3( 0.0, 0.0, 0.0);
}

//------------------------------------------------------------------------
// Lighting
//------------------------------------------------------------------------
vec3 doLighting( in vec3 pos, in vec3 nor, in vec3 rd, in float dis, in vec4 mal )
{
    vec3 col = mal.rgb;
    
    vec3 tpos = ((pos - vec3(0.0,1.0,0.0)) / 2.5) * 0.5 + 0.5;
    vec4 shn = sh_project(-nor);
    col *= sample_lpv_trilin(tpos, shn);

    return col;
}

float calcIntersection( in vec3 ro, in vec3 rd )
{
	const float maxd = 20.0;           // max trace distance
	const float precis = 0.001;        // precission of the intersection
    float h = precis*2.0;
    float t = 0.0;
	float res = -1.0;
    for( int i=0; i<90; i++ )          // max number of raymarching iterations is 90
    {
        if( h<precis||t>maxd ) break;
	    h = doModel( ro+rd*t, iTime ).x;
        t += h;
    }

    if( t<maxd ) res = t;
    return res;
}

mat3 calcLookAtMatrix( in vec3 ro, in vec3 ta, in float roll )
{
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(sin(roll),cos(roll),0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    return mat3( uu, vv, ww );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/iResolution.y;
    vec2 m = iMouse.xy/iResolution.xy;

    //-----------------------------------------------------
    // camera
    //-----------------------------------------------------
    
    // camera movement
    vec3 ro, ta;
    doCamera( ro, ta, iTime, m.x );
    //doCamera( ro, ta, 3.0, 0.0 );

    // camera matrix
    mat3 camMat = calcLookAtMatrix( ro, ta, 0.0 );  // 0.0 is the camera roll
    
	// create view ray
	vec3 rd = normalize( camMat * vec3(p.xy,2.0) ); // 2.0 is the lens length

    //-----------------------------------------------------
	// render
    //-----------------------------------------------------

	vec3 col = doBackground();

	// raymarch
    float t = calcIntersection( ro, rd );
    if( t>-0.5 )
    {
        // geometry
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal(pos, iTime);

        // materials
        vec4 mal = doMaterial( pos, iTime );

        col = doLighting( pos, nor, rd, t, mal );
	}

	//-----------------------------------------------------
	// postprocessing
    //-----------------------------------------------------
    // gamma
	col = linear_srgb(ACESFitted(col * 1.5));
	   
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'XdtSRn';
  }
  name(): string {
    return 'Light Propagation Volume';
  }
  // sort() {
  //   return 0;
  // }
  common() {
    return common;
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
      { type: 1, f: buffB, fi: 1 },
      { type: 1, f: buffC, fi: 2 },
    ];
  }
}
