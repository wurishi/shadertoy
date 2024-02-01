import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define TYPE 4

#define ITR 130
#define FAR 7.
#define time iTime

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}

vec3 fold(in vec3 p)
{
    const vec3 nc = vec3(-0.5,-0.809017,0.309017);
    for(int i=0;i<5;i++)
    {
		p.xy = abs(p.xy);
		float t = 2.*min(0.,dot(p,nc));
		p -= t*nc;
	}
    return p;
}

float smax(float a, float b)
{
    const float k = 2.;
    float h = 1.-clamp(.5 + .5*(b-a)/k, 0., 1.);
    return mix(b, a, h) - k*h*(1.0-h);
}

float tri(in float x){return abs(fract(x)-0.5)*2.;}

float map(in vec3 p)
{
    vec3 fp = fold(p) - vec3(0.,0.,1.275);
    float d = mix(dot(fp,vec3(.618,0,1.)), length(p)-1.15,-3.6);
    
    #if (TYPE == 1)
    d += tri(fp.x*8.+fp.z*3.)*0.05+tri(fp.x*fp.y*40.+time*0.2)*0.07-0.17;
    d += tri(fp.y*5.)*0.04;
    d*= 0.9;
    #elif (TYPE == 2)
    d*= 0.7;
    d += sin(time+fp.z*5.+sin(fp.x*20.*fp.y*8.)+1.1)*0.05-0.08;
    d += sin(fp.x*20.*sin(fp.z*8.+time*0.2))*0.05;
    d += sin(fp.x*20.*sin(fp.z*8.-time*0.3)*sin(fp.y*10.))*0.05;
    #elif (TYPE == 3)
    d = smax(d+.5, -(d+sin(fp.y*20.+time+fp.z*10.)+1.5)*0.3)*.55;
    d += sin(max(fp.x*1.3,max(fp.z*.5,fp.y*1.))*35.+time)*0.03;
    #else
    d = smax(d+.5, -(d+sin(fp.z*10.+sin(fp.x*20.*fp.y*9.)+1.1)*0.3-0.3))*.5;
    #endif
    
    return d*0.25;
}

float march(in vec3 ro, in vec3 rd)
{
	float precis = 0.0005;
    float h=precis*2.0;
    float d = 0.;
    for( int i=0; i<ITR; i++ )
    {
        if( abs(h)<precis || d>FAR ) break;
        d += h;
	    float res = map(ro+rd*d)*0.8;
        h = res;
    }
	return d;
}

vec3 normal(in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.0001;
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy) );   
}

float curv(in vec3 p)
{
    vec2 e = vec2(-1., 1.)*0.03;
    
    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);
    
    return .15/(e.x*e.x) *(t1 + t2 + t3 + t4 - 4. * map(p));
}

float wav(in float x){return sin(x*6.283)*0.25+0.25;}
vec2 wav2(in vec2 p){return vec2(wav(p.x+wav(p.y*1.5)),wav(p.y+wav(p.x*1.5)));}

float wavenoise(in vec2 p)
{
    float z=2.;
    float z2=1.;
	float rz = 0.;
    vec2 bp = p;
    rz+= (wav(-time*0.5+p.x*(sin(-time)*0.3+.9)+wav(p.y-time*0.2)))*.7/z;
	for (float i=0.; i<=3.; i++ )
	{
        vec2 dg = wav2(bp*2.)*.8;
        dg *= mm2(time*.2);
        p += dg/z2;

        bp *= 2.4;
        z2 *= 1.05;
		z *= 2.4;
		p *= 1.4;
        
        rz+= (wav(p.x+wav(p.y)))/z;
	}
	return rz;
}

vec3 tex(in vec3 p)
{    
    #if (TYPE == 1)
    float rz= p.y*15.+p.x*30.+p.z*5.;
    vec3 col = (sin(vec3(.7,2.,.1-rz*0.2)+rz*.1+0.45))*0.5+0.5;
    #elif (TYPE==2)
    float rz= (sin(p.x*0.+p.z*20.)-p.y*20.);
    vec3 col = (sin(vec3(2.1,.7,.1)+rz*.09+4.15))*0.5+0.5;
    #elif (TYPE==3)    
    float rz= sin(p.z*3.+p.x*6.)*0.5+0.5;
    vec3 col = mix(vec3(.7,0.1,0.),vec3(1,.5,0.4),rz)*0.5+0.05;
    #else
    float rz= p.z*13.+p.x*30.;
    vec3 col = (sin(vec3(2.2,.7,.1)+rz*.1+4.2))*1.3+1.3;
    #endif
    
    return col;
}

