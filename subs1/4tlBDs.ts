import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec3 parallelogramIntersect( in vec3 ro, in vec3 rd, in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 a = v0 - v1;
    vec3 b = v2 - v0;
    vec3 p = v0 - ro;
    
    vec3 n = cross( a, b );
    vec3 q = cross( rd, p );
    
    float i = 1.0/dot( rd, n );
    
    float u = dot( q, a )*i;
    float v = dot( q, b )*i;
    float t = dot( n, p )*i;

    if( u<0.0 || u>1.0 || v<0.0 || v>1.0 ) return vec3(-1.0);
    
    return vec3( t, u, v );
}

//=====================================================

float sphIntersect( in vec3 ro, in vec3 rd, in vec4 sph )
{
	vec3 oc = ro - sph.xyz;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - sph.w*sph.w;
	float h = b*b - c;
	if( h<0.0 ) return -1.0;
	return -b - sqrt( h );
}

vec3 v0, v1, v2, v3;

vec4 intersect( in vec3 ro, in vec3 rd )
{
    float tmin = 100000.0;
    float obj = -1.0;
    vec2  uv = vec2(-1.0);
    
    float t = (-1.0-ro.y)/rd.y;
    if( t>0.0 && t<tmin )
    {
        tmin = t;
    	obj = 1.0;    
    }
    vec3 tuv = parallelogramIntersect( ro, rd, v0, v1, v2 );
    if( tuv.x>0.0 && tuv.x<tmin )
    {
        tmin = tuv.x;
        obj = 2.0;
        uv = tuv.yz;
    }
    t = sphIntersect( ro, rd, vec4(v0,0.05) );
    if( t>0.0 && t<tmin )
    {
        tmin = t;
        obj = 3.0;
    }
    t = sphIntersect( ro, rd, vec4(v1,0.05) );
    if( t>0.0 && t<tmin )
    {
        tmin = t;
        obj = 4.0;
    }
    t = sphIntersect( ro, rd, vec4(v2,0.05) );
    if( t>0.0 && t<tmin )
    {
        tmin = t;
        obj = 5.0;
    }
    t = sphIntersect( ro, rd, vec4(v3,0.05) );
    if( t>0.0 && t<tmin )
    {
        tmin = t;
        obj = 6.0;
    }
    
    return vec4(tmin,obj,uv);
}

vec3 calcNormal( in vec3 pos, float obj )
{
    if( obj<1.5 )
        return vec3(0.0,1.0,0.0);
    else if( obj<2.5 )
    	return normalize( cross(v2-v1,v1-v3) );
    else if( obj<3.5 )
		return normalize( pos-v0 );        
    else if( obj<4.5 )
		return normalize( pos-v1 );        
    else if( obj<5.5 )
		return normalize( pos-v2 );        
    else// if( obj<6.5 )
		return normalize( pos-v3 );        
}

float calcShadow( in vec3 ro, in vec3 rd, float k )
{
	return step(intersect(ro,rd).y,0.0);
}


vec3 pattern( in vec2 uv )
{
    vec3 col = vec3(0.6);
    col += 0.4*smoothstep(-0.01,0.01,cos(uv.x*0.5)*cos(uv.y*0.5)); 
    col *= smoothstep(-1.0,-0.98,cos(uv.x))*smoothstep(-1.0,-0.98,cos(uv.y));
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	v0 = 0.8*cos( iTime*1.1 + vec3(0.0,1.0,1.0) + 0.0 );
	v1 = 0.7*cos( iTime*1.2 + vec3(0.0,2.0,3.0) + 2.0 );
	v2 = 0.7*cos( iTime*1.3 + vec3(0.0,3.0,5.0) + 4.0 );
    v3 = v1 + v2 - v0;
    
    vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;

	vec3 ro = vec3(0.0, 0.25, 2.0 );
	vec3 rd = normalize( vec3(p,-1.0) );
	
	vec3 col = vec3(0.08) + 0.02*rd.y;

    vec4 res = intersect(ro,rd);
    float t = res.x;
    float o = res.y;
    vec2  uv = res.zw;
    if( o>0.0 )
    {
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal(pos, o);
        nor = faceforward( nor, rd, nor );
        
        vec3 lig = normalize(vec3(0.7,0.6,0.3));
        vec3 hal = normalize(-rd+lig);
        float dif = clamp( dot(nor,lig), 0.0, 1.0 );
        float amb = clamp( 0.5 + 0.5*dot(nor,vec3(0.0,1.0,0.0)), 0.0, 1.0 );
		float sha = calcShadow( pos + nor*0.001, lig, 32.0 );

        if( o<1.5 )
        {
            col = mix( col*3.0*(vec3(0.2,0.3,0.4)+vec3(0.8,0.7,0.6)*sha), 
                       col, 1.0-exp(-0.02*t) );
        }
        else
        {
        col = (abs(o-2.0)<0.1) ? pattern(uv*32.0) : vec3(1.0);
        
        col *= vec3(0.2,0.3,0.4)*amb + vec3(1.0,0.9,0.7)*dif;

        col += 0.4*pow(clamp(dot(hal,nor),0.0,1.0),12.0)*dif;

        }
    }

	col = sqrt( clamp(col,0.0,1.0) );
	   
    // dither to remove banding in the background
    col += fract(sin(fragCoord.x*vec3(13,1,11)+fragCoord.y*vec3(1,7,5))*158.391832)/255.0;

    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4tlBDs';
  }
  name(): string {
    return 'Parallelogram - intersection';
  }
  sort() {
    return 112;
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
