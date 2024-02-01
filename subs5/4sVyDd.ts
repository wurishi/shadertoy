import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// Created by SHAU - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

//#define T iTime

#define MOD3 vec3(443.8975,397.2973, 491.1871)
#define PI 3.14159265359

#define CA vec3(0.5, 0.5, 0.5)
#define CB vec3(0.5, 0.5, 0.5)
#define CC vec3(1.0, 1.0, 1.0)
#define CD vec3(0.0, 0.33, 0.67)

mat2 rot(float x) {return mat2(cos(x), sin(x), -sin(x), cos(x));}

//IQ cosine palattes
//http://www.iquilezles.org/www/articles/palettes/palettes.htm
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {return a + b * cos(6.28318 * (c * t + d));}

//IQs noise
float noise(vec3 rp) {
    vec3 ip = floor(rp);
    rp -= ip; 
    vec3 s = vec3(7, 157, 113);
    vec4 h = vec4(0.0, s.yz, s.y + s.z) + dot(ip, s);
    rp = rp * rp * (3.0 - 2.0 * rp); 
    h = mix(fract(sin(h) * 43758.5), fract(sin(h + s.x) * 43758.5), rp.x);
    h.xy = mix(h.xz, h.yw, rp.y);
    return mix(h.x, h.y, rp.z); 
}

//Dave Hoskins - Noise and Hashing
vec3 hash31(float p) {
   vec3 p3 = fract(vec3(p) * MOD3);
   p3 += dot(p3.xyz, p3.yzx + 19.19);
   return fract(vec3(p3.x * p3.y, p3.x*p3.z, p3.y*p3.z));
}

vec3 noise3(float n) {
    float f = fract(n);
    n = floor(n);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash31(n), hash31(n + 1.0), f);
}

void setupCamera(float T, vec2 uv, vec4 sound, vec2 fragCoord, inout vec3 ro, inout vec3 rd) {

    //vec2 uv = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;

    vec3 lookAt = vec3(0.0);
    ro = vec3(0.0, 1.0 + sin(T), -3.0 - sin(T * 0.5));
    
    //camera shake
    lookAt += (0.08 * noise3(T * 16.0) - 0.5) * sound.x * 0.04;

    ro.xz *= rot(T * 1.);
    
    float FOV = PI / 3.0;
    vec3 forward = normalize(lookAt - ro);
    vec3 right = normalize(vec3(forward.z, 0.0, -forward.x)); 
    vec3 up = cross(forward, right);

    rd = normalize(forward + FOV * uv.x * right + FOV * uv.y * up);
}
`;

const fragment = `
// Created by SHAU - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

#define T iTime

const float GA = 2.399; 
const mat2 rt = mat2(cos(GA), sin(GA), -sin(GA), cos(GA));
vec3 glowColour() {return palette(T * 0.1, CA, CB, CC, CD);}

//simplified version of Dave Hoskins blur borrowed from Virgill
vec3 dof(sampler2D tex,vec2 uv,float rad) {
	vec3 acc = vec3(0.0);
    vec2 pixel = vec2(0.002 * iResolution.y / iResolution.x, 0.002), angle = vec2(0.0, rad);;
    rad=1.;
	for (int j = 0; j < 80; j++) {  
        rad += 1.0 / rad;
	    angle *= rt;
        vec4 col = texture(tex, uv + pixel * (rad - 1.) * angle);
		acc += col.xyz;
	}
    
	return acc / 80.;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    
	vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec2 uv2 = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    vec4 sound = texture(iChannel0, uv);
    
    vec3 ro, rd;
    setupCamera(T, uv2, sound, fragCoord, ro, rd); 
    
    vec3 bc = glowColour() * 4.0 * noise(16. * rd + 0.1 * T) * rd.y * 0.2;;
    
    vec4 scene = texture(iChannel1, uv);
    
    vec3 sc = vec4(dof(iChannel1, uv, scene.w), 1.0).xyz;
    vec3 ec = texture(iChannel2, uv).xyz;
    vec3 pc = mix(sc, sc * (1.0 - ec), min(sound.w, 1.0));
    
    if (scene.w >= 1.0) {
        pc += bc;    
    }
    fragColor = vec4(pc, 1.0);
}
`;

const buffA = `
// Created by SHAU - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    
	vec2 uv = fragCoord.xy / iResolution.xy;

    vec4 currentSound = texture(iChannel0, uv / iResolution.xy);
    
    float level = currentSound.x;
    float bass = currentSound.y;
    float mid = currentSound.z;
    float treble = currentSound.w;
    
    for (int x = 0; x < 512; x++) {
        vec4 newSound = texelFetch(iChannel3, ivec2(x , 0), 0);
        level += newSound.x;
        if (x < 140) bass += newSound.x;
        if (x > 139 && x < 300) mid += newSound.x;
        if (x > 299) treble += newSound.x;
    }
    
    level /= 60.0;
    bass /= 60.0;
    mid /= 20.0;
    treble /= 36.0;
    
    fragColor = vec4(level, bass, mid, treble);    
}
`;

const buffB = `
// Created by SHAU - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

