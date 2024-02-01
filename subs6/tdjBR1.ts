import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `//#define PERFORMANCE_MODE

// ==========================
// Generic Helpers/Constants
// ==========================

// Keyboard input description: https://www.shadertoy.com/view/lsXGzf
#define KEY_A 65
#define KEY_S 83
#define KEY_D 68
#define KEY_F 70

#define PI 3.141592653589793
#define TWOPI 6.283185307179586
#define HALFPI 1.570796326794896
#define INV_SQRT_2 0.7071067811865476

#define POLAR(theta) vec3(cos(theta), 0.0, sin(theta))
#define SPHERICAL(theta, phi) (sin(phi)*POLAR(theta) + vec3(0.0, cos(phi), 0.0))

float len2Inf(vec2 v) {
    vec2 d = abs(v);
    return max(d.x, d.y);
}

void boxClip(
    in vec3 boxMin, in vec3 boxMax,
    in vec3 p, in vec3 v,
    out vec2 tRange, out float didHit
){
    //for each coord, clip tRange to only contain t-values for which p+t*v is in range
    vec3 tb0 = (boxMin - p) / v;
    vec3 tb1 = (boxMax - p) / v;
    vec3 tmin = min(tb0, tb1);
    vec3 tmax = max(tb0, tb1);

    //t must be > tRange.s and each tmin, so > max of these; similar for t1
    tRange = vec2(
        max(max(tmin.x, tmin.y), tmin.z),
        min(min(tmax.x, tmax.y), tmax.z)
    );

    //determine whether ray intersects the box
    didHit = step(tRange.s, tRange.t);
}

// cf. Dave Hoskins https://www.shadertoy.com/view/4djSRW
// -------------------------
float hash12(vec2 p) {
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash31(float p) {
   vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
   p3 += dot(p3, p3.yzx+33.33);
   return fract((p3.xxy+p3.yzz)*p3.zyx);
}
// -------------------------

// cf. iq https://www.shadertoy.com/view/ll2GD3
vec3 colormap(float t) {
    return .5 + .5*cos(TWOPI*( t + vec3(0.0,0.1,0.2) ));
}

vec4 blendOnto(vec4 cFront, vec4 cBehind) {
    return cFront + (1.0 - cFront.a)*cBehind;
}

// ======================
// Voxel packing helpers
// ======================

#define BOX_MIN vec3(-1.0)
#define BOX_MAX vec3(1.0)
#define BOX_N 128.0

vec3 lmnFromWorldPos(vec3 p) {
    vec3 uvw = (p - BOX_MIN) / (BOX_MAX - BOX_MIN);
    return uvw * vec3(BOX_N-1.0);
}

vec3 worldPosFromLMN(vec3 lmn) {
    return mix(BOX_MIN, BOX_MAX, lmn/(BOX_N-1.0));
}

// Data is organized into 3 "pages" of 128x128x128 voxels.
// Each "page" takes up 2 faces of the 1024x1024 cubemap,
// each face storing 8x8=64 of the 128x128 slices.

vec3 vcubeFromLMN(in int page, in vec3 lmn) {
    // subtexture within [0,8)^2
    float l = mod(round(lmn.x), 128.0);
    float tm = mod(l, 8.0);
    float tn = mod((l - tm)/8.0, 8.0);
    vec2 tmn = vec2(tm, tn);

    // mn within [0,128)^2
    vec2 mn = mod(round(lmn.yz), 128.0);

    // pixel position on 1024x1024 face
    vec2 fragCoord = 128.0*tmn + mn + 0.5;
    vec2 p = fragCoord*(2.0/1024.0) - 1.0;

    vec3 fv;
    if (page == 1) {
        fv = vec3(1.0, p);
    } else if (page == 2) {
        fv = vec3(p.x, 1.0, p.y);
    } else {
        fv = fv = vec3(p, 1.0);
    }

    if (l < 64.0) {
        return fv;
    } else {
        return -fv;
    }
}

void lmnFromVCube(in vec3 vcube, out int page, out vec3 lmn) {
    // page and parity, and pixel position on 1024x1024 texture
    vec2 p;
    float parity;
    if (abs(vcube.x) > abs(vcube.y) && abs(vcube.x) > abs(vcube.z)) {
        page = 1;
        p = vcube.yz/vcube.x;
        parity = vcube.x;
    } else if (abs(vcube.y) > abs(vcube.z)) {
        page = 2;
        p = vcube.xz/vcube.y;
        parity = vcube.y;
    } else {
        page = 3;
        p = vcube.xy/vcube.z;
        parity = vcube.z;
    }
    vec2 fragCoord = floor((0.5 + 0.5*p)*1024.0);

    // mn within [0,128)^2
    vec2 mn = mod(fragCoord, 128.0);

    // subtexture within [0,8)^2
    vec2 tmn = floor(fragCoord/128.0);

    float lAdd;
    if (parity > 0.0) {
        lAdd = 0.0;
    } else {
        lAdd = 64.0;
    }
    lmn = vec3(tmn.y*8.0 + tmn.x + lAdd, mn);
}

// ===================
// Density definition
// ===================

#define MAX_ALPHA_PER_UNIT_DIST 10.0
#define QUIT_ALPHA 0.99
#define QUIT_ALPHA_L 0.95

#ifdef PERFORMANCE_MODE
    #define RAY_STEP 0.035
    #define RAY_STEP_L 0.05
#else
	#define RAY_STEP 0.025
    #define RAY_STEP_L 0.025
	#define SMOOTHING
#endif

#define CAM_THETA (0.2*iTime)
#define CAM_PHI (HALFPI - 0.2)
#define LIGHT_POS (0.9*POLAR(CAM_THETA+PI*0.15) + vec3(0.0, 2.0, 0.0))

// cf. iq https://www.shadertoy.com/view/4sfGzS
float noise(sampler2D randSrc, vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (i.xy+vec2(37.0,17.0)*i.z) + f.xy;
	vec2 rg = textureLod( randSrc, (uv+0.5)/256.0, 0.0).yx;
	return mix( rg.x, rg.y, f.z );
}

float fbm(sampler2D randSrc, vec3 p) {
    p *= 0.6;
    float v = noise(randSrc, p);

    p *= 0.3;
    v = mix(v, noise(randSrc, p), 0.7);

    p *= 0.3;
    v = mix(v, noise(randSrc, p), 0.7);

    return v;
}

float fDensity(sampler2D randSrc, vec3 lmn, float t) {
    t += 32.0;
    
    // Current position adjusted to [-1,1]^3
    vec3 uvw = (lmn - vec3(63.5))/63.5;

    // Value used to offset the main density
    float d2 = fbm(randSrc,
		vec3(0.6, 0.3, 0.6)*lmn +
		vec3(0.0, 8.0*t, 0.0)
	);

    // Main density
    float d1 = fbm(randSrc,
        0.3*lmn +
        vec3(0.0, 4.0*t, 0.0) +
        5.0*vec3( cos(d2*TWOPI), 2.0*d2, sin(d2*TWOPI) )
    );
    d1 = pow(d1, mix( 4.0, 12.0, smoothstep(0.6,1.0,len2Inf(uvw.xz)) ));

    // Tweak density curve
    float a = 0.02;
    float b = 0.08;
    return 0.02 + 0.2*smoothstep(0.0, a, d1) + 0.5*smoothstep(a, b, d1) + 0.18*smoothstep(b, 1.0, d1);
}
`;

