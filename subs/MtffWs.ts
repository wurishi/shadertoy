import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// blue   : sqr = square
// red    : tri = integral(sqr)
// yellow : pri = integral(tri) = integral(integral(sqr))
vec3 funcs( in float x )
{
    x *= 0.5;
    
    float h = fract(x)-0.5;
    
    float s = -sign(h);
    float t = 1.0 - 2.0*abs(h);          // also 1.0 + 2.0*h*s
    float p = x + h*t;
    
    return vec3( s, t, p );
}


float sdSegment( vec2 p )
{
    p = abs(p);
    return length( vec2(p.x, min(1.0-p.y,0.0)) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    const float sca = 4.0;
    
    vec2  p = sca*(2.0*fragCoord-iResolution.xy) / iResolution.y;
    float px = sca*2.0/iResolution.y;
    
    vec3 f = funcs( p.x );
    
    // background
    vec3 col = vec3(0.3 + 0.04*mod(floor(p.x)+floor(p.y),2.0));
    col *= smoothstep( 0.5*px, 1.5*px, abs(p.x) );
    col *= smoothstep( 0.5*px, 1.5*px, abs(p.y) );
    
    // graphs
    col = mix( col, vec3(1.0,0.7,0.0), 1.0 - smoothstep( 0.5*px, 1.5*px, min(abs(p.y-f.x), length(vec2(fract(p.x+0.5)-0.5,min(1.0-abs(p.y),0.0)))) ) );
    col = mix( col, vec3(1.0,0.2,0.0), 1.0 - smoothstep( 1.0*px, 2.5*px, abs(p.y-f.y) ) );
    col = mix( col, vec3(0.0,0.7,1.0), 1.0 - smoothstep( 0.5*px, 2.0*px, abs(p.y-f.z) ) );
    
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'MtffWs';
  }
  name(): string {
    return 'Integrating a square wave';
  }
  sort() {
    return 74;
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
