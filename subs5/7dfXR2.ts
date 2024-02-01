import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float CIRCLE_RAD = 100.;
const float TWO_PI = 6.28318530718;
const float AOE = 40.;
const int NUM_STARS = 12;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float intensity_exp = 0.0, intensity_lin = 0.0;

    for (int j = 0; j < NUM_STARS; j++)
    {
        float theta = mod(texelFetch(iChannel0,ivec2(3*j,j),0).r, TWO_PI) + mod(float(iFrame),90.0);
        float hypot = CIRCLE_RAD;
        
        vec2 star;

        switch (j)
        {
            case 0:
            case 4:
            case 8:
                star = (iResolution.xy * .5) + vec2(cos(theta) * hypot, sin(theta) * hypot);
                break;
            case 1:
            case 5:
            case 9:
                star = (iResolution.xy * .5) + vec2(cos(theta) * -hypot, sin(theta) * hypot);
                break;
            case 2:
            case 6:
            case 10:
                star = (iResolution.xy * .5) + vec2(cos(theta) * -hypot, sin(theta) * -hypot);
                break;
            case 3:
            case 7:
            case 11:
                star = (iResolution.xy * .5) + vec2(cos(theta) * hypot, sin(theta) * -hypot);
                break;
        }
        
        float d = distance(fragCoord, star);
        
        intensity_exp += 1.0 - ( min(AOE, d * d) / AOE );
        intensity_lin += 1.0 - ( min(AOE, d) / AOE );
    }

    fragColor = vec4(intensity_exp, intensity_exp, intensity_lin, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '7dfXR2';
  }
  name(): string {
    return 'fairy_circle.ff3';
  }
  sort() {
    return 580;
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
    return [webglUtils.DEFAULT_NOISE];
  }
}
