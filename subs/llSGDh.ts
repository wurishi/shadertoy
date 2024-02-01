import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // create pixel coordinates
	vec2 uv = fragCoord.xy / iResolution.xy;

	// first texture row is frequency data
	float fft  = textureLod( iChannel0, vec2(uv.x,0.25), 0.0 ).x; 
	    
    // second texture row is the sound wave
	float wave = textureLod( iChannel0, vec2(uv.x,0.75), 0.0 ).x;
	
	// convert frequency to colors
	vec3 col = vec3(1.0)*fft;

    // add wave form on top	
	col += 1.0 -  smoothstep( 0.0, 0.01, abs(wave - uv.y) );

    col = pow( col, vec3(1.0,0.5,2.0) );

	// output final color
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'llSGDh';
  }
  name(): string {
    return 'Input - Microphone';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
