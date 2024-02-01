import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 f, in vec2 w ) {
  vec4 p = vec4(w,0.,1.)/iResolution.xyxy-.5, d=p, t, c;
  p.z += iTime;
  for(float i=1.; i>0.; i-=.01)
  {
      t = abs(mod(p, 8.)-4.);
      // c = texture(iChannel0, t.zxy-3.);
      c = texture(iChannel0, t.zx-3.);
      float x = min(t.y, length(t.xz)-1.5+c.x);
      f = mix(c*i*i, vec4(1,.5,2,0), p.w*.01);
      if(x<.01) break;
      p -= d*x;
   }
}
`;

export default class implements iSub {
  key(): string {
    return '4tfGRB';
  }
  name(): string {
    return '[2TC 15] Hall of kings';
  }
  sort() {
    return 384;
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
  channels() {
    return [webglUtils.ROCK_TEXTURE];
  }
}
