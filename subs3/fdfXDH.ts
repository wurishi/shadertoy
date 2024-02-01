import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float taxi(vec2 v) { return abs(v.x) + abs(v.y); }

float random (vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

float f (float x) { return 16. * x * x * (1.-x) * (1.-x);}

float func(vec2 uv, float t)
{
vec2 dir = uv - .5;
float b = f(0.5 * (1. + cos(t)));
float d = b *  f(fract(3.5 * length(dir))) + (1.-b) * f(fract(3.5 * taxi(dir)));
d *=8. + 5. * cos(0.5 * t);
float theta = atan(dir.y,dir.x);

float b2 = 0.5 * (1. + cos(0.313 * t));
   return (1.-b2) * (1. - smoothstep(d,-0.9,f(0.3 + 0.05 * cos(0.5 * t))))
   + b2 * step(d,0.3 + 0.05 * cos(0.5 * t));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.y - vec2( 0.375,0.);
     
      float t2 = 0.1 * iTime;
uv -= 0.5;
    uv = 0.5 + vec2(uv.x * cos(t2) - uv.y * sin(t2),
    uv.x * sin(t2) + uv.y *cos(t2));
     float t = iTime + 0.05 * random(uv);//vec2(floor(396. * uv)));

float b = 0.5 * (1. + cos(.13149 * t));
//float p = 2. * 3.14159 / 3.;
float col = func(uv,t + 0.115 + 0.015 * b);
float col2 = func(uv,t);
float col3 = func(uv,t - 0.115 - 0.015 * b);



    // Output to screen
    fragColor = vec4(col,col2,col3,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'fdfXDH';
  }
  name(): string {
    return 'Pablo';
  }
  sort() {
    return 373;
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