//Bump mapping
float bumptex(in vec3 p)
{
    #if (TYPE == 1)
    return wavenoise(mix(p.zy,p.yx,1.)*0.55);
    #elif (TYPE == 2)
    return wavenoise(mix(p.yz,p.xy,.5)*0.55);
    #elif (TYPE == 3)
    return wavenoise(mix(p.zy,p.xy,.5)*0.44);
    #else
    return wavenoise(mix(p.zy,p.xy,.1)*0.55);
    #endif
}

vec3 bump(in vec3 p, in vec3 n)
{
    vec2 e = vec2(.01,0);
    float n0 = bumptex(p);
    vec3 d = vec3(bumptex(p+e.xyy)-n0, bumptex(p+e.yxy)-n0, bumptex(p+e.yyx)-n0)/e.x;
    n = normalize(n-d*.3);
    return n;
}

float shadow(in vec3 ro, in vec3 rd, in float mint, in float tmax)
{
	float res = 1.0;
    float t = mint;
    for( int i=0; i<15; i++ )
    {
		float h = map(ro + rd*t);
        res = min( res, 4.*h/t );
        t += clamp( h, 0.01, .1 );
        if(h<0.001 || t>tmax) break;
    }
    return clamp( res, 0.0, 1.0 );
}

float ao( in vec3 pos, in vec3 nor )
{
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float hr = 0.01 + 0.12*float(i)/4.0;
        vec3 aopos =  nor * hr + pos;
        float dd = map( aopos );
        occ += -(dd-hr)*sca;
        sca *= .95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );    
}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}
vec3 roty(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 q = fragCoord.xy/iResolution.xy;
    vec2 p = q-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy*1.5-.75;
	mo.x *= iResolution.x/iResolution.y;
    mo += vec2(time*0.03, time*0.04);
    
	vec3 ro = vec3(.0,0.0,-5.7);
    vec3 rd = vec3(p,1.2);
	ro = rotx(ro, -mo.y*3.0);ro = roty(ro, mo.x*3.0);
	rd = rotx(rd, -mo.y*3.0);rd = roty(rd ,mo.x*3.0);
	
    float rz = march(ro,rd);
    vec3 col = vec3(1.);
    
    if ( rz < FAR )
    {
        //setup
        vec3 pos = ro+rz*rd;
        float crv= curv(pos);
        vec3 nor = normal(pos);
       	vec3 fpos = fold(pos);
        vec3 lgt = normalize(vec3(.0, 1., 0.9));
        float shd = shadow( pos, lgt, 0.02, 3.0 );
        nor = bump(fpos, nor);
        
        //components
        float dif = max(dot(nor,lgt),0.0)*shd;
        float bac = max(0.2 + 0.8*dot(nor,vec3(-lgt.x,lgt.y,-lgt.z)),0.0);
        float fre = clamp(pow(1.0+dot(nor,rd),3.),0.,10.)*shd;
        vec3 haf = normalize(lgt - rd);
        float spe = pow(clamp(dot(nor,haf),0.0,1.0),50.0)*shd;
        float occ= crv*0.25+0.75;
		
        //compose
        col  = 0.2*occ + dif*vec3(1.0,0.8,0.6) 
            + 0.4*bac*vec3(1.0)*occ;
        col *= 0.5*pow(tex(fpos),vec3(.5));
        col += .4*fre*vec3(1.0) + .35*spe*vec3(1.0);
        col *= ao(pos,nor);
        col = pow(col,vec3(.75))*1.3;
    }
    
    //vignetting from iq
    col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.12 )*0.5+0.5;
	
	fragColor = vec4(col, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'ltlGWM';
  }
  name(): string {
    return 'Famous solid';
  }
  sort() {
    return 347;
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
