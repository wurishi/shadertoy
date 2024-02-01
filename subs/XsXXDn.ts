import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 c;
  float l, z = iTime;
  for(int i=0;i<3;i++) {
    vec2 uv, p = fragCoord.xy / iResolution.xy;
    uv = p;
    p -= 0.5;
    p.x *= iResolution.x / iResolution.y;
    z += 0.07;
    l = length(p);
    uv += p / l * (sin(z) + 1.0) * abs(sin(l*9.0-z*2.0));
    c[i] = 0.01 / length(abs(mod(uv, 1.0) - 0.5));
  }
  fragColor = vec4(c/l, iTime);
}
`;

export default class implements iSub {
  key(): string {
    return 'XsXXDn';
  }
  sort() {
    return 4;
  }
  name(): string {
    return 'Creation by Silexars';
  }
  tags?(): string[] {
    return ['intro', 'silexars', '1k', 'demojs'];
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
