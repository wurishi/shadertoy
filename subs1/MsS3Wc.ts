import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Official HSV to RGB conversion 
vec3 hsv2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

	return c.z * mix( vec3(1.0), rgb, c.y);
}

// Smooth HSV to RGB conversion 
vec3 hsv2rgb_smooth( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

	rgb = rgb*rgb*(3.0-2.0*rgb); // cubic smoothing	

	return c.z * mix( vec3(1.0), rgb, c.y);
}

// compare
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	
	vec3 hsl = vec3( uv.x, 1.0, uv.y );

	vec3 rgb_o = hsv2rgb( hsl );
	vec3 rgb_s = hsv2rgb_smooth( hsl );
	
	vec3 rgb = mix( rgb_o, rgb_s, smoothstep( -0.2, 0.2, sin(2.0*iTime)) );
	
	fragColor = vec4( rgb, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'MsS3Wc';
  }
  name(): string {
    return 'Smooth HSV';
  }
  sort() {
    return 102;
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
