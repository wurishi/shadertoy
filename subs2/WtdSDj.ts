import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    vec2  q = pa-h*ba;
    float d = length(q);
    
    return vec3(d,q/d);
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

        vec2 v1 = 0.8*cos( 0.5*iTime*vec2(1.3,1.0) + vec2(2,4) );
        vec2 v2 = 0.8*cos( 0.5*iTime*vec2(0.9,1.2) + vec2(1,5) );
        float th = 0.15*(0.5+0.5*sin(iTime*1.2+2.0));

        // sdf(p) and gradient(sdf(p))
        vec3  dg = sdgSegment(p,v1,v2);
        float d = dg.x - th;
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
    return 'WtdSDj';
  }
  name(): string {
    return 'Segment - gradient 2D';
  }
  sort() {
    return 219;
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
