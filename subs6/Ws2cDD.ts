import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// offset to sync the music with the demo timing
#define StartOffset (48./17.)

//DAVE HOSKINS' HASH FUNCTIONS
// we use them mainly because they don't contain any sin/cos and so should be more consistent accross hardware
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

float c01(float a) {return clamp(a,0.,1.);}
`;

const buffA = `

// Lower that if it's too slow
#define SAMPLE_COUNT 40.

float time,bpm;
int section,scene,light;

// we use globals for most parameters, it save space
// s is starting position, r is ray direction
// n is normal at intersection point and d is distance to the intersection
vec3 s,r,n=vec3(0);
float d=10000.;

// id of intersected box, to use when repeating boxes
vec3 boxid=vec3(0);

// 2d rotation
mat2 rot(float a) {return mat2(cos(a),sin(a),-sin(a),cos(a));}

/*
void plane(vec3 pn, float dist) {
  float cur=(dist-dot(pn,s))/dot(pn,r);
  if(cur>0 && cur<d) {
    d=cur;
    n=-pn;
  }
}
*/

// analytical box intersection
void box(vec3 basepos, float side) {
  
  // we will repeat the box using a grid of those sizes
  vec3 rep = vec3(1,13,3);
  if(scene==2) rep = vec3(20,20,6);
  else if(scene==3) rep = vec3(sin(floor(basepos.z*0.3)+0.523)*2.+2.3);
  else if(scene==4) rep = vec3(50,50,15);
  else if(scene==5) rep = vec3(50,50,3);
  
  // unique vec3 cell id for each instance of the repeated box
  boxid = floor(basepos/rep+0.5)*rep;

  // angle of rotation of the box
  float a = sin(boxid.z)*0.2;
  vec3 size = rep*0.4;
  vec3 pos=vec3(0);

  // changing rotation, position, size of the box
  if(scene==2) {
	a=boxid.z*.09+time*.4;
	size = vec3(5.2,2,2.);
  }
  else if(scene==3) {
	a = time;
  }
  else if(scene==4) {
	a=boxid.z;
	pos = (rnd23(vec2(boxid.z,0))-0.5)*vec3(10,20,0);
	size = vec3(15,5,6.5);
  }
  else if(scene==5) {
	a=sin(rnd11(boxid.z)*6. + time*0.2)*6.;
	size = vec3(5,4,1);
  }
  
  // put everything in the box axis aligned space
  vec3 vr = r;  
  vr.xy *= rot(a);
  pos=s-pos-boxid;
  pos.xy *= rot(a);
  
  // finally the real box intersection computation
  vec3 box=max((size-pos)/vr,(-size-pos)/vr);
  float bd = min(min(box.x,box.y),box.z);
  // if we have an intersection in from of use, that faces the selected side
  if(bd>0. && bd>d*side) {
    vec3 cur = step(abs(pos+vr*d),size);
    // for the starting box, we only take intersection if it's not inside the cylinder
    // for the ending box, we only take intersection if we are actually inside the box
    if(side>0. ? (min(cur.x,min(cur.y,cur.z))>0.) : length((s+r*bd).xy)>5.) {
      // set new nearest distance
      d=bd;
      // compute normal of an axis aligned box
      n=-step(box-bd,vec3(0))*sign(pos+vr*d);
      // then rotate the normal
      n.xy*=rot(-a);
    }
  }
}

// analytical cylinder intersection
void cyl(float size, float side) {
  float da = dot(r.xy,r.xy);
  float db = dot(r.xy,s.xy);
  float delta = db*db-da*(dot(s.xy,s.xy)-size*size);
  if(delta<0.0001) return;
  
  float t = (-db+side*sqrt(delta))/da;
  if(t<0.0001 || t>d) return;
    
  d=t;
  n=-side*normalize((s+r*d)*vec3(1,1,0));
}

