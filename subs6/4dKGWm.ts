import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// The MIT License
// Copyright © 2016 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


// https://iquilezles.org/www/articles/smin/smin.htm
float smin( float a, float b, float k )
{
    //return min(a,b);
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}

// https://iquilezles.org/www/articles/smin/smin.htm
float smax( float a, float b, float k )
{
    return -smin(-a,-b,k);
}

// https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
vec2 sdSegment( in vec3 p, vec3 a, vec3 b )
{
	vec3 pa = p - a, ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return vec2( length( pa - ba*h ), h );
}

// https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdEllipsoid( in vec3 p, in vec3 c, in vec3 r )
{
#if 1   
    return (length( (p-c)/r ) - 1.0) * min(min(r.x,r.y),r.z);
#else
    p -= c;
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
#endif    
}

// http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
float det( vec2 a, vec2 b ) { return a.x*b.y-b.x*a.y; }
vec3 getClosest( vec2 b0, vec2 b1, vec2 b2 ) 
{
  float a =     det(b0,b2);
  float b = 2.0*det(b1,b0);
  float d = 2.0*det(b2,b1);
  float f = b*d - a*a;
  vec2  d21 = b2-b1;
  vec2  d10 = b1-b0;
  vec2  d20 = b2-b0;
  vec2  gf = 2.0*(b*d21+d*d10+a*d20); gf = vec2(gf.y,-gf.x);
  vec2  pp = -f*gf/dot(gf,gf);
  vec2  d0p = b0-pp;
  float ap = det(d0p,d20);
  float bp = 2.0*det(d10,d0p);
  float t = clamp( (ap+bp)/(2.0*a+b+d), 0.0 ,1.0 );
  return vec3( mix(mix(b0,b1,t), mix(b1,b2,t),t), t );
}

vec2 sdBezier( vec3 a, vec3 b, vec3 c, vec3 p, out vec2 pos )
{
	vec3 w = normalize( cross( c-b, a-b ) );
	vec3 u = normalize( c-b );
	vec3 v = normalize( cross( w, u ) );

	vec2 a2 = vec2( dot(a-b,u), dot(a-b,v) );
	vec2 b2 = vec2( 0.0 );
	vec2 c2 = vec2( dot(c-b,u), dot(c-b,v) );
	vec3 p3 = vec3( dot(p-b,u), dot(p-b,v), dot(p-b,w) );

	vec3 cp = getClosest( a2-p3.xy, b2-p3.xy, c2-p3.xy );

    pos = cp.xy;
    
	return vec2( sqrt(dot(cp.xy,cp.xy)+p3.z*p3.z), cp.z );
}

// https://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdSphere( in vec3 p, in vec3 c, in float r )
{
    return length(p-c) - r;
}

// https://iquilezles.org/www/articles/intersectors/intersectors.htm
vec2 iCylinderY( in vec3 ro, in vec3 rd, in vec4 sph )
{
	vec3 oc = ro - sph.xyz;
    float a = dot( rd.xz, rd.xz );
	float b = dot( oc.xz, rd.xz );
	float c = dot( oc.xz, oc.xz ) - sph.w*sph.w;
	float h = b*b - a*c;
	if( h<0.0 ) return vec2(-1.0);
    h = sqrt(h);
	return vec2(-b-h, -b+h )/a;
}

// https://www.shadertoy.com/view/llsSzn
float eliSoftShadow( in vec3 ro, in vec3 rd, in vec3 sphcen, in vec3 sphrad, in float k )
{
    vec3 oc = ro - sphcen;
    
    vec3 ocn = oc / sphrad;
    vec3 rdn = rd / sphrad;
    
    float a = dot( rdn, rdn );
	float b = dot( ocn, rdn );
	float c = dot( ocn, ocn );
	float h = b*b - a*(c-1.0);

    float t = (-b - sqrt( max(h,0.0) ))/a;

    return (h>0.0) ? step(t,0.0) : smoothstep(0.0, 1.0, -k*h/max(t,0.0) );
}

// https://iquilezles.org/www/articles/biplanar/biplanar.htm
vec4 texcube( sampler2D sam, in vec3 p, in vec3 n, in float k, in vec3 g1, in vec3 g2 )
{
    vec3 m = pow( abs( n ), vec3(k) );
	vec4 x = textureGrad( sam, p.yz, g1.yz, g2.yz );
	vec4 y = textureGrad( sam, p.zx, g1.zx, g2.zx );
	vec4 z = textureGrad( sam, p.xy, g1.xy, g2.xy );
	return (x*m.x + y*m.y + z*m.z) / (m.x + m.y + m.z);
}

float hash1( float n )
{
    return fract(sin(n)*43758.5453123);
}

vec2 hash2( in vec2 f ) 
{ 
    float n = f.x+131.1*f.y;
    return fract(sin(vec2(n,n+113.0))*43758.5453123); 
}

vec2 hash2( float n )
{
    return fract(sin(vec2(n,n+1.0))*vec2(43758.5453123,22578.1459123));
}

vec3 hash3( float n )
{
    return fract(sin(n+vec3(0.0,13.1,31.3))*158.5453123);
}

vec3 forwardSF( float i, float n) 
{
    const float PI  = 3.141592653589793238;
    const float PHI = 1.618033988749894848;
    float phi = 2.0*PI*fract(i/PHI);
    float zi = 1.0 - (2.0*i+1.0)/n;
    float sinTheta = sqrt( 1.0 - zi*zi);
    return vec3( cos(phi)*sinTheta, sin(phi)*sinTheta, zi);
}

mat3 base( in vec3 ww )
{
    vec3  vv = vec3(0.0,0.0,1.0);
    vec3  uu = normalize( cross( vv, ww ) );
    return mat3(uu.x,ww.x,vv.x,
                uu.y,ww.y,vv.y,
                uu.z,ww.z,vv.z);
}

mat3 setCamera( in vec3 ro, in vec3 rt, in float cr )
{
	vec3 cw = normalize(rt-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, -cw );
}

#define ZERO (min(iFrame,0))
`;

const buffA = `
// Created by inigo quilez - iq/2016
// I share this piece (art and code) here in Shadertoy and through its Public API, only for educational purposes. 
// You cannot use, sell, share or host this piece or modifications of it as part of your own commercial or non-commercial product, website or project.
// You can share a link to it or an unmodified screenshot of it provided you attribute "by Inigo Quilez, @iquilezles and iquilezles.org". 
// If you are a teacher, lecturer, educator or similar and these conditions are too restrictive for your needs, please contact me and we'll work it out.

#define USE_REPROJECTION

float leg( in vec3 p, in vec3 pa, in vec3 pb, in vec3 pc, float m, float h, float sc )
{
    vec2 b = sdSegment( p, pa, pb );

    float tr = 0.35 - 0.16*smoothstep(0.0,1.0,b.y);
    float d3 = b.x - tr*sc;

    b = sdSegment( p, pb, pc );
    tr = 0.18;
    d3 = smin( d3, b.x - tr*sc, 0.1 );

    vec3 ww = normalize( mix( normalize(pc-pb), vec3(0.0,1.0,0.0), h) );
    mat3 pr = base( ww );
    vec3 fc = pr*((p-pc))-vec3(0.02,0.0,0.0)*(-1.0+2.0*h);
    float d4 = sdEllipsoid( fc, vec3(0.0), vec3(0.2,0.15,0.2) );

    d3 = smin( d3, d4, 0.1 );

	return d3;
}

float mapElephantSimple( vec3 p )
{
    p.x -= -0.5;
	p.y -= 2.4;
    
    // head
    float d = sdEllipsoid( p, vec3(0.0,0.0,0.0), vec3(0.55,0.55,0.35) );


    // body
    {
    float co = cos(0.4);
    float si = sin(0.4);
    vec3 w = p;
    w.xy = mat2(co,si,-si,co)*w.xy;

    float d4 = sdEllipsoid( w, vec3(0.6,0.3,0.0), vec3(0.6,0.6,0.6) );
	d = smin(d, d4, 0.1 );

    d4 = sdEllipsoid( w, vec3(1.8,0.3,0.0), vec3(1.2,0.9,0.7) );
	d = smin(d, d4, 0.2 );

    d4 = sdEllipsoid( w, vec3(2.1,0.55,0.0), vec3(1.0,0.9,0.6) );
	d = smin(d, d4, 0.1 );

    d4 = sdEllipsoid( w, vec3(2.0,0.8,0.0), vec3(0.7,0.6,0.8) );
	d = smin(d, d4, 0.1 );

    }
    vec3 q = vec3( p.xy, abs(p.z) );

    // back-left leg
    {
    float d3 = leg( q, vec3(2.6,-0.6,0.3), vec3(2.65,-1.45,0.3), vec3(2.6,-2.1,0.25), 1.0, 0.0, 1.0 );
    d = smin(d,d3,0.1);
    }

    
    // front-left leg
    float d3 = leg( p, vec3(0.8,-0.4,0.3), vec3(0.7,-1.55,0.3), vec3(0.8,-2.1,0.3), 1.0, 0.0, 1.0 );
    d = smin(d,d3,0.15);
    d3 = leg( p, vec3(0.8,-0.4,-0.3), vec3(0.4,-1.55,-0.3), vec3(0.4,-2.1,-0.3), 1.0, 0.0, 1.0 );
    d = smin(d,d3,0.15);
    
    return d;
}

