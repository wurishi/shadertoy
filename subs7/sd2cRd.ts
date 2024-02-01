import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.1415926
//original version:https://www.shadertoy.com/view/MtSXW1
//with aa: https://www.shadertoy.com/view/4tBXRy


float logo(vec2);

//http://iquilezles.org/www/articles/palettes/palettes.htm
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (2.*fragCoord-iResolution.xy)/iResolution.y;
    float a =atan(uv.y,uv.x);//angle -Pi~Pi
    float w = 1.5;//width 
    float r = length(uv/w);    
    
    vec4 m = vec4(fract(vec3(0,1,2)/3.+ a/2./PI + r - iTime/8. ),0);
    m.w = m.x; //w records min(x,y,z)
    m.x=0.;//x records which pieces does this pix belong to
    if(m.y < m.w){m.w = m.y; m.x = .33;}
    if(m.z < m.w){m.w = m.z; m.x = .67;}
    m.w = min(m.w, m.w*(1. - m.w)*iResolution.y*w/(1. + .16/r));//AA

    
    
    vec3 col = m.w*
          pal( r/3.+ m.x +iTime/12., 
                  vec3(0.9,0.7,0.4),
                  vec3(0.8,0.2,0.9),
                  vec3(1.0,1.0,1.0),
                  vec3(0.0,0.3,0.6) );
          
    col = clamp(col,0.,1.);
    col += logo(uv);

    // Output to screen
    fragColor = vec4(col,1.0);

}

float logo(vec2 uv){
    uv *= 1.5;uv.x+=0.6;
    float n = 0.;
    //r = .18  width = .14
    n += smoothstep(.11,.115,length(uv-vec2(-1.4,0.)))*smoothstep(.255,.25,length(uv-vec2(-1.4,0.)));//O
    n += smoothstep(.11,.115,length(uv-vec2(-.91,0.)))*smoothstep(.255,.25,length(uv-vec2(-.91,0.)))
         *smoothstep(-.915,-.91,uv.x);//d
    n += smoothstep(-1.085,-1.08,uv.x)*smoothstep(-0.94,-0.945,uv.x)
         *smoothstep(.255,.25,abs(uv.y));//d
    n += smoothstep(-.945,-.94,uv.x)*smoothstep(-0.91,-0.915,uv.x)
         *smoothstep(.11,.115,abs(uv.y))*smoothstep(.255,.25,abs(uv.y));//d
    n += smoothstep(.11,.115,length(uv-vec2(-.35,0.)))*smoothstep(.255,.25,length(uv-vec2(-.35,0.)));//O
    if(uv.x<0.16||uv.y>0.06)
        n += smoothstep(.060,.065,length(uv-vec2(.16,.06)))*smoothstep(.195,.19,length(uv-vec2(.16,0.06)));//s
    if(uv.x>0.16||uv.y<-0.06)
        n += smoothstep(.060,.065,length(uv-vec2(.16,-0.06)))*smoothstep(.195,.19,length(uv-vec2(.16,-0.06)));//s
    return n;
}

`;

export default class implements iSub {
  key(): string {
    return 'sd2cRd';
  }
  name(): string {
    return 'odos | spiral';
  }
  sort() {
    return 781;
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
