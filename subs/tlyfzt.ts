import { GUI } from 'dat.gui';
import { createCanvas, iSub } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
mat2 rotate2D(float r){
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}
vec3 hsv(float h, float s, float v){
  vec4 t = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + t.xyz) * 6.0 - vec3(t.w));
  return v * mix(vec3(t.x), clamp(p - vec3(t.x), 0.0, 1.0), s);
}

void mainImage( out vec4 o, in vec2 fragCoord )
{
  o = vec4(0, 0, 0, 1);
  vec2 r = iResolution.xy;
  float g = 0.;
  float k = iTime * .1; 
  for (float i = 0.; i < 99.; ++i)
  {
      vec3 p = vec3 (g * (fragCoord.xy - .5 * r) / r.y + .5, g - 1.);
      p.xz *= rotate2D (k);
      float s = 3.;
      // fractal levels
      for (int i=0; i < 9;i++)
      {
          float e = max (1., (8. - 8. * cos (k)) / dot (p, p));
          s *= e;
          p = vec3 (2, 4, 2) - abs (abs (p) * e - vec3 (4, 4, 2));
      }
      g += min (length (p.xz), p.y) / s;
      s = log (s);
      o.rgb += hsv (s / 15. + .5, .3, s / 1000.);
  }
}`;

export default class implements iSub {
  key(): string {
    return 'tlyfzt';
  }
  sort() {
    return 2;
  }
  name(): string {
    return 'yonatan fractal';
  }
  tags?(): string[] {
    return ['fractal'];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  destory(): void {}
  // initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
  //   return () => {
  //     console.log(1);
  //   };
  // }
}
