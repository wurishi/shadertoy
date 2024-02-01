import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 O, vec2 U )
{
    float L = iResolution.x/2.,
          z = exp2(1.5*(cos(iTime)-1.)),                                // stretching
          x = mod(U.x,L) * z;                                           // stretched z
    O-=O;
    if ( fract(x) < z )                                                 // first pixel in a stretched texel
        O = vec4( ( U.x < L 
                      ? texelFetch(iChannel0, ivec2(x,U.y)% 256, 0 ).r  // left: white noise
                      : texelFetch(iChannel1, ivec2(x,U.y)%1024, 0 ).r  // right: blue noise
                  ) > .98 );
                  
    if( int(U.x) == int(L) ) O.r++;                                     // separator
}
`;

export default class implements iSub {
  key(): string {
    return 'fdsGz8';
  }
  name(): string {
    return 'stretching white vs blue noise';
  }
  sort() {
    return 51;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    const canvas = createCanvas();
    canvas.style.backgroundColor = 'black';
    return canvas;
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
    return [
      webglUtils.DEFAULT_NOISE_BW,
      { type: 0, path: './textures/fdsGz8_2.png' },
    ];
  }
}
