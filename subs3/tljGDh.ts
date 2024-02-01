import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = gl_FragCoord.xy/iResolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5*iResolution.xy)/iResolution.y;
    float rx = abs(p.x);
    float rx2 = rx*rx, rx3 = rx*rx*rx;
    float rx4 = rx2*rx2;
    float pds = p.y + 0.2;
    float logo = abs(pds*pds)*2.0 + rx*3.6 - 1.2; //sides
    logo = max(logo, rx3*8. + p.y*4.04 + - 0.75); // topmost
    logo = max(logo, rx*rx4*24. - p.y*4.0 - 0.84); // bottommost
    logo = max(logo, 0.72 - clamp(rx-0.19,-0.01,3.)*4. - p.y*3.2 + rx*0.4 -1.2); // chin
    logo = max(logo, 0.8 - clamp(rx-0.1, 0., 3.)*4. + p.y*3.2 - 1.2); // forehead
    logo = max(logo, (.5-abs(p.y*6.7 + 1.8 - 7.*rx2))*0.5 - rx*rx4*16. + 0.21); // mouth
    logo = max(logo, (.5 - abs(p.y*7. - 1.85 + 6.5*rx2))*0.5 - rx*rx4*17.5 + 0.21); // brow
    logo = 1.-min(1.-logo, 4.*length(vec2(abs(p.x*1.14)-0.16, p.y+.05))+.24); //eyes
    vec3 col = mix(vec3(0.97), vec3(0.435, 0.521, 0.831), smoothstep(0.4, 0.41 + 1.5/iResolution.y, logo));
    col *= pow(30.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1)*0.5 + 0.5;
    fragColor = vec4(col, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'tljGDh';
  }
  name(): string {
    return 'Shadertoy Discord server';
  }
  sort() {
    return 330;
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
