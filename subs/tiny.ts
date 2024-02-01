import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float color = 0.0;

  color += sin(uv.x * cos(iTime / 3.0) * 60.0) + cos(uv.y * cos(iTime / 2.80) * 10.0);
  color += sin(uv.y * sin(iTime / 2.0) * 40.0) + cos(uv.x * sin(iTime / 1.70) * 40.0);
  color += sin(uv.x * sin(iTime / 1.0) * 10.0) + sin(uv.y * sin(iTime / 3.50) * 80.0);
  color *= sin(iTime / 10.0) * 0.5;

  fragColor = vec4(vec3(color * 0.5, sin(color + iTime / 2.5) * 0.75, color), 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '';
  }
  name(): string {
    return 'tiny';
  }
  sort() {
    return 5;
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