// find intersection of a ray starting at s and going in r direction
// with our scene
void trace() {
  d=100000.;
  
  // intersect with a box in case the ray start outside the cylinder
  box(s,-1.);
  
  // intersect with the main cylinder
  cyl(5., 1.);
 
  // intersect with a box in cases the ray end outside the cylinder
  box(s+r*d,1.);
  
  // a central pillar that was planed but finally removed
  //cyl(3., -1.);
  
  //plane(vec3(0,0.7,0.7), s.z*0.7+15.5);
    
  // switch to the new intersection position
  s = s + r * d;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 res = iResolution.xy;

	vec2 frag = fragCoord.xy;
	vec2 uv = (frag-res*0.5)/res.y;
	
	float ttime=iTime+StartOffset;
    // symmetry on one part of the demo
	if(ttime>64. && ttime<69.) uv.x=abs(uv.x)-0.4;

	vec3 col=vec3(0);
	
    // Main path tracing loop, do many samples to reduce the noise
    float ZERO=min(0.,iTime); // this is a trick to force the GPU to keep the loop
    // instead of trying to compile a giant shader by duplicating what's inside
	for(float i=ZERO; i<SAMPLE_COUNT; ++i) {
    
        // motion blur by offsetting time for each sample a little bit
		float basetime = ttime + i*(0.0005 + smoothstep(7.5,4.5,abs(ttime-77.))*0.008);
		bpm = basetime*170./60.-8.;
        // extract a camera shot index every 16 bpm
		section = int(bpm/16.);
		scene = 1;
		light = 1;
		float changespeed = 0.125;
		bool special = false;
        // switch camera parameters randomly each 8 beats
		vec3 pcam = rnd23(vec2(floor(bpm*changespeed)));
        // scene geometry / light selection
        // Sorry for that messy code inside the loop
        // Didn't have time to find a better way
		if(section<1) { // intro
			//scene = 1;
			//light = 1;
			//cam = 1;
		} else if(section<4) { // section A
            scene = section<2?2:1;
            light = 2;
		} else if(section<6) {
            scene = 3;
            //cam = section==5?1:0;
            light = section<5?1:1;
		} else if(section<12) { // break + B
            scene = section<8?1:3;
            light = 3;
            special=section>9;
		} else if(section<14) { // break 2
            scene = 5;
            light = 0;
		} else if(section<16) { // end
            scene = 5;
            light = 0;
            special=bpm>248.;
		} else if(section<20) { // end
            scene = 4;
            light = 4;
		}
		
        // randomly offset time for each shot to add variety
		time = basetime + rnd11(float(section))*123.427;

        // s is camera starting position
		s=vec3(-4,0,-0.5);
		s.xy *= rot(time*pow(pcam.x-.5,3.)*4.);
        
        // t is camera target position
		vec3 t = vec3(0,0,0);
    
        // camera forward motion
		float adv = time*(pcam.y-.1)*10.;
		if(scene==4) adv = adv*10. + time*pcam.z*30.;
		
		s.z += adv;
		t.z += adv;
		
		vec3 up = vec3(0,1,0);

        // camera type selection
		if(section==0 || section==5 || section==14 || section==15) {
            // plunging
			up = vec3(0,0,1);
			t += vec3(s.yx*vec2(1,-1),sin(bpm*.25)*9.+10.);
		} else {
			// looking forward
			t.x += sin(time)*3.-3.;
			t.z +=scene==4?pcam.y*80.:30.;
		}		
				
        // computing camera space vectors to point toward the target
		vec3 cz=normalize(t-s);
		vec3 cx=normalize(cross(cz,up));
		vec3 cy=cross(cz,cx);
    
		float fov = .3+pcam.z*.7;
		
        // Depth of field 
        // we take a random position in a disk in view space
        float dof = 0.2;
		vec2 h = rnd23(frag-13.6-i*184.7).xy;
		vec3 voff = sqrt(h.x)*(cx*sin(h.y*6.283)+cy*cos(h.y*6.283))*dof;
		s-=voff;
        float focusdistance = (section==5 ? 7. : length(t-s)*fov);
		r=normalize(uv.x*cx+uv.y*cy+fov*cz + voff*fov/focusdistance);
				
        // 3 pathtracing bounces
		vec3 bs = s;
		for(float j=0.; j<3.; ++j) {
            // find intersection starting from s in r direction (goes to variable s)
			trace();
			
			if(d>10000.) break;
		
			vec3 id = floor(s*1.5-.01);
			vec3 grid = step(fract(s*1.5-.01),vec3(.8));
			float middle = step(5.1,length(s.xy));
			float r3d = rnd31(id*27.33);
			
			vec3 val=vec3(0);
			
            // Lights switchs
			if(light==0) {
				val = 2. * vec3(rnd11(floor(s.z*0.04)),rnd11(floor(s.z*0.05)),0.5) * step(s.y+4.,0.);
				val *= smoothstep(.8,.9,rnd11(floor(s.z*0.7+floor(bpm)*19.37)));
			}
						
			if(light==1) val += middle * vec3(0.2,0.5,0.9) * step(0.7,rnd11(boxid.z+floor(section<1?0.:time)*0.1));
			if(light==2 || special) val += middle * vec3(0.2,0.5,0.9)*max(0.,fract(.2-bpm*0.125+boxid.z*0.01)*3.-1.5);
			if(light==3) val += vec3(.8+sin(time*.7)*.4,1.8,1.+sin(time*.4)*.6) * smoothstep(1.+sin(-s.z*0.07+sin(s.z*0.04+bpm*4.)+bpm*3.)*.6 + sin(time*17.)*.2,0.,abs(s.x)) * step(s.y,0.5);
			if(light==4) val = 2.*step(6.,abs(s.x)) * (sin(boxid.z*vec3(27.81,12.42,49.7))*.5+.5)*grid.y*grid.z*step(0.85,fract(r3d+bpm*0.1));
			
            // avoid negative lights
			val=max(vec3(0),val);

			col += val;
			            
            // roughness switchs
			float rough = 0.45*r3d;
			if(scene==4 || light==3 || light==0) rough = mix(1.,rough,min(grid.x,min(grid.y,grid.z)));
			if(light<3 || light==4) if(abs(abs(s.x)-3.)>0.9 && fract(id.z*0.01)<0.5) rough=1.;
			if(light==3 && middle>0.0) rough = c01(r3d-.5);
			
            // jitter reflection ray randomly, according to roughness
            // mainly taken from newton protocol
            // roughness change the size of a cone around a pure reflection vector
			r=normalize(reflect(r,n) + normalize(rnd23(frag+vec2(i*277.,j*375.)+fract(time))-.5)*rough);
			
            // slight offset to get out of geometry
			s+=n*0.01;
			
		}
	}
	col /= SAMPLE_COUNT;

	fragColor = vec4(col, ttime);
}
`;

const fragment = `
// if sound doesn't start or seems desynchronised:
// try clicking pause/start button in the "soundcloud" square in the bottom right
// then press rewind just under the shader picture on the left

