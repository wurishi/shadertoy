import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/*
Procural image made for Revision 2021 4k Excutable Graphics competition

Released executable can be found here: https://demozoo.org/graphics/292427/
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	       
    vec2 res = iResolution.xy;
	vec2 frag = fragCoord.xy;
	vec2 uv = frag/res.xy;
	
	vec4 value=texture(iChannel0,uv);
    
    
    vec3 col=value.xyz/value.w;
    
    // basic "tonemapping"
    col = smoothstep(0.,1.,col);
    col = pow(col, vec3(0.4545));
    
	fragColor = vec4(col, 1);
}

`;

const f = `
float time;

//DAVE HOSKINS' HASH FUNCTIONS
float rnd11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    return fract(2.*p*p);
}

vec3 rnd23(vec2 p)
{
	vec3 p3 = fract(p.xyx * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}

float rnd31(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 rnd33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

float rnd21(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// noise functions

float srnd21(vec2 p)
{
    vec2 ip=floor(p);
    p=fract(p);
    p=smoothstep(0.,1.,p);
    
    float p1 = mix(rnd21(ip),rnd21(ip+vec2(1,0)),p.x);
    float p2 = mix(rnd21(ip+vec2(0,1)),rnd21(ip+vec2(1,1)),p.x);
    
    return mix(p1,p2,p.y);
}

float noise21(vec2 p, float pro, float st) {
    float v=0.0;
    float s=0.5;
    for(float i=0.; i<st; ++i) {
        v+=srnd21(p+i*72.3)*s;
        p*=pro;
        s*=0.5;
    }
    return v;
}

float srnd31(vec3 p7)
{
    vec3 ip=floor(p7);
	
    p7=fract(p7);
    //p7=smoothstep(0.,1.,p7);
    
    float p1 = mix(rnd31(ip),rnd31(ip+vec3(1,0,0)),p7.x);
    float p2 = mix(rnd31(ip+vec3(0,1,0)),rnd31(ip+vec3(1,1,0)),p7.x);
    float p3 = mix(rnd31(ip+vec3(0,0,1)),rnd31(ip+vec3(1,0,1)),p7.x);
    float p4 = mix(rnd31(ip+vec3(0,1,1)),rnd31(ip+vec3(1,1,1)),p7.x);
    
    return mix(mix(p1,p2,p7.y),mix(p3,p4,p7.y),p7.z);
}

float noise31(vec3 p8, float pro, float st) {
    float v=0.0;
    float s3=0.5;
    for(float g=min(0.,float(iFrame)); g<st; ++g) {
        v+=srnd31(p8+g*72.3)*s3;
        p8*=pro;
        s3*=0.5;
    }
    return v;
}

// useful functions

float c01(float a) {return clamp(a,0.,1.);}

float smin(float a, float b, float h) {
	float k=c01((a-b)/h*.5+.5);
	return mix(a,b,k)-k*(1.-k)*h;
}

float pi=acos(-1.);
mat2 rot(float a) {return mat2(cos(a),sin(a),-sin(a),cos(a));}

// sdf functions

float box(vec3 p, vec3 s) {
    p=abs(p)-s;
    return max(p.x, max(p.y,p.z));
	//return length(max(p,vec3(0))) + min(0.,max(p.x,max(p.y,p.z)));
}

// hexagonal shape with specified size
float hex(vec3 p, vec3 s) {
  vec3 ap=abs(p);
  float prof=max(ap.x-s.x,(ap.x+ap.z)*.7-s.z);
  return max(ap.y+max(-1.,prof)-s.y,prof);
}

// sdf to randomly moved boxes in a grid of size re
float gribble(vec3 p, vec3 re) {
  vec3 r1=(fract(p/re+.5)-.5)*re;
  return box(r1+rnd33(floor(p/4.+.5))*2.-1.,re*.4)*.7;
}

// vessel distance function
float vessel(vec3 p) {
  
  p.x=abs(p.x);
  // main frame
  float d = box(p, vec3(8,5,30));
  
  // top 3 layers
  float u = min(hex(p-vec3(0,0,15),vec3(6,7,20)),min(hex(p-vec3(0,0,24),vec3(4,9,12)),hex(p-vec3(0,0,28),vec3(2,11,8))));
  u=max(u, (u+p.y+p.z*.3)*.7-5.);
  d=min(d, u);
  
  // box random details
  float g1=gribble(p, vec3(4,4,10));
  float g2=gribble(p+3., vec3(7,3,8));
  
  d=min(d,max(d-0.4,g1));
  d=min(d,max(d-0.3,g2));
  
  // reactors
  vec3 p2=p-vec3(0,2,0);
  p2.x=abs(p2.x)-5.;
  d=min(d, max(abs(p.z-38.)-8.,abs(length(p2.xy)-3.-sin(p.z*.3+.9))-.3)-g1*.2);
  
  // wings
  vec3 p3=p;
  p3.xy*=rot(.3);
  vec3 ap=abs(p3-vec3(0,0,22));
  float l=max(p3.z-26.,max(abs(p3.y-1.)-.3,(ap.x*.7+ap.z*.3)-14.))-g2*.2;
  d=min(d, l);
  
  return d*.8;
}

// all global values I will need later
float vesd=0.; // distance to vessel
vec3 vesp=vec3(0); // local position of pixel in vessel space
float smoke2=1.; // smoke opacity
float lsmo=0.; // last smoke distance (to darken vessel around smoke)
vec3 smp=vec3(0); // smoke pixel position
float humd=0.; // distance to the character
float map(vec3 p){
    float d=10000.0;

	// ground distance
	vec2 uv1 = p.xz;
	float lh=noise21(uv1*0.02,2.,5.);
    // main ground shape
	float h=pow(lh,3.) * (25.-60.*c01((length(p)-400.)/100.));
    // turn ground into stratified layers
	h=(floor(h)+smoothstep(0.,1.,fract(h)))*2.;
    // rock detail shapes
	h+=pow(noise31(p*vec3(1,8,1),lh*5.+1.,3.),2.) * 3.;
    // sand part
	h=smin(h, lh+7.+h*.05,5.);
	
    // vessel location
	vesp=p.zyx+vec3(100,0,100);
	
	// foot path
	vec2 uv3 = vesp.xz-vec2(10,0);
	uv3*=rot(sin(vesp.x*.251)*.1);
	float mark=smoothstep(0.,1.,sin(uv3.x*4.+sign(uv3.y)*2.));
	float path=c01(.3-abs(abs(uv3.y)-.4)*2.+mark*.3)*(mark*.3+.5)*smoothstep(12.1,12.,abs(uv3.x-28.));
	h+=min(.1,path);

    // final ground sdf
	float g=-p.y + h;
	d=min(d, g*.9);
	
	// vessel sdf
	vesp.yz*=rot(.6);
	vesp.xz*=rot(.2);
	vesd=vessel(vesp);
	d=min(d, vesd);

	// character sdf
	vec3 p4a=(p+vec3(100.1,-6.5,50.3))-vec3(0,2.5-2.5-.1,0);
	vec3 p4=p4a;
	vec3 p5=p4;
	vec3 p6=p4;
	p5.z=abs(p5.z)+.1;
	p5.x+=sin(p4a.y*3.)*.2+.1;
	p5.zy*=rot(-.25);
    // head
	float m=length(p4)-.2;
    // body
	p4.x+=sin(p4a.y*6.+3.)*.05+.1;
	p4.y=abs(p4.y-.75)-.2;
	p4.y=abs(p4.y)-.1;
	m=smin(m, length(p4)-.25,.18);
	m=smin(m, max(1.-p5.y,length(p5.xz)-.1),.1);
	m=min(m, .7*max(1.-p5.y,length(p5.xz)-.1+sin(p4a.y*12.)*.05));
	p5.z-=.3;
	p5.x-=.1;
	m=smin(m, max(abs(-p5.y+.9)-.5,length(p5.xz)-.1),.2);
	m=smin(m, max(abs(-p4.y+.1)-.1,length(p5.xz)-.13),.1);
	p6.x+=.3;
	p6.z=abs(p6.z)-.1;
	m=min(m, max(abs(-p6.y+.65)-.4,length(p6.xz)-.4+.7*max(.3,abs(-p6.y+.65)))*.7);
	humd=m;
	d=min(d,m);
	
	// smoke sdf
	vec3 p3 = p+vec3(110,0,94);
	p3.x+=p3.y*.3;
	p3.xz=abs(p3.xz*rot(p3.y*.07+sin(p3.y*.5)*.3))-5.;
	float smoke=length(p3.xz)+1.-p3.y*.05;
	lsmo=smoke;
	smp=mix(p,smp,c01(smoke-5.));
	smoke2*=c01(.4+(smoke)*.1);
	
	d=min(d, smoke);
    
    return d;
}


float dither=1.;

float shadow(vec3 p, vec3 l) {
    float shad=1.0;    
    float dd=0.;
    for(int i=0;i<50; ++i) {
        float d=map(p);
        shad=min(shad,(abs(d)-.01)*100.);
        if(d<0.01) {
            shad=0.0;
            break;
        }
        if(dd>20.) break;
        p+=l*d;
        dd+=d;
    }
    return shad;
}

// main lighting direction
vec3 l = normalize(vec3(7,-2,0));

vec3 sky(vec3 r, float dd, int it) {
	vec2 uvs=vec2(atan(r.z,r.x),r.y);
    // "clouds"
	float n=noise21(uvs*vec2(7,50),3.7,3.);
	float n2=noise21(uvs*vec2(7,50)+vec2(.3,-.1),3.7,3.);
	float push=dd>900.?smoothstep(0.0,0.3,n2-n):0.;
    // sky color
	vec3 sk=mix(vec3(.7,.5,.3)*(.9+.5*push),vec3(.4,0.3,0.2),dd>900.?c01((n-.3)*5.*(-r.y*10.)+5.*c01((-.1-abs(r.y))*2.)):.5);
    // dark to see the sky
	sk=mix(sk*pow(vec3(cos(max(-5.5,r.y*9.))*.5+.5),vec3(2.,3.,2.3))*2.,vec3(0),c01(r.y));

	// sun halo
	vec3 l2 = normalize(vec3(7,-0.9,0)); // fake sun for composition
	sk+=pow(max(0.,dot(r,l2)),60.)*vec3(1,0.5,0.3)*1.2;
	sk+=smoothstep(0.9996,0.9998,dot(r,l2))*vec3(1,0.5,0.3);

	// far sky details
	if(dd>900.) {
		vec2 suv=uvs*3.;
		float nn = smoothstep(0.2,0.7,noise21(suv*vec2(5,20), 2., 3.));
        // star belt
		nn += .07/(.01+abs(suv.y+suv.x*.2+1.));
  
        // stars
		for(float i=0.;i<3.;++i) {
			suv*=rot(.7);
			float grid=70.+i*10.;
			vec3 starid=rnd23(floor(suv*grid));
			vec2 staruv=fract(suv*grid)-.5;
			float stard=length(staruv+(starid.xy-.5)*.5);
			float starsmo=i*.07+.01;
			sk += .8*nn*pow(rnd11(starid.z),10.)*(.7+.3*max(sin(vec3(.8,1.7,.9)*3.*starid.z+i*10.),0.)) * smoothstep(.4,0.,stard)*starsmo/(starsmo+stard);
		}
		sk += nn*.01; // dust
  
        // meteroids
		vec2 muv=suv+vec2(.2+.2,-.3-.7);
		muv*=rot(2.3)*1.3;
		for(float i=0.;i<30.;++i) {
			float pp=-.1-sin(i*.7)*.3;
			muv*=rot(sin(pp)*.3);
			float pro=cos(pp*7.);
            // trail
			sk += vec3(1,.5,.3)*0.002*c01(1.-abs(.5+muv.y+pro*.15)*3.)/(0.001+abs(muv.x));
            // meteroids
			if(length((.007*sin(suv*41.)+muv+vec2(0,0.2*pro+.7))*vec2(2,1))<.015) sk=vec3(0.2+smoothstep(0.,0.3,-muv.x*20.)*.7+sin(muv.y*170.)*sin(muv.x*170.)*.1);
		}
	}
	
	return sk;
}

// suggested from tdhooper. Thanks!
// improve compilation time & overall fps.
const int NORMAL_STEPS = 6;
vec3 getnormal(vec3 pos) {

    vec3 eps = vec3(.001, 0, 0);
	
	vec3 nor = vec3(0);
	float invert = 1.;
	for (int i = 0; i < NORMAL_STEPS; i++) {
		nor += map(pos + eps * invert) * eps * invert;
		eps = eps.zxy;
		invert *= -1.;
	}
	return normalize(nor);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	         

	time = float(iFrame);
    
    vec2 frag = fragCoord.xy;
	vec2 uv = (frag-iResolution.xy*0.5)/iResolution.y;
    
    vec4 finalcolor = vec4(0);
    if(iFrame>0) {
        finalcolor += texture(iChannel0, fragCoord/iResolution.xy);
    }
    
    // verify if middle mouse clicked or if resolution changed
    if(iMouse.z > .5 || texelFetch(iChannel0, ivec2(0),0).y != iResolution.y) {
        finalcolor=vec4(0);
    }
	
    // separate rendering by tiles so browser doesn't freeze computer
    int tilecount = 20;
    int curtile = int(frag.y*float(tilecount)/iResolution.y);
    
    // if(iFrame%tilecount == curtile) 
    {
        
        // random jitter on uv to get antialiasing
        vec2 uv = (frag-iResolution.xy*0.5+1.5*rnd23(frag+time).xy)/iResolution.y;

        vec3 finalp=vec3(0);
        vec3 finals=vec3(0);
        vec3 finaln=vec3(0,1,0);

        // raymarching dither to avoid any banding
        dither = .9+.1*rnd21(frag+time*.7);

        // camera position
        vec3 s=5.*vec3(-28.635,-1.601,-4.168);
        vec2 camr=vec2(8.455,.152);

        vec3 cz=normalize(vec3(sin(camr.x)*cos(camr.y), sin(camr.y), cos(camr.x)*cos(camr.y)));
        vec3 cx=normalize(cross(cz,vec3(0,1,0)));
        vec3 cy=cross(cz,cx);

        float fov = 1.0;

        float motime = time;

        vec2 h = rnd23(frag-13.6+motime*37.7).xy * vec2(1.,6.283);
        vec3 voff = sqrt(h.x)*(cx*sin(h.y)+cy*cos(h.y))*.3/iResolution.y;
        // persp
        vec3 r=normalize(uv.x*cx+uv.y*cy+fov*cz + voff*fov);
        finals=s;

        vec3 col=vec3(0);
        
        vec3 bs = s;
        vec3 alpha=vec3(1.0);
        int bounce=4;
        int ZERO = min(0,iFrame);
        for(int j=ZERO; j<bounce; ++j) {
        
            smp=vec3(0);

            for(int i=0; i<100; ++i) {
                float d=map(s);
                if(d<0.001) break;
                if(d>1000.0) break;
                s+=r*d*dither;
            }

            float vesd2=vesd;
            vec3 vesp2=vesp;
            float humd2=humd;

            // smoke darkening and color
            float smn=noise31(smp,4.,3.);
            col += alpha * smoothstep(0.3,0.,smoke2)*(vec3(.3,.2,.1)*smoothstep(.4,.6,smn)+vec3(1,0.2,0.1)*smoothstep(0.3,1.,smn))*4.;
            alpha*=pow(smoke2,2.);
            alpha*=smoothstep(0.,1.,lsmo-7.)*.5+.5;

            // surface normal
            vec3 n=getnormal(s);
            
            // are we far enough
            float dd=length(s-finals);
            if(dd>1000.) {
                col += sky(r,dd,j)*alpha;
                // early out
                break;
            } else {

                // fresnel
                float fre=pow(max(0.,1.-abs(dot(r,n))),1.0);

                vec3 val=vec3(0);

                // shadow
                float shad = shadow(s+n*0.1+l*0.1,l);
                // mix ground diffuse colors
                vec3 sand=mix(vec3(.9,.65,.4),vec3(0.3,.2,.1),c01(s.y-8.));
                vec3 rock=mix(vec3(.3,0.1,0.1)*0.,vec3(.8,.7,.6),c01((abs(n.x)-.1)*10.));
                vec3 diff=mix(rock,sand,c01(s.y-7.));
                if(vesd2<.1) {
                    // vessel color
                    diff=vec3(1);
                    if(vesp2.z<35. && abs(vesp2.x)<8.6 ) {
                        if(rnd11(floor(vesp2.y+17.01))<.5) {
                            // blue bands
                            diff=vec3(0.4,.6,1);
                        }
                    }
                    // darken also the reflection
                    alpha*= diff;
                }
                if(humd2<.01) {
                    // character color
                    diff=vec3(1);
                    alpha*=pow(fre,.5);
                }

                // apply direct lighting
                val += shad * max(0.,dot(n,l)) * diff;

                val=max(val,0.);
                
                // blend fog color
                float blend=pow(c01((dd-100.)/900.),.6);
                val = mix(val, sky(r,dd,j), blend);

                col += val*alpha;

                float rough = .5;
                if(vesd2<.1) {
                    // vessel roughness
                    rough=vesp2.z>32.?0.:rnd31(floor(vesp2*vec3(3,.1,.1)-.72)*.3+.7);
                }

                // bounce in a random direction around reflection vector, depending on roughness
                r=normalize(reflect(r,n) + normalize(rnd23(frag+vec2(0,j*375)+time*1.3)-.5)*rough);

                alpha *= 0.7*(1.-blend);
                s+=n*0.005;
            }
            
            // tricks by iq to disable unrolling and have faster compilation times
            if( col.x<-100.0 ) break;
        }

        finalcolor += vec4(col, 1);
    }
    
    // store last rendered resolution
    if(ivec2(fragCoord)==ivec2(0)) {
        finalcolor=iResolution.xyxy;
    }
    
    fragColor = finalcolor;
    // fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'ssBGRG';
  }
  name(): string {
    return 'Red Crash - Procedural GFX';
  }
  sort() {
    return 206;
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
    return f;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  // channels() {
  //   // return [{ type: 1, f, fi: 0 }];
  //   return [webglUtils.DEFAULT_NOISE];
  // }
}
