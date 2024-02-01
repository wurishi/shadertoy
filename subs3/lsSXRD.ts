import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//distance to the xy plane
#define HEIGHT 9.

//Far distance for the axial grid
#define GFAR 15.

//perspective/orthographic factor 0...2
#define PERSP .5

//determines how fast the root finder moves in, needs to be lowered when dealing with thin "peaks"
//the problem is if the intersector crosses the function twice in one step.
#define BASE_STRIDE .5

//draw a lined grid on the function's surface (just projected)
#define DRAW_GRID

//Max iterations and max distance
#define ITR 80
#define FAR 35.
#define PRECISION 0.003

#define time iTime
#define GFAR2 ((GFAR)+(HEIGHT))
#define pi 3.1415926535
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}

float f(in float x, in float y)
{
    float fxy = 0.;
    
    //____________Define Function here_____________
    fxy = x*x-y*y;
    //fxy = (abs(fract(x*0.5)-0.5)+abs(fract(y*0.5)-0.5))*3.-1.5;
    //fxy = (sin(x*3.14*.5)+sin(y*3.14*.5))*1.;
    //fxy = sin(x*3.*cos(y*.5));
    //fxy = abs(x)+abs(y)-5.;
	return fxy;
}


float bisect( in vec3 ro, in vec3 rd, in float near, in float far)
{
    float mid = 0.;
    vec3 p = ro+rd*near;
    float sgn = f(p.x, p.y)-p.z;
    for (int i = 0; i < 9; i++)
    { 
        mid = (near + far)*.5;
        p = ro+rd*mid;
        float d = f(p.x, p.y)-p.z;
        if (abs(d) < PRECISION)break;
        d*sgn < 0. ? far = mid : near = mid;
    }
    return (near+far) * .5;
}

float intersect( in vec3 ro, in vec3 rd)
{
    float t = 0.;
    float d = 1000.;
    const float ep = 1.;
    const int itr = ITR;
    vec3 p = ro+rd*t;
    float sgn = sign(f(p.x, p.y)-p.z);
    bool doBisect = false;
    //float dir = 1.;
    float stride = BASE_STRIDE;
    float told = t;
    //evaluate
    for (int i=0;i<=itr;i++)
    {
        //Evaluate
    	p = ro+rd*t;
        float fp = f(p.x, p.y);
        d = fp*sgn+p.z*-sgn;
        
        if (abs(d) < PRECISION || t >= FAR) break;
        if (i == itr)t = FAR;
        
        if (sign(fp-p.z) != sgn)
        {
            doBisect = true;
            break;                      
        }
        
        told = t;
        t += log(abs(d)+1.1)*stride;
    }
    
    if (doBisect)t = bisect(ro,rd,told,t);
    
    return t;
}

vec2 grad(vec3 p)
{
    float ep = .05;
    float grdx = ( ( (f(p.x+ep, p.y)) - (f(p.x-ep, p.y)) ));
    float grdy = ( ( (f(p.x, p.y+ep)) - (f(p.x, p.y-ep)) ));
    
    return vec2(grdx,grdy);
}

float icyl( in vec3 ro, in vec3 rd, in vec4 sph )
{
    vec3  d = ro - sph.xyz;
    float a = dot( rd.xz, rd.xz );
    float b = dot( rd.xz, d.xz );
    float c = dot( d.xz, d.xz ) - sph.w*sph.w;
    float t;

    t = b*b - a*c;
    if( t>0.0 )
    {
        t = -(b+sqrt( t ))/a;
    }

    return t-.001;

}

vec2 opU( vec2 d1, vec2 d2 ){ return (d1.x<d2.x) ? d1 : d2; }

vec2 map(vec3 p)
{
    vec3 bp = p;
    const float w = 0.015;
    vec2 d = vec2(max(length(p.yz)-w*2.3,-p.x), 10.);
    d = opU(d,vec2(max(length(p.xz)-w*2.3,-p.y), 11.));
    p = vec3(bp.x,fract(bp.y+0.5)-0.5,bp.z);
    d = opU(d,vec2(length(p.yz)-w, 0.));
    p = vec3(fract(bp.x+0.5)-0.5,bp.y,bp.z);
    d = opU(d,vec2(length(p.xz)-w, 1.));
	return d;
}

vec2 march(in vec3 ro, in vec3 rd)
{
	float precis = 0.02;
    float h=precis*2.0;
    float d = 0.;
    float n = 0.;
    for( int i=0; i<50; i++ )
    {
        if( abs(h) < precis || d>GFAR2 ) break;
        else if (i == 49)h = 1000.;
        d += h;
	    vec2 res = map(ro+rd*d);
        h = res.x;
        n = res.y;
    }
	return vec2(d,n);
}

