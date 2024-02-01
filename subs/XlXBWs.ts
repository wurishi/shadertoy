import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Based on code from http://http.developer.nvidia.com/GPUGems/gpugems_ch25.html

vec3 tri( in vec3 x )
{
    return 1.0-abs(2.0*fract(x/2.0)-1.0);
}

float checkersTextureGrad( in vec3 p, in vec3 ddx, in vec3 ddy )
{
  vec3 w = max(abs(ddx), abs(ddy)) + 0.0001; // filter kernel
  vec3 i = (tri(p+0.5*w)-tri(p-0.5*w))/w;    // analytical integral (box filter)
  return 0.5 - 0.5*i.x*i.y*i.z;              // xor pattern
}

float checkersTexture( in vec3 p )
{
    vec3 q = floor(p);
    return mod( q.x+q.y+q.z, 2.0 );
}

//===============================================================================================
//===============================================================================================
// sphere implementation
//===============================================================================================
//===============================================================================================

float softShadowSphere( in vec3 ro, in vec3 rd, in vec4 sph )
{
    vec3 oc = sph.xyz - ro;
    float b = dot( oc, rd );
	
    float res = 1.0;
    if( b>0.0 )
    {
        float h = dot(oc,oc) - b*b - sph.w*sph.w;
        res = smoothstep( 0.0, 1.0, 2.0*h/b );
    }
    return res;
}

float occSphere( in vec4 sph, in vec3 pos, in vec3 nor )
{
    vec3 di = sph.xyz - pos;
    float l = length(di);
    return 1.0 - dot(nor,di/l)*sph.w*sph.w/(l*l); 
}

float iSphere( in vec3 ro, in vec3 rd, in vec4 sph )
{
    float t = -1.0;
	vec3  ce = ro - sph.xyz;
	float b = dot( rd, ce );
	float c = dot( ce, ce ) - sph.w*sph.w;
	float h = b*b - c;
	if( h>0.0 )
	{
		t = -b - sqrt(h);
	}
	
	return t;
}

//===============================================================================================
//===============================================================================================
// scene
//===============================================================================================
//===============================================================================================


// spheres
const vec4 sc0 = vec4(  0.0, 1.0,  0.0, 1.0 );
const vec4 sc1 = vec4(-11.0, 1.0,-12.0, 5.0 );
const vec4 sc2 = vec4(-11.0, 1.0, 12.0, 5.0 );
const vec4 sc3 = vec4( 13.0, 1.0,-10.0, 4.0 );

float intersect( vec3 ro, vec3 rd, out vec3 pos, out vec3 nor, out float occ, out float matid )
{
    // raytrace
	float tmin = 10000.0;
	nor = vec3(0.0);
	occ = 1.0;
	pos = vec3(0.0);
	
	// raytrace-plane
	float h = (0.01-ro.y)/rd.y;
	if( h>0.0 ) 
	{ 
		tmin = h; 
		nor = vec3(0.0,1.0,0.0); 
		pos = ro + h*rd;
		matid = 0.0;
		occ = occSphere( sc0, pos, nor ) * 
			  occSphere( sc1, pos, nor ) *
			  occSphere( sc2, pos, nor ) *
			  occSphere( sc3, pos, nor );
	}

	// raytrace-sphere
	h = iSphere( ro, rd, sc0 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + h*rd;
		nor = normalize(pos-sc0.xyz); 
		matid = 1.0;
		occ = 0.5 + 0.5*nor.y;
	}

	h = iSphere( ro, rd, sc1 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + tmin*rd;
		nor = normalize(ro+h*rd-sc1.xyz); 
		matid = 1.0;
		occ = 0.5 + 0.5*nor.y;
	}

	h = iSphere( ro, rd, sc2 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + tmin*rd;
		nor = normalize(ro+h*rd-sc2.xyz); 
		matid = 1.0;
		occ = 0.5 + 0.5*nor.y;
	}

	h = iSphere( ro, rd, sc3 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + tmin*rd;
		nor = normalize(ro+h*rd-sc3.xyz); 
		matid = 1.0;
		occ = 0.5 + 0.5*nor.y;
	}

	return tmin;	
}

vec3 texCoords( in vec3 p )
{
	return 3.0*p;
}


void calcCamera( out vec3 ro, out vec3 ta )
{
	float an = 0.01*iTime;
	ro = vec3( 5.5*cos(an), 1.0, 5.5*sin(an) );
    ta = vec3( 0.0, 1.0, 0.0 );

}

