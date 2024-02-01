import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform int u_map;
uniform bool u_mode;

float map(vec3 p)
{
  if(u_mode) {
    p += sin(p.zxy*3.36) * 0.44;
    p += 0.5 * sin(p.zxy*3.36) * 0.44;
  }
  else {
    p = mod(p,5.) - 2.5;
  }
  if(u_map == 0) {
    return length(p) - 2.;
  }
  else if(u_map == 1) {
    return max(abs(p.x), max(abs(p.y), abs(p.z))) - 2.;
  }
  else {
    return max(abs(max(abs(p.x)+p.y,-p.y))+p.z,-p.z) - 2.;
  }
    //float t = sin(iTime * 0.5);
}

void mainImage( out vec4 f, in vec2 g )
{
    vec2 si = iResolution.xy;
   	float t = iTime * .2;

    float cd = 6.;
    
   	vec3 ro = vec3(cos(t)*cd, 3., sin(t)*cd);
    vec3 rov = normalize(vec3(0,0,0)-ro);
    vec3 u =  normalize(cross(vec3(0,1,0), rov));
    vec3 v =  cross(rov, u);
    vec2 uv = (g+g-si)/min(si.x, si.y);
    vec3 rd = mat3(u,v,rov) * vec3(uv, 1);
    
    float accum = 0.0;

    float d = 0.;
    float s = 1.;
    for(int i=0;i<200;i++)
    {      
		if(s<0.01||d>80.) break;
        s = map(ro + rd * d);
        
        s = max(abs(s), 0.02);  // Phantom Mode
        
        d += s * 0.5;
        
       	accum += 0.005; // Phantom Mode
   	}

    f = vec4(0, 0, 0, 1) + accum  * (1.0-exp(-0.001*d*d)); // Phantom Mode
}
`;

let gui: GUI;
const api = {
  u_mode: false,
  u_map: 0,
};

export default class implements iSub {
  key(): string {
    return 'MtScWW';
  }
  name(): string {
    return 'Phantom Mode';
  }
  sort() {
    return 75;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_mode');
    gui.add(api, 'u_map', [0, 1, 2]);
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
    const u_map = webglUtils.getUniformLocation(gl, program, 'u_map');
    return () => {
      u_mode.uniform1i(api.u_mode ? 1 : 0);
      u_map.uniform1i(api.u_map);
    };
  }
}
