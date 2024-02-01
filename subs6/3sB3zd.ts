import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec4 c0 = vec4(0.15,0.35,0.56,1.);//BG
vec4 c1 = vec4(1.00,0.65,0.40,1.);//

float time;
float R;
const int samples = 20;
vec2 g;
vec2 uv;
vec4 color;

const float PI = 3.14159265;


struct Square{
    float size;
    vec2 pos;
    vec2 vel;
};
  float wave(float x , float f, float a){
    return  cos(x*f)*a ;
}
    
 Square SquareCons(vec2 pos,float size){
        Square sq;
        sq.pos = pos;
        sq.size = size;
        return sq;
}
    
 float cLength(vec2 p){
  if(abs(p.x)>abs(p.y))return abs(p.x);
  return abs(p.y);
}    



float r = 0.03;
vec4 drawCircle(vec2 v){ 
        float d = length(uv-v);
        if( d < r)return vec4(0);
        return vec4(d);
}

float track(float x){
    float f = 0.;
    //float po = sin(iTime);
    //float yo = tan(iTime*1.0);
     float t = 0.03 * (-iTime*130.0);
   
    x *= 40.;
    f+=cos(x)*1. ;
    
    f += 10.* 
        sin(x*2.1 + t) * .55
      *sin(x*1.72 + t * 1.121) * .50
     //sin(x*2.221 + t * 0.437) * .50;
     * sin(x*3.1122+ t * 4.269) * 0.35;
    return f;
}

float disp(vec2 p){
    return -0.01*sin(p.y*10.+iTime*10.);
}

vec4 drawSquare(Square sq,vec2 v){

    vec2 p = uv-sq.pos;
    vec2 q = p;
    
    v *= smoothstep(0.,1.,length(v)*10.);
    v = -v;
    
    float unko = dot(p,normalize(v));

    vec2 vertV = vec2(v.y , -v.x);
    float Pvx = dot(q,normalize(vertV));//
 
    float vl = length(v);
    
   // float d2 = disp(vec2(Pvx,unko));
    vl  *=0.5+ track(Pvx);
    //if(unko>0.5*vl) vl *=1.+d2*30.;
    

    unko = clamp(unko,0.,vl);
    q  -= normalize(v) * unko;
      
    float d =   length(q);
    return vec4(d);
}


vec2 move(float t){
    vec2 p = vec2(0);
    float r = 0.85;
   
    float v = 6.;
    float w = 0.7;
    float h = 0.4;
    
    t *= 1.;

    
    t = mod(t,4.);
    if(t<2.)p.x = exp(-t*v)*w;
    else p.x += (1.-exp(-(t-2.)*v))*w;
    
    if(1.<t && t<3.)p.y = exp(-(t-1.)*v)*h;
    else p.y += (1.-exp(-(mod(t-3.,4.))*v))*h;
    
    p -= vec2(w/2. , h/2.);

    p * 1.0000;
    return p;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    uv = (fragCoord-.5*iResolution.xy)/iResolution.x;
    color = vec4(1);
    vec2 mouseUV = (iMouse.xy-.5*iResolution.xy)/iResolution.x; 
    
    mouseUV = move(iTime);
  //  mouseUV = vec2(0);

    
    vec2 prevPos = move(iTime-0.05); 
   
    vec2 v = move(iTime)-prevPos;
    
    Square sq = SquareCons(mouseUV,0.03);    

    vec4 t  = drawSquare(sq,v); 
     t = vec4(smoothstep(0.,1.,t));
    
      t = vec4(step(0.005,t)); 
     if(t.x==0.)color = c1;
    else color = c0;
    fragColor = color;
}
`;

export default class implements iSub {
  key(): string {
    return '3sB3zd';
  }
  name(): string {
    return 'cartoon motionblur';
  }
  sort() {
    return 636;
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