vec3 doLighting( in vec3 pos, in vec3 nor, in float occ, in vec3 rd )
{
    float sh = min( min( min( softShadowSphere( pos, vec3(0.57703), sc0 ),
				              softShadowSphere( pos, vec3(0.57703), sc1 )),
				              softShadowSphere( pos, vec3(0.57703), sc2 )),
                              softShadowSphere( pos, vec3(0.57703), sc3 ));
	float dif = clamp(dot(nor,vec3(0.57703)),0.0,1.0);
	float bac = clamp(dot(nor,vec3(-0.707,0.0,-0.707)),0.0,1.0);
    vec3 lin  = dif*vec3(1.50,1.40,1.30)*sh;
	     lin += occ*vec3(0.15,0.20,0.30);
	     lin += bac*vec3(0.10,0.10,0.10);

    return lin;
}
//===============================================================================================
//===============================================================================================
// render
//===============================================================================================
//===============================================================================================

void calcRayForPixel( vec2 pix, out vec3 resRo, out vec3 resRd )
{
	vec2 p = (-iResolution.xy + 2.0*pix) / iResolution.y;
	
     // camera movement	
	vec3 ro, ta;
	calcCamera( ro, ta );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
	// create view ray
	vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );
	
	resRo = ro;
	resRd = rd;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2  p  = (-iResolution.xy + 2.0*fragCoord.xy) / iResolution.y;
    float th = (-iResolution.x + 2.0*iMouse.x) / iResolution.y;
	
    if( iMouse.z<0.01) th = 0.5/ iResolution.y;
	
	vec3 ro, rd, ddx_ro, ddx_rd, ddy_ro, ddy_rd;
	calcRayForPixel( fragCoord.xy + vec2(0.0,0.0), ro, rd );
	calcRayForPixel( fragCoord.xy + vec2(1.0,0.0), ddx_ro, ddx_rd );
	calcRayForPixel( fragCoord.xy + vec2(0.0,1.0), ddy_ro, ddy_rd );
		
    // trace
	vec3 pos, nor;
	float occ, mid;
    float t = intersect( ro, rd, pos, nor, occ, mid );

	vec3 col = vec3(0.9);
	if( t<100.0 )
	{
#if 1
		// -----------------------------------------------------------------------
        // compute ray differentials by intersecting the tangent plane to the  
        // surface.		
		// -----------------------------------------------------------------------

		// computer ray differentials
		vec3 ddx_pos = ddx_ro - ddx_rd*dot(ddx_ro-pos,nor)/dot(ddx_rd,nor);
		vec3 ddy_pos = ddy_ro - ddy_rd*dot(ddy_ro-pos,nor)/dot(ddy_rd,nor);

		// calc texture sampling footprint		
		vec3     uvw = texCoords(     pos );
		vec3 ddx_uvw = texCoords( ddx_pos ) - uvw;
		vec3 ddy_uvw = texCoords( ddy_pos ) - uvw;
#else
		// -----------------------------------------------------------------------
        // Because we are in the GPU, we do have access to differentials directly
        // This wouldn't be the case in a regular raytrace.
		// It wouldn't work as well in shaders doing interleaved calculations in
		// pixels (such as some of the 3D/stereo shaders here in Shadertoy)
		// -----------------------------------------------------------------------
		vec3 uvw = texCoords( pos );

		// calc texture sampling footprint		
		vec3 ddx_uvw = dFdx( uvw ); 
        vec3 ddy_uvw = dFdy( uvw ); 
#endif

        
		// shading		
		vec3 mate = vec3(0.0);
		if( p.x<th ) 
            mate = vec3(1.0)*checkersTexture( uvw );
        else
            mate = vec3(1.0)*checkersTextureGrad( uvw, ddx_uvw, ddy_uvw );

        // lighting	
		vec3 lin = doLighting( pos, nor, occ, rd );

        // combine lighting with material		
		col = mate * lin;
		
        // fog		
        col = mix( col, vec3(0.9), 1.0-exp( -0.0001*t*t ) );
	}
	
    // gamma correction	
	col = pow( col, vec3(0.4545) );

	col *= smoothstep( 0.006, 0.008, abs(p.x-th) );
	
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'XlXBWs';
  }
  name(): string {
    return 'Filtered checker (box, 3D)';
  }
  sort() {
    return 71;
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
