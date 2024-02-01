import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Created by inigo quilez - iq/2014
//   https://www.youtube.com/c/InigoQuilez
//   https://iquilezles.org/
// I share this piece (art and code) here in Shadertoy and through its Public API, only for educational purposes. 
// You cannot use, sell, share or host this piece or modifications of it as part of your own commercial or non-commercial product, website or project.
// You can share a link to it or an unmodified screenshot of it provided you attribute "by Inigo Quilez, @iquilezles and iquilezles.org". 
// If you are a teacher, lecturer, educator or similar and these conditions are too restrictive for your needs, please contact me and we'll work it out.

#define HSAMPLES 128
#define MSAMPLES   8

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 ran = texture( iChannel1, iTime*vec2(0.11,0.23)+fragCoord/iChannelResolution[1].xy ) - 0.5;

	vec2  p = (2.0*(fragCoord+ran.xy)-iResolution.xy)/iResolution.y;
    float t =  iTime + 10.0*iMouse.x/iResolution.x;
    float dof = dot( p, p );

    vec3 tot = vec3(0.0);
    for( int j=0; j<MSAMPLES; j++ )
    {
        // animate
        float msa = (float(j)+ran.z)/float(MSAMPLES);
        float tim = t + 0.5*(1.0/24.0)*(float(j)+ran.w)/float(MSAMPLES);
        vec2  off = vec2( 0.2*tim, 0.2*sin(tim*0.2) );

        // deform into cylinder 	
	    vec2 q = p + dof*0.04*msa*vec2(cos(15.7*msa),sin(15.7*msa));
        vec2 r = vec2( length(q), 0.5+0.5*atan(q.y,q.x)/3.1415927 );

        // stack layers ("intersect")
        vec3 uv;
        for( int i=0; i<HSAMPLES; i++ )
        {
            uv.z = (float(i)+ran.x)/float(HSAMPLES-1);
            uv.xy = off + vec2( 0.2/(r.x*(1.0-0.6*uv.z)), r.y );
            if( textureLod( iChannel0, uv.xy, 0.0 ).x < uv.z )
                break;
        }
    
        // shading
        float dif = clamp( 8.0*(textureLod(iChannel0, uv.xy, 0.0).x - textureLod(iChannel0, uv.xy+vec2(0.02,0.0), 0.0).x), 0.0, 1.0 );
        vec3  col = vec3(1.0);
        col *= 1.0-textureLod( iChannel0, 1.0*uv.xy, 0.0 ).xyz;
        col = mix( col*1.2, 1.5*textureLod( iChannel0, vec2(uv.x*0.4,0.1*sin(2.0*uv.y*3.1316)), 0.0 ).yzx, 1.0-0.7*col );
        col = mix( col, vec3(0.2,0.1,0.1), 0.5-0.5*smoothstep( 0.0, 0.3, 0.3-0.8*uv.z + texture( iChannel0, 2.0*uv.xy + uv.z ).x ) );      
        col *= 1.0-1.3*uv.z;
        col *= 1.3-0.2*dif;        
        col *= exp(-0.35/(0.0001+r.x));
        
        tot += col;
    }
    tot /= float(MSAMPLES);
 
    // color correct
    tot.x += 0.05;
    tot = 1.05*pow( tot, vec3(0.6,1.0,1.0) );
    
    fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
    key(): string {
        return 'XdBSzd';
    }
    name(): string {
        return 'Tissue';
    }
    sort() {
        return 723;
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
            webglUtils.TEXTURE6,
            webglUtils.DEFAULT_NOISE, //
        ];
    }
}
