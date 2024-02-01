import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    // Get base color from image in iChannel0
    vec3 col = texture(iChannel0, uv).rgb;
    vec3 c1 = col;
    
    
    
    // Setup Outlines
    const vec3 LUMCOEFFS = vec3(0.2125, 0.7154, 0.0721);
    
    float resS = iChannelResolution[0].x;
    float resT = iChannelResolution[0].y;
    
    // Get handles to the fragments surrounding current fragment
    vec2 stp0 = vec2(1./resS);
    vec2 st0p = vec2(0.,resT);
    vec2 stpp = vec2(1./resS, 1./resT);
    vec2 stpm = vec2(1./resS, -1./resT);
    // Build sobel convolutions
    float i00 = dot(texture(iChannel0, uv).rgb, LUMCOEFFS);
    float im1m1 = dot(texture(iChannel0, uv-stpp).rgb, LUMCOEFFS);
    float ip1p1 = dot(texture(iChannel0, uv+stpp).rgb, LUMCOEFFS);
    float im1p1 = dot(texture(iChannel0, uv-stpm).rgb, LUMCOEFFS);
    float ip1m1 = dot(texture(iChannel0, uv+stpm).rgb, LUMCOEFFS);
        
    float im10 = dot(texture(iChannel0, uv-stp0).rgb, LUMCOEFFS);
    float ip10 = dot(texture(iChannel0, uv+stp0).rgb, LUMCOEFFS);
    float i0m1 = dot(texture(iChannel0, uv-st0p).rgb, LUMCOEFFS);
    float i0p1 = dot(texture(iChannel0, uv+st0p).rgb, LUMCOEFFS);
    
    float h = -1.*im1p1 - 2.*i0p1 - 1.*ip1p1 + 1.*im1m1 + 2.*i0m1 + 1.*ip1m1;
    float v = -1.*im1m1 - 2.*im10 - 1.*im1p1 + 1.*ip1m1 + 2.*ip10 + 1.*ip1p1;
    float mag = sqrt(h*h + v*v);
    
    float magTol = 0.3125;
    
    // Draw outlines
    if(mag > magTol)
    {
        col = vec3(0., 0., 0.);
    }
    else
    {
        // Quantize the colors
        float q = 10.;
        col.rgb *= q;
        col.rgb += vec3(.5, .5, .5);
        ivec3 icol = ivec3(col.rgb);
        col.rgb = vec3(icol) / q;
    }
    
    col = mix(c1, col, sin(fract(iTime*.1) * 2. * 3.14159)*.5 + .5);
    
    // Output to screen
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'WttBD8';
  }
  name(): string {
    return 'Toon Shader';
  }
  sort() {
    return 637;
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
  channels() {
    return [
      // webglUtils.TEXTURE11, //
      { type: 0, path: './textures/XdlGzH.jpg' },
    ];
  }
}
