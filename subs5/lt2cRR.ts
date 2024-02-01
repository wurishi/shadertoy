import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

void mainImage(out vec4 O, vec2 U) {
  O += mod( U [ int( 1e4*length(ceil(U/8.)) ) % 2 ] , 8. ); 
  O.a = 1.;
} /*
   

     
 
       
       
/**   // 70 chars

#define mainImage( O, U )   \
   O += mod( U [ sin(1e5*length(ceil(U/8.))) < 0.  ? 0 : 1 ] , 8. )
       
/**/
`;

export default class implements iSub {
  key(): string {
    return 'lt2cRR';
  }
  name(): string {
    return 'shortest maze 5 (65 chars)';
  }
  sort() {
    return 577;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
