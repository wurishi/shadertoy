import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
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


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // corner radious
    float ra = 0.1*(0.5+0.5*sin(iTime*1.2));

    // sdf(p) and gradient(sdf(p))
    vec3  dg = sdgBox(p,vec2(0.8,0.3));
    float d = dg.x-ra;
    vec2 g = dg.yz;
    
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
    return 'wlcXD2';
  }
  name(): string {
    return 'Box - gradient 2D';
  }
  sort() {
    return 130;
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
