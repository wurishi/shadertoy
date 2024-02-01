import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define AA 3

uniform int u_shadow;

//================================================================

// fakesoft shadow occlusion
float capShadow( in vec3 ro, in vec3 rd, in vec3 a, in vec3 b, in float r, in float k )
{
    vec3 ba =  b - a;
	  vec3 oa = ro - a;

    // closest distance between ray and segment
    vec3 th;
    if(u_shadow == 1) {
      // naive way to solve the 2x2 system of equations
      float oad  = dot( oa, rd );
      float dba  = dot( rd, ba );
      float baba = dot( ba, ba );
      float oaba = dot( oa, ba );
      vec2 th2 = vec2( -oad*baba + dba*oaba, oaba - oad*dba ) / (baba - dba*dba);
      th.xy = th2.xy;
    }
    else {
      // fizzer's way to solve the 2x2 system of equations
      th = inverse(mat3(-rd,ba,cross(rd,ba))) * oa;
    }
    
	th.x = max(   th.x, 0.0001 );
	th.y = clamp( th.y, 0.0, 1.0 );
	
	vec3  p =  a + ba*th.y;
	vec3  q = ro + rd*th.x;
    float d = length( p-q )-r;

    // fake shadow
    float s = clamp( k*d/th.x+0.5, 0.0, 1.0 );
    return s*s*(3.0-2.0*s);
}


//================================================================
// intersect capsule
float capIntersect( in vec3 ro, in vec3 rd, in vec3 pa, in vec3 pb, in float r )
{
    vec3  ba = pb - pa;
    vec3  oa = ro - pa;

    float baba = dot(ba,ba);
    float bard = dot(ba,rd);
    float baoa = dot(ba,oa);
    float rdoa = dot(rd,oa);
    float oaoa = dot(oa,oa);

    float a = baba      - bard*bard;
    float b = baba*rdoa - baoa*bard;
    float c = baba*oaoa - baoa*baoa - r*r*baba;
    float h = b*b - a*c;
    if( h>=0.0 )
    {
        float t = (-b-sqrt(h))/a;

        float y = baoa + t*bard;
        
        // body
        if( y>0.0 && y<baba ) return t;

        // caps
        vec3 oc = (y<=0.0) ? oa : ro - pb;
        b = dot(rd,oc);
        c = dot(oc,oc) - r*r;
        h = b*b - c;
        if( h>0.0 )
        {
            return -b - sqrt(h);
        }
    }
    return -1.0;
}

// compute normal
vec3 capNormal( in vec3 pos, in vec3 a, in vec3 b, in float r )
{
    vec3  ba = b - a;
    vec3  pa = pos - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return (pa - h*ba)/r;
}


// fake occlusion
float capOcclusion( in vec3 p, in vec3 n, in vec3 a, in vec3 b, in float r )
{
    vec3  ba = b - a, pa = p - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    vec3  d = pa - h*ba;
    float l = length(d);
    float o = 1.0 - max(0.0,dot(-d,n))*r*r/(l*l*l);
    return sqrt(o*o*o);
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
     // camera movement	
	float an = 0.5*iTime;
	vec3 ro = vec3( 1.0*cos(an), 0.4, 1.0*sin(an) );
    vec3 ta = vec3( 0.0, 0.0, 0.0 );

    
    vec3 tot = vec3(0.0);
#if AA>1
	#define ZERO min(iFrame,0)
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;
#else    
        vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
#endif

        // camera matrix
        vec3 ww = normalize( ta - ro );
        vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
        vec3 vv = normalize( cross(uu,ww));
        // create view ray
        vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );

        const vec3  capA = vec3(-0.3,-0.1,-0.1);
        const vec3  capB = vec3(0.3,0.1,0.4);
        const float capR = 0.2;

        vec3 col = vec3(0.0);

        const vec3 lig = normalize(vec3(-0.8,0.8,0.2));

        float tmin = 1e20;
        float sha = 1.0;
        float occ = 1.0;
        vec3 nor;

        // plane (floor)
        {
            float t = (-0.3-ro.y)/rd.y;
            if( t>0.0 && t<tmin )
            {
                tmin = t;
                vec3 pos = ro + t*rd;
                nor = vec3(0.0,1.0,0.0);
                // fake soft shadow!
                sha = capShadow( pos+0.001*nor, lig, capA, capB, capR, 4.0 ); 
                // fake occlusion 
                occ = capOcclusion( pos, nor, capA, capB, capR ); 
            }
        }

        // capsule
        {
            float t = capIntersect( ro, rd, capA, capB, capR );
            if( t>0.0 && t<tmin )
            {
                tmin = t;
                vec3 pos = ro + t*rd;
                nor = capNormal(pos, capA, capB, capR );
                occ = 0.5 + 0.5*nor.y;
                sha = 1.0;
            }
        }

        // lighting
        if( tmin<1e19 )
        {
            float dif = clamp( dot(nor,lig), 0.0, 1.0 )*sha;
            float amb = 1.0*occ;
            col =  vec3(0.2,0.3,0.4)*amb;
            col += vec3(0.7,0.6,0.5)*dif*0.8;
        }

        tot += sqrt( col );
#if AA>1
    }
    tot /= float(AA*AA);
#endif
    
	fragColor = vec4( tot, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_shadow: 1,
};

export default class implements iSub {
  key(): string {
    return 'MlGczG';
  }
  name(): string {
    return 'Capsule - soft shadow';
  }
  sort() {
    return 177;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_shadow', { "fizzer's way": 0, 'naive way': 1 });
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
    const u_shadow = webglUtils.getUniformLocation(gl, program, 'u_shadow');
    return () => {
      u_shadow.uniform1i(api.u_shadow);
    };
  }
}
