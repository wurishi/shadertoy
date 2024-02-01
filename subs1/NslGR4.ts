import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// to test that code correct
//#define is_TRUE true
//#define is_ZER0 0.

#define is_TRUE (iTime > -1.)
#define is_ZER0 min(iTime, 0.)

// RESULT:
// BUG - white screen color
// NO BUG - purple screen color

// other version smaller code size, may not work for some videocards 
// Ndl3zr

// Bug does not work same on every videocard, some part of code can be removed depends of videocard

// length(rd) alway * is_ZER0
// ro unused
// and magic function magic_mat3


// this magic mat3 needed to trigger bug (but can be removed in OpenGL or some GPUs)
mat3 magic_mat3()
{
    return mat3(vec3(is_ZER0, is_ZER0, 0.0), vec3(is_ZER0, is_ZER0, 0.0), vec3(1.0));
}

vec4 bug(in vec3 ro, in vec3 rd)
{
    vec3 col = vec3(0.);


    vec4[3] colx = vec4[3](vec4(0.), vec4(0.), vec4(0.));
    int[3] order = int[3](0, 1, 2);

    for (int i = 0; i < 3; i++)
    {
        // removing any of this lines (ro unused in this code) make bug not work (depends of GPU)
        if (length(rd) * is_ZER0 > 1.) // this false
        {
            ro *= magic_mat3();
            rd *= magic_mat3();
        }

        float tnew = 1. + length(rd) * is_ZER0;

        {
            if (tnew > 0.)
            {
                vec4 tcol = vec4(0.);
                tcol = vec4(0., 1., 0., 1.);

                if (tcol.a > 0.0)
                {

                    colx[i] = tcol;
                    colx[i].rgb = vec3(1., 0., 1.);
                }
            }
        }
    }
    return vec4(colx[order[0 + int(is_ZER0)]]);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;

    vec3 rd = vec3(uv, 1.);
    vec3 ro = vec3(1.);

    fragColor = vec4(0.);

    if (is_TRUE)
    {

        vec4[2] colo = vec4[2](vec4(0.), vec4(0.));

        for (int j = 0; j < 2; j++)
        {
            {
                vec4 tcol = bug(ro, rd);
                if (is_TRUE)
                {
                    colo[j] = tcol;
                }
            }
        }

        // this does work in OpenGL and Vulkan
        vec3 col = colo[0].rgb + colo[1].rgb * is_ZER0;
        
        // in Vulkan it also result bug color, when in OpenGL its not
        //vec3 col = colo[0].rgb;

        fragColor = vec4(col, 1.);
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'NslGR4';
  }
  name(): string {
    return 'BUG Nvidia const to array';
  }
  sort() {
    return 108;
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
}
