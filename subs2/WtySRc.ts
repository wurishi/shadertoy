import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgHexagon( in vec2 p, in float r ) 
{
    const vec3 k = vec3(-0.866025404,0.5,0.577350269);
    vec2 s = sign(p);
    p = abs(p);
	float w = dot(k.xy,p);    
    p -= 2.0*min(w,0.0)*k.xy;
    p -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
    float d = length(p)*sign(p.y);
    vec2  g = (w<0.0) ? mat2(-k.y,-k.x,-k.x,k.y)*p : p;
    return vec3( d, s*g/d );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // size
	float si = 0.3 + 0.2*cos( iTime );
    // corner radious
    float ra = 0.3*(0.5+0.5*sin(iTime*2.0));

    // sdf(p) and gradient(sdf(p))
	vec3 dg = sdgHexagon(p,si);
    float d = dg.x-ra;
    vec2 g = dg.yz;
    
    // central differenes based gradient, for comparison
    //g = vec2(dFdx(d),dFdy(d))/(2.0/iResolution.y);
    
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
    return 'WtySRc';
  }
  name(): string {
    return 'Hexagon - gradient 2D';
  }
  sort() {
    return 220;
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
