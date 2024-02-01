import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord.xy / iResolution.xy;
  vec4 color;
  vec2 mouse = iMouse.xy / iResolution.xy;
  if(uv.x > mouse.x) {
    color = texture2D(iChannel1, uv);
  }
  else {
    color = texture2D(iChannel0, uv);
  }
  color.a *= smoothstep(0.,0.005,abs(uv.x - mouse.x));
  fragColor = color;
}
`;

export default class implements iSub {
  key(): string {
    return '';
  }
  name(): string {
    return '2pic';
  }
  sort() {
    return 143;
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
    return [webglUtils.ROCK_TEXTURE, webglUtils.WOOD_TEXTURE];
  }
}