float mapTree( vec3 p )
{
    float f = length(p);
    if( f>8.0 )
        return f - 8.0 + 0.1;

    vec3 q = p;   
    
    p.xz += 0.1*sin(4.0*p.y+vec2(0.0,1.0));
    vec2 s1 = sdSegment( p, vec3(0.0,-2.0,0.0), vec3(-2.0,3.3,4.0) );
    float d2 = s1.x - (0.25 - 0.12*s1.y);
    s1 = sdSegment( p, vec3(0.0,-2.0,0.0), vec3(-3.0,3.3,0.0) );
    float d4 = s1.x - (0.25 - 0.12*s1.y);
    d2 = min( d2, d4 );
    s1 = sdSegment( p, mix( vec3(0.0,-2.0,0.0), vec3(-3.0,3.3,-1.0), 0.35 ), vec3(-2.0,3.3,-4.0) );
    d4 = s1.x - (0.25 - 0.12*s1.y);
    d2 = min( d2, d4 );
    
    p.y += length(p.xz)*0.1;
    p.y += 0.5*sin(p.x);
    
    float nn = textureLod(iChannel2,0.1*q.zy, 0.0).x;
    d4 = sdEllipsoid( p, vec3( 0.0,3.3,0.0), vec3(4.5,0.9,4.5)*(1.0+nn) );
    
    d4 += max(0.0,3.0*sin(1.5*q.x)*sin(1.5*q.y)*sin(1.5*q.z)*clamp( 1.0 - d4/3.0, 0.0, 1.0 ));

    return min( d2, d4 );
}

mat3 rotationMat( in vec3 xyz )
{
    vec3 si = sin(xyz);
    vec3 co = cos(xyz);

	return mat3( co.y*co.z,                co.y*si.z,               -si.y,    
                 si.x*si.y*co.z-co.x*si.z, si.x*si.y*si.z+co.x*co.z, si.x*co.y,
                 co.x*si.y*co.z+si.x*si.z, co.x*si.y*si.z-si.x*co.z, co.x*co.y );
}

vec2 map( vec3 p, out vec3 matInfo )
{
    matInfo = vec3(0.0);
    
    p.x -= -0.5;
	p.y -= 2.4;
    
    //--------------------
    // ground
    //--------------------
    
    float h = 2.1 + 0.1*textureLod( iChannel2, 0.07*p.xz, 0.0 ).x;
    float d2 = p.y + h;
    vec2 res = vec2( d2, 3.0 );

    
    //--------------------
    // leaves
    //--------------------
#if 1
    for( int j=ZERO; j<2; j++ )
    {
        float dleaves = 1000.0;

        vec3         pl = p - vec3(-0.85,0.30,2.1);
        vec3         pd = vec3(-0.2,-0.5,-0.3);
        if( j==1 ) { pl = p - vec3(-0.00,0.45,2.2);
                     pd = vec3( 0.2,-0.6, 0.1); };
        
        float pr = dot(pl,pl);
        if( sqrt(pr)-1.5<res.x && pr<1.5 )
        {
            float sim = 1.0;
            vec2 uv = vec2(0.0);
            for( int i=ZERO; i<9; i++ )
            {
                float h = float(i);
                float hh = float(i+10*j);
                vec3 sc = hash3(hh*13.92);
                vec3 di = sin(vec3(0.0,1.0,2.0)+hh*vec3(10.0,15.0,20.0));
                vec3 of = pd*h/8.0;

                vec3 q = pl - of;
                q = rotationMat( 6.2831*di*vec3(0.1,-0.1,0.9) + 0.04*sin(20.0*hh + 0.7*iTime) ) * q;

                q.z = q.z*sim - 0.22;

                q.xz += q.y*q.y*2.0;

                q *= 0.75 + 0.4*sc.x;

                d2 =          sdSphere( q, vec3(0.0,-0.1,0.0), 0.25 );
                d2 = max( d2, sdSphere( q, vec3(0.0, 0.1,0.0), 0.25 ) );
                d2 = smax( d2, abs(q.x)-0.003, 0.01 );

                d2 /= 0.75 + 0.4*sc.x;

                if( d2<dleaves )
                {
                    dleaves = d2;
                    uv = q.yz;
                }
                sim *= -1.0;
            }
            vec2 s2 = sdSegment( pl, vec3(0.0), pd );
            d2 = s2.x - 0.01;
            dleaves = min(dleaves,d2); 
            if( dleaves<res.x ) 
            {
                res = vec2( dleaves, 6.0 );
                matInfo.x = 0.0;
                matInfo.yz = uv;
            }
        }
    }
#endif

    //--------------------
    // bushes
    //--------------------
    
#if 1
    float bb = max( -(p.x-18.0), p.y+0.4 );
    if( bb<res.x )
    {
    vec2 idb = floor(p.xz/4.0);        
    //for( int j=ZERO; j<2; j++ )    
    //for( int i=ZERO; i<2; i++ )    
    {
        vec2 id = idb;// + vec2(float(i),float(j));
        if( id.x>4.0 )
        {
            float h = id.x*7.7 + id.y*13.1;
            float si = hash1(h*31.7);
            float al = hash1(h*41.9);

            if( si>0.5 )
            {
                vec3 bc = vec3(id.x*4.0+2.0,-2.0,id.y*4.0+2.0);
                bc.xz -= 1.0*hash3( h*7.7 ).xy;
                vec3 eli = vec3(1.6*(0.3 + 0.7*si),1.5*(0.5 + 0.5*al),1.6*(0.3 + 0.7*si));

                #if 0
                d2 = sdEllipsoid( p, bc, eli );
                if( d2<res.x ) 
                {
                    res = vec2( d2, 4.0 );
                    matInfo.x = hash1(h*77.7);
                }

                #else
                float d4 = 1000.0;
                float d3 = 0.0;
                for( int j=0; j<12; j++ )
                {
                    float h2 = float(j);
                    vec3 of = normalize((-1.0+2.0*hash3(h*11.11+h2*9.13)));

                    of.y = of.y*of.y - 0.1;
                    of *= eli;

                    vec3 bb = bc + of;
                    d2 = sdEllipsoid( p, bb, 0.5*vec3(1.0,0.85,1.0));

                    if( d2<d4)
                    {
                        d4 = d2;
                        d3 = hash1(h*77.7);
                    }
                }

                float di = textureLod(iChannel2,0.06*p.yz,0.0).x +
                           textureLod(iChannel2,0.06*p.xy,0.0).x;
                di /= 2.0;
                d4 -= 0.4*di*di;

                if( d4<res.x ) 
                {
                    res = vec2( d4, 4.0 );
                    matInfo.x = d3;
                    matInfo.y = di;
                }
                #endif
            }
        }
    }
    }
#endif    

    //--------------------
    // trees
    //--------------------
     
#if 1
    {
    const vec3 tc1 = vec3(50.0,0.0,-40.0);
    const vec3 tc2 = vec3(85.0,0.0,5.0);
    float td1 = dot(p.xz-tc1.xz,p.xz-tc1.xz);
    float td2 = dot(p.xz-tc2.xz,p.xz-tc2.xz);
    vec3 tc = (td1<td2) ? tc1 : tc2;
    bb = length(p-tc)-8.0;
    if( bb<res.x )
    {
    float d2 = mapTree( p - tc );
    if( d2<res.x ) 
    {
        res = vec2( d2, 5.0 );
        matInfo.x = 0.0;
    }
    }
    }
#endif

    return res;
}

