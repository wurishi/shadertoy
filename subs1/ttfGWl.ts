import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define AA 5

uniform int u_method;

float dot2( in vec3 v ) { return dot(v,v); }
float maxcomp( in vec2 v ) { return max(v.x,v.y); }

vec3 closestTriangle( in vec3 v0, in vec3 v1, in vec3 v2, in vec3 p )
{
    vec3 v10 = v1 - v0; vec3 p0 = p - v0;
    vec3 v21 = v2 - v1; vec3 p1 = p - v1;
    vec3 v02 = v0 - v2; vec3 p2 = p - v2;
    vec3 nor = cross( v10, v02 );
    if(u_method == 1) {
      // method 1, in 3D space
      if( dot(cross(v10,nor),p0)<0.0 ) return v0 + v10*clamp( dot(p0,v10)/dot2(v10), 0.0, 1.0 );
      if( dot(cross(v21,nor),p1)<0.0 ) return v1 + v21*clamp( dot(p1,v21)/dot2(v21), 0.0, 1.0 );
      if( dot(cross(v02,nor),p2)<0.0 ) return v2 + v02*clamp( dot(p2,v02)/dot2(v02), 0.0, 1.0 );
      return p - nor*dot(nor,p0)/dot2(nor);
    }
    else {
      // method 2, in barycentric space
      vec3  q = cross( nor, p0 );
      float d = 1.0/dot2(nor);
      float u = d*dot( q, v02 );
      float v = d*dot( q, v10 );
      float w = 1.0-u-v;
      
          if( u<0.0 ) { w = clamp( dot(p2,v02)/dot2(v02), 0.0, 1.0 ); u = 0.0; v = 1.0-w; }
      else if( v<0.0 ) { u = clamp( dot(p0,v10)/dot2(v10), 0.0, 1.0 ); v = 0.0; w = 1.0-u; }
    else if( w<0.0 ) { v = clamp( dot(p1,v21)/dot2(v21), 0.0, 1.0 ); w = 0.0; u = 1.0-v; }
      
      return u*v1 + v*v2 + w*v0;
    }

}

//==================================================================

float iTriangle( in vec3 ro, in vec3 rd, in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 v1v0 = v1 - v0;
    vec3 v2v0 = v2 - v0;
    vec3 rov0 = ro - v0;

    vec3  n = cross( v1v0, v2v0 );
    vec3  q = cross( rov0, rd );
    float d = 1.0/dot( rd, n );
    float u = d*dot( -q, v2v0 );
    float v = d*dot(  q, v1v0 );
    float t = d*dot( -n, rov0 );

    if( u<0.0 || v<0.0 || (u+v)>1.0 ) t = -1.0;
    
    return t;
}

float iSphere( in vec3 ro, in vec3 rd, in vec4 sph )
{
	vec3 oc = ro - sph.xyz;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - sph.w*sph.w;
	float h = b*b - c;
	if( h<0.0 ) return -1.0;
	return -b - sqrt( h );
}

float iPlane( in vec3 ro, in vec3 rd, in float h )
{
    return (h-ro.y)/rd.y;
}


float iCylinder( in vec3 ro, in vec3 rd, 
                 in vec3 pa, in vec3 pb, float ra )
{
    vec3 ba = pb-pa;

    vec3  oc = ro - pa;

    float baba = dot(ba,ba);
    float bard = dot(ba,rd);
    float baoc = dot(ba,oc);
    
    float k2 = baba            - bard*bard;
    float k1 = baba*dot(oc,rd) - baoc*bard;
    float k0 = baba*dot(oc,oc) - baoc*baoc - ra*ra*baba;
    
    float h = k1*k1 - k2*k0;
    if( h<0.0 ) return -1.0;
    h = sqrt(h);
    float t = (-k1-h)/k2;

    // body
    float y = baoc + t*bard;
    if( y>0.0 && y<baba ) return t;
    
    return -1.0;
}

vec3 nPlane( void )
{
    return vec3(0.0,1.0,0.0);
}

vec3 nTriangle( in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 v1v0 = v1 - v0;
    vec3 v2v0 = v2 - v0;
    
    return normalize( cross( v1v0, v2v0 ) );
}

vec3 nCylinder( in vec3 pos, in vec3 a, in vec3 b, in float r )
{
    vec3  ba = b - a;
    vec3  pa = pos - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return (pa - h*ba)/r;
}

vec3 nSphere( in vec3 pos, in vec4 sph )
{
    return (pos-sph.xyz)/sph.w;
}

float oTriangle( in vec3 pos, in vec3 nor, in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 a = normalize( v0 - pos );
    vec3 b = normalize( v1 - pos );
    vec3 c = normalize( v2 - pos );
    
    float s = sign(dot(v0-pos,cross(v1-v0,v2-v1))); // side of the triangle

    return s*(dot( nor, normalize( cross(a,b)) ) * acos( dot(a,b) ) +
              dot( nor, normalize( cross(b,c)) ) * acos( dot(b,c) ) +
              dot( nor, normalize( cross(c,a)) ) * acos( dot(c,a) ) ) / 6.2831;
}

