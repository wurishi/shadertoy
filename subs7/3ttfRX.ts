import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `#define R iResolution.xy
#define T(u) texture(iChannel0, (u)/R)

mat3 getOrthBas( vec3 dir){
  vec3 r = normalize(cross(vec3(0,1,0), dir));
  vec3 u = normalize(cross( dir, r));
  return mat3(r,u,dir);
  }

float cyclicNoise(vec3 p){
  float n = 0.;
  p *= getOrthBas(normalize(vec3(-4,2.,-2. + sin(iTime)*1.4)));
  float lac = 1.5;
  float amp = 1.;
  float gain = 0.5;
  
  mat3 r = getOrthBas(normalize(vec3(-4,2.,-2)));
  

  for(int i = 0; i < 8; i++){
    p += cos(p + 2. + vec3(0,0,iTime))*0.5;
    n += dot(sin(p),cos(p.zxy + vec3(0,0,iTime)))*amp;
    
    p *= r*lac;
    amp *= gain;
    }
    return n;
  }



void mainImage( out vec4 out_color, in vec2 U )
{
  #define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
  
  U -= 0.5*R;
  //U *= rot(iTime*0.01);
  U *= 0.99 + sin(iTime)*0.00 - dot(U/R,U/R)*0.05*sin(iTime);
  U += 0.5*R;
  out_color = T(U);
  #define getGrad(axis) vec2(e[axis]-w[axis],n[axis]-s[axis])
  float offs = 20. + sin(iTime + length((U - 0.5*R)/R.y)*1.5)*30.;
  offs *= 0.5;
  vec4 n = T(U + vec2(0,1)*offs);
  vec4 s = T(U + vec2(0,-1)*offs);
  vec4 e = T(U + vec2(1,0)*offs);
  vec4 w = T(U + vec2(-1,0)*offs);
  
  vec2 grad = getGrad(0 + int(mod(float(iFrame)/4.,2.)));
  
  float noisb = cyclicNoise(vec3(U/R*5.,1. + iTime*0.2 + sin(iTime)*1.));
  
  grad *= rot(noisb*0.2*sin(iTime) - iTime*0.);
  vec2 uu = U;
  uu += grad*22. + noisb*1.;
  out_color = T(uu);
  n = T(uu + vec2(0,1));
  s = T(uu + vec2(0,-1));
  e = T(uu + vec2(1,0));
  w = T(uu + vec2(-1,0));
  
  #define pal(a,b,c,d,e) ((a) + (b)*sin((c)*(d) + (e)))
  
  float nois = cyclicNoise(vec3(uu/R*80.,1. + iTime*0.2 + sin(iTime)*1.));
  
  vec3 nc = nois*pal(0.5,vec3(1.,0.2,1.),1.,vec3(3.,0. + nois*20.,4. + sin(iTime) + 2.),nois*10. + iTime);
  out_color = mix(out_color,vec4(max(nc,0.),1),0.01);
  //out_color += cyclicNoise(vec3(uv*20.,1));
  if(iTime < 0.4){
    out_color = vec4(0);
  }
}`;

const fragment = `

void mainImage( out vec4 out_color, in vec2 fragCoord )
{
	out_color = texture(iChannel0,fragCoord/iResolution.xy);
  
}
`;

export default class implements iSub {
    key(): string {
        return '3ttfRX';
    }
    name(): string {
        return 'OMZG shader royale';
    }
    // sort() {
    //     return 0;
    // }
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
    channels() {
        return [{ type: 1, f: buffA, fi: 0 }];
    }
    webgl() {
        return WEBGL_2;
    }
}
