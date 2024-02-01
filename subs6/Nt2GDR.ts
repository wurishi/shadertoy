import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage(out vec4 O, vec2 I)   
{
	O = vec4(I+=iTime/.01,-I)/32.; vec4 i;
	O -= i = floor(O);
    O += dot(O*O.yzwx, fract(sin(vec4(93,92,0,1) + i.x+92.*i.y)*7e4) )-O;
  O.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'Nt2GDR';
  }
  name(): string {
    return 'Value Noise in 147 chars';
  }
  sort() {
    return 642;
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
