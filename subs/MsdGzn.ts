import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // create pixel coordinates
	vec2 uv = fragCoord.xy / iResolution.xy;

	// first texture row is frequency data
	float fft  = texture( iChannel0, vec2(uv.x,0.25) ).x; 
	
    // second texture row is the sound wave
	float wave = texture( iChannel0, vec2(uv.x,0.75) ).x;
	
	// convert frequency to colors
	vec3 col = vec3( fft, 4.0*fft*(1.0-fft), 1.0-fft ) * fft;

    // add wave form on top	
	col += 1.0 -  smoothstep( 0.0, 0.15, abs(wave - uv.y) );
	
	// output final color
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MsdGzn';
  }
  name(): string {
    return 'Input - SoundCloud';
  }
  // sort() {
  //   return 0;
  // }
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
  channels() {
    return [webglUtils.DEFAULT_NOISE_BW];
  }
}
