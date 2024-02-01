import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define HALF (127.0/255.0)

vec4 charSample(float c, vec2 uv) {
    vec2 anchor = vec2( mod(c, 16.0), 16.0 - floor(c / 16.0) );
    return texture(iChannel0, (anchor+uv) / 16.0);
}

float charVerticalDist(float n, vec2 at) {
    vec4 sampleHere = charSample(n, at);
    float dist = sampleHere.a - HALF;
    dist *= sampleHere.g * 2.0 - 1.0;
    return dist;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec2 uv = fragCoord.xy / iResolution.xy * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    uv = uv*0.5+0.5;
    
    // pick a letter
    float c = floor(iTime);
    if (iMouse.z > 0.0) c = floor(iMouse.x * 0.5);
    vec4 char = charSample(c, uv);
    
    // accumulate color
    vec3 color = vec3(0);
    color = vec3(step(char.a, HALF));
    
    float distLeft = charVerticalDist(c, vec2(0.02, 0.5));
    float distRight = charVerticalDist(c, vec2(0.98, 0.5));
    
    color.r += step(abs(uv.x + distLeft), 0.01);
    color.g += step(abs((1.0-uv.x) - distRight), 0.01);
    
	fragColor.rgb = color;
    fragColor.a = 1.0;
}
`;

export default class implements iSub {
  key(): string {
    return 'MsfyDN';
  }
  name(): string {
    return 'Test font spacing';
  }
  sort() {
    return 287;
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
    return [webglUtils.FONT_TEXTURE];
  }
}
