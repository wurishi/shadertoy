import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform bool u_mode;

float noise( in vec2 p );

// regular fbm
float fbm( in vec2 p )
{
    float s = 0.5;
    float f = 0.0;
    for( int i=0; i<8; i++ )
    {
        f += s*noise(p);
        s *= 0.8;
        p = 2.01*mat2(0.8,0.6,-0.6,0.8)*p;
    }
    return 0.5+0.5*f;
}

// band limited fbm
float blfbm( in vec2 p )
{
    float w = length(fwidth(p)); // filter width
    
    float s = 0.5;
    float f = 0.0;
    for( int i=0; i<8; i++ )
    {
        f += s*noise(p)*smoothstep(1.0,0.5,w);
        s *= 0.8;
        p = 2.01*mat2(0.8,0.6,-0.6,0.8)*p; // keep p and
        w = 2.01*w;                        // w in synch
    }
    return 0.5+0.5*f;
}

// band limited fbm, same as above, but with explicit gradients
float blfbm( in vec2 p, in vec2 dpdx, in vec2 dpdy )
{
    float w = max(length(dpdx),length(dpdy));
    
    float s = 0.5;
    float f = 0.0;
    for( int i=0; i<8; i++ )
    {
        f += s*noise(p)*smoothstep(6.0,0.5,w);
        s *= 0.8;
        p = 2.01*mat2(0.8,0.6,-0.6,0.8)*p; // keep p and
        w = 2.01*w;                        // w in synch
    }
    return 0.5+0.5*f;
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
// noise
//===============================================================================================
//===============================================================================================

float hash(vec2 p)  // replace this by something better
{
    p  = 50.0*fract( p*0.3183099 + vec2(0.71,0.113));
    return -1.0+2.0*fract( p.x*p.y*(p.x+p.y) );
}

// simple (and bad!) value noise
float noise( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
	vec2 u = f*f*(3.0-2.0*f);
    return mix( mix( hash( i + vec2(0.0,0.0) ), 
                     hash( i + vec2(1.0,0.0) ), u.x),
                mix( hash( i + vec2(0.0,1.0) ), 
                     hash( i + vec2(1.0,1.0) ), u.x), u.y);
}

//===============================================================================================
//===============================================================================================
// scene
//===============================================================================================
//===============================================================================================


// spheres
const vec4 sc0 = vec4(  3.0, 0.5, 0.0, 0.5 );
const vec4 sc1 = vec4( -4.0, 2.0,-5.0, 2.0 );
const vec4 sc2 = vec4( -4.0, 2.0, 5.0, 2.0 );
const vec4 sc3 = vec4(-30.0, 8.0, 0.0, 8.0 );

float intersect( vec3 ro, vec3 rd, out vec3 pos, out vec3 nor, out float occ, out int matid )
{
    // raytrace
	float tmin = 10000.0;
	nor = vec3(0.0);
	occ = 1.0;
	pos = vec3(0.0);
    matid = -1;
	
	// raytrace-plane
	float h = (0.01-ro.y)/rd.y;
	if( h>0.0 ) 
	{ 
		tmin = h; 
		nor = vec3(0.0,1.0,0.0); 
		pos = ro + h*rd;
		matid = 0;
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
		matid = 1;
		occ = 0.5 + 0.5*nor.y;
	}

	h = iSphere( ro, rd, sc1 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + tmin*rd;
		nor = normalize(pos-sc1.xyz); 
		matid = 2;
		occ = 0.5 + 0.5*nor.y;
	}

	h = iSphere( ro, rd, sc2 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + tmin*rd;
		nor = normalize(pos-sc2.xyz); 
		matid = 3;
		occ = 0.5 + 0.5*nor.y;
	}

	h = iSphere( ro, rd, sc3 );
	if( h>0.0 && h<tmin ) 
	{ 
		tmin = h; 
        pos = ro + tmin*rd;
		nor = normalize(pos-sc3.xyz); 
		matid = 4;
		occ = 0.5 + 0.5*nor.y;
	}

	return tmin;	
}

vec2 texCoords( in vec3 pos, int mid )
{
    vec2 matuv;
    
    if( mid==0 )
    {
        matuv = pos.xz;
    }
    else if( mid==1 )
    {
        vec3 q = normalize( pos - sc0.xyz );
        matuv = vec2( atan(q.x,q.z), acos(q.y ) )*sc0.w;
    }
    else if( mid==2 )
    {
        vec3 q = normalize( pos - sc1.xyz );
        matuv = vec2( atan(q.x,q.z), acos(q.y ) )*sc1.w;
    }
    else if( mid==3 )
    {
        vec3 q = normalize( pos - sc2.xyz );
        matuv = vec2( atan(q.x,q.z), acos(q.y ) )*sc2.w;
    }
    else if( mid==4 )
    {
        vec3 q = normalize( pos - sc3.xyz );
        matuv = vec2( atan(q.x,q.z), acos(q.y ) )*sc3.w;
    }

	return 20.0*matuv;
}


void calcCamera( out vec3 ro, out vec3 ta )
{
	float an = 0.1*sin(0.1*iTime);
	ro = vec3( 5.0*cos(an), 0.5, 5.0*sin(an) );
    ta = vec3( 0.0, 1.0, 0.0 );
}

vec3 doLighting( in vec3 pos, in vec3 nor, in float occ, in vec3 rd )
{
    float sh = min( min( min( softShadowSphere( pos, vec3(0.57703), sc0 ),
				              softShadowSphere( pos, vec3(0.57703), sc1 )),
				              softShadowSphere( pos, vec3(0.57703), sc2 )),
                              softShadowSphere( pos, vec3(0.57703), sc3 ));
	float dif = clamp(dot(nor,vec3(0.57703)),0.0,1.0);
	float bac = clamp(0.5+0.5*dot(nor,vec3(-0.707,0.0,-0.707)),0.0,1.0);
    vec3 lin  = dif*vec3(1.50,1.40,1.30)*sh;
	     lin += occ*vec3(0.15,0.20,0.30);
	     lin += bac*vec3(0.10,0.10,0.10)*(0.2+0.8*occ);

    return lin;
}
//===============================================================================================
//===============================================================================================
// render
//===============================================================================================
//===============================================================================================

void calcRayForPixel( in vec2 pix, out vec3 resRo, out vec3 resRd )
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
	vec3 rd = normalize( p.x*uu + p.y*vv + 2.0*ww );
	
	resRo = ro;
	resRd = rd;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (-iResolution.xy + 2.0*fragCoord) / iResolution.y;
	
    float th = (iMouse.z>0.001) ? (2.0*iMouse.x-iResolution.x)/iResolution.y : 0.0;
    
	vec3 ro, rd, ddx_ro, ddx_rd, ddy_ro, ddy_rd;
	calcRayForPixel( fragCoord + vec2(0.0,0.0), ro, rd );
	calcRayForPixel( fragCoord + vec2(1.0,0.0), ddx_ro, ddx_rd );
	calcRayForPixel( fragCoord + vec2(0.0,1.0), ddy_ro, ddy_rd );
		
    // trace
	vec3 pos, nor;
	float occ;
    int mid;
    float t = intersect( ro, rd, pos, nor, occ, mid );

	vec3 col = vec3(0.9);
	if( mid!=-1 )
	{
        vec2 uv, ddx_uv, ddy_uv;
        if(u_mode) {
            // -----------------------------------------------------------------------
            // compute ray differentials by intersecting the tangent plane to the  
            // surface.		
            // -----------------------------------------------------------------------

            // computer ray differentials
            vec3 ddx_pos = ddx_ro - ddx_rd*dot(ddx_ro-pos,nor)/dot(ddx_rd,nor);
            vec3 ddy_pos = ddy_ro - ddy_rd*dot(ddy_ro-pos,nor)/dot(ddy_rd,nor);

            // calc texture sampling footprint		
            uv = texCoords(     pos, mid );
            ddx_uv = texCoords( ddx_pos, mid ) - uv;
            ddy_uv = texCoords( ddy_pos, mid ) - uv;
        }
        else {
            // -----------------------------------------------------------------------
            // Because we are in the GPU, we do have access to differentials directly
            // This wouldn't be the case in a regular raytracer.
            // -----------------------------------------------------------------------
            uv = texCoords( pos, mid );

            // calc texture sampling footprint		
            ddx_uv = dFdx( uv ); 
            ddy_uv = dFdy( uv ); 
        }
		// shading		
		vec3 mate = vec3(0.0);

        if( p.x<th ) mate = vec3(1.0)*fbm( uv );
        else         mate = vec3(1.0)*blfbm( uv, ddx_uv, ddy_uv );
            
        // lighting	
		vec3 lin = doLighting( pos, nor, occ, rd );

        // combine lighting with material		
		col = mate * lin;
		
        // fog		
        col = mix( col, vec3(0.9), 1.0-exp( -0.00001*t*t ) );
	}
	
    // gamma correction	
	col = pow( col, vec3(0.4545) );

	col *= smoothstep( 1.0, 2.0, abs(p.x-th)/(2.0/iResolution.y) );
	
	fragColor = vec4( col, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_mode: true,
};

export default class implements iSub {
  key(): string {
    return '3tScWd';
  }
  name(): string {
    return 'Bandlimited fbm (box, 2D)';
  }
  sort() {
    return 78;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_mode');
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
    const u_mode = webglUtils.getUniformLocation(gl, program, 'u_mode');
    return () => {
      u_mode.uniform1i(api.u_mode ? 1 : 0);
    };
  }
}
