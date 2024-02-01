import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// New WebGL 2 version (252 chars)
//
#define t texture(iChannel0,p*.1,3.
void mainImage( out vec4 f, in vec2 p )
{
    vec4 q = p.xyxy/iResolution.y - .5, c=q-q;
    
    p.y = atan( q.x, q.y );
    
    for( float s=0.; s<.1; s+=.01 )
    {
        float x = length( q.xy ), z = 1.;
        
        for( ; z>0. && t).x<z ; z-=.01 )
            p.x = iTime*3. + s + 1./(x+x*z);

        f = c += t*x)*z*x*.2;
    }
    f.a = 1.;
}


// Original WebGL 1 version (273 chars)
//
/*
#define t texture(iChannel0,p*.1,3.
void mainImage( out vec4 f, in vec2 p )
{
    vec4 q = p.xyxy/iResolution.y - .5, c=q-q;
    
    for( float s=0.; s<.1; s+=.01 )
    {
        float x = length( q.xy ), z = 1.; p.y = atan( q.x, q.y );
        
        for( int i=0; i<99; i++ )
        {
            p.x = iTime*3. + s + 1./(x+x*z);
            if( t).x > z ) break;
            z -= .01;
        }

        f = c += t*x)*z*x*.2;
    }
}
*/
`;

export default class implements iSub {
  key(): string {
    return 'ltlGDN';
  }
  name(): string {
    return '[2TC 15] Cave';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 387;
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
    return [{ ...webglUtils.ROCK2_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
