import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Maximum number of cells a ripple can cross.
uniform int u_max_radius;

// Set to 1 to hash twice. Slower, but less patterns.
uniform bool u_double_hash;

#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * HASHSCALE3);
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.xx+p3.yz)*p3.zy);

}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float resolution = 10. * exp2(-3.*iMouse.x/iResolution.x);
	vec2 uv = fragCoord.xy / iResolution.y * resolution;
    vec2 p0 = floor(uv);

    vec2 circles = vec2(0.);
    for (int j = -u_max_radius; j <= u_max_radius; ++j)
    {
        for (int i = -u_max_radius; i <= u_max_radius; ++i)
        {
			      vec2 pi = p0 + vec2(i, j);
            vec2 hsh;
            if(u_double_hash) {
              hsh = hash22(pi);
            }
            else {
              hsh = pi;
            }
            vec2 p = pi + hash22(hsh);

            float t = fract(0.3*iTime + hash12(hsh));
            vec2 v = p - uv;
            float d = length(v) - (float(u_max_radius) + 1.)*t;

            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            float p1 = sin(31.*d1) * smoothstep(-0.6, -0.3, d1) * smoothstep(0., -0.3, d1);
            float p2 = sin(31.*d2) * smoothstep(-0.6, -0.3, d2) * smoothstep(0., -0.3, d2);
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
        }
    }
    circles /= float((u_max_radius*2+1)*(u_max_radius*2+1));

    float intensity = mix(0.01, 0.15, smoothstep(0.1, 0.6, abs(fract(0.05*iTime + 0.5)*2.-1.)));
    vec3 n = vec3(circles, sqrt(1. - dot(circles, circles)));
    vec3 color = texture(iChannel0, uv/resolution - intensity*n.xy).rgb + 5.*pow(clamp(dot(n, normalize(vec3(1., 0.7, 0.5))), 0., 1.), 6.);
	fragColor = vec4(color, 1.0);
}
`;

let gui: GUI;
const api = {
  u_max_radius: 2,
  u_double_hash: false,
};

export default class implements iSub {
  key(): string {
    return 'ldfyzl';
  }
  name(): string {
    return 'Rainier mood';
  }
  sort() {
    return 133;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_max_radius', 1, 10, 1);
    gui.add(api, 'u_double_hash');
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
    const u_max_radius = webglUtils.getUniformLocation(
      gl,
      program,
      'u_max_radius'
    );
    const u_double_hash = webglUtils.getUniformLocation(
      gl,
      program,
      'u_double_hash'
    );
    return () => {
      u_max_radius.uniform1i(api.u_max_radius);
      u_double_hash.uniform1i(api.u_double_hash ? 1 : 0);
    };
  }
  channels() {
    return [webglUtils.TEXTURE6];
  }
}
