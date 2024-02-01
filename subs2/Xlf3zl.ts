
import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec2 map(float t)
{
    return 0.85*cos( t + vec2(0.0,1.0) )*(0.6+0.4*cos(t*7.0+vec2(0.0,1.0)));
}

float dot2( in vec2 v ) { return dot(v,v); }
float sdSqSegment( in vec2 p, in vec2 a, in vec2 b )
{
	vec2 pa = p - a, ba = b - a;
	return dot2( pa - ba*clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 ) );
}

float graph( vec2 p, bool doOptimized )
{
    float h = doOptimized ? 0.05 : 6.2831/70.0;
	float t = 0.0;
    
    vec2  a = map(t);
    float d = dot2( p - a );
    
    t += h;
    for( int i=0; i<70; i++ )
    {
        vec2  b = map(t);
        d = min( d, sdSqSegment( p, a, b ) );
        
		t += (doOptimized) ? clamp( 0.026*length(a-p)/length(a-b), 0.02, 0.1 ) : h;
        a = b;
	}
    
	return sqrt(d);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (-iResolution.xy+2.0*fragCoord.xy)/iResolution.y;
    
    bool doOptimized = sin(2.0*iTime) > 0.0;

    float d = graph( p, doOptimized );
        
    vec3 col = vec3(0.9);
    col *= 1.0 - 0.03*smoothstep(-0.3,0.3,sin( 120.0*d ));
    col *= smoothstep(0.0, 0.01, d );
    col *= 1.0 - 0.1*dot(p,p);

	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'Xlf3zl';
  }
  name(): string {
    return 'Parametric graph by curvature';
  }
  sort() {
    return 251;
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
