import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define R(p,a,r)mix(a*dot(p,a),p,cos(r))+sin(r)*cross(p,a)
void mainImage(out vec4 O, vec2 C)
{
    O=vec4(0,0,0,1);
    vec3 q=vec3(3,3,.0);
    vec3 p=iResolution;
    vec3 r=iResolution;
    vec3 d=normalize(vec3((C-.5*r.xy)/r.y,1));
    float s = 0.;
    float e = 0.;
    float g = .3;  
    for(float i=0.;i<99.;++i)
    {
        O.xyz+=cos(vec3(7,6,9)/log(s*.2))*.02;
        p=g*d-vec3(.4,.1,.8);
        p=R(p,normalize(vec3(1,2,3)),-iTime*.1);
        s=2.;
        for(int i=0;i<7;i++) {
          p=q-abs(p-q*.4);
          s*=e=15./min(dot(p,p),15.);
          p=abs(p)*e-2.;
        }
        g+=min(10.,length(p.xz)-.5)/s;
    }
    O.xyz=pow(O.xyz,vec3(1.5,3.6,.2));
}
`;

export default class implements iSub {
  key(): string {
    return 'fdfGR8';
  }
  name(): string {
    return 'Fractal 38_gaz';
  }
  sort() {
    return 29;
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