float mapSmallElephantSimple( vec3 p )
{
    const float sca = 2.0;
    p.xz = mat2(0.8,0.6,-0.6,0.8)*p.xz;
    p *= sca;
    
    p -= vec3(-1.1,2.4,-2.0);
    
    vec3 ph = p;
    ph.yz = mat2(0.95,0.31225,-0.31225,0.95)*ph.yz;
        
    // head
    float d = sdEllipsoid( ph, vec3(0.0,0.0,0.0), vec3(0.45,0.55,0.35) );

    vec3 qh = vec3( ph.xy, abs(ph.z) );

    vec3 q = vec3( p.xy, abs(p.z) );

    // body
    {
    float co = cos(0.4);
    float si = sin(0.4);
    vec3 w = p;
    w.xy = mat2(co,si,-si,co)*w.xy;
        
    float d4 = sdEllipsoid( w, vec3(1.8,0.3,0.0), vec3(1.2,0.9,0.7) );
	d = smin(d, d4, 0.2 );

    }

    // back-left leg
    {
    float d3 = leg( q, vec3(2.6,-0.6,0.3), vec3(2.65,-1.4,0.3), vec3(2.6,-2.0,0.25), 1.0, 0.0, 0.75  );
    d = smin(d,d3,0.1);
    }
    
    
    // front-left leg
    {
    float d3 = leg( p, vec3(0.8,-0.4,0.2), vec3(0.6,-1.4,0.2), vec3(0.7,-1.9,0.2), 1.0, 0.0, 0.75 );
    d = smin(d,d3,0.15);
    d3 = leg( p, vec3(0.8,-0.4,-0.2), vec3(0.3,-1.4,-0.2), vec3(0.2,-1.9,-0.2), 1.0, 0.0, 0.75 );
    d = smin(d,d3,0.15);

    }
    
    return d/sca;
}

float mapWithElephants( vec3 p )
{
    vec3 kk;
    float res = map( p, kk ).x;

    res = min( res, mapElephantSimple(p) );
    res = min( res, mapSmallElephantSimple(p) );

    return res;
}

vec3 calcNormal( in vec3 pos, in float eps )
{
    vec3 kk;
#if 0
    vec2 e = vec2(1.0,-1.0)*0.5773*eps;
    return normalize( e.xyy*map( pos + e.xyy, kk ).x + 
					  e.yyx*map( pos + e.yyx, kk ).x + 
					  e.yxy*map( pos + e.yxy, kk ).x + 
					  e.xxx*map( pos + e.xxx, kk ).x );
#else
    // trick by klems, to prevent the compiler from inlining map() 4 times
    vec4 n = vec4(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec4 s = vec4(pos, 0.0);
        s[i] += eps*0.25;
        n[i] = map(s.xyz,kk).x;
    }
    return normalize(n.xyz-n.w);
#endif    
}

// https://iquilezles.org/www/articles/rmshadows/rmshadows.htm
float calcSoftShadow( in vec3 ro, in vec3 rd, float k )
{
    float res = 1.0;
    float t = 0.01;
    for( int i=0; i<24; i++ )
    {
        float h = mapWithElephants(ro + rd*t );
        res = min( res, smoothstep(0.0,1.0,k*h/t) );
        t += clamp( h, 0.05, 0.5 );
		if( res<0.01 ) break;
    }
    return clamp(res,0.0,1.0);
}

float calcAO( in vec3 pos, in vec3 nor )
{
	float ao = 0.0;
    for( int i=ZERO; i<8; i++ )
    {
        vec3 ap = forwardSF( float(i), 8.0 );
        float h = hash1(float(i));
        float dk = dot(ap,nor); if( dk<0.0 ) ap -= 2.0*nor*dk;
        ap *= h*0.3;
        ao += clamp( mapWithElephants( pos + nor*0.01 + ap )*2.4, 0.0, 1.0 );
    }
	ao /= 8.0;
	
    return clamp( ao*4.0*(1.0+0.25*nor.y), 0.0, 1.0 );
}

const vec3 sunDir = normalize( vec3(0.15,0.7,0.65) );

float dapples( in vec3 ro, in vec3 rd )
{
    float sha = eliSoftShadow( ro, rd, vec3(0.0,4.0,4.0), vec3(3.0,1.0,3.0), 10.0 );
    
    vec3 uu = normalize( cross( rd, vec3(0.0,0.0,1.0) ) );
    vec3 vv = normalize( cross( uu, rd ) );

    vec3 ce = vec3(0.0,4.0,5.0);
    float t = -dot(ro-ce,rd);
    vec3 po = ro + t*rd;
    vec2 uv = vec2( dot(uu,po-ce), dot(vv,po-ce) );

    float dap = 1.0-smoothstep( 0.1, 0.5, texture(iChannel3,0.25+0.4*uv).x );
    return 1.0 - 0.95*(1.0-sha)*(1.0-dap);
}

vec3 shade( in vec3 ro, in vec3 rd, in float t, in float m, in vec3 matInfo )
{
    float eps = 0.001;
    
    vec3 pos = ro + t*rd;
    vec3 nor = calcNormal( pos, eps*t );
    float kk;

    vec3 mateD = vec3(0.2,0.16,0.11);
    vec3 mateS = vec3(0.2,0.12,0.07);
    vec3 mateK = vec3(0.0,1.0,0.0); // amount, power, metalic
    float focc = 1.0;
    
    if( m<3.5 ) // ground
    {
        mateD = vec3(0.1,0.09,0.07)*0.27;
        mateS = vec3(0.0,0.0,0.0);
        mateD *= 2.0*texture( iChannel1, 0.1*pos.xz ).xyz;
        
        float gr = smoothstep( 0.3,0.4,texture(iChannel2,0.01*pos.zx).x );
        vec3 grcol = vec3(0.3,0.28,0.05)*0.07;
        grcol *= 0.5 + texture( iChannel2, 4.0*pos.xz ).x;
        mateD = mix( mateD, grcol, smoothstep( 0.9,1.0,nor.y)*gr );
        mateD *= 1.2;
        mateK = vec3(1.0,8.0,1.0);
    }
    else if( m<4.5) // bushes
    {
        mateD = vec3(0.2,0.32,0.07)*0.1;
        mateD.x += matInfo.x*0.02;
        mateS = vec3(0.8,0.9,0.1);
        focc = 1.0-matInfo.y;
        mateK = vec3(0.07,16.0,0.0);
    }
    else if( m<5.5 ) // trees
    {
        mateD = vec3(0.2,0.3,0.07)*0.07;
        mateS = vec3(0.0,0.0,0.0);
        mateK = vec3(0.2,16.0,0.0);
    }
    else // leaves
    {
        mateD = vec3(0.2,0.35,0.07)*0.2;
        mateS = vec3(0.8,1.0,0.1)*0.25;
        mateK = vec3(0.07,16.0,0.0);
        float te = texture( iChannel2, 0.35*matInfo.yz ).x;
        mateD *= 1.0 + 0.6*te;
        mateS *= 1.0 + 0.6*te;
        mateD += vec3(0.035) * (1.0-smoothstep(0.005,0.01,abs(matInfo.y)+matInfo.z*0.05) );
    }
    
    vec3 hal = normalize( sunDir-rd );
    float fre = clamp(1.0+dot(nor,rd), 0.0, 1.0 );
    float occ = calcAO( pos, nor )*focc;
        
    float dif1 = clamp( dot(nor,sunDir), 0.0, 1.0 );
    float bak = clamp( dot(nor,normalize(vec3(-sunDir.x,0.0,-sunDir.z))), 0.0, 1.0 );
    float sha = calcSoftShadow( pos, sunDir, 16.0 );
	sha = min( sha, dapples(pos,sunDir) );
              
    dif1 *= sha;
    float spe1 = clamp( dot(nor,hal), 0.0, 1.0 );
    float bou = clamp( 0.3-0.7*nor.y, 0.0, 1.0 );

    // sun
    vec3 col = 8.5*vec3(2.0,1.2,0.65)*dif1;
    // sky
    col += 4.5*vec3(0.35,0.7,1.0)*occ*clamp(0.2+0.8*nor.y,0.0,1.0);
    // ground
    col += 4.0*vec3(0.4,0.25,0.12)*bou*occ;
    // back
    col += 3.5*vec3(0.2,0.2,0.15)*bak*occ;
    // sss
    col += 25.0*fre*fre*(0.2+0.8*dif1*occ)*mateS;

    // sun
    vec3 hdir = normalize(sunDir - rd);
    float costd = clamp( dot(sunDir, hdir), 0.0, 1.0 );
    float spp = pow( spe1, mateK.y )*dif1*mateK.x * (0.04 + 0.96*pow(1. - costd,5.0));
    col += mateK.z*15.0*5.0*spp; 
    
    col *= mateD;

    col += (1.0-mateK.z)*15.0*5.0*spp; 
    
    return col;        
}

