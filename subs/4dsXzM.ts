import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform float u_scale;
uniform float u_thickness;
uniform float u_lengt;

#define layers 15.
#define time iTime*3.

vec2 hash12(float p)
{
	return fract(vec2(sin(p * 591.32), cos(p * 391.32)));
}

float hash21(in vec2 n) 
{ 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

vec2 hash22(in vec2 p)
{
    p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
	return fract(sin(p)*43758.5453);
}

mat2 makem2(in float theta)
{
	float c = cos(theta);
	float s = sin(theta);
	return mat2(c,-s,s,c);
}

float field1(in vec2 p)
{
	vec2 n = floor(p)-0.5;
    vec2 f = fract(p)-0.5;
    vec2 o = hash22(n)*.35;
	vec2 r = - f - o;
	r *= makem2(time+hash21(n)*3.14);
	
	float d =  1.0-smoothstep(u_thickness,u_thickness+0.09,abs(r.x));
	d *= 1.-smoothstep(u_lengt,u_lengt+0.02,abs(r.y));
	
	float d2 = 1.0-smoothstep(u_thickness,u_thickness+0.09,abs(r.y));
	d2 *= 1.-smoothstep(u_lengt,u_lengt+0.02,abs(r.x));
	
    return max(d,d2);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy-0.5;
	p.x *= iResolution.x/iResolution.y;
	
	float mul = (iResolution.x+iResolution.y)/u_scale;
	
	vec3 col = vec3(0);
	for (float i=0.;i <layers;i++)
	{
		vec2 ds = hash12(i*2.5)*.20;
		col = max(col,field1((p+ds)*mul)*(sin(ds.x*5100. + vec3(1.,2.,3.5))*.4+.6));
	}
	
	fragColor = vec4(col,1.0);
}
`;

let gui: GUI;
const api = {
  u_scale: 90,
  u_thickness: 0,
  u_lengt: 0.13,
};

export default class implements iSub {
  key(): string {
    return '4dsXzM';
  }
  sort() {
    return 1;
  }
  name(): string {
    return 'Fovea detector';
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_scale', 1, 200, 1);
    gui.add(api, 'u_thickness', 0, 1, 0.01);
    gui.add(api, 'u_lengt', 0, 1, 0.01);
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
    const u_scale = webglUtils.getUniformLocation(gl, program, 'u_scale');
    const u_thickness = webglUtils.getUniformLocation(
      gl,
      program,
      'u_thickness'
    );
    const u_lengt = webglUtils.getUniformLocation(gl, program, 'u_lengt');
    return () => {
      u_scale.uniform1f(api.u_scale);
      u_thickness.uniform1f(api.u_thickness);
      u_lengt.uniform1f(api.u_lengt);
    };
  }
}
