import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PROCEDURAL 1

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord/iResolution.xy;

#if PROCEDURAL==0
    vec2 warp = texture( iChannel0, uv*0.1 + iTime*vec2(0.04,0.03) ).xz;
#else    
    float freq = 3.0*sin(0.5*iTime);
    vec2 warp = 0.5000*cos( uv.xy*1.0*freq + vec2(0.0,1.0) + iTime ) +
                0.2500*cos( uv.yx*2.3*freq + vec2(1.0,2.0) + iTime) +
                0.1250*cos( uv.xy*4.1*freq + vec2(5.0,3.0) + iTime ) +
                0.0625*cos( uv.yx*7.9*freq + vec2(3.0,4.0) + iTime );
#endif
    
	vec2 st = uv + warp*0.5;

	fragColor = vec4( texture( iChannel0, st ).xyz, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'Xsl3zn';
  }
  name(): string {
    return 'Warping - texture';
  }
  sort() {
    return 257;
  }
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
  channels() {
    return [webglUtils.ROCK_TEXTURE];
  }
}
