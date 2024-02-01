import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgCross( in vec2 p, in vec2 b ) 
{
    vec2 s = sign(p);
    
    p = abs(p); 

	vec2  q = ((p.y>p.x)?p.yx:p.xy) - b;
    float h = max( q.x, q.y );
    vec2  o = max( (h<0.0)?vec2(b.y-b.x,0.0)-q:q, 0.0 );
    float l = length(o);

    vec3  r = (h<0.0 && -q.x<l)?vec3(-q.x,1.0,0.0):vec3(l,o/l);
   
    return vec3( sign(h)*r.x, s*((p.y>p.x)?r.zy:r.yz) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // size
	vec2 si = 0.5 + 0.3*cos( iTime + vec2(0.0,1.57) + 0.0 );     if( si.x<si.y ) si=si.yx;
    // corner radious
    float ra = 0.0;//0.1*(0.5+0.5*sin(iTime*1.2));

    // sdf(p) and gradient(sdf(p))
	vec3 dg = sdgCross(p,si);
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
    return 'WtdXWj';
  }
  name(): string {
    return 'Cross - gradient 2D';
  }
  sort() {
    return 218;
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
