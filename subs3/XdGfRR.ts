import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Creative Commons Attribution-ShareAlike 4.0 International Public License
// Created by David Hoskins. May 2018


#define UI0 1597334673U
#define UI1 3812015801U
#define UI2 uvec2(UI0, UI1)
#define UI3 uvec3(UI0, UI1, 2798796415U)
#define UIF (1.0 / float(0xffffffffU))

// The labeling refers to the number of values - hash(out)(in)...
//---------------------------------------------------------------------------------------------------------------
float hash11(uint q)
{
	uvec2 n = q * UI2;
	q = (n.x ^ n.y) * UI0;
	return float(q) * UIF;
}

float hash11(float p)
{
	uvec2 n = uint(int(p)) * UI2;
	uint q = (n.x ^ n.y) * UI0;
	return float(q) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
float hash12(uvec2 q)
{
	q *= UI2;
	uint n = (q.x ^ q.y) * UI0;
	return float(n) * UIF;
}

float hash12(vec2 p)
{
	uvec2 q = uvec2(ivec2(p)) * UI2;
	uint n = (q.x ^ q.y) * UI0;
	return float(n) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
float hash13(uvec3 q)
{
	q *= UI3;
	uint n = (q.x ^ q.y ^ q.z) * UI0;
	return float(n) * UIF;
}

float hash13(vec3 p)
{
	uvec3 q = uvec3(ivec3(p)) * UI3;
	q *= UI3;
	uint n = (q.x ^ q.y ^ q.z) * UI0;
	return float(n) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
vec2 hash21(uint q)
{
	uvec2 n = q * UI2;
	n = (n.x ^ n.y) * UI2;
	return vec2(n) * UIF;
}

vec2 hash21(float p)
{
	uvec2 n = uint(int(p)) * UI2;
	n = (n.x ^ n.y) * UI2;
	return vec2(n) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
vec2 hash22(uvec2 q)
{
	q *= UI2;
	q = (q.x ^ q.y) * UI2;
	return vec2(q) * UIF;
}

vec2 hash22(vec2 p)
{
	uvec2 q = uvec2(ivec2(p))*UI2;
	q = (q.x ^ q.y) * UI2;
	return vec2(q) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
vec2 hash23(uvec3 q)
{
	q *= UI3;
	uvec2 n = (q.x ^ q.y ^ q.z) * UI2;
	return vec2(n) * UIF;
}

vec2 hash23(vec3 p)
{
	uvec3 q = uvec3(ivec3(p)) * UI3;
	uvec2 n = (q.x ^ q.y ^ q.z) * UI2;

	return vec2(n) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
vec3 hash31(uint q)
{
	uvec3 n = q * UI3;
	n = (n.x ^ n.y ^ n.z) * UI3;
	return vec3(n) * UIF;
}
vec3 hash31(float p)
{

	uvec3 n = uint(int(p)) * UI3;
	n = (n.x ^ n.y ^ n.z) * UI3;
	return vec3(n) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
vec3 hash32(uvec2 q)
{
	uvec3 n = q.xyx * UI3;
	n = (n.x ^ n.y ^n.z) * UI3;
	return vec3(n) * UIF;
}

vec3 hash32(vec2 q)
{
	uvec3 n = uvec3(ivec3(q.xyx)) * UI3;
	n = (n.x ^ n.y ^ n.z) * UI3;
	return vec3(n) * UIF;
}

//---------------------------------------------------------------------------------------------------------------
vec3 hash33(uvec3 q)
{
	q *= UI3;
	q = (q.x ^ q.y ^ q.z)*UI3;
	return vec3(q) * UIF;
}

vec3 hash33(vec3 p)
{
	uvec3 q = uvec3(ivec3(p)) * UI3;
	q = (q.x ^ q.y ^ q.z)*UI3;
	return vec3(q) * UIF;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{

	float up1 = (fragCoord.x + fragCoord.y*iResolution.x) + float(iFrame);
	vec2  up2 = vec2(fragCoord) + float(iFrame);
	vec3  up3 = vec3(fragCoord, float(iFrame));

	vec3 c = vec3(0);

	//c.x = hash11(-up1);
	//c.xy = hash23(up3);
	c = hash33(up3);

	fragColor = vec4(c, 1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'XdGfRR';
  }
  name(): string {
    return 'Hash without Sine 2 (WebGL 2)';
  }
  sort() {
    return 400;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
