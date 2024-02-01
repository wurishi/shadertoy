import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_smoothstep;
uniform bool u_div;
uniform bool u_sign;
uniform bool u_pow;
uniform bool u_floor;

vec4 circle(vec2 uv, vec2 origin, float radius, vec4 color)
{
    float d = length(uv - origin) - radius;// distance from uv to the edge of the circle.
    float a;
    
    // using smoothstep() is idiomatic, fast, and clean (no bleeding).
    if(u_smoothstep) {
      a = 1.0 -smoothstep(0.,0.006, d);
    }
    
    // using a divide gives a very long falloff, so it bleeds which I think is pretty.
    if(u_div) {
      const float amount = 300.0;// bigger number = more accurate / crisper falloff.
      a = clamp(1.0 / (clamp(d, 1.0/amount, 1.0)*amount), 0.,1.);
    }

    // using sign() which gives 1 50% AA value. it's cheap, but kind of ugly.
    if(u_sign) {
      const float epsilon = 0.0007;
      if(abs(d) <= epsilon) d = 0.;// is there a way to optimize this out?
      a = (sign(-d) + 1.0) / 2.0;
    }

    // using pow() to crispen edges. pretty, but I think smoothstep has about the same effect and is cheaper..
    if(u_pow) {
      a = pow(clamp(1.0 - d,0.,1.),200.0);
    }
    
    // you can also use floor() to create a sharp edge, but you'll have to first
    // go through the DIV method above. floor just eliminates the smoothness and bleeding.
    // Not very useful...
    if(u_floor) {
      const float amount = 100000.0;// bigger number = more accurate
      a = floor( clamp(1.0 / (clamp(d, 1.0/amount, 1.0)*amount), 0.,1.) );
    }

    return vec4(color.rgb, color.a * a);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.yy;
    
    // background color
    fragColor = vec4(1.0);

    // red circle
    vec4 c1 = circle(uv, vec2(0.5 +((sin(iTime*0.75)+1.)/3.), 0.5), 0.3, vec4(.85,0.,0.,1));
	fragColor = mix(fragColor, c1, c1.a);

    // blue circle
    vec4 c2 = circle(uv, vec2(0.5 +((cos(iTime*0.85)+1.)/2.), 0.5), 0.2, vec4(.2,0.,0.8,1));
	fragColor = mix(fragColor, c2, c2.a);
}
`;

let gui: GUI;
const api = {
  u_smoothstep: false,
  u_div: true,
  u_sign: false,
  u_pow: false,
  u_floor: false,
};

export default class implements iSub {
  key(): string {
    return 'ltBGzt';
  }
  name(): string {
    return 'Distance field drawing methods';
  }
  sort() {
    return 150;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_smoothstep');
    gui.add(api, 'u_div');
    gui.add(api, 'u_sign');
    gui.add(api, 'u_pow');
    gui.add(api, 'u_floor');
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
    const u_smoothstep = webglUtils.getUniformLocation(
      gl,
      program,
      'u_smoothstep'
    );
    const u_div = webglUtils.getUniformLocation(gl, program, 'u_div');
    const u_sign = webglUtils.getUniformLocation(gl, program, 'u_sign');
    const u_pow = webglUtils.getUniformLocation(gl, program, 'u_pow');
    const u_floor = webglUtils.getUniformLocation(gl, program, 'u_floor');
    return () => {
      u_smoothstep.uniform1i(api.u_smoothstep ? 1 : 0);
      u_div.uniform1i(api.u_div ? 1 : 0);
      u_sign.uniform1i(api.u_sign ? 1 : 0);
      u_pow.uniform1i(api.u_pow ? 1 : 0);
      u_floor.uniform1i(api.u_floor ? 1 : 0);
    };
  }
}
