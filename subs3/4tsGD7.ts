import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 z, in vec2 w ) {
    vec3 d = vec3(w,1)/iResolution-.5, p, c, f, g=d, o, y=vec3(1,2,0);
 	o.y = 3.*cos((o.x=.3)*(o.z=iDate.w));

    for( float i=.0; i<9.; i+=.01 ) {
        f = fract(c = o += d*i*.01), p = floor( c )*.3;
        if( cos(p.z) + sin(p.x) > ++p.y ) {
	    	g = (f.y-.04*cos((c.x+c.z)*40.)>.8?y:f.y*y.yxz) / i;
            break;
        }
    }
    z.xyz = g;
    z.a = 1.;
}

/*

// original:


void main() {
    vec3 d = gl_fragCoord.xyw/iResolution-.5, p, c, f, g=d, o, y=vec3(1,2,0);
 	o.y = 3.*cos((o.x=.3)*(o.z=iDate.w));

    for( float i=.0; i<9.; i+=.01 ) {
        f = fract(c = o += d*i*.01), p = floor( c )*.3;
        if( cos(p.z) + sin(p.x) > ++p.y ) {
	    	g = (f.y-.04*cos((c.x+c.z)*40.)>.8?y:f.y*y.yxz) / i;
            break;
        }
    }
    gl_fragColor.xyz = g;
}

*/
`;

export default class implements iSub {
  key(): string {
    return '4tsGD7';
  }
  name(): string {
    return '[2TC 15] Minecraft';
  }
  sort() {
    return 388;
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
