import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform bool u_showSquare;
uniform bool u_showOctagon;
uniform bool u_showArcs;
uniform bool u_aniline;
uniform float u_gamma;

const float pi = 3.141592653589;
const float r = .02;
const float r2 = .005;
const float slope = .1;
const vec2 dir = vec2(.1, slope);
const float r3 = (r + r2 * 0.15) / (dir.x / length(dir));

// Pixel width for anti-aliasing.
float w;


float hash(vec2 p)
{
  return texelFetch(iChannel0, ivec2(p) & 255, 0).r;
}

void solveCircle(vec2 a, vec2 b, out vec2 o, out float r){
    
    vec2 m = a + b;
    o = dot(a, a)/dot(m, a)*m;
    r = length(o - a);
    
}

float arcDistance(vec2 p, vec2 a, vec2 b)
{
    if(abs(a.x * b.y - a.y * b.x) < 1e-5)
        return distance(p, mix(a, b, clamp(dot(p - a, b - a) / dot(b - a,b - a), 0., 1.)));

    vec2 o;
    float r;
    solveCircle(a, b, o, r);
    return abs(distance(p, o) - r);
}

// Draws a line or arc connecting a and b inside a polygon.
float l(vec2 p, vec2 a, vec2 b)
{
    float d = arcDistance(p, a, b);
    return smoothstep(0.03, 0.03 - w * 2., d - .04);
}

uint hash1( uint n ) 
{
    // integer hash copied from Hugo Elias
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    return n;
}


void sdRope(vec2 p, out float mask_d, out float outline_d)
{    
    float pd = dot(p, vec2(dir.y, -dir.x)) / ((r + r2 * 0.15) * 2. * length(dir));
    
    p.y += 2. * r3 * floor(pd) + r3;
    
    vec2 q = dir * clamp(dot(p, dir) / dot(dir, dir), -.5, +.5);
    
    float d = distance(p, q) - r;
    
    mask_d = d - r2;
    outline_d = min(max(-d, abs(p.x) - r * 3.), abs(d) - r2);
}

