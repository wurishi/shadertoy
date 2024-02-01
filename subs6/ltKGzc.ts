import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// ***********************************************************
// Alcatraz / Rhodium 4k Intro Fractalscape
// by Jochen "Virgill" Feldkötter
//
// 4kb executable: http://www.pouet.net/prod.php?which=68239
// Youtube: https://www.youtube.com/watch?v=YK7fbtQw3ZU
// ***********************************************************

int meep =0;






// 	rotation
void pR(inout vec2 p,float a) 
{
	p=cos(a)*p+sin(a)*vec2(p.y,-p.x);
}

// 	3D noise function (IQ)
float noise(vec3 p)
{
	vec3 ip=floor(p);
    p-=ip; 
    vec3 s=vec3(7,157,113);
    vec4 h=vec4(0.,s.yz,s.y+s.z)+dot(ip,s);
    p=p*p*(3.-2.*p); 
    h=mix(fract(sin(h)*43758.5),fract(sin(h+s.x)*43758.5),p.x);
    h.xy=mix(h.xz,h.yw,p.y);
    return mix(h.x,h.y,p.z); 
}

// 	kifs fractal (shane)
float kifs(vec3 p)
{
    vec3 offs = vec3(1, .75, .5); 
    vec2 a = sin(vec2(0, 1.57) + 1.57/2.);
    vec2 b = sin(vec2(0, 1.57) + 1.57/4.);
    float s = 5.;// scale factor
    float d = 1e5; // distance
    p  = abs(fract(p*.5)*2. - 1.);
    float amp = 1./s; 
    for(int i=0; i<5; i++)
    {
        // rotation
       	p.xy=mat2(a.y,-a.x,a)*p.xy;
       	p.yz=mat2(b.y,-b.x,b)*p.yz;
        p=abs(p);
    	if (p.x<p.y)p.xy=p.yx;
        if (p.x<p.z)p.xz=p.zx;
        if (p.y<p.z)p.yz=p.zy;
		p = p*s + offs*(1. - s);
        p.z -= step(p.z, offs.z*(1. - s)*.5)*offs.z*(1. - s);
        p=abs(p);
        d = min(d, max(max(p.x, p.y), p.z)*amp);
        amp /= s; 
        // abimation
        if(i==1&&p.x>(9.+1.*sin(0.209*iTime+1.))) meep = 1;
    }
 	return d - 0.29;
}

float map(vec3 p)
{	
// 	fractalscape 
    float f = -0.05-kifs(.4*p);
	if(meep==0) f+=0.002*noise(p*70.);
	return f;
}

//	normal calculation
vec3 calcNormal(vec3 pos)
{
    float eps=0.0001;
	float d=map(pos);
	return normalize(vec3(map(pos+vec3(eps,0,0))-d,map(pos+vec3(0,eps,0))-d,map(pos+vec3(0,0,eps))-d));
}

// 	standard sphere tracing inside and outside
float castRayx(vec3 ro,vec3 rd) 
{
    float function_sign=(map(ro)<0.)?-1.:1.;
    float precis=.0001;
    float h=precis*2.;
    float t=0.;
	for(int i=0;i<120;i++) 
	{
        if(abs(h)<precis||t>12.)break;
		h=function_sign*map(ro+rd*t);
        t+=h;
	}
    return t;
}

// 	refraction
float refr(vec3 pos,vec3 lig,vec3 dir,vec3 nor,float angle,out float t2, out vec3 nor2)
{
    float h=0.;
    t2=2.;
	vec3 dir2=refract(dir,nor,angle);  
 	for(int i=0;i<50;i++) 
	{
		if(abs(h)>3.) break;
		h=map(pos+dir2*t2);
		t2-=h;
	}
    nor2=calcNormal(pos+dir2*t2);
    return(.5*clamp(dot(-lig,nor2),0.,1.)+pow(max(dot(reflect(dir2,nor2),lig),0.),8.));
}

//	softshadow (IQ)
float softshadow(vec3 ro,vec3 rd) 
{
    float sh=1.;
    float t=.02;
    float h=.0;
    for(int i=0;i<22;i++)  
	{
        if(t>20.)continue;
        h=map(ro+rd*t);
        sh=min(sh,4.*h/t);
        t+=h;
    }
    return sh;
}

