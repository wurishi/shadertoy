import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define ITR 120
#define FAR 30.
#define time iTime

const float fov = 1.5;

float dfog = 0.;
float matid = 0.;
vec2 mous = vec2(0.);
float pxx =0.;

//----------------------------Utility----------------------------

//iq's ubiquitous 3d noise
float noise(in vec3 p)
{
	vec3 ip = floor(p);
    vec3 f = fract(p);
	f = f*f*(3.0-2.0*f);
	
	vec2 uv = (ip.xy+vec2(37.0,17.0)*ip.z) + f.xy;
	vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
	return mix(rg.x, rg.y, f.z);
}

float sbox(in vec3 p, in vec3 b)
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

vec2 foldPent(in vec2 p)
{
    p.x = abs(p.x);
    const vec2 pl1 = vec2(0.809, 0.5878);
    const vec2 pl2 = vec2(-0.309, 0.951);
   	const vec2 pl3 = vec2(-0.809, 0.5878);
    p -= pl1*2.*min(0., dot(p, pl1));
    p -= pl2*2.*min(0., dot(p, pl2));
    p -= pl3*2.*min(0., dot(p, pl3));
    return p;
}

float cyl(in vec3 p, in vec2 h)
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float smin(in float a, in float b)
{
    float k = .15;
	float h = clamp(0.5 + 0.5*(b-a)/k, 0., 1.);
	return mix( b, a, h ) - k*h*(1.0-h);
}

//---------------------------------------------------------------

float map(in vec3 p)
{
    float r =length(p);
    vec2 sph = vec2(acos(p.y/r), atan(p.x, p.z));
    
    matid = 1.;
    float d = r-1.; 
    d += sin(sph.y*7.)*0.02;
    d += sin(sph.y*20.)*0.002;
    float gbh = sin((sph.x+sph.y)*7.+0.5)*0.5+0.5;
    d += sin(sph.y*40.)*0.001*gbh;
    d += sin(sph.x*1.85+2.7)*0.3;
    
    //Leaves
    vec3 p2 = p;
    float rxz2 = dot(p.xz,p.xz);
    float rxz = sqrt(rxz2);
    rxz = exp2(rxz*6.-5.);
    p2.xz = foldPent(p2.xz);
    p2.y -= sqrt(rxz)*0.17 + sin(rxz*2.+p.z*p.x*10.)*0.05;
    float leaves = sbox(p2+vec3(0,-.92-smoothstep(-0.01,.05,rxz2)*0.05,0),vec3(.07- rxz*0.1,0.002+p2.x*0.15,0.8));
    leaves = smin(leaves, cyl(p+vec3(sin(p.y*3.5 + 0.8)*0.3 + 0.3,-1.1,0),vec2(.05,.25))); //Tail
    if (leaves < d)matid = 2.;
    d = min(d, leaves);
    
    float flor = p.y+.65;
    if (flor < d)matid = 0.;
    d = min(d, flor);
    return d;
}

vec3 normal(in vec3 p, in vec3 rd)
{
    vec2 e = vec2(-1., 1.)*2e-5;
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy));   
}

float getAO(in vec3 pos, in vec3 nor)
{
	float rz = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float hr = 0.02 + 0.025*float(i);
        vec3 aopos =  nor*hr + pos;
        float dd = map(aopos);
        rz += -(dd-hr)*sca;
        sca *= 0.8;
    }
    return clamp(rz*-3.+1., 0., 1.);
}

float shadow(in vec3 ro, in vec3 rd, in float mint, in float tmax, in float sft)
{
	float rz = 1.0;
    float t = mint;
    for( int i=0; i<20; i++ )
    {
		float h = map(ro + rd*t);
        rz = min(rz, sft*h/t);
        t += clamp(h, 0.01, .1);
        if(h<0.0001 || t>tmax) break;
    }
    return clamp(rz, 0.0, 1.0);
}

