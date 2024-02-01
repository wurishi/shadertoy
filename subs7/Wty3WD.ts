import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define start_offset (0.)

// - time divisions - //
#define tmp    129.
#define msr    ((tmp/100.)*8.)
#define dmsr   (msr*2.)
#define hmsr   (msr/2.)
#define qmsr   (hmsr/2.)
#define bar    (tmp/100.)
#define hbar   (bar/2.)
#define beat   (bar/4.)
#define hbeat   (beat/2.)
#define qbeat  (beat/4.)
#define sbeat  (qbeat/4.)

#define pi acos(-1.)
#define tau acos(-1.)*2.

// - sequencer functions - //
#define M(N) (floor(t/msr)== N) 
#define Q(synth, env, seq) hit = t-seq<0.?0.:t-seq ; s += synth*env;

// - utils - //
float sidechain(float t){
    float hit  = mod(t, bar/1.);
    float hit2 = clamp(mod(t + bar/3. ,bar), 0., 1.);
    float env1 = exp(-hit*20.); 
    float env2 = exp(-hit2*20.);
	return env1 + env2;
}


float rnd(float i){
	return fract(sin(i)*1235.41252156);
}

float nois(float t){
    float n = 0.;
    n = fract(rnd(t)*rnd(t*2.41));
    vec2 p = vec2(fract(rnd(t*14.11)),fract(rnd(t*124.1)*rnd(t*3.15)));
    vec2 q = vec2(fract(rnd(t*14.124)*rnd(t*41.15)), n*0.15);
    n = fract(dot(p,q));
    
	return n;
}   
float freq(float n, float o){
	return pow(27.5, ((o*12.) + n)/12.);
}
float n(vec2 i){
 //   i *= 2.;
 //return fract(dot(vec2(i.x*1.6525, i.y*1.512), i)*24124.124124);
 return fract(sin(dot(vec2(i.x*1.6525, i.y*1.512), i)*2124.124124));
 //return fract(sin(dot(vec2(i.x*1.6525, i.y*1.512), i)*2124.124124)*214124.12412);
}
float hash(float i){
	return fract(sin(114.121*i)*11252.11242512);
}
vec2 hash22(vec2 p)
{
    p  = fract(p * vec2(5.3983, 5.4427));
    p += dot(p.yx, p.xy +  vec2(21.5351, 14.3137));
    return fract(vec2(p.x * p.y * 95.4337, p.x * p.y * 97.597));
}

vec2 noise(float t)
{
    return hash22(vec2(t, t * 1.423)) * 2.0 - 1.0;
}

