import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float sdEllipse( vec2 p, vec2 ab )
{
    // symmetry
	p = abs( p );
    
    // determine in/out and initial value
    bool s = dot(p/ab,p/ab)>1.0;
	float w = s ? 
              atan(p.y*ab.x, p.x*ab.y) : 
              ((ab.x*(p.x-ab.x)<ab.y*(p.y-ab.y))? 1.570796327 : 0.0);
    
    // find root with Newton solver
    for( int i=0; i<4; i++ )
    {
        vec2 cs = vec2(cos(w),sin(w));
        vec2 u = ab*vec2( cs.x,cs.y);
        vec2 v = ab*vec2(-cs.y,cs.x);
        w = w + dot(p-u,v)/(dot(p-u,u)+dot(v,v));
    }
    
    // compute final point and distance
    return length(p-ab*vec2(cos(w),sin(w))) * (s?1.0:-1.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = (2.0*fragCoord-iResolution.xy)/iResolution.y;
	
    vec2 m = iMouse.xy/iResolution.xy;
	m.x *= iResolution.x/iResolution.y;
	
	float d = sdEllipse( uv, vec2(0.6,1.0)*m + vec2(0.4,0.2) );
    vec3 col = vec3(1.0) - sign(d)*vec3(0.1,0.4,0.7);
	col *= 1.0 - exp(-2.0*abs(d));
	col *= 0.8 + 0.2*cos(120.0*d);
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.02,abs(d)) );

	fragColor = vec4( col, 1.0 );;
}
`;

export default class implements iSub {
  key(): string {
    return '4lsXDN';
  }
  name(): string {
    return 'Ellipse - distance 2D II';
  }
  sort() {
    return 369;
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
