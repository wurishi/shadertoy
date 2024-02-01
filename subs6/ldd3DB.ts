import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define NB      40.
#define MAX_ACC  3.
#define MAX_VEL .5
#define RESIST  .2

`;

const buffA = `
// Created by sebastien durand - 2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------
vec2 hash(float n) { return fract(sin(vec2(n,n*7.))*43758.5); }
vec4 Fish(float i) { return texelFetch(iChannel0, ivec2(i,0),0);}

void mainImage(out vec4 fc, vec2 uv) {   
    if(uv.y > .5 || uv.x > NB) discard;
    
    vec2  w, vel, acc, sumF, R = iResolution.xy, res = R/R.y;
    float d, a, v, dt = .03, id = floor(uv.x);  
    
// = Initialization ===================================
    if (iFrame < 5) fc = vec4(.1+.8*hash(id)*res,0,0);
            
// = Animation step ===================================
    else { 
        vec4 fish = Fish(id);
        
// - Sum Forces -----------------------------  
	// Borders action
        sumF = .8*(1./abs(fish.xy) - 1./abs(res-fish.xy));         
        
    // Mouse action        
        w = fish.xy - iMouse.xy/iResolution.y;                  // Repulsive force from mouse position
        sumF += normalize(w)*.65/dot(w,w);

    // Calculate repulsion force with other fishs
        for(float i=0.;i<NB;i++)
            if (i != id) {                                            // only other fishs
                d = length(w = fish.xy - Fish(i).xy);
    			sumF -= d > 0. ? w*(6.3+log(d*d*.02))/exp(d*d*2.4)/d  // attractive/repulsive force from otehrs
                    : .01*hash(id);                                   // if same pos : small ramdom force
            }
    // Friction    
        sumF -= fish.zw*RESIST/dt;
        
// - Dynamic calculation ---------------------     
    // Calculate acceleration A = (1/m * sumF) [cool m=1. here!]
        a = length(acc = sumF); 
        acc *= a>MAX_ACC ? MAX_ACC/a : 1.; // limit acceleration
    // Calculate speed
        v = length(vel = fish.zw + acc*dt);
        vel *= v>MAX_VEL ? MAX_VEL/v : 1.; // limit velocity
// - Save position and velocity of fish (xy = position, zw = velocity) 
        fc = vec4(fish.xy + vel*dt, vel);  
    }
}

`;

const fragment = `
// Created by sebastien durand - 2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//-----------------------------------------------------

// Distance to a fish
float sdFish(float i, vec2 p, float a) {
    float ds, c = cos(a), s = sin(a);
    p *= 20.*mat2(c,s,-s,c); // Rotate and rescale
    p.x *= .97 + (.04+.2*p.y)*cos(i+9.*iTime);  // Swiming ondulation (+rotate in Z axes)
    ds = min(length(p-vec2(.8,0))-.45, length(p-vec2(-.14,0))-.12);   // Distance to fish
    p.y = abs(p.y)+.13;
    return max(min(length(p),length(p-vec2(.56,0)))-.3,-ds)*.05;
}


void mainImage(out vec4 cout, vec2 uv) {
    vec2 p = 1./iResolution.xy;
    float d, m = 1e6;
    vec4 c, ct, fish;

    for(float i=0.; i<NB; i++) {     
        fish = texelFetch(iChannel0,ivec2(i,0),0); // (xy = position, zw = velocity) 
        m = min(m, d = sdFish(i, fish.xy-uv.xy*p.y, atan(fish.w,fish.z))); // Draw fish according to its direction
        // Background color sum based on fish velocity (blue => red) + Halo - simple version: c*smoothstep(.5,0.,d);
        ct += mix(vec4(0,0,1,1), vec4(1,0,0,1), length(fish.zw)/MAX_VEL)*(2./(1.+3e3*d*d*d) + .5/(1.+30.*d*d)); 
    }
    // Mix fish color (white) and Halo
    cout = mix(vec4(1.),.5*sqrt(ct/NB), smoothstep(0.,p.y*1.2, m));
}
`;

export default class implements iSub {
  key(): string {
    return 'ldd3DB';
  }
  name(): string {
    return 'Interactive Shoal of fish';
  }
  // sort() {
  //   return 0;
  // }
  webgl() {
    return WEBGL_2;
  }
  common() {
    return common;
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
  // channels() {
  //   return [{ type: 1, f: buffA, fi: 0 }];
  // }
}
