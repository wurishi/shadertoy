import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define ITR 100
#define FAR 68.
#define time iTime

float matid = 0.;
float glw = 0.;

float tri(in float x){return abs(fract(x)-.5);}
vec3 tri3(in vec3 p){return vec3( tri(p.z+tri(p.y)), tri(p.z+tri(p.x)), tri(p.y+tri(p.x)));}

float trinz(in vec3 p, in float spd)
{
    float z=1.2;
	float rz = 0.;
    vec3 bp = p;
	for (float i=0.;i<=3.; i++)
	{
        p += (tri3(bp)*0.7+0.3+ time*spd);
        bp *= 2.1;
		z *= 1.3;
		p *= 1.22;
            
        rz+= (tri(p.z+tri(p.x+tri(p.y))))/z;
        bp += 0.13;
	}
	return rz;
}

float slength(in vec3 p){ return max(abs(p.x), max(abs(p.y), abs(p.z))); }
vec2 foldHex(in vec2 p)
{
    p.xy = abs(p.xy);
    const vec2 pl1 = vec2(-0.5, 0.8657);
    const vec2 pl2 = vec2(-0.8657, 0.5);
    p -= pl1*2.*min(0., dot(p, pl1));
    p -= pl2*2.*min(0., dot(p, pl2));
    return p;
}

float cycl(in float x)
{
    return mix(-abs(sin(x*7.31))*1.7+.7,abs(1.0+sin(x*4.0))*1.4-1.75, 0.7)*2.;
}

const mat2 m2 = mat2(1.6,-1.2,1.2,1.6);
float terrain(in vec2 p)
{
    p *= 0.015;
    vec2 bp =p;
    float z = 1.0;
	float rz = 0.0;
	for( int i=0; i<5; i++ )
	{
        rz += z*(cycl(p.x) + cycl(p.y));
		z *= 0.5 + 0.07*rz;
        p = m2*p + (rz-0.5)*0.09;
	}
    return rz;
}

float terrainHD( vec2 p )
{
    vec2 bp = p;
    p *= 0.015;
    float z = 1.0;
	float rz = 0.0;
	for( int i=0; i<8; i++ )
	{
        rz += z*(cycl(p.x) + cycl(p.y));
		z *= 0.5 + 0.07*rz;
        p = m2*p + (rz-0.5)*0.09;
	}
    
    rz += 0.1*textureLod(iChannel1, 0.06*bp,0.0).x;
    rz += 0.08*textureLod(iChannel1, 0.1*bp,0.0).x;
    rz += 0.08*textureLod(iChannel1, 0.25*bp,0.0).x;
	return rz;
}

mat2 rot(float a) {return mat2(cos(a),sin(a),-sin(a),cos(a));}
float map(vec3 p)
{   
  	vec3 bp = p;
    p.yz *= rot(1.5708);
    p.xy = foldHex(p.xy);
    p.x += 0.02;
    p.y += 1.35;
    p.xz = foldHex(p.xz);
    
	vec4 z = vec4(-abs(p),1.1);
    
    for (int i=0; i<7; i++)
    {
        z.xyz = clamp(z.xyz, -.3, .92) * 2.0 - z.xyz;
        z = z*2.36/clamp(dot(z.xyz, z.xyz), 0.25, 1.1)-vec4(0.45,0.3,1.33,0.);
        z.xy*=rot(-0.085);
    	z.zy*=rot(0.025);
    }
    
    //float d = (length(max(vec3(-10.), z.xyz)))/z.w;
    float d = (slength(max(vec3(-10.), z.xyz)))/z.w;
    
    bp.xz += vec2(-1951.,717.5);
    bp.y = abs(bp.y+5.7)-5.2;
    float tr = bp.y+1.5-terrain(bp.xz);
    d = min(d, tr);
    
    return d;
}

