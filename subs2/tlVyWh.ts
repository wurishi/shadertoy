import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float cro( in vec2 a, in vec2 b ) { return a.x*b.y - a.y*b.x; }

// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
vec3 sdgTriangle( in vec2 p, in vec2 v[3] )
{
    float gs = cro(v[0]-v[2],v[1]-v[0]);
    vec4 res;
    
    // edge 0
    {
    vec2  e = v[1]-v[0];
    vec2  w = p-v[0];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4(d,q,s);
    }
    
    // edge 1
    {
	vec2  e = v[2]-v[1];
    vec2  w = p-v[1];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4( (d<res.x) ? vec3(d,q) : res.xyz,
                (s>res.w) ?      s    : res.w );
    }
    
    // edge 2
    {
	vec2  e = v[0]-v[2];
    vec2  w = p-v[2];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4( (d<res.x) ? vec3(d,q) : res.xyz,
                (s>res.w) ?      s    : res.w );
    }
    
    // distance and sign
    float d = sqrt(res.x)*sign(res.w);
    
    return vec3(d,res.yz/d);

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

        // animate
        float time = iTime;
        vec2 v[3] = vec2[3](
            vec2(-0.8,-0.3) + 0.5*cos( 0.5*time + vec2(0.0,1.9) + 4.0 ),
            vec2( 0.8,-0.3) + 0.5*cos( 0.7*time + vec2(0.0,1.7) + 2.0 ),
            vec2( 0.0, 0.3) + 0.5*cos( 0.9*time + vec2(0.0,1.3) + 1.0 ) );

        // corner radious
        float ra = 0.1*(0.5+0.5*sin(iTime*1.2));

        // sdf(p) and gradient(sdf(p))
        vec3  dg = sdgTriangle(p,v);
        float d = dg.x-ra;
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
    return 'tlVyWh';
  }
  name(): string {
    return 'Triangle - gradient 2D';
  }
  sort() {
    return 216;
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