vec3 normal(const in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.01;   
	return normalize(e.yxx*map(p + e.yxx).x + e.xxy*map(p + e.xxy).x + 
					 e.xyx*map(p + e.xyx).x + e.yyy*map(p + e.yyy).x );   
}

vec3 ligt;

vec3 drawAxes(in vec3 ro, in vec3 rd, in vec3 col, in float h)
{
    vec2 rz = march(ro,rd);
    vec3 col2 = vec3(0.);
    if (rz.x < GFAR2)
    {
        vec3 pos = ro+rd*rz.x;
        vec3 nor = normal(pos);
        if (rz.y >= 10.)
        {
            col2 = mix(vec3(1.,.1,.1),vec3(.1,1.,.1),rz.y-10.)*.85+0.25;
            col2 *= col2;
        }
        else col2 = mix(vec3(1.,.1,.1),vec3(.1,1.,.1),rz.y)*0.7+0.1;
        float nl = clamp(dot(nor,ligt),0.,1.);
        vec3 dcol = mix(col2,vec3(1.,.9,.75),.5);
        col2 = nl*dcol*0.4+col2*0.6;
        col2 = mix(col,col2,smoothstep(GFAR2,GFAR2-10.,rz.x));
        if (h < 0. && ro.z > 0. || h > 0. && ro.z < 0.) col = mix(col,col2,1.);
        else col = mix(col,col2,0.2);
    }
    
    //raytrace the Z-axis line (marching edge-on is a bad idea)
    float cyl = icyl(ro.yzx,rd.yzx,vec4(0.,0.,0.,0.04));
    if (cyl >0.)
    {
        vec3 pos = ro+rd*cyl;
        if (pos.z > 0. )
        {
        	col2 = vec3(0.3,0.3,1.)*smoothstep(-.2,.05,-abs(pos.x*2.));
        	col = mix(col,col2,0.6);
        }
    }
    
    return col;
}

//iq's ubiquitous 3d noise
float noise(in vec3 p)
{
    vec3 ip = floor(p), f = fract(p);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (ip.xy+vec2(37.0,17.0)*ip.z) + f.xy;
	vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
	return mix(rg.x, rg.y, f.z);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    ligt = normalize(vec3(sin(time*0.5),2.,cos(time*0.5)));
    
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 um = iMouse.xy / iResolution.xy-.5;
    um = (um ==vec2(-.5))?um=vec2(-0.005,-0.01):um;
	um *= 3.14159265*2.;
    //camera
    const float ortho = PERSP+1.;
    
    vec3 ro = vec3(p*ortho*2.,HEIGHT);
    vec3 rd = normalize(vec3(p*2./ortho,-1.*ortho));
   	
    //rotation
    mat2 ry = mm2(um.y);
    mat2 rx = mm2(um.x);
    ro.yz *= ry;
    ro.xz *= rx;
    rd.yz *= ry;
    rd.xz *= rx;

    float rz = intersect(ro,rd);
    
    //background
    vec3 col = vec3(0.1,0.2,0.3)+dot(ligt,rd)*.5+.5;
    col = mix(col,vec3(noise(rd*3.)),0.3);
    
    vec3 pos = ro+rd*rz;
    
    //shadng
    if (rz < FAR)
    {
        float h = smoothstep(-5.,5.,pos.z);
        const vec3 r = vec3(.7,0.02,0.02);
        const vec3 g = vec3(0.02,.7,0.02);
        vec3 col2 = mix(g,r,h);
        col2 *= 1.+abs(pos.z*1.)*.2;

        vec2 grd = grad(pos);
        vec3 nor = normalize(vec3(grd.x, .5, grd.y));
        float nl = clamp(dot(nor,ligt),0.,1.);
        col2 *= nl;
        #ifdef DRAW_GRID
        col2 *= smoothstep(-1.,-.99,cos(2.*pos.x*pi+pi))*0.5+0.5;
        col2 *= smoothstep(-1.,-.99,cos(2.*pos.y*pi+pi))*0.5+0.5;
        #endif
        vec3 rf = reflect(rd,nor);
        vec3 tex = vec3(noise(rf*3.));
        col2 = mix(col2,tex,0.2);
        col = mix(col,col2,.9);
    }
    
    
    col = drawAxes(ro,rd,col, pos.z);
    
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'lsSXRD';
  }
  name(): string {
    return '3d Graphing';
  }
  sort() {
    return 353;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
    return [webglUtils.DEFAULT_NOISE];
  }
}
