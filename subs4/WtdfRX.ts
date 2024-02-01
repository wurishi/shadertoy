import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uvec4 hash(uvec4 seed) {
    uvec4 h = (0x6A7F8FAAu^seed)*0x01000193u;
    h = ((h.wxyz>>3u)^h^seed.yzwx)*0x01000193u;
    h = ((h.zwxy>>8u)^h^seed.wxyz)*0x01000193u;
    return h^(h>>11u);
}
#define I2F (1./float(0xFFFFFFFFu))


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    uint hv = hash(uvec4(fragCoord,0,iTime*2.)).x;

    //Hash bit plane test credit to hornet/pixelmager
    int idx = int(floor(8.*uv.x)+8.*floor(4.0*uv.y));
    uint bit = uint(idx);
    uint bitmask = 1u<<bit;
    float bitplane = float( (hv>>bit)&1u );
    vec4 c = vec4(bitplane);
    float ll = step( 10.0/iResolution.x, 1.0-abs(2.0*fract(8.0*uv.x)-1.0))
    		 * step( 10.0/iResolution.y, 1.0-abs(2.0*fract(4.0*uv.y)-1.0));
    fragColor = mix(vec4(1,0,0,1),c, ll);
    fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'WtdfRX';
  }
  name(): string {
    return 'Modified FNV-1A hash';
  }
  sort() {
    return 431;
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
