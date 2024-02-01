import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

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
        vec4 newSound = texelFetch(iChannel1, ivec2(x , 0), 0);
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
// Created by SHAU - 2017
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

#define T iTime
#define PI 3.141592
#define FAR 14.0 
#define EPS 0.005

#define CA vec3(0.5, 0.5, 0.5)
#define CB vec3(0.5, 0.5, 0.5)
#define CC vec3(1.0, 1.0, 1.0)
#define CD vec3(0.0, 0.33, 0.67)

#define RING_1 vec4(1.8, 0.4, 2.4, 1.0)
#define RING_2 vec4(2.6, 0.4, 3.2, 2.0)
#define RING_3 vec4(3.4, 0.4, 4.0, 3.0)
#define RING_4 vec4(4.2, 0.4, 4.8, 4.0)
#define RING_5 vec4(5.0, 0.4, 4.8, 5.8)

mat3 rotx(float x) {return mat3(1.0, 0.0, 0.0, 0.0, cos(x), -sin(x), 0.0, sin(x), cos(x));}
mat3 roty(float y) {return mat3(cos(y), 0.0, sin(y), 0.0, 1.0, 0.0, -sin(y), 0.0, cos(y));}
mat3 rotz(float z) {return mat3(cos(z), -sin(z), 0.0, sin(z), cos(z), 0.0, 0.0, 0.0, 1.0);}

mat2 rot(float x) {return mat2(cos(x), sin(x), -sin(x), cos(x));}
float rand(vec2 p) {return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);}
//Nimitz noise
float tri(float x) {return abs(fract(x) - 0.5);}
vec3 tri3(vec3 rp) {return vec3(tri(rp.z + tri(rp.y)), tri(rp.z + tri(rp.x)), tri(rp.y + tri(rp.x)));}
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

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float sdRing(vec3 rp, vec4 ring) {
    vec4 sound = texture(iChannel0, vec2(0.5) / iResolution.xy);
    vec3 q = rp;
    float nz = 1.0;
    float b = 0.3;
    for (int i = 0; i < 4; i++) {
    	q += tri3(q * b) * 0.1;
        b += float(i) * 1.8;
        nz *= tri(b);
    }    
    float ns = sdTorus(q, vec2(ring.x + nz, ring.y - nz * 8.0));
    return max(ns, -sdSphere(rp, ring.z - noise(rp * 4.0 + nz + sound.w * 1.0)));
}


vec2 nearest(vec2 a, vec2 b){ 
    float s = step(a.x, b.x);
    return s * a + (1. - s) * b;
}

vec2 map(vec3 rp) {
    vec4 sound = texture(iChannel0, vec2(1.5) / iResolution.xy);
    rp *= rotx(T * 0.2 + sound.x * 0.2);
    vec2 ring1 = vec2(sdRing(rp, RING_1), RING_1.w);
    rp *= rotz(T * 0.4);
    vec2 ring2 = vec2(sdRing(rp, RING_2), RING_2.w);
    rp *= rotx(T * 0.6 + sound.y * 0.4);
    vec2 ring3 = vec2(sdRing(rp, RING_3), RING_3.w);
    rp *= rotz(T * 0.8);
    vec2 ring4 = vec2(sdRing(rp, RING_4), RING_4.w);
    rp *= rotx(T * 1.0 + sound.z * 0.2);
    vec2 ring5 = vec2(sdRing(rp, RING_5), RING_5.w);
    return nearest(ring1, nearest(ring2, nearest(ring3, nearest(ring4, ring5))));
}

vec3 normal(vec3 rp) {
    vec2 e = vec2(EPS, 0);
    float d1 = map(rp + e.xyy).x, d2 = map(rp - e.xyy).x;
    float d3 = map(rp + e.yxy).x, d4 = map(rp - e.yxy).x;
    float d5 = map(rp + e.yyx).x, d6 = map(rp - e.yyx).x;
    float d = map(rp).x * 2.0;
    return normalize(vec3(d1 - d2, d3 - d4, d5 - d6));
}

vec2 marchScene(vec3 ro, vec3 rd) {
    float t = 0.0, id = 0.0;
    for (int i = 0; i < 200; i++) {
        vec3 rp = ro + rd * t;
        vec2 ns = map(rp);
        if (ns.x < EPS || t > FAR) {
            id = ns.y;            
            break;
        }
        t += ns.x * 0.6;
    }
    return vec2(t, id);
}

vec3 vMarch(vec3 ro, vec3 rd, vec4 ring, mat3 rr, vec3 col, float sound) {
    vec3 pc = vec3(0.0);
    float t = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 rp = ro + rd * t;
        rp *= rr;
        float ns = sdRing(rp, ring);
        if (ns > EPS) break;
        float lt = sdTorus(rp, vec2(ring.x, 0.02));
        pc += 0.06 * sound * mix(col, 
                         vec3(col.x * 1.0, col.y * 0.2, col.z * 0.0), 
                         lt * 4.0) / (1.0 * lt * lt * 64.0);
        t += 0.02;
    }
    return pc;
}

// Based on original by IQ.
// http://www.iquilezles.org/www/articles/raymarchingdf/raymarchingdf.htm
float AO(vec3 rp, vec3 n) {

    float r = 0.0;
    float w = 1.0;
    float d = 0.0;

    for (float i = 1.0; i < 5.0; i += 1.0){
        d = i / 5.0;
        r += w * (d - map(rp + n * d).x);
        w *= 0.5;
    }

    return 1.0 - clamp(r, 0.0, 1.0);
}