const cubeA = `
// ==========================
// Store density on "page 1"
// ==========================

vec4 doPage1(vec3 lmn) {
    return vec4(fDensity(iChannel1, lmn, iTime), 1.0, 1.0, 1.0);
}

vec4 getPage1(vec3 lmn) {
    bool isInit = iFrame < 5;
    return isInit ? doPage1(lmn) : texture(iChannel0, vcubeFromLMN(1, lmn));
}

// ===========================
// Store lighting on "page 2"
// ===========================

float march(vec3 p, vec3 nv) {
    float lightAmount = 1.0;

    vec2 tRange;
    float didHitBox;
    boxClip(BOX_MIN, BOX_MAX, p, nv, tRange, didHitBox);
    tRange.s = max(0.0, tRange.s);

    if (didHitBox < 0.5) {
        return 0.0;
    }

    float t = tRange.s + min(tRange.t-tRange.s, RAY_STEP_L)*hash13(100.0*p);
    int i=0;
    for (; i<150; i++) { // Theoretical max steps: (BOX_MAX-BOX_MIN)*sqrt(3)/RAY_STEP_L
        if (t > tRange.t || lightAmount < 1.0-QUIT_ALPHA_L) { break; }
        
        vec3 rayPos = p + t*nv;
        vec3 lmn = lmnFromWorldPos(rayPos);

        float density = getPage1(lmn).s;
        float calpha = clamp(density * MAX_ALPHA_PER_UNIT_DIST * RAY_STEP_L, 0.0, 1.0);

        lightAmount *= 1.0 - calpha;

        t += RAY_STEP_L;
    }

    return lightAmount;
}

vec4 doPage2(vec3 lmn) {
	float density = getPage1(lmn).s;

	vec3 p = worldPosFromLMN(lmn);
    float lightAmount = march(p, normalize(LIGHT_POS - p));

    return vec4(density, lightAmount, 1.0, 1.0);
}

// ==================
// Write to cube map
// ==================

void mainCubemap(out vec4 fragColor, in vec2 fragCoord, in vec3 rayOri, in vec3 rayDir) {
    vec3 lmn;
    int pageDst;
    lmnFromVCube(rayDir, pageDst, lmn);

    if (pageDst == 1) {
        fragColor = doPage1(lmn);
    } else if (pageDst == 2) {
        fragColor = doPage2(lmn);
    } else {
        discard;
    }
}
`;

