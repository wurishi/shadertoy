import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float PI = acos(-1.0);

float hash(vec2 n) { 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

vec2 randomDirectionTile(vec2 position, vec2 offset) {
	float noiseAngle = 2.0 * PI * hash(floor(position) + offset);
    return vec2(sin(noiseAngle), cos(noiseAngle));
}

float noisePass(vec2 position, vec2 offset, float frequency) {
    vec2 noiseDirection = randomDirectionTile(position, offset);
    
    return sin(dot(position, noiseDirection) * PI * frequency) * 0.5 + 0.5;
}

float noise(vec2 position, float frequency) {
	vec2 fr = fract(position);
         fr = fr * fr * (3.0 - 2.0 * fr);
    
    vec2 offset = vec2(1.0, 0.0);
    
    return mix(mix(noisePass(position, offset.yy, frequency),
               	   noisePass(position, offset.xy, frequency),
               	   fr.x),
               mix(noisePass(position, offset.yx, frequency),
               	   noisePass(position, offset.xx, frequency),
               	   fr.x),
               fr.y);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
         uv.x *= iResolution.x / iResolution.y;

    vec3 color = vec3(0.0);
         color += noise(uv * 16.0, 2.0);

    fragColor = vec4(color,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'wttSRj';
  }
  name(): string {
    return 'interesting noise algorithm';
  }
  sort() {
    return 92;
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
