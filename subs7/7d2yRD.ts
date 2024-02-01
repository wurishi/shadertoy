
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//圆心 半径 画圆
float circle( vec2 uv, vec2 p, float r, float blur){
    p.x *=iResolution.x/iResolution.y;
    uv.x *= iResolution.x/iResolution.y;//校正屏幕比例
    float d = length(uv-p);
    float c = smoothstep(r,r-blur,d);//AA
    return c;
}
//2点 线段
float segment(vec2 uv, vec2 p1, vec2 p2, float width, float blur){
width/=2.;blur/=2.;
vec2 pa = uv-p1,ba = p2-p1;
pa.x*= iResolution.x/iResolution.y;
ba.x*= iResolution.x/iResolution.y;
float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
float d = length(pa-ba*h);
return smoothstep(width+blur,width-blur,d);
}
//圆弧 a1a2为弧度制 a1<a2 a1,a2∈[0,6.28]
float arc(vec2 uv, vec2 o,float r,float a1,float a2, float width, float blur){
uv -=o;
width/=2.;blur/=2.;
uv.x*= iResolution.x/iResolution.y;
float ap =(uv.x>0.)?acos(uv.y/length(uv)):acos(-uv.y/length(uv))+3.14;//求夹角
vec2 p1= vec2(sin(a1)*r,cos(a1)*r);
vec2 p2= vec2(sin(a2)*r,cos(a2)*r);
float d =(ap>a1&&ap<a2)?(abs(length(uv)-r)):
                        min(length(uv-p1),length(uv-p2));
return smoothstep(width+blur,width-blur,d);
}
//等边三角形
float triangle(vec2 uv,vec2 o,float a,float blur){
uv -= o;
uv.x = abs(uv.x*iResolution.x/iResolution.y)-a;
const float k = sqrt(3.);
uv.y +=1./k*a;
if(uv.x+k*uv.y >0.) uv=vec2(uv.x-k*uv.y,-k*uv.x-uv.y)/2.;
uv.x -= clamp( uv.x, -2.0*a, 0.0 );
float d = -length(uv)*sign(uv.y);
return smoothstep(0.+blur,0.,d);
}
//长方形 左上右下点
float rectangle(vec2 uv,vec2 p1,vec2 p2,float blur){
blur /= 2.;
uv.x *=iResolution.x/iResolution.y;
p1.x *=iResolution.x/iResolution.y;
p2.x *=iResolution.x/iResolution.y;
return smoothstep(p1.x-blur,p1.x+blur,uv.x)*
       smoothstep(p2.x+blur,p2.x-blur,uv.x)*
       smoothstep(p1.y+blur,p1.y-blur,uv.y)*
       smoothstep(p2.y-blur,p2.y+blur,uv.y);
}
//绕任意点旋转
vec2 rotate(vec2 uv, vec2 p, float a){
uv-=p;
uv.x *= iResolution.x/iResolution.y;
vec2 q;
q.x = cos(a)*uv.x + sin(a)*uv.y;
q.y = -sin(a)*uv.x + cos(a)*uv.y; 
q.x /=iResolution.x/iResolution.y;
q+=p;
return q;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;
    if(fract(iTime/2.)<0.33){
    //color theme 1
    //BackGround
    vec3 c1 = vec3(1.,0.4,0.);
    vec3 c2 = vec3(1.,0.,0.4);
    vec3 col = mix(c2,c1,uv.y);
    
    //Colormask
    float bmask = circle(uv,vec2(0.4,0.6),0.13,0.005);//head
    bmask += circle(uv,vec2(0.5,0.45),0.21,0.005);//body
    bmask *= smoothstep(0.28,0.285,uv.y); //butt

    float wmask = segment(uv, vec2(.401,.60), vec2(.41,.56), 0.04, 0.005);//nose
    wmask += circle(uv,vec2(.405,.53),0.025,0.005);//mouth
    wmask += circle(uv,vec2(.425,.545),0.025,0.005);//mouth
    wmask += rectangle(uv,vec2(.365,.56),vec2(.385,.55),0.005);//righteye
    wmask += rectangle(rotate(uv,vec2(.435,.598),-2.4),vec2(.425,.603),vec2(.445,.593),0.005);//lefteye
    bmask += triangle(rotate(uv,vec2(.35,.69),2.7),vec2(.35,.69),0.05,0.005);//rightear
    bmask += triangle(rotate(uv,vec2(.43,.715),-.15),vec2(.43,.715),0.05,0.005);//leftear
    
    wmask += circle(uv,vec2(.42,.3),0.03,0.005);//foot
    bmask += segment(uv, vec2(.595,.45), vec2(.595,.2), 0.08, 0.005);//tail1
    bmask += arc(uv, vec2(.53,.2),.115,1.57,4.2,0.08, 0.005);//tail2
    wmask += arc(uv, vec2(.53,.2),.115,4.2,4.71,0.08, 0.005);//tail3
    
    bmask = clamp(bmask,0.,1.);
    wmask = clamp(wmask,0.,1.);
    col = mix(col,vec3(0.),bmask);
    col = mix(col,vec3(1.),wmask);
    fragColor = vec4(col,1.0);
    }
    else if(fract(iTime/2.)<0.67){
    //color theme 2
    //BackGround
    vec3 c1 = vec3(.15,.15,.75);
    vec3 c2 = vec3(.1,.2,1);
    vec3 col = mix(c1,c2,uv.y);
    
    //Colormask
    float bmask = circle(uv,vec2(0.4,0.6),0.13,0.005);//head
    float rmask = triangle(rotate(uv,vec2(.35,.69),2.7),vec2(.35,.69),0.05,0.005);//rightear
    rmask += triangle(rotate(uv,vec2(.43,.715),-.15),vec2(.43,.715),0.05,0.005);//leftear
    rmask = clamp(rmask-circle(uv,vec2(0.4,0.6),0.13,0.04),0.,1.);
    rmask += circle(uv,vec2(0.402,0.58),0.11,0.09)*0.8;
    bmask += circle(uv,vec2(0.5,0.45),0.21,0.005);//body
    bmask *= smoothstep(0.28,0.285,uv.y); //butt

    rmask += segment(uv, vec2(.401,.60), vec2(.41,.56), 0.04, 0.005);//nose
    rmask += circle(uv,vec2(.405,.53),0.025,0.005);//mouth
    rmask += circle(uv,vec2(.425,.545),0.025,0.005);//mouth
    float wmask = rectangle(uv,vec2(.365,.56),vec2(.385,.55),0.005);//righteye
    wmask += rectangle(rotate(uv,vec2(.435,.598),-2.4),vec2(.425,.603),vec2(.445,.593),0.005);//lefteye

    
    
    
    rmask += circle(uv,vec2(.42,.3),0.03,0.005);//foot
    bmask += segment(uv, vec2(.595,.45), vec2(.595,.2), 0.08, 0.005);//tail1
    bmask += arc(uv, vec2(.53,.2),.115,1.57,2.,0.08, 0.005);//tail2
    float a = circle(uv,vec2(.6,.2),0.15,0.08);
    a *= clamp(bmask,0.,1.);
    rmask +=a;
    rmask += arc(uv, vec2(.53,.2),.115,1.57,4.71,0.08, 0.005);//tail3
    
    bmask = clamp(bmask,0.,1.);
    wmask = clamp(wmask,0.,1.);
    rmask = clamp(rmask,0.,1.);
    col = mix(col,vec3(.93,.83,.7),bmask);
    //col = mix(col,vec3(.65,.5,.4),rmask);
    col = mix(col,vec3(.25,.15,.15),rmask);
    col = mix(col,vec3(0.),wmask);
    fragColor = vec4(col,1.0);
    }
    else{
    //color theme 3
    //BackGround
    vec3 c1 = vec3(1.,0.7,0.2);
    vec3 c2 = vec3(.8,1,0.4);
    vec3 col = mix(c2,c1,uv.y);
    
    //Colormask
    float omask = circle(uv,vec2(0.4,0.6),0.13,0.005);//head
    omask += circle(uv,vec2(0.5,0.45),0.21,0.005);//body
    omask *= smoothstep(0.28,0.285,uv.y); //butt

    float wmask = segment(uv, vec2(.401,.60), vec2(.41,.56), 0.04, 0.005);//nose
    wmask += circle(uv,vec2(.405,.53),0.025,0.005);//mouth
    wmask += circle(uv,vec2(.425,.545),0.025,0.005);//mouth
    float bmask = triangle(rotate(uv,vec2(.35,.69),2.7),vec2(.35,.69),0.05,0.005);//rightear
    bmask += triangle(rotate(uv,vec2(.43,.715),-.15),vec2(.43,.715),0.05,0.005);//leftear
    wmask += triangle(rotate(uv,vec2(.35,.69),2.7),vec2(.34,.70),0.02,0.005);//rightear
    wmask += triangle(rotate(uv,vec2(.43,.715),-.15),vec2(.43,.695),0.02,0.005);//leftear
    bmask += rectangle(uv,vec2(.365,.56),vec2(.385,.55),0.005);//righteye
    bmask += rectangle(rotate(uv,vec2(.435,.598),-2.4),vec2(.425,.603),vec2(.445,.593),0.005);//lefteye
    
    bmask += segment(uv, vec2(.38,.64), vec2(.41,.65), 0.015, 0.005);//wang
    bmask += segment(uv, vec2(.374,.658), vec2(.41,.67), 0.015, 0.005);
    bmask += segment(uv, vec2(.379,.620), vec2(.415,.632), 0.015, 0.005);
    bmask += segment(uv, vec2(.392,.663), vec2(.397,.626), 0.015, 0.005);
    
    wmask += circle(uv,vec2(.42,.3),0.03,0.005);//foot
    omask += segment(uv, vec2(.595,.45), vec2(.595,.2), 0.08, 0.005);//tail1
    omask += arc(uv, vec2(.53,.2),.115,1.57,4.2,0.08, 0.005);//tail2
    bmask += arc(uv, vec2(.53,.2),.115,4.2,4.71,0.08, 0.005);//tail3
    
    float str = arc(uv, vec2(0.4,0.6),.15,1.1,2.2,0.04, 0.005);//stripes
    str += arc(rotate(uv,vec2(.4,.3),-0.25), vec2(0.4,0.6),.15,.8,2.1,0.04, 0.005);
    str += arc(rotate(uv,vec2(.4,.3),-0.4), vec2(0.4,0.6),.18,.8,1.8,0.04, 0.005);
    for(float i=0.;i<5.;i++){
    str += arc(rotate(uv,vec2(.53,.2),i*(0.4)+1.), vec2(.467,.23),.05,1.8,4.4,0.02, 0.005);}//tail stripes
    str*=omask;
    bmask += str;
    
    
    omask = clamp(omask,0.,1.);
    wmask = clamp(wmask,0.,1.);
    bmask = clamp(bmask,0.,1.);
    col = mix(col,vec3(1.,.5,0.),omask);
    col = mix(col,vec3(.3,.1,0.),bmask);
    col = mix(col,vec3(1.),wmask);

    fragColor = vec4(col,1.0);
    }
}
`;

export default class implements iSub {
  key(): string {
    return '7d2yRD';
  }
  name(): string {
    return 'CATS with basic shapes';
  }
  sort() {
    return 780;
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
