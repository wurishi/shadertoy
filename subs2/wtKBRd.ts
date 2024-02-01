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
    for(float i=1.,g=0.,e,s;
        ++i<99.;
        O.rgb+=mix(vec3(1),H(log(s)/5.),.5)*pow(cos(i*i/64.),2.)/e/2e4
    )
    {
        p=g*d-vec3(0,-.25,1.3);
        p=R(p,normalize(vec3(1,8,0)),iTime*.1);
        s=3.;
        for(int i=0;
            i++<4;
            p=vec3(2,4,2)-abs(abs(p)*e-vec3(3,5,1))
        )
            s*=e=1./clamp(dot(p,p),.1,.6);
        g+=e=min(length(p.xz)-.02,abs(p.y))/s+.001;
     }
}
`;

// for(float i=0.,g=0.,e,s,t;
//   ++i<99.;t=cos(i*i/64.),
//   O.rgb+=mix(vec3(1),H(log(s)/5.),.5)*(t*t*t*t*t*t*t*t)/e/2e4
// )

export default class implements iSub {
  key(): string {
    return 'wtKBRd';
  }
  name(): string {
    return 'Fractal 35_gaz';
  }
  sort() {
    return 202;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return ['fractal'];
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
