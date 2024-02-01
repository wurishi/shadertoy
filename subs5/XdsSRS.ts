import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec2 uv = (fragCoord.xy/iResolution.xy)-.5;
	float len = length(uv.xy);
	
    float t = .1*iTime;
	float time = t  +  (5.+sin(t))*.11 / (len+.07); // spiraling
	float si = sin(time), co = cos(time);
	uv *= mat2(co, si, -si, co);                    // rotation

	float c=0., v1=0., v2=0., v3;  vec3 p;
	
	for (int i = 0; i < 100; i++) {
		p = .035*float(i) *  vec3(uv, 1.);
		p += vec3(.22,  .3,  -1.5 -sin(t*1.3)*.1);
		
		for (int i = 0; i < 8; i++)                // IFS
			p = abs(p) / dot(p,p) - 0.659;

		float p2 = dot(p,p)*.0015;
		v1 += p2 * ( 1.8 + sin(len*13.0  +.5 -t*2.) );
		v2 += p2 * ( 1.5 + sin(len*13.5 +2.2 -t*3.) );
	}
	
	c = length(p.xy) * .175;
	v1 *= smoothstep(.7 , .0, len);
	v2 *= smoothstep(.6 , .0, len);
	v3  = smoothstep(.15, .0, len);

	vec3 col = vec3(c,  (v1+c)*.25,  v2);
	col = col  +  v3*.9;                      // useless: clamp(col, 0.,1.)
	fragColor=vec4(col, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'XdsSRS';
  }
  name(): string {
    return 'Galaxy of Universes (2)';
  }
  sort() {
    return 584;
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
