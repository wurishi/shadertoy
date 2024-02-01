import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_RGB;

float hash1( uint n ) 
{
    // integer hash copied from Hugo Elias
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    return float( n & uvec3(0x7fffffffU))/float(0x7fffffff);
}

vec3 hash3( uint n ) 
{
    // integer hash copied from Hugo Elias
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    uvec3 k = n * uvec3(n,n*16807U,n*48271U);
    return vec3( k & uvec3(0x7fffffffU))/float(0x7fffffff);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  uvec2 p = uvec2(fragCoord);
  vec3 c;
  if(u_RGB) {
    c = hash3( p.x + 1920U*p.y + (1920U*1080U)*uint(iFrame) );
  }
  else {
    c = vec3( hash1( p.x + 1920U*p.y + (1920U*1080U)*uint(iFrame) ) );
  }   
	fragColor = vec4(c,1.0);
}
`;

let gui: GUI;
const api = {
  u_RGB: true,
};

export default class implements iSub {
  key(): string {
    return 'llGSzw';
  }
  name(): string {
    return 'Integer Hash - I';
  }
  sort() {
    return 66;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_RGB');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_RGB = webglUtils.getUniformLocation(gl, program, 'u_RGB');
    return () => {
      u_RGB.uniform1i(api.u_RGB ? 1 : 0);
    };
  }
}