float shadow(vec3 ro, vec3 lp) {

    vec3 rd = normalize(lp - ro);
    float shade = 1.0;
    float t = 0.05;    
    float end = length(lp - ro);
    
    for (int i = 0; i < 10; i++) {
        float h = map(ro + rd * t).x;
        shade = min(shade, smoothstep(0.1, 0.5, 2.0 * h / t));
        t += clamp(h, 0.01, 1.);
        if (h < EPS || t > end) break; 
    }

    return min(max(shade, 0.) + 0.08, 1.0);
}

vec3 colourScene(vec3 ro, vec3 rd, vec2 scene) {
    
    vec3 pc = vec3(0.0);
    vec4 sound = texture(iChannel0, vec2(1.5) / iResolution.xy);
    
    vec3 rp = ro + rd * scene.x;
    vec3 n = normal(rp);
    vec3 lp = vec3(4.0, 5.0, -2.0);
    vec3 ld = normalize(lp - rp);
    float lt = length(lp - rp);
	float diff = max(dot(ld, n), 0.05);
    float spec = pow(max(dot(reflect(-ld, n), -rd), 0.0), 32.0);
    float atten = 1.0 / (1.0 + lt * lt * 0.001);
    float sh = shadow(rp, lp);
    float ao = AO(rp, n);
    
    vec4 ring = vec4(0.0);
    mat3 rr = mat3(1.0);
    vec3 glow = vec3(0.0);
    float vol = 0.0;
    
    pc = vec3(0.4) * diff * atten;   

    if (scene.y == RING_1.w) {
		ring = RING_1;
        rr = rotx(T * 0.2 + sound.x * 0.2);
        glow = palette(RING_1.x + T * 0.01, CA, CB, CC, CD);
        vol = sound.y;        
    } else if (scene.y == RING_2.w) {
        ring = RING_2;
        rr = rotx(T * 0.2 + sound.x * 0.2) * rotz(T * 0.4);
        glow = palette(RING_2.x + T * 0.05, CA, CB, CC, CD);
        vol = sound.x;
    } else if (scene.y == RING_3.w) {
		ring = RING_3;
        rr = rotx(T * 0.2 + sound.x * 0.2) * rotz(T * 0.4) * rotx(T * 0.6 + sound.y * 0.4);
        glow = palette(RING_3.x + T * 0.2, CA, CB, CC, CD);
        vol = sound.z;
    } else if (scene.y == RING_4.w) {
		ring = RING_4;
        rr = rotx(T * 0.2 + sound.x * 0.2) * rotz(T * 0.4) * rotx(T * 0.6 + sound.y * 0.4) * rotz(T * 0.8);
        glow = palette(RING_4.x + T * 0.4, CA, CB, CC, CD);
        vol = sound.w;
    } else if (scene.y == RING_5.w) {
		ring = RING_5;
        rr = rotx(T * 0.2 + sound.x * 0.2) * rotz(T * 0.4) * rotx(T * 0.6 + sound.y * 0.4) * rotz(T * 0.8)* rotx(T * 1.0 + sound.z * 0.2);
        glow = palette(RING_5.x + T * 0.15, CA, CB, CC, CD);
        vol = sound.w;
    }

    pc += vMarch(rp, rd, ring, rr, glow, vol);
    pc *= ao * sh;
    pc += vec3(1.0) * spec;
    pc += vec3(0.2, 0.25, 1.0) * max(n.y, 0.0) * 0.1;
    
    return pc;
}

void setupCamera(vec2 fragCoord, inout vec3 ro, inout vec3 rd) {

    vec2 uv = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;

    vec3 lookAt = vec3(0.0, 0.0, 0.0);
    ro = lookAt + vec3(0.0, 0.0, -8.0);
    
    ro.xz *= rot(T * 0.5);
    ro.yz *= rot(T * -0.6);
    
    float FOV = PI / 4.0;
    vec3 forward = normalize(lookAt - ro);
    vec3 right = normalize(vec3(forward.z, 0.0, -forward.x)); 
    vec3 up = cross(forward, right);

    rd = normalize(forward + FOV * uv.x * right + FOV * uv.y * up);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    
    float mint = FAR;
    
    vec3 ro, rd;
    setupCamera(fragCoord, ro, rd);
    
    vec3 pc = vec3(0.15, 0.05, 0.1) * noise(rd * 4.0 + T * 0.2);

    vec2 scene = marchScene(ro, rd);
    if (scene.x > 0.0 && scene.x < FAR) {
        mint = scene.x;
        pc = colourScene(ro, rd, scene);   
        
    }
    
	fragColor = vec4(pc, mint * 0.7 / FAR);
}
`;

const fragment = `
// Created by SHAU - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

#define time iTime

const float GA = 1.39; 
const mat2 rot = mat2(cos(GA), sin(GA), -sin(GA), cos(GA));

//simplified version of Dave Hoskins blur borrowed from Virgilll
vec3 dof(sampler2D tex,vec2 uv,float rad) {
	vec3 acc = vec3(0.0);
    vec2 pixel = vec2(0.001 * iResolution.y / iResolution.x, 0.001), angle = vec2(0.0, rad);
    rad=1.;
	for (int j = 0; j < 80; j++) {  
        rad += 1.0 / rad;
	    angle*=rot;
        vec4 col=texture(tex,uv+pixel*(rad-1.)*angle);
		acc+=col.xyz;
	}
    
	return acc/80.;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	vec2 uv = gl_FragCoord.xy / iResolution.xy;
	fragColor = vec4(dof(iChannel1, uv, texture(iChannel1, uv).w), 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XljBWW';
  }
  name(): string {
    return '43% Burnt';
  }
  sort() {
    return 540;
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
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffB, fi: 1 }, //
    ];
  }
}
