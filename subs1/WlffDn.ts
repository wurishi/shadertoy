import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Function fcos() is a band-limited cos(x).
//
// Box-filtering of cos(x):
//
// (1/w)∫cos(t)dt with t ∈ (x-½w, x+½w)
// = [sin(x+½w) - sin(x-½w)]/w
// = cos(x)·sin(½w)/(½w)
//
// Can approximate smoothstep(2π,0,w) ≈ sin(w/2)/(w/2),

vec3 fcos( vec3 x )
{
    vec3 w = fwidth(x);
    return cos(x) * smoothstep(3.14*2.0,0.0,w); // filtered-approx
 }

vec3 getColor( in float t )
{
    vec3 col = vec3(0.3,0.4,0.5);
    col += 0.12*fcos(6.28318*t*  1.0+vec3(0.0,0.8,1.1));
    col += 0.11*fcos(6.28318*t*  3.1+vec3(0.3,0.4,0.1));
    col += 0.10*fcos(6.28318*t*  5.1+vec3(0.1,0.7,1.1));
    col += 0.10*fcos(6.28318*t* 17.1+vec3(0.2,0.6,0.7));
    col += 0.10*fcos(6.28318*t* 31.1+vec3(0.1,0.6,0.7));
    col += 0.10*fcos(6.28318*t* 65.1+vec3(0.0,0.5,0.8));
    col += 0.10*fcos(6.28318*t*115.1+vec3(0.1,0.4,0.7));
    col += 0.10*fcos(6.28318*t*265.1+vec3(1.1,1.4,2.7));
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord )
{
    // coordiantes
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec2 w = p;
        
    // deform 1
    p *= 0.25;
    p = 0.5*p/dot(p,p);
    vec2 q = p;
    p.x += iTime*0.2;
    
    
    // base color pattern
    vec3 col = getColor( 0.4*length(p) );
    
    // lighting
    col *= 1.4 - 0.07*length(q);
 
   fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'WlffDn';
  }
  name(): string {
    return 'Tubularity';
  }
  sort() {
    return 106;
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
}
