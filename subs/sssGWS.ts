import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define R(p,a,r)mix(a*dot(p,a),p,cos(r))+sin(r)*cross(p,a)
void mainImage(out vec4 O, vec2 C)
{
    O=vec4(0,0,0,1);
    vec3 p,q,r=iResolution,
    d=normalize(vec3((C-.5*r.xy)/r.y,1));  
    for(float i=0.,s,e,g=0.;
        ++i<80.;
        O.xyz+=.02*abs(cos(d+log(s)*.3))*exp(-.5*i*i*e)
    )
    {
        p=g*d;
        p.z-=.7;
        p=R(p,normalize(vec3(1,2,3)),iTime*.2);
        q=p;
        s=1.5;
        for(int j=0;j++<15;s*=e)
            p=sign(p)*(1.2-abs(p-1.2)),
            p=p*(e=8./clamp(dot(p,p),.3,5.5))+q*2.;
        g+=e=length(p)/s;
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'sssGWS';
  }
  name(): string {
    return 'Fractal 43_gaz';
  }
  sort() {
    return 97;
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
}
