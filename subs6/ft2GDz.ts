import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.14159265359
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv=fragCoord/iResolution.xy;
    vec3 color=vec3(0.);
        
    vec2 l1=vec2(0.);
    l1.x=step(0.1,uv.x)-step(0.11,uv.x);
    l1.y=step(0.,uv.y);
    
    
    vec2 l2=vec2(0.);
    l2.x=step(0.89,uv.x)-step(0.9,uv.x);
    l2.y=step(0.,uv.y);
    
    vec2 l3=vec2(0.);
    l3.x=step(0.,uv.x);
    l3.y=step(0.79,uv.y)-step(0.8,uv.y);
    
    vec2 l4=vec2(0.);
    l4.x=step(0.,uv.x);
    l4.y=step(0.89,uv.y)-step(0.9,uv.y);
    
    vec2 l5=vec2(0.);
    l5.x=step(0.95,uv.x)-step(0.96,uv.x);
    l5.y=step(0.,uv.y);
    
    vec2 l6=vec2(0.);
    l6.x=step(0.05,uv.x)-step(0.06,uv.x);
    l6.y=step(0.8,uv.y);
    
    vec2 lt=vec2(0.);
    lt.x=step(0.9,1.-uv.x)-l6.x;
    lt.y=step(0.8,uv.y)-l4.y;
    
    vec2 rd=vec2(0.);
    rd.x=step(0.9,uv.x)-l5.x;
    rd.y=step(0.95,1.-uv.y);
    
    vec2 rt=vec2(0.);
    rt.x=step(0.975,uv.x);
    rt.y=step(0.8,uv.y)-l4.y;
    
    vec3 red=vec3(0.8039,0.102,0.102);
    vec3 green=vec3(0.4118,0.3490,0.8039);
    vec3 yellow=vec3(1.,1.7255,0.0588);
    vec3 white=vec3(0.9922,0.9608,0.9020);
    vec3 black=vec3(0.,0.,0.);
    
    
    
    float pct=lt.x*lt.y+rd.x*rd.y+rt.x*rt.y+l1.x*l1.y+l2.x*l2.y+l3.x*l3.y+l4.x*l4.y+l5.x*l5.y+l6.x*l6.y;
    pct=step(1.0,1.-pct);
    
    color=lt.x*lt.y*red+rd.x*rd.y*green+rt.x*rt.y*yellow+pct*white+l1.x*l1.y*black+l2.x*l2.y*black+l3.x*l3.y*black+l4.x*l4.y*black+l5.x*l5.y*black+l6.x*l6.y*black;
    
    fragColor=vec4(color,1.); 
}
`;

export default class implements iSub {
  key(): string {
    return 'ft2GDz';
  }
  name(): string {
    return "oushinnyo's first shader";
  }
  sort() {
    return 639;
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
