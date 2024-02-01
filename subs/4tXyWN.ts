import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
float hash( uvec2 x )
{
    uvec2 q = 1103515245U * ( (x>>1U) ^ (x.yx   ) );
    uint  n = 1103515245U * ( (q.x  ) ^ (q.y>>3U) );
    return float(n) * (1.0/float(0xffffffffU));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    uvec2 p = uvec2(fragCoord) + 1920U*1080U*uint(iFrame);
    
    float f = hash(p);
    
    fragColor = vec4( f, f, f, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4tXyWN';
  }
  name(): string {
    return 'Integer Hash - III';
  }
  sort() {
    return 68;
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
