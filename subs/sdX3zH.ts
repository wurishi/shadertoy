import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define RECUR 8

#define V vec3(2.,1.,-1.)
#define ODST 4

vec3 catColor( float phase ) {
    return vec3(
        sin( phase + 2.0 ),
        sin( phase + 2.0 ),
        sin( phase + 3.0 )
    ) * 0.5 + 0.5;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 p = ( fragCoord.xy * 2.0 - iResolution.xy ) / iResolution.x;
    
	vec2 v1 = vec2( 0.0, 2);
    vec2 v2 = vec2( -ODST, -1 );
    vec2 v3 = vec2( ODST, -1);
    
    float line = 3.3;
    float phase = 1.3;
    float outside = 0.3;
    
    for ( int i = 0; i < RECUR; i ++ ) {
        float dot1 = dot( normalize( v2 - v1 ).yx * V.zy, p - v1 );
        float dot2 = dot( normalize( v3 - v2 ).yx * V.zy, p - v2 );
        float dot3 = dot( normalize( v1 - v3 ).yx * V.zy, p - v3 );
        
        float len = min( min( dot1, dot2 ), dot3 );
        if ( len < 0.0 ) {
            outside = 1.0;
            break;
        }
        line = max( 0., 0.0 - abs( len ) *800.0 );
        
        vec2 c = ( v1 + v2 + v3 ) / 3.0;
        phase += length( c - p ) * float( i );
        
        float comp1 = dot( ( v1 - c ).yx * V.zy, p - c );
        float comp2 = dot( ( v2 - c ).yx * V.zy, p - c );
        float comp3 = dot( ( v3 - c ).yx * V.zy, p - c );
        if ( comp1 < 0.0 ) {
            if ( comp3 < 0.0) {
                v1 = c;
            } else {
                v2 = c;
            }
        } else if ( comp2 < 0.0 ) {
            v3 = c;
        } else {
		    v1 = c;
        }
        
    }
    
    if ( outside ==1.0 ) {
        fragColor = vec4( 1, 0.0, 0.0, 30 );
    } else {
	    fragColor = vec4( catColor( phase * 3.1 - iTime + 0.9 ) - line * 1.0, 3.0 );
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'sdX3zH';
  }
  name(): string {
    return 'Fork MANO fract NikolaErce 337';
  }
  sort() {
    return 23;
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