#define T iTime
#define FAR 40.0 
#define EPS 0.005
#define BANDS 1.0
#define CORE 2.0
#define CENTER_BAND 3.0

//IQ distance functions

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float sdTorus(vec3 rp, vec2 torus) {
    vec2 q = vec2(length(rp.xz) - torus.x, rp.y);
    return length(q) - torus.y;
}

//mercury sdf
float fCylinder(vec3 p, float r, float height) {
	float d = length(p.xz) - r;
	d = max(d, abs(p.y) - height);
	return d;
}

//neat trick from Shane 
vec2 nearest(vec2 a, vec2 b){ 
    float s = step(a.x, b.x);
    return s * a + (1. - s) * b;
}
vec3 nearest(vec3 a, vec3 b){ 
    float s = step(a.x, b.x);
    return s * a + (1. - s) * b;
}

float planeIntersection(vec3 ro, vec3 rd, vec3 n, vec3 o) {
    return dot(o - ro, n) / dot(rd, n);
}

float dfGlowTorus(vec3 rp) {
    vec4 sound = texture(iChannel0, vec2(0.5) / iResolution.xy);
    rp -= vec3(0.0, -2.6, 0.0);
    return sdTorus(rp, vec2(0.6 + sound.x * 0.8, 0.02));
}

float dfCore(vec3 rp) {
    return length(rp) - 0.7 + noise((rp * 5.0) + T) * 0.2;
}

float dfBand(vec3 rp, float radius) {
    return max(fCylinder(rp, radius, 0.02), -fCylinder(rp, radius - 0.1, 0.1));
}

float dfCutBand(vec3 rp, float i, float sgn) {
    float y = 0.1 + i * 0.1; // y axis step size
    float t = mod(T, 20.0);
    
    float angle = step(5.0, t) * min((t - 5.0) * y, 1.99 * PI * y);
    angle -= step(14.0, t) * clamp((t - 14.0) * y, 0.0, 1.99 * PI * y);
    
    float radius = sqrt(1.0 - y * y); // band outer radius    
    rp -= vec3(0.0, y, 0.0); // position of band on y axis
    float band = dfBand(rp, radius); 
    // cut for band A
    vec3 q = rp;
    float cutA = sdBox(rp - vec3(-0.99 * sgn, 0.0, 0.0), vec3(1.0, 1.0, 2.0));    
    q.xz *= rot(clamp(angle, 0.0, PI));
    cutA = min(cutA, sdBox(q - vec3(-1.0 * sgn, 0.0, 0.0), vec3(1.0, 1.0, 2.0)));
    // cut for band B
    q = rp;
    float cutB = sdBox(rp - vec3(1.0 * sgn, 0.0, 0.0), vec3(1.0, 1.0, 2.0));
    q.xz *= rot((angle - PI) * step(PI, angle));
    cutB = min(cutB, sdBox(q - vec3(1.0 * sgn, 0.0, 0.0), vec3(1.0, 1.0, 2.0)));
    return min(max(band, -cutA), max(band, -cutB));
}

