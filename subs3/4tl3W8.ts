import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 f, in vec2 w ){
    vec4 p = vec4(w,0.,1.)/iResolution.y - vec4(.9,.5,0,0), c=p-p;
	float t=iTime,r=length(p.xy+=sin(t+sin(t*.8))*.4),a=atan(p.y,p.x);
	for (float i = 0.;i<60.;i++)
        c = c*.98 + (sin(i+vec4(5,3,2,1))*.5+.5)*smoothstep(.99, 1., sin(log(r+i*.05)-t-i+sin(a +=t*.01)));
    f = c*r;
}
`;

export default class implements iSub {
  key(): string {
    return '4tl3W8';
  }
  name(): string {
    return '[2TC 15]2 Tweets Challenge';
  }
  sort() {
    return 320;
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
