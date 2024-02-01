import { GUI } from 'dat.gui'
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs'
import * as webglUtils from '../webgl-utils'

const fragment = `
// The MIT License
// Copyright © 2016 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


float hash1( vec2 p ) { float n = dot(p,vec2(127.1,311.7)); return fract(sin(n)*153.4353); }

float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
	vec2 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h );
}

vec4 getParticle( vec2 id )
{
    return texture( iChannel0, (id+0.5)/iResolution.xy );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.y;
    
    vec3 f = vec3(0.0);
    for( int j=0; j<10; j++ )
    for( int i=0; i<10; i++ )
    {
        vec2 id = vec2( float(i), float(j) );
        vec4 p = getParticle( id );

        float d = 1.0;
        
        #if 1
        if( i<9 )        d = min(d, sdSegment( uv, p.xy, getParticle( id+vec2(1.0,0.0) ).xy ));
        if( j<9 )        d = min(d, sdSegment( uv, p.xy, getParticle( id+vec2(0.0,1.0) ).xy ) );
        if( i<9 && j<9 ) d = min(d, sdSegment( uv, p.xy, getParticle( id+vec2(1.0,1.0) ).xy ));
        if( i>0 && j<9 ) d = min(d, sdSegment( uv, p.xy, getParticle( id+vec2(-1.0,1.0) ).xy ) );
        f = mix( f, vec3(0.4,0.6,0.8), 1.0-smoothstep( 0.0, 0.005, d ) );
        #endif
        
        d = length(uv-p.xy)-0.035;
        vec3 col = 0.6 + 0.4*sin( hash1(id)*30.0 + vec3(0.0,1.0,2.0) );
        col *= 0.8 + 0.2*smoothstep( -0.1, 0.1, sin(d*400.0) );
        f = mix( f, col, 1.0-smoothstep( -0.001, 0.001, d ) );
            
    }
    
    fragColor = vec4(f,1.0);
}
`

const buffA = `
float hash1( vec2  p ) { float n = dot(p,vec2(127.1,311.7)); return fract(sin(n)*43758.5453); }

vec4 getParticle( vec2 id )
{
    return texture( iChannel0, (id+0.5)/iResolution.xy);
}

vec4 react( in vec4 p, in vec2 qid, float rl )
{
    vec4 q = getParticle( qid );
    
    vec2 di = q.xy - p.xy;
    
    float l = length(di);
    
    p.xy += 0.1*(l-rl)*(di/l);
    
    return p;
}

vec4 solveContrainsts( in vec2 id, in vec4 p )
{
    if( id.x > 0.5 )  p = react( p, id + vec2(-1.0, 0.0), 0.1 );
    if( id.x < 8.5 )  p = react( p, id + vec2( 1.0, 0.0), 0.1 );
    if( id.y > 0.5 )  p = react( p, id + vec2( 0.0,-1.0), 0.1 );
    if( id.y < 8.5 )  p = react( p, id + vec2( 0.0, 1.0), 0.1 );

    if( id.x > 0.5 && id.y > 0.5)  p = react( p, id + vec2(-1.0, -1.0), 0.14142 );
    if( id.x > 0.5 && id.y < 8.5)  p = react( p, id + vec2(-1.0,  1.0), 0.14142 );
    if( id.x < 8.5 && id.y > 0.5)  p = react( p, id + vec2( 1.0, -1.0), 0.14142 );
    if( id.x < 8.5 && id.y < 8.5)  p = react( p, id + vec2( 1.0,  1.0), 0.14142 );

    return p;
}    

vec4 move( in vec4 p, in vec2 id )
{
    const float g = 0.6;

    // acceleration
    p.xy += iTimeDelta*iTimeDelta*vec2(0.0,-g);
    

    // colide screen
    if( p.x< 0.00 ) p.x = 0.00;
    if( p.x> 1.77 ) p.x = 1.77;
    if( p.y< 0.00 ) p.y = 0.00;        
    if( p.y> 1.00 ) p.y = 1.00;

    // constrains
    p = solveContrainsts( id, p );
        
    #if 1
    if( id.y > 8.5 ) p.xy = 0.05 + 0.1*id;
    #endif
    
    // innertia
    vec2 np = 2.0*p.xy - p.zw;
    p.zw = p.xy;
    p.xy = np;

    return p;
}




void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 id = floor( fragCoord-0.4 );
    
    if( id.x>9.5 || id.y>9.5 ) discard;
    
    vec4 p = getParticle(id);
    
    if( iFrame==0 )
    {
        p.xy = 0.05 + id*0.1;
        p.zw = p.xy - 0.01*vec2(0.5+0.5*hash1(id),0.0);
    }
    else
    {
    	p = move( p, id );
    }

    fragColor = p;
}`

export default class implements iSub {
    key(): string {
        return '4dG3R1'
    }
    name(): string {
        return '2D Cloth'
    }
    tags?(): string[] {
        return []
    }
    main(): HTMLCanvasElement {
        return createCanvas()
    }
    userFragment(): string {
        return fragment
    }
    fragmentPrecision?(): string {
        return PRECISION_MEDIUMP
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {}
    }
    channels() {
        return [{ type: 1, f: buffA, fi: 0 }]
    }
    webgl(): string {
        return WEBGL_2
    }
}
