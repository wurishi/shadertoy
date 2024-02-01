import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float pi = 3.141592653589;

float hash(vec2 p)
{
    return texelFetch(iChannel0, ivec2(p) & 255, 0).r;
}

/*
// Returns the origin and radius of a circle intersecting a and b, with tangents
// at a and b pointing towards vec2(0). This is for drawing the circular arcs.
void solveCircle(vec2 a, vec2 b, out vec2 o, out float r)
{
    float th = acos(dot(normalize(a), normalize(b))) / 2.;
    float adj = length(a);
    r = tan(th) *adj;
    o = normalize((a + b) / 2.) * sqrt(r * r + adj * adj);
}
*/

void solveCircle(vec2 a, vec2 b, out vec2 o, out float r){
    
    vec2 m = a + b;
    o = dot(a, a)/dot(m, a)*m;
    r = length(o - a);
    
}

// Pixel width for anti-aliasing.
float w;

// Draws a line or arc connecting a and b inside a polygon.
float l(vec2 p, vec2 a, vec2 b)
{
    if(dot(normalize(a), normalize(b)) < -.99999)
    {
        float d = distance(p, mix(a, b, clamp(dot(p - a, b - a) / dot(b - a,b - a), 0., 1.)));
        return smoothstep(0.03, 0.03 - w * 2., d - .04);
    }

    vec2 o;
    float r;
    solveCircle(a, b, o, r);
    return smoothstep(0.03, 0.03 - w * 2., abs(distance(p, o) - r) - .04);
}


// Array of unique octagon side connections without overlaps.
const int arr8[4 * 8] = int[4 * 8](
    1, 2 ,  3, 4 ,  5, 6 ,  7, 8, 
    1, 2 ,  3, 4 ,  5, 8 ,  6, 7, 
    1, 2 ,  3, 8 ,  4, 5 ,  6, 7, 
    1, 2 ,  3, 8 ,  4, 7 ,  5, 6
);

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.y;

    fragColor = vec4(1);

    vec2 p = uv.xy * 8.;

    w = max(length(dFdx(p)), length(dFdy(p)));

    p.x += iTime / 3.;

    float th = 2. * pi / 8.;

    float el = tan(2. * pi / 16.);
    float hyp = sqrt(1. - el * el);
    float d = cos(2. * pi / 16.) * hyp;

    vec2 ip = floor(p - .5) * 2.;
    vec2 fpa = abs(fract(p) - .5);
    vec2 fp = fract(p - .5) - .5;

    float a = 0.;
    float b = hash(ip);
    float c = 0.;

    vec3 col = vec3(1, 1, 0);

    if(fpa.x + fpa.y < (1. - sqrt(2.) / 2.))
    {
        // Square.
        ip = floor(p) * 2. +1.;
        b = hash(ip);
        fp = fract(p) - .5;
        if(b > .5)
            fp = fp.yx * vec2(1, -1);

        a += l(fp, normalize(vec2(-1, 1)) * .5 * d / 2., normalize(vec2(1, 1)) * .5 * d / 2.);
        a += l(fp, normalize(vec2(1, -1)) * .5 * d / 2., normalize(vec2(-1, -1)) * .5 * d / 2.);
        c = max(c, smoothstep((1. - sqrt(2.) / 2.) - w * sqrt(2.) * 2., (1. - sqrt(2.) / 2.), max(abs(fp.x + fp.y), abs(fp.y - fp.x))));
    }
    else
    {
        // Octagon.
        float th = floor(mod(b,.25)/.25*8.) * pi * 2. / 8.;
        fp *= mat2(cos(th), sin(th), -sin(th), cos(th));
        col = mix(vec3(0, .5, 0), vec3(.25, .25, 1), mod(ip.x / 2. + ip.y / 2., 2.));

        th = pi * 2. / 8.;

        int i = int(floor(b * 3.999));

        for(int j = 0; j < 8; j += 2)
        {
            int ia = arr8[i * 8 + j + 0] - 1;
            int ib = arr8[i * 8 + j + 1] - 1;
            a += l(fp, vec2(cos(th * float(ia)), sin(th * float(ia))) / 2., vec2(cos(th * float(ib)), sin(th * float(ib))) / 2.);
        }

        float d = max(abs(fp.x + fp.y) / sqrt(2.), abs(fp.y - fp.x) / sqrt(2.));
        c = max(c, smoothstep(.5 - w * 2., .5, max(d, max(abs(fp.x), abs(fp.y)))));
    }

    // Shade.
    col = mix(col, vec3(1), .3) + .1;    
    col = mix(col, vec3(0), c);

    float l = 1. - (min(fract(iTime / 4.) * 2., 2. - 2. * fract(iTime / 4.)) - .5) * 16.;

    fragColor.rgb = mix(vec3(.8), col, smoothstep(0., 1., l));

    fragColor.rgb = mix(fragColor.rgb, vec3(0), a);

    // Gamma etc.
    fragColor.rgb = pow(fragColor.rgb, vec3(1. / 2.2));
}
`;

export default class implements iSub {
  key(): string {
    return 'MlyBRG';
  }
  name(): string {
    return '4.8^2 Truchet';
  }
  sort() {
    return 56;
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
    return [webglUtils.DEFAULT_NOISE];
  }
}
