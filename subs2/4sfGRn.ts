import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Created by inigo quilez - iq/2013
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

vec3 deform( in vec2 p )
{
    float time = 0.5*iTime;
    
    vec2 q = sin( vec2(1.1,1.2)*time + p );

    float a = atan( q.y, q.x );
    float r = sqrt( dot(q,q) );

    vec2 uv = p*sqrt(1.0+r*r);
    uv += sin( vec2(0.0,0.6) + vec2(1.0,1.1)*time);
         
    return texture( iChannel0, uv*0.3).yxx;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = -1.0 + 2.0*fragCoord/iResolution.xy;

    vec3  col = vec3(0.0);
    vec2  d = (vec2(0.0,0.0)-p)/64.0;
    float w = 1.0;
    vec2  s = p;
    for( int i=0; i<64; i++ )
    {
        vec3 res = deform( s );
        col += w*smoothstep( 0.0, 1.0, res );
        w *= .99;
        s += d;
    }
    col = col * 3.5 / 64.0;

	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4sfGRn';
  }
  name(): string {
    return 'Radial Blur';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 255;
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
    return [webglUtils.TEXTURE6];
  }
}