vec2 raycast( in vec3 ro, in vec3 rd, out vec3 matInfo )
{
    vec2 res = vec2(-1.0);

    float maxdist = 100.0;
    float t = 1.0;

    float tp = ( 8.0-ro.y)/rd.y; if( tp>0.0 ) maxdist = min( maxdist, tp );
          tp = (-2.2-ro.y)/rd.y; if( tp>0.0 ) maxdist = min( maxdist, tp );
    
    for( int i=0; i<110; i++ )
    {
        vec3 p = ro + t*rd;
        vec2 h = map( p, matInfo );
        res = vec2(t,h.y);
        if( h.x<(0.0001*t) ||  t>maxdist ) break;
        t += h.x*0.75;
    }

    if( t>maxdist )
    {
        res = vec2(-1.0);
    }

    return res;
}

float mapBk( in vec3 pos )
{
    float l = length(pos.xz);
    float f = smoothstep( 1000.0, 1500.0, l );

    float h = 200.0*f*texture( iChannel2, 0.001 + 0.00003*pos.xz ).x;

    return pos.y-h;
}

vec3 calcNormalBk( in vec3 pos, in float eps )
{
#if 0    
    vec2 e = vec2(1.0,-1.0)*0.5773*eps;
    return normalize( e.xyy*mapBk( pos + e.xyy ) + 
					  e.yyx*mapBk( pos + e.yyx ) + 
					  e.yxy*mapBk( pos + e.yxy ) + 
					  e.xxx*mapBk( pos + e.xxx ) );
#else
    // trick by klems, to prevent the compiler from inlining map() 4 times
    vec4 n = vec4(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec4 s = vec4(pos, 0.0);
        s[i] += eps;
        n[i] = mapBk(s.xyz);
    }
    return normalize(n.xyz-n.w);
#endif    
}

float calcSoftShadowBk( in vec3 ro, in vec3 rd, float k )
{
    float res = 1.0;
    float t = 0.01;
    for( int i=0; i<16; i++ )
    {
        float h = mapBk(ro + rd*t );
        res = min( res, smoothstep(0.0,1.0,k*h/t) );
        t += clamp( h, 10.0, 100.0 );
		if( res<0.01 ) break;
    }
    return clamp(res,0.0,1.0);
}

vec3 shadeBk( in vec3 ro, in vec3 rd, in float t )
{
    float eps = 0.005;
    
    vec3 pos = ro + t*rd;
    vec3 nor = calcNormalBk( pos, eps*t );
    float kk;

    vec3 mateD = vec3(0.14,0.14,0.12);
    mateD = mix( mateD, vec3(0.04,0.04,0.0), smoothstep(0.85,0.95, nor.y ) );
    mateD *= 0.3;
  
    mateD *= 0.1 + 2.0*texture( iChannel2, pos.xz*0.005 ).x;
    
    vec3 hal = normalize( sunDir-rd );
        
    float dif1 = clamp( dot(nor,sunDir), 0.0, 1.0 );
    //if( dif1>0.001 ) dif1 *= calcSoftShadowBk( pos, sunDir, 16.0 );

    // sun
    vec3 col = 8.0*vec3(1.8,1.2,0.8)*dif1;
    // sky
    col += 4.0*vec3(0.3,0.7,1.0)*clamp(0.2+0.8*nor.y,0.0,1.0);
    
    col *= mateD*1.2;
    return col;        
}

float intersectBk( in vec3 ro, in vec3 rd )
{
    float res = -1.0;

    float maxdist = 2000.0;
    float t = 1000.0;

    for( int i=0; i<100; i++ )
    {
        vec3 p = ro + t*rd;
        float h = mapBk( p );
        res = t;
        if( h<(0.0001*t) ||  t>maxdist ) break;
        t += h*0.75;
    }

    if( t>maxdist ) res = -1.0;

    return res;
}

vec3 render( in vec3 ro, in vec3 rd, out float resT )
{
    resT = 10000.0;
    
    // sky
    //vec3 col = clamp(vec3(0.7,0.9,1.0) - rd.y,0.0,1.0);
    vec3 col = clamp(vec3(0.75,0.9,1.0) - rd.y,0.0,1.0);
    
    // clouds
    float t = (1000.0-ro.y)/rd.y;
    if( t>0.0 )
    {
        vec2 uv = (ro+t*rd).xz;
        float cl = texture( iChannel2, .000013*uv ).x;
        cl = smoothstep(0.4,1.0,cl);
        col = mix( col, vec3(1.0), 0.4*cl );
    }

    // distant mountains
    {
    float tm = intersectBk( ro, rd );
    if( tm>-0.5  )
    {
        col = shadeBk( ro, rd, tm );
        float fa = 1.0-exp(-0.001*tm);
        vec3 pos = ro + rd*tm;
        fa *= exp(-0.001*pos.y);
        col = mix( col, vec3(0.35,0.5,0.8), fa );
        resT = tm;
    }
    }
    
    // landscape
    vec3 matInfo;
    vec2 tm = raycast( ro, rd, matInfo );
    if( tm.y>-0.5  )
    {
        col = shade( ro, rd, tm.x, tm.y, matInfo );
        float fa = 1.0-exp(-0.00018*(tm.x*tm.x*0.4  + 0.6*tm.x));
        col = mix( col, vec3(0.35,0.5,0.75), fa );
        resT = tm.x;
    }
    
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    #ifdef USE_REPROJECTION
    vec2 o = hash2( float(iFrame) ) - 0.5;
    #else
    vec2 o = vec2(0.0);
    #endif

    vec2 q = fragCoord/iResolution.xy;
    vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;

    // camera
    float an = 0.025*sin(0.5*iTime) - 1.25;
    vec3 ro = vec3(5.7*sin(an),1.6,5.7*cos(an));
    vec3 ta = vec3(0.0,1.6,0.0);

    // ray
    const float fl = 3.5;
    mat3 ca = setCamera( ro, ta, 0.0 );
    vec3 rd = normalize( ca * vec3(p,-fl) );

    // render
    float t;
    vec3 col = render( ro, rd, t);
    
    //------------------------------------------
	// reproject from previous frame and average
    //------------------------------------------
#ifdef USE_REPROJECTION
    mat4 oldCam = mat4( textureLod(iChannel0,vec2(0.5,0.5)/iResolution.xy, 0.0),
                        textureLod(iChannel0,vec2(1.5,0.5)/iResolution.xy, 0.0),
                        textureLod(iChannel0,vec2(2.5,0.5)/iResolution.xy, 0.0),
                        0.0, 0.0, 0.0, 1.0 );
    
    // world space
    vec4 wpos = vec4(ro + rd*t,1.0);
    // camera space
    vec3 cpos = (wpos*oldCam).xyz; // note inverse multiply
    // ndc space
    vec2 npos = -fl * cpos.xy / cpos.z;
    // screen space
    vec2 spos = 0.5 + 0.5*npos*vec2(iResolution.y/iResolution.x,1.0);
    // undo dither
    spos -= o/iResolution.xy;
	// raster space
    vec2 rpos = spos * iResolution.xy;
    
    if( rpos.y<1.0 && rpos.x<3.0 )
    {
    }
	else
    {
        vec3 ocol = textureLod( iChannel0, spos, 0.0 ).xyz;
    	if( iFrame==0 ) ocol = col;
        col = mix( ocol, col, 0.13 );
    }

    //----------------------------------
                           
	if( fragCoord.y<1.0 && fragCoord.x<3.0 )
    {
        if( abs(fragCoord.x-2.5)<0.5 ) fragColor = vec4( ca[2], -dot(ca[2],ro) );
        if( abs(fragCoord.x-1.5)<0.5 ) fragColor = vec4( ca[1], -dot(ca[1],ro) );
        if( abs(fragCoord.x-0.5)<0.5 ) fragColor = vec4( ca[0], -dot(ca[0],ro) );
    }
    else
    {
        fragColor = vec4( col, t );
    }
#else
    fragColor = vec4( col, t );
#endif
}`;

const buffB = `
// Created by inigo quilez - iq/2016
// I share this piece (art and code) here in Shadertoy and through its Public API, only for educational purposes. 
// You cannot use, sell, share or host this piece or modifications of it as part of your own commercial or non-commercial product, website or project.
// You can share a link to it or an unmodified screenshot of it provided you attribute "by Inigo Quilez, @iquilezles and iquilezles.org". 
// If you are a teacher, lecturer, educator or similar and these conditions are too restrictive for your needs, please contact me and we'll work it out.

