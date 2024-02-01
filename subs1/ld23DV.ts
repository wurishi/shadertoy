import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec4 iBox( in vec3 ro, in vec3 rd, in mat4 txx, in mat4 txi, in vec3 rad ) 
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


// http://iquilezles.org/www/articles/boxfunctions/boxfunctions.htm
float sBox( in vec3 ro, in vec3 rd, in mat4 txx, in vec3 rad ) 
{
	vec3 rdd = (txx*vec4(rd,0.0)).xyz;
	vec3 roo = (txx*vec4(ro,1.0)).xyz;

    vec3 m = 1.0/rdd;
    vec3 n = m*roo;
    vec3 k = abs(m)*rad;
	
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	if( tN > tF || tF < 0.0) return -1.0;
	
	return tN;
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
/*
mat4 inverse( in mat4 m )
{
	return mat4(
        m[0][0], m[1][0], m[2][0], 0.0,
        m[0][1], m[1][1], m[2][1], 0.0,
        m[0][2], m[1][2], m[2][2], 0.0,
        -dot(m[0].xyz,m[3].xyz),
        -dot(m[1].xyz,m[3].xyz),
        -dot(m[2].xyz,m[3].xyz),
        1.0 );
}*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy) / iResolution.y;

     // camera movement	
	float an = 0.4*iTime;
	vec3 ro = vec3( 2.5*cos(an), 1.0, 2.5*sin(an) );
    vec3 ta = vec3( 0.0, 0.8, 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
	// create view ray
	vec3 rd = normalize( p.x*uu + p.y*vv + 2.0*ww );

    // rotate and translate box	
	mat4 rot = rotationAxisAngle( normalize(vec3(1.0,1.0,0.0)), iTime );
	mat4 tra = translate( 0.0, 1.0, 0.0 );
	mat4 txi = tra * rot; 
	mat4 txx = inverse( txi );

    // raytrace
	float tmin = 10000.0;
	vec3  nor = vec3(0.0);
	vec3  pos = vec3(0.0);
	
	// raytrace-plane
	float oid = 0.0;
	float h = (0.0-ro.y)/rd.y;
	if( h>0.0 ) 
	{ 
		tmin = h; 
		nor = vec3(0.0,1.0,0.0); 
		oid = 1.0;
	}

	// raytrace box
	vec3 box = vec3(0.4,0.6,0.8) ;
	vec4 res = iBox( ro, rd, txx, txi, box);
	if( res.x>0.0 && res.x<tmin )
	{
		tmin = res.x; 
		nor = res.yzw;
		oid = 2.0;
	}

    // shading/lighting	
	vec3 col = vec3(0.6,0.75,0.85) - 0.97*rd.y;
    
	if( tmin<100.0 )
	{
		pos = ro + tmin*rd;
		
        // material
		float occ = 1.0;
		vec3  mate = vec3(1.0);
		if( oid<1.5 ) // plane
		{
		    mate = 0.35*texture( iChannel0, 0.25*pos.xz ).xyz;
			occ = 0.2 + 0.8*smoothstep( 0.0, 1.5, length(pos.xz) );
		}			
		else // box
		{
            // recover box space data (we want to do shading in object space)			
		    vec3 opos = (txx*vec4(pos,1.0)).xyz;
			vec3 onor = (txx*vec4(nor,0.0)).xyz;
		    mate = abs(onor.x)*texture( iChannel0, 0.5*opos.yz ).xyz + 
                   abs(onor.y)*texture( iChannel0, 0.5*opos.zx ).xyz + 
                   abs(onor.z)*texture( iChannel0, 0.5*opos.xy ).xyz;
			mate *= 0.35;
            occ = 0.6 + 0.4*nor.y;
		}		
		
        // lighting
        vec3  lig = normalize(vec3(0.8,0.4,-0.6));
        float dif = clamp( dot(nor,lig), 0.0, 1.0 );
        vec3  hal = normalize(lig-rd);
        float sha = step( iBox( pos+0.001*nor, lig, txx, txi, box ).x, 0.0 );
        float amb = 0.6 + 0.4*nor.y;
        float bou = clamp(0.3-0.7*nor.y,0.0,1.0);
        float spe = clamp(dot(nor,hal),0.0,1.0);
        col  = 4.0*vec3(1.00,0.80,0.60)*dif*sha;
        col += 2.0*vec3(0.20,0.30,0.40)*amb;
        col += 2.0*vec3(0.30,0.20,0.10)*bou;
        col *= mate;            
        col += 0.3*pow(spe,8.0)*dif*sha*(0.04+0.96*pow(clamp(dot(lig,hal),0.0,1.0),5.0));
        col = mix( col, vec3(0.6,0.7,0.8), 1.0-exp(-0.001*tmin*tmin) );           
	}
	
    // vignetting        
    col *= 1.0 - 0.1*dot(p,p);

    // gamma
    col = pow( col, vec3(0.45) );
    
	// grading
    col = clamp(col,0.0,1.0);
    col = col*col*(3.0-2.0*col);

	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'ld23DV';
  }
  name(): string {
    return 'Box - intersection';
  }
  sort() {
    return 109;
  }
  webgl() {
    return WEBGL_2;
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
    return [webglUtils.ROCK_TEXTURE];
  }
}
