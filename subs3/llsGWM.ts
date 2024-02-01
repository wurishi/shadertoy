import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define X c += texture(iChannel0, p*.1 - t*.002); p *= .4; c *= .7;

void mainImage( out vec4 f, in vec2 w ) {
	vec2 p = iResolution.xy;
	float d = length(p = (w.xy*2.-p) / p.y), t = iDate.w;
    vec4 b = vec4(.8,.4,.2,1)+p.y, c = b+b;
    p = p * asin(d) / d + 5.;    
    p = p * p.y + t;
    X X X X X
	f = (c.g+(b-c.g)*c.r) * (1.5-d*d);
  f.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'llsGWM';
  }
  name(): string {
    return '[2TC 15] Venus';
  }
  sort() {
    return 383;
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
    return [{ ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
