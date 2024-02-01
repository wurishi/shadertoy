import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//30 Steps looks good here
#define VOLSTEPS 25

//#define SIMPLE_PRIMITIVE

#define ITR 100
#define FAR 20.
//#define time iTime


float time;

const vec3 luma = vec3(0.2126, 0.7152, 0.0722);  //BT.709

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

//You can actually make a cheaper tetrahedron using 3 dot products,
//but the alignments isn't ideal..
float tetr(vec3 p)
{
    const vec2 e = vec2(0.57735, -.57735);
    float d =  dot(p, e.yxx);
    d = max(d, dot(p, e.yyy));
    d = max(d, dot(p, e.xxy));
    d = max(d, dot(p, e.xyx));
    return d;
}

//Some displacement functions
float tri(in float x){return abs(fract(x)-0.5)-.25;}
float trids(in vec3 p)
{   
    return max(tri(p.z),min(tri(p.x),tri(p.y)))*.1;
}

float trids2(in vec3 p)
{   
    return tri((p.x*1.+1.5*tri(p.z+tri(p.y))) )*.02;
}

float expOut(in float t, in float n) 
{
	float a = 1. + 1./(exp2(n) - 1.);
	float b = log2(a);
	return a - exp2(-n*t + b);
}

//----------------------------------------------------------------------------------------------------
//Knots from knighty
//http://www.fractalforums.com/new-theories-and-research/not-fractal-but-funny-trefoil-knot-routine/
//----------------------------------------------------------------------------------------------------
#define tau 6.2831853
const float groupRadius = .74;
const float objectRadius = 1.1;
const float RotNumeratorX = 3.;
const float RotNumeratorY = 3.;
const float RotDenominator = 2.;

float twist(in vec3 p)
{
	vec3 q=  p;
    float ra = p.z*RotNumeratorX/RotDenominator;
	float raz = p.z*RotNumeratorY/RotDenominator;
	
    p.xy -= vec2(groupRadius*cos(ra)+objectRadius, groupRadius*sin(raz)+objectRadius);
    p.z += time*2.5;
    
    float ctau = 1.5;
    float id = floor(p.z*ctau);
    p.z = fract(p.z*ctau)/ctau-0.33;
    p = rotx(p,id*2.+time*8.);
    float prm = tetr(p);
    float d = prm-0.1;
    d = max(-d, prm-0.2);
    
    return d+trids(p)*2.4  + trids2(p*6.)*0.25;
}

//----------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------

float map(vec3 p)
{
    p = rotx(p,expOut(sin(time*1.8),1.1));
    p = roty(p,-expOut(sin(-time*1.5),1.));
    
    #ifndef SIMPLE_PRIMITIVE
    float r = length(p.xz);
    float a = atan(p.z,p.x);
	float d = 10.;
	for(int i=0;i<2;i++)
    {
		vec3 p = vec3(r, p.y, a+tau*float(i));
		p.x -= objectRadius;
		d = min(d, twist(p));
	}
    
    p *= .85;
    p = rotz(p,2.+time*1.7);
    r = length(p.xz);
    a = atan(p.z,p.x);
    a += 1.2;
    for(int i=0;i<2;i++)
    {
		vec3 p = vec3(r, p.y, a+tau*float(i));
		p.x -= objectRadius;
		d = min(d, twist(p)*(1./.85));
	}
    
    return d;
    #else
    p = rotx(p,time*2.);
    return (length(p)-2.)+trids(p*1.)*4. + trids2(p*3.)*0.3;
    #endif
}

float march(in vec3 ro, in vec3 rd)
{
	float precis = 0.001;
    float h=precis*2.0;
    float d = 0.;
    for( int i=0; i<ITR; i++ )
    {
        if( abs(h)<precis || d>FAR ) break;
        d += h;
	    float res = map(ro+rd*d);
        h = res;
    }
	return d;
}

float noise(in vec3 p)
{
	vec3 ip = floor(p);
    vec3 fp = fract(p);
	fp = fp*fp*(3.0-2.0*fp);
	
	vec2 tap = (ip.xy+vec2(37.0, 17.0)*ip.z) + fp.xy;
	vec2 rz = textureLod( iChannel0, (tap + 0.5)/256.0, 0.0 ).yx;
	return mix(rz.x, rz.y, fp.z);
}

float fbm3(in vec3 p)
{
    p*=5.;
    p.x *= .18;
   	p.x += time*7.7;
    float a = 0.0;
    float z = .5;
	vec3 d = vec3(0.);
    for( int i=0; i<3; i++ )
    {
        float n = noise(p);
        a += (n-.5)*z;
        z *= .47;
        p *= 2.9;
    }
    return a;
}

float mapV(in vec3 p)
{
    float mp = map(p);
   	p = mix(p, p/(-(mp+1.4)),.4+(sin(time*2.+sin(time))*0.15));
    return fbm3(p)*clamp(2.3-mp*2.2, 0.65, 1.7);
}

vec4 vmarch(in vec3 ro, in vec3 rd, in float sceneDist)
{
    sceneDist = min(sceneDist, 15.);
	vec4 rz = vec4(0);
	const float smt = 3.;
	float t = 6.;
	for(int i=0; i<VOLSTEPS; i++)
	{
        if(rz.a > 0.99 || t > sceneDist)break;

		vec3 pos = ro + t*rd;
        float den = mapV(pos);
        vec3 lcol = mix(vec3(.5,1,.9),vec3(.5,.7,1.),noise(pos*1.));
        vec4 col = vec4(lcol*den, den);
        col.a *= 1.1;
		col.rgb *= col.a;
        col *= smoothstep(t-smt, t + smt, sceneDist); //Blend with scene geometry
		rz = rz + col*(1. - rz.a); //front to back blending
        
        t += clamp(.15 - den*0.1, 0.15 ,5.);
	}
    rz = clamp(rz,0.,1.);
    return rz*rz;
}

