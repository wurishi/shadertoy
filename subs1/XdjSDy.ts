import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Triangle intersection. Returns { t, u, v }
vec3 triIntersect( in vec3 ro, in vec3 rd, in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 a = v0 - v1;
    vec3 b = v2 - v0;
    vec3 p = v0 - ro;
    vec3 n = cross( b, a );
    vec3 q = cross( p, rd );

    float idet = 1.0/dot( rd, n );

    float u = dot( q, b )*idet;
    float v = dot( q, a )*idet;
    float t = dot( n, p )*idet;

    if( u<0.0 || u>1.0 || v<0.0 || (u+v)>1.0 ) t = -1.0;

    return vec3( t, u, v );
}

// Triangle occlusion (if fully visible)
float triOcclusion( in vec3 pos, in vec3 nor, in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 a = normalize( v0 - pos );
    vec3 b = normalize( v1 - pos );
    vec3 c = normalize( v2 - pos );
    
    float s = sign(dot(v0-pos,cross(v1-v0,v2-v1))); // side of the triangle

    return s*(dot( nor, normalize( cross(a,b)) ) * acos( dot(a,b) ) +
              dot( nor, normalize( cross(b,c)) ) * acos( dot(b,c) ) +
              dot( nor, normalize( cross(c,a)) ) * acos( dot(c,a) ) ) / 6.2831;
}

//=====================================================

vec2 hash2( float n ) { return fract(sin(vec2(n,n+1.0))*vec2(43758.5453123,22578.1459123)); }

float iPlane( in vec3 ro, in vec3 rd )
{
    return (-1.0 - ro.y)/rd.y;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord.xy-iResolution.xy) / iResolution.y;
    float s = (2.0*iMouse.x-iResolution.x) / iResolution.y;
    if( iMouse.z<0.001 ) s=0.0;

	vec3 ro = vec3(0.0, 0.0, 4.0 );
	vec3 rd = normalize( vec3(p,-2.0) );
	
    // triangle animation
    vec3 v1 = cos( iTime + vec3(2.0,1.0,1.0) + 0.0 )*vec3(1.5,1.0,1.0);
	vec3 v2 = cos( iTime + vec3(5.0,2.0,3.0) + 2.0 )*vec3(1.5,1.0,1.0);
	vec3 v3 = cos( iTime + vec3(1.0,3.0,5.0) + 4.0 )*vec3(1.5,1.0,1.0);

    vec4 rrr = texture( iChannel0, (fragCoord.xy)/iChannelResolution[0].xy, -99.0  ).xzyw;


    vec3 col = vec3(0.0);

    float tmin = 1e10;
    
    float t1 = iPlane( ro, rd );
    if( t1>0.0 )
    {
        tmin = t1;
        vec3 pos = ro + tmin*rd;
        vec3 nor = vec3(0.0,1.0,0.0);
        float occ = 0.0;
        
        if( p.x > s )
        {
            occ = triOcclusion( pos, nor, v1, v2, v3 );
        }
        else
        {
   		    vec3  ru  = normalize( cross( nor, vec3(0.0,1.0,1.0) ) );
		    vec3  rv  = normalize( cross( ru, nor ) );

            occ = 0.0;
            for( int i=0; i<256; i++ )
            {
                vec2  aa = hash2( rrr.x + float(i)*203.1 );
                float ra = sqrt(aa.y);
                float rx = ra*cos(6.2831*aa.x); 
                float ry = ra*sin(6.2831*aa.x);
                float rz = sqrt( 1.0-aa.y );
                vec3  dir = vec3( rx*ru + ry*rv + rz*nor );
                vec3 res = triIntersect( pos+nor*0.001, dir, v1, v2, v3 );
                occ += step(0.0,res.x);
            }
            occ /= 256.0;
        }

        col = vec3(1.0);
        col *= 1.0 - occ;
    }

    vec3 res = triIntersect( ro, rd, v1, v2, v3 );
    float t2 = res.x;
    if( t2>0.0 && t2<tmin )
    {
        tmin = t2;
        float t = t2;
        vec3 pos = ro + t*rd;
        vec3 nor = normalize( cross( v2-v1, v3-v1 ) );
		col = vec3(1.0,0.8,0.5);
        col *= 1.5*texture( iChannel1, res.yz ).xyz;
        col *= 0.6 + 0.4*nor.y;
	}

	col *= exp( -0.05*tmin );

    float e = 2.0/iResolution.y;
    col *= smoothstep( 0.0, 2.0*e, abs(p.x-s) );
    
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'XdjSDy';
  }
  name(): string {
    return 'Triangle - occlusion';
  }
  sort() {
    return 123;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
    return [webglUtils.DEFAULT_NOISE, webglUtils.TEXTURE10];
  }
}
