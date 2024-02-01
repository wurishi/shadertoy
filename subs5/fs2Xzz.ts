import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float TWO_PI = 6.28318530718;

//palette 
const vec4 BLACK = vec4(0.0,0.0,0.0,1.0);
const vec4 WHITE = vec4(1,1,1,1);
const vec4 BLUE = vec4(0,0,1,1);

vec2 rotate(vec2 vector, float rads)
{
    mat2 rotate = mat2(cos(rads), -sin(rads), sin(rads),cos(rads));
    return rotate * vector;
}

vec4 colorStep(vec4 ColorA,vec4 ColorB,float midpt,float x, float line_width)
{
    float a = midpt - (line_width / 2.0);
    float b = a + line_width;
    
    vec4 toLine = smoothstep(midpt,a,x) * ColorA + smoothstep(a,midpt,x) * BLACK;
    vec4 fromLine = smoothstep(b,midpt,x) * BLACK + smoothstep(midpt,b,x) * ColorB;
    return toLine + fromLine;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //centered, -.5 to .5
    vec2 uv = (fragCoord - iResolution.xy / 2.0)/iResolution.xx;
    uv *= 2.0;
    
    vec2 uv1 = rotate(uv, (TWO_PI/64.*round(iTime * 4.)));
    vec2 uv2 = rotate(uv, (TWO_PI/64.*round(iTime * 2.)));
    vec2 uv3 = rotate(uv, (TWO_PI/64.*round(iTime)));
    vec2 uv4 = rotate(uv, (TWO_PI/64.*round(iTime / 2.)));
    
    
    vec2 rb1 = rotate(BLUE.rb, (TWO_PI/64.*round(iTime*4.)));
    vec4 col1 = vec4(rb1.x,0,rb1.y,1);
    vec4 col_far = col1;
    
    vec2 rb2 = rotate(BLUE.rb, (TWO_PI/64.*round(iTime*2.)));
    vec4 col2 = vec4(rb2.x,0,rb2.y,1);
    col_far = distance(col_far,BLUE) < distance(col2,BLUE) ? col2 : col_far;
    
    vec2 rb3 = rotate(BLUE.rb, (TWO_PI/64.*round(iTime)));
    vec4 col3 = vec4(rb3.x,0,rb3.y,1);
    col_far = distance(col_far,BLUE) < distance(col3,BLUE) ? col3 : col_far;
    
    vec2 rb4 = rotate(BLUE.rb, (TWO_PI/64.*round(iTime / 2.)));
    vec4 col4 = vec4(rb4.x,0,rb4.y,1);
    col_far = distance(col_far,BLUE) < distance(col4,BLUE) ? col4 : col_far;
    
    // Output to screen
    fragColor = col_far;
    fragColor = colorStep(colorStep(col1, WHITE, 0., uv4.x, .01), fragColor, 0.4, length(uv4), .01);
    fragColor = colorStep(colorStep(col2, WHITE, 0., uv3.x, .01), fragColor, 0.2, length(uv3), .01);
    fragColor = colorStep(colorStep(col3, WHITE, 0., uv2.x, .01), fragColor, 0.1, length(uv2), .01);
    fragColor = colorStep(colorStep(col4, WHITE, 0., uv1.x, .01), fragColor, 0.03, length(uv1), .01);
}
`;

export default class implements iSub {
  key(): string {
    return 'fs2Xzz';
  }
  name(): string {
    return 'Puzzle ball pattern.';
  }
  sort() {
    return 579;
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
}
