import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

#define is_TRUE (iTime > -1.)

// RESULT:
// BUG - white screen color
// NO BUG - purple screen color


vec4 bug_opengl()
{

    // BUG ruin this const (1., 0., 1.) if you set it to (0., 1., .1) bug result will be yellow color
    const vec3 test = vec3(1., 0., 1.);

    // fix (OpenGL only)
    // vec3 test=vec3(1., 0., 1.)+min(iTime,0.);

    vec4[2] colx = vec4[2](vec4(0.), vec4(0.)); // works only with array
    int idx = 0;
    
    //everything else used to trigger bug
    
    if (is_TRUE)
    {
        colx[0] = vec4(test, 1.);
        idx = 0; // removing this make bug not work
    }

    float a = 1.;

    if (is_TRUE)
        a = 1.;
    else
    {
        if (is_TRUE)
            a = colx[idx].a; // BUG colx[idx].a
        else
            a = 1.;
    }

    vec3 col = colx[0].rgb;
    return vec4(col, a);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec4 color = vec4(0.);
    vec4 colt = bug_opengl();
    if (is_TRUE)
    {
        color = colt;
    }

    vec3 col = color.rgb * color.a; // without * color.a it return valid value

    fragColor = vec4(col, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'Ndl3zr';
  }
  name(): string {
    return 'BUG Nvidia const to array min';
  }
  sort() {
    return 192;
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
