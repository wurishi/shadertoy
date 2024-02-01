import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord.xy / iResolution.x;
    vec2 uv = p*0.1;	
	
    //---------------------------------------------	
	// regular texture map filtering
    //---------------------------------------------	
	vec3 colA = texture( iChannel0, uv ).xyz;

    //---------------------------------------------	
	// my own filtering 
    //---------------------------------------------	
	float textureResolution = 64.0;
	uv = uv*textureResolution + 0.5;
	vec2 iuv = floor( uv );
	vec2 fuv = fract( uv );
	uv = iuv + fuv*fuv*(3.0-2.0*fuv); // fuv*fuv*fuv*(fuv*(fuv*6.0-15.0)+10.0);;
	uv = (uv - 0.5)/textureResolution;
	vec3 colB = texture( iChannel0, uv ).xyz;
	
    //---------------------------------------------	
    // mix between the two colors
    //---------------------------------------------	
	float f = sin(3.14*p.x + 0.7*iTime);
	vec3 col = mix( colA, colB, smoothstep( -0.1, 0.1, f ) );
	col *= smoothstep( 0.0, 0.01, abs(f-0.0) );
	
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'XsfGDn';
  }
  name(): string {
    return 'Texture - Better Filtering';
  }
  sort() {
    return 134;
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
      {
        ...webglUtils.DEFAULT_NOISE3,
        [WebGLRenderingContext.TEXTURE_MIN_FILTER]:
          WebGLRenderingContext.LINEAR,
        [WebGLRenderingContext.TEXTURE_MAG_FILTER]:
          WebGLRenderingContext.LINEAR,
      },
    ];
  }
}
