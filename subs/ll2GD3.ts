import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_texture;
vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy;
    
    // animate
    p.x += 0.01*iTime;
    
    // compute colors
    vec3                col = pal( p.x, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
    if( p.y>(1.0/7.0) ) col = pal( p.x, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.10,0.20) );
    if( p.y>(2.0/7.0) ) col = pal( p.x, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.3,0.20,0.20) );
    if( p.y>(3.0/7.0) ) col = pal( p.x, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,0.5),vec3(0.8,0.90,0.30) );
    if( p.y>(4.0/7.0) ) col = pal( p.x, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,0.7,0.4),vec3(0.0,0.15,0.20) );
    if( p.y>(5.0/7.0) ) col = pal( p.x, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(2.0,1.0,0.0),vec3(0.5,0.20,0.25) );
    if( p.y>(6.0/7.0) ) col = pal( p.x, vec3(0.8,0.5,0.4),vec3(0.2,0.4,0.2),vec3(2.0,1.0,1.0),vec3(0.0,0.25,0.25) );
    

    // band
    float f = fract(p.y*7.0);
    // borders
    col *= smoothstep( 0.49, 0.47, abs(f-0.5) );
    // shadowing
    col *= 0.5 + 0.5*sqrt(4.0*f*(1.0-f));
    // dithering
    if(u_texture) {
      col += (1.0/255.0)*texture( iChannel0, fragCoord.xy/iChannelResolution[0].xy ).xyz;
    }
    else {
      col += texture( iChannel0, fragCoord.xy/iChannelResolution[0].xy ).xyz;
    }
    

	fragColor = vec4( col, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_texture: true,
};

export default class implements iSub {
  key(): string {
    return 'll2GD3';
  }
  name(): string {
    return 'Palettes';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 76;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_texture');
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
    const u_texture = webglUtils.getUniformLocation(gl, program, 'u_texture');
    return () => {
      u_texture.uniform1i(api.u_texture ? 1 : 0);
    };
  }
  channels() {
    return [
      {
        type: 0,
        path: './textures/noise.png',
      },
    ];
  }
}