#if 0
float mapHD(in vec3 p)
{
    return map(p);
}
#else
float mapHD(vec3 p)
{   
    matid = 0.;
  	vec3 bp = p;
    p.yz *= rot(1.5708);
    p.xy = foldHex(p.xy);
    p.x += 0.02;
    p.y += 1.35;
    p.xz = foldHex(p.xz);
    
	vec4 z = vec4(-abs(p),1.1);
    
    for (int i=0; i<7; i++)
    {
        z.xyz = clamp(z.xyz, -.3, .92) * 2.0 - z.xyz;
        z = z*2.36/clamp(dot(z.xyz, z.xyz), 0.25, 1.1)-vec4(0.45,0.3,1.33,0.);
        z.xy*=rot(-0.085);
    	z.zy*=rot(0.025);
    }
    
    //float d = (length(max(vec3(-10.), z.xyz)))/z.w;
    float d = (slength(max(vec3(-10.), z.xyz)))/z.w;

    bp.xz += vec2(-1951.,717.5);
    bp.y = abs(bp.y+5.7)-5.2;
    float tr = bp.y+1.5-terrainHD(bp.xz);
    if (tr < d) matid = 1.;
    d = min(d, tr);
    
    return d;
}
#endif

float sign2( float x ) { return x>=0.0?1.0:-1.0; }
float bisect(in vec3 ro, in vec3 rd, in float near, in float far)
{
    float mid = 0.;
    float sgn = sign2(map(rd*near+ro));
    for (int i = 0; i < 5; i++)
    { 
        mid = (near + far)*.5;
        float d = map(rd*mid+ro)*1.;
        if (abs(d) < 0.005)break;
        d*sgn < 0. ? far = mid : near = mid;
    }
    return (near+far)*0.5;
}

float march(in vec3 ro, in vec3 rd, out float itrc)
{
	float precis = 0.006;
    float h=precis*2.0;
    float d = 0.;
    float told = 0.;
    for( int i=0; i<ITR; i++ )
    {
        if( abs(h)<precis || d>FAR ) break;
        told = d;
        d += h;
	    float res = map(ro+rd*d)*.85;
        glw += clamp(1.0/h,0.,1.); //Additive glow
        h = res;
        itrc++;
    }
    #if 1
    if (d < FAR)
    	d = bisect(ro, rd, told, d);
    #endif
	return d;
}

vec3 normal(in vec3 p, in float d)
{
    float px = 1./iResolution.y;
    vec2 e = vec2(-1., 1.)*.5*d*px;
	return normalize(e.yxx*mapHD(p + e.yxx) + e.xxy*mapHD(p + e.xxy) + 
					 e.xyx*mapHD(p + e.xyx) + e.yyy*mapHD(p + e.yyy) );   
}

float curv(in vec3 p, in float w)
{
    vec2 e = vec2(-1., 1.)*w;   
    
    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);
    return 1./e.y *(t1 + t2 + t3 + t4 - 4. * map(p));
}

float shadow(in vec3 ro, in vec3 rd)
{
	float rz = 1.;
    float d = 0.1;
    for( int i=0; i<10; i++ )
    {
		float res = map(ro + rd*d);
        rz = min(rz, 8.0*res/sqrt(d));
        d += max(res,0.1);
        if(res<0.001 || d>1.) break;
    }
    return clamp(rz, 0., 1.);
}

//----------------------------------------------------
//----------------------Sky---------------------------
//----------------------------------------------------
float noise2( in vec2 x ){return textureLod(iChannel0, x*.01,0.0).x;}
float tri2(in float x){return abs(fract(x)-0.8)*2.;}
mat2 m22 = mat2( 0.80,  0.60, -0.60,  0.80 );
float fbm( in vec2 p )
{	
	float z=2.;
	float rz = 0.;
	vec2 bp = p;
	for (float i= 1.;i <4.;i++ )
	{
        rz+= tri2(noise2(p)*1.25)/z;
        z *= 2.8;
        p = p*2.6;
       	p*=m22;
	}
	return rz;
}

