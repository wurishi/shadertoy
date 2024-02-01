import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define MAX_STEPS 50
#define threshold 0.1
#define MAX_DIST 2.0
#define step_size 0.01

struct sdfRes
{
    float d,a,isVol;
    vec3 col;
};

vec3 baseCol = vec3(.753,1.,.721);
vec3 lightPos = vec3(1.,1.0,1.0);

float invMix(float a,float b,float t)
{
    return (t-a)/(b-a);
}

float smin(float a,float b,float t)
{
    float h = clamp(0.5+0.5*(b-a)/t,0.0,1.0);
    return mix(b,a,h) - h*(1.0 - h)*t;
}

vec3 smin(vec3 a,vec3 b,float t)
{
    vec3 h = clamp(0.5+0.5*(b-a)/t,0.0,1.0);
    return mix(b,a,h) - h*(1.0 - h)*t;
}

sdfRes smin(sdfRes x,sdfRes y,float t)
{
    sdfRes res;
    res.d = smin(x.d,y.d,t);
    res.isVol = smin(x.isVol,y.isVol,t);
    res.col = smin(x.col,y.col,t);    
    return res;
}

float opSmoothSubtraction( float d1, float d2, float k )
{
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h); 
}


sdfRes opSmoothSubtraction(sdfRes x,sdfRes y, float k)
{
    float d1=x.d;
    float d2=y.d;
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    y.d = mix( d2, -d1, h ) + k*h*(1.0-h); 
    return y;
}


//sphData - (CenterPosition,Radius)
sdfRes SphereSDF(vec4 sphData, const vec3 pt, float vol, vec3 col )
{
    return sdfRes(length(pt-sphData.xyz)-sphData.w,1.-vol,vol,col);    
}

sdfRes sdEllipsoid( vec3 p, vec3 r, float vol, vec3 col )
{
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return sdfRes(k0*(k0-1.0)/k1,1.-vol,vol,col);
}

