import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define ITERS 9 //normal world map
#define ITERS 12 //swamp world

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Scale and move to make things a litle more interesting t look at.
    float scale = 10000.0;
    float trans = iTime * scale/8.0;
    vec2 coord = (scale * fragCoord/iResolution.xy) + vec2(trans+30000.0,0.0);
    
    // Heart of color selection.
    int val = 0;
    float result = 0.0;
    vec3 col = vec3(0.0);
    vec3 col_prev = vec3(0.0);
    for(int i = 0; i < ITERS; i++){
        col_prev = col;
        coord.y -= (4.0-result);
        coord += coord.yy/8.0;
        coord = coord.yx/(3.0);
        coord.x *= -1.5;
        result = ((result + float(val = ((int(coord.x*2.0-coord.y/2.0) & int(coord.y*2.0+coord.x/2.0)) % 3)))/(2.0));
        col.x = result;
        col = ((col.yzx)*3.0+col_prev)/4.0;
    }
    // Output.
    fragColor = vec4((col),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'NdsXRB';
  }
  name(): string {
    return 'Watercolor painting';
  }
  sort() {
    return 401;
  }
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
}
