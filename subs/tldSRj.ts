import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec2 g( vec2 n ) { return sin(n.x*n.y*vec2(12,17)+vec2(1,2)); }
//vec2 g( vec2 n ) { return sin(n.x*n.y+vec2(0,1.571)); } // if you want the gradients to lay on a circle

float noise(vec2 p)
{
    const float kF = 3.1415927;  // make 6 to see worms
    
    vec2 i = floor(p);
	vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(sin(kF*dot(p,g(i+vec2(0,0)))),
               	   sin(kF*dot(p,g(i+vec2(1,0)))),f.x),
               mix(sin(kF*dot(p,g(i+vec2(0,1)))),
               	   sin(kF*dot(p,g(i+vec2(1,1)))),f.x),f.y);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord.xy / iResolution.xy;

	vec2 uv = p*vec2(iResolution.x/iResolution.y,1.0);

    float f = 0.0;
	
    // left: noise	
	if( p.x<0.6 )
	{
		f = noise( 24.0*uv );
	}
    // right: fractal noise (4 octaves)
    else	
	{
		uv *= 8.0;
        mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
		f  = 0.5000*noise( uv ); uv = m*uv;
		f += 0.2500*noise( uv ); uv = m*uv;
		f += 0.1250*noise( uv ); uv = m*uv;
		f += 0.0625*noise( uv ); uv = m*uv;
	}

	f = 0.5 + 0.5*f;
	
    f *= smoothstep( 0.0, 0.005, abs(p.x-0.6) );	
	
	fragColor = vec4( f, f, f, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'tldSRj';
  }
  name(): string {
    return 'Noise - wave - 2D';
  }
  sort() {
    return 91;
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
