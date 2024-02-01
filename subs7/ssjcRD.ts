import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float checkerboard(vec2 coord, float size){
    vec2 pos = floor(coord/size); 
    return mod(pos.x+pos.y,2.0);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord += iTime*50.0;
    float size = 30.;
    float c = checkerboard(fragCoord,size);
    fragColor = vec4(c,c,c,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'ssjcRD';
  }
  name(): string {
    return 'a basic checkerboard';
  }
  sort() {
    return 776;
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
