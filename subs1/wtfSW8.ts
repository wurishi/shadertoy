import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float innerh = .17;
const float PI = 3.14159;

vec3 dtoa(vec3  d, float amount){
    vec3 a = clamp(1.0 / (clamp(d, 1.0/amount, 1.0)*amount), 0.,1.);
    return a;
}
mat2 rot2D(float r){
    return mat2(cos(r), sin(r), -sin(r), cos(r));
}
float nsin(float x) { return sin(x)*.5+.5;}

void mainImage( out vec4 O, in vec2 P)
{
    float t = iTime + 100.;
    vec2 R = iResolution.xy;
    P -= R*.5;// center at origin
    vec2 uv = P / R.y;// aspect correct uv
    
    float ang = atan(uv.x, uv.y);
    // find a base height around the circle
    float h = 0.;
    float f = 1.;
    for (float i = 0.; i < 5.; ++ i) {
        h += nsin((ang+f)*i + t*f*.1);
        f *= -1.37;
    }
    h = h*h;
    
    // find ind height for 3 separate components
    vec3 h3 = h + .4*sin(t*vec3(1.,1.44,1.77) + ang*4.);
    vec3 d3 = length(uv) - innerh - h3*.02; // distance
    d3 = max(d3, -(length(uv) - innerh - h3 * .011));// donut
    d3 = min(d3, length(uv) - h3*0.01); // center

    vec2 shuv = uv+.06;
    vec3 dsh = length(shuv) - innerh - h3*.02; // distance
    dsh = max(dsh, -(length(shuv) - innerh - h3 * .011));// donut
    dsh = min(dsh, length(shuv) - h3*0.01); // center
    vec3 ash = dtoa(dsh, 30.)*.2;

    O = vec4(1);
    O *= 1.-min(ash.r, min(ash.g, ash.b));
    vec3 a3 = dtoa(d3, 30.);
    a3.rg *= rot2D(iTime*.4);
    a3 = clamp(a3,0.,1.);
    O.rgb = mix(O.rgb, a3, a3);
    O.rgb = mix(vec3(O.r+O.g+O.b)/3.,O.rgb,.5);
    vec2 N = P/R;
    O = pow(O, vec4(4.));
    O *= 1.-dot(N,N);
    O += (fract(sin(dot(R+t,N))*1e5)-.5)*.05;
    O.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'wtfSW8';
  }
  name(): string {
    return 'Donuts can be beautiful too';
  }
  sort() {
    return 158;
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
