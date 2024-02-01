import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec4 color = texture(iChannel0,vec2(uv.x,-uv.y+0.5*sin(iTime+uv.x*4.0)));
	float lum = 0.5*sin(iTime+uv.x*4.0) + 1.0 - sqrt(uv.y*.25);
	
	fragColor = color*lum;
}
`;

export default class implements iSub {
  key(): string {
    return 'lsj3Dw';
  }
  name(): string {
    return 'The wave';
  }
  sort() {
    return 429;
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
    return [webglUtils.WOOD_TEXTURE];
  }
}
