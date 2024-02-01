import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

float w(vec3 p,float r)
{
float a=atan(p.x,p.z)+r;
float o=pow(abs(sin(12.*a)),.1)*sign(sin(12.*a))*.15+1.;
return length(p.xz)+(p.y*.75)*(o*.5);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
float time_ = iTime/100.;
vec3 o=vec3(fragCoord.xy/iResolution.xy-vec2(.5),1.);
o.x*=1.777;
float v=time_*3.14159*6.;
vec3 p=vec3(sin(v)*5.,1.5,cos(v)*5.);
vec3 d=normalize(vec3(o.x*cos(v)+o.z*sin(v),o.y+.3,-o.x*sin(v)+o.z*cos(v))-p);
vec3 op=p;
if(abs(o.x)<1.)
fragColor=vec4(0.,0.,0.,1.); 
for(int i=0;i<120;++i)
{
float g=1000000.;
float ra=time_*3.14159*30.;
vec3 qz=vec3(p.x*0.7071+p.y*0.7071,p.y*0.7071-p.x*0.7071,p.z);
vec3 qy=vec3(p.x*0.7071+p.z*0.7071,p.y,p.z*0.7071-p.x*0.7071);
vec3 qx=vec3(p.x,p.y*0.7071+p.z*0.7071,p.z*0.7071-p.y*0.7071);
float rb=ra+.2618;
g=min(g,w(p,rb));
g=min(g,w(-p,-ra));
g=min(g,w(-p.yzx,-ra));
g=min(g,w(p.zxy,rb));
g=min(g,w(-p.zxy,-ra));
g=min(g,w(qz,-rb));
g=min(g,w(-qz,ra));
g=min(g,w(-qy.yzx,ra));
g=min(g,w(-qx.zyx,-rb));
g=min(g,w(qz.yxz,ra));
g=min(g,w(-qz.yxz,-rb));
g=min(g,w(-qy.yxz,-rb));
g=min(g,w(-qx.yzx,ra));
g=min(g,w(p.yzx,rb));
g=min(g,w(qy.yzx,-rb));
g=min(g,w(qx.zyx,ra));
g=min(g,w(qy.yxz,ra));
g=min(g,w(qx.yzx,-rb));
g=max(g,length(p)-.5);
g=max(g,.45-length(p));
if(g<.001)
{
fragColor = vec4(1.-float(i)/200.)*(dot(normalize(p),normalize(op))*.4+.6)*vec4(.9,.6,.0,1.);
break;
}
p+=d*.3*g;
if(distance(p,op)>6.)break;
}
}

`;

export default class implements iSub {
  key(): string {
    return 'XlVcWz';
  }
  name(): string {
    return 'contraption';
  }
  sort() {
    return 569;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas({ width: '500px' });
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
