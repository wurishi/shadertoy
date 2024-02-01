import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffB = `
//
// A simple water effect by Tom@2016
//
// based on PolyCube version:
//    http://polycu.be/edit/?h=W2L7zN
//

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
   vec3 e = vec3(vec2(1.)/iResolution.xy,0.);
   vec2 q = fragCoord.xy/iResolution.xy;
   
   vec4 c = texture(iChannel0, q);
   
   float p11 = c.x;
   
   float p10 = texture(iChannel1, q-e.zy).x;
   float p01 = texture(iChannel1, q-e.xz).x;
   float p21 = texture(iChannel1, q+e.xz).x;
   float p12 = texture(iChannel1, q+e.zy).x;
   
   float d = 0.;
    
   if (iMouse.z > 0.) 
   {
      // Mouse interaction:
      d = smoothstep(4.5,.5,length(iMouse.xy - fragCoord.xy));
   }
   else
   {
      // Simulate rain drops
      float t = iTime*2.;
      vec2 pos = fract(floor(t)*vec2(0.456665,0.708618))*iResolution.xy;
      float amp = 1.-step(.05,fract(t));
      d = -amp*smoothstep(2.5,.5,length(pos - fragCoord.xy));
   }

   // The actual propagation:
   d += -(p11-.5)*2. + (p10 + p01 + p21 + p12 - 2.);
   d *= .99; // dampening
   d *= min(1.,float(iFrame)); // clear the buffer at iFrame == 0
   d = d*.5 + .5;
   
   fragColor = vec4(d, 0, 0, 0);
}
`;

const buffA = `
//
// A simple water effect by Tom@2016
//
// based on PolyCube version:
//    http://polycu.be/edit/?h=W2L7zN
//

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
   vec3 e = vec3(vec2(1.)/iResolution.xy,0.);
   vec2 q = fragCoord.xy/iResolution.xy;
   
   vec4 c = texture(iChannel1, q);
   
   float p11 = c.x;
   
   float p10 = texture(iChannel0, q-e.zy).x;
   float p01 = texture(iChannel0, q-e.xz).x;
   float p21 = texture(iChannel0, q+e.xz).x;
   float p12 = texture(iChannel0, q+e.zy).x;
   
   float d = 0.;
    
   if (iMouse.z > 0.) 
   {
      // Mouse interaction:
      d = smoothstep(4.5,.5,length(iMouse.xy - fragCoord.xy));
   }
   else
   {
      // Simulate rain drops
      float t = iTime*2.;
      vec2 pos = fract(floor(t)*vec2(0.456665,0.708618))*iResolution.xy;
      float amp = 1.-step(.05,fract(t));
      d = -amp*smoothstep(2.5,.5,length(pos - fragCoord.xy));
   }

   // The actual propagation:
   d += -(p11-.5)*2. + (p10 + p01 + p21 + p12 - 2.);
   d *= .99; // dampening
   d *= min(1.,float(iFrame)); // clear the buffer at iFrame == 0
   d = d*.5 + .5;
   
   fragColor = vec4(d, 0, 0, 0);
}

`;

const fragment = `
//
// A simple water effect by Tom@2016
//
// based on PolyCube version:
//    http://polycu.be/edit/?h=W2L7zN
//
// As people give me too much credit for this one,
// it's based on: http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
// A very old Hugo Elias water tutorial :)
//
// Note:
//   I could use one buffer only as in https://www.shadertoy.com/view/4sd3WB
//   with a clever trick to utilize two channels
//   and keep buffer A in x/r and buffer B in y/g.
//   However, now I render every second simulation step,
//   so the animation is more dynamic.
//
// Here is 1-buffer version for comparison:
//   https://www.shadertoy.com/view/4dK3Ww
//

#define TEXTURED 1

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy/iResolution.xy;

#if TEXTURED == 1
    
    vec3 e = vec3(vec2(1.)/iResolution.xy,0.);
    float p10 = texture(iChannel1, q-e.zy).x;
    float p01 = texture(iChannel1, q-e.xz).x;
    float p21 = texture(iChannel1, q+e.xz).x;
    float p12 = texture(iChannel1, q+e.zy).x;
    
    // Totally fake displacement and shading:
    vec3 grad = normalize(vec3(p21 - p01, p12 - p10, 1.));
    vec4 c = texture(iChannel2, fragCoord.xy*2./iChannelResolution[1].xy + grad.xy*.35);
    vec3 light = normalize(vec3(.2,-.5,.7));
    float diffuse = dot(grad,light);
    float spec = pow(max(0.,-reflect(light,grad).z),32.);
    fragColor = mix(c,vec4(.7,.8,1.,1.),.25)*max(diffuse,0.) + spec;
    
#else
    
    float h = texture(iChannel1, q).x;
    float sh = 1.35 - h*2.;
    vec3 c =
       vec3(exp(pow(sh-.75,2.)*-10.),
            exp(pow(sh-.50,2.)*-20.),
            exp(pow(sh-.25,2.)*-10.));
    fragColor = vec4(c,1.);

#endif
fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'Xsd3DB';
  }
  name(): string {
    return 'Wave Propagation Effect';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
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
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [
      { type: 1, f: buffB, fi: 0 }, //
      { type: 1, f: buffA, fi: 1 }, //
      webglUtils.TEXTURE7,
    ];
  }
}
