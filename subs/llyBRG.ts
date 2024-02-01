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
        return smoothstep(0.03, 0.03 - w * 2., d - .02);
    }

    vec2 o;
    float r;
    solveCircle(a, b, o, r);
    return smoothstep(0.03, 0.03 - w * 2., abs(distance(p, o) - r) - .02);
}

// Array of unique hexagon side connections without overlaps.
const float arr6[2*3*2] = float[2*3*2](
    1., 2., 3., 4., 5., 6.,
    1., 2., 3., 6., 4., 5.
);

// Array of unique dodecagon side connections without overlaps.
const float arr12[29*6*2] = float[29*6*2](
    1. , 2. ,  3. , 4. ,  5. , 6. ,  7. , 8. ,  9. , 10. ,  11. , 12. ,
    1. , 2. ,  3. , 4. ,  5. , 6. ,  7. , 8. ,  9. , 12. ,  10. , 11. ,
    1. , 2. ,  3. , 4. ,  5. , 6. ,  7. , 12. ,  8. , 9. ,  10. , 11. ,
    1. , 2. ,  3. , 4. ,  5. , 6. ,  7. , 12. ,  8. , 11. ,  9. , 10. ,
    1. , 2. ,  3. , 4. ,  5. , 8. ,  6. , 7. ,  9. , 12. ,  10. , 11. ,
    1. , 2. ,  3. , 4. ,  5. , 12. ,  6. , 7. ,  8. , 9. ,  10. , 11. ,
    1. , 2. ,  3. , 4. ,  5. , 12. ,  6. , 7. ,  8. , 11. ,  9. , 10. ,
    1. , 2. ,  3. , 4. ,  5. , 12. ,  6. , 9. ,  7. , 8. ,  10. , 11. ,
    1. , 2. ,  3. , 4. ,  5. , 12. ,  6. , 11. ,  7. , 8. ,  9. , 10. ,
    1. , 2. ,  3. , 4. ,  5. , 12. ,  6. , 11. ,  7. , 10. ,  8. , 9. ,
    1. , 2. ,  3. , 6. ,  4. , 5. ,  7. , 8. ,  9. , 12. ,  10. , 11. ,
    1. , 2. ,  3. , 6. ,  4. , 5. ,  7. , 12. ,  8. , 9. ,  10. , 11. ,
    1. , 2. ,  3. , 6. ,  4. , 5. ,  7. , 12. ,  8. , 11. ,  9. , 10. ,
    1. , 2. ,  3. , 8. ,  4. , 5. ,  6. , 7. ,  9. , 12. ,  10. , 11. ,
    1. , 2. ,  3. , 8. ,  4. , 7. ,  5. , 6. ,  9. , 12. ,  10. , 11. ,
    1. , 2. ,  3. , 12. ,  4. , 5. ,  6. , 7. ,  8. , 9. ,  10. , 11. ,
    1. , 2. ,  3. , 12. ,  4. , 5. ,  6. , 7. ,  8. , 11. ,  9. , 10. ,
    1. , 2. ,  3. , 12. ,  4. , 5. ,  6. , 9. ,  7. , 8. ,  10. , 11. ,
    1. , 2. ,  3. , 12. ,  4. , 5. ,  6. , 11. ,  7. , 8. ,  9. , 10. ,
    1. , 2. ,  3. , 12. ,  4. , 5. ,  6. , 11. ,  7. , 10. ,  8. , 9. ,
    1. , 2. ,  3. , 12. ,  4. , 7. ,  5. , 6. ,  8. , 9. ,  10. , 11. ,
    1. , 2. ,  3. , 12. ,  4. , 7. ,  5. , 6. ,  8. , 11. ,  9. , 10. ,
    1. , 2. ,  3. , 12. ,  4. , 9. ,  5. , 6. ,  7. , 8. ,  10. , 11. ,
    1. , 2. ,  3. , 12. ,  4. , 9. ,  5. , 8. ,  6. , 7. ,  10. , 11. ,
    1. , 2. ,  3. , 12. ,  4. , 11. ,  5. , 6. ,  7. , 8. ,  9. , 10. ,
    1. , 2. ,  3. , 12. ,  4. , 11. ,  5. , 6. ,  7. , 10. ,  8. , 9. ,
    1. , 2. ,  3. , 12. ,  4. , 11. ,  5. , 8. ,  6. , 7. ,  9. , 10. ,
    1. , 2. ,  3. , 12. ,  4. , 11. ,  5. , 10. ,  6. , 7. ,  8. , 9. ,
    1. , 2. ,  3. , 12. ,  4. , 11. ,  5. , 10. ,  6. , 9. ,  7. , 8.
);

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.y;

    fragColor = vec4(1);

    vec2 p = uv.xy * 5.;

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

    float a = 0.;

    vec3 col = vec3(1, 1, 0);

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
    
    if(dd - c < 0.)
    {
        // Hexagon.
        op = op * vec2(1. / s, 1) + vec2(.5, 0);
        ip = floor(op);

        vec2 fp = op - ip - .5;

        fp.x *= s;
        fp.y -= 1. / 6. * (1. - 2. * mod(ip.x + ip.y, 2.));

        float th = pi * 2. / 6.;

        float tha = th*(floor(6. * hash(ip * 3. + 2.)) + .5);
        fp *= mat2(cos(tha), sin(tha), -sin(tha), cos(tha));

        int i = int(floor(hash(ip * 13. + 99.) * 1.999));

        for(int j = 0; j < 3; j += 1)
        {
            float ia = arr6[i * 6 + j * 2 + 0] - 1.;
            float ib = arr6[i * 6 + j * 2 + 1] - 1.;
            a += l(fp, c * vec2(cos(th * float(ia)), sin(th * float(ia))), c * vec2(cos(th * float(ib)), sin(th * float(ib))));
        }

        g = max(g, smoothstep(-w * 2., 0., dd - c));

        col = vec3(1, 0, 0);
    }
    else if((abs(fp.x)-e)<0.)
    {
        // Square.
        op = op * vec2(1. / s, 2) + vec2(.5 + .5 * mod(floor(op.y * 2. + .5), 2.), .5);
        ip = floor(op);

        vec2 fp = op - ip - .5;

        fp.x *= s;
        fp.y /= 2.;

        float th = pi * 2. / 4.;

        float tha = th * floor(3.999 * hash(ip * 3. + 2.));

        if(mod(ip.y, 2.) > .5)
            tha += pi * 2. / 3. * .5 * (2. - mod(ip.x + floor(ip.y / 2.), 2.));

        fp *= mat2(cos(tha), sin(tha), -sin(tha), cos(tha));

        a += l(fp, +e * vec2(0., 1.), +e * vec2(sin(th), cos(th)));
        a += l(fp, -e * vec2(0., 1.), -e * vec2(sin(th), cos(th)));

        g = max(g, smoothstep(e - w * 2., e, max(abs(fp.x), abs(fp.y))));

        col = vec3(0, 0, 1);
    }
    else
    {
        // Dodecagon.
        op = op * vec2(1. / s / 2., 1.) + vec2(.5 + .5 * mod(floor(op.y + .5), 2.), .5);
        ip = floor(op);

        vec2 fp = op - ip - .5;

        fp.x *= s * 2.;

        float th = pi * 2. / 12.;

        float tha = th * floor(12. * hash(ip * 3.));
        fp *= mat2(cos(tha), sin(tha), -sin(tha), cos(tha));

        int i = int(floor(hash(ip * 13. + 99.) * 28.999));

        float d = -1.;

        for(int j = 0; j < 6; j+=1)
        {
            float ia = arr12[i * 12 + j * 2 + 0] - 1.;
            float ib = arr12[i * 12 + j * 2 + 1] - 1.;
            a += l(fp, f * vec2(cos(th * float(ia)), sin(th * float(ia))), f * vec2(cos(th * float(ib)), sin(th * float(ib))));
            d = max(d, abs(dot(fp, vec2(cos(th * float(j)), sin(th * float(j))))) - f);
        }

        g = max(g, smoothstep(-w * 2., 0., d));
    }

    // Shade.
    col = mix(col, vec3(1), .3) + .2;    
    col = mix(col, vec3(0), g);

    float l = 1. - (min(fract(iTime / 4.) * 2., 2. - 2. * fract(iTime / 4.)) - .5) * 16.;

    fragColor.rgb = mix(vec3(.8), col, smoothstep(0., 1., l));

    fragColor.rgb = mix(fragColor.rgb, vec3(0), a);

    // Gamma etc.
    fragColor.rgb = pow(fragColor.rgb, vec3(1. / 2.2));
}
`;

export default class implements iSub {
  key(): string {
    return 'llyBRG';
  }
  name(): string {
    return '4.6.12 Truchet';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 61;
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
