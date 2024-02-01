import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Box occlusion (if fully visible)
float boxOcclusion( in vec3 pos, in vec3 nor, in mat4 txx, in mat4 txi, in vec3 rad ) 
{
	vec3 p = (txx*vec4(pos,1.0)).xyz;
	vec3 n = (txx*vec4(nor,0.0)).xyz;
    
    // Orient the hexagon based on p
    vec3 f = rad * sign(p);
    
    // Make sure the hexagon is always convex
    vec3 s = sign(rad - abs(p));
    
    // 6 verts
    vec3 v0 = normalize( vec3( 1.0, 1.0,-1.0)*f - p);
    vec3 v1 = normalize( vec3( 1.0, s.x, s.x)*f - p);
    vec3 v2 = normalize( vec3( 1.0,-1.0, 1.0)*f - p);
    vec3 v3 = normalize( vec3( s.z, s.z, 1.0)*f - p);
    vec3 v4 = normalize( vec3(-1.0, 1.0, 1.0)*f - p);
    vec3 v5 = normalize( vec3( s.y, 1.0, s.y)*f - p);
    
    // 6 edges
    return abs( dot( n, normalize( cross(v0,v1)) ) * acos( dot(v0,v1) ) +
    	    	dot( n, normalize( cross(v1,v2)) ) * acos( dot(v1,v2) ) +
    	    	dot( n, normalize( cross(v2,v3)) ) * acos( dot(v2,v3) ) +
    	    	dot( n, normalize( cross(v3,v4)) ) * acos( dot(v3,v4) ) +
    	    	dot( n, normalize( cross(v4,v5)) ) * acos( dot(v4,v5) ) +
    	    	dot( n, normalize( cross(v5,v0)) ) * acos( dot(v5,v0) ))
            	/ 6.2831;
}

// returns t and normal
vec4 boxIntersect( in vec3 ro, in vec3 rd, in mat4 txx, in mat4 txi, in vec3 rad ) 
{
    // convert from ray to box space
	vec3 rdd = (txx*vec4(rd,0.0)).xyz;
	vec3 roo = (txx*vec4(ro,1.0)).xyz;

	// ray-box intersection in box space
    vec3 m = 1.0/rdd;
    vec3 n = m*roo;
    vec3 k = abs(m)*rad;
	
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	
	if( tN > tF || tF < 0.0) return vec4(-1.0);

	vec3 nor = -sign(rdd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);

    // convert to ray space
	
	nor = (txi * vec4(nor,0.0)).xyz;

	return vec4( tN, nor );
}

//-----------------------------------------------------------------------------------------

mat4 rotationAxisAngle( vec3 v, float angle )
{
    float s = sin( angle );
    float c = cos( angle );
    float ic = 1.0 - c;

    return mat4( v.x*v.x*ic + c,     v.y*v.x*ic - s*v.z, v.z*v.x*ic + s*v.y, 0.0,
                 v.x*v.y*ic + s*v.z, v.y*v.y*ic + c,     v.z*v.y*ic - s*v.x, 0.0,
                 v.x*v.z*ic - s*v.y, v.y*v.z*ic + s*v.x, v.z*v.z*ic + c,     0.0,
			     0.0,                0.0,                0.0,                1.0 );
}

mat4 translate( float x, float y, float z )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 x,   y,   z,   1.0 );
}


vec2 hash2( float n ) { return fract(sin(vec2(n,n+1.0))*vec2(43758.5453123,22578.1459123)); }

//-----------------------------------------------------------------------------------------

float iPlane( in vec3 ro, in vec3 rd )
{
    return (-1.0 - ro.y)/rd.y;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord.xy-iResolution.xy) / iResolution.y;

	vec3 ro = vec3(0.0, 0.0, 4.0 );
	vec3 rd = normalize( vec3(p.x, p.y-0.3,-3.5) );
	
    // box animation
	mat4 rot = rotationAxisAngle( normalize(vec3(1.0,1.0,0.0)), iTime );
	mat4 tra = translate( 0.0, 0.0, 0.0 );
	mat4 txi = tra * rot; 
	mat4 txx = inverse( txi );
	vec3 box = vec3(0.2,0.5,0.6) ;

    vec3 col = vec3(0.0);

    float tmin = 1e10;
    
    float t1 = iPlane( ro, rd );
    if( t1>0.0 )
    {
        tmin = t1;
        vec3 pos = ro + tmin*rd;
        vec3 nor = vec3(0.0,1.0,0.0);
        float occ = boxOcclusion( pos, nor, txx, txi, box );

        col = vec3(1.1);
        col *= 1.0 - occ;
    }

    vec4 res = boxIntersect( ro, rd, txx, txi, box );
    float t2 = res.x;
    if( t2>0.0 && t2<tmin )
    {
        tmin = t2;
        float t = t2;
        vec3 pos = ro + t*rd;
        vec3 nor = res.yzw;
		col = vec3(0.8);

		vec3 opos = (txx*vec4(pos,1.0)).xyz;
		vec3 onor = (txx*vec4(nor,0.0)).xyz;
//		col *= abs(onor.x)*texture( iChannel1, 0.5+0.5*opos.yz ).xyz + 
  //             abs(onor.y)*texture( iChannel1, 0.5+0.5*opos.zx ).xyz + 
    //           abs(onor.z)*texture( iChannel1, 0.5+0.5*opos.xy ).xyz;
        col *= 1.7;
        col *= 0.6 + 0.4*nor.y;
	}

	col *= exp( -0.05*tmin );
    
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'ttlBWf';
  }
  name(): string {
    return 'Box occlusion optimized';
  }
  sort() {
    return 166;
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
}
