import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
   
const float pi = acos(-1.);
float vertex_dot_radius = .06;

vec2 triangleCircumcenter(vec2 A, vec2 B, vec2 C)
{
    float a = distance(C, B);
    float b = distance(C, A);
    float c = distance(A, B);
    vec3 bary = vec3(a * a * (b * b + c * c - a * a),
                     b * b * (c * c + a * a - b * b),
                     c * c * (a * a + b * b - c * c));
    bary /= bary.x + bary.y + bary.z;
    return A * bary.x + B * bary.y + C * bary.z;
}

float segment(vec2 p, vec2 a, vec2 b)
{
    return distance(p, mix(a, b, clamp(dot(p - a, b - a) / dot(b - a, b - a), 0., 1.)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - iResolution.xy * .5) / iResolution.y;

    uv *= 9.;

    float w = length(fwidth(uv)) * 2.;

    vec3 col = vec3(0);

    // https://en.wikipedia.org/wiki/Wythoff_symbol
    // wythoff_symbol.w indicates the position of the vertical bar in the symbol
    ivec4 wythoff_symbol;

    float md = 1. / 10. * iResolution.x;

    // https://en.wikipedia.org/wiki/List_of_Euclidean_uniform_tilings
    // Select tiling via mouse X position
    if(iMouse.x < md * 1.)
    {
        wythoff_symbol = ivec4(3, 6, 2, 2); // 3.4.6.4
    }
    else if(iMouse.x < md * 2.)
    {
        wythoff_symbol = ivec4(2, 4, 4, 3); // 4.8.8 (Wikipedia suggests 2 | 4 4 but that is surely incorrect..)
    }
    else if(iMouse.x < md * 3.)
    {
        wythoff_symbol = ivec4(3, 3, 3, 3); // 6.6.6
    }
    else if(iMouse.x < md * 4.)
    {
        wythoff_symbol = ivec4(2, 6, 3, 1); // 3.6.3.6
    }
    else if(iMouse.x < md * 5.)
    {
        wythoff_symbol = ivec4(2, 3, 6, 2); // 3.12.12
    }
    else if(iMouse.x < md * 6.)
    {
        wythoff_symbol = ivec4(3, 3, 3, 1); // 3.3.3.3.3.3
    }
    else if(iMouse.x < md * 7.)
    {
        wythoff_symbol = ivec4(4, 2, 4, 1); // 4.4.4.4
    }
    else if(iMouse.x < md * 8.)
    {
        wythoff_symbol = ivec4(2, 6, 3, 3); // 4.6.12
    }
    else if(iMouse.x < md * 9.)
    {
        wythoff_symbol = ivec4(6, 3, 2, 0); // 3.3.3.3.6
    }
    else if(iMouse.x < md * 10.)
    {
        wythoff_symbol = ivec4(4, 4, 2, 0); // 3.3.4.3.4
    }

    vec3 angles = vec3(pi) / vec3(wythoff_symbol.xyz);
    vec3 sins = sin(angles);

    // Law of sines (c is defined to be 1.0)
    float a = sins.x / sins.z;
    float b = sins.y / sins.z;

    // Triangle corners (ta is defined to be vec2(0))
    vec2 tb = vec2(1, 0);
    vec2 tc = vec2(cos(angles.x), sin(angles.x)) * b;

    float sinzx = sin(angles.z + angles.x);

    // Triangle edge planes
    vec3 dirs[3] = vec3[3](vec3(-sin(angles.x), cos(angles.x), 0.), vec3(0., -1., 0.),
                           vec3(sinzx, -cos(angles.z + angles.x), sinzx));

    vec2 incenter = (tb * b + tc) / (a + b + 1.);
    vec2 sidecenter = (tb * b) / (a + b);

    int reflcount = 0;

    // This is not the fastest way, but it certainly is the simplest.
    for(int i = 0; i < 32; ++i)
    {
        int j = 0;
        while(j < 3)
        {
            vec2 dir = dirs[j].xy;
            float d = dot(uv, dir) - dirs[j].z;             
            if(d > 0.)
            {
                // Reflect
                uv -= dir * d * 2.;
                ++reflcount;
                break;
            }
            ++j;
        }
        if(j == 3)
            break;
    }

    col = vec3(0);

    // Fermat point in trilinear coordinates
    vec3 fermat_tril = vec3(1) / cos(angles - pi/6.);
    vec3 fermat_bary = fermat_tril * vec3(a, b, 1.);
    vec2 fermat_point = (fermat_bary.y * tb + fermat_bary.z * tc) / (fermat_bary.x + fermat_bary.y + fermat_bary.z);

    // Calculate the generator for snub tilings
    vec2 refppa = fermat_point - dirs[0].xy * (dot(fermat_point, dirs[0].xy) - dirs[0].z) * 2.;
    vec2 refppb = fermat_point - dirs[1].xy * (dot(fermat_point, dirs[1].xy) - dirs[1].z) * 2.;
    vec2 refppc = fermat_point - dirs[2].xy * (dot(fermat_point, dirs[2].xy) - dirs[2].z) * 2.;
    vec2 snubpoint = triangleCircumcenter(refppa, refppb, refppc);

    int poly = 0;
    float outline = 0.;

    if(wythoff_symbol.w == 0)
    {
        // Snub tiling
        if((reflcount & 1) == 0)
        {
            float sides[6];
            float linedist = 1e4;
            
            for(int i = 0; i < 3; ++i)
            {
                vec2 pp2 = snubpoint;
                vec2 dir = dirs[i].xy;
                float d = dot(pp2, dir) - dirs[i].z;             
                pp2 -= dir * d * 2.;
                for(int j = 0; j < 2;++j)
                {
                    vec2 pp3 = pp2;
                    vec2 dir2 = dirs[(1 + i + j) % 3].xy;
                    float d2 = dot(pp3, dir2) - dirs[(1 + i + j) % 3].z;             
                    pp3 -= dir2 * d2 * 2.;
                    sides[i * 2 + j] = dot(uv - snubpoint, normalize((pp3 - snubpoint).yx * vec2(1, -1)));
                    linedist = min(linedist, segment(uv, snubpoint, pp3));
                }

            }

            if(sides[0] > 0. && sides[3] < 0.)
            {
                poly = 0;
            }
            else if(sides[1] > 0. && sides[2] < 0.)
            {
                poly = 2;
            }
            else if(sides[0] < 0. && sides[5] < 0. && sides[2] > 0.)
            {
                poly = 1;
            }
            else
            {
                poly = 2;
            }

            outline = mix(outline, 1., 1. - smoothstep(0., w, linedist));
            outline = mix(outline, 1., 1. - smoothstep(0., w, length(uv - snubpoint) - vertex_dot_radius));
        }
        else
        {
            float sides[3];
            float linedist = 1e4;
            
            for(int i = 0; i < 3; ++i)
            {
                vec2 pp2 = snubpoint;
                vec2 dir = dirs[i].xy;
                float d = dot(pp2, dir) - dirs[i].z;             
                pp2 -= dir * d * 2.;

                vec2 pp3 = snubpoint;
                vec2 dir2 = dirs[(i + 1) % 3].xy;
                float d2 = dot(pp3, dir2) - dirs[(i + 1) % 3].z;             
                pp3 -= dir2 * d2 * 2.;

                sides[i] = dot(uv - pp2, normalize((pp3 - pp2).yx * vec2(1, -1)));
                linedist = min(linedist, abs(sides[i]));
            }

            if(sides[0] > 0.)
            {
                poly = 0;
            }
            else if(sides[0] < 0. && sides[1] < 0.)
            {
                poly = 2;
            }
            else
            {
                poly = 1;
            }

            outline = mix(outline, 1., 1. - smoothstep(0., w, linedist));
        }
    }
    else
    {
        vec2 pp = wythoff_symbol.w == 1 ? vec2(0) : wythoff_symbol.w == 2 ? sidecenter : incenter;

        float side[3];

        // Point classification and distance to edges
        for(int i = 0; i < 3; ++i)
        {
            side[i] = dot(uv - pp, dirs[i].yx * vec2(-1, 1));
            if(dot(uv - pp, dirs[i].xy) > 0.)
                outline = mix(outline, 1., 1. - smoothstep(0., w, abs(side[i])));
        }

        outline = mix(outline, 1., 1. - smoothstep(0., w, length(uv - pp) - vertex_dot_radius));
        poly = (side[0] > 0. && side[1] < 0.) ? 0 : (side[1] > 0. && side[2] < 0.) ? 1 : 2;
    }

    vec3 polycol = (poly == 0) ? vec3(1, .25, .25) : (poly == 1) ? vec3(.25, 1, .25) : vec3(.25, .25, 1);

    polycol *= mix(.85, 1., float(reflcount & 1));

    col = mix(polycol, vec3(.05), outline);
    
    // Dual / Laves
    // Interestingly, this is also the voronoi diagram of the vertices
    if(iMouse.z > 0.5)
    {
        float dual_outline_dist = 1e4;
        if(wythoff_symbol.w == 3)
        {
            dual_outline_dist = min(dual_outline_dist, abs(dot(uv, dirs[2].xy) - dirs[2].z));
            dual_outline_dist = min(dual_outline_dist, abs(dot(uv, dirs[1].xy) - dirs[1].z));
            dual_outline_dist = min(dual_outline_dist, abs(dot(uv, dirs[0].xy) - dirs[0].z));
        }
        else if(wythoff_symbol.w == 2)
        {
            dual_outline_dist = min(dual_outline_dist, abs(dot(uv, dirs[2].xy) - dirs[2].z));
            dual_outline_dist = min(dual_outline_dist, abs(dot(uv, dirs[0].xy) - dirs[0].z));
        }
        else if(wythoff_symbol.w == 1)
        {
            dual_outline_dist = min(dual_outline_dist, abs(dot(uv, dirs[2].xy) - dirs[2].z));
        }
        else if(wythoff_symbol.w == 0)
        {
            if((reflcount & 1) == 1)
            {
                dual_outline_dist = min(dual_outline_dist, segment(uv, fermat_point, vec2(0)));
                dual_outline_dist = min(dual_outline_dist, segment(uv, fermat_point, tb));
                dual_outline_dist = min(dual_outline_dist, segment(uv, fermat_point, tc));
            }
            else
            {
                for(int i = 0; i < 3; ++i)
                {
                    vec2 uv2 = uv;
                    vec2 dir = dirs[i].xy;
                    float d = dot(uv2, dir) - dirs[i].z;             
                    uv2 -= dir * d * 2.;
                    dual_outline_dist = min(dual_outline_dist, segment(uv2, fermat_point, vec2(0)));
                    dual_outline_dist = min(dual_outline_dist, segment(uv2, fermat_point, tb));
                    dual_outline_dist = min(dual_outline_dist, segment(uv2, fermat_point, tc));
                }
            }
        }
        col = mix(col / 2., vec3(.9), 1. - smoothstep(0., w, dual_outline_dist));
    }
	
    
    fragColor = vec4(pow(clamp(col, 0., 1.), vec3(1. / 2.2)), 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '3tyXWw';
  }
  name(): string {
    return 'Wythoff Uniform Tilings +Duals';
  }
  sort() {
    return 548;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
