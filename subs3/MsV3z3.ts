import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float hash(in ivec2 c)
{
  int x = 0x3504f333*c.x*c.x + c.y;
  int y = 0xf1bbcdcb*c.y*c.y + c.x;
    
  return float(x*y)*(2.0/8589934592.0)+0.5;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2  p = fragCoord.xy ;
  float r = hash(ivec2(p)+2*iFrame);
  vec4  c = vec4(vec3(r),1.0);
    
  fragColor = c;
}
`;

export default class implements iSub {
  key(): string {
    return 'MsV3z3';
  }
  name(): string {
    return '2D Weyl hash #1 (integer)';
  }
  sort() {
    return 398;
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
