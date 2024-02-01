import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_show;

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
    // closest sphere
    vec3  ba = b - a, pa = p - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    vec3  d = pa - h*ba;
    float l = length(d);
    float o = 1.0 - max(0.0,dot(-d,n))*r*r/(l*l*l);
    // tune
    return sqrt(o*o*o);
}

vec2 hash2( float n ) { return fract(sin(vec2(n,n+1.0))*vec2(43758.5453123,22578.1459123)); }


#define AA 3

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
     // camera movement	
	float an = 0.5*iTime;
	vec3 ro = vec3( 1.0*cos(an), 0.5, 1.0*sin(an) );
    vec3 ta = vec3( 0.0, 0.0, 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));

    
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

        // create view ray
	    vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );
    
        vec4 rrr = texture( iChannel0, (fragCoord.xy)/iChannelResolution[0].xy, -99.0  ).xzyw;


        vec3  capA = vec3(0.0,0.3,0.0) + vec3(0.5,0.15,0.5)*cos( iTime*1.1 + vec3(0.0,1.0,4.0) );
        vec3  capB = vec3(0.0,0.3,0.0) + vec3(0.5,0.15,0.5)*cos( iTime*1.7 + vec3(2.0,5.0,3.0) );
        const float capR = 0.15;
        
    	vec3 col = vec3(0.0);

        const vec3 lig = normalize(vec3(-0.8,0.8,0.2));
    
        // capsule
        float tmin = 1e20;
        float occ = 1.0;
        vec3 nor;
    
        {
            float t = capIntersect( ro, rd, capA, capB, capR );
            if( t>0.0 )
            {
                tmin = t;
                vec3 pos = ro + t*rd;
                nor = capNormal(pos, capA, capB, capR );
                col = vec3( 0.5 + 0.5*nor.y );
            }
        }
        // plane (floor)
        {
            float t = (-0.0-ro.y)/rd.y;
            if( t>0.0 && t<tmin )
            {
                tmin = t;
                vec3 pos = ro + t*rd;
                nor = vec3(0.0,1.0,0.0);
                if(u_show) {
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
                      float res = capIntersect( pos, dir, capA, capB, capR );
                      occ += step(0.0,res);
                  }
                  occ = 1.0 - occ/256.0;
                }
                else {
                  occ = capOcclusion( pos, nor, capA, capB, capR ); 
                }
                col = vec3(occ);
            }
        }
	
        col = sqrt( col );
	
	    tot += col;
    #if AA>1
    }
    tot /= float(AA*AA);
    #endif

	fragColor = vec4( tot, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_show: false,
};

export default class implements iSub {
  key(): string {
    return 'llGyzG';
  }
  name(): string {
    return 'Capsule - occlusion';
  }
  sort() {
    return 126;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_show');
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
    const u_show = webglUtils.getUniformLocation(gl, program, 'u_show');
    return () => {
      u_show.uniform1i(api.u_show ? 1 : 0);
    };
  }
}
