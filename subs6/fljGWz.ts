import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float hash1(uint i){
  i*=0x456789abu;
  i^=i<<16;
  return float(i*0x1b74a659u)/4294967295.;
}

float hash(uvec2 i){
  i*=uvec2(0x456789ab,0x1b74a659);
i.x^=i.y;
  return float(i.x*0x46d5c422u)/4294967295.;
}

void mainImage(out vec4 o,vec2 p){
  o+=hash(uvec2(p));
  o.a = 1.;
  //o+=hash1(uint(p.x*iResolution.x+p.y));
}
`;

export default class implements iSub {
  key(): string {
    return 'fljGWz';
  }
  name(): string {
    return 'smol hash';
  }
  sort() {
    return 641;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
