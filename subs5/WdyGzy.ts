import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// FLUID EVOLUTION
#define R iResolution.xy
#define T(U) texture(iChannel0,(U)/R)
#define D(U) texture(iChannel1,(U)/R)
#define B(U) texture(iChannel2,(U)/R)
// Velocity
vec2 v (vec4 b) {
	return vec2(b.x-b.y,b.z-b.w);
}
// Pressure
float p (vec4 b) {
	return 0.25*(b.x+b.y+b.z+b.w);
}
// TRANSLATE COORD BY Velocity THEN LOOKUP STATE
vec4 A(vec2 U) {
    U-=.5*v(T(U));
    U-=.5*v(T(U));
	return T(U);
}
void mainImage( out vec4 Q, in vec2  U)
{
    // THIS PIXEL
    Q = A(U);
    // NEIGHBORHOOD
    vec4 
        n = A(U+vec2(0,1)),
        e = A(U+vec2(1,0)),
        s = A(U-vec2(0,1)),
        w = A(U-vec2(1,0));
    // GRADIENT of PRESSURE
    float px = 0.25*(p(e)-p(w));
    float py = 0.25*(p(n)-p(s)); 
    
    		// boundary Energy exchange in :   
    Q += 0.25*(n.w + e.y + s.z + w.x)
        	// boundary Energy exchange out :
        	-p(Q)
        	// dV/dt = dP/dx,  dEnergy In dTime = dEnergy in dSpace
        	-vec4(px,-px,py,-py);
    
    // get value from picture buffer
    float z = .8-length(B(U).xyz);
    // some kind of viscolsity thing 
    Q = mix(mix(Q,0.25*(n+e+s+w),.01),vec4(p(Q)),.01*(1.-z));
    // gravity polarizes energy! pretty cool imo
    Q.zw -= 0.001*z*vec2(1,-1);
    // Init with no velocity and some pressure
    if (iFrame < 1||(iMouse.z>0.&&length(U-iMouse.xy)<R.y/5.)) Q = vec4(.2);
    // At boundarys turn all kinetic energy into potential energy
    if(U.x<3.||R.x-U.x<3.||U.y<3.||R.y-U.y<3.)Q = vec4(p(Q));
}
`;

const buffD = `
// TRANSLATE LOCATION FIELD WITH v(A(coord)), INIT WITH FragCoord
#define R iResolution.xy
#define A(U) texture(iChannel0,(U)/R)
#define d(U) texture(iChannel1,(U)/R)
#define C(U) texture(iChannel2,(U)/R)
vec2 v (vec4 b) {
	return vec2(b.x-b.y,b.z-b.w);
}
vec4 D(vec2 U) {
    U-=.5*v(A(U));
    U-=.5*v(A(U));
	return d(U);
}
void mainImage( out vec4 Q, in vec2  U)
{
    Q = D(U);
    
    vec4 
        q = A(U),
        n = A(U+vec2(0,1)),
        e = A(U+vec2(1,0)),
        s = A(U-vec2(0,1)),
        w = A(U-vec2(1,0)),
        N = D(U+vec2(0,1)),
        E = D(U+vec2(1,0)),
        S = D(U-vec2(0,1)),
        W = D(U-vec2(1,0));
    Q += 0.25*((n.w-q.z)*(N-Q) + (e.y-q.x)*(E-Q) + (s.z-q.w)*(S-Q) + (w.x-q.y)*(W-Q));
    
    if (iFrame < 1||(iMouse.z>0.&&length(U-iMouse.xy)<R.y/5.)) Q = vec4(U,0,0);
}
`;

const buffC = `
// LOOK UP PICTURE IN LOCATION FROM BUFFER D
#define R iResolution.xy
#define T(U) texture(iChannel0,(U)/R)
#define D(U) texture(iChannel1,(U)/R)
void mainImage( out vec4 Q, vec2 U )
{
    Q = texture(iChannel2,D(U).xy/R);
}
`;

const buffB = `
// Lighting on Buffer B
#define R iResolution.xy
#define T(U) texture(iChannel0,(U)/R)

void mainImage( out vec4 Q, vec2 U )
{
   Q =  1.2-2.2*T(U);
    Q.xyz = Q.xyz+.5*normalize(Q.xyz);
   float
       n = length(T(U+vec2(0,1))),
       e = length(T(U+vec2(1,0))),
       s = length(T(U-vec2(0,1))),
       w = length(T(U-vec2(1,0)));
    vec3 no = normalize(vec3(e-w,n-s,1));
    float d = dot(reflect(no,vec3(0,0,1)),normalize(vec3(1)));
    Q *= 8.*exp(-3.*d*d);
}
`;

const fragment = `
// LENS FLAIR EFFECT
#define R iResolution.xy
#define T(U) texture(iChannel0,(U)/R)
vec4 F (vec2 U,vec2 r) {
	vec4 t = T(U+r);
    return exp(-.01*dot(r,r))*(exp(2.*t)-1.);
}
void mainImage( out vec4 Q, vec2 U )
{
   
   Q = vec4(0);
    for (float i = 0.; i < 7.; i+=1.1) {
    	Q += F(U,+vec2(-i,i));
    	Q += F(U,+vec2(i,i));
    	Q += F(U,-vec2(-i,i));
    	Q += F(U,-vec2(i,i));
    }
    Q = T(U)*0.15+ 1e-5*Q;
    Q = atan(Q);
}
`;

export default class implements iSub {
  key(): string {
    return 'WdyGzy';
  }
  name(): string {
    return 'Lattice Boltzmann';
  }
  // sort() {
  //   return 0;
  // }
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
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffD, fi: 1 }, //
      webglUtils.ROCK2_TEXTURE,
      { type: 1, f: buffB, fi: 3 },
    ];
  }
}