float bnoise(in vec3 p)
{
    p*= 2.5;
    float n = noise(p*10.)*0.8;
    n += noise(p*25.)*0.5;
    n += noise(p*45.)*0.25;
    return (n*n)*0.004;
}

vec3 bump(in vec3 p, in vec3 n, in float ds)
{
    vec2 e = vec2(.007,0);
    float n0 = bnoise(p);
    vec3 d = vec3(bnoise(p+e.xyy)-n0, bnoise(p+e.yxy)-n0, bnoise(p+e.yyx)-n0)/e.x;
    n = normalize(n-d*2.5/sqrt(ds));
    return n;
}
    
vec3 lgt = normalize( vec3(-.05, .19, -0.11) );
vec3 lcol = vec3(1.,1.,1.);

vec3 hsv2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
	return c.z * mix( vec3(1.0), rgb, c.y);
}

//PBR math from: http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
vec3 shade(in vec3 pos, in vec3 rd, in float dst)
{
    vec3 nor = normal(pos,rd);
  	float nl = clamp(dot(nor,lgt), 0., 1.);
    float ripe = smoothstep(0.2,2.2,(mous.y + noise(pos*1.5)))*0.22;
    vec3 albhsv = vec3(0.003+ripe, .99-ripe*0.5,.5);
    float nz = (noise(pos*150.)-0.5)*0.035; //Skin imperfections
    albhsv.z += nz;
    albhsv.y -= nz;
    vec3 f0hsv = vec3(0.01,.5,.15);
    float soft = 2.;
    float rough = 0.5;
	float mtid = matid;
    if (matid == 0.) //floor/walls
    {
        albhsv = vec3(1.,.0,1.);
        soft = 8.;
    } 
    else if (matid == 2.) //Leaves/Tail
    {
        float nz2 = noise(pos*17.)*0.8;
        nz2 += noise(pos*70.)*0.8;
        
        nor = bump(pos,nor,dst);
        nl = clamp(dot(nor,lgt), 0., 1.);
        albhsv = vec3(.25 + nz2*0.07 - (1.-mous.y)*0.05, .9,.35- nz2*0.15 - (1.-mous.y)*0.08);
        rough = 0.7;
    }
    
    //Artistic shading
    float stp = step(mous.x,pxx);
    albhsv.x += ((nl-.7)*0.08)* stp; //Hue variation
    float vari = sin(nl*6.28*0.5-1.5708);
    albhsv.y += vari*0.1*stp; //Saturation variation
    albhsv.z += vari*0.12*stp; //Value variation
    //albhsv.z += sin(nl*6.28*1.+3.14159)*0.13*stp; //Can be higher freqency
    
    vec3 alb = hsv2rgb(albhsv);
    vec3 f0 = hsv2rgb(f0hsv);
    
	vec4 col = vec4(0.);
    
    if (nl > 0.)
    {
        nl *= shadow(pos, lgt, 0.01,2.5, soft)*0.9+0.1;
        vec3 haf = normalize(lgt - rd);
        float nh = clamp(dot(nor, haf), 0., 1.); 
        float nv = clamp(dot(nor, -rd), 0., 1.);
        float lh = clamp(dot(lgt, haf), 0., 1.);
        float a = rough*rough;
        float a2 = a*a;
        float dnm = nh*nh*(a2 - 1.) + 1.;
        float D = a2/(3.14159*dnm*dnm);
        float k = pow(rough + 1., 2.)/8.; //hotness reducing
		float G = (1./(nl*(1. - k) + k))*(1./(nv*(1. - k) + k));
        vec3 F = f0 + (1. - f0) * exp2((-5.55473*lh - 6.98316) * lh); //exp2 "optimization"
        vec3 spec = nl*D*F*G;
        col.rgb = lcol*nl*(spec + alb*(1. - f0));
        col.a = nl;
    }
    
    float h = clamp(pos.y*2.+.85,0.01,1.);
    
    //Hemispherical bounce lights (GI fakery)
    float bnc = clamp(dot(nor, normalize(vec3(lgt.x,0.0,lgt.z)))*.5+0.28,0. , 1.);
    col.rgb += lcol*alb*bnc*0.25 *h* (1.-col.a);
    float bnc2 = clamp(dot(nor, vec3(-lgt.x,lgt.y,-lgt.z))*.5+0.28,0. , 1.);
    col.rgb += lcol*alb*bnc2*0.1 *h* (1.-col.a);
    
    col.rgb += 0.02*alb;
   	col *= getAO(pos,nor);
    return col.rgb;
}