vec3 sky(in vec3 rd, in vec3 lgt)
{   
    rd.y = abs(rd.y + 0.125);
    float pt = .7/(rd.y+0.45);
    
    vec3 bpos = pt*rd;
    bpos *= 2.;
    vec2 p = bpos.zx;
    vec4 col = vec4(0);
    vec4 sum = vec4(0);
    p*= 1.;
    vec2 pp = p;
    float tz = 0.;
    float t= time + 500.;
    for(float i=4.;i>=0.;i--)
    {
        p = bpos.zx + (i+1.)*0.003*t;
        p += i*30.;
        p*= ((4.-i)*0.2+0.8);
        p *= 1.4;
        
        float rz= fbm(p);
        float rg = rz;
        vec3 clx = (sin(vec3(.95,4.1,3.8)+i*.1-1.25))*rz;
        float ds = 1.;
        for(float i=0.;i<3.;i++)
        {
            float dif2 = clamp(rg-fbm(p+lgt.zx*0.01*ds)*.85,0.05,1.)*rz*rz;
            clx += dif2*1.*vec3(1,0.8,.6);
            ds = ds*2.+1.;
        }
        col = vec4(clx,rz);
		col.rgb *= col.a*1.5;
		sum = sum + col*(1. - sum.a);
        
        tz += rz;
    }
    sum.rgb *= 1.-(1.-clamp(rd.y*7.-.5,0.,1.))*vec3(1.0,.9,.75);
    
    return sum.rgb*0.9;
}
//----------------------------------------------------
//----------------------------------------------------
//----------------------------------------------------

//Based on: http://www.iquilezles.org/www/articles/fog/fog.htm
vec3 fog(vec3 ro, vec3 rd, vec3 col, vec3 lgt, float ds)
{
    ro.y += 5.;
    const float b= 0.4;
    float den = 0.15*exp(-ro.y*b)*(1.0-exp( -ds*rd.y*b ))/rd.y;
    return mix(col, vec3(0.08,0.06,0.3), clamp(den, 0.,.7));
}

vec3 shade(in vec3 pos, in vec3 ro, in vec3 rd, in vec3 lgt)
{
    vec3 col = vec3(0);
    
    float crv= curv(pos,.005);
    float d= distance(ro,pos);
    vec3 nor = normal(pos,d);
    float mat = matid;
    float shd = shadow( pos, lgt)*0.7+0.3;

    
    if (mat == 0.)
    {
        float dif = max(dot(nor,lgt),0.0)*shd;
        float bac = max(0.2 + 0.8*dot(nor,vec3(-lgt)),0.0);
        float fre = clamp(pow(1.0+dot(nor,rd),3.),0.,1.5)*shd;
        vec3 haf = normalize(lgt - rd);
        float spe = pow(clamp(dot(nor,haf),0.0,1.0),50.0)*shd;
        float occ= crv*0.8+0.2;
        occ *= trinz(pos*10., 0.0)+0.2;
		vec3 lcol = vec3(1.0,.9,0.9);
        col  = 0.2*occ + dif*lcol + 0.2*bac*occ*lcol;
        col *= pos.y*0.07+0.55;
        col *= vec3(.4,.4,.2)+(trinz(pos*4.,0.)*.7+0.3);
        col += .1*fre*vec3(1.0) + .2*spe*vec3(1.0);
        col = clamp(col, 0.,1.);
        col = pow(col,vec3(.9));
        col -= sin(vec3(1.1,1.5,2.7)+crv*.3*(dif*0.9+0.1))*0.27;
    }
    else
    {
        float dif = (max(dot(nor,lgt),0.0)*0.65+0.2)*shd;
        float bac = max(0.2 + 0.8*dot(nor,vec3(-lgt)),0.0);
        float fre = clamp(pow(1.0+dot(nor,rd),3.),0.,1.5)*shd;
        vec3 haf = normalize(lgt - rd);
        float spe = pow(clamp(dot(nor,haf),0.0,1.0),50.0)*shd;
        col  = 0.1 + dif*vec3(1.0,.95,0.9) + 0.3*bac*vec3(1.0);
        col *= pos.y*0.06+0.65;
        col *= vec3(.95,.95,1.);
        col += .05*fre*vec3(1.,.7,1.) + .1*spe*vec3(1.0);
        col = clamp(col, 0.,1.);
        col = pow(col,vec3(.9));
        col -= sin(vec3(2.,1.,2.4)+texture(iChannel1,pos.xz*0.01).r*.3 + .05)*0.33;
    }
    
    col = fog(ro, rd, col, lgt, d);
    
    return clamp(col,0.,1.);
}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}
vec3 roty(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}
vec3 rotz(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z);
}