// pretty decent DOF with a gather approach


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 di = hash2( fragCoord )-0.5;
    vec2 uv = fragCoord/iResolution.xy;
    
    vec4 ref = texture( iChannel0, uv );
    
    const float focus = 7.0;

    vec4 acc = vec4(0.0);
    for( int j=0; j<11; j++ )
    for( int i=0; i<11; i++ )
    {
        vec2 of = 1.0 * (di+vec2(float(i-5),float(j-5)))/800.0;

        vec4  cold = texture( iChannel0, uv + of );
        float depth = cold.w;
        float coc = max(0.001,0.005*abs(depth-focus)/depth);   // compute scatter radious

        if( dot(of,of) < (coc*coc) )
        {
            float w = 1.0/(coc*coc); 
            acc += vec4(cold.xyz*w,w);
        }
    }
    
    vec3 col = acc.xyz / acc.w;
    
	fragColor = vec4( col, ref.w );
}    
`;

const fragment = `
// Created by inigo quilez - iq/2016
// I share this piece (art and code) here in Shadertoy and through its Public API, only for educational purposes. 
// You cannot use, sell, share or host this piece or modifications of it as part of your own commercial or non-commercial product, website or project.
// You can share a link to it or an unmodified screenshot of it provided you attribute "by Inigo Quilez, @iquilezles and iquilezles.org". 
// If you are a teacher, lecturer, educator or similar and these conditions are too restrictive for your needs, please contact me and we'll work it out.

// Youtube video capture: https://www.youtube.com/watch?v=vga8FZzv5GE


float leg( in vec3 p, in vec3 pa, in vec3 pb, in vec3 pc, float m, float h )
{
    vec2 b = sdSegment( p, pa, pb );

    float tr = 0.35 - 0.16*smoothstep(0.0,1.0,b.y);
    float d3 = b.x - tr;

    b = sdSegment( p, pb, pc );
    tr = 0.18;
    d3 = smin( d3, b.x - tr, 0.1 );

    // paw        
    vec3 ww = normalize( mix( normalize(pc-pb), vec3(0.0,1.0,0.0), h) );
    mat3 pr = base( ww );
    vec3 fc = pr*((p-pc))-vec3(0.02,0.0,0.0)*(-1.0+2.0*h);
    float d4 = sdEllipsoid( fc, vec3(0.0), vec3(0.2,0.15,0.2) );

    d3 = smin( d3, d4, 0.1 );

    // nails
    float d6 = sdEllipsoid( fc, vec3(0.14,-0.06,0.0)*(-1.0+2.0*h), vec3(0.1,0.16,0.1));
    d6 = min( d6, sdEllipsoid( vec3(fc.xy,abs(fc.z)), vec3(0.13*(-1.0+2.0*h),-0.08*(-1.0+2.0*h),0.13), vec3(0.09,0.14,0.1)) );
    d3 = smin( d3, d6, 0.001 );
	return d3;
}

vec2 mapElephant( vec3 p, out vec3 matInfo )
{
    matInfo = vec3(0.0);
    
    p.x -= -0.5;
	p.y -= 2.4;
    
    vec3 ph = p;
    float cc = 0.995;
    float ss = 0.0998745;
    ph.yz = mat2(cc,-ss,ss,cc)*ph.yz;
    ph.xy = mat2(cc,-ss,ss,cc)*ph.xy;
    
    // head
    float d1 = sdEllipsoid( ph, vec3(0.0,0.05,0.0), vec3(0.45,0.5,0.3) );
    d1 = smin( d1, sdEllipsoid( ph, vec3(-0.3,0.15,0.0), vec3(0.2,0.2,0.2) ), 0.1 );

    // nose
    vec2 kk;
    vec2 b1 = sdBezier( vec3(-0.15,-0.05,0.0), vec3(-0.7,0.0,0.0), vec3(-0.7,-0.8,0.0), ph, kk );
    float tr1 = 0.30 - 0.17*smoothstep(0.0,1.0,b1.y);
    vec2  b2 = sdBezier( vec3(-0.7,-0.8,0.0), vec3(-0.7,-1.5,0.0), vec3(-0.4,-1.6,0.2), ph, kk );
    float tr2 = 0.30 - 0.17 - 0.05*smoothstep(0.0,1.0,b2.y);
    float bd1 = b1.x-tr1;
    float bd2 = b2.x-tr2;
    float nl = b1.y*0.5;
    float bd = bd1;
    if( bd2<bd1 )
    {
        nl = 0.5 + 0.5*b2.y;
        bd = bd2;
    }
    matInfo.x = clamp(nl * (1.0-smoothstep(0.0,0.2,bd)),0.0,1.0);
    float d2 = bd;
    float xx = nl*120.0;
    float ff = sin(xx + sin(xx + sin(xx + sin(xx))));
    //ff *= smoothstep(0.0,0.01,kk.y);
    d2 += 0.003*ff*(1.0-nl)*(1.0-nl)*smoothstep(0.0,0.1,nl);

    d2 -= (0.05 - 0.05*(1.0-pow(textureLod( iChannel0, vec2(1.0*nl,p.z*0.12), 0.0 ).x,1.0)))*nl*(1.0-nl)*0.5;
    
    float d = smin(d1,d2,0.2);

    // teeth
    vec3 q = vec3( p.xy, abs(p.z) );
    vec3 qh = vec3( ph.xy, abs(ph.z) );
    {
    vec2 s1 = sdSegment( qh, vec3(-0.4,-0.1,0.1), vec3(-0.5,-0.4,0.28) );
    float d3 = s1.x - 0.18*(1.0 - 0.3*smoothstep(0.0,1.0,s1.y));
    d = smin( d, d3, 0.1 );
    }
    
    // eyes
    {
    vec2 s1 = sdSegment( qh, vec3(-0.2,0.2,0.11), vec3(-0.3,-0.0,0.26) );
    float d3 = s1.x - 0.19*(1.0 - 0.3*smoothstep(0.0,1.0,s1.y));
    d = smin( d, d3, 0.03 );

    float st = length(qh.xy-vec2(-0.31,-0.02));
    //d += 0.005*sin(250.0*st)*exp(-110.0*st*st );
    d += 0.0015*sin(250.0*st)*(1.0-smoothstep(0.0,0.2,st));

        
    mat3 rot = mat3(0.8,-0.6,0.0,
                    0.6, 0.8,0.0,
                    0.0, 0.0,1.0 );
    float d4 = sdEllipsoid( rot*(qh-vec3(-0.31,-0.02,0.34)), vec3(0.0), vec3(0.1,0.08,0.07)*0.7 );
	d = smax(d, -d4, 0.02 );
    }
   

    // body
    {
    float co = cos(0.4);
    float si = sin(0.4);
    vec3 w = p;
    w.xy = mat2(co,si,-si,co)*w.xy;

    float d4 = sdEllipsoid( w, vec3(0.6,0.3,0.0), vec3(0.6,0.6,0.6) );
	d = smin(d, d4, 0.1 );

    d4 = sdEllipsoid( w, vec3(1.8,0.3,0.0), vec3(1.2,0.9,0.7) );
	d = smin(d, d4, 0.2 );

    d4 = sdEllipsoid( w, vec3(2.1,0.55,0.0), vec3(1.0,0.9,0.6) );
	d = smin(d, d4, 0.1 );

    d4 = sdEllipsoid( w, vec3(2.0,0.8,0.0), vec3(0.7,0.6,0.8) );
	d = smin(d, d4, 0.1 );
    }

    // back-left leg
    {
    float d3 = leg( q, vec3(2.6,-0.5,0.3), vec3(2.65,-1.45,0.3), vec3(2.6,-2.1,0.25), 1.0, 0.0 );
    d = smin(d,d3,0.1);
    }
    
	// tail
    #if 0
    {
    vec2 b = sdBezier( vec3(2.8,0.2,0.0), vec3(3.4,-0.6,0.0), vec3(3.1,-1.6,0.0), p, kk );
    float tr = 0.10 - 0.07*b.y;
    float d2 = b.x - tr;
    d = smin( d, d2, 0.05 );
    }
    #endif
        
    // front-left leg
    #if 0
    {
    float d3 = leg( q, vec3(0.8,-0.4,0.3), vec3(0.5,-1.55,0.3), vec3(0.5,-2.1,0.3), 1.0, 0.0 );
    d = smin(d,d3,0.15);
    }
    #else
    {
    float d3 = leg( p, vec3(0.8,-0.4,0.3), vec3(0.7,-1.55,0.3), vec3(0.8,-2.1,0.3), 1.0, 0.0 );
    d = smin(d,d3,0.15);
    d3 = leg( p, vec3(0.8,-0.4,-0.3), vec3(0.4,-1.55,-0.3), vec3(0.4,-2.1,-0.3), 1.0, 0.0 );
    d = smin(d,d3,0.15);
    }
    #endif
    
#if 1
    // ear
    float co = cos(0.5);
    float si = sin(0.5);
    vec3 w = qh;
    w.xz = mat2(co,si,-si,co)*w.xz;
    
    vec2 ep = w.zy - vec2(0.5,0.4);
    float aa = atan(ep.x,ep.y);
    float al = length(ep);
    w.x += 0.003*sin(24.0*aa)*smoothstep(0.0,0.5,dot(ep,ep));
    w.x += 0.02*textureLod( iChannel1, vec2(al*0.02,0.5+0.05*sin(aa)), 0.0 ).x * smoothstep(0.0,0.3,dot(ep,ep));
                      
    float r = 0.02*sin( 24.0*atan(ep.x,ep.y))*clamp(-w.y*1000.0,0.0,1.0);
    r += 0.01*sin(15.0*w.z);
    // section        
    float d4 = length(w.zy-vec2( 0.5,-0.2+0.03)) - 0.8 + r;    
    float d5 = length(w.zy-vec2(-0.1, 0.6+0.03)) - 1.5 + r;    
    float d6 = length(w.zy-vec2( 1.8, 0.1+0.03)) - 1.6 + r;    
    d4 = smax( d4, d5, 0.1 );
    d4 = smax( d4, d6, 0.1 );

    float wi = 0.02 + 0.1*pow(clamp(1.0-0.7*w.z+0.3*w.y,0.0,1.0),2.0);
    w.x += 0.05*cos(6.0*w.y);
    
    // cut it!
    d4 = smax( d4, -w.x, 0.03 ); 
    d4 = smax( d4, w.x-wi, 0.03 ); 
    
	matInfo.y = clamp(length(ep),0.0,1.0) * (1.0-smoothstep( -0.1, 0.05, d4 ));
    
    d = smin( d, d4, 0.3*max(qh.y,0.0)+0.0001 ); // trick -> positional smooth
    
    // conection hear/head
    vec2 s1 = sdBezier( vec3(-0.15,0.3,0.0), vec3(0.1,0.6,0.2), vec3(0.35,0.6,0.5), qh, kk );
    float d3 = s1.x - 0.08*(1.0-0.95*s1.y*s1.y);
    d = smin( d, d3, 0.05 );
    
#endif

    d -= 0.002*textureLod( iChannel1, 0.5*p.yz, 0.0 ).x;
    d -= 0.002*textureLod( iChannel1, 0.5*p.yx, 0.0 ).x;
    d += 0.003;
    d -= 0.005*textureLod( iChannel0, 0.5*p.yx, 0.0 ).x*(0.2 + 0.8*smoothstep( 0.8, 1.3, length(p-vec3(-0.5,0.0,0.0)) ));

    
    vec2 res = vec2(d,0.0);
	//=====================
    // teeth
    vec2 b = sdBezier( vec3(-0.5,-0.4,0.28), vec3(-0.5,-0.7,0.32), vec3(-1.0,-0.8,0.45), qh, kk );
    float tr = 0.10 - 0.08*b.y;
    d2 = b.x - tr;
    if( d2<res.x ) 
    {
        res = vec2( d2, 1.0 );
        matInfo.x = b.y;
    }
	//------------------
    //eyeball
    mat3 rot = mat3(0.8,-0.6,0.0,
                    0.6, 0.8,0.0,
                    0.0, 0.0,1.0 );
    d4 = sdEllipsoid( rot*(qh-vec3(-0.31,-0.02,0.33)), vec3(0.0), vec3(0.1,0.08,0.07)*0.7 );
    if( d4<res.x ) res = vec2( d4, 2.0 );

    return res;
}