float oSphere( in vec3 pos, in vec3 nor, in vec4 sph )
{
    vec3  di = sph.xyz - pos;
    float l  = length(di);
    float nl = dot(nor,di/l);
    float h  = l/sph.w;
    float h2 = h*h;
    float k2 = 1.0 - h2*nl*nl;

    float res = max(0.0,nl)/h2;
    if( k2 > 0.0 ) 
        res = pow( clamp(0.5*(nl*h+1.0)/h2,0.0,1.0), 1.5 );

    return res;
}

//=====================================================

struct Scene
{
    vec3 v1;
	vec3 v2;
	vec3 v3;
    vec3 pA;
    vec3 pB;
};
    


vec2 intersect( in vec3 ro, in vec3 rd, in Scene scn )
{
    vec2 res = vec2(1e10,-1.0);
    
    float t = iPlane(ro,rd,-1.0);
    if( t>0.0 ) res = vec2( t, 1.0 );
    
    t = iTriangle( ro, rd, scn.v1, scn.v2, scn.v3 );
    if( t>0.0 ) res = vec2( t, 2.0 );
    
    t = iSphere( ro, rd, vec4(scn.pA,0.07) );
    if( t>0.0 && t<res.x ) res = vec2( t, 3.0 );
    
    t = iSphere( ro, rd, vec4(scn.pB,0.07) );
    if( t>0.0 && t<res.x ) res = vec2( t, 4.0 );
                
	t = iCylinder( ro, rd, scn.pA, scn.pB, 0.02 );
    if( t>0.0 && t<res.x ) res = vec2( t, 5.0 );

    return res;
}

vec3 calcNormal( in vec3 pos, in float objID, in Scene scn )
{
    if( objID<1.5 ) return nPlane();
    if( objID<2.5 ) return nTriangle( scn.v1, scn.v2, scn.v3 );
    if( objID<3.5 ) return nSphere( pos, vec4(scn.pA,0.07) );
    if( objID<4.5 ) return nSphere( pos, vec4(scn.pB,0.07) );
    if( objID<5.5 ) return nCylinder( pos, scn.pA, scn.pB, 0.02 );
    return vec3(0.0,1.0,0.0);
}


float calcOcclusion( in vec3 pos, in vec3 nor, in float objID, in Scene scn )
{
    float occ = 1.0;

    occ *= clamp( 0.5+0.5*nor.y, 0.0, 1.0 );
    occ *= 1.0-oSphere( pos, nor, vec4(scn.pA,0.07) );
    occ *= 1.0-oSphere( pos, nor, vec4(scn.pB,0.07) );

    if( abs(objID-2.0)>0.5 ) occ *= 1.0-oTriangle( pos, nor, scn.v1, scn.v2, scn.v3 );
    
    return occ;
}

const vec3 lig = normalize(vec3(1.0,0.9,0.7));



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    
    vec4 tot = vec4(0.0);
#if AA>1
	#define ZERO min(iFrame,0)
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        // 2 pixel wide triangular kernel
        vec2 o = 2.0*vec2(float(m),float(n)) / float(AA-1) - 1.0;
        float r = maxcomp(abs(o)); o = r*normalize(o*(2.0+abs(o))+0.000001); // square to circle
        float w = 1.0 - r*0.75;
        vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;
        float t = iTime - (1.0/30.0)*float(m*AA+n)/float(AA*AA-1);
#else    
        vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
        float t = iTime;
        float w = 1.0;
#endif

        Scene scn;
        scn.v1 = 1.8*vec3(1.0,0.5,1.0)*cos( 0.1*t + vec3(0.0,1.0,1.0) + 0.0 );
        scn.v2 = 1.8*vec3(1.0,0.5,1.0)*cos( 0.1*t + vec3(0.0,2.0,3.0) + 2.0 );
        scn.v3 = 1.8*vec3(1.0,0.5,1.0)*cos( 0.1*t + vec3(0.0,3.0,5.0) + 4.0 );
        scn.pA = vec3(1.1*cos(1.5*t+1.0),0.8+0.4*cos(t*1.1),1.1*cos(1.3*t+3.0));
        scn.pB = closestTriangle( scn.v1, scn.v2, scn.v3, scn.pA );

        
        vec3 ro = vec3(0.0, 0.25, 4.0 );
        vec3 rd = normalize( vec3(p,-2.0) );

        vec3 col = vec3(0.0);

        vec2 tm = intersect( ro, rd, scn );
        if( tm.y>0.0 )
        {
            float t = tm.x;
            vec3 pos = ro + t*rd;
            vec3 nor = calcNormal(pos, tm.y, scn);
            nor *= -sign(dot(nor,rd));
            float occ = calcOcclusion( pos, nor, tm.y, scn );
            col += vec3(1.4)*occ;
            col *= 0.55+0.45*cos(tm.y*3.5+vec3(0.0,1.0,1.5));
            col *= exp( -0.05*t );
        }

        col = pow( clamp(col,0.0,1.0), vec3(0.4545) );

        tot += w*vec4(col,1.0);
#if AA>1
    }
    tot.xyz /= tot.w;
#endif

    
    fragColor = vec4( tot.xyz, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_method: 1,
};
export default class implements iSub {
  key(): string {
    return 'ttfGWl';
  }
  name(): string {
    return 'Triangle - closest';
  }
  sort() {
    return 191;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_method', { '3D': 1, Barycentric: 2 }).name('space');
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
    const u_method = webglUtils.getUniformLocation(gl, program, 'u_method');
    return () => {
      u_method.uniform1i(api.u_method);
    };
  }
}
