
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec3 hcl2rgb(float H, float C, float L) {
  // https://en.wikipedia.org/wiki/HSL_and_HSV#From_luma/chroma/hue
  float hPrime = H / 60.0;
  float X = C * (1.0 - abs(mod(hPrime, 2.0) - 1.0));
  vec3 rgb = (
      hPrime < 1.0 ? vec3(C, X, 0) :
      hPrime < 2.0 ? vec3(X, C, 0) :
      hPrime < 3.0 ? vec3(0, C, X) :
      hPrime < 4.0 ? vec3(0, X, C) :
      hPrime < 5.0 ? vec3(X, 0, C) :
      vec3(C, 0, X)
  );
  
  float m = L - dot(vec3(0.3, 0.59, 0.11), rgb);
  return rgb + vec3(m, m, m);
}

float triangle(float x) {
  return 2.0 * abs(fract(x) - 0.5) - 1.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  float bands = 80.0;
  float ratio = floor(bands * fragCoord.x / iResolution.x) / bands;
  float x = triangle(30.0 * ratio);
  float H = 360.0 * (0.9 * ratio);
  float C = 0.25 + 0.2 * x;
  float L = 0.80 - 0.15 * x;
fragColor = vec4( hcl2rgb(H, C, L), 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MtjBWR';
  }
  name(): string {
    return 'HCL Color Range';
  }
  sort() {
    return 17;
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