float sleg( in vec3 p, in vec3 pa, in vec3 pb, in vec3 pc, float m, float h, float sc )
{
    vec2 b = sdSegment( p, pa, pb );

    float tr = 0.35 - 0.15*smoothstep(0.0,1.0,b.y);
    float d3 = b.x - tr*sc;

    b = sdSegment( p, pb, pc );
    tr = 0.18;// - 0.015*smoothstep(0.0,1.0,b.y);
    d3 = smin( d3, b.x - tr*sc, 0.1 );

    // paw        
    vec3 ww = normalize( mix( normalize(pc-pb), vec3(0.0,1.0,0.0), h) );
    mat3 pr = base( ww );
    vec3 fc = pr*((p-pc))-vec3(0.02,0.0,0.0)*(-1.0+2.0*h);
    float d4 = sdEllipsoid( fc, vec3(0.0), vec3(0.2,0.15,0.2) );

    d3 = smin( d3, d4, 0.1 );

    // nails
    float d6 = sdEllipsoid( fc, vec3(0.14,-0.04,0.0)*(-1.0+2.0*h), vec3(0.1,0.16,0.1));
    d6 = min( d6, sdEllipsoid( vec3(fc.xy,abs(fc.z)), vec3(0.13*(-1.0+2.0*h),0.04,0.13), vec3(0.09,0.14,0.1)) );
    d3 = smin( d3, d6, 0.001 );
	return d3;

	return d3;
}

