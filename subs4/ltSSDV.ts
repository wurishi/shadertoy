import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define _t iTime/10.

vec2 itere (vec2 uv)
{
    for (int i=0; i<8; i++)
    {
    	uv+=vec2(cos(uv.y*3.+_t),-sin(uv.x*3.))/3.;
        uv+=vec2(cos(_t+uv.y),sin(_t+uv.x))*0.5;
        uv*=1.3;
    }
    
    return uv;
}
float color (vec2 uv)
{
     uv = itere (uv);
     float sc = 2.;
     uv = mod(uv,sc)-sc/2.;
     return length(uv);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = (fragCoord.xy / iResolution.xy - 0.5)*8.;
    float c = color(uv);
    float cx = color (uv+vec2(0.01,0.))-c;
    float cy = color (uv+vec2(0.,0.01))-c;
	fragColor = normalize((vec4(cx,sqrt(abs(cx*cy)),cy,c/2.)));
  fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'ltSSDV';
  }
  name(): string {
    return 'plop';
  }
  sort() {
    return 455;
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
