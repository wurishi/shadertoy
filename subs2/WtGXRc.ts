import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// .x = f(p)
// .y = ∂f(p)/∂x
// .z = ∂f(p)/∂y
// .yz = ∇f(p) with ‖∇f(p)‖ = 1
// sca is the sin/cos of the orientation
// scb is the sin/cos of the aperture
vec3 sdgArc( in vec2 p, in vec2 sca, in vec2 scb, in float ra, in float rb )
{
    vec2 q = p;

    mat2 ma = mat2(sca.x,-sca.y,sca.y,sca.x);
    p = ma*p;

    float s = sign(p.x); p.x = abs(p.x);
    
    if( scb.y*p.x > scb.x*p.y )
    {
        vec2  w = p - ra*scb;
        float d = length(w);
        return vec3( d-rb, vec2(s*w.x,w.y)*ma/d );
    }
    else
    {
        float l = length(q);
        float w = l - ra;
        return vec3( abs(w)-rb, sign(w)*q/l );
    }
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
        float ta = 3.14*(0.5+0.5*cos(iTime*0.52+2.0));
        float tb = 3.14*(0.5+0.5*cos(iTime*0.31+2.0));
        float rb = 0.15*(0.5+0.5*cos(iTime*0.41+1.0));

        // sdf(p) and gradient(sdf(p))
        vec3  dg = sdgArc(p,vec2(sin(ta),cos(ta)),vec2(sin(tb),cos(tb)), 0.5, rb);
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
    return 'WtGXRc';
  }
  name(): string {
    return 'Arc - gradient 2D';
  }
  sort() {
    return 214;
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