vec2 mapSmallElephant( vec3 p, out vec3 matInfo )
{
    matInfo = vec3(0.0);
    vec3 oop = p;
    const float sca = 2.0;
    p.xz = mat2(0.8,0.6,-0.6,0.8)*p.xz;
    p *= sca;
    
    p -= vec3(-1.1,2.4,-2.0);
        
    vec3 ph = p;
    ph.yz = mat2(0.95,0.31225,-0.31225,0.95)*ph.yz;
        
    // head
    float d1 = sdEllipsoid( ph, vec3(0.0,0.0,0.0), vec3(0.45,0.55,0.38) );

    // nose
    vec2 kk;
    
    vec2 b1 = sdBezier( vec3(-0.15,-0.05,0.0), vec3(-0.7,-0.2,-0.1), vec3(-0.7,-0.5,0.1), ph, kk );    
    float tr1 = 0.30 - 0.17*smoothstep(0.0,1.0,b1.y);
    vec2 b2 = sdBezier( vec3(-0.7,-0.5,0.1), vec3(-0.7,-0.8,0.3), vec3(-0.4,-0.8,0.8), ph, kk );
    
    float tr2 = 0.30 - 0.17 - 0.05*smoothstep(0.0,1.0,b2.y);
    float bd1 = b1.x-tr1;
    float bd2 = b2.x-tr2;
    float nl = b1.y*0.5;
    float bd = bd1;
    if( bd2<bd1 )
    {
        nl = 0.5 + 0.5*b2.y;
        bd = bd2;
    }
    
    matInfo.x = clamp(nl * (1.0-smoothstep(0.0,0.2,bd)),0.0,1.0);
            
    float d2 = bd;
    float xx = nl*120.0;
    float ff = sin(xx + sin(xx + sin(xx + sin(xx))));
    d2 += 0.005*ff*(1.0-nl)*(1.0-nl)*smoothstep(0.0,0.1,nl);

    float d = smin(d1,d2,0.2);

    vec3 qh = vec3( ph.xy, abs(ph.z) );

    // eyes
    {
    vec2 s1 = sdSegment( qh, vec3(-0.2,0.2,0.11), vec3(-0.3,-0.0,0.23) );
    float d3 = s1.x - 0.19*(1.0 - 0.3*smoothstep(0.0,1.0,s1.y));
    d = smin( d, d3, 0.03 );
    mat3 rot = mat3(0.8,-0.6,0.0,
                    0.6, 0.8,0.0,
                    0.0, 0.0,1.0 );
    float d4 = sdEllipsoid( rot*(qh-vec3(-0.31,-0.02,0.34)), vec3(0.0), vec3(0.1,0.08,0.07)*0.7 );
	d = smax(d, -d4, 0.04 );
    }


    vec3 q = vec3( p.xy, abs(p.z) );

    // body
    {
    float co = cos(0.4);
    float si = sin(0.4);
    vec3 w = p;
    w.xy = mat2(co,si,-si,co)*w.xy;
        
    float d4 = sdEllipsoid( w, vec3(0.6,0.3,0.0), vec3(0.6,0.6,0.6) );
	d = smin(d, d4, 0.1 );

    d4 = sdEllipsoid( w, vec3(1.8,0.3,0.0), vec3(1.2,0.9,0.7) );
	d = smin(d, d4, 0.2 );
    }

    // back-left leg
    {
    float d3 = sleg( q, vec3(2.6,-0.6,0.3), vec3(2.65,-1.4,0.3), vec3(2.6,-2.0,0.25), 1.0, 0.0, 0.75 );
    d = smin(d,d3,0.1);
    }
    
	// tail
    #if 0
    {
    vec2 b = sdBezier( vec3(2.6,0.,0.0), vec3(3.4,-0.6,0.0), vec3(3.1,-1.6,0.0), p, kk );
    float tr = 0.10 - 0.07*b.y;
    float d2 = b.x - tr;
    d = smin( d, d2, 0.05 );
    }
    #endif
    
    // front-left leg
    {
    float d3 = sleg( p, vec3(0.8,-0.4,0.2), vec3(0.6,-1.4,0.2), vec3(0.7,-1.9,0.2), 1.0, 0.0, 0.75 );
    d = smin(d,d3,0.15);
    d3 = sleg( p, vec3(0.8,-0.4,-0.2), vec3(0.3,-1.4,-0.2), vec3(0.2,-1.9,-0.2), 1.0, 0.0, 0.75 );
    d = smin(d,d3,0.15);
    }
            
#if 1
    // ear
    float co = cos(0.5);
    float si = sin(0.5);
    vec3 w = qh;
    w.xz = mat2(co,si,-si,co)*w.xz;
    
    vec2 ep = w.zy - vec2(0.5,0.4);
    float aa = atan(ep.x,ep.y);
    float al = length(ep);
    w.x += 0.003*sin( 24.0*aa)*smoothstep(0.0,0.5,dot(ep,ep));
    w.x += 0.02*textureLod( iChannel1, vec2(al*0.02,0.15*aa/3.1416), 0.0 ).x * smoothstep(0.0,0.3,dot(ep,ep));
                      
    float r = 0.02*sin( 24.0*atan(ep.x,ep.y))*clamp(-w.y*1000.0,0.0,1.0);
    r += 0.01*sin(15.0*w.z);
    // section        
    float d4 = length(w.zy-vec2( 0.5,-0.2+0.03)) - 0.8 + r;    
    float d5 = length(w.zy-vec2(-0.1, 0.6+0.03)) - 1.5 + r;    
    float d6 = length(w.zy-vec2( 1.8, 0.1+0.03)) - 1.6 + r;    
    d4 = smax( d4, d5, 0.1 );
    d4 = smax( d4, d6, 0.1 );

    float wi = 0.02 + 0.1*pow(clamp(1.0-0.7*w.z+0.3*w.y,0.0,1.0),2.0);
    w.x += 0.05*cos(6.0*w.y);
    
    // cut it!
    d4 = smax( d4, -w.x, 0.03 ); 
    d4 = smax( d4, w.x-wi, 0.03 ); 
    
	matInfo.y = clamp(length(ep),0.0,1.0) * (1.0-smoothstep( -0.1, 0.05, d4 ));
    
    d = smin( d, d4, 0.3*max(qh.y+0.2,0.0)+0.0001 ); // trick -> positional smooth
    
    // conection hear/head
    vec2 s1 = sdBezier( vec3(-0.15,0.3,0.0), vec3(0.1,0.6,0.2), vec3(0.35,0.6,0.5), qh, kk );
    float d3 = s1.x - 0.08*(1.0-0.95*s1.y*s1.y);
    d = smin( d, d3, 0.05 );
    
#endif
    
    d -= 0.008*textureLod( iChannel1, 0.25*p.yz, 0.0 ).x;
    d -= 0.008*textureLod( iChannel1, 0.25*p.yx, 0.0 ).x;
    d += 0.010;
    d -= 0.012*textureLod( iChannel0, 0.25*p.yx, 0.0 ).x*(0.3 + 0.7*smoothstep( 0.5, 1.0, length(p-vec3(-0.5,0.0,0.0)) ));
    
    vec2 res = vec2(d,0.0);
	//=====================
    //eyeball
    mat3 rot = mat3(0.8,-0.6,0.0,
                    0.6, 0.8,0.0,
                    0.0, 0.0,1.0 );
    d4 = sdEllipsoid( rot*(qh-vec3(-0.31,-0.02,0.33)), vec3(0.0), vec3(0.1,0.08,0.07)*0.7 );
    
    if( d4<res.x ) res = vec2( d4, 2.0 );

    res.x /= sca;
        
    return res;
}

vec2 map( vec3 p, out vec3 matInfo )
{
    vec2 res = vec2(p.y+2.2-1.0);
    
    // bounding volume for big elephant
    //float b2 = length(p-vec3(0.5,1.7,0.0))-2.1;
	//if( b2<res.x )    
    {
        res = mapElephant( p, matInfo );
    }
    
    // bounding volume for small elephant
    float bb = length(p-vec3(-0.4,0.5,-0.8))-1.3;
    if( bb<res.x )
    {
        vec3 mi2;
        vec2 tmp = mapSmallElephant( p, mi2 );
        if( tmp.x<res.x ) { res=tmp; matInfo=mi2; }
    }
    
    return res;
}

vec2 mapWithTerrain( vec3 p, out vec3 matInfo )
{
    vec2 res = map(p,matInfo);
        
    //--------------------
    // terrain
    float h = 2.1+0.1;
    float d2 = p.y + h;
    if( d2<res.x ) res = vec2( d2, 3.0 );
    
    return res;
}

// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal( in vec3 pos, in float eps )
{
    vec3 kk;
#if 0    
    vec2 e = vec2(1.0,-1.0)*0.5773*eps;
    return normalize( e.xyy*map( pos + e.xyy, kk ).x + 
					  e.yyx*map( pos + e.yyx, kk ).x + 
					  e.yxy*map( pos + e.yxy, kk ).x + 
					  e.xxx*map( pos + e.xxx, kk ).x );
#else
    // inspired by tdhooper and klems - a way to prevent the compiler from inlining map() 4 times
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(pos+e*eps,kk).x;
    }
    return normalize(n);
#endif    
}

// https://iquilezles.org/www/articles/rmshadows/rmshadows.htm
float calcSoftShadow( in vec3 ro, in vec3 rd, float k )
{
    vec3 kk;
    float res = 1.0;
    float t = 0.01;
    for( int i=0; i<32; i++ )
    {
        float h = map(ro + rd*t, kk ).x;
        res = min( res, k*h/t );
        t += clamp( h, 0.05, 0.5 );
		if( res<0.01 ) break;
    }
    return smoothstep(0.0,1.0,res);
}

float calcAO( in vec3 pos, in vec3 nor )
{
    vec3 kk;
	float ao = 0.0;
    for( int i=ZERO; i<32; i++ )
    {
        vec3 ap = forwardSF( float(i), 32.0 );
        ap *= sign( dot(ap,nor) );
        float h = hash1(float(i));
		ap *= h*0.3;
        ao += clamp( mapWithTerrain( pos + nor*0.01 + ap, kk ).x*1.0/h, 0.0, 1.0 );
    }
	ao /= 32.0;
	
    return clamp( ao*4.0*(1.0+0.25*nor.y), 0.0, 1.0 );
}

const vec3 sunDir = normalize( vec3(0.15,0.7,0.65) );

float dapples( in vec3 ro, in vec3 rd )
{
    float sha = eliSoftShadow( ro, rd, vec3(0.0,4.0,4.0), vec3(3.0,1.0,3.0), 70.0 );
    
    vec3 uu = normalize( cross( rd, vec3(0.0,0.0,1.0) ) );
    vec3 vv = normalize( cross( uu, rd ) );

    vec3 ce = vec3(0.0,4.0,5.0);
    float t = -dot(ro-ce,rd);
    vec3 po = ro + t*rd;
    vec2 uv = vec2( dot(uu,po-ce), dot(vv,po-ce) );
    
    float dap = 1.0-smoothstep( 0.1, 0.5, texture(iChannel2,0.25+0.4*uv,-100.0).x );
    return 1.0 - 0.9*(1.0-sha)*(1.0-dap);
}

// https://iquilezles.org/www/articles/filteringrm/filteringrm.htm
void calcDpDxy( in vec3 ro, in vec3 rd, in vec3 rdx, in vec3 rdy, in float t, in vec3 nor, out vec3 dpdx, out vec3 dpdy )
{
    dpdx = t*(rdx*dot(rd,nor)/dot(rdx,nor) - rd);
    dpdy = t*(rdy*dot(rd,nor)/dot(rdy,nor) - rd);
}

