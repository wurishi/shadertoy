import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float squared(float value) { return value * value; }

float getAmp(float frequency) { return texture(iChannel0, vec2(frequency / 512.0, 0)).x; }

float getWeight(float f) {
    return (+ getAmp(f-2.0) + getAmp(f-1.0) + getAmp(f+2.0) + getAmp(f+1.0) + getAmp(f)) / 5.0; }

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
	vec2 uvTrue = fragCoord.xy / iResolution.xy;
    vec2 uv = -1.0 + 2.0 * uvTrue;
    
	float lineIntensity;
    float glowWidth;
    vec3 color = vec3(0.0);
    
	for(float i = 0.0; i < 5.0; i++) {
        
		uv.y += (0.2 * sin(uv.x + i/7.0 - iTime * 0.6));
        float Y = uv.y + getWeight(squared(i) * 20.0) *
            (texture(iChannel0, vec2(uvTrue.x, 1)).x - 0.5);
        lineIntensity = 0.4 + squared(1.6 * abs(mod(uvTrue.x + i / 1.3 + iTime,2.0) - 1.0));
		glowWidth = abs(lineIntensity / (150.0 * Y));
		color += vec3(glowWidth * (2.0 + sin(iTime * 0.13)),
                      glowWidth * (2.0 - sin(iTime * 0.23)),
                      glowWidth * (2.0 - cos(iTime * 0.19)));
	}	
	
	fragColor = vec4(color, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '4ljGD1';
  }
  name(): string {
    return 'Waves Remix';
  }
  sort() {
    return 713;
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
  webgl() {
    return WEBGL_2;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [{ type: 3 }];
  }
}
