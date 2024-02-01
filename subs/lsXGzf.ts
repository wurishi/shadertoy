import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (-iResolution.xy + 2.0*fragCoord) / iResolution.y;

    vec3 col = vec3(0.0);

    // state
    col = mix( col, vec3(1.0,0.0,0.0), 
        (1.0-smoothstep(0.3,0.31,length(uv-vec2(-0.75,0.0))))*
        (0.3+0.7*texelFetch( iChannel0, ivec2(KEY_LEFT,0), 0 ).x) );

    col = mix( col, vec3(1.0,1.0,0.0), 
        (1.0-smoothstep(0.3,0.31,length(uv-vec2(0.0,0.5))))*
        (0.3+0.7*texelFetch( iChannel0, ivec2(KEY_UP,0), 0 ).x));
	
    col = mix( col, vec3(0.0,1.0,0.0),
        (1.0-smoothstep(0.3,0.31,length(uv-vec2(0.75,0.0))))*
        (0.3+0.7*texelFetch( iChannel0, ivec2(KEY_RIGHT,0), 0 ).x));

    col = mix( col, vec3(0.0,0.0,1.0),
        (1.0-smoothstep(0.3,0.31,length(uv-vec2(0.0,-0.5))))*
        (0.3+0.7*texelFetch( iChannel0, ivec2(KEY_DOWN,0), 0 ).x));


    // keypress	
    col = mix( col, vec3(1.0,0.0,0.0), 
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(-0.75,0.0))-0.35)))*
        texelFetch( iChannel0, ivec2(KEY_LEFT,1),0 ).x);
	
    col = mix( col, vec3(1.0,1.0,0.0),
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(0.0,0.5))-0.35)))*
        texelFetch( iChannel0, ivec2(KEY_UP,1),0 ).x);

    col = mix( col, vec3(0.0,1.0,0.0),
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(0.75,0.0))-0.35)))*
        texelFetch( iChannel0, ivec2(KEY_RIGHT,1),0 ).x);
	
    col = mix( col, vec3(0.0,0.0,1.0),
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(0.0,-0.5))-0.35)))*
        texelFetch( iChannel0, ivec2(KEY_DOWN,1),0 ).x);
    
    
    // toggle	
    col = mix( col, vec3(1.0,0.0,0.0), 
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(-0.75,0.0))-0.3)))*
        texelFetch( iChannel0, ivec2(KEY_LEFT,2),0 ).x);
	
    col = mix( col, vec3(1.0,1.0,0.0),
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(0.0,0.5))-0.3)))*
        texelFetch( iChannel0, ivec2(KEY_UP,2),0 ).x);

    col = mix( col, vec3(0.0,1.0,0.0),
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(0.75,0.0))-0.3)))*
        texelFetch( iChannel0, ivec2(KEY_RIGHT,2),0 ).x);
	
    col = mix( col, vec3(0.0,0.0,1.0),
        (1.0-smoothstep(0.0,0.01,abs(length(uv-vec2(0.0,-0.5))-0.3)))*
        texelFetch( iChannel0, ivec2(KEY_DOWN,2),0 ).x);

    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'lsXGzf';
  }
  name(): string {
    return 'Input - Keyboard';
  }
  // sort() {
  //   return 0;
  // }
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
