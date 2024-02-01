import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define V vec3

V k = V(.4,-.2,.9);

V m( V p )
{
    p -= iTime;
	for( int i=0; i<16; i++ ) 
        p = reflect( abs(p)-9., k );
    return p* .5;
}

void mainImage( out vec4 c, in vec2 p )
{
    V d = V(p,1)/iResolution, o = d;
    
    for( int i=0; i<99; i++ ) 
        o += d * m(o).x;
    
    c = texture( iChannel0, m(o).yz ) * (.5 + 99.*m(o-k*.02).x) * exp(.04*o.yzzz);
}
`;

export default class implements iSub {
  key(): string {
    return '4ts3DH';
  }
  name(): string {
    return '[2TC 15] Flying';
  }
  sort() {
    return 385;
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
  channels() {
    return [{ ...webglUtils.WOOD_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