vec3 dfBands(vec3 rp) {
    rp.yz *= rot(T * 0.5);
    rp.xz *= rot(T * 0.3);
    vec3 q = rp;
    q.xz *= rot(T * 4.);
    float a = atan(q.x, q.z) / 6.2831853;
    a = step(0.5, fract(a * 8.0));
    
    float bands = FAR;
    float sgn = sign(rp.y);   
    float centerBand = dfBand(rp, 1.0);
    rp.y = abs(rp.y);
    for (float i = 0.0; i < 9.0; i++) {
        bands = min(bands, dfCutBand(rp, i, sgn));
    }
    return nearest(vec3(centerBand, CENTER_BAND, a), vec3(bands, BANDS, a));
}

vec3 map(vec3 rp) {
    vec2 core = vec2(dfCore(rp), CORE);
    vec3 bands = dfBands(rp);
    return nearest(vec3(core, bands.z), bands);
}

// Tetrahedral normal IQ
vec3 tnormal(vec3 p) {  
    vec2 e = vec2(-1., 1.) * EPS;   
	return normalize(e.yxx * map(p + e.yxx).x + e.xxy * map(p + e.xxy).x + 
					 e.xyx * map(p + e.xyx).x + e.yyy * map(p + e.yyy).x);   
}

vec3 bump(vec3 rp, vec3 n) {
    vec2 e = vec2(EPS, 0.0);
    float nz = noise(rp);
    vec3 d = vec3(noise(rp + e.xyy) - nz, noise(rp + e.yxy) - nz, noise(rp + e.yyx) - nz) / e.x;
    n = normalize(n - d * 0.2 / sqrt(0.1));
    return n;
}

struct Scene {
    float t;
    float id;
    float liA;
    float liB;
    float a;
};

Scene marchScene(vec3 ro, vec3 rd) {
 
    float t = 0.0;
    float id = 0.0;
    float liA = 0.0;
    float liB = 0.0;
    float a = 0.0;
    
    for (int i = 0; i < 200; i++) {
        vec3 rp = ro + rd * t;
        vec3 ns = map(rp);
        if (ns.x < EPS || t > FAR) {
            id = ns.y;   
            a = ns.z;
            break;
        }
        
        float lt = dfBands(rp).x;
		liA += 0.02 / (1.0 + lt * lt * 128.0);
	    lt = dfCore(rp);
		liB += 0.05 / (1.0 + lt * lt * 32.0);
        
        t += ns.x * 0.6;
    }
    
    return Scene(t, id, liA, liB, a);
}

vec3 vMarch(vec3 ro, vec3 rd, vec3 gc) {
    vec3 pc = vec3(0.0);
    float t = 0.1;
    for (int i = 0; i < 48; i++) {
        vec3 rp = ro + rd * t;
        float ns = dfCore(rp);
        if (ns > 0.0 || t > 2.0) break;
        float lt = length(rp) - 0.1;
        pc += 0.05 * mix(gc, vec3(gc.r, gc.g * 0.3, gc.b * 0.1), lt * 4.0) / (1.0 * lt * lt * 32.0);
        t += 0.05;
        
    }
    return pc;
}