vec3 lgt = normalize( vec3(.5, 0.8, 0.2) );

vec3 norcurv(in vec3 p, out float curv)
{
    vec2 e = vec2(-1., 1.)*0.009;   
    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);

    curv = clamp(.002/(e.x*e.x) *(t1 + t2 + t3 + t4 - 4. * map(p)),0.,1.);
    return normalize(e.yxx*t1 + e.xxy*t2 + e.xyx*t3 + e.yyy*t4);
}

struct mtl{float rough; vec3 alb; vec3 f0;};
    
//http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
vec3 shade(in vec3 pos, in vec3 rd)
{
    float crv;
    vec3 nor = norcurv(pos, crv);
    mtl m;
    m.alb = vec3(.1,0.8,0.8);
    m.rough = 0.3;
    m.f0 = vec3(.95, 1., 1.);
    
	float nl = clamp(dot(nor,lgt), 0., 1.);
	vec3 col = vec3(0.);
    
    vec3 lcol = mix(vec3(.5,1,1),vec3(.5,.8,1.),noise(pos*2.));
    
    if (nl > 0.)
    {
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
        col = lcol*nl*(spec*((crv*vec3(0.1,.5,.8))+0.05) + m.alb*(1. - dot(m.f0,luma)));
    }

    return col;
}

vec3 render(in vec3 ro, in vec3 rd)
{   
    float fadeIn = smoothstep(1.,11.,iTime);
    vec4 mTex = textureLod(iChannel1, vec2(0.5,0.5), 0.);
    time = (iTime - fadeIn*5. + (mTex.w-0.05)*.7);
  
    //float w = textureLod(iChannel3, vec2(0.9,0.5), 0.).x;
    
    vec3 bgcol = mix(vec3(.1,1,.8),vec3(.1,.8,1.),noise(rd*2.+time*.7));
    vec3 col = .004/clamp(fbm3(rd*3.*vec3(.5,1.,.3))+.31,0.,1.)*bgcol; //bg
    float rz = march(ro,rd); //march
    
    if ( rz < FAR ) col = shade(ro +rd*rz, rd);
    
	col = pow(clamp(col,0.,1.), vec3(0.416667))*1.055 - 0.055; //gamma
    
    vec4 rez = vmarch(ro,rd,rz); //volumetric stepping
    rez.rgb *= (mTex.z-0.1)*3.;
    col.rgb += rez.rgb;
    
    col *= sin(gl_FragCoord.y*350.+time)*0.09+1.;//Scanlines
    col *= sin(gl_FragCoord.x*350.+time)*0.09+1.;
    
    col *= smoothstep(1.4,0.85,length((gl_FragCoord.xy/iResolution.xy*2.-1.)*vec2(.85,1.)));
    
    
    col = clamp(col,0.,1.);
    //Fade in
    col *= fadeIn;
    
    return col*1.;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(0.,0.):mo;
	mo.x *= iResolution.x/iResolution.y;
    mo*=2.;
	
    //shake (only fpor non-vr)
    float dsp = texture(iChannel0,vec2(iTime*.1)).x-0.5;
    mo.y += iTime*0.2 + dsp*.2;
    mo.x += sin(iTime*0.2)*0.5;
    
    //camera
	vec3 ro = vec3(0.,0.,11.+dsp*.5);
    vec3 rd = normalize(vec3(p,-1.5));
    rd = rotz(rd,-0.5);
    ro = rotx(ro,mo.y), rd = rotx(rd,mo.y);
    ro = roty(ro,mo.x), rd = roty(rd,mo.x);
    
    vec3 col = render(ro, rd);
	
	fragColor = vec4( col, 1.0 );
}

void mainVR(out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir)
{
 	vec3 ro = fragRayOri + vec3(0., 0., 10.);
    vec3 col = render(ro, fragRayDir);
    
    fragColor = vec4( col, 1.0 );
}
`;

const f = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy/iResolution.xy;
    float fft  = texture( iChannel1, vec2(q.x,0.25) ).x;
	float nwave = texture( iChannel1, vec2(q.x,0.75) ).x;
    vec4 lData = texture( iChannel0, vec2(q.x,0.25) );
    
    float fwave = mix(nwave,lData.z, .9);

    float nfft = 0.;
    for (float i = 0.0; i < 1.; i += 0.02)
    {
        nfft += texture( iChannel1, vec2(i,0.25) ).x; 
    }
    nfft = clamp(nfft/50.,0.,1.);
    
    float ffts = mix(nfft, lData.w, 0.5);
    
    if (iFrame < 5) 
    {
        fft = 0.;
        fwave= .5;
        ffts = 0.;
    }
    
    fragColor = vec4(fft, 0, fwave, ffts);
}
`;

export default class implements iSub {
  key(): string {
    return '4lB3WV';
  }
  name(): string {
    return 'Hyperlepsy';
  }
  sort() {
    return 313;
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
      // { type: 1, f, fi: 0 },
      webglUtils.DEFAULT_NOISE, //
      webglUtils.DEFAULT_NOISE, //
    ];
  }
}
