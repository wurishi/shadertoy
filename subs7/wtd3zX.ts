import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const sound = `#define pi acos(-1.)
#define tau (2.*pi)

#define tempo 120.
#define hbeat ((60./tempo)/1.)
#define qnote (hbeat/2.)
#define beat  (hbeat*2.)
#define qbeat  (beat/4.)
#define measure  (hbeat*2.)


float note(float note, float octave){
	return 27.5*pow(2., ((octave*12.) + note )/12.);
}
float noise( vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.1);
}
float random(float st){
	return fract(sin(st*42151.5524124));
}
float rand(float t) {
	return fract(sin(t*3211251.325235325));
}

vec2 makeAmb(float t) {
	vec2 s = vec2(0);

    float freqA = note(9., 0.);
    float freqB = note(9., 1.);
    float freqC = note(9. + 7., 1.);
    float scale = 1.;
    float iters = 6.;
    for (float i = 0.; i < iters; i++) {
    
        s.x += sin(tau*t*freqA    )*scale * 0.5;
        s.x += sin(tau*t*freqB    )*scale * 0.2;
        s.x += sin(tau*t*freqC  + smoothstep(0.,1.,sin(t) * noise(vec2(t))*0.5)  )*scale * 0.4;
    	freqA *= 2.002 +random(i)*0.3 + sin(t + i)*0.002;
    	freqC *= 2.002 +random(i)*0.3 + sin(t + i)*0.002;
    	freqB *= 1.501;
        scale *= 0.2 + smoothstep(0.,1., t*0.2)*0.3 + cos(t * 0.2)*0.1;
    }
    s.y = s.x;
    
    return s;
}

vec2 makeKick(float t) {
    vec2 s = vec2(0);
    float r = random( mod(floor(t/ hbeat), 26.));
    float rB = random( mod(floor((t + 4.)/ hbeat), 26.));
    
    
    if (rB < 0.25) {
        r *= 4.;
		r = floor(r);
        r += 1.;
        float offs = hbeat * 1./r;
        if (offs == hbeat) {
        	offs -= hbeat/4.;
        }
        t = mod(t + offs, hbeat);

        float env = exp(-t*10.);
        	s.x += sin( (140. * env+ 10. ) *tau*t) * env ;
        	s.x += sin( (240. * env+ 10. ) *tau*t) * env ;
	
    	//s.x += sin( (random(t)) *tau*t) * env*2. ;
        
        s.x = clamp(s.x*1.6,-1., 1.);

        
        s.y = s.x;
    
    }
    return s;
}

float arp(float t, float r, float scale) {
	float n = 0. ;
    //float r = random( mod( floor(t/period), 50.));
    r *= 7.;
    r = floor(r);
    (r == 0.) ? n = note(9., 2.) :
    (r == 1.) ? n = note(9. - 8., 2.) :
    (r == 2.) ? n = note(9. - 5., 2.) :
    (r == 3.) ? n = note(9. - 6., 2.) :
    (r == 4.) ? n = note(9. + 1., 2.) :
    (r == 5.) ? n = note(9. + 3., 2.) :
    (r == 6.) ? n = note(9. + 3. - 12., 2.) :
    (r == 7.) ? n = note(9., 1.) : 0.;
    //);
    return n;
}

vec2 makeBells(float t) {
    vec2 s = vec2(0);
    float r = random( mod(floor(t/ hbeat), 26.) + 4.);
    float rC = r;
    float rB = random( mod(floor((t + 4.)/ hbeat) + 4., 26.));
    
    
    if (rB < 0.04) {
        r *= 4.;
		r = floor(r);
        r += 1.;
        float offs = hbeat * 1./r;
        if (offs == hbeat) {
        	offs -= hbeat/4.;
        }
        t = mod(t + offs, hbeat);

        float env = exp(-t*15.);
        
        float freq = (arp(t,rC, 1.)) ; 
        float scale = 1.;
        float iters = 3.;
    	for (float i = 0.; i < iters; i++) {
       		s.x += sin(freq *tau*t) * env * scale ;
            
            freq *= 2.01;
            scale *= 0.8;
        }
		//s.x /= iters;
    	//s.x += sin( (random(t)) *tau*t) * env*2. ;
        
        //s.x = clamp(s.x*1.6,-1., 1.);

        
        s.y = s.x;
    
    }
    return s;
}

vec2 echoChannel(float t) {
	vec2 s = vec2(0);

    float fb = 0.55, tm = qbeat*1.5, cf = 0.9, ct = tm;
    // tap 1 
    s += makeAmb(t) * cf; cf *= fb; 
    // tap 2
    s += makeAmb(t - ct) * cf; cf *= fb; ct += tm;
    // tap 3
    s += makeAmb(t - ct) * cf; cf *= fb; ct += tm;
    // tap 4
    s += makeAmb(t - ct) * cf; cf *= fb; ct += tm;
    // tap 5
    s += makeAmb(t - ct) * cf; cf *= fb; ct += tm;
    
    return s;
}
vec2 echoChannelB(float t) {
	vec2 s = vec2(0);

    float fb = 0.15, tm = qbeat*1.5, cf = 0.9, ct = tm;
    // tap 1 
    s += makeBells(t) * cf; cf *= fb; 
    // tap 2
    s += makeBells(t - ct) * cf; cf *= fb; ct += tm;
    // tap 3
    s += makeBells(t - ct) * cf; cf *= fb; ct += tm;
    // tap 4
    s += makeBells(t - ct) * cf; cf *= fb; ct += tm;
    // tap 5
    s += makeBells(t - ct) * cf; cf *= fb; ct += tm;
    
    return s;
}
vec2 reverbChannelB(float t) {
	vec2 s = vec2(0);
    
    vec2 reverb = vec2(0);
    float st = 0.02; float iters = 200.;
    for (float i = 0.; i < iters; i++) {
    	reverb += ((makeBells(t - i*st + random(i)*0.02))/iters) *(1. - i/iters) ;
    }
    reverb *= 2.;
    s += makeBells(t)*0.1;
    s += reverb*1.5;
    s *= 2.;
	return s;
}


vec2 mainSound( in int samp, float time )
{
    vec2 s = vec2(0);
     
    
    s += echoChannel(time);
    s += echoChannel(time + sin(time*0.2)*0.04);
    s += echoChannel(time + cos(time*0.6)*0.02);
    s += echoChannel(time*0.5 + cos(time*0.34)*0.1);
    
    s += makeKick(time)*1.4;

    s += reverbChannelB(time)*10.;
    
    s *= 0.2;
    
    s = clamp(s, vec2(-1.), vec2(1.));
    
    s *= smoothstep(0.,1., time*0.6);
    
    return s;
}`

