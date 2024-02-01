
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define BLUR 0.005

//=============================================================================================
//========================================SHAPES===============================================
//=============================================================================================

//圆心 半径 画圆
float circle( vec2 uv, vec2 o, float r, float blur){
    float d = length(uv-o);
    float c = smoothstep(r,r-blur,d);//AA
    return c;
}
//1点+垂直 直线
float lineVer(vec2 uv, vec2 p,float width, float blur){
width/=2.;
uv -= p;
return smoothstep(-width-blur,-width,uv.x)*smoothstep(width+blur,width,uv.x);
}
//1点+斜率 直线
float line(vec2 uv, vec2 p, float k, float width, float blur){
width/=2.;
uv -= p;
float d = abs(k*uv.x-uv.y)/sqrt(k*k+1.);
return smoothstep(-width-blur,-width,d)*smoothstep(width+blur,width,d);
}
//2点 直线
float line(vec2 uv, vec2 p1, vec2 p2, float width, float blur){
width/=2.;blur/=2.;
vec2 pa = uv-p1,ba = p2-p1;
float h = dot(pa,ba)/dot(ba,ba);
float d = length(pa-ba*h);
return smoothstep(width+blur,width-blur,d);
}
//2点 线段
float segment(vec2 uv, vec2 p1, vec2 p2, float width, float blur){
width/=2.;blur/=2.;
vec2 pa = uv-p1,ba = p2-p1;
float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
float d = length(pa-ba*h);
return smoothstep(width+blur,width-blur,d);
}
//圆弧 a1a2为弧度制 a1<a2 a1,a2∈[0,6.28]
float arc(vec2 uv, vec2 o,float r,float a1,float a2, float width, float blur){
uv -=o;
width/=2.;blur/=2.;
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
uv.x = abs(uv.x)-a;
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
return smoothstep(p1.x-blur,p1.x+blur,uv.x)*
       smoothstep(p2.x+blur,p2.x-blur,uv.x)*
       smoothstep(p1.y+blur,p1.y-blur,uv.y)*
       smoothstep(p2.y-blur,p2.y+blur,uv.y);
}

//=============================================================================================
//======================================TRANSFORMATION=========================================
//=============================================================================================

//绕任意点旋转 弧度制
vec2 rotate(vec2 uv, vec2 p, float a){
uv-=p;
vec2 q;
q.x = cos(a)*uv.x + sin(a)*uv.y;
q.y = -sin(a)*uv.x + cos(a)*uv.y; 
q+=p;
return q;
}
//斜切
vec2 bevel(vec2 p, float x,float y){
    vec2 q;
    q.x = p.x + p.y*x;
    q.y = p.y +p.x*y;
    return q;
}
//=============================================================================================
//======================================FUNCTIONS==============================================
//=============================================================================================

//绘制坐标轴
vec3 coordSystem(vec2 p){
    vec3 col = vec3(0);
    float c;
    c =lineVer(p, vec2(0.,0.),0.003,BLUR);//y
    c +=line(p, vec2(0.,0.), 0.,0.003,BLUR);//x
    c +=lineVer(p, vec2(1.,0.),0.003,BLUR)*.3;//x=1
    c +=lineVer(p, vec2(-1.,0.),0.003,BLUR)*.3;//x=-1
    col +=c*vec3(.5,.8,.9);
    col += vec3(circle(p,vec2(0.,0.),0.02,BLUR));//OriginalPt
    col = mix(col,vec3(1,0.16,0.6),vec3(circle(p,vec2(0.,0.),0.015,BLUR)));
    return col;
}
vec3 animate(vec2 p,float time){
    vec3 col = vec3(0,0,1);
       
    float tt = mod(time,2.)/2.;
    float ss = pow(tt,.2)*0.5 + 0.5;
    ss = ss*.8*sin(tt*6.28*3.0 + p.y*0.5)*exp(-tt*4.);
    col += circle(p, vec2(-.5, ss*sin(time * 12.0) * 0.7 +.2), 0.1,BLUR);
    col += circle(p, vec2(.5, ss*sin(time * 12.0) * 0.7), 0.1,BLUR);
    
    p = bevel(p,ss*(p.y+0.5),0.);

    col += rectangle(p,vec2(-.3,.5),vec2(.3,-.5),BLUR);
    col -= circle(p,vec2(-.06,.3),.05,BLUR*2.)*2.;
    col -= circle(p,vec2(.06,.3),.05,BLUR*2.)*2.;
    col -= segment(p,vec2(-.05,.3),vec2(.05,.3),.01,BLUR*2.)*2.;
    col = clamp(col,0.,1.);
    return col;
}
//=============================================================================================
//========================================MAIN=================================================
//=============================================================================================

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;
    //BackGround
    vec3 col = vec3(0.);
    //col +=coordSystem(p);
    
    //motionblur
    float amount = 32.;
    float timescale = .1;
    vec3 blurcol=vec3(0.);
    
	for(int i = 0; i < int(amount); i++)
	{
    blurcol += animate(p, iTime - float(i)*timescale/amount)/amount;
	}
    col += blurcol;
    
    /*
    vec2 p1 = vec2(-.5,0.);
    vec2 p2 = vec2(.5,0.5);
    vec2 p3 = vec2(.5,-0.5);
    col +=lineVer(p, p1,0.0001,0.003);
    col +=line(p, p1, 1.,0.0001,0.003);
    col +=segment(p, p2,p3,0.2,0.005)*0.5;
    col += vec3(arc(p, p1,0.3,.785,3.925,0.15,0.005));

    //shapemask pts
    float ptmask = circle(p,p1,0.02,0.005);
    ptmask += circle(p,p2,0.02,0.005);
    ptmask += circle(p,p3,0.02,0.005);
    col = mix(col,vec3(1.),ptmask);
    float ptmask2 = circle(p,p1,0.015,0.005);
    ptmask2 += circle(p,p2,0.015,0.005);
    ptmask2 += circle(p,p3,0.015,0.005);
    col = mix(col,vec3(1,0.16,0.6),ptmask2);
    */
    
    
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'fsjczw';
  }
  name(): string {
    return 'basic shapes v1';
  }
  sort() {
    return 778;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl(): string {
    return WEBGL_2;
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
