import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define F +texture(iChannel0,.3+p.xz*s/3e3)/(s+=s) 

void mainImage( out vec4 c, vec2 w )
{
    vec4 p=vec4(w/iResolution.xy,1,1)-.5,d=p,t;
    p.z += iTime*20.;d.y-=.4;
    
    for(float i=1.5;i>0.;i-=.002)
    {
        float s=.5;
        t = F F F F F F;
        c =1.+d.x-t*i; c.z-=.1;
        if(t.x>p.y*.007+1.3)break;
        p += d;
    }
    c.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'llsGW7';
  }
  name(): string {
    return '[2TC 15] Mystery Mountains';
  }
  sort() {
    return 293;
  }
  webgl() {
    return WEBGL_2;
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
    return [
      webglUtils.TEXTURE12, //
    ];
  }
}