/*
----     Sync Cord     ----
---- by NuSan & Valden ----

4th place at Revision 2020 - PC 4k intro

NuSan: Concept, visual, code
Valden: Music

Original Tools: Leviathan 2.0, 4klang, Shader Minifier

https://www.pouet.net/prod.php?which=85222
https://www.youtube.com/watch?v=f3VSeLyooXA
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    	
	vec2 uv=fragCoord.xy/iResolution.xy;
	vec4 value = texture(iChannel0, uv);
	vec3 col = value.xyz;

   	float time=iTime+StartOffset;
    // bloom
    // take random samples in a disk
	vec3 a0=rnd23(gl_FragCoord.xy+fract(time));
    for(int i=0; i<25; ++i) {
		float an = (float(i/5)+a0.x)*1.25;
		float ad = float(i%5)+1.+a0.y;
		vec4 cur = texture(iChannel0, uv + vec2(cos(an),sin(an)) * ad*ad * 6./iResolution.xy);
        // we use a threshold to only bloom very bright parts
		col += cur.xyz * smoothstep(.8,1.,dot(cur.xyz,vec3(.33))) * .05;
    }

    // super basic tone mapping
    col=pow(smoothstep(0.,1.,col), vec3(0.4545));
    
    // fade in at the beginning
	col*=c01((time-2.8)*2.);
    // fade out at the end
    col*=c01((118.6-time)*.35);
	
	fragColor = vec4(col,1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'Ws2cDD';
  }
  name(): string {
    return '[4k] Sync Cord - Revision 2020';
  }
  sort() {
    return 674;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  common() {
    return common;
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
    return [{ type: 1, f: buffA, fi: 0 }];
  }
}
