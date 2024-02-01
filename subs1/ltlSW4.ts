import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform int u_mode;

// 143 chars: cannot use inout anymore.
void mode143(out vec4 o, vec2 i)
{
	  i=i/iResolution.y/.1+iDate.w;
    o.xy-=step(i-=o.xy=ceil(i+=i.x*=.577),mod(o.x+o.y,3.)+--i.yx);
    o=mod(o.xyyy,.8);
}


// 140ch
void mode140(inout vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    o.xy-=step(i-=o.xy=ceil(i+=i.x*=.577),mod(o.x+o.y,3.)+--i.yx);
    o=mod(o,.8);
}

// 141ch
// different coloring.
// Now to squeeze out that last char...
void mode141(inout vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    i-=o.xy=ceil(i+=i.x*=.58);
    o.xy+=step(mod(o.x+o.y,3.)+i++.yx,i);
    o=mod(o,.8);
}

// 146ch
// aha! managed to obfuscate that switch() logic even further.
// this is almost incomprehensible at this point.
void mode146(inout vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    i-=o.xy=ceil(i+=i.x*=.577);
    o.xy+=step(mod(o.x+o.y,3.)-1.+i.yx,i);
    o=.5+.5*sin(o);
}

// 168ch
// with optimizations from FabriceNeyret2
void mode168(out vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    i-=o.xy=ceil(i+=i.x*=.577);
    o.xy += (o.w=mod(o.x+o.y,3.)) < 1. ? i-i :o.w<2. ? i-i+1. : step(i.yx,i);
    o=.5+.5*sin(o);
}

// 174ch
// first optimization pass
void mode174(out vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    i-=o.xy=ceil(i+=i.x*=.577);
	o.xy+=step(1.,o.z=mod(o.x+o.y,3.))-step(2.,o.z)*step(i,i.yx);
    o.z=0.;// remove this line for qbert-like variant (rotated ...)
    o=.5+.5*sin(o);
}

// 174ch
// pretty variation
void mode174p(out vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    i-=o.xy=ceil(i+=i.x*=.577);
	o.xy+=step(1.,o.z=mod(o.x+o.y,3.))-step(2.,o.z)*step(i,i.yx);
    o=.5+.5*sin(o-i.xyxy);
}

// 281ch
// original, unoptimized version 

void mode281(out vec4 o, vec2 i)
{
	i=i/iResolution.y/.1+iDate.w;
    
    vec2 q = vec2( i.x*2.0*0.5773503, i.y + i.x*0.5773503 );
	
	vec2 pi = floor(q);
	vec2 pf = fract(q);

	float v = mod(pi.x + pi.y, 3.0);

	float ca = step(1.0,v);
	float cb = step(2.0,v);
	vec2  ma = step(pf.xy,pf.yx);
	
	o = vec4(pi + ca - cb*ma, 0, 0);
    o=.5+.5*sin(o);
}

void mainImage(out vec4 o, vec2 i)
{
  if(u_mode == 140) {
    mode140(o, i);
  }
  else if(u_mode == 143) {
    mode143(o, i);
  }
  else if(u_mode == 141) {
    mode141(o, i);
  }
  else if(u_mode == 146) {
    mode146(o, i);
  }
  else if(u_mode == 168) {
    mode168(o, i);
  }
  else if(u_mode == 174) {
    mode174(o, i);
  }
  else if(u_mode == 175) {
    mode174p(o, i);
  }
  else if(u_mode == 281) {
    mode281(o, i);
  }
  else {
    mode140(o, i);
  }
}
`;

let gui: GUI;
const api = {
  u_mode: 140,
};
const config = {
  140: 140,
  143: 143,
  141: 141,
  146: 146,
  168: 168,
  174: 174,
  '174 pretty': 175,
  281: 281,
};

export default class implements iSub {
  key(): string {
    return 'ltlSW4';
  }
  name(): string {
    return 'Hex Master 140ch';
  }
  sort() {
    return 148;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_mode', config);
    return createCanvas({ bg: 'black' });
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
    const u_mode = webglUtils.getUniformLocation(gl, program, 'u_mode');
    return () => {
      u_mode.uniform1i(api.u_mode);
    };
  }
}
