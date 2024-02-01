import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define R(p,a,r)mix(a*dot(p,a),p,cos(r))+sin(r)*cross(p,a)
void mainImage(out vec4 O, vec2 C)
{
    O=vec4(0,0,0,1);
    vec3 q=vec3(2.6,2.8,2.1)+
           vec3(cos(iTime*.6+.5*cos(iTime*.3))*.3,sin(iTime*.5)*.1,sin(iTime*1.2)*.2),
    p,r=iResolution,
    d=normalize(vec3((C-.5*r.xy)/r.y,1));  
    for(float i=1.,s,e,g=0.;
        ++i<80.;
        O.xyz+=cos(vec3(9,3,4)+log(s))*5./dot(p,p)/i
    )
    {
        p=g*d-vec3(0,-.6,2.2);
        p=R(p,normalize(vec3(1,8,0)),-iTime*.15);
        s=2.;
        s*=e=6./dot(p,p);
        p*=e;
        for(int i=0;i++<2;)
        {
            p=q-abs(p-q);
            s*=e=9./min(dot(p,p),6.);
            p=abs(p)*e;
        }
        g+=e=min(length(p.xz)-.2,p.y)/s;
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'sss3R8';
  }
  name(): string {
    return 'Fractal 39_gaz';
  }
  sort() {
    return 52;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    const canvas = createCanvas();
    canvas.style.backgroundColor = 'black';
    return canvas;
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
