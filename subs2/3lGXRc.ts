import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgVesica(vec2 p, float r, float d)
{
    vec2 s = sign(p); p = abs(p);

    float b = sqrt(r*r-d*d);  // can delay this sqrt by rewriting the comparison
    
    vec3 res;
    if( (p.y-b)*d > p.x*b )
    {
        vec2  q = vec2(p.x,p.y-b);
        float l = length(q)*sign(d);
        res = vec3( l, q/l );
    }
    else
    {
        vec2  q = vec2(p.x+d,p.y);
        float l = length(q);
        res = vec3( l-r, q/l );
    }
    return vec3(res.x, res.yz*s );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // animate
    float time = iTime;
    float r1 = 0.5*cos(time+12.0);
    float r2 = 0.2*sin(time*1.4);

    // sdf(p) and gradient(sdf(p))
    vec3  dg = sdgVesica( p, 0.7, r1 );
    float d = dg.x + r2;
    vec2  g = dg.yz;
    
    // central differenes based gradient, for comparison
    // g = vec2(dFdx(d),dFdy(d))/(2.0/iResolution.y);

	// coloring
    vec3 col = (d>0.0) ? vec3(0.9,0.6,0.3) : vec3(0.4,0.7,0.85);
    col *= 1.0 + vec3(0.5*g,0.0);
  //col = vec3(0.5+0.5*g,1.0);
    col *= 1.0 - 0.7*exp(-8.0*abs(d));
	col *= 0.9 + 0.1*cos(150.0*d);
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.01,abs(d)) );
    
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '3lGXRc';
  }
  name(): string {
    return 'Vesica - gradient 2D';
  }
  sort() {
    return 221;
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