const fragment = `
// Inspired by nusan!
// He has really good IFS and refraction techniques.
// Check him out https://www.shadertoy.com/user/nusan

#define dmin(a, b) (a.x < b.x) ? a : b
vec3 ACESFilm( vec3 x )
{
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return max(vec3(.0), min(vec3(1.0), (x*(a*x+b))/(x*(c*x+d)+e) ) );
}

vec3 getRd(vec3 ro, vec3 lookAt, vec2 uv) {
  vec3 dir = normalize(lookAt - ro);
    vec3 right = normalize(cross(vec3(0,1,0), dir));
  vec3 up = normalize(cross(dir, right));
  
  return dir*1. + right*uv.x*0.3 + up*uv.y*0.3;
}

float sdObjA(vec3 p, float r){  
  p.y *= 0.5;
  p = abs(p);
  p -= r;
  float d = max(p.x, p.y);
  d = max(d, p.z);
  d = max(d, dot(p + 0.2, normalize(vec3(1))));
  return d;
}

float sdCube(vec3 p, vec3 r){
  p = abs(p);
  p -= r;
  float d = max(p.x, p.y);
  return max(d, p.z);
}

#define rot(x) mat2(cos(x), -sin(x), sin(x), cos(x))
#define pi acos(-1.)
vec2 sdMainGeom(vec3 p) {
    vec2 d = vec2(10e3);
    d = dmin(d, vec2(sdObjA(p, 0.5), 1.));
    //d = dmin(d, vec2(sdObjA(p - vec3(0,1,0), 0.5), 3.));
    p = abs(p);
    p -= 0.5;
    p.xz *= rot(0.25*pi);
    d = dmin(d, vec2(sdCube(p, vec3(0.1,2.,0.1)), 2.));
  
  d.x *= 0.5;
  return d;
}

float mpow(float a, float b) {
  for(float i = 0.; i < b; i++) {
      a = a * a;
  }
  return a;
}

float timeMod() {
  float t = iTime * 0.2;
  return floor(t) + smoothstep(0.,1.,fract(t));
}
#define dmod(p, x) mod(p, x) - x*0.5

vec2 map(vec3 p){
  vec2 d = vec2(10e3);
  

  
  float tMod = mpow(sin(iTime*0.2),5.);
  
  for (float i = 0.; i < 7.; i++) {
    p.x -= 2. + ( smoothstep(1.,0.,iTime*0.1) * 5.  ) ; // TODO: smoothstep this from beggining of shader
    
    p.y -= 0.7;
    
    p.xy *= rot(0.6*pi + timeMod());
    p.zy *= rot(0.3*pi );
    p = abs(p);
    
  }
  
  
  d = dmin(d, sdMainGeom(p));
 
  return d;
}

vec3 getNormal(vec3 p) {
    vec2 t= vec2(0.001, 0.);
  return normalize(map(p).x - vec3(
    map(p - t.xyy).x,
    map(p - t.yxy).x,
    map(p - t.yyx).x
  ));
}
#define spectra(x, t) (0.5 + 0.2*sin(vec3(0.5,0.8,0.7)*t + x) )

#define zoom 46.
#define rotSpeed 0.2

float random( vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.1);
}

float noise(vec2 p) {
	vec2 i = ceil(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3. - 2. * f);
   	float a = random(i);
    float b = random(i + vec2(1., 0.));
    float c = random(i + vec2(0., 1.));
    float d = random(i + vec2(1., 1.));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(in vec2 p) { 
	float s = .0;
	float m = .0;
	float a = .5;	
	for(int i = 0; i < 5; i++) {
		s += a * noise(p);
		m += a;
		a *= .5;
		p *= 2.;
	}
	return s / m;
}

vec3 carToPol(vec3 p) { // learned this here -- https://www.shadertoy.com/view/WsSXWm
    float r = length(p);
    float the = acos(p.z/r);
    float phi = atan(p.y,p.x);
    return vec3(r,the,phi);
}


vec4 render(vec2 uv) {
  vec3 col = vec3 (0);
  
  vec3 ro = vec3(sin( sin( iTime*rotSpeed)*pi/2. -2. )*zoom,sin(iTime + cos(iTime)),cos(sin(iTime*rotSpeed)*pi/2. -2. )*zoom);
  vec3 lookAt = vec3(0);
  vec3 rd = getRd(ro, lookAt, uv);
  
  vec3 glow = vec3(0);
  float t = 0.;
  vec3 p = ro; 
  float side = 1.;  // thanks nusan for refraction logic! 
  
  float bounces = 0.;
  
  float colStrength = 1.;
  
  for (int i = 0; i < 220; i++) {
      vec2 d = map(p);
      d.x *= side;
    
      glow += spectra(d.x, 13. + sin(iTime) * 4.)*0.6;
      if (d.x < 0.001) {
        vec3 n = getNormal(p)*side;
        vec3 posLightA = vec3(0,3.,-4);
        vec3 colLightA = vec3(0.3,0.5,0.9);
        vec3 posLightB = vec3(0,-4.,3);
        vec3 colLightB = vec3(0.5,0.7,0.9);
        
        vec3 lA = normalize(posLightA - p);
        vec3 lB = normalize(posLightB - p);
        vec3 hA = normalize(lA - rd);
        vec3 hB = normalize(lB - rd);
        
        float diffA = max(dot(lA, n), 0.);
        float diffB = max(dot(lB, n), 0.);
        
        float specA = max(dot(n,hA), 0.);
        float specB = max(dot(n,hB), 0.);
        
        float fres = pow(1. - max(dot(n, -rd),0.), 5.);
        
        vec3 colA = diffA * colLightA;
        vec3 colB = diffB * colLightB;
        //col = vec3(1);
        
        
        if (d.y == 1.) {
         
          col += (colA + colB)*glow*colStrength*fres  + fres*0.1;
          
          //col += fres * glow * 0.1*colStrength;
          
          colStrength *= 0.9;
          
          rd = refract(rd, n, 1. + 0.01*n.y);
          
          d.x = 0.6;
            
          side *= -1.;
          bounces += 1.;
           
          
        } else if (d.y == 2.) {
          
          
          //col += (colA + colB*0.1)*glow*colStrength + fres*0.6;
          
          col += fres*(colA + colB) + colA*0.8;
          
          rd = reflect(rd, n);
          
          d.x = 0.2;
          colStrength *= 0.4;
          
          bounces += 1.;
        }else if (d.y == 3.) {
         
          col += (colA + colB)*glow*colStrength * vec3(0.9,0.9,0.2) + fres*0.1;
          
          colStrength *= 0.6;
          
          rd = refract(rd, n, 1. + 0.0);
          
          d.x = 0.6;
            
          side *= -1.;
          bounces += 1.;
        
        
        
      }
        
        if (bounces > 5.) break;
        //break;
        //break; 
      }
      
      if (length(p) > 50.) {
        rd.yz *= rot(0.5*pi);    
        
        vec3 pPolar = carToPol(rd);
        
        float fA = fbm(pPolar.yz*6.);
        vec3 fB = fbm(pPolar.yz*6. + fA*6. + iTime*0.1) * spectra(fA, 90.);
        
        col += fB* colStrength*0.1;
        
        //col = vec3(0);
        break; 
      }
    col += glow*0.00006;
    t += d.x;
    p = ro + rd * t;
  }
  
  
  //col += smoothstep(0.,1., pow(t.x - 54., 7.)) * vec3(0.8,0.3,0.7);
  col *= 0.2;
  col = ACESFilm(col);
  col = pow(col, vec3(0.44));
  return vec4(col, 0);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec4 col = render(uv);

    fragColor = vec4(col);
    fragColor.a = 1.;
}
`;

export default class implements iSub {
    key(): string {
        return 'wtd3zX';
    }
    name(): string {
        return '[music][twitch] Day 5 of MDTMJVM';
    }
    sort() {
        return 752;
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
}
