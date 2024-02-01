import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/*
This is a demo of the new font texture. 
It has a distance field and gradients in the texture.
Red channel:   Antialiased font if you just want something simple and easy to use.
Green channel: x gradient of distance field.
Blue channel:  y gradient of distance field.
Alpha channel: distance field.

The characters that are encoded are the characters from the first 8 bits of unicode (aka Latin-1 codepage).
That includes ASCII. In the blanks, there are symbols that seemed useful for shadertoy. Math symbols,
greek letters, play/pause controls, arrows, musical notes, and some others.

The distance field lets you use the font for ray marching. Since the texture didn't have enough precision
for a clean distance field, nice smooth gradients have been put in the green/blue channels to get smooth edges.

Sometimes you might see some artifacts in the font edges when you look from an angle. To fix those,
the ray marching would have to pause at the boundary between each letter since the distance field is
not continuous between letters. That would complicate this code a bit, so it was left out.
*/

#define R iResolution.xy

float linscale(float x, float x1, float x2, float y1, float y2){
    return (y2-y1)/(x2-x1)*(x-x2) + y2;
}

void mainImage(out vec4 color, in vec2 xy){
    float R_min = min(R.x, R.y);
    float R_max = max(R.x, R.y);
    
    vec2 uv = (xy - 0.5*R)/R_min + 0.5;
    vec2 muv = (iMouse.xy - 0.5*R)/R_min + 0.5;
    float uv_max = 0.5*R_max/R_min + 0.5;
    float uv_min = uv_max - R_max/R_min;
    /*
                   1.0
        __________________________
       |       |    |    |        |
       |       |    |    |        |
     uv_min   0.0  0.5  1.0     uv_max
       |       |    |    |        |
       |       |    |    |        |
       |__________________________|
                   0.0
       |------ R_max/R_min -------|
    */
    
    float c = 0.0;
    float blur = 0.04;
    
    vec2 st_legend = vec2(uv.x - uv_min, uv.y);
    float d = texture2D(iChannel0, st_legend).w;
    c += 1.0 - smoothstep(0.5-blur, 0.5+blur, d);
    
    vec2 st_pixelated = vec2(
        linscale(muv.x, uv_min, uv_min+1.0, 0.0, 1.0),
        muv.y
    );
    float zoom = 1.0/9.0;
    float cpx = (uv_min+1.0+uv_max)*0.5;
    
    if (uv.y>0.5 && uv.x>cpx-0.25 && uv.x<cpx+0.25){
        vec2 offset = uv - vec2(cpx, 0.75);
        c += texture2D(iChannel0, st_pixelated + offset*zoom).x;
    }
    
    if (uv.y<0.5 && uv.x>cpx-0.25 && uv.x<cpx+0.25){
        vec2 offset = uv - vec2(cpx, 0.25);
        float d = texture2D(iChannel0, st_pixelated + offset*zoom).w;
        c += 1.0 - smoothstep(0.5-blur, 0.5+blur, d);      
    }
    
    color = vec4(vec3(c),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'NsXGz8';
  }
  name(): string {
    return 'font zoom explorer';
  }
  sort() {
    return 26;
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
    return [webglUtils.FONT_TEXTURE];
  }
}
