import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Optimized AshimaSimplexNoise by @makio64
// Original : https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl

lowp vec4 permute(in lowp vec4 x){return mod(x*x*34.+x,289.);}
lowp float snoise(in mediump vec3 v){
  const lowp vec2 C = vec2(0.16666666666,0.33333333333);
  const lowp vec4 D = vec4(0,.5,1,2);
  lowp vec3 i  = floor(C.y*(v.x+v.y+v.z) + v);
  lowp vec3 x0 = C.x*(i.x+i.y+i.z) + (v - i);
  lowp vec3 g = step(x0.yzx, x0);
  lowp vec3 l = (1. - g).zxy;
  lowp vec3 i1 = min( g, l );
  lowp vec3 i2 = max( g, l );
  lowp vec3 x1 = x0 - i1 + C.x;
  lowp vec3 x2 = x0 - i2 + C.y;
  lowp vec3 x3 = x0 - D.yyy;
  i = mod(i,289.);
  lowp vec4 p = permute( permute( permute(
	  i.z + vec4(0., i1.z, i2.z, 1.))
	+ i.y + vec4(0., i1.y, i2.y, 1.))
	+ i.x + vec4(0., i1.x, i2.x, 1.));
  lowp vec3 ns = .142857142857 * D.wyz - D.xzx;
  lowp vec4 j = -49. * floor(p * ns.z * ns.z) + p;
  lowp vec4 x_ = floor(j * ns.z);
  lowp vec4 x = x_ * ns.x + ns.yyyy;
  lowp vec4 y = floor(j - 7. * x_ ) * ns.x + ns.yyyy;
  lowp vec4 h = 1. - abs(x) - abs(y);
  lowp vec4 b0 = vec4( x.xy, y.xy );
  lowp vec4 b1 = vec4( x.zw, y.zw );
  lowp vec4 sh = -step(h, vec4(0));
  lowp vec4 a0 = b0.xzyw + (floor(b0)*2.+ 1.).xzyw*sh.xxyy;
  lowp vec4 a1 = b1.xzyw + (floor(b1)*2.+ 1.).xzyw*sh.zzww;
  lowp vec3 p0 = vec3(a0.xy,h.x);
  lowp vec3 p1 = vec3(a0.zw,h.y);
  lowp vec3 p2 = vec3(a1.xy,h.z);
  lowp vec3 p3 = vec3(a1.zw,h.w);
  lowp vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  lowp vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  return .5 + 12. * dot( m * m * m, vec4( dot(p0,x0), dot(p1,x1),dot(p2,x2), dot(p3,x3) ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 pos = uv;
    if(uv.x < .5){
        pos*=20.;
    } else {
        pos*=0.5;
    }
    if(uv.y < .5){
        pos*=5.;
    } else {
        pos*=20.;
    }
    float noise = snoise(vec3(-pos.x,pos.y,0.5*iTime));
	fragColor = vec4(vec3(noise),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'Xd3GRf';
  }
  name(): string {
    return 'Optimized Ashima SimplexNoise3D';
  }
  sort() {
    return 572;
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
