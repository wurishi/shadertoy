import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
#define USESMOOTH


//===============================================================================================

#ifndef USESMOOTH    

float noiseNew( in vec3 x )
{
    return texture( iChannel0, (x/32.0).xy ).x;    // <---------- Sample a 3D texture!
}

float noiseOld( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( iChannel1, (uv+0.5)/256.0, 0.0).yx;
	return mix( rg.x, rg.y, f.z );
}


#else
float noiseNew( in vec3 x )
{
	x += 0.5;
	vec3 fx = fract( x );
	x = floor( x ) + fx*fx*(3.0-2.0*fx);
    return texture( iChannel0, ((x-0.5)/32.0).xy ).x;

}

float noiseOld( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( iChannel1, (uv+0.5)/256.0, 0.0).yx;
	return mix( rg.x, rg.y, f.z );
}
#endif

//===============================================================================================

const mat3 m = mat3( 0.00,  0.80,  0.60,
                    -0.80,  0.36, -0.48,
                    -0.60, -0.48,  0.64 );

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (-iResolution.xy + 2.0*fragCoord) / iResolution.y;

     // camera movement	
	float an = 0.1*iTime;
	vec3 ro = vec3( 2.5*cos(an), 1.0, 2.5*sin(an) );
    vec3 ta = vec3( 0.0, 1.0, 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
	// create view ray
	vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );

    // sphere center	
	vec3 sc = vec3(0.0,1.0,0.0);

    // raytrace
	float tmin = 10000.0;
	vec3  nor = vec3(0.0);
	float occ = 1.0;
	vec3  pos = vec3(0.0);
	
	// raytrace-plane
	float h = (0.0-ro.y)/rd.y;
	if( h>0.0 ) 
	{ 
		tmin = h; 
		nor = vec3(0.0,1.0,0.0); 
		pos = ro + h*rd;
		vec3 di = sc - pos;
		float l = length(di);
		occ = 1.0 - dot(nor,di/l)*1.0*1.0/(l*l); 
	}

	// raytrace-sphere
	vec3  ce = ro - sc;
	float b = dot( rd, ce );
	float c = dot( ce, ce ) - 1.0;
	h = b*b - c;
	if( h>0.0 )
	{
		h = -b - sqrt(h);
		if( h<tmin ) 
		{ 
			tmin=h; 
			nor = normalize(ro+h*rd-sc); 
			occ = 0.5 + 0.5*nor.y;
		}
	}

    // shading/lighting	
	vec3 col = vec3(0.9);
	if( tmin<100.0 )
	{
	    pos = ro + tmin*rd;
	    float f = 0.0;
		
        
        if( cos(iTime)<0.5 )
        {
            if( p.x<0.0 )
            {
                f = noiseNew( 16.0*pos );
            }
            else
            {
                f = noiseOld( 16.0*pos );
            }
        }
        else
        {
			if( p.x<0.0 ) 
        	{
                vec3 q = 8.0*pos;
                f  = 0.5000*noiseNew( q ); q = m*q*2.01;
                f += 0.2500*noiseNew( q ); q = m*q*2.02;
                f += 0.1250*noiseNew( q ); q = m*q*2.03;
                f += 0.0625*noiseNew( q ); q = m*q*2.01;
			}
			else
        	{
                vec3 q = 8.0*pos;
                f  = 0.5000*noiseOld( q ); q = m*q*2.01;
                f += 0.2500*noiseOld( q ); q = m*q*2.02;
                f += 0.1250*noiseOld( q ); q = m*q*2.03;
                f += 0.0625*noiseOld( q ); q = m*q*2.01;
			}
		}
			
		
		f *= sqrt(occ); // gamma de lighting only
		col = vec3(f*1.5);
		col = mix( col, vec3(0.9), 1.0-exp( -0.05*tmin ) );
	}
	
	
	col *= smoothstep( 0.006, 0.008, abs(p.x) );
	
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4llcR4';
  }
  name(): string {
    return 'Input - 3D Texture';
  }
  // sort() {
  //   return 0;
  // }
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
    return [{ type: 3 }, webglUtils.DEFAULT_NOISE];
  }
}
