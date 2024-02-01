import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define pmod(p,a) mod(p ,a) - 0.5*a
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
float nois(vec3 _p){
  vec4 p = vec4(_p,1. + iTime);
  float n = 0.;
  float amp = 1.;
  for(int i = 0; i < 5; i++){
  
    p.xz *= rot(0.5);
    p.wz *= rot(0.5);
    p.yz *= rot(0.5);  
    n += dot(sin(p),cos(p))*amp;
  
    amp *= 0.7;
    p *= 1.5;
  }
  return n;
}
float N = 0.;

vec3 pal(float m){return pow(0.5 + 0.5*sin(m + vec3(-0.5,-0.,0.5)),vec3(0.2));}

float map(vec3 p){
  N = nois(p*4.)*0.1;
  float d = 10e5;
  for(float i = 0.; i < 5.; i++){
    p.xz *= rot(0.4 + (iTime + sin(iTime + i*11.5))*0.2);
    p.yz *= rot(0.4 + (iTime + sin(iTime + i))*0.2);
    d = min(d, length(p.xz) - 0.04 - N*0.5);
    
  }
  return d;
}

float sdBox(vec2 p, vec2 s){p = abs(p) -s; return max(p.x,p.y);}
void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
		
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    
    vec3 col = vec3(1);
  
  float pxsz = fwidth(uv.x);
  {
    vec3 c = vec3(0.6,0.2,0.7) + sin(uv.xyx*20.)*0.3;
    
    float md = 0.1;
    
    vec2 p = uv;
    p.x += (sin(iTime) + iTime+ cos(iTime*1.5))*0.2;
    vec2 id = floor(p/md);
    float m = (sin(id.x + iTime + cos(id.y)*3.));
    c = pal(uv.x + id.x);
    p = pmod(p,md);
    p *= rot(m + iTime);
    
    float d = abs(p.x);
    d = min(d,abs(p.y));
    
    d = max(d,abs(length(p)- m*md*0.5) - 0.01);
    
    col = mix(col,c,smoothstep(pxsz,0.,d - 0.003));
  }
  {
    vec3 c = vec3(0.6,0.2,0.7) + sin(uv.xyx*20.)*0.3;
    
    float md = 0.2;
    
    vec2 p = uv;
    p += 0.05;
    p.x += (sin(iTime) + iTime+ cos(iTime*1.5))*0.1;
    vec2 id = floor(p/md);
    float m = (sin(id.x + iTime + cos(id.y)*3.));
    c = pal(uv.x + id.x);
    p = pmod(p,md);
    //p *= rot(m + iTime);
    
    float d = abs(p.x);
    d = min(d,abs(p.y));
    
    //d = max(d,abs(length(p)- m*md*0.5) - 0.01);
    
    col = mix(col,c,smoothstep(pxsz,0.,d - 0.0001));
  }
  
  
  
  {
    vec3 p = vec3(0,0,-2);
    vec3 rd = normalize(vec3(uv,1));
    bool hit = false; float t= 0.;
   
    for(int i = 0; i < 60; i++){
      float d = map(p);
      if(d < 0.01){
        hit = true;
        break;
      }
      
      p += rd*d;
    }
    if(hit){
      //col = 1.-col;
      col = vec3(1);
      col = mix(col,pow(pal(p.x + p.y + sin(p.x)),vec3(2.)),nois(p*4.)*0.6);
    }
  }
  
  #define xor(a,b,c) min(max(a + c,-(b)),max(b,-(a)))
  {
    vec2 p = uv;
    
    float d = 10e5;
    for(float i = 0.; i < 5.; i++){
      float m = sin(iTime+i + cos(iTime+i));
      vec2 q = p + vec2(m,0.)*0.2;
      d = xor(d,abs(length(q) - length(sin(iTime+m))*0.2 ) - 0.01*m,-0.01);
    }
    col = mix(col,1.2-col,smoothstep(pxsz,0.,d));
    
  }
  
  {
    vec2 p = uv;
    p.y = abs(p.y) - 0.45;
    float id = floor(p.x/0.1+ iTime*4. + cos(iTime+ sign(uv.y)*2. - 1.) + sign(uv.y)*2. - 1.);
    
    float d = abs(p.t) - 0.1;
    
    
    col = mix(col,1.2-col*pal(id),smoothstep(pxsz,0.,d));
    col = mix(col,1.2-col*pal(id*2.),smoothstep(pxsz,0.,abs(d) - 0.02));
    
    
  }
  
  {
    vec2 p = uv;
    //p.y = abs(p.x) - 0.45;
    
    float d = abs(p.x - 0.6) - 0.1;
    d = sdBox(p.x - vec2(0.5,0.),vec2(0.1,0.3));
    
    col = mix(col,1.-col*(0.6 + 0.5*pal(uv.y*4.)),smoothstep(pxsz,0.,d));
    //col = mix(col,1.2-col*pal(id*2.),smoothstep(pxsz,0.,abs(d) - 0.02));
    
    
  }
  //col = 1. - col;
  
  //col = smoothstep(vec3(0),vec3(1.,0.9,1.1),col);
  //col = pow();
  
  col = pow(col,vec3(0.4545));
  fragColor = vec4(col,1.);
}
`;

export default class implements iSub {
    key(): string {
        return 'NsfXRf';
    }
    name(): string {
        return 'Cookie casual Shader Showdown';
    }
    sort() {
        return 762;
    }
    webgl() {
        return WEBGL_2;
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
