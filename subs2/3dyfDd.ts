import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec3 sdgTriangleIsosceles( in vec2 p, in vec2 q )
{
    float w = sign(p.x);
    p.x = abs(p.x);
	  vec2 a = p - q*clamp( dot(p,q)/dot(q,q), 0.0, 1.0 );
    vec2 b = p - q*vec2( clamp( p.x/q.x, 0.0, 1.0 ), 1.0 );
    float k = sign( q.y );
    float l1 = dot(a,a);
    float l2 = dot(b,b);
    float d = sqrt((l1<l2)?l1:l2);
    vec2  g =      (l1<l2)? a: b;
    float s = max( k*(p.x*q.y-p.y*q.x),k*(p.y-q.y)  );
    return vec3(d,vec2(w*g.x,g.y)/d)*sign(s);
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
        
        p.y -= 0.3;
        // size
        vec2 si = vec2(0.5,-0.5) + vec2(0.3,-0.3)*cos( iTime + vec2(0.0,1.57) + 0.0 );

        // sdf(p) and gradient(sdf(p))
        vec3 dg = sdgTriangleIsosceles(p,si);
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
    return '3dyfDd';
  }
  name(): string {
    return 'Isosceles Triangle - gradient 2D';
  }
  sort() {
    return 215;
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
