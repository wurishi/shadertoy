import { GUI } from 'dat.gui';
import { createCanvas, iSub } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_flag;

float hash(vec2 xy) {
  xy = mod(xy, 0.19) + 0.5;
  float h = dot(xy.yyx, xy.yxy + vec3(0.13, 27.15, 2027.3));
  h *= h;
  return fract(h);
}

float hash3(vec2 xy) {
  xy = mod(xy, .19);
  float h = dot(xy.yyx, xy.yxy + vec3(.013, 27.15, 2027.3));
  h *= h;
  h *= fract(h);

  return fract(h);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  if (u_flag) {
    fragColor = vec4(vec3(hash3(uv + iTime)), 1.0);
  } else {
    fragColor = vec4(vec3(hash(uv + iTime)), 1.0);
  }
}
`;

let gui: GUI;
const api = {
  useHash3: true,
};

export default class implements iSub {
  key(): string {
    return 'WlyBRd';
  }
  sort() {
    return 3;
  }
  name(): string {
    return 'Trig-less Hash';
  }
  tags?(): string[] {
    return ['noise', 'hash', 'sinless'];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'useHash3');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  initial(gl: WebGLRenderingContext, program: WebGLProgram) {
    const u_flag = webglUtils.getUniformLocation(gl, program, 'u_flag');

    return () => {
      u_flag.uniform1f(api.useHash3 ? 1 : 0);
    };
  }
  destory(): void {
    gui && gui.destroy();
    gui = null;
  }
}