float sdParabola( in vec2 pos, in float wi, in float he )
{
    pos.x = abs(pos.x);
    float ik = wi*wi/he;
    float p = ik*(he-pos.y-0.5*ik)/3.0;
    float q = pos.x*ik*ik*0.25;
    float h = q*q - p*p*p;
    float r = sqrt(abs(h));
    float x = (h>0.0) ? 
        pow(q+r,1.0/3.0) - pow(abs(q-r),1.0/3.0)*sign(r-q) :
        2.0*cos(atan(r/q)/3.0)*sqrt(p);
    x = min(x,wi);
    return length(pos-vec2(x,he-x*x/ik)) * 
           sign(ik*(pos.y-he)+pos.x*pos.x);
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

sdfRes sdBox( vec3 p, vec3 b, float vol,vec3 col )
{
  return sdfRes(sdBox(p,b),0.,vol,col);
}


float sdTriPrism( vec3 p, vec2 h,float h1)
{
  vec3 q = abs(p);
  return max(q.z-h.y,max(q.x*0.866025+p.y*0.5*h1,-p.y)-h.x*0.5);
}

sdfRes sdTriPrism( vec3 p, vec2 h, float h1,float vol,vec3 col )
{
  return sdfRes(sdTriPrism(p,h,h1),0.,vol,col);
}

float sdCone(vec3 p, vec3 a, vec3 b, float ra, float rb)
{
    float rba  = rb-ra;
    float baba = dot(b-a,b-a);
    float papa = dot(p-a,p-a);
    float paba = dot(p-a,b-a)/baba;

    float x = sqrt( papa - paba*paba*baba );

    float cax = max(0.0,x-((paba<0.5)?ra:rb));
    float cay = abs(paba-0.5)-0.5;

    float k = rba*rba + baba;
    float f = clamp( (rba*(x-ra)+paba*baba)/k, 0.0, 1.0 );

    float cbx = x-ra - f*rba;
    float cby = paba - f;
    
    float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
    
    return s*sqrt( min(cax*cax + cay*cay*baba,
                       cbx*cbx + cby*cby*baba) );
}

sdfRes sdCone(vec3 p, vec3 a, vec3 b, float ra, float rb, float vol, vec3 col)
{
    return sdfRes(sdCone(p, a, b, ra,rb),0.0, vol, col);
}


sdfRes resMin(sdfRes x,sdfRes y)
{
    if(x.d<y.d)
        return x;
    else
        return y;
}

sdfRes resMax(sdfRes x,sdfRes y)
{
    if(x.d>y.d)
        return x;
    else
        return y;
}

sdfRes subtract(sdfRes x,sdfRes y) 
{
    x.d *=-1.;
    return resMax(x,y);
}


vec3 MirrorPt(const vec3 pt)
{
    vec3 mirPt = pt;
    mirPt.x = abs(mirPt.x);
    return mirPt;
}


sdfRes GetEye(const vec3 pt,const vec3 pos, const vec3 r)
{
    sdfRes res = sdEllipsoid(pt-pos, r,0.,vec3(1.,0.,0.));
    vec2 center = pt.xy-pos.xy;
    float len = length(center)*1.6;
    res.col = vec3(smoothstep(.1,0.14,len));
    res.col = mix(vec3(0.,0.6,.9),res.col,smoothstep(.05,0.15,len));
    res.col = mix(vec3(0.),res.col,smoothstep(.04,0.06,len));
    res.col = mix(vec3(1.),res.col,smoothstep(.01,0.03,length(center+vec2(-0.022,-0.01))*2.));
    res.col *= mix(vec3(2.),vec3(1.),smoothstep(.001,0.09,length(center+vec2(0.02,0.025))*2.));    
    res.a = 0.;
    return res;
}
 

sdfRes GetTeeth(vec3 pt,float scale)
{        
    vec3 mirPt = MirrorPt(pt);
    sdfRes teeth = sdBox(pt/scale-vec3(0.,-0.27+abs(pt.x*0.0),1.1),vec3(0.2,0.03,0.001),0.,vec3(1.));
    teeth.d = opSmoothSubtraction(sdTriPrism((mirPt/scale-vec3(0.22,-0.27,1.1)),vec2(.1),.8,0.,vec3(1.,0.,0.)).d,teeth.d,0.12);
  
    teeth.d = opSmoothSubtraction(sdBox((pt/scale)-vec3(0.,-0.2,1.05),vec3(0.01,0.5,0.1),0.,vec3(1.,0.,0.)).d,teeth.d,0.03);
    teeth.d -= 0.035;
    teeth.d*=scale;
    
    return teeth;
}


sdfRes GetModelSurf(const vec3 pt)
{
    //Mirrored point for symmetry
    vec3 mirPt = MirrorPt(pt);
    
    //Timed Spikes
    float t = min(1.,mod(iTime,4.1));
    float t2 = min(1.,mod(iTime,9.1));
    t = smoothstep(0.,0.1,t)-smoothstep(0.18,0.4,t);
    t2 = smoothstep(0.,0.1,t2)-smoothstep(0.18,0.4,t2);
    t = max(t,t2)+cos(iTime)*0.03;
    
    //Head
    sdfRes sdf1 = sdEllipsoid( pt, vec3(0.92,0.9,1.),1.,vec3(0.));         
    sdf1.d = smin(sdf1.d ,SphereSDF(vec4(0.36,-0.18,0.75,0.25),pt,1.,vec3(0)).d,0.52);
    sdf1.d = smin(sdf1.d ,SphereSDF(vec4(-0.36,-0.18,0.75,0.25),pt,1.,vec3(0)).d,0.52);
    
    //Body
    sdfRes body = sdCone(pt, vec3(0.,-0.1,0.3), vec3(0.,-0.4,0.3),0.001, 0.01,0.,vec3(1.));
    body.d-=0.2;    
    sdf1.d = smin(body.d,sdf1.d,0.6);
    sdf1.d = smin(sdf1.d,sdEllipsoid( pt-vec3(0.,-.9,0.4), vec3(0.38,0.6,0.35),0.,vec3(1.)).d,0.2);
    sdf1.d = smin(sdf1.d,SphereSDF(vec4(0.0,-1.3,0.35,0.42),pt,0.,vec3(1.)).d,.25);
    
    //Hands
    sdfRes hand = sdEllipsoid(mirPt-vec3(.5,-.7-mirPt.x*mirPt.x*1.3,0.33), vec3(0.4,0.2+mirPt.y*mirPt.y*0.06,0.2),1.,vec3(1.));
    hand.d = smin(hand.d,sdEllipsoid(mirPt-vec3(0.74,-1.6,0.33), vec3(0.19,0.22,0.22),1.,vec3(0.)).d,0.3);    
    sdf1.d = smin(hand.d,sdf1.d,0.22);       
    
    //hair??
    sdf1.d = smin(sdf1.d ,SphereSDF(vec4(-0.9,0.8,-0.0,0.001),pt,1.,vec3(0)).d,0.79);
    
    //Eye socket    
    sdf1 = opSmoothSubtraction(SphereSDF(vec4(0.23,0.01,1.05,0.1), mirPt,1.,vec3(0.)),sdf1,0.05);
   
    //Top eyelids
    float eyeClose = mix(-0.13,-0.3,t);    
    sdfRes eyelids = opSmoothSubtraction(       
    sdBox(mirPt-vec3(0.23,eyeClose,0.95),vec3(0.16,0.15,0.3),0.,vec3(0.,1.,0.)),
    sdEllipsoid(mirPt-vec3(0.23,0.0,0.99), vec3(0.18,0.18,0.1),.0,vec3(1.,0.,0.)),0.1);
    
    sdf1.d = smin(sdf1.d,eyelids.d,0.02); 
    
    //Bottom eyelids
    sdfRes eyelids2 = opSmoothSubtraction(       
    sdEllipsoid(mirPt-vec3(0.23,0.09,.99), vec3(0.3,0.16,0.25),0.,vec3(1.,0.,0.)),
    sdEllipsoid(mirPt-vec3(0.23,0.0,.99), vec3(0.15,0.15,0.1),0.,vec3(1.,0.,0.))
    ,0.25); 
    
    sdf1.d = smin(sdf1.d,eyelids2.d,0.06);    
    
    //Eyes
    sdf1 = resMin(sdf1,GetEye(pt,vec3(0.23,0.02,1.01),vec3(0.145,0.15,0.038)));
    sdf1 = resMin(sdf1,GetEye(pt,vec3(-0.23,0.02,1.01),vec3(0.145,0.15,0.038)));
    
    //Mouth indent
    float scale = .7;
    sdfRes sdf2 = sdBox(pt/scale-vec3(0.,-0.36,1.5),vec3(0.26,0.00,0.01),0.,vec3(1.));
    sdf2.d -= 0.000;
    sdf2.d *= scale;
    sdf1.d = opSmoothSubtraction(sdf2.d,sdf1.d,0.12);
    
    //Upper lip
    scale=0.3;
    sdfRes ul = sdCone(pt/scale,vec3(0.,-0.8,2.4+t*0.009),vec3(0.,0.,2.4),1.35,0.5,0.,vec3(1.));
    ul.d-=0.01;
    ul.d*=scale;
    sdf1.d = smin(sdf1.d,ul.d,0.1);
    
    //Teeth
    sdfRes teeth = GetTeeth(pt-vec3(0.,-0.045,0.09-pt.x*pt.x*0.5),.9);
    sdf1 = resMin(sdf1,teeth);  
    
    //Shading
    if(sdf1.isVol!=0.)
    {    
        //Blush
        float c =clamp (0.,1.,length(vec3(0.55,-0.2,.99)-mirPt)*4.5);
        sdf1.col = mix(vec3(250.,180.,90.)/255.,vec3(1.),smoothstep(0.9,1.,c));    
        sdf1.isVol = clamp(0.,1., c);
        
        //Eyelid color
        c =clamp (0.,1.,length(vec3(0.22,0.02,.99)-mirPt)*4.9);
        sdf1.col = mix(vec3(171.,183.,236.)*0.8/255.,sdf1.col,smoothstep(0.99,1.,c));    
        sdf1.isVol = min(sdf1.isVol, c);      
        vec2 cen = vec2(0.0,-1.05);
        float rad = 0.04;
        float ang = -90.;
        vec2 curPos;
        for(float i=0.;i<6.;i++)
        {
            curPos = cen+step(0.1,i)*rad*2.5*vec2(cos(radians(ang)),sin(radians(ang)));
            c =clamp (0.,1.,length(curPos-pt.xy));
            if(c<rad)
            {
               sdf1.col = vec3(1.);    
               sdf1.isVol = 0.;       
            }
            ang-=60.*step(0.1,i);
        }
        
        
        //Right Eyebrow
        float x = sdParabola(pt.xy-vec2(0.27,0.3-t*0.006),0.14,-0.04);
        float lim = mix(0.001,0.03,smoothstep(.5,.20,pt.x));
        if(abs(x)<lim)
        {
            c = smoothstep(0.5,1.,clamp(0.,1.,invMix(-lim,lim,x)));
            sdf1.isVol = 0.2;
            sdf1.col = vec3(171.,183.,236.)*mix(1.,0.9,c)/255.;
        }
        
        //Left eyebrow
        x = sdParabola(pt.xy-vec2(-0.22,0.35-t*0.004),0.14,0.04);
        lim = mix(0.001,0.03,smoothstep(.5,.10,-pt.x));
        if(abs(x)<lim)
        {
            c = smoothstep(0.1,1., invMix(-lim,lim,x));
            sdf1.isVol = 0.2;
            sdf1.col = vec3(171.,183.,236.)*mix(1.,0.9,1.-c)/255.;
        } 
        
        
    }
  
    return sdf1; 
}

vec3 GetNormal(const vec3 pt)
{
    float d = GetModelSurf(pt).d;
    vec2 eps = vec2(0.001,0.0);
    vec3 n = vec3(d-GetModelSurf(pt-eps.xyy).d,
                       d-GetModelSurf(pt-eps.yxy).d,
                       d-GetModelSurf(pt-eps.yyx).d);
    return normalize(n);
}

sdfRes Raymarch(const vec3 ro, const vec3 rd)
{
   float d = 0.0;
    vec3 pt;
    float t=1.,dist=999.;
    sdfRes sdf,final;
    vec3 col;
    for(int i=0;i<MAX_STEPS;i++)
    {
        pt = ro + d * rd;
        sdf = GetModelSurf(pt);
        if(sdf.d<0.)        
        {
            float extinction = max(-sdf.d*30.,0.0);
            float transmittance = exp(-extinction * step_size);
            t *= transmittance;
            
            if(dist==999.) // Register surface details
            { 
                dist = d; 
                final = sdf;
            }
        }       
        d += sdf.d <0. ? step_size : max(sdf.d,step_size);
    }
    final.d = dist;
    final.a = 1.-t;
    return final;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{  
    vec2 uv = fragCoord/iResolution.xy-0.5;
    uv.x *= iResolution.x/iResolution.y; 
    
    vec3 bg = mix(vec3(0.,0.1,.4),vec3(0.),uv.y+1.);
    vec3  ldir =normalize(lightPos);

    vec3 ro = vec3(0.0,0.05,4.0);
    vec3 rd = normalize(vec3(uv-vec2(0.,0.05),3.0)-ro);
    sdfRes res = Raymarch(ro,rd);
    
    vec3 normal = GetNormal(ro+res.d*rd);    
    vec3 n01 = normal*0.5+0.5;     
    vec3 col;
    
    if(res.isVol==0. && res.d != 999.) //set alpha for non-volumes
    res.a=1.;
    
    col = mix(normal,baseCol,mix(0.0,1.,res.a));    
    col = mix(res.col,col,res.isVol);
    
    res.a = smoothstep(0.05,0.7,res.a);
    
    col = col* mix(0.6,1.,dot(normal,ldir));
    col = mix(bg,col,res.a);
    fragColor = vec4(col,1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'NsjGRt';
  }
  name(): string {
    return 'Soul - 22';
  }
  sort() {
    return 209;
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
