import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 f, in vec2 w ){
    vec4 o = gl_FragCoord/iResolution.xyxx-.5, d=o, r, z=d-d;
    float t = iTime, c;
    o.xz += t;
    for(int i=0;i<99;i++)
    	c= dot( (r = cos(o + o.w*sin(t*.9)*.1)).xyz, r.xyz),
    	o -= d* dot( (r = cos(r/c*7.)).zy, r.zy ) *c*.2,
    	z += abs(sin(vec4(9,0,1,1)+(o.y + t + o.w)))*.12*c/(o.w*o.w+ 6.5);
    f = z*z*z;
    f.a = 1.;
}

`;

export default class implements iSub {
  key(): string {
    return 'llXGzB';
  }
  name(): string {
    return '[2TC 15]Judging Begins';
  }
  sort() {
    return 333;
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
