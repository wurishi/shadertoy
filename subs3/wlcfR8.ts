import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define ITR 200
#define FAR 200.

const float fov = 1.4;
float dfog = 0.;
float matid = 0.;

#define FLIP_SPEED 0.22
#define FLIP_REV 0.5
#define FLIP_CURVE 0.3


float an = 0.;

void sphere_fold(inout vec3 z, inout float dz, float rd1, float rd2) {
    float r2 = dot(z, z);
    if(r2 < rd1) 
    {
        float temp = (rd2 / rd1);
        z *= temp;
        dz *= temp;
    }
    else if(r2 < rd2) {
        float temp = (rd2 / r2);
        z *= temp;
        dz *= temp;
    }
}

void octfold(inout vec3 z, float octsize, float limit) {
    
    float odst = dot(abs(z), vec3(0.57735));
    
    if (odst > octsize)
    {
        vec3 sn = vec3(lessThanEqual(vec3(0.0), z))*2.0 - 1.0;
        vec3 n = vec3(sn)*0.57735;   
        float fdist = (odst - octsize);
        fdist = clamp(fdist, -limit, limit);
        z -= 2.0*n*fdist;
    }
}

mat2 rot(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}

float smoothfloor(in float x, in float k)
{
    k = clamp(k, 0., 1.);
    float xk = x+k*0.5;
    return floor(xk)+smoothstep(0.,1.,smoothstep(0.,k,fract(xk)));
}

float map(vec3 p)
{
    p.yz *= rot(an);
    p.xz *= rot(an);
    
    float an1 = sin(an*1.1*2.)*.2;
    float an2 = sin(an*1.4*2. + 1.)*3.;
    float an3 = cos(an*2.1*2.)*4.;
    
    float fixed_radius2 = 15.;
	float min_radius2 = 0.;
	float folding_limit = 8. + an2*.2;
	float scale = -1.85 + an1;
	float octsize = 8. + an3;
    
    vec3 c = p;
    float ds = 1.;
    for(int n = 0; n < 18; ++n) 
    {
        octfold(p, octsize, folding_limit);
        sphere_fold(p, ds, min_radius2, fixed_radius2);
        p = scale*p + c;
        ds = ds * abs(scale) + 1.;
    }
    return length(p)/abs(ds)*.8;
}

vec3 normal(const in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.04;   
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy) );   
}

float shadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
	float res = 1.0;
    float t = mint;
    for( int i=0; i<18; i++ )
    {
		float h = map( ro + rd*t );
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.2, 0.5);
        if( h<0.0005 || t>tmax ) break;
    }
    return clamp( res, 0.0, 1.0 );

}

float curvM(in vec3 p, in float w, vec3 n)
{
    float t1 = map(p + n*w*1.0), t2 = map(p - n*w*1.0);
    float t3 = map(p + n*w*3.0), t4 = map(p - n*w*3.0);
    float t5 = map(p + n*w*9.0), t6 = map(p - n*w*9.0);
    float t0 = map(p);
    return smoothstep(-.1, .9, (10.*(t1 + t2) + 1.*(t3 + t4) + 1.*(t5+t6) - 40.*t0))*3.0;
}

struct mtl{float rough; vec3 alb; vec3 f0;};
vec3 lgt = normalize( vec3(-.5, 0.3, -0.2) );
vec3 lcol = vec3(1.,0.9,0.8);

mat3 rot_x(float a){float sa = sin(a); float ca = cos(a); return mat3(1.,.0,.0,    .0,ca,sa,   .0,-sa,ca);}
mat3 rot_y(float a){float sa = sin(a); float ca = cos(a); return mat3(ca,.0,sa,    .0,1.,.0,   -sa,.0,ca);}
mat3 rot_z(float a){float sa = sin(a); float ca = cos(a); return mat3(ca,sa,.0,    -sa,ca,.0,  .0,.0,1.);}

