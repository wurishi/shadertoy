
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec2 hash(vec2 p){
    p = vec2( dot(p,vec2(137.1,373.7)), dot(p,vec2(269.5,183.7)) ); 
    return fract(sin(p)*43758.37); 
}

float worley(vec2 p){
    vec2 n = floor(p);
    vec2 f = fract(p);
    float r = 1.;
    for(int i=-2;i<=2;i++){
    for(int j=-2;j<=2;j++){
        vec2 o = hash(n+vec2(i,j));
        o = sin(iTime/2. + hash(n+vec2(i,j))*6.28)*0.5+0.5;//animate
        o += vec2(i,j);
        float D1 = distance(o,f);//Euclidean
        r = min(r,D1);
    }
    }
    return r;
}

float logo(vec2 uv);
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (2.*fragCoord-iResolution.xy)/iResolution.y;

    float c = worley(uv + vec2(0.,-iTime))*0.5;
    c += worley(uv*2.+vec2(sin(iTime*2.)*0.5,-iTime*6.))*0.5;//2 Layers worley
    c += (-uv.y-0.3)*0.6;//y mask
    
    vec2 p = uv;
    p.x *=1.5+smoothstep(-0.3,1.,uv.y)*1.5;
    float m = smoothstep(1.,.5,length(p));//circle mask
    
    float c0 = smoothstep(.4,.6,m*c*3.);//out fire
    float c1 = smoothstep(.5,.52,m*c*2.);//mid fire
    float c2 = smoothstep(.5,.52,m*c*1.2*(-uv.y+0.3));//inner fire
    float c3 = pow(worley(uv*6.+vec2(sin(iTime*4.)*1.,-iTime*16.)),8.);
          c3 = smoothstep(.98,1.,c3)*m;//sparkle

    vec3 col = vec3(1.,.4,.2)*c3;//sparkle
    col = mix(col,vec3(.95,.1,.2)*(uv.y+.8),c0);//out
    col = mix(col,mix(vec3(.9,.3,.2),vec3(.9,.6,.2),-uv.y),c1);//mid
    col = mix(col,vec3(.9,.8,.2),c2);//inner

    col +=logo(uv);

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
    return 'NdjyWV';
  }
  name(): string {
    return 'odos|toon fire';
  }
  sort() {
    return 783;
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