const fragment = `
// ========================
// Marching through volume
// ========================

#define DATA(lmn) texture(iChannel0, vcubeFromLMN(2, lmn)).st

vec2 getDataInterp(vec3 lmn) {
    vec3 flmn = floor(lmn);

    vec2 d000 = DATA( flmn );
    vec2 d001 = DATA( flmn + vec3(0.0, 0.0, 1.0) );
    vec2 d010 = DATA( flmn + vec3(0.0, 1.0, 0.0) );
    vec2 d011 = DATA( flmn + vec3(0.0, 1.0, 1.0) );
    vec2 d100 = DATA( flmn + vec3(1.0, 0.0, 0.0) );
    vec2 d101 = DATA( flmn + vec3(1.0, 0.0, 1.0) );
    vec2 d110 = DATA( flmn + vec3(1.0, 1.0, 0.0) );
    vec2 d111 = DATA( flmn + vec3(1.0, 1.0, 1.0) );

    vec3 t = lmn - flmn;
    return mix(
        mix(mix(d000, d100, t.x), mix(d010, d110, t.x), t.y),
        mix(mix(d001, d101, t.x), mix(d011, d111, t.x), t.y),
        t.z
    );
}

void readLMN(in vec3 lmn, out float density, out float lightAmount) {
    #ifdef SMOOTHING
    	vec2 data = getDataInterp(lmn);
    #else
    	vec2 data = DATA(lmn);
    #endif

    bool noLight = texelFetch(iChannel2, ivec2(KEY_S,0), 0).x > 0.5;
    lightAmount = noLight ? 1.0 : data.t;
    lightAmount = mix(lightAmount, 1.0, 0.025);

    // density = fDensity(iChannel1, lmn, iTime);
    density = data.s;
}

vec4 march(vec3 p, vec3 nv, vec2 fragCoord) {
    vec2 tRange;
    float didHitBox;
    boxClip(BOX_MIN, BOX_MAX, p, nv, tRange, didHitBox);
    tRange.s = max(0.0, tRange.s);

    vec4 color = vec4(0.0);
    if (didHitBox < 0.5) {
        return color;
    }
    
    bool noColor = texelFetch(iChannel2, ivec2(KEY_A,0), 0).x > 0.5;
	bool noDensity = texelFetch(iChannel2, ivec2(KEY_D,0), 0).x > 0.5;
    
    float t = tRange.s + min(tRange.t-tRange.s, RAY_STEP)*hash12(fragCoord);
    int i=0;
    for (; i<150; i++) { // Theoretical max steps: (BOX_MAX-BOX_MIN)*sqrt(3)/RAY_STEP
        if (t > tRange.t || color.a > QUIT_ALPHA) { break; }

        vec3 rayPos = p + t*nv;
        vec3 lmn = lmnFromWorldPos(rayPos);

        float density;
        float lightAmount;
        readLMN(lmn, density, lightAmount);

        vec3 cfrag = noColor ? vec3(1.0) : colormap(0.7*density+0.8);
        density = noDensity ? 0.1 : density;

        float calpha = density * MAX_ALPHA_PER_UNIT_DIST * RAY_STEP;
        vec4 ci = clamp( vec4(cfrag * lightAmount, 1.0)*calpha, 0.0, 1.0);
        color = blendOnto(color, ci);

        t += RAY_STEP;
    }

    float finalA = clamp(color.a/QUIT_ALPHA, 0.0, 1.0);
    color *= (finalA / (color.a + 1e-5));

    bool showSteps = texelFetch(iChannel2, ivec2(KEY_F,0), 0).x > 0.5;
    return showSteps ? vec4(vec3(float(i)/150.0), 1.0) : color;
}

// ================
// Final rendering
// ================

#define RES iResolution
#define TAN_HALF_FOVY 0.5773502691896257
#define VIGNETTE_INTENSITY 0.25

vec3 skybox(vec3 nvDir) {
    return ( mix(0.1, 0.2, smoothstep(-0.2,0.2, nvDir.y)) )*vec3(1.0);
}

vec3 nvCamDirFromClip(vec3 nvFw, vec2 clip) {
    vec3 nvRt = normalize(cross(nvFw, vec3(0.,1.,0.)));
    vec3 nvUp = cross(nvRt, nvFw);
    return normalize(TAN_HALF_FOVY*(clip.x*(RES.x/RES.y)*nvRt + clip.y*nvUp) + nvFw);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Camera
    float isMousePressed = clamp(iMouse.z, 0.0, 1.0);
    vec2 mouseAng = mix(
        vec2(CAM_THETA, CAM_PHI),
        PI * vec2(4.0*iMouse.x, iMouse.y) / iResolution.xy,
        isMousePressed
    );

    vec3 camPos = 2.5 * SPHERICAL(mouseAng.x, mouseAng.y);
    vec3 lookTarget = vec3(0.0);

	vec3 nvCamFw = normalize(lookTarget - camPos);
    vec3 nvCamDir = nvCamDirFromClip(nvCamFw, uv*2. - 1.);

    // Render
    vec3 bgColor = skybox(nvCamDir);
    vec4 fgColor = march(camPos, nvCamDir, fragCoord);
    vec3 finalColor = blendOnto(fgColor, vec4(bgColor, 1.0)).rgb;

    // Vignette
    vec2 radv = vec2(0.5, 0.5) - uv;
    float dCorner = length(radv) / INV_SQRT_2;
    float vignetteFactor = 1.0 - mix(0.0, VIGNETTE_INTENSITY, smoothstep(0.4, 0.9, dCorner));

    fragColor = vec4(vignetteFactor * finalColor, 1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'tdjBR1';
  }
  name(): string {
    return 'Volumetric lighting';
  }
  // sort() {
  //   return 0;
  // }
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
      // { type: 1, f: cubeA, fi: 0 },
      webglUtils.DEFAULT_NOISE, //
      webglUtils.DEFAULT_NOISE, //
    ];
  }
}