vec3 shade( in vec3 ro, in vec3 rd, in float t, in float m, in vec3 matInfo, in vec3 rdx, in vec3 rdy )
{
    float eps = 0.001;
    
    vec3 pos = ro + t*rd;
    vec3 nor = calcNormal( pos, eps*t );
    vec3 dposdx, dposdy;
    calcDpDxy( ro, rd, rdx, rdy, t, nor, dposdx, dposdy );

    float kk;

    vec3 mateD = vec3(0.2,0.16,0.11);
    vec3 mateS = vec3(0.2,0.12,0.07);
    vec3 mateK = vec3(0.0,1.0,0.0); // amount, power, metalic
    float focc = 1.0;
        
    if( m<0.5 ) // body
    {
        mateD = vec3(0.27,0.26,0.25)*0.4;
        mateS = vec3(0.27,0.26,0.25)*0.4;
        mateK = vec3(0.12,20.0,0.0);
        
        float te = texcube( iChannel1, 0.25*pos, nor, 4.0, 0.25*dposdx, 0.25*dposdy ).x;
        mateD *= 0.2+0.6*te;
        mateK *= te;
        
        mateD *= 1.1 - 0.4*smoothstep( 0.3, 0.7, matInfo.x );
        mateD = mix( mateD, mateD*vec3(1.1,0.8,0.7), smoothstep( 0.0, 0.15, matInfo.y ) );

        focc *= 0.5 + 0.5*smoothstep(0.0,3.0,pos.y);
                   
        vec3 q = pos - vec3(-0.5,2.4,0.0);

        //---
        vec2 est = q.xy-vec2(-0.31,-0.02);
        mateD *= mix( vec3(1.0), vec3(0.2,0.15,0.1), exp(-20.0*dot(est,est)) );

        mateD *= 1.2;
        mateS *= 1.2;
        mateK.x *= 1.2;
        
        mateK.xy *= vec2(3.0,2.0);
    }
    else if( m<1.5 ) // teeh
    {
        mateD = vec3(0.3,0.28,0.25)*0.9;
        mateS = vec3(0.3,0.28,0.25)*0.9;
        mateK = vec3(0.2,32.0,0.0);
        mateD *= mix( vec3(0.45,0.4,0.35), vec3(1.0), sqrt(matInfo.x) );
        focc = smoothstep(0.1,0.3,matInfo.x);
        float te = texcube( iChannel1, 0.5*pos, nor, 4.0, 0.5*dposdx, 0.5*dposdy ).x;
        mateD *= te;
        mateK.x *= te;
    }
    else //if( m<2.5 ) //eyeball
    {
        mateD = vec3(0.0);
        mateS = vec3(0.0);
        mateK = vec3(0.4,32.0,0.0);
    }
    
    vec3 hal = normalize( sunDir-rd );
    float fre = clamp(1.0+dot(nor,rd), 0.0, 1.0 );
    float occ = calcAO( pos, nor )*focc;
        
    float dif1 = dot(nor,sunDir);
    if( dif1>0.001 )
    {
    float sha = calcSoftShadow( pos, sunDir, 16.0 );
    sha = min( sha, dapples(pos,sunDir) );
    dif1 *= sha;
    }
    dif1 = clamp( dif1, 0.0, 1.0 );

    float spe1 = clamp( dot(nor,hal), 0.0, 1.0 );
    float bak = clamp( dot(nor,normalize(vec3(-sunDir.x,0.0,-sunDir.z))), 0.0, 1.0 );
    float bou = clamp( 0.3-0.7*nor.y, 0.0, 1.0 );
    float rod1 = 1.0 - (1.0-smoothstep( 0.15,0.2, length(pos.yz-vec2(1.8,0.3))))*(1.0-smoothstep(0.0,0.1,abs(pos.x+0.2)));

    
    // sun
    vec3 col = 8.5*vec3(2.0,1.2,0.65)*dif1;
    // sky
    col += 4.5*vec3(0.35,0.7,1.0)*occ*clamp(0.2+0.8*nor.y,0.0,1.0);
    // ground
    col += 4.0*vec3(0.4,0.25,0.12)*bou*occ;
    // back
    col += 3.5*vec3(0.2,0.2,0.15)*bak*occ*rod1;
    // sss
    col += 25.0*fre*fre*(0.2+0.8*dif1*occ)*mateS*rod1;

    // sun
    vec3 hdir = normalize(sunDir - rd);
    float costd = clamp( dot(sunDir, hdir), 0.0, 1.0 );
    float spp = pow( spe1, mateK.y )*dif1*mateK.x * (0.04 + 0.96*pow(1. - costd,5.0));

    // sky spec
    float sksp = occ*occ*smoothstep(-0.2,0.2,reflect(rd,nor).y)*(0.5+0.5*nor.y)*mateK.x * (0.04 + 0.96*pow(fre,5.0));

    col += mateK.z*15.0*5.0*spp; 

    col *= mateD;

    col += (1.0-mateK.z)*75.0*spp; 
    col += (1.0-mateK.z)* 3.0*sksp*vec3(0.35,0.7,1.0); 

    return col;        
}

vec2 raycast( in vec3 ro, in vec3 rd, in float tmax, out vec3 matInfo )
{
    vec2 res = vec2(-1.0);

    float maxdist = min(tmax,10.0);
    float t = 4.0;

#if 1
    // this bounding cylinder only covers the front half of the
    // elephant, but because of the camera direction, in perspective
    // it also covers the back side. For a different camera direction
    // the true bounding cylinder should be used.
    vec2 bb = iCylinderY(ro,rd,vec4(-0.1,0.0,-0.2,1.45));
    if( bb.y<0.0 ) return res;
    if( bb.x>0.0 ) t = max(t,bb.x);
    //maxdist = min(maxdist,bb.y); // enable only when using the true bounding cylinder
#endif

    for( int i=0; i<128; i++ )
    {
        vec3 p = ro + t*rd;
        vec2 h = map( p, matInfo );
        res = vec2(t,h.y);
        if( h.x<(0.0001*t) || t>maxdist ) break;
        t += h.x;//*0.75;
    }

    if( t>maxdist )
    {
        res = vec2(-1.0);
    }

    return res;
}

vec3 render( in vec3 ro, in vec3 rd, in vec3 col, in float tmax, in vec3 rdx, in vec3 rdy )
{
    vec3 matInfo;
    vec2 tm = raycast( ro, rd, tmax, matInfo );
    if( tm.y>-0.5  )
    {
        col = shade( ro, rd, tm.x, tm.y, matInfo, rdx, rdy );
        float fa = 1.0-exp(-0.0001*(tm.x*tm.x+tm.x));
        col = mix( col, vec3(0.4,0.5,0.65), fa );
    }
	return col;    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    vec2 q = fragCoord/iResolution.xy;
    vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // camera
    float an = 0.025*sin(0.5*iTime) - 1.25;
    vec3 ro = vec3(5.7*sin(an),1.6,5.7*cos(an));
    vec3 ta = vec3(0.0,1.6,0.0);

    // ray
    mat3 ca = setCamera( ro, ta, 0.0 );
    vec3 rd = normalize( ca * vec3(p,-3.5) );

    // ray differentials
    // https://iquilezles.org/www/articles/filteringrm/filteringrm.htm
    vec2 px = (2.0*(fragCoord+vec2(1.0,0.0))-iResolution.xy)/iResolution.y;
    vec2 py = (2.0*(fragCoord+vec2(0.0,1.0))-iResolution.xy)/iResolution.y;
    vec3 rdx = normalize( ca * vec3(px,-3.5) );
    vec3 rdy = normalize( ca * vec3(py,-3.5) );
    
    // red background
    vec4 data = texture( iChannel3, q );
    vec3 col = data.xyz;
    float t = data.w;

    // render
    col = render( ro, rd, col, t, rdx, rdy);

    // sun
    float sun = clamp( 0.5 + 0.5*dot(rd,sunDir), 0.0, 1.0 );
    col += 1.5*vec3(1.0,0.8,0.6)*pow(sun,16.0);

    // gamma
    col = pow(col,vec3(0.4545));
    
    // color grade
    col.x += 0.010;
    
    // vignette
    col *= 0.3 + 0.7*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.1);
    fragColor = vec4( col, 1.0 );
}

`;

export default class implements iSub {
  key(): string {
    return '4dKGWm';
  }
  name(): string {
    return 'Elephant';
  }
  // sort() {
  //   return 0;
  // }
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
