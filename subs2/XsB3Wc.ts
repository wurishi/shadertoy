import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define HIGH_QUALITY_NOISE

vec3 hash( vec3 x )
{
	return textureLod( iChannel0, (x.xy+vec2(3.0,1.0)*x.z+0.5)/256.0, 0.0 ).xyz;
}

float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
#ifndef HIGH_QUALITY_NOISE
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( iChannel0, (uv+0.5)/256.0, 0.0 ).yx;
#else
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z);
	vec2 rg1 = textureLod( iChannel0, (uv+vec2(0.5,0.5))/256.0, 0.0 ).yx;
	vec2 rg2 = textureLod( iChannel0, (uv+vec2(1.5,0.5))/256.0, 0.0 ).yx;
	vec2 rg3 = textureLod( iChannel0, (uv+vec2(0.5,1.5))/256.0, 0.0 ).yx;
	vec2 rg4 = textureLod( iChannel0, (uv+vec2(1.5,1.5))/256.0, 0.0 ).yx;
	vec2 rg = mix( mix(rg1,rg2,f.x), mix(rg3,rg4,f.x), f.y );
#endif	
	return mix( rg.x, rg.y, f.z );
}

vec2 iSphere( in vec3 ro, in vec3 rd, in vec4 sph )
{
	vec3 oc = ro - sph.xyz;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - sph.w*sph.w;
	float h = b*b - c;
	if( h<0.0 ) return vec2(-1.0);
	h = sqrt(h);
	return vec2(-b-h, -b+h );
}

vec2 voronoi( in vec3 x, out vec3 cen )
{
    vec3 p = floor( x );
    vec3 f = fract( x );

	float id = 0.0;
    float res = 100.0;
    for( int k=-1; k<=1; k++ )
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec3 b = vec3( float(i), float(j), float(k) );
        vec3 r = vec3( b ) - f + hash( p + b );
        float d = dot( r, r );

        if( d < res )
        {
			id = dot( p+b, vec3(1.0,57.0,113.0 ) );
            res = d;
			cen = p + r + f;
        }
    }

    return vec2( sqrt( res ), id );
}

vec4 map( in vec3 p )
{
	vec3 q = 8.0*p;
	float n = 0.0;
	n  = 0.5000*noise( q ); q = q*2.02;
    n += 0.2500*noise( q ); q = q*2.03;
    n += 0.1250*noise( q );
	
	vec3 cen = vec3(0.0);
	vec2 vor = voronoi( 2.0*p, cen );
	float f = 1.0-1.5*vor.x; cen /= 2.0;
	f -= smoothstep( 0.4, 0.5, n );
	
    float d = 2.0*f;
	
	d *= smoothstep( 0.0, 0.2, 1.0-length(p) );
	d *= smoothstep( 0.0, 0.2, 1.0-length(cen) );
	d = clamp( d, 0.0, 1.0 );
	
	vec3 col = mix( vec3(1.0,0.85,0.7), vec3(0.2,0.0,0.0), d );
	
	col -= 0.05*sin( 5.0*vor.y + vec3(1.0,2.0,3.0) );
	
	return vec4( col, d );
}

const vec3 sundir = vec3(0.0,0.5,-1.0);

vec4 raymarch( in vec3 ro, in vec3 rd, in vec2 tminmax, in vec2 px )
{
	vec4 sum = vec4(0, 0, 0, 0);

    const int numSteps = 64;
    
	float dt = 1.0/float(numSteps);
	
	float t = tminmax.x + dt*textureLod(iChannel0, px/iChannelResolution[0].xy, 0.0).x;
	for(int i=0; i<numSteps; i++)
	{
		if( sum.a > 0.99 || t>tminmax.y ) break;

		vec3 pos = ro + t*rd;
		vec4 col = map( pos );
		
		float dif = clamp((col.w - map(pos+0.01*sundir).w)/0.01, 0.0, 1.0 );
        float occ = dot(pos,pos);
        vec3 lin = vec3(0.2,0.2,0.2) + vec3(1.0, 0.9, 0.7)*dif;
		col.xyz *= lin*2.5*occ*occ;
		
		col.a *= 0.1;
		col.rgb *= col.a;

		sum = sum + col*(1.0 - sum.a) * dt/0.01;	

		t += dt;
	}

	return sum;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord / iResolution.xy;
    vec2 p = -1.0 + 2.0*q;
    p.x *= iResolution.x/ iResolution.y;
    vec2 mo = iMouse.xy / iResolution.xy;
    float an = 2.0 + 0.2*iTime - mo.x;

	vec3 ro = 2.0*vec3(cos(an), 0.17, sin(an));
	vec3 ta = vec3(0.0, 0.0, 0.0);
    vec3 ww = normalize( ta - ro);
    vec3 uu = normalize( cross( vec3(0.0,1.0,0.0), ww ) );
    vec3 vv = normalize( cross(ww,uu) );
    vec3 rd = normalize( p.x*uu + p.y*vv + 2.0*ww );

	vec3 col = vec3(0.05,0.04,0.03);
    vec2 seg = iSphere( ro, rd, vec4(0.0,0.0,0.0,1.0) );
	if( seg.x>0.0 )
	{
        vec4 res = raymarch( ro, rd, seg, fragCoord );
        col = col*(1.0-res.w) + res.xyz;
	}
	
	col = mix( col, vec3(dot(col,vec3(0.333))), -0.1 );
	
	col = pow( col, vec3(0.45) ) * 1.2;

	col *= sqrt( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y) );
	    
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'XsB3Wc';
  }
  name(): string {
    return 'Weird Thing';
  }
  sort() {
    return 259;
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
    return [{ ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_LINEAR }];
  }
}
