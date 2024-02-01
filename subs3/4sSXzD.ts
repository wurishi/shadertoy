import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//1 = spiky thing || 2 = heavy deformation || 3 = texture plotting
#define RENDER 2

//Max iterations and max distance
#define ITR 60
#define FAR 50.
#define PRECISION 0.008

//distance from center
#define HEIGHT 18.

//determines how fast the root finder moves in, needs to be lowered when dealing with thin "slices"
//the potential problem is the intersector crossing the function twice in one step.
#define BASE_STRIDE .75

//Used by the Hybrid marcher (if the distance from the root is high enough we use d instead of log(d)
#define FAR_STRIDE 0.3

//To cross faster, a minimum step size
#define MIN_STEP .1

//Optimizations From CeeJayDK 
//(let me know if it actually improves performance for you, I'm not getting any difference here)
//#define OPTIMIZE


const float logvl = 1.+MIN_STEP;
#define time iTime
#define pi 3.1415926535
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}


float map( in vec3 p)
{  
    #if RENDER == 1
    p.x += sin(p.z*2.+time*5.)*0.2;
    p.y += cos(p.z*2.+time*10.)*0.2;
    float d = p.z-abs(fract(p.x*0.5)-0.5)*abs(fract(p.y*0.5)-0.5)*10.;
    d = max(d,max(abs(p.x),max(abs(p.y),abs(p.z)))-7.);
    p.z += 13.;
    d = min(d, length(p.xz)+sin(p.y)-12.);
    
    #elif RENDER == 2
    
    p.zx -= sin(p.zx*1.)*.45;
    p.xy *= mm2(p.z*sin(time)*0.3);
    p.x += sin(p.z*3.)*.35;
    p.y += sin(p.y*4.)*.3*sin(time);
    p.z += p.y*sin(time*0.9)*2.+0.5;
    float d = length(p)-6.;
    #else
    
    float d = p.z-texture(iChannel1,p.xy*0.04).r*1.5;
    #endif
    
    return d;
}

float bisect( in vec3 ro, in vec3 rd, in float near, in float far)
{
    float mid = 0.;
    float sgn = sign(map(rd*near+ro));
    for (int i = 0; i < 6; i++)
    { 
        mid = (near + far)*.5;
        float d = map(rd*mid+ro);
        if (abs(d) < PRECISION)break;
        d*sgn < 0. ? far = mid : near = mid;
    }
    return (near+far) * .5;
}

float intersect( in vec3 ro, in vec3 rd)
{
    float t = 0.;
    const int itr = ITR;
    float d = map(rd*t+ro);
    #ifdef OPTIMIZE
    bool sgn = (d > 0.0) ? true : false;
    #else
    float sgn = sign(d);
    #endif
    float told = t;
    bool doBisect = false;
    
    for (int i=0;i<=itr;i++)
    {
        
        if (abs(d) < PRECISION || t > FAR) break;
        else if (i == itr)t = 1000.;
            
        //if we crossed but didn't detect, use bisection method
        #ifdef OPTIMIZE
        if ((d > 0.0) != sgn)
        #else
       	if (sign(d) != sgn)
        #endif
        {
            doBisect= true;
            break;
        }
        
        told = t;
        #if 1
        if (d > 1.)t += d*FAR_STRIDE;
        else t += log(abs(d)+logvl)*BASE_STRIDE;
        #else
        t += log(abs(d)+logvl)*BASE_STRIDE;
        #endif
        d = map(rd*t+ro);
    }
    
    if (doBisect)t = bisect(ro,rd,told,t);
    
    return t;
}

vec3 normal(const in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.01;
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy) );   
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
    vec2 bp = p+0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 um = iMouse.xy / iResolution.xy-.5;
    um = (um ==vec2(-.5))?um=vec2(-0.005,-0.005):um;
	um *= 3.14159265*2.;
    
    vec3 ligt = normalize(vec3(sin(time*0.5),3.,cos(time*0.5)));
    
    //camera
    vec3 ro = vec3(0.,0.,HEIGHT);
    vec3 rd = normalize(vec3(p*3.,-2.4));
   	
    //rotation
    mat2 ry = mm2(um.y+sin(time)*0.3);
    mat2 rx = mm2(um.x+time*0.29);
    ro.yz *= ry;
    ro.xz *= rx;
    rd.yz *= ry;
    rd.xz *= rx;

    float rz = intersect(ro,rd);
    vec3 col = texture(iChannel0,rd.xy).rgb*0.9;
    vec3 pos = ro+rd*rz;
    
    //shadng
    if (rz < FAR)
    {
        vec3 nor = normal(pos);
        vec3 col2 = nor*0.7+0.45;
        float nl = clamp(dot(nor,ligt),0.,1.);
        col2 *= nl*1.+col2*0.1;
        col2 *= smoothstep(-1.,-.995,cos(1.*pos.x*pi+pi))*0.5+0.5;
        col2 *= smoothstep(-1.,-.995,cos(1.*pos.y*pi+pi))*0.5+0.5;
        vec3 rf = reflect(rd,nor);
        vec3 tex = texture(iChannel0,rf.xy).rgb;
        col2 = mix(col2,tex,0.12);
        col = mix(col,col2,0.85);
    }
    
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4sSXzD';
  }
  name(): string {
    return 'Log-Bisection Tracing';
  }
  sort() {
    return 377;
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
    return [
      webglUtils.ROCK_TEXTURE, //
      webglUtils.DEFAULT_NOISE
    ];
  }
}
