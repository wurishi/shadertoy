
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// psrdnoise (c) Stefan Gustavson and Ian McEwan,
// ver. 2021-12-02, published under the MIT license:
// https://github.com/stegu/psrdnoise/

float psrdnoise(vec2 x, vec2 period, float alpha, out vec2 gradient)
{
  vec2 uv = vec2(x.x+x.y*0.5, x.y);
  vec2 i0 = floor(uv), f0 = fract(uv);
  float cmp = step(f0.y, f0.x);
  vec2 o1 = vec2(cmp, 1.0-cmp);
  vec2 i1 = i0 + o1, i2 = i0 + 1.0;
  vec2 v0 = vec2(i0.x - i0.y*0.5, i0.y);
  vec2 v1 = vec2(v0.x + o1.x - o1.y*0.5, v0.y + o1.y);
  vec2 v2 = vec2(v0.x + 0.5, v0.y + 1.0);
  vec2 x0 = x - v0, x1 = x - v1, x2 = x - v2;
  vec3 iu, iv, xw, yw;
  if(any(greaterThan(period, vec2(0.0)))) {
    xw = vec3(v0.x, v1.x, v2.x);
    yw = vec3(v0.y, v1.y, v2.y);
    if(period.x > 0.0)
    xw = mod(vec3(v0.x, v1.x, v2.x), period.x);
    if(period.y > 0.0)
      yw = mod(vec3(v0.y, v1.y, v2.y), period.y);
    iu = floor(xw + 0.5*yw + 0.5); iv = floor(yw + 0.5);
  } else {
    iu = vec3(i0.x, i1.x, i2.x); iv = vec3(i0.y, i1.y, i2.y);
  }
  vec3 hash = mod(iu, 289.0);
  hash = mod((hash*51.0 + 2.0)*hash + iv, 289.0);
  hash = mod((hash*34.0 + 10.0)*hash, 289.0);
  vec3 psi = hash*0.07482 + alpha;
  vec3 gx = cos(psi); vec3 gy = sin(psi);
  vec2 g0 = vec2(gx.x, gy.x);
  vec2 g1 = vec2(gx.y, gy.y);
  vec2 g2 = vec2(gx.z, gy.z);
  vec3 w = 0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2));
  w = max(w, 0.0); vec3 w2 = w*w; vec3 w4 = w2*w2;
  vec3 gdotx = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));
  float n = dot(w4, gdotx);
  vec3 w3 = w2*w; vec3 dw = -8.0*w3*gdotx;
  vec2 dn0 = w4.x*g0 + dw.x*x0;
  vec2 dn1 = w4.y*g1 + dw.y*x1;
  vec2 dn2 = w4.z*g2 + dw.z*x2;
  gradient = 10.9*(dn0 + dn1 + dn2);
  return 10.9*n;
}

float fbm(vec2 x,float n,out vec2 g){

vec2 p = vec2(0.);
float alpha = iTime*.05;
float scale = .5;

float noise = 0.;
for (float i = 0.;i<n;i++){
noise += psrdnoise(x , p, alpha, g)*scale;
x *=2.;scale/=2.;alpha *=1.3;
}
return noise;
}

float pattern( in vec2 p , out vec2 g)
{
    vec2 q = vec2( fbm( p + vec2(0.0,0.0) ,4.,g),
                   fbm( p + vec2(5.2,1.3),4.,g) );

    vec2 r = vec2( fbm( p + 4.0*q + vec2(1.7,9.2) ,4.,g),
                   fbm( p + 4.0*q + vec2(8.3,2.8) ,4.,g) );

    return fbm( p + 4.0*r ,4.,g);
}

float logo(vec2 uv);
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{

    vec2 uv = (2.*fragCoord - iResolution.xy)/iResolution.y;
    vec2 uv1 = uv*1.5;
    const vec2 p = vec2(8.0, 8.0);
    float alpha = iTime*.1;
    vec2 g;
    float n = psrdnoise(uv1, p, alpha, g);
    
    
    vec3 col;
    col = vec3(n*0.5+0.5);
    //warping
    vec2 uv2 = uv*.1;
    vec3 pa;
    pa.x = pattern(uv2,pa.yz);
    col = mix(vec3(0,0,0),vec3(.2,.3,.4),pa.x+n*0.3);
    col = mix(col,vec3(.7,.3,.3),pa.x-n*0.1);
    col = mix(col,vec3(.8,.6,.9),smoothstep(-1.,1.,pa.y)*.4);
    
    col= clamp(col,0.,1.);
    col +=logo(uv);

    // Output to screen
    fragColor = vec4(col,1.0);
}

float logo(vec2 uv){
uv *= 1.5;uv.x+=0.6;
float n = 0.;
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
    return 'sdSyWK';
  }
  name(): string {
    return 'odos|psrdnoise warping';
  }
  webgl(): string {
    return WEBGL_2;
  }
  sort() {
    return 782;
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
