
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//refers to inigo quilez's "Voronoi - metrics "
//https://www.shadertoy.com/view/MdSGRc

vec2 hash(vec2 p){
    p = vec2( dot(p,vec2(137.1,373.7)), dot(p,vec2(269.5,183.7)) ); 
    return fract(sin(p)*43758.37); 
    //return vec2(.5,mod(p.x*.3,2.)*.5);
}

vec3 worley(vec2 p){
    vec2 n = floor(p);
    vec2 f = fract(p);
    vec3 r = vec3(1.);
    for(int i=-2;i<=2;i++){
    for(int j=-2;j<=2;j++){
        vec2 o = hash(n+vec2(i,j));
        o = sin(iTime/4. + hash(n+vec2(i,j))*6.28)*0.5+0.5;//animate
        o += vec2(i,j);
        //float D1 = distance(o,f);//Euclidean
        //float D2 = abs(o.x-f.x)+abs(o.y-f.y);//Manhattan
        //float D3 = max(abs(o.x-f.x),abs(o.y-f.y));//Chebyshev
        float D4 = max(abs(o.x-f.x)*0.866+(o.y-f.y)*0.5,-(o.y-f.y));//Triangle
        if(D4<r.x){
        r.x = D4;//distance
        vec2 r1 = hash(n+vec2(i,j));
        r.y = r1.x*0.5+0.5;//for colorseed
        r.z = 1.-step(0.0,0.5*abs(o.x-f.x)+0.866*(o.y-f.y))*(1.0+step(0.0,o.x-f.x))*0.4;//mask
        }
    }
    }
    return r;
}


float logo(vec2 uv);

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (2.*fragCoord-iResolution.xy)/iResolution.y;
    vec3 n = worley(uv*2.);
    
    vec2 dp = vec2( 1.0/iResolution.y, 0.0 );
    float d = abs(worley( 2.*(uv+dp.xy)).z - worley( 2.*(uv-dp.xy)).z )+
              abs(worley( 2.*(uv+dp.yx)).z - worley( 2.*(uv-dp.yx)).z );
    
    
    vec3 col = vec3(.5,.4,2)*n.y;
    col *= n.z+.2;//shadow
    col = col-n.x*0.2;//ao
    col = clamp(col,0.,1.);
    col += d;//outline
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
    return 'NsScDV';
  }
  name(): string {
    return 'odos| voronoi boxes';
  }
  sort() {
    return 779;
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
