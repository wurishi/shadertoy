import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform float u_pulse;
uniform bool u_show_blocks;

float rand(float x)
{
    return fract(sin(x) * 4358.5453123);
}

float rand(vec2 co)
{
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5357);
}

float box(vec2 p, vec2 b, float r)
{
  return length(max(abs(p)-b,0.0))-r;
}

float sampleMusic()
{
	return 0.5 * (
		//texture( iChannel0, vec2( 0.01, 0.25 ) ).x + 
		//texture( iChannel0, vec2( 0.07, 0.25 ) ).x + 
		texture( iChannel0, vec2( 0.15, 0.25 ) ).x + 
		texture( iChannel0, vec2( 0.30, 0.25 ) ).x);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	const float speed = 0.7;
	const float ySpread = 1.6;
	const int numBlocks = 70;

	// float pulse = sampleMusic();
  float pulse = u_pulse;
	
	vec2 uv = fragCoord.xy / iResolution.xy - 0.5;
	float aspect = iResolution.x / iResolution.y;
	vec3 baseColor = uv.x > 0.0 ? vec3(0.0,0.3, 0.6) : vec3(0.6, 0.0, 0.3);
	
	vec3 color = pulse*baseColor*0.5*(0.9-cos(uv.x*8.0));
	uv.x *= aspect;
	
	for (int i = 0; i < numBlocks; i++)
	{
		float z = 1.0-0.7*rand(float(i)*1.4333); // 0=far, 1=near
		float tickTime = iTime*z*speed + float(i)*1.23753;
		float tick = floor(tickTime);
		
		vec2 pos = vec2(0.6*aspect*(rand(tick)-0.5), sign(uv.x)*ySpread*(0.5-fract(tickTime)));
		pos.x += 0.24*sign(pos.x); // move aside
		if (abs(pos.x) < 0.1) pos.x++; // stupid fix; sign sometimes returns 0
		
		vec2 size = 1.8*z*vec2(0.04, 0.04 + 0.1*rand(tick+0.2));
		float b = box(uv-pos, size, 0.01);
		float dust = z*smoothstep(0.22, 0.0, b)*pulse*0.5;
    if(u_show_blocks) {
      float block = 0.2*z*smoothstep(0.002, 0.0, b);
      float shine = 0.6*z*pulse*smoothstep(-0.002, b, 0.007);
      color += dust*baseColor + block*z + shine;
    }
    else {
      color += dust*baseColor;
    }
	}
	
	color -= rand(uv)*0.04;
	fragColor = vec4(color, 1.0);
}
`;

let gui: GUI;
const api = {
  u_pulse: 0.5,
  u_show_blocks: false,
};

export default class implements iSub {
  key(): string {
    return 'XsfGDS';
  }
  name(): string {
    return 'I/O';
  }
  sort() {
    return 139;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_pulse', 0, 1, 0.01);
    gui.add(api, 'u_show_blocks');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_pulse = webglUtils.getUniformLocation(gl, program, 'u_pulse');
    const u_show_blocks = webglUtils.getUniformLocation(
      gl,
      program,
      'u_show_blocks'
    );
    return () => {
      u_pulse.uniform1f(api.u_pulse);
      u_show_blocks.uniform1i(api.u_show_blocks ? 1 : 0);
    };
  }
}