//	main function
void mainImage(out vec4 fragColor,in vec2 fragCoord)
{    
    
    float bounce=abs(fract(0.05*iTime)-.5)*20.; // triangle function
    meep=0;
	vec2 uv=gl_FragCoord.xy/iResolution.xy; 
    vec2 p=uv*2.-1.;
   
// 	bouncy cam every 10 seconds
    float wobble=(fract(.1*(iTime-1.))>=0.9)?fract(-iTime)*0.1*sin(30.*iTime):0.;
    
//  camera    
    vec3 dir = normalize(vec3(2.*gl_FragCoord.xy -iResolution.xy, iResolution.y));
//	org (Left-Right,Down-Up,Near-Far)  
    vec3 org = vec3(0,2.*wobble,-3.);  
    
// 	cam fractalscape
   	vec2 m = sin(vec2(0, 1.57) + iTime/8.);
   	dir.xy = mat2(m.y, -m.x, m)*dir.xy;
   	dir.xz = mat2(m.y, -m.x, m)*dir.xz;
   	org = vec3(0, 2.+wobble, 0.+8.*sin(bounce/3.));

// 	standard sphere tracing:
    vec3 color = vec3(0.);
    vec3 color2 = vec3(0.);
    float t=castRayx(org,dir);
	vec3 pos=org+dir*t;
	vec3 nor=calcNormal(pos);

// 	lighting:
    vec3 lig=normalize(-pos);

//	scene depth    
    float depth=clamp((1.-0.09*t),0.,1.);
    vec3 pos2,nor2 =  vec3(0.);
    if(t<12.0)
    {
    	color2 = vec3(max(dot(lig,nor),0.)  +  pow(max(dot(reflect(dir,nor),lig),0.),16.));
    	color2 *=clamp(softshadow(pos,lig),0.,1.);  // shadow            	

        if(meep==1) 								// refraction
        {   
        	float t2;
			color2.r +=refr(pos,lig,dir,nor,0.91, t2, nor2)*depth;
       		color2.g +=refr(pos,lig,dir,nor,0.90, t2, nor2)*depth;
       		color2.b +=refr(pos,lig,dir,nor,0.89, t2, nor2)*depth;
   			color2-=clamp(.1*t2,0.,1.);				// inner intensity loss
        }
	}      
    float tmp = 0.;
    float T = 1.;

//	animation of glow intensity    
    float intensity = 0.1*-sin(.209*iTime+1.)+0.05; 
	for(int i=0; i<128; i++)
	{
    	if (i<int(1.*(t+110.))) continue;// intensity damping
        float density = 0.; float nebula = noise(org+bounce);
        
        density=(meep==1)?intensity-map(org+.5*nor2)*nebula:.7*intensity-map(org)*nebula;
		if(density>0.)
		{
			tmp = density / 128.;
            T *= 1. -tmp * 100.;
			if( T <= 0.) break;
		}
		org += dir*0.078;
    }    

	vec3 basecol=vec3(1./16.,.25,1.);				
    T=clamp(T,0.,1.5); 
    color += basecol* exp(4.*(0.5-T) - 0.8);
    color2*=depth;
    color2+= (1.-depth)*noise(6.*dir+0.3*iTime)*.1;	// subtle mist

    
//	scene depth included in alpha channel
    fragColor = vec4(vec3(1.*color+0.8*color2)*1.3,abs(0.67-depth)*2.+4.*wobble);
}
`;

const fragment = `
// ***********************************************************
// Alcatraz / Rhodium 4k Intro Fractalscape
// by Jochen "Virgill" Feldkötter
//
// 4kb executable: http://www.pouet.net/prod.php?which=68239
// Youtube: https://www.youtube.com/watch?v=YK7fbtQw3ZU
// ***********************************************************



const float GA =2.399; 

mat2 rot = mat2(cos(GA),sin(GA),-sin(GA),cos(GA));


// 	simplyfied version of Dave Hoskins blur
vec3 dof(sampler2D tex,vec2 uv,float rad)
{
	vec3 acc=vec3(0);
    vec2 pixel=vec2(.002*iResolution.y/iResolution.x,.002),angle=vec2(0,rad);;
    rad=1.;
	for (int j=0;j<80;j++)
    {  
        rad += 1./rad;
	    angle*=rot;
        vec4 col=texture(tex,uv+pixel*(rad-1.)*angle);
		acc+=col.xyz;
	}
	return acc/80.;
}

//-------------------------------------------------------------------------------------------
void mainImage(out vec4 fragColor,in vec2 fragCoord)
{
	vec2 uv = gl_FragCoord.xy / iResolution.xy;

//	open and close effect
    float blend,blend2,multi1,multi2;
    blend=min (3. *abs(sin((.1*iTime)*3.1415/3.0)),1.); 
    blend2=min(2.5*abs(sin((.1*iTime)*3.1415/3.0)),1.); 
    
    multi1=((fract(uv.x*6.-4.*uv.y*(1.-blend2))< 0.5 || uv.y<blend) 
    &&(fract(uv.x*6.-4.*uv.y*(1.-blend2))>=0.5 || uv.y>1.-blend))?1.:0.;
 	multi2=(fract(uv.x*12.-0.05-8.*uv.y*(1.-blend2))>0.9)?blend2:1.;
   
    uv.y=(fract(uv.x*6.-4.*uv.y*(1.-blend2))<0.5)?uv.y-(1.-blend):uv.y+=(1.-blend);
	fragColor=vec4(dof(iChannel0,uv,texture(iChannel0,uv).w),1.)*multi1*multi2*blend2;
}
`;

export default class implements iSub {
  key(): string {
    return 'ltKGzc';
  }
  name(): string {
    return 'Rhodium Fractalscape';
  }
  sort() {
    return 652;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
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
  channels() {
    return [{ type: 1, f: buffA, fi: 0 }];
  }
}