float random( vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.1);
}
float random(float st){
	return fract(sin(st*21451.24124)*st*1.2314);
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

// ----- sound stuff ----- //
float env(float attack, float hold, float release, float t){
    float res=0.;
    float releaseRange = 4.;
    if (release > releaseRange) release = releaseRange;
    if (t < attack){
    	//res=mix(exp(t - 2.) - exp(-2.), 1.,t/attack);
        res=mix(0., 1.,t/attack);
        //res = 0.;
    } else if (t < attack + hold) {
    	res=1.;
    } else{
    	res = exp((-t+attack + hold)*mix(4.,0.,release/releaseRange));
        // 
    }
    
	return res;
}


float note(float note, float octave){
	return 27.5*pow(2., ((octave*12.) + note )/12.);
}

mat2 rot(float deg){return mat2(cos(deg), sin(-deg), sin(deg), cos(deg));}

vec3 getRd (vec3 ro,vec3 lookAt ,vec2 uv){
    vec3 look = normalize(lookAt - ro);
	vec3 r = normalize(cross(vec3(0,1,0), look));
    vec3 u = normalize(cross(look, r));
    return look + r*uv.x + u*uv.y;
}`;

const buffA = `#define max_steps   250
#define min_dist 	0.001
#define max_dist 	400.

#define T           iTime
#define my          (590.*iMouse.y/iResolution.y + T*20.)
#define mx          (20.*iMouse.x/iResolution.x)

#define shaking
//#define pi 			(acos(-1.))

// -- globals -- //
int scene = 2;
int id = 0; // 1 is ground, 2 is struct
int idS= 0;     // ids for structs. 0 is black, 1 is white, 2 is whatever
float DGROUND = 0.;

float pModPolar(inout vec2 p, float repetitions) {
	float angle = 2.*pi/repetitions;
	float a = atan(p.y, p.x) + angle/2.;
	float r = length(p);
	float c = floor(a/angle);
	a = mod(a,angle) - angle/2.;
	p = vec2(cos(a), sin(a))*r;
	// For an odd number of repetitions, fix cell index of the cell in -x direction
	// (cell index would be e.g. -5 and 5 in the two halves of the cell):
	if (abs(c) >= (repetitions/2.)) c = abs(c);
	return c;
}

float r31(vec3 p) {
	float h = dot(p,vec3(127.1,811.7, 542.1));	
    return fract(sin(h)*43758.5453123);
}


float valueNoise(vec3 uv){
    vec3 id = floor(uv);
    vec3 fd = fract(uv);
//    fd = smoothstep(0.,1., fd);
    
    float ibl = r31(id + vec3(0,-1,0));
    float ibr = r31(id + vec3(1,-1,0));
    float itl = r31(id + vec3(0));
    float itr = r31(id + vec3(1,0,0));
    
    
    float jbl = r31(id + vec3(0,-1,1));
    float jbr = r31(id + vec3(1,-1,1));
    float jtl = r31(id + vec3(0,0, 1));
    float jtr = r31(id + vec3(1,0, 1));
    
    
    float ibot = mix(ibl, ibr, fd.x); 
    float iup = mix(itl, itr, fd.x);
    float jbot = mix(jbl, jbr, fd.x);
    float jup = mix(jtl, jtr, fd.x);
    
    float i = mix(ibot, iup, fd.y);
    float j = mix(jbot, jup, fd.y);
    
    //return j;
    float h = mix(i, j, fd.z); 
        
    float res = h;
    
	return res;
}

float fbm(vec3 uv){
    
    uv*= 0.05;
    
	float res = 0.;
    
    
//    uv = abs(uv);
    
    res += valueNoise(uv*2.)*7.;
    res += valueNoise(uv*8.)*0.4;	
    res += valueNoise(uv*21.)*0.4;	
    
    
	return res;
}

float sdBox(vec3 p,vec3 s){
    p = abs(p);
	return max(p.y - s.y,max(p.x - s.x, p.z - s.z) );

}
vec2 offsTunn(vec3 p){
    vec2 off = vec2(0);
    
    p.z *= 0.01;
    off.x += cos(p.z);
    off.y += sin(p.z);
    
    off *= 100.;
    
	return off;
}
float sdGround(vec3 p){
	float d = 100.;
    vec3 q = p;
    q.xy += offsTunn(q);
    float dGround = -(length(q.xy) -29.);
    d = min(d, dGround);
    d = min(d, d - fbm(q)*1.9);
    d = min(d, d - fbm(q*2.5)*1.9);
    DGROUND += d;
    return d/3.;
}
float curve(float t, float d) {
  float g=t/d;
  float it=fract(g);
  it=smoothstep(0.,1.,it);
  it=smoothstep(0.,1.,it);
  it=smoothstep(0.,1.,it);
  return mix(rnd(floor(g)), rnd(floor(g)+1.), it);
}

float tick(float t, float d) {
  float g=t/d;
  float it=fract(g);
  it=smoothstep(0.,1.,it);
  it=smoothstep(0.,1.,it);
  it=smoothstep(0.,1.,it);
  return floor(g) + it;
}


float sdGeometry(vec3 p){
	float d = 100.;
    
    // ----- Geom ----- // 
    // -- base box
    vec3 pB = vec3(0,-1.,0);
    vec3 sB = vec3(0.4, 0.05 ,1.0);
	float dBox = sdBox(p - pB, sB);
    // -- base2 box
    vec3 pBU = pB + vec3(0,sB.y,0);
    vec3 sBU = sB*0.9;
	float dBoxU = sdBox(p - pBU, sBU);
    // -- pipes
    vec3 sP = vec3(0.07,0.5,0.07);
    vec3 pP = vec3(sB.x*0.75,-0.5,sB.z*0.8);
    float dPipes = sdBox(p - pP, sP);
    dPipes = min(dPipes, sdBox(p - vec3(-pP.x,pP.y,pP.z), sP));
    dPipes = min(dPipes, sdBox(p - vec3(-pP.x,pP.y,-pP.z), sP));
    dPipes = min(dPipes, sdBox(p - vec3(pP.x,pP.y,-pP.z), sP));
    // -- top box
    vec3 sBT = vec3(sB.x*0.3, sB.y, sB.z);
    vec3 pBT = pB + vec3(sB.x - sBT.x,sP.y*2.,0);
	float dBoxT = sdBox(p - pBT, sBT);
	dBoxT = min(sdBox(p - vec3(-pBT.x, pBT.y, pBT.z), sBT), dBoxT);
    // -- mid box
    vec3 sBM = vec3(sB.x/2.,sB.y,sB.z);
    vec3 pBM = vec3(0.,-1.+sP.y,0);
    float dBoxM = sdBox(p - pBM, sBM);
    // -- mid box2
    vec3 sBM2 = vec3(1.);
    vec3 pB2M = vec3(0.,-1.+sP.y,0);
    float dBoxM2 = sdBox(p - pBM, sBM);
    
    
    
    // ------ end ----- //
    d = min(d, dBox);
    d = min(d, dBoxU);
	d = min(d, dBoxT);
	d = min(d, dBoxM);
	d = min(d, dPipes);
    // -- material ids -- //
    dBox<=d ? idS=1 : dBoxU<=d ? idS=2 : dPipes<=d ? idS=3 : dBoxT<=d? idS=1 :
    dBoxM<=d ? idS=4: idS=0;
    

	    
    return d;
}

float sdStructScene1(vec3 p){
	float d = 100.;
    vec3 pOrig = p;
    float sep =  35.;
    float id = floor(p.z/sep);
    
    float dist=50.0;
    p = (fract(p/dist+.5)-.5)*dist;
    	
    for (float i = 0.; i < 4.; i++ ){
    
        p.x -= 2.4;
        p.y -= 0.1;
        p.xz *= rot(0.31);
        p.yz *= rot(0.51);
        p.z -= 2.9;
        
    	p.x = abs(p.x);
    	p.z = abs(p.z);
    	p.y = abs(p.y);
    }
    
    
    
    
    d = min(d, sdGeometry(p));
    
    return d;
}

float sdStructScene2(vec3 p){
	float d = 100.;
    p.xy += offsTunn(p);
    float sep =  35.;
    float id = floor(p.z/sep);
    p.z = mod(p.z, sep) -sep/2.;
    
    float reps = 5.;
	pModPolar(p.xy, reps);    
    vec3 polarP = vec3(reps - 1., 0., 0.);
    
    for (float i = 0.; i < 3.; i++){
    	p.y -= 0.5;
    	p.x -= 1.5 - curve(T + id, 1.5)*1.9;
    	p=abs(p);
		p.z -= 0.9 + fract(id*2144.124)*0.5;
        
    	p.yz *= rot(4.5 + sin(T*0.2  + id)*0.5);
    	p.xz *= rot(0.4);
    }
    
    p -= polarP;
    d = min(d, sdGeometry(p));
    
    return d;
}
float map(vec3 p){
	float d = 100.;
    float dStruct;
    float dTunnGround;
    if (scene == 1){
    	dStruct = sdStructScene1(p);
        dTunnGround = 10000.;
    }
    else if (scene == 2){
    	dStruct = sdStructScene2(p);
        dTunnGround = sdGround(p);
    }
    d = min(dStruct, d);
    d = min(d, dTunnGround);
   	dStruct <= d ? id = 1 : dTunnGround <= d ? id = 2 : id = 0;
    return d;
}

vec3 normal (vec3 p){
	vec2 e = vec2(0.001, 0);
	return normalize(map(p) - vec3(
    	map(p - e.xyy),
    	map(p - e.yxy),
    	map(p - e.yyx)
    ));

}

vec3 shake(vec3 p){
	p.y += fract(sin(p.z*1.1))*0.01;
	p.x += fract(sin(p.z*2.1))*0.01;
    return p;
}
#define spectra(t) (0.9  + sin(t + 1.5 + 2.*vec3(0.1,0.4,0.6) )*0.4   )
#define spectra2(t, beat) (-0.5 + beat  + sin(t + 4.9 + 1.*vec3(0.9,0.4,0.6) )*0.6   )
vec4 render(vec2 uv){
	vec3 col = vec3(0);

    vec3 ro;
    vec3 lookAt;
    float trig;
    if (scene == 1){
        float z = 30.;
        ro = vec3(0. , 0,-1. );
        ro.x += sin(mx)*z; ro.z += cos(mx)*z;
        lookAt = vec3(0. ,0,0.);
        trig = 1.;
    } else if (scene == 2){
        ro = vec3(0. , 0,-11. + my);
        #ifdef shaking
    	ro = shake(ro);
        #endif
        ro.xy -= offsTunn(ro);
        lookAt = vec3(0. ,0,-8. + my);
        lookAt.xy -= offsTunn(ro + vec3(0,0,3));
        trig = exp(-mod(T, 0.5));
    }
    
    vec3 rd = getRd(ro, lookAt, uv);
    
    vec3 glow = vec3(0);
    vec3 glow2= vec3(0);
    float t = 0.; vec3 p = ro;
    for (int i = 0; i<max_steps; i++){
    	float h = map(p);
    
        if (h < min_dist || t > max_dist) break;
        glow += spectra(t*0.05)*0.02;
        glow2+= spectra2(t*0.05, trig)*0.02;
        t += h;
        p += h * rd;
    }
    if (scene == 1){
        glow2.g *= 0.9;
        col =  glow2*20.; 
        col *= 0.1;
        
        col -= t*0.0009;
        //col *= shade(p, ro, rd);
    }
    else if (scene == 2){
        if (id == 2){
            //col -= DGROUND*0.01;
            col = glow ;
            float restraint = clamp(exp(-length(glow)*1.95 + 2.34),0., 1.);
            //col *= restraint;
            //col.b *= restraint;
            //col.b = col.b*0.4 + col.b*restraint*0.6;

            col.g = pow(col.g, 2.);
            //col.g -= DGROUND*0.001;
        } else {
            glow2.g *= 0.9;
            col =  glow2*20.; 
            col *= 0.1;
            //col *= shade(p, ro, rd);
        }
    
    }
    
    
    //col += t*0.02;
    
    
    return vec4(col, t);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = (fragCoord-0.5*iResolution.xy)/iResolution.y;

    vec4 col = render(uv);

    fragColor = vec4(col);
}`;

const buffB = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = (fragCoord-0.5*iResolution.xy)/iResolution.y;
	vec3 col = vec3(0);
    
    vec3 f = texelFetch(iChannel0, ivec2(fragCoord), 0).xyz;
    
    vec3 z = texelFetch(iChannel1, ivec2(fragCoord), 0).xyz;
    float d = texelFetch(iChannel1, ivec2(fragCoord), 0).w;
    
    
    float blurAmt = 0. + clamp(exp(-d*5.),0.,1.);
    
    
    
    
    col += f*(1. - blurAmt);
    //col += z*blurAmt*8.5;

    col.g /= d*1.3;
    col.b/= d*1.3;
    
    fragColor = vec4(col,1.0);
}`;

const sound = `
vec2 sAmbG(float t, float freq){
	vec2 s = vec2(0);
    t = mod(t, hmsr);
    float iters = 3. + clamp( exp(-t/2.)*5., 0., 30.);
    for (float i = 1.;i < iters; i++){
    	s += sin(t*tau*freq*i)/i;
    }
    
    vec2 n = noise(t);
    vec2 sOrig = s;
    float tMod = sin(t*8.)*(1. + exp(t/2.- 1.)*0.3);
    float tMod2 = cos(t*2.)*0.5;
    s = sOrig*sin(freq*4.*t*tau + n.x*0.4  + tMod          );
    s += sOrig*sin(freq*2.*t*tau + n.y*0.4 + tMod2        );
    s += sOrig*(fract(freq*8.*t*tau + n.y*0.4 -tMod + tMod2  ));

    s /= 4.;
    
    return s;
}
vec2 gPadSaw(float t){
	vec2 s = vec2(0);
	float hit;
    
    if(M(0.) || M(1.)  ){
        t = mod(t, msr*2.);
        if (t<hmsr){
        	s += sAmbG(t, note(1.,2.));
    		s += sAmbG(t, note(6.,2.));
    		s += sAmbG(t, note(9.,2.));
        } else if (t<msr){
        	s += sAmbG(t, note(3.,2.));
    		s += sAmbG(t, note(7.,2.));
    		s += sAmbG(t, note(9.,2.));
            if (t>msr -hmsr/2.) s += sAmbG(t, note(10.,2.));
        } else if (t<msr+hmsr){
        	s += sAmbG(t, note(4.,2.));
    		s += sAmbG(t, note(7.,2.));
    		s += sAmbG(t, note(9.,2.));
        }
		else if (t<msr*2.){
        	s += sAmbG(t, note(3.,2.));
    		s += sAmbG(t, note(7.,2.));
    		s += sAmbG(t, note(9.,2.));
            if (t>msr -hmsr/2.) s += sAmbG(t, note(10.,2.));
        }    	
        
    } else if (M(2.) || M(3.)){
        t = mod(t, msr*2.);
        if (t<hmsr){
        	s += sAmbG(t, note(5.,2.));
    		s += sAmbG(t, note(10.,2.));
    		s += sAmbG(t, note(13.,2.));
        } else if (t<msr){
        	s += sAmbG(t, note(7.,2.));
    		s += sAmbG(t, note(11.,2.));
    		s += sAmbG(t, note(13.,2.));
            if (t>msr -hmsr/2.) s += sAmbG(t, note(10.,2.));
        } else if (t<msr+hmsr){
        	s += sAmbG(t, note(8.,2.));
    		s += sAmbG(t, note(11.,2.));
    		s += sAmbG(t, note(13.,2.));
        }
		else if (t<msr*2.){
            float expMod = exp(-mod(t - msr -hmsr/2., msr)*0.2)*0.5;
            float revExpMod = exp(mod(msr+hmsr, msr)*0.05 - 1.)*0.5;
            float pitchDown =  1. + revExpMod*sin(t*(30. + revExpMod*400.))*0.04 - expMod;
        	s += sAmbG(t, note(7.,2.)*pitchDown);
    		s += sAmbG(t, note(11.,2.)*pitchDown);
    		s += sAmbG(t, note(13.,2.)*pitchDown);
            if (t>msr -hmsr/2.) s += sAmbG(t, note(10.,2.)*pitchDown);
        }    	
    
    }
    return s;
}
vec2 gIntroAmb(float t){
    vec2 s = vec2(0);
    
    float iters = 30.;
    if (M(0.) || M(1.)){
        for (float i = 0.; i<iters; i++){
            float f = 1900.+ hash(i)*(170. + sin(t)*300. );
            f*= 0.33;
            float tex = texture(iChannel0, vec2(i/1000.)).x;
            s += (sin(t*f)*noise(vec2(f*i*0.1,f*i*0.11))*tex)/iters;
        }
    } else if(M(2.) || M(3.)){
        for (float i = 0.; i<iters; i++){
            float m1 = exp(t*0.25 - 4.)*13.;
            float m2 = sin(t*(1. + m1*0.006));
            float f = 1900.+ hash(i)*(170. + m1 + m2  );
            f*= 0.33;
            
            if (t>(msr*3.75)){
                float h = t - msr*3.75;
                f *= 1. + (1./(h+1.)+ 1.)*4.; 
            }
            float tex = texture(iChannel0, vec2(i/1000.)).x;
            s += (sin(t*f)*noise(vec2(f*i*0.1,f*i*0.11))*tex)/iters;
        }
    } 
    s *= 4.;
    return s;

}

vec2 gSub(float t){
	vec2 s = vec2(0);
    
    
    if (M(0.)){
    
    }
    else if (M(4.) || M(5.)){
        if (t < bar)
        	s += sin(freq(2.05 + clamp(exp(-mod(t,bar))*4., 0., 8.), 1.)*tau*t);
        else
            s += sin(note(10.1,0.)*tau*t);
        
    } if ( M(6.) || M(7.) || M(8.) || M(9.)){
       	s += sin(note(10.1,0.)*tau*t);
    }
    float satAmt = 0.4;
    
    
    // sidechain
    float hit  = mod(t, bar/1.);
    float hit2 = clamp(mod(t + bar/3. ,bar), 0., 1.);
    float env1 = exp(-hit*10.); 
    float env2 = exp(-hit2*10.);
    s *= clamp( 1. - env1*5. - env2 *5.,0., 1.) ;
    
    
    return s;
}
vec2 gKick(float t){
    vec2 s = vec2(0);
	float hit  = mod(t, bar/1.);
    float hit2 = clamp(mod(t + bar/3. ,bar), 0., 1.);
    
    if (M(0.) || M(1.) ){
    
    } else if(M(2.) || M(3.)){
        if (t > msr*3.5 && t < msr*3.75){
        	hit  = mod(t, beat*2.);
        	s += sin(tau*(30. + exp(-hit*40.)*10.));
        }
        
    	 else if (t > msr*3.75){
        	hit  = mod(t, qbeat);
        	s += sin(tau*(30. + exp(-hit*40.)*10.));
        } else {
            s += sin(tau*(30. + exp(-hit*40.)*10.));
            s += sin(tau*(30. + exp(-hit2*40.)*10.));
            s *= 0.4;
        }
    }
    else if (M(4.) || M(5.) || M(6.) || M(7.)|| M(8.) || M(9.)){
    	float rel = 12.;
        s += sin(tau*15.*exp(-hit*rel*2./3.))*exp(-hit*rel*2.);
        s += sin(tau*10.*exp(-hit*66.))*exp(-hit*rel*6.)/2.;
        s += sin(tau*15.*exp(-hit2*rel*2./3.))*exp(-hit2*rel*2.); 
        s += sin(tau*10.*exp(-hit2*66.))*exp(-hit2*rel*6.)/2.;    
    }


    
    s  = s + (s / (0.2 + abs(s)));
    s *= 0.4;
    s = clamp(s, -1., 1.);
    s *= 2.;
    return s;
}
vec2 gSnare(float t){
	vec2 s = vec2(0);
    
    float hit = mod(t + hbar/2.,hbar);
    
    if (M(2.) || M(3.)){
        if (t > msr*3.5){
        	float tMod = t - msr*3.5;
            s += sin(tau*( (9.5 + - exp(tMod)*10.)*clamp(exp(-hit*(95. )),0.15,0.5)));
            //s += sin(tau*( (9.5 + - exp(tMod)*10.)*clamp(exp(-hit*(95. )),0.15,0.5)));
            s = s/(1.4 - abs(s));
            
        } else{
            s += sin(tau*( 9.5*clamp(exp(-hit*95.),0.15,0.6)));
            s = s/(1.6 - abs(s));
        }
        
    }
    else if (M(4.) ||M(5.)  || M(6.) || M(7.) || M(8.) || M(9.)  || M(10.) || M(11.) ){
    
    	s += sin(tau*freq(12.+ 1.2*exp(-hit*26.) ,0.))*exp(-hit*18.);    	
            
        float satAmt = 0.5;
        s = s*(1.-satAmt) +  (s / (0.99 -abs(s)))*satAmt;
        //s *= 0.7;
        s = (s + nois(t + rnd(t))*s*3.)/2.; 
    
    }

    

    s *= 0.9;
    s = clamp(s, -1., 1.);
    
    return s;
    
}
vec2 gHats(float time){
    
	float s;
    int t = int(time*iSampleRate/7.);
    t = int(time*iSampleRate);
    float currentMeasure = floor(time/(msr));
    if (currentMeasure<4.){
        if (currentMeasure < 1.)
        	time = mod(time, beat*2.);
         else 
            time = mod(time, beat);
        
    	t = t % ((t >>3) % t*2);
        s =float(t & 0xff - 128)/ 128.;
        s *= pow(exp(-mod(time,qbeat*20.)), 30.);
        s = (s + (s*nois(time * mod(time, 0.001)*100.))*9.*exp(-time));
        s *= 3.;
    }
    if (currentMeasure==4.){
        time = mod(time, beat);
    	t = t % ((t >>3) % t*2);
        s =float(t & 0xff - 128)/ 128.;
        s *= pow(exp(-mod(time,qbeat*20.)), 30.);
        s = (s + (s*nois(time * mod(time, 0.001)*100.))*9.*exp(-time));
        s *= 3.;
    }
    else if (currentMeasure==5.){
        time = mod(time, beat);
    	t = t % ((t >>2) % t*2);
        s =float(t & 0xff - 128)/ 128.;
        s *= pow(exp(-mod(time,qbeat*20.)), 9.);
        s = (s + (s*nois(time * mod(time, 0.001)*100.))*9.*exp(-time));
        s *= 4.;
    } else if (currentMeasure==6. || currentMeasure==7. || currentMeasure==8.|| currentMeasure==9.  ){
        time = mod(time, beat);
    	t = t % ((t >>2) % t*2);
        s =float(t & 0xff - 128)/ 128.;
        s *= pow(exp(-mod(time,qbeat*20.)), 9.);
        s = (s + (s*nois(time * mod(time, 0.001)*100.))*9.*exp(-time));
        s *= 4.;
    
    }
    
    
    //s = clamp(s, -1., 1.);
    
    
    return vec2(float(s));
}
vec2 gHats2(float time){
    if (time < msr*2.) return vec2(0);
    
    if (mod(time, hmsr) < 0.25){
    	time = mod(time, qbeat*8.) - hbeat;
    } else {
    	time = mod(time, qbeat*4.) - hbeat;
    }
	
	float s;
    int t = int(time*iSampleRate);
    
    t = t % ((t >>2) % t*2);
    s =float(t & 0xff - 128)/ 128.;
    s *= pow(exp(-mod(time,qbeat*20.)), 30.);
    s = (s + (s*nois(time * mod(time, 0.001)*100.))*9.*exp(-time));
    s *= 3.;
	return vec2(s);
}

vec2 gBass(float time){
	float s;
    int t = int(time*iSampleRate/7.);
    
    //time +=hmsr + bar;
    if (floor(time/msr)==0. || floor(time/msr)==1. || floor(time/msr)==2. || floor(time/msr)==3. ){
    	return vec2(0.);
    } 
    
    else if (floor(time/msr)==4.){
        time = mod(time, msr);
        t = int(time*iSampleRate/7.);
    	if(time < beat)	
    		t = t&(t>>6)*(t<<3);
    	else if(time < beat*2.)
    		t = t&(t>>1)*(t<<4);    
        else if(time < bar)
           	t = t&(t>>2)*(t<<4);    
        else if(time < bar*2.)
           	t = t&(t>>1)*(t<<1);    
        else if(time < bar*4.)
           	t = t&(t>>1)*(t<<1);
        // halfmsr
        else if(time < hmsr + beat*3.)
           	t = t&(t>>5)*(t<<1);    
        else if(time < hmsr + bar)
           	t = t&(t>>6)*(t<<3);    
        else if(time < hmsr + bar*4.)
           	//t = t&((t>>2)*(t<<5))*(t>>int(exp(-mod(time,bar)*2.)*2. + 4.));    
            t = t&((t>>6)*(t<<3))*(t>>int(exp(-mod(time,bar)*2.)*1. + 6.));    
        else
            t = 0;
    } else if (floor(time/msr)==5.){
        time = mod(time, msr);
        //time += hmsr + beat*3.; 
        t = int(time*iSampleRate/7.);
    	if(time < beat)	
    		t = t&(t>>4)*(t<<3);
    	else if(time < beat*2.)
    		t = t&(t>>6)*(t<<4);    
        else if(time < bar)
           	t = t&(t>>8)*(t<<2);    
        else if(time < bar*2.)
           	t = t&(t>>1)*(t<<1);    
        else if(time < bar*4.)
           	t = t&(t>>1)*(t<<1);
        // halfmsr
        else if(time < hmsr + beat*3.)
           	t = t&(t>>5)*(t<<1);    
        else if(time < hmsr + bar)
           	t = t&(t>>6)*(t<<3);    
        else if(time < hmsr + bar*4.){
            t = int(time*iSampleRate/7.);
            int tMod = (t*int(sin(time*hmsr) + 1.));
           	//t = t<<((t<<29*t)&(t*4));
            t = t&((t>>6)*(t<<3))*(t>>int(exp(-mod(time,bar)*2.)*2. + 6.));    
    	}
            //t = t&((t>>3)*(t<<2))*(t>>int(exp(-mod(time,bar)*3.)*1. + 2.));    
        else
            t = 0;
    } else if (floor(time/msr)==6.){
        time = mod(time, msr);
        t = int(time*iSampleRate/7.);
    	if(time < beat)	
    		t = t&(t>>2)*(t<<3);
    	else if(time < beat*2.)
    		t = t&(t>>2)*(t<<3);    
        else if(time < bar)
           	t = t&(t>>2)*(t<<4);    
        else if(time < bar*2.)
           	t = t&(t>>1)*(t<<1);    
        else if(time < bar*3.)
           	t = t&(t>>2)*(t<<1);    
        else if(time < bar*4.)
           	t = t&(t>>1)*(t<<1);
        // halfmsr
        else if(time < hmsr + beat*3.)
           	t = t&(t>>5)*(t<<1);    
        else if(time < hmsr + bar)
           	t = t&(t>>6)*(t<<3);    
        else if(time < hmsr + bar*2.75)
           	//t = t&((t>>2)*(t<<5))*(t>>int(exp(-mod(time,bar)*2.)*2. + 4.));    
            t = t&((t>>6)*(t<<3))*(t>>int(exp(-mod(time,bar)*2.)*1. + 6.));    
        else 
            t = t&((t>>6)*(t<<2))*(t>>int(exp(-mod(time,bar)*2.)*1. + 6.));    
    } else if (floor(time/msr)==7.){
        time = mod(time, msr);
        t = int(time*iSampleRate/7.);
    	if(time < beat)	
    		t = t&(t>>9)*(t<<1);
    	else if(time < beat*2.)
    		t = t&(t>>5)*(t<<1);    
        else if(time < bar)
           	t = t&(t>>2)*(t<<4);    
        else if(time < bar*2.)
           	t = t&(t>>1)*(t<<1);    
        else if(time < bar*3.)
           	t = t&(t>>2)*(t<<3);    
        else if(time < bar*4.){
            t = 1*t%(2*(t<<2)&(t<<2)*10);
            t = (t%190)%(t<<16);
        }
       //    	t = t&(t>>1)*(t<<2);
        // halfmsr
        else if(time < hmsr + beat*3.)
           	t = t&(t>>5)*(t<<1);    
        else if(time < hmsr + bar)
           	t = t&(t>>6)*(t<<3);    
        else if(time < hmsr + bar*2.75){
            t = 1*t%(2*(t<<2)&(t<<2)*10);
            t = (t%520)%(t<<16);
        }
           	//t = t&((t>>2)*(t<<5))*(t>>int(exp(-mod(time,bar)*2.)*2. + 4.));    
        //    t = t&((t>>6)*(t<<3))*(t>>int(exp(-mod(time,bar)*2.)*1. + 6.));    
        else 
            t = t&((t>>6)*(t<<2))*(t>>int(exp(-mod(time,bar)*2.)*1. + 6.)); 
    } else if (floor(time/msr)==8.){
    	time = mod(time, msr);
        //time += hmsr + bar*0.75;
        t = int(time*iSampleRate/7.);
    	if(time < beat*2.)	
    		t = t&(t>>4)*(t<<3);
    	else if(time < beat*2.)
    		t = t&(t>>4)*(t<<4);    
        else if(time < bar)
           	t = t&(t>>5)*(t<<4);    
        else if(time < hmsr){
           	t = 1*t%(2*(t<<2)&(t<<2)*10);
            t = (t%120)%(t<<16);
        }
        // halfmsr
        else if(time < hmsr + beat*3.)
           	t = t&(t>>5)*(t<<1);    
        else if(time < hmsr + bar)
           	t = t&(t>>6)*(t<<3);    
        else if(time < msr*2.){
			t = t%(1*(t<<1)&(t<<2)*10);
            //t = (t%900)>>(t>>20);
        }
    } else if (floor(time/msr)==9.){
    	time = mod(time, msr);
        //time += hmsr + bar*0.75;
        t = int(time*iSampleRate/7.);
    	if(time < beat*2.)	
    		t = t&(t>>4)*(t<<3);
    	else if(time < beat*2.)
    		t = t&(t>>4)*(t<<4);    
        else if(time < bar)
           	t = t&(t>>5)*(t<<4);    
        else if(time < hmsr){
           	t = 1*t%(2*(t<<2)&(t<<2)*10);
            t = (t%120)%(t<<16);
        }
        // halfmsr
        else if(time < hmsr + beat*3.)
           	t = t&(t>>5)*(t<<1);    
        else if(time < hmsr + bar)
           	t = t&(t>>6)*(t<<3);    
        else if(time < msr*2.){
			t = t%(1*(t<<1)&(t<<2)*10);
            //t = (t%900)>>(t>>20);
        }
    }
    
    s = float(t & 0xff - 128)/128.;
    s = s*2.- 1.;
    // FX
    
    //sc
    s *= 1.-(sidechain(time)*2.);
    s *= 1.-(clamp(exp(-mod(time + hbar/2.,hbar)*6.), 0., 5.))*0.2;
    //fm
    s =s + s*sin(tau*time*10200.)*0.3;
    
    
    
    s = s/(0.1 - abs(s));
    
    s = clamp(s, -1., 1.);

	return vec2(s);
}

vec2 mainSound( in int samp, float t )
{
    vec2 s = vec2(0);
    
    //t*=2.;
    //t += start_offset;
    
    float volHats = 0.6;
        
    if (M(5.) || M(6.) || M(7.) || M(8.) ){
    	volHats = 0.94;
    }
    
    
    
    s += gKick(t)*0.5;
    s += gSnare(t)*1.;
    s += gHats(t)*volHats;
    s += gHats2(t)*0.2;
    s += gBass(t)*0.115;
    s += gSub(t)*0.4;
    s += gPadSaw(t)*0.2;
	s += gIntroAmb(t)*0.5;

    if (t < msr*4.){ s*= 0.45;};
    if (M(3.)){
    	if (t > msr*3.95)
        {
        	s *= exp(-(t - msr*3.95)*0.5);
        }
    }
    
    s *= 0.6;
    s = clamp(s, -1., 1.);
    return s;
}`;

const fragment = `

// REWIND SHADER TO MAKE SOUND WORK.

// Some old stuff I never released
// THE VISUALS ARE VERY BASED ON https://www.shadertoy.com/view/4t2cR1
// WAS LEARNING MAKING TUNNELS

// Anyways, the main part is the sound.
// The drop bass uses a bunch of bytebeats, also the hihats.
// Bytebeat base code is from someone on shadertoy, but I don't recall who.

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 uv = (fragCoord-0.5*iResolution.xy)/iResolution.y;
	vec3 col = vec3(0);
    
    vec3 f = texelFetch(iChannel1, ivec2(fragCoord), 0).xyz;
    
    col += f;

    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'Wty3WD';
    }
    name(): string {
        return '[music] Ghidra';
    }
    sort() {
        return 750;
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
    common() {
        return common;
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
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 1 },
        ];
    }
}
