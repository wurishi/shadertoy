import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 u = 8.*fragCoord/iResolution.x;
    
    vec2 s = vec2(1.,1.732);
    vec2 a = mod(u     ,s)*2.-s;
    vec2 b = mod(u+s*.5,s)*2.-s;
    
	fragColor = vec4(.5*min(dot(a,a),dot(b,b)));
  fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'MlXyDl';
  }
  name(): string {
    return 'simple hexagonal tiles';
  }
  sort() {
    return 550;
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
