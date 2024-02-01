import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// An illustration of the maths behind
// Oskar Stålberg's clever "every other texel is a line" technique as shown in this tweet of his:
// https://twitter.com/OskSta/status/1241096929490149376

// Note - I just did this from the tweet, I have not verified the maths is actually what Oskar is doing!

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    // Time-varying "line width" for illustration
    float width = fract ( iTime * 0.2 );
    width *= 1.5f;
    if ( width > 0.5 )
    {
        width = 1.0 - width;
    }
    width = max ( width, 0.05 );
    
    // Imagine a 16x16 texture (actually 32 texels - 16 big, 16 small)
    vec2 uvScale = uv * 16.0;
    
    vec2 uvFrac = fract(uvScale);
    vec2 uvWhole = uvScale-uvFrac;
    vec2 uvNewFrac;
    uvNewFrac.x = uvFrac.x > width ? 0.0 : 0.5;
    uvNewFrac.y = uvFrac.y > width ? 0.0 : 0.5;
    vec2 uvNew = uvWhole + uvNewFrac;
    
    // Scale down to 512x512 actual texture size.
    // The 2.0 is because each "pixel" is two texels - the "body" and the "line"
    uvNew *= ( 2.0 / 512.0 );
        
    vec4 col = texture ( iChannel0, uvNew );

    // Output to screen
    fragColor = vec4(col.xyz,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '3slcWN';
  }
  name(): string {
    return 'Oskar Stålberg every-other-pixel';
  }
  sort() {
    return 631;
  }
  webgl() {
    return WEBGL_2;
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
  channels() {
    return [
      webglUtils.TEXTURE3, //
    ];
  }
}