vec4 arcDistanceRope(vec2 p, vec2 a, vec2 b)
{
    float mask_d;
    float outline_d;
    float mask2;

    float sr = r3 * 2.;

    if(abs(a.x * b.y - a.y * b.x) < 1e-5)
    {
    	float ld = distance(p, mix(a, b, clamp(dot(p - a, b - a) / dot(b - a,b - a), 0., 1.)));
        
        vec2 n = normalize(b - a);

        float da = dot(a, n);
        float db = dot(b, n);
        float d = dot(p, n);
        
        vec2 q = vec2(dot(p, -vec2(n.y,-n.x)), mix(round(da / sr) * sr, round(db / sr) * sr, (d - da) / (db - da)));

        sdRope(q + vec2(0., r3), mask_d, outline_d);

        mask2 = ld-.05;
    }
    else
    {    
        vec2 o;
        float r;
        solveCircle(a, b, o, r);
        
        vec2 nm = normalize((a + b) / 2. - o);
        
        vec2 na = normalize(a - o);
        vec2 nb = normalize(b - o);
        vec2 np = normalize(p - o);

        float tha = asin(na.x * nm.y - na.y * nm.x) * r;
        float thb = asin(nb.x * nm.y - nb.y * nm.x) * r;
        float th = asin(np.x * nm.y - np.y * nm.x) * r;

        vec2 q = vec2(length(p - o) - r, mix(round(tha / sr) * sr, round(thb / sr) * sr, (th - tha) / (thb - tha)));

        sdRope(q + vec2(0., r3), mask_d, outline_d);

        mask2 = abs(distance(p, o) - r)-.05;
    }

    vec3 col = vec3(mix(vec3(.02), vec3(.8), smoothstep(0.0, w, outline_d)));
    
    return vec4(col, 1. - smoothstep(0.0, w, mask2 - 0.05));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.y;
    
    fragColor = vec4(1);

    vec2 p = uv.xy * 6. + iMouse.xy / iResolution.xy * 10.;

    w = max(length(dFdx(p)), length(dFdy(p)));

    p.x += iTime / 3.;

    float el = tan(2. * pi / 16.);
    float hyp = sqrt(1. - el * el);
    float d = cos(2. * pi / 16.) * hyp;

    vec2 ip = floor(p - .5) * 2.;
    vec2 fpa = abs(fract(p) - .5);
    vec2 fp = fract(p - .5) - .5;

    vec4 a = vec4(vec3(.8), 0.);
    float b = hash(ip);
    float c = 0.;

    uint num_inds = 0U;
    float th = 0., thoffset = 0.;
    float r = 1.;

    if(fpa.x + fpa.y < (1. - sqrt(2.) / 2.))
    {
      // 方块部分
      if(u_showSquare) {
        // Square.
        ip = floor(p) * 2. +1.;
        b = hash(ip);
        fp = fract(p) - .5;
        if(b > .5)
            fp = fp.yx * vec2(1, -1);

        num_inds = 4U;
        th = pi * 2. / 4.;
        r = .5 * d;
        thoffset = th / 2.;

        c = max(c, smoothstep((1. - sqrt(2.) / 2.) - w * sqrt(2.) * 2., (1. - sqrt(2.) / 2.), max(abs(fp.x + fp.y), abs(fp.y - fp.x))));
      }
    }
    else
    {
      // 八角形部分
      if(u_showOctagon) {
        // Octagon.
        th = floor(mod(b,.25)/.25*8.) * pi * 2. / 8.;
        fp *= mat2(cos(th), sin(th), -sin(th), cos(th));

        th = pi * 2. / 8.;

        num_inds = 8U;

        float d = max(abs(fp.x + fp.y) / sqrt(2.), abs(fp.y - fp.x) / sqrt(2.));
        c = max(c, smoothstep(.5 - w * 2., .5, max(d, max(abs(fp.x), abs(fp.y)))));
      }
    }
    
    uint inds[8];
    
	  inds[0] = 0U;
    
    // 随机方向绳索线
    uint seed = uint(ip.x + ip.y * 8192.)*319U;
    for(uint j = 1U; j < num_inds; ++j)
    {
        seed = hash1(seed);
        // seed = uint(hash(vec2(float(j), seed)));
        uint k = seed % j;
        uint temp = inds[k];
        inds[k] = j;
        inds[j] = temp;
    }

    // Draw the arcs.
    if(u_showArcs) {
      for(uint j = 0U; j < num_inds; j += 2U)
      {
          uint ia = inds[j];
          uint ib = inds[j + 1U];
          vec2 pa = vec2(cos(th * float(ia) - thoffset), sin(th * float(ia) - thoffset)) * r / 2.;
          vec2 pb = vec2(cos(th * float(ib) - thoffset), sin(th * float(ib) - thoffset)) * r / 2.;
          vec4 d = arcDistanceRope(fp, pa, pb);
          a = mix(a, d, d.a);
      }
    }
    
    // Shade.
    vec3 col = mix(vec3(1), vec3(.3), c);

    float l = 1. - (min(fract(iTime / 6.) * 2., 2. - 2. * fract(iTime / 6.)) - .5) * 16.;
    // line的动画
    if(!u_aniline) {
      l = 1.;
    }

    fragColor.rgb = mix(a.rgb, a.rgb * col, (1. - a.a) * smoothstep(0., 1., l));

    // Gamma 增强
    fragColor.rgb = pow(fragColor.rgb, vec3(1. / u_gamma));
}
`;

let gui: GUI;
const api = {
  u_showSquare: true,
  u_showOctagon: true,
  u_showArcs: true,
  u_aniline: true,
  u_gamma: 2.2,
};

export default class implements iSub {
  key(): string {
    return '3dVSRm';
  }
  name(): string {
    return '4.8^2 Truchet Weave';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 65;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_showSquare').name('显示方块');
    gui.add(api, 'u_showOctagon').name('显示八角形');
    gui.add(api, 'u_showArcs');
    gui.add(api, 'u_aniline').name('line动画');
    gui.add(api, 'u_gamma', 1, 10, 0.1);
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_showSquare = webglUtils.getUniformLocation(
      gl,
      program,
      'u_showSquare'
    );
    const u_showOctagon = webglUtils.getUniformLocation(
      gl,
      program,
      'u_showOctagon'
    );
    const u_showArcs = webglUtils.getUniformLocation(gl, program, 'u_showArcs');
    const u_aniline = webglUtils.getUniformLocation(gl, program, 'u_aniline');
    const u_gamma = webglUtils.getUniformLocation(gl, program, 'u_gamma');
    return () => {
      u_showSquare.uniform1i(api.u_showSquare ? 1 : 0);
      u_showOctagon.uniform1i(api.u_showOctagon ? 1 : 0);
      u_showArcs.uniform1i(api.u_showArcs ? 1 : 0);
      u_aniline.uniform1i(api.u_aniline ? 1 : 0);
      u_gamma.uniform1f(api.u_gamma);
    };
  }
  channels() {
    return [
      {
        type: 0,
        path: './textures/noise.png',
      },
    ];
  }
}
