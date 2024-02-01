import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
mat2 rotate2d(float angle){
  return mat2(cos(angle),-sin(angle),
              sin(angle),cos(angle));
}

float variation(vec2 v1, vec2 v2, float strength, float speed) {
return sin(
      dot(normalize(v1), normalize(v2)) * strength + iTime * speed
  ) / 100.0;
}

vec3 paintCircle (vec2 uv, vec2 center, float rad, float width) {
  
  vec2 diff = center-uv;
  float len = length(diff);

  len += variation(diff, vec2(0.0, 1.0), 5.0, 2.0);
  len -= variation(diff, vec2(1.0, 0.0), 5.0, 2.0);
  
  float circle = smoothstep(rad-width, rad, len) - smoothstep(rad, rad+width, len);
  return vec3(circle);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
vec2 uv = fragCoord.xy / iResolution.xy;
  uv.x *= 1.5;
  uv.x -= 0.25;
  
  vec3 color;
  float radius = 0.35;
  vec2 center = vec2(0.5);
  
   
  //paint color circle
  color = paintCircle(uv, center, radius, 0.1);
  
  //color with gradient
  vec2 v = rotate2d(iTime) * uv;
  color *= vec3(v.x, v.y, 0.7-v.y*v.x);
  
  //paint white circle
  color += paintCircle(uv, center, radius, 0.01);
  
  
fragColor = vec4(color, 1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'ltBXRc';
  }
  name(): string {
    return 'Shiny Circle';
  }
  sort() {
    return 696;
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