vec3 marchAA(in vec3 ro, in vec3 rd, in vec3 bgc, in float px)
{
    float precis = px*.01;
    float prb = precis;
    float t=map(ro);
	float dm=100.0,tm=0.0,df=100.0,tf=0.0,od=1000.0,d=0.;
	for(int i=0;i<ITR;i++)
    {
		d=map(ro+rd*t);
		if(df==100.0)
        {
			if(d>od)
            {
				if(od<px*(t-od))
                {
					df=od; tf=t-od;
                    t += .05;
				}
			}
			od=d;
		}
		if(d<dm){tm=t;dm=d;}
		t+=d;
		if(t>FAR || d<precis)break;
	}
	vec3 col=bgc;
    
	if(dm<px*tm)
        col=mix(shade((ro+rd*tm) - rd*(px*(tm-dm)) ,rd, tm),col,clamp(dm/(px*tm),0.0,1.0));
	
    float qq=0.0;
    if((df==100.0 || tm==tf) && t < FAR)
    {
        ro+=vec3(0.5,0.5,0.)*px*tm*1.;
        tf=tm;
        df=dm;
        qq=.01;
	}
    dfog = tm;
    return mix(shade((ro+rd*tf) - rd*(px*tf-df),rd, tf),col,clamp(qq+df/(px*tf),0.0,1.0));
    
}

mat3 rot_x(float a){float sa = sin(a); float ca = cos(a); return mat3(1.,.0,.0,    .0,ca,sa,   .0,-sa,ca);}
mat3 rot_y(float a){float sa = sin(a); float ca = cos(a); return mat3(ca,.0,sa,    .0,1.,.0,   -sa,.0,ca);}
mat3 rot_z(float a){float sa = sin(a); float ca = cos(a); return mat3(ca,sa,.0,    -sa,ca,.0,  .0,.0,1.);}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    float px= 1.5/(iResolution.y*fov);
	vec2 q = fragCoord.xy / iResolution.xy;
    pxx = q.x;
    vec2 p = q - 0.5;
	float asp =iResolution.x/iResolution.y;
    p.x *= asp;
	vec2 mo = iMouse.xy / iResolution.xy;
    mo = (mo==vec2(.0))?mo=vec2(0.5,0.1):mo;
    mous = mo;
	
    vec3 ro = vec3(0., 0., 4.5+sin(time*0.2)*0.5);
    vec3 rd = normalize(vec3(p,-fov));
    
    mat3 cam = rot_x(0.4+sin(time*0.7)*.1)*rot_y(sin(time*0.35)*1.3+4.);
    ro *= cam;rd *= cam;
    
    vec3 bg = vec3(1.);
    vec3 col = vec3(0);
    
    col = marchAA(ro, rd, bg, px);
    
    col = clamp(col, 0.,1.);
    
    col = mix(col, bg, smoothstep(FAR-20.,FAR, dfog)); //Distance fog
    col *= smoothstep(0.,.005,abs(mous.x-pxx));//Separator
	col = pow(clamp(col,0.,1.), vec3(0.416667))*1.055 - 0.055; //sRGB
    col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1)*0.85+0.15; //Vign
    
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'Xtj3Dm';
  }
  name(): string {
    return 'Artistic shading';
  }
  sort() {
    return 305;
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
  channels() {
    return [{ ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