//http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
vec3 shade(in vec3 pos, in vec3 rd)
{
    vec3 nor = normal(pos);
    	
    mtl m; //Material
    m.alb = vec3(0.25,0.4,0.8);
    m.rough = 0.5;
    m.f0 = vec3(.04);
    m.alb *= rot_y(sin(an*0.2 + 3.5)*0.2);
    
	float nl = clamp(dot(nor,lgt), 0., 1.);
	vec3 col = vec3(0.);
    
    if (nl > 0.)
    {
        nl *= shadow(pos, lgt, .8,15.)+0.0001;
        vec3 haf = normalize(lgt - rd);
        float nh = clamp(dot(nor, haf), 0., 1.); 
        float nv = clamp(dot(nor, -rd), 0., 1.);
        float lh = clamp(dot(lgt, haf), 0., 1.);
        float a = m.rough*m.rough;
        float a2 = a*a;
        float dnm = nh*nh*(a2 - 1.) + 1.;
        float D = a2/(3.14159*dnm*dnm);
        float k = pow(m.rough + 1., 2.)/8.; //hotness reducing
		float G = (1./(nl*(1. - k) + k))*(1./(nv*(1. - k) + k));
        vec3 F = m.f0 + (1. - m.f0) * exp2((-5.55473*lh - 6.98316) * lh); //"optimization"
        vec3 spec = nl*D*F*G;
        col = lcol*nl*(spec + m.alb*(1. - m.f0));		
    }
    col += 0.015*m.alb;
    float crv = curvM(pos, .17,nor);
    col *= sin(vec3(1.,1.9,2.9) + crv*.8 + an*1.5)*vec3(0.2,0.2,0.3) + vec3(0.9,0.8,0.55);
    col *= crv;
    return col;
}

vec3 marchAA(in vec3 ro, in vec3 rd, in vec3 bgc, in float px, in mat3 cam)
{
    float precis = px*0.1;
    float prb = precis;
    float t=map(ro);
	vec3 col = vec3(0);
	float dm=100.0,tm=0.0,df=100.0,tf=0.0,od=1000.0,d=0.;
	for(int i=0;i<ITR;i++)
    {
		d=map(ro+rd*t)*1.2;
		if(df==100.0)
        {
			if(d>od)
            {
				if(od<px*(t-od))
                {
					df=od;tf=t-od;
                    t += .01; //step forward a bit when the first occluder is found
				}
			}
			od=d;
		}
		if(d<dm){tm=t;dm=d;}
		t+=d;
		if(t>FAR || d<precis)break;
	}
	col=bgc;
    
	if(dm<px*tm)
        col=mix(shade((ro+rd*tm) - rd*(px*(tm-dm)) ,rd),col,clamp(dm/(px*tm),0.0,1.0));
    
	float qq=0.0;
	
    if((df==100.0 || tm==tf) && t < FAR)
    {
        ro+=cam*vec3(0.5,0.5,0.)*px*tm*1.;
        tf=tm;
        df=dm;
        qq= .01;
	}
    dfog = tm;
    return mix(shade((ro+rd*tf) - rd*(px*tf-df),rd),col,clamp(qq+df/(px*tf),0.0,1.0));
}

vec3 bgt(in vec3 rd)
{
    float sun = clamp(dot(lgt,rd),0.0,1.0 );
	vec3 c2 = mix( vec3(0.8,.95,1.1), vec3(1.,.8,0.55), sun );
    vec3 col = mix( vec3(0.2,0.6,.9), c2, exp(-(4.0+2.0*(1.0-sun))*max(0.0,rd.y-0.1)) );
    col *= 0.6;
	col += 0.8*vec3(1.0,0.8,0.7)*pow(sun,128.0);
	col += 0.3*vec3(1.0,0.6,0.2)*pow(sun,32.0);
    col += 0.1*vec3(1.0,0.6,0.2)*pow(sun,4.0);
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    float px= 1./(iResolution.y*fov);
	vec2 q = fragCoord.xy / iResolution.xy;
    vec2 p = q - 0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(0.,-0.02):mo;
	mo.x *= iResolution.x/iResolution.y;
    mo*=4.14;
    mo.y *= 0.6;
    mo.x += sin(iTime*0.2) + 2.5;
	
    vec3 ro = vec3(12.,-0.0, 70. + sin(iTime*0.5 + .5)*10.);
    vec3 rd = normalize(vec3(p,-fov));
    
    //an = smoothfloor((iTime + 20.)*FLIP_SPEED, FLIP_CURVE)*6.2831853*FLIP_REV;
    an = smoothfloor((iTime + 6.)*FLIP_SPEED, FLIP_CURVE)*6.2831853*FLIP_REV;
    
    mat3 cam = rot_x(-mo.y)*rot_y(-mo.x);
   	ro *= cam;
	rd *= cam;
    
    vec3 bg = bgt(rd);
    vec3 col = bg;
    
    col = marchAA(ro, rd, bg, px, cam);
    col = clamp(col, 0.,1.);
    col = mix(col, bg, smoothstep(70.,FAR, dfog)); //Distance fog
    
	col = pow(clamp(col,0.,1.), vec3(0.416667))*1.055 - 0.055; //sRGB

    col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1)*0.7+0.3;
    
	fragColor = vec4( col, 1.0 );
}

`;

export default class implements iSub {
  key(): string {
    return 'wlcfR8';
  }
  name(): string {
    return 'MandelOct';
  }
  sort() {
    return 355;
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
