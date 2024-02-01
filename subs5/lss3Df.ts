import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Created by inigo quilez - iq/2013
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define NUM 9.0

float noise( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = fract(x);
	vec2 uv = p.xy + f.xy*f.xy*(3.0-2.0*f.xy);
	return textureLod( iChannel1, (uv+0.5)/256.0, 0.0 ).x;
}

float map( in vec2 x, float t )
{
    return noise( 2.5*x - 1.5*t*vec2(1.0,0.0) );
}


float shapes( in vec2 uv, in float r, in float e )
{
	float p = pow( 32.0, r - 0.5 );
	float l = pow( pow(abs(uv.x),p) + pow(abs(uv.y),p), 1.0/p );
	float d = l - pow(r,0.6) - e*0.2 + 0.05;
	float fw = fwidth( d )*0.5;
	fw *= 1.0 + 10.0*e;
	return (r)*smoothstep( fw, -fw, d ) * (1.0-0.2*e)*(0.4 + 0.6*smoothstep( -fw, fw, abs(l-r*0.8+0.05)-0.1 ));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 qq = fragCoord.xy/iResolution.xy;
	vec2 uv = fragCoord.xy/iResolution.xx;
	
	float time = 11.0 + (iTime + 0.8*sin(iTime)) / 1.8;
	
	uv += 0.01*noise( 2.0*uv + 0.2*time );
	
    vec3 col = 0.0*vec3(1.0) * 0.15 * abs(qq.y-0.5);
	
	vec2 pq, st; float f; vec3 coo;
	
    // grey	
    pq = floor( uv*NUM ) / NUM;
	st = fract( uv*NUM )*2.0 - 1.0;
	coo = (vec3(0.5,0.7,0.7) + 0.3*sin(10.0*pq.x)*sin(13.0*pq.y))*0.6;
	col += 1.0*coo*shapes( st, map(pq, time), 0.0 );
	col += 0.6*coo*shapes( st, map(pq, time), 1.0 );

	// orange
    pq = floor( uv*NUM+0.5 ) / NUM;
	st = fract( uv*NUM+0.5 )*2.0 - 1.0;
    coo = (vec3(1.0,0.5,0.3) + 0.3*sin(10.0*pq.y)*cos(11.0*pq.x))*1.0;
	col += 1.0*coo*shapes( st, 1.0-map(pq, time), 0.0 );
	col += 0.4*coo*shapes( st, 1.0-map(pq, time), 1.0 );

	col *= pow( 16.0*qq.x*qq.y*(1.0-qq.x)*(1.0-qq.y), 0.05 );
	
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'lss3Df';
  }
  name(): string {
    return 'Circle pattern';
  }
  sort() {
    return 531;
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
      { type: 3 },
      { ...webglUtils.DEFAULT_NOISE_BW, ...webglUtils.TEXTURE_MIPMAPS }, //
    ];
  }
}
