import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 O,  vec2 U ) {
    float t = iTime/10.;
    U = 8.* U / iResolution.xy - 4.;
    O -= O;
    
    for (int i=0; i<8; i++)
    	U += cos( U.yx *3. + vec2(t,1.6)) / 3.,
        U += sin( U.yx + t + vec2(1.6,0)) / 2.,
        U *= 1.3;
    
	//o += length(mod(U,2.)-1.);  // black & white
	O.xy += abs(mod(U,2.)-1.); // color
  O.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'MlSSDV';
  }
  name(): string {
    return 'plop 2';
  }
  sort() {
    return 456;
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