vec3 flare(in vec3 ro, in vec3 rd, in float t, in vec3 lpos)
{
    float dotl = dot(lpos - ro, rd);
    dotl = clamp(dotl, 0.0, t);

    vec3 near = ro + rd*dotl;
    float ds = dot(near - lpos, near - lpos);
    float prg = time*0.022;
    ds *= sin(time*50.*sin(time))*(0.1-clamp(0.,0.097,prg*0.1))+(3.-clamp(0.,2.95,prg));
	return (vec3(.3,0.4,1.) * .007/(ds*sqrt(ds)));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 q = fragCoord.xy/iResolution.xy;
    vec2 p = q-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(-0.42,-0.0):mo;
	mo.x *= iResolution.x/iResolution.y;
	mo*= 4.7;
    mo.y -= .3;
    mo.y *= 0.2;
    mo.x += time*0.04 + smoothstep(65., 100., time)*2.;
    
    mo.y += sin(time*0.07+1.5)*0.6;
    mo.y *= smoothstep(-4.,10., time);
    
    vec3 ro = vec3(.9-sin(time*0.1+2.)*0.4,.9,2.6);
    vec3 rd = normalize(vec3(p,-1.15));
    rd.xy += sin(time*50.*sin(time*100.))*0.0008*smoothstep(0.,175.,time);
    
    ro.z += sin(time*0.1-1.5)*0.7;
    ro.y += sin(time*0.07-1.7)*1.8;
    
    rd = rotx(rd,mo.y);
    ro = roty(ro,mo.x), rd = roty(rd,mo.x);
	
    vec3 lgt = normalize(vec3(-1., .4, -0.2));
    float count = 0.;
	float rz = march(ro,rd, count);
	
    vec3 col = vec3(1.,0.9,1.) * pow(max(dot(rd,lgt),0.),20.)*vec3(0.5,0.65,1.0)*0.8;
    col += sky(rd, lgt).rgb;
    vec3 pz = ro + rd*dot(-ro, rd);
    pz = mix(pz,rd,.5);
    
    if ( rz < FAR )
    {
        vec3 pos = ro+rz*rd;
        col = shade(pos,ro,rd,lgt);
        col += pow(glw,0.75)*.005*vec3(.3,0.2,0.7)*smoothstep(-2.,-6.,pos.y);
    }
    else
    {
        col += pow(abs(glw),0.75)*.02*vec3(.4,0.3,0.9)*(trinz(vec3(pz*.5),0.1)*0.5+0.5);
    }
    
    col += flare(ro,rd,rz,vec3(0,1.,0));
    
    vec2 r = q*2.0 - 1.0;
    col *= smoothstep(2.,0.3,length(r*r*r*r)*1.);
    col *= smoothstep(0.,3., time);
    col = smoothstep(-0.13,1.,col);
    
    
    col *= vec3(1.0,1.0,.9);
    col = pow( col, vec3(1.15,.95,.95) );
    
    vec4 past = texture(iChannel2, q);
    if (count != past.w && rz < FAR) col = mix(col, past.rgb, 0.5);
    count = mix(count, past.w, clamp(0.2, 0.5, 0.5 - rz*0.01));
    
    col = mix(col, past.rgb, 0.2);
    
	fragColor = vec4(col, count);
}
`;

export default class implements iSub {
  key(): string {
    return 'XtdGDB';
  }
  name(): string {
    return 'Myrror';
  }
  sort() {
    return 340;
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
    return [
      { type: 4 },
      webglUtils.ROCK_TEXTURE, //
    ];
  }
}
