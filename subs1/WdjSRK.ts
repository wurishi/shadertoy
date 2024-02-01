import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define AA 3

struct bound3
{
    vec3 mMin;
    vec3 mMax;
};
    
//---------------------------------------------------------------------------------------
// bounding box for a cone (http://iquilezles.org/www/articles/diskbbox/diskbbox.htm)
//---------------------------------------------------------------------------------------
bound3 ConeAABB( in vec3 pa, in vec3 pb, in float ra, in float rb )
{
    vec3 a = pb - pa;
    vec3 e = sqrt( 1.0 - a*a/dot(a,a) );
    
    return bound3( min( pa - e*ra, pb - e*rb ),
                   max( pa + e*ra, pb + e*rb ) );
}

float dot2( in vec3 v ) { return dot(v,v); }
vec4 iCappedCone( in vec3  ro, in vec3  rd, 
                  in vec3  pa, in vec3  pb, 
                  in float ra, in float rb )
{
    vec3  ba = pb - pa;
    vec3  oa = ro - pa;
    vec3  ob = ro - pb;
    
    float m0 = dot(ba,ba);
    float m1 = dot(oa,ba);
    float m2 = dot(ob,ba); 
    float m3 = dot(rd,ba);

    //caps
         if( m1<0.0 ) { if( dot2(oa*m3-rd*m1)<(ra*ra*m3*m3) ) return vec4(-m1/m3,-ba*inversesqrt(m0)); }
    else if( m2>0.0 ) { if( dot2(ob*m3-rd*m2)<(rb*rb*m3*m3) ) return vec4(-m2/m3, ba*inversesqrt(m0)); }
    
    // body
    float rr = ra - rb;
    float hy = m0 + rr*rr;
    float m4 = dot(rd,oa);
    float m5 = dot(oa,oa);
    
    float k2 = m0*m0    - m3*m3*hy;
    float k1 = m0*m0*m4 - m1*m3*hy + m0*ra*(rr*m3*1.0        );
    float k0 = m0*m0*m5 - m1*m1*hy + m0*ra*(rr*m1*2.0 - m0*ra);
    
    float h = k1*k1 - k2*k0;
    if( h<0.0 ) return vec4(-1.0);

    float t = (-k1-sqrt(h))/k2;

    float y = m1 + t*m3;
    if( y>0.0 && y<m0 ) 
    {
        return vec4(t, normalize(m0*(m0*(oa+t*rd)+rr*ba*ra)-ba*hy*y));
    }
    
    return vec4(-1.0);
}


// ray-box intersection
vec2 iBox( in vec3 ro, in vec3 rd, in vec3 cen, in vec3 rad ) 
{
    vec3 m = 1.0/rd;
    vec3 n = m*(ro-cen);
    vec3 k = abs(m)*rad;
	
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	
	if( tN > tF || tF < 0.0) return vec2(-1.0);

	return vec2( tN, tF );
}


float hash1( in vec2 p )
{
    return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 tot = vec3(0.0);
    
#if AA>1
    for( int m=0; m<AA; m++ )
    for( int n=0; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
#else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
#endif

        // camera position
        vec3 ro = vec3( -0.5, 0.4, 1.5 );
        vec3 ta = vec3( 0.0, 0.0, 0.0 );
        // camera matrix
        vec3 ww = normalize( ta - ro );
        vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
        vec3 vv = normalize( cross(uu,ww));
        // create view ray
        vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );

        // cylidner animation
        vec3  c_a =  0.2 + 0.3*sin(iTime*vec3(1.11,1.27,1.47)+vec3(2.0,5.0,6.0));
        vec3  c_b = -0.2 + 0.3*sin(iTime*vec3(1.23,1.41,1.07)+vec3(0.0,1.0,3.0));
        float c_ra =  0.3 + 0.2*sin(iTime*1.3+0.5);
        float c_rb =  0.3 + 0.2*sin(iTime*1.4+2.5);


        // render
        vec3 col = vec3(0.4)*(1.0-0.3*length(p));

        // raytrace
        vec4 tnor = iCappedCone( ro, rd, c_a, c_b, c_ra, c_rb );
        float t = tnor.x;
        float tmin = 1e10;
        if( t>0.0 )
        {
            tmin = t;
            // shading/lighting	
            vec3 pos = ro + t*rd;
            vec3 nor = tnor.yzw;
            float dif = clamp( dot(nor,vec3(0.5,0.7,0.2)), 0.0, 1.0 );
            float amb = 0.5 + 0.5*dot(nor,vec3(0.0,1.0,0.0));
            col = sqrt( vec3(0.2,0.3,0.4)*amb + vec3(0.8,0.7,0.5)*dif );
            col *= vec3(1.0,0.75,0.3);
        }


        // compute bounding box of cylinder
        bound3 bbox = ConeAABB( c_a, c_b, c_ra, c_rb );

        // raytrace bounding box
        vec3 bcen = 0.5*(bbox.mMin+bbox.mMax);
        vec3 brad = 0.5*(bbox.mMax-bbox.mMin);
        vec2 tbox = iBox( ro, rd, bcen, brad );
        if( tbox.x>0.0 )
        {
            // back face
            if( tbox.y < tmin )
            {
                vec3 pos = ro + rd*tbox.y;
                vec3 e = smoothstep( brad-0.03, brad-0.02, abs(pos-bcen) );
                float al = 1.0 - (1.0-e.x*e.y)*(1.0-e.y*e.z)*(1.0-e.z*e.x);
                col = mix( col, vec3(0.0), 0.25 + 0.75*al );
            }
            // front face
            if( tbox.x < tmin )
            {
                vec3 pos = ro + rd*tbox.x;
                vec3 e = smoothstep( brad-0.03, brad-0.02, abs(pos-bcen) );
                float al = 1.0 - (1.0-e.x*e.y)*(1.0-e.y*e.z)*(1.0-e.z*e.x);
                col = mix( col, vec3(0.0), 0.15 + 0.85*al );
            }
        }

        // no gamma required here, it's done in line 118

        tot += col;
#if AA>1
    }
    tot /= float(AA*AA);
#endif

    // dithering
    tot += ((hash1(fragCoord.xy)+hash1(fragCoord.yx+13.1))/2.0 - 0.5)/256.0;


	fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'WdjSRK';
  }
  name(): string {
    return 'Cone - bounding box';
  }
  sort() {
    return 162;
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
