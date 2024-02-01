import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Created by SHAU - 2017
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

#define T iTime * 2.0
#define PI 3.14159265359
#define FAR 140.0 
#define EPS 0.003
#define PLATFORM 1.0
#define WALL 2.0
#define BOLLARD_LIGHT 3.0
#define RAIL_LIGHT 4.0
#define PANEL 5.0

vec3 lp = vec3(4.0, 5.0, -2.0);
vec3 glowc = vec3(0.0, 0.0, 0.0);
vec3 ball = vec3(0.0, 0.0, 0.0);

float rand(vec2 p) {return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453);}
mat2 rot(float x) {return mat2(cos(x), sin(x), -sin(x), cos(x));}

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

//IQ SDF 
//IQ - Sphere functions
//http://www.iquilezles.org/www/articles/spherefunctions/spherefunctions.htm
float sphIntersect(vec3 ro, vec3 rd, vec4 sph) {
    vec3 oc = ro - sph.xyz;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - sph.w * sph.w;
    float h = b * b - c;
    if (h < 0.0) return -1.0;
    h = sqrt(h);
    return -b - h;
}

float sphDensity(vec3 ro, vec3 rd, vec4 sph, float dbuffer) {
    float ndbuffer = dbuffer / sph.w;
    vec3  rc = (ro - sph.xyz) / sph.w;
	
    float b = dot(rd, rc);
    float c = dot(rc, rc) - 1.0;
    float h = b*b - c;
    if (h < 0.0) return 0.0;
    h = sqrt(h);
    float t1 = -b - h;
    float t2 = -b + h;

    if (t2 < 0.0 || t1 > ndbuffer) return 0.0;
    t1 = max(t1, 0.0);
    t2 = min(t2, ndbuffer);

    float i1 = -(c * t1 + b * t1 * t1 + t1 * t1 * t1 / 3.0);
    float i2 = -(c * t2 + b * t2 * t2 + t2 * t2 * t2 / 3.0);
    return (i2 - i1) * (3.0 / 4.0);
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

//mercury
float fCylinder(vec3 p, float r, float height) {
	float d = length(p.xz) - r;
	d = max(d, abs(p.y) - height);
	return d;
}

float boxSection(vec3 rp, float width) {
    rp.z = mod(rp.z, 4.0) - 2.0;
    float ns = sdBox(rp - vec3(0.0, 0.4, 0.0), vec3(width, 0.1, 2.0));
    ns = min(ns, sdBox(rp - vec3(0.0, -0.4, 0.0), vec3(width, 0.1, 2.0)));
    ns = min(ns, sdBox(rp - vec3(0.0, 0.0, 1.9), vec3(width, 0.4, 0.1)));
    rp.yz *= rot(0.2);
    return min(ns, sdBox(rp - vec3(0.0, 0.0, 0.0), vec3(width, 0.1, 2.0)));
}

//neat trick from Shane
vec2 nearest(vec2 a, vec2 b){ 
    float s = step(a.x, b.x);
    return s * a + (1. - s) * b;
}

vec4 map(vec3 rp) {    
    vec3 q = rp;
    float wall = 14.0 - abs(q.x);
    wall = min(wall, 12.0 - abs(q.y));
    wall = max(wall, min(2.0 - q.y, -(1.5 - q.y)));
    wall = max(wall, min(-1.5 - q.y, -(-2.0 - q.y)));    
    float raillight = length(abs(q.xy) - vec2(15.0, 1.75)) - 0.2;
    float panel = 10.0 - abs(q.x);
    panel = max(panel, abs(q.y) - 0.8);
    
    float bd = mod(q.z, 160.0) - 80.0 > 0.0 ? 1.0 : -1.0;
    q.z = mod(q.z, 80.0) - 40.0;
    q.xz *= rot(0.2 * bd);
    float platform = boxSection(q.zyx - vec3(0.0, 3.0, 0.0), 1.0);
    platform = min(platform, boxSection(q.zyx - vec3(30.0, -3.0, 0.0), 1.0));
    q = rp;
    bd = mod(q.z, 200.0) - 100.0 > 0.0 ? 1.0 : -1.0;
    q.z = mod(q.z, 100.0) - 50.0;
    q.xz *= rot(0.2 * bd);
    platform = min(platform, boxSection(q.zyx - vec3(0.0, 8.0, 0.0), 1.0));
    platform = min(platform, boxSection(q.zyx - vec3(20.0, -8.0, 0.0), 1.0));
    q = rp;
    q.xy = abs(q.xy);
    platform = min(platform, boxSection(q - vec3(6.0, 3.0, 0.0), 2.0));
    platform = min(platform, boxSection(q - vec3(10.5, 3.0, 0.0), 2.0));
    q = rp;
    q.z = mod(q.z, 20.0) - 10.0;
    q.x = abs(q.x);
    float bollard = fCylinder(q - vec3(6.0, -2.0, 0.0), 0.5, 0.4); 
    //bollard = min(bollard, fCylinder(q - vec3(6.0, -1.4, 0.0), 0.5, 0.05)); 
    float bollardlight = fCylinder(q - vec3(6.0, -1.5, 0.0), 0.55, 0.05); 
    
    vec2 near = nearest(vec2(platform, PLATFORM), vec2(wall, WALL));
    near = nearest(near, vec2(raillight, RAIL_LIGHT));
    near = nearest(near, vec2(bollard, PLATFORM));
    near = nearest(near, vec2(bollardlight, BOLLARD_LIGHT));
    near = nearest(near, vec2(panel, PANEL));

    return vec4(near, raillight, bollardlight);
}

struct Scene {
    float t;
    float id;
    float rli; //rail light
    float bollli; //bollard light
    float glli; //glow light     
};

Scene march(vec3 ro, vec3 rd) {
 
    float t = 0.0;
    float id = 0.0;
    float rli = 0.0;
    float bollli = 0.0;
    float glli = 0.0;
    
    for (int i = 0; i < 96; i++) {
        vec3 rp = ro + rd * t;
        vec4 scene = map(rp);
        if (scene.x < EPS || t > FAR) {
            id = scene.y;
            break;
        }
        
        rli += 0.05 / (1.0 + scene.z * scene.z * 50.);
        bollli += 0.1 / (1.0 + scene.w * scene.w * scene.w * 400.);
        vec3 q = rp;
        q.xy = abs(q.xy);
        float blt1 = length(ball - q);
        glli += 0.2 / (1.0 + blt1 * blt1 * 10.) * 16.0; 
        
        t += scene.x;            
    }
    
    return Scene(t, id, rli, bollli, glli);
}

vec3 normal(vec3 rp) {
    vec2 e = vec2(EPS, 0);
    float d1 = map(rp + e.xyy).x, d2 = map(rp - e.xyy).x;
    float d3 = map(rp + e.yxy).x, d4 = map(rp - e.yxy).x;
    float d5 = map(rp + e.yyx).x, d6 = map(rp - e.yyx).x;
    float d = map(rp).x * 2.0;
    return normalize(vec3(d1 - d2, d3 - d4, d5 - d6));
}

vec2 glyphpanel(vec2 uv) {
    uv.y -= 0.5;
    vec2 cuv = uv * 4.0 - 2.0;
    vec2 cmx = mod(cuv, 1.0) - 0.5;
    float lc = length(cmx);
    float glyph = smoothstep(0.4, 0.3, lc); 
    float glyphc = smoothstep(0.3, 0.03, lc); 
    glyph *= step(-6.0, cuv.y);
    glyphc *= step(-6.0, cuv.y);
    glyph *= step(cuv.y, -2.0);
    glyphc *= step(cuv.y, -2.0);
    float r1 = rand(floor(vec2(cuv.x + floor(T * 1.0), cuv.y))) > 0.5 ? 1.0 : 0.0;
    glyph *= step(cuv.y, -1.0) * step(-8.0, cuv.y) * r1;
    glyphc *= step(cuv.y, -1.0) * step(-8.0, cuv.y) * r1;
    float gy = mod(cuv.x + floor(T * 1.0), 15.0);
    glyph *= step(1.0, gy) * step(gy, 7.0) + step(9.0, gy) * step(gy, 14.0);
    glyphc *= step(1.0, gy) * step(gy, 7.0) + step(9.0, gy) * step(gy, 14.0);
    return vec2(glyph, glyphc);
}

//IQ
//http://www.iquilezles.org/www/articles/fog/fog.htm
vec3 applyFog(vec3  rgb,      // original color of the pixel
              float d, // camera to point distance
              vec3  rayDir,   // camera to point vector
              vec3  sunDir,
              float b)  // sun light direction
{
    float fogAmount = 1.0 - exp(-d * b);
    float sunAmount = max(dot(rayDir, sunDir), 0.0);
    vec3  fogColor  = mix(vec3(0.5, 0.3, 0.8), // purple
                          vec3(0.7, 0.7, 1.0), // blue
                          pow(sunAmount, 16.0));
    return mix(rgb, fogColor, fogAmount);
}

float shadow(vec3 ro, vec3 lp) {

    vec3 rd = normalize(lp - ro);
    float shade = 1.0;
    float t = 0.05;    
    float end = length(lp - ro);
    
    for (int i = 0; i < 20; i++) {
        float h = map(ro + rd * t).x;
        shade = min(shade, smoothstep(0.1, 0.5, 2.0 * h / t));
        t += clamp(h, 0.01, 1.);
        if (h < EPS || t > end) break; 
    }

    return min(max(shade, 0.) + 0.08, 1.0);
}

void setupCamera(vec2 uv, inout vec3 ro, inout vec3 rd) {

    vec3 lookAt = vec3(0.0, 0.0, T * 12.0);
    ro = lookAt + vec3(0.0, 0.0, -4.0);
    lp = lookAt + vec3(0.2, 0.3, 0.1);
    glowc = lookAt + vec3(0.0, 0.0, 130.0);
    
    ball = lookAt + vec3(15.0, 1.75, 20.0 + mod(T * 4.0, 200.0) - 100.0);
    float FOV = PI / 3.0;
    vec3 forward = normalize(lookAt - ro);
    vec3 right = normalize(vec3(forward.z, 0.0, -forward.x)); 
    vec3 up = cross(forward, right);

    rd = normalize(forward + FOV * uv.x * right + FOV * uv.y * up);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    
    vec3 pc = vec3(0.0);
    float mint = FAR;
    float sh = 1.0;
        
    vec3 ro, rd;
    vec2 uv = (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    setupCamera(uv, ro, rd);
    
    Scene scene = march(ro, rd);
    if (scene.t > 0.0 && scene.t < FAR) {
        
        mint = scene.t;
        vec3 rp = ro + rd * scene.t;
        vec3 n = normal(rp);
        vec3 cld = normalize(lp - rp); //camera light direction
        float clt = length(lp - rp); //camera light distance
        vec3 gld = normalize(glowc - rp); //glow light direction
        float glt = length(glowc - rp);
        
        if (scene.id == WALL) {
            
        } else if (scene.id == PLATFORM) {
            
            float diff = max(dot(cld, n), 0.05);
            float catten = 1.0 / (1.0 + clt * clt * 0.00005);
            float gspec = pow(max(dot(reflect(-gld, n), -rd), 0.0), 32.0);
            float gatten = 1.0 / (1.0 + glt * glt * 0.00005);
            sh = shadow(ro + rd * (scene.t - EPS), glowc);
            pc = vec3(0.2) * diff * catten;
            pc += vec3(0., 0.7, 1.0) * gspec * abs(n.x) * gatten * 2.0;
            pc *= sh;
            
        } else if (scene.id == RAIL_LIGHT) {
            
            float diff = max(dot(cld, n), 0.2);            
            float spec = pow(max(dot(reflect(-gld, n), -rd), 0.0), 32.0);
            float catten = 1.0 / (1.0 + clt * clt * 0.0005);
            float la = abs(ball.z - rp.z) * 0.3;
            la = 1.0 / (1.0 * la * la * 0.1);
            pc = vec3(0.8, 0.5, 1.0) * clamp(diff * la, 0.0, 2.0);
            pc += vec3(1.0) * spec * catten;

        } else if (scene.id == BOLLARD_LIGHT) {
            
            pc = vec3(0.6, 0.6, 1.1);
    
        } else if (scene.id == PANEL) {
            
            float diff = max(dot(cld, n), 0.05);
            float atten = 1.0 / (1.0 + clt * clt * 0.03);
            vec2 glyph = glyphpanel(rp.zy);
            pc += vec3(0.8, 0.2, 1.0) * glyph.x * 1.0 * atten;            
            pc += vec3(0.2, 0.5, 1.0) * glyph.y * 8.0 * atten;            
        }   
    } else {
        float nd = noise(vec3(20.0 * rd.x + 0.8 * T, 100.0 * rd.y + 0.8 * T, 10.0 * rd.z + 0.8 * T));
        pc = vec3(0.8, 0.5, 1.0) * (1.0 - nd) * .8; //background
        pc += vec3(0.7, 0.7, 1.0) * smoothstep(0.065, 0.06, length(uv)) * 0.8;
    }
    //*/
    
    pc += vec3(0.8, 0.5, 1.0) * scene.rli * 0.6;
    pc += vec3(0.2, 0.7, 1.0) * scene.glli * 0.5;
    pc += vec3(0.0, 0.7, 1.0) * scene.bollli * sh;
    
    float st2 = sphIntersect(ro, rd, vec4(glowc, 130.0));
    if (st2 > 0.0) {
        vec3 rp = ro + rd * st2;
        
        float h = sphDensity(ro, rd, vec4(glowc, 130.0), mint); 
        if (h > 0.0) {
            pc += vec3(0.0, 1.0, 1.0) * h * h * 2.0;    
            pc += vec3(0.4, 1.0, 1.0) * h * h * h * h * 10.0;
        }
    }
    
    pc = applyFog(pc, mint, rd, normalize(vec3(4.0, 5.0, 2.0)), 0.0008);
    
    fragColor = vec4(sqrt(clamp(pc, 0.0, 1.0)), 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XtsfWX';
  }
  name(): string {
    return 'Angle Grinder';
  }
  sort() {
    return 542;
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
