import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float pi = 3.141592653589;
const float r = .017;
const float r2 = .005;
const float slope = .05;
const vec2 dir = vec2(.06, slope);
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
    outline_d = min(max(-d, abs(p.x) - r * 2.5), abs(d) - r2);
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

        mask2 = ld-.033;
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

        mask2 = abs(distance(p, o) - r)-.033;
    }

    vec3 col = vec3(mix(vec3(.02), vec3(.8), smoothstep(0.0, w, outline_d)));
    
    return vec4(col, 1. - smoothstep(0.0, w, mask2 - 0.03));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.y;

    fragColor = vec4(1);

    vec2 p = uv.xy * 4.5 + iMouse.xy / iResolution.xy * 10.;

    w = max(length(dFdx(p)), length(dFdy(p)));

    p.x += iTime / 3.;

    // The plane is first divided in to equilaterial triangles.
    
    float s = 1. / sqrt(3.);

    vec2 op = p;

    p.x /= s;
    p.x += mod(floor(p.y), 2.);

    vec2 ip = floor(p);
    vec2 fp = fract(p);

    if(fp.x > mix(fp.y, 1. - fp.y, mod(ip.x, 2.)))
        ip.x += 1.;

    fp = p - ip;

    fp.x *= s;
    fp.y -= 1. / 3. + mod(ip.x + 1., 2.) / 3.;

    if(mod(ip.x, 2.) > .5)
        fp.y =- fp.y;

    vec4 a = vec4(vec3(.8), 0.);

    fp.x = abs(fp.x);

    float th = pi * 2. / 3.;

    // Use the symmetry of the figure within the triangular tile.
    
    if(dot(fp, vec2(cos(th), sin(th))) < 0.)
        fp = fp - vec2(cos(th), sin(th)) * dot(fp, vec2(cos(th), sin(th))) * 2.;

    fp.x = abs(fp.x);

    float dd = fp.y;
    dd = max(dd, dot(fp, vec2(sin(th), -cos(th))));

	// Get the precise distances of the tile edges.
    
    float c = tan(pi * 2. / 6.) / (3. * tan(pi * 2. / 6.) + 3.);
    float e = 1. / 3. - c;
    float f = 1. / (3. * cos(pi * 2. / 6.)) - c;
	float g = 0.;
    
    uint num_inds = 0U;
    float outth = 0., thoffset = 0.;
    float r = 1.;
    
    if(dd - c < 0.)
    {
        // Hexagon.
        op = op * vec2(1. / s, 1) + vec2(.5, 0);
        ip = floor(op);

        num_inds = 6U;
        
        fp = op - ip - .5;

        fp.x *= s;
        fp.y -= 1. / 6. * (1. - 2. * mod(ip.x + ip.y, 2.));

        float th = pi * 2. / 6.;

        outth = th;
        r = c;

        float tha = th*(floor(6. * hash(ip * 3. + 2.)) + .5);
        fp *= mat2(cos(tha), sin(tha), -sin(tha), cos(tha));

        int i = int(floor(hash(ip * 13. + 99.) * 1.999));

        g = max(g, smoothstep(-w * 2., 0., dd - c));

    }
    else if((abs(fp.x)-e)<0.)
    {
        // Square.
        op = op * vec2(1. / s, 2) + vec2(.5 + .5 * mod(floor(op.y * 2. + .5), 2.), .5);
        ip = floor(op);

        num_inds = 4U;

        fp = op - ip - .5;

        fp.x *= s;
        fp.y /= 2.;

        float th = pi * 2. / 4.;

        outth = th;
        r = e;

        float tha = th * floor(3.999 * hash(ip * 3. + 2.));

        if(mod(ip.y, 2.) > .5)
            tha += pi * 2. / 3. * .5 * (2. - mod(ip.x + floor(ip.y / 2.), 2.));

        fp *= mat2(cos(tha), sin(tha), -sin(tha), cos(tha));

        g = max(g, smoothstep(e - w * 2., e, max(abs(fp.x), abs(fp.y))));
    }
    else
    {
        // Dodecagon.
        op = op * vec2(1. / s / 2., 1.) + vec2(.5 + .5 * mod(floor(op.y + .5), 2.), .5);
        ip = floor(op);

        num_inds = 12U;

        fp = op - ip - .5;

        fp.x *= s * 2.;

        float th = pi * 2. / 12.;

        outth = th;
        r = f;

        float tha = th * floor(12. * hash(ip * 3.));
        fp *= mat2(cos(tha), sin(tha), -sin(tha), cos(tha));

        int i = int(floor(hash(ip * 13. + 99.) * 28.999));

        float d = -1.;

        for(int j = 0; j < 6; j+=1)
            d = max(d, abs(dot(fp, vec2(cos(th * float(j)), sin(th * float(j))))) - f);

        g = max(g, smoothstep(-w * 2., 0., d));
    }

    // Shuffle the indices by using the Fisher-Yates algorithm
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle

    uint inds[12];
    
	inds[0] = 0U;
    
    uint seed = uint(ip.x + ip.y * 8192.)*319U;
    for(uint j = 1U; j < num_inds; ++j)
    {
        seed = hash1(seed);
        uint k = seed % j;
        uint temp = inds[k];
        inds[k] = j;
        inds[j] = temp;
    }

    // Draw the arcs.
    
    for(uint j = 0U; j < num_inds; j += 2U)
    {
        uint ia = inds[j];
        uint ib = inds[j + 1U];
        vec2 pa = vec2(cos(outth * float(ia) - thoffset), sin(outth * float(ia) - thoffset)) * r;
        vec2 pb = vec2(cos(outth * float(ib) - thoffset), sin(outth * float(ib) - thoffset)) * r;
        vec4 d = arcDistanceRope(fp, pa, pb);
        a = mix(a, d, d.a);
    }
    
    
    // Shade.
    vec3 col = mix(vec3(1), vec3(.3), g);

    float l = 1. - (min(fract(iTime / 6.) * 2., 2. - 2. * fract(iTime / 6.)) - .5) * 16.;

    fragColor.rgb = mix(a.rgb, a.rgb * col, (1. - a.a) * smoothstep(0., 1., l));

    // Gamma etc.
    fragColor.rgb = pow(fragColor.rgb, vec3(1. / 2.2));
}

`;

export default class implements iSub {
  key(): string {
    return 'WsyXWR';
  }
  name(): string {
    return '4.6.12 Truchet Weave';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 62;
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
    return [{ type: 0, path: './textures/noise.png' }];
  }
}
