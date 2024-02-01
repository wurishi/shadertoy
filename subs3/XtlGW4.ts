import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 f, in vec2 p ){
    
  vec3 q=iResolution,d=vec3(p-.5*q.xy,q.y)/q.y,c=vec3(0,.5,.7);
  
  q=d/(.1-d.y);
  float a=iTime, k=sin(.2*a), w = q.x *= q.x-=.05*k*k*k*q.z*q.z;

  f.xyz=d.y>.04?c:
    sin(4.*q.z+40.*a)>0.?
      w>2.?c.xyx:w>1.2?d.zzz:c.yyy:
    w>2.?c.xzx:w>1.2?c.yxx*2.:(w>.004?c:d).zzz;
  
  f.w = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'XtlGW4';
  }
  name(): string {
    return '[2TC 15] old skool 3d driving';
  }
  sort() {
    return 381;
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
