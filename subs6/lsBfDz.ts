import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define T texture(iChannel0,(s*p.zw+ceil(s*p.x))/2e2).y/(s+=s)*4.
void mainImage(out vec4 O,vec2 x){
    vec4 p,d=vec4(.8,0,x/iResolution.y-.8),c=vec4(.6,.7,d);
    O=c-d.w;
    for(float f,s,t=2e2+sin(dot(x,x));--t>0.;p=.05*t*d)
        p.xz+=iTime,
        s=2.,
        f=p.w+1.-T-T-T-T,
    	f<0.?O+=(O-1.-f*c.zyxw)*f*.4:O;
    O.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'lsBfDz';
  }
  name(): string {
    return '[SH17A] Tiny Clouds';
  }
  sort() {
    return 617;
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
  channels() {
    return [
      {
        ...webglUtils.DEFAULT_NOISE,
        ...webglUtils.TEXTURE_LINEAR,
        ...webglUtils.NO_FLIP_Y,
      },
    ];
  }
}
