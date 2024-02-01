import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define R(p,a,r)mix(a*dot(p,a),p,cos(r))+sin(r)*cross(p,a)
#define H(h)(cos((h)*6.3+vec3(0,23,21))*.5+.5)
void mainImage(out vec4 O, vec2 C)
{
    O=vec4(0,0,0,1);
    vec3 p,r=iResolution,
    d=normalize(vec3((C-.5*r.xy)/r.y,1));  
    for(float i=0.,s,e,g=0.;
        ++i<70.;
        O.xyz+=mix(vec3(1),H(log(s)*.3),.6)*.03*exp(-.2*i*i*e)
    )
    {
        p=g*d-vec3(0,0,1.5);
        p=R(p.zxy,normalize(vec3(1,0,10)),iTime*.3);
        s=2.;
        for(int i;i++<6;)
            p=abs(p-vec3(1,2.8,1.5+sin(iTime*.5)*.2))-vec3(1,3.+sin(iTime*.7)*.3,2.1),
            p*=(fract(iTime*.1)>.5)?-1.:1.,
            s*=e=7./clamp(dot(p,p),1.2,7.),
            p*=e;
        g+=e=min(abs(p.z),length(p.xy)-.05)/s+1e-3;
    }
}
`;

export default class implements iSub {
  key(): string {
    return '7sB3Dy';
  }
  name(): string {
    return 'Fractal 51_gaz';
  }
  sort() {
    return 211;
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