vec3 vMarch2(vec3 ro, vec3 rd, vec3 gc) {
    vec3 pc = vec3(0.0);
    float t = 0.1;
    for (int i = 0; i < 48; i++) {
        vec3 rp = ro + rd * t;
        float ns = dfGlowTorus(rp);
        if (t > 2.0) break;
        pc += 0.03 * mix(gc, vec3(gc.r, gc.g * 0.3, gc.b * 0.1), ns * 4.0) / (1.0 * ns * ns * 16.0); 
        t += 0.02;
        
    }
    return pc;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    
    vec3 lp = vec3(4.0, 5.0, -2.0);
    float mint = FAR;
    vec4 sound = texture(iChannel0, vec2(0.5) / iResolution.xy);
    vec2 uv = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    
    vec3 ro, rd;
    setupCamera(T, uv, sound, fragCoord, ro, rd);    

    vec3 gcA = palette(sound.x * 1.4, CA, CB, CC, CD);;
    vec3 gcB = palette(sound.y * 1.4, CA, CB, CC, CD);
    vec3 gcC = palette(T * 0.05 + sound.z * 0.5, CA, CB, CC, CD);
    
    vec3 pc = vec3(0.0); 

    vec3 fn = vec3(0.0, 1.0, 0.0);
    float ft = planeIntersection(ro, rd, fn, vec3(0.0, -2.0, 0.0));
    if (ft > 0.0 && ft < mint) {
        
        mint = ft;
        vec3 rp = ro + rd * ft;
        vec3 n = tnormal(rp);
        vec3 ld = normalize(lp - rp);   
        float lt = length(lp - rp);
            
        fn = bump(rp * 12.0, fn);
        float spec = pow(max(dot(reflect(-ld, fn), -rd), 0.0), 16.0);
		float atten = 1.0 / (1.0 + lt * lt * 0.001);
    
        pc = vMarch2(rp, refract(rd, fn, 0.4), gcA) * sound.x;
        pc *= atten;
        pc += vec3(1.0) * 1.0 * spec; 
    }
    
    Scene scene = marchScene(ro, rd);
    if (scene.t > 0.0 && scene.t < mint) {
    
        mint = scene.t;
        
        vec3 rp = ro + rd * scene.t;
        vec3 n = tnormal(rp);
        vec3 ld = normalize(lp - rp);   
        float lt = length(lp - rp);
    
        float diff = max(dot(ld, n), 0.1);
        float spec = pow(max(dot(reflect(-ld, n), -rd), 0.0), 16.0);

        pc = vec3(0.0);
        if (scene.id == CORE) {
            pc = vec3(gcB.r * 0.2, gcB.g * 0.02, 0.0) * diff;
            pc += vMarch(rp, refract(rd, n, 0.9), gcB);            
        } else if (scene.id == CENTER_BAND) {
            pc = vec3(1.0) * gcB * scene.a;
        } 
         
        pc += vec3(1.) * 1.0 * spec;
    }
    
    pc += gcC * min(scene.liA, 1.0) * sound.z;
    pc += gcB * min(scene.liB, 1.0) * sound.y;
    
	fragColor = vec4(pc, mint / FAR);
}`;

const buffC = `
// Created by SHAU - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

//Edge detection verbatim from 834144373

/*----------------------
	Edge Detection
----------------------*/

#define _DepthDiffCoeff 5.
#define _NormalDiffCoeff 1.
#define _CameraDepthNormalsTexture iChannel1
#define R iResolution.xy

float CheckDiff(vec4 _centerNormalDepth,vec4 _otherNormalDepth) {
    float depth_diff = abs(_centerNormalDepth.w - _otherNormalDepth.w);
    vec3 normal_diff = abs(_centerNormalDepth.xyz - _otherNormalDepth.xyz);
    return 
        (float(depth_diff > _DepthDiffCoeff))
        +
        float(dot(normal_diff,normal_diff))*_NormalDiffCoeff;
}
float FastEdge(vec2 uv) {
    vec3 e = vec3(1.0 / R, 0.0);
    vec4 Center_P = texture(_CameraDepthNormalsTexture,uv);
    vec4 LD = texture(_CameraDepthNormalsTexture, uv + e.xy);
    vec4 RD = texture(_CameraDepthNormalsTexture, uv + vec2(e.x,-e.y));

    float Edge = 0.;
    Edge += CheckDiff(Center_P,LD);
    Edge += CheckDiff(Center_P,RD);
    return float(smoothstep(1., 0., Edge));
}

void mainImage(out vec4 C, in vec2 U) {
	C = vec4(FastEdge(U / R));
  C.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return '4sVyDd';
  }
  name(): string {
    return 'OTT';
  }
  sort() {
    return 539;
  }
  tags?(): string[] {
    return [];
  }
  common() {
    return common;
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
      { type: 1, f: buffA, fi: 0 },
      { type: 1, f: buffB, fi: 1 },
      { type: 1, f: buffC, fi: 2 },
      { type: 3 },
    ];
  }
}
