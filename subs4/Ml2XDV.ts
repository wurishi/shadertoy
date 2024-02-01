import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Sinusoidal warp.
vec2 W(vec2 p){
    
    float t = iTime/4.;
    
    // Planar sine distortion.
    for (int i=0; i<3; i++)
        p += cos(p.yx*3. + vec2(t, 1.57))/3.,
        p += cos(p.yx + vec2(0, -1.57) + t)/2.,
        p *= 1.3;
    
    // Sparkle. Not really needed, but I like it.
    p += fract(sin(dot(p, vec2(41, 289)))*5e5)*.02 - .01;
    
    // Domain repetition.
    return mod(p, 2.)-1.;
}

void mainImage( out vec4 o, in vec2 u ){

    // Aspect correct screen coordinates.
	u /= iResolution.y;
    
    // Texture lookup.
    vec2 tu = W(u*5.);
    
    // Shading.
    float c = length(tu); // Range [0, sqrt(2)]
    c *= sqrt(c);
    
    // Aproximated, directional-derviative diffuse component.
    float d = max(c - length (W(u*5. + vec2(.025, .015))), 0.)*5. + .3;
    d *= d*d*.5; // Ramp it up a bit for extra shine.
    
    // Texture color.
    o = texture(iChannel0, u + tu/8.);
    o = smoothstep(.05, .5, o*o);
    
    // Combining texture color with diffuse plus ambient, and shading factor.
    o = sqrt(o*(vec4(1, .6, .2, 1)*d + .75)*c); // Rough gamma correction.
    
    // Textureless.
    //o = sqrt((vec4(.4, .18, .02, 1)*d + vec4(.1, .17, .25, 1))*c);
    o.a = 1.;
}

/*
// Smaller version, sans texture. 

vec2 W(vec2 u){
    
    float t = iTime/5.;
    
    for (int i=0; i<3; i++)
    	u += cos( u.yx*3. + vec2(t, 1.57)) / 3.,
        u += sin( u.yx + vec2(1.57, 0) + t) / 2.,
        u *= 1.3;
    
    return mod(u, 2.) - 1.;    
    
}

void mainImage( inout vec4 o,  vec2 u ) {
    
    u /= iResolution.y/5.;
    
    o.w = length(W(u));
    
    o = (vec4(.7, .4, .1, 1) * pow(max((o.w-length(W(u - .01))), 0.)*8. + 1., 4.)*.1 + .5)*o.w;
    
}

*/

`;

export default class implements iSub {
  key(): string {
    return 'Ml2XDV';
  }
  name(): string {
    return 'Lit Sine Warp';
  }
  sort() {
    return 458;
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
    return [webglUtils.TEXTURE9];
  }
}
