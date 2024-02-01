import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgParallelogram( in vec2 p, float wi, float he, float sk )
{
    vec2  e = vec2(sk,he);
    float v = 1.0;
    if( p.y<0.0 ) { p=-p;v=-v;}

    // horizontal edge
    vec2 w = p - e; w.x -= clamp(w.x,-wi,wi);
    vec4 dsg = vec4(dot(w,w),v*w,w.y);    

    // vertical edge
    float s = p.x*e.y - p.y*e.x;
    if( s<0.0 ) { p=-p; v=-v; }
    vec2  q = p - vec2(wi,0); q -= e*clamp(dot(q,e)/dot(e,e),-1.0,1.0);
    float d = dot(q,q);
    s = abs(s) - wi*he;
    dsg = vec4( (d<dsg.x) ? vec3(d,v*q) : dsg.xyz,
                (s>dsg.w) ?      s      : dsg.w );
     
    // signed distance
    d = sqrt(dsg.x)*sign(dsg.w);
    // and gradient
    return vec3(d,dsg.yz/d); 
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
        vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;
        #else    
        vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
        #endif

        // animate
        float time = iTime;

        // sdf(p) and gradient(sdf(p))
        float s = sin(iTime);
        vec3  dg = sdgParallelogram(p,0.4, 0.6,s);
        float d = dg.x;
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
    return 'sssGzX';
  }
  name(): string {
    return 'Parallelogram - gradient 2D';
  }
  sort() {
    return 223;
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
