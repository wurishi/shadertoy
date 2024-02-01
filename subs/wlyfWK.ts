import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Pencilvester's orthodoodle - Result of an improvised live coding session on Twitch
// LIVE SHADER CODING, SHADER SHOWDOWN STYLE, EVERY TUESDAYS 20:00 Uk time: 
// https://www.twitch.tv/evvvvil_

// "Rick, I'm Pencilvester. Listen to that name. You can't kill me." - Pencilvester

float t,tt,bb,g;vec2 z,v,e=vec2(.00035,-.00035);vec3 np,bp,pp,op,po,no,cp,al,ld;
mat2 r2(float r){return mat2(cos(r),sin(r),-sin(r),cos(r));}
float bo(vec2 p,vec2 r){p=abs(p)-r;return max(p.x,p.y);}
float box(vec3 p,vec3 r){p=abs(p)-r;return max(max(p.x,p.y),p.z);}
float ex(vec3 p,float sdf,float h){vec2 w=vec2(sdf,abs(p.y)-h);return min(max(w.x,w.y),0.0)+length(max(w,0.0));}
const float[] ca = float[4](-0.785,-0.6154,-0.8,-0.6154);
const float[] cb = float[4](1.57,-.785,4.185,-.785);
const float[] cc = float[4](7.,9.,8.,10.);
vec2 mp( vec3 p,float ga)
{  
  p.yz*=r2(ca[int(bb)]);
  p.xz*=r2(cb[int(bb)]);  
  op=p;
  p.x=mod(p.x-tt-1.0,10.)-5.;
  vec2 t=vec2(1000,5),h=vec2(1000,3);
  float glo=1000.,sinner=sin(op.x)*.2;
  p.yz*=r2(.785);
  pp=p;  
  pp.yz=abs(pp.yz)-4.2+sinner;
  pp.yz*=r2(.785);
  vec3 u=vec3(pp.xz,1);
  np=pp;
  float cla=clamp(sin(pp.y*.5),-.25,.25);
  for(int i=0;i<6;i++){
    float I=float(i);
    u.xy=abs(u.xy)-1.5-0.5*cla;
    u.xy*=r2(.785*mod(I,2.));
    u*=1.55;
    t.x=min(t.x,ex(pp,abs(bo(u.xy,vec2(.5,2.0/u.z*.7))/u.z)-.02,4.-I*.5));        
    h.x=min(h.x,ex(pp,bo(u.xy,vec2(.2,1.5/u.z*.75))/u.z,5.-I*.5));    
    if(i<3&&ga>0.)glo=min(glo,ex(pp,abs(bo(u.xy,vec2(.3,1.7/u.z*.75))/u.z)-.0,4.-I*.5));        
  }   
  float sp=-(length(op.yz)-3.+sinner);
  t=t.x<h.x?t:h;//t.x*=0.9;
  t.x=max(t.x,op.y);
  t.x=max(t.x,sp);
  pp=op+vec3(0,13.5,0);pp.z=abs(pp.z)-8.5;
  h=vec2(box(pp,vec3(20,10,5)),6);
  h.x=min(h.x,box(pp-vec3(0,4,4.2-sinner),vec3(20,10,5)));
  if(ga>0.){
    glo=max(glo,op.y);
    glo=max(glo,sp);
    g+=0.1/(0.1+glo*glo*400.);  
    h.x=min(h.x,glo);  
  }  
  t=t.x<h.x?t:h;  cp=p;
	return t;
}
vec2 tr( vec3 ro,vec3 rd)
{
  vec2 h,t=vec2(.1);
  for(int i=0;i<128;i++){
  h=mp(ro+rd*t.x,1.);
    if(h.x<.0001||t.x>18.) break;
    t.x+=h.x;t.y=h.y;
  }
  if(t.x>18.) t.y=0.;
	return t;
}
#define a(d) clamp(mp(po+no*d,0.).x/d,0.,1.)
#define s(d) smoothstep(0.,1.,mp(po+ld*d,0.).x/d)
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2 uv=(fragCoord.xy/iResolution.xy-0.5)/vec2(iResolution.y/iResolution.x,1);
  tt=mod(iTime,62.8)+5.0;
  bb=mod(floor(tt*.2),4.);	
  vec3 ro=vec3(uv*cc[int(bb)],-8.),
  rd=vec3(0.,0.,1.),co,fo;
  co=fo=vec3(.1)-length(uv)*.1;
  ld=normalize(vec3(-.5,.5,-.3));
  z=tr(ro,rd);t=z.x;  
  if(z.y>0.){   
    po=ro+rd*t;
    no=normalize(e.xyy*mp(po+e.xyy,0.).x+e.yyx*mp(po+e.yyx,0.).x+e.yxy*mp(po+e.yxy,0.).x+e.xxx*mp(po+e.xxx,0.).x);
    al=vec3(.1,.2,.4)-ceil(abs(sin(np.y*15.))-.1)*.1;
    if(z.y<5.) al=vec3(0)-ceil(cos(np.x*100.0));
    if(z.y>5.) al=vec3(1),no-=0.2*ceil(abs(cos((cp)*5.2))-.05),no=normalize(no);    
    float dif=max(0.,dot(no,ld)),
    fr=pow(1.+dot(no,rd),4.),
    sp=pow(max(dot(reflect(-ld,no),-rd),0.),30.);
    co=mix(sp+al*(a(0.1)+.2)*(dif+s(.5)),fo,min(fr,.5));
    co=mix(fo,co,exp(-.0001*t*t*t));
  }
  co=mix(co,co.xzy,length(uv*.7));
  fragColor = vec4(pow(co+g*.2*mix(vec3(1.,.5,0.),vec3(1.),sin(t)*.5-.2),vec3(.45)),1);
}
`;

export default class implements iSub {
  key(): string {
    return 'wlyfWK';
  }
  name(): string {
    return "Pencilvester's orthodoodle";
  }
  sort() {
    return 53;
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
