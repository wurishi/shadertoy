import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
// c is the sin/cos of the angle. r is the radius
vec3 sdgPie( in vec2 p, in vec2 c, in float r )
{
    float s = sign(p.x); p.x = abs(p.x);
    
    float l = length(p);
    float n = l - r;
    vec2  q = p - c*clamp(dot(p,c),0.0,r);
	float m = length(q)* sign(c.y*p.x-c.x*p.y);
    
    vec3  res = (n>m) ? vec3(n,p/l) : vec3(m,q/m);
    return vec3(res.x,s*res.y,res.z);
}

#define AA 2

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 tot = vec3(0.0);
    
    #if AA>1
    for( int m=0; m<AA; m++ )
    for( int n=0; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
        #else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
        #endif

        // animation
        float t =            3.14*(0.5+0.5*cos(iTime*0.52));
        vec2  w = vec2(0.50,0.25)*(0.5+0.5*cos(iTime*vec2(1.1,1.3)+vec2(0.0,2.0)));

        // sdf(p) and gradient(sdf(p))
        vec3  dg = sdgPie(p,vec2(sin(t),cos(t)), 0.65);
        float d = dg.x;
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
   
	    tot += col;
    #if AA>1
    }
    tot /= float(AA*AA);
    #endif

	fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '3tGXRc';
  }
  name(): string {
    return 'Pie - gradient 2D';
  }
  sort() {
    return 213;
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
