import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 f, in vec2 w )
{
    float k=0.;
    vec3 d =  vec3(w,1.)/iResolution-.7, o = d, c=k*d, p;
    
    for( int i=0; i<99; i++ ){
        
        p = o+sin(iTime*.1);
		for (int j = 0; j < 10; j++) 
		
        	p = abs(p) / dot(p,p) -1.,k += exp(-6. * abs(dot(p,o)));
		
		
		k/=3.;
        o += d *.05/k;
        c = .97*c + .1*k*vec3(k*k,k,1);
    }
    c =  .4 *log(1.+c);
    f.rgb = c;
    f.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'MtfGWN';
  }
  name(): string {
    return '[2TC 15] Supernova';
  }
  sort() {
    return 382;
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
