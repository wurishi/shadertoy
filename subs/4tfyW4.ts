import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform int u_mode;
// hash functions adapted from https://stackoverflow.com/a/12996028/5199168
uvec4 hash(uvec4 x){
    x = ((x >> 16u) ^ x.yzwx) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x.yzwx) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x.yzwx) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x.yzwx) * 0x45d9f3bu;
    //x = (x >> 16u) ^ x;
    return x;
}
uvec4 hash(uvec3 x0){
    uvec4 x = x0.xyzz;
    x = ((x >> 16u) ^ x.yzxy) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x.yzxz) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x.yzxx) * 0x45d9f3bu;
    //x = (x >> 16u) ^ x;
    return x;
}

vec4 noise(ivec4 p){
    const float scale = pow(2., -32.);
    uvec4 h = hash(uvec4(p));
    return vec4(h)*scale;
}

vec4 noise(ivec3 p){
    const float scale = 1.0/float(0xffffffffU);
    uvec4 h = hash(uvec3(p));
    return vec4(h)*scale;
}

vec4 noise(ivec2 p){
    return noise(ivec3(p, 0));
}

vec4 noise(int p){
 	return noise(ivec3(p, 0, 0));   
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    ivec4 p = ivec4(fragCoord.x, fragCoord.y, iMouse.x, iFrame);
    // test large inputs
    if(fragCoord.x > iResolution.x/2.)
        p += (1<<30);
    //test negative inputs
    if(fragCoord.y > iResolution.y/2.)
        p *= -1;
    
    if(u_mode == 1) {
      fragColor = noise(p.w);
    }
    else if(u_mode == 2) {
      fragColor = noise(p.xy-p.w);
    }
    else if(u_mode == 3) {
      fragColor = noise(ivec3(p.xy-p.w, p.z));
    }
    else {
      fragColor = noise(p);
    }
    
    //test channel correlations
    if(fragCoord.x > iResolution.x/2.)
        fragColor = fragColor.argb;
    if(fragCoord.y > iResolution.y/2.)
        fragColor = fragColor.argb;
}
`;

let gui: GUI;
const api = {
  u_mode: 1,
};

export default class implements iSub {
  key(): string {
    return '4tfyW4';
  }
  name(): string {
    return 'webgl2 grid noise';
  }
  sort() {
    return 79;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_mode', { x: 1, xy: 2, xyz: 3, xyzw: 4 });
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
    const u_mode = webglUtils.getUniformLocation(gl, program, 'u_mode');
    return () => {
      u_mode.uniform1i(api.u_mode);
    };
  }
}
