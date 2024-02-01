
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p)
vec3 sdgSMin( in vec3 a, in vec3 b, in float k )
{
    float h = max(k-abs(a.x-b.x),0.0);
    float m = 0.25*h*h/k;
    float n = 0.50*  h/k;
    return vec3( min(a.x,  b.x) - m, 
                 mix(a.yz, b.yz, (a.x<b.x)?n:1.0-n) );
}

// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgMin( in vec3 a, in vec3 b )
{
    return (a.x<b.x) ? a : b;
}

vec3 sdgBox( in vec2 p, in vec2 b )
{
    vec2 w = abs(p)-b;
    vec2 s = vec2(p.x<0.0?-1:1,p.y<0.0?-1:1);
    
    float g = max(w.x,w.y);
	vec2  q = max(w,0.0);
    float l = length(q);
    
    return vec3(   (g>0.0)?l   : g,
                s*((g>0.0)?q/l : ((w.x>w.y)?vec2(1,0):vec2(0,1))));
}

vec3 sdgSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    vec2  q = pa-h*ba;
    float d = length(q);
    return vec3(d,q/d);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // sdf(p) and gradient(sdf(p))
    vec3 dg1 = sdgBox(p,vec2(0.8,0.3));
    vec3 dg2 = sdgSegment( p, vec2(-1.0,-0.5), vec2(0.7,0.7) ) - vec3(0.15,0.0,0.0);

  //vec3 dg = sdgMin(dg1,dg2);
    vec3 dg = sdgSMin(dg1,dg2,0.2);
    float d = dg.x;
    vec2  g = dg.yz;
    
    // central differenes based gradient, for comparison
    // g = vec2(dFdx(d),dFdy(d))/(2.0/iResolution.y);

	// coloring
    vec3 col = (d>0.0) ? vec3(0.9,0.6,0.3) : vec3(0.4,0.7,0.85);
    col *= 1.0 + vec3(0.5*g,0.0);
  //col = vec3(0.5+0.5*g,1.0);
    col *= 1.0 - 0.5*exp(-16.0*abs(d));
	col *= 0.9 + 0.1*cos(150.0*d);
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.01,abs(d)) );
    
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'tdGBDt';
  }
  name(): string {
    return 'Smooth Minimum - gradient 2D';
  }
  sort() {
    return 222;
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
