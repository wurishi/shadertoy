import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2 p = -1.0 + 2.0 * fragCoord.xy / iResolution.xy;
  vec2 m = -1.0 + 2.0 * iMouse.xy / iResolution.xy;

  float a1 = atan(p.y-m.y,p.x-m.x);
  float r1 = sqrt(dot(p-m,p-m));
  float a2 = atan(p.y+m.y,p.x+m.x);
  float r2 = sqrt(dot(p+m,p+m));

  vec2 uv;
  uv.x = 0.2*iTime + (r1-r2)*0.25;
  uv.y = asin(sin(a1-a2))/3.1416;
	

  vec3 col = texture( iChannel0, 0.125*uv ).zyx;

  float w = exp(-15.0*r1*r1) + exp(-15.0*r2*r2);

  w += 0.25*smoothstep( 0.93,1.0,sin(128.0*uv.x));
  w += 0.25*smoothstep( 0.93,1.0,sin(128.0*uv.y));
	
  fragColor = vec4(col+w,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '4sXGzn';
  }
  name(): string {
    return 'Deform - holes';
  }
  sort() {
    return 258;
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
    return [webglUtils.ROCK_TEXTURE];
  }
}
