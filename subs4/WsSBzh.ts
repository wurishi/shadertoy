import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// Basic utility functions (sdfs, noises, shaping functions)
// and also the camera setup which is shaded between the
// background rendering code ("Buffer A" tab) and the character
// rendering code ("Image" tab)



// http://iquilezles.org/www/articles/smin/smin.htm
float smin( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}

// http://iquilezles.org/www/articles/smin/smin.htm
float smax( float a, float b, float k )
{
    k *= 1.4;
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*h/(6.0*k*k);
}

// http://iquilezles.org/www/articles/smin/smin.htm
float smin3( float a, float b, float k )
{
    k *= 1.4;
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*h/(6.0*k*k);
}

float sclamp(in float x, in float a, in float b )
{
    float k = 0.1;
	return smax(smin(x,b,k),a,k);
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float opOnion( in float sdf, in float thickness )
{
    return abs(sdf)-thickness;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float opRepLim( in float p, in float s, in float lima, in float limb )
{
    return p-s*clamp(round(p/s),lima,limb);
}


float det( vec2 a, vec2 b ) { return a.x*b.y-b.x*a.y; }
float ndot(vec2 a, vec2 b ) { return a.x*b.x-a.y*b.y; }
float dot2( in vec2 v ) { return dot(v,v); }
float dot2( in vec3 v ) { return dot(v,v); }


// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdTorus( in vec3 p, in float ra, in float rb )
{
    return length( vec2(length(p.xz)-ra,p.y) )-rb;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
{
    p.x = abs(p.x);
    float k = (sc.y*p.x>sc.x*p.z) ? dot(p.xz,sc) : length(p.xz);
    return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdSphere( in vec3 p, in float r ) 
{
    return length(p)-r;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdEllipsoid( in vec3 p, in vec3 r ) 
{
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdBox( in vec3 p, in vec3 b )
{
    vec3 d = abs(p) - b;
    return min( max(max(d.x,d.y),d.z),0.0) + length(max(d,0.0));
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdArc( in vec2 p, in vec2 scb, in float ra )
{
    p.x = abs(p.x);
    float k = (scb.y*p.x>scb.x*p.y) ? dot(p.xy,scb) : length(p.xy);
    return sqrt( dot(p,p) + ra*ra - 2.0*ra*k );
}

#if 1
// http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
// { dist, t, y (above the plane of the curve, x (away from curve in the plane of the curve))
vec4 sdBezier( vec3 p, vec3 va, vec3 vb, vec3 vc )
{
  vec3 w = normalize( cross( vc-vb, va-vb ) );
  vec3 u = normalize( vc-vb );
  vec3 v =          ( cross( w, u ) );
  //----  
  vec2 m = vec2( dot(va-vb,u), dot(va-vb,v) );
  vec2 n = vec2( dot(vc-vb,u), dot(vc-vb,v) );
  vec3 q = vec3( dot( p-vb,u), dot( p-vb,v), dot(p-vb,w) );
  //----  
  float mn = det(m,n);
  float mq = det(m,q.xy);
  float nq = det(n,q.xy);
  //----  
  vec2  g = (nq+mq+mn)*n + (nq+mq-mn)*m;
  float f = (nq-mq+mn)*(nq-mq+mn) + 4.0*mq*nq;
  vec2  z = 0.5*f*vec2(-g.y,g.x)/dot(g,g);
//float t = clamp(0.5+0.5*(det(z,m+n)+mq+nq)/mn, 0.0 ,1.0 );
  float t = clamp(0.5+0.5*(det(z-q.xy,m+n))/mn, 0.0 ,1.0 );
  vec2 cp = m*(1.0-t)*(1.0-t) + n*t*t - q.xy;
  //----  
  float d2 = dot(cp,cp);
  return vec4(sqrt(d2+q.z*q.z), t, q.z, -sign(f)*sqrt(d2) );
}
#else
float det( vec3 a, vec3 b, in vec3 v ) { return dot(v,cross(a,b)); }

// my adaptation to 3d of http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
// { dist, t, y (above the plane of the curve, x (away from curve in the plane of the curve))
vec4 sdBezier( vec3 p, vec3 b0, vec3 b1, vec3 b2 )
{
    b0 -= p;
    b1 -= p;
    b2 -= p;
    
    vec3  d21 = b2-b1;
    vec3  d10 = b1-b0;
    vec3  d20 = (b2-b0)*0.5;

    vec3  n = normalize(cross(d10,d21));

    float a = det(b0,b2,n);
    float b = det(b1,b0,n);
    float d = det(b2,b1,n);
    vec3  g = b*d21 + d*d10 + a*d20;
	float f = a*a*0.25-b*d;

    vec3  z = cross(b0,n) + f*g/dot(g,g);
    float t = clamp( dot(z,d10-d20)/(a+b+d), 0.0 ,1.0 );
    vec3 q = mix(mix(b0,b1,t), mix(b1,b2,t),t);
    
    float k = dot(q,n);
    return vec4(length(q),t,-k,-sign(f)*length(q-n*k));
}
#endif

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
vec2 sdSegment(vec3 p, vec3 a, vec3 b)
{
    vec3 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return vec2( length( pa - ba*h ), h );
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
vec2 sdSegmentOri(vec2 p, vec2 b)
{
	float h = clamp( dot(p,b)/dot(b,b), 0.0, 1.0 );
	return vec2( length( p - b*h ), h );
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdFakeRoundCone(vec3 p, float b, float r1, float r2)
{
    float h = clamp( p.y/b, 0.0, 1.0 );
    p.y -= b*h;
	return length(p) - mix(r1,r2,h);
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdCone( in vec3 p, in vec2 c )
{
  vec2 q = vec2( length(p.xz), p.y );

  vec2 a = q - c*clamp( (q.x*c.x+q.y*c.y)/dot(c,c), 0.0, 1.0 );
  vec2 b = q - c*vec2( clamp( q.x/c.x, 0.0, 1.0 ), 1.0 );
  
  float s = -sign( c.y );
  vec2 d = min( vec2( dot( a, a ), s*(q.x*c.y-q.y*c.x) ),
			    vec2( dot( b, b ), s*(q.y-c.y)  ));
  return -sqrt(d.x)*sign(d.y);
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdRhombus(vec3 p, float la, float lb, float h, float ra)
{
    p = abs(p);
    vec2 b = vec2(la,lb);
    float f = clamp( (ndot(b,b-2.0*p.xz))/dot(b,b), -1.0, 1.0 );
	vec2 q = vec2(length(p.xz-0.5*b*vec2(1.0-f,1.0+f))*sign(p.x*b.y+p.z*b.x-b.x*b.y)-ra, p.y-h);
    return min(max(q.x,q.y),0.0) + length(max(q,0.0));
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
vec4 opElongate( in vec3 p, in vec3 h )
{
    vec3 q = abs(p)-h;
    return vec4( max(q,0.0), min(max(q.x,max(q.y,q.z)),0.0) );
}
//-----------------------------------------------

// ray-infinite-cylinder intersection
vec2 iCylinderY( in vec3 ro, in vec3 rd, in float rad )
{
	vec3 oc = ro;
    float a = dot( rd.xz, rd.xz );
	float b = dot( oc.xz, rd.xz );
	float c = dot( oc.xz, oc.xz ) - rad*rad;
	float h = b*b - a*c;
	if( h<0.0 ) return vec2(-1.0);
    h = sqrt(h);
	return vec2(-b-h,-b+h)/a;
}

// ray-infinite-cone intersection
vec2 iConeY(in vec3 ro, in vec3 rd, in float k )
{
	float a = dot(rd.xz,rd.xz) - k*rd.y*rd.y;
    float b = dot(ro.xz,rd.xz) - k*ro.y*rd.y;
    float c = dot(ro.xz,ro.xz) - k*ro.y*ro.y; 
        
    float h = b*b-a*c;
    if( h<0.0 ) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b-h,-b+h)/a;
}

//-----------------------------------------------

float linearstep(float a, float b, in float x )
{
    return clamp( (x-a)/(b-a), 0.0, 1.0 );
}

vec2 rot( in vec2 p, in float an )
{
    float cc = cos(an);
    float ss = sin(an);
    return mat2(cc,-ss,ss,cc)*p;
}

float expSustainedImpulse( float t, float f, float k )
{
    return smoothstep(0.0,f,t)*1.1 - 0.1*exp2(-k*max(t-f,0.0));
}

//-----------------------------------------------

vec3 hash3( uint n ) 
{
    // integer hash copied from Hugo Elias
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    uvec3 k = n * uvec3(n,n*16807U,n*48271U);
    return vec3( k & uvec3(0x7fffffffU))/float(0x7fffffff);
}

//---------------------------------------

float noise1( sampler3D tex, in vec3 x )
{
    return textureLod(tex,(x+0.5)/32.0,0.0).x;
}
float noise1( sampler2D tex, in vec2 x )
{
    return textureLod(tex,(x+0.5)/64.0,0.0).x;
}
float noise1f( sampler2D tex, in vec2 x )
{
    return texture(tex,(x+0.5)/64.0).x;
}
// float fbm1( sampler3D tex, in vec3 x )
// {
//     float f = 0.0;
//     f += 0.5000*noise1(tex,x); x*=2.01;
//     f += 0.2500*noise1(tex,x); x*=2.01;
//     f += 0.1250*noise1(tex,x); x*=2.01;
//     f += 0.0625*noise1(tex,x);
//     f = 2.0*f-0.9375;
//     return f;
// }

float fbm1( sampler2D tex, in vec3 tx )
{
    vec2 x = tx.xy;
    float f = 0.0;
    f += 0.5000*noise1(tex,x); x*=2.01;
    f += 0.2500*noise1(tex,x); x*=2.01;
    f += 0.1250*noise1(tex,x); x*=2.01;
    f += 0.0625*noise1(tex,x);
    f = 2.0*f-0.9375;
    return f;
}

float fbm1( sampler2D tex, in vec2 x )
{
    float f = 0.0;
    f += 0.5000*noise1(tex,x); x*=2.01;
    f += 0.2500*noise1(tex,x); x*=2.01;
    f += 0.1250*noise1(tex,x); x*=2.01;
    f += 0.0625*noise1(tex,x);
    f = 2.0*f-0.9375;
    return f;
}
float fbm1f( sampler2D tex, in vec2 x )
{
    float f = 0.0;
    f += 0.5000*noise1f(tex,x); x*=2.01;
    f += 0.2500*noise1f(tex,x); x*=2.01;
    f += 0.1250*noise1f(tex,x); x*=2.01;
    f += 0.0625*noise1f(tex,x);
    f = 2.0*f-0.9375;
    return f;
}
float bnoise( in float x )
{
    float i = floor(x);
    float f = fract(x);
    float s = sign(fract(x/2.0)-0.5);
    float k = 0.5+0.5*sin(i);
    return s*f*(f-1.0)*((16.0*k-4.0)*f*(f-1.0)-1.0);
}

vec3 fbm13( in float x, in float g )
{    
    vec3 n = vec3(0.0);
    float s = 1.0;
    for( int i=0; i<6; i++ )
    {
        n += s*vec3(bnoise(x),bnoise(x+13.314),bnoise(x+31.7211));
        s *= g;
        x *= 2.01;
        x += 0.131;
    }
    return n;
}


//--------------------------------------------------
//const float X1 = 1.6180339887498948; const float H1 = float( 1.0/X1 );
//const float X2 = 1.3247179572447460; const vec2  H2 = vec2(  1.0/X2, 1.0/(X2*X2) );
//const float X3 = 1.2207440846057595; const vec3  H3 = vec3(  1.0/X3, 1.0/(X3*X3), 1.0/(X3*X3*X3) );
  const float X4 = 1.1673039782614187; const vec4  H4 = vec4(  1.0/X4, 1.0/(X4*X4), 1.0/(X4*X4*X4), 1.0/(X4*X4*X4*X4) );

//--------------------------------------
mat3 calcCamera( in float time, out vec3 oRo, out float oFl )
{
    vec3 ta = vec3( 0.0, -0.3, 0.0 );
    vec3 ro = vec3( -0.5563, -0.2, 2.7442 );
    float fl = 1.7;
#if 0
    vec3 fb = fbm13( 0.2*time, 0.5 );
    ta += 0.025*fb;
    float cr = -0.01 + 0.006*fb.z;
#else
    vec3 fb1 = fbm13( 0.15*time, 0.50 );
    ro.xyz += 0.010*fb1.xyz;
    vec3 fb2 = fbm13( 0.33*time, 0.65 );
    fb2 = fb2*fb2*sign(fb2);
    ta.xy += 0.005*fb2.xy;
    float cr = -0.01 + 0.002*fb2.z;
#endif
    
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(sin(cr),cos(cr),0.0) ) );
    vec3 vv =          ( cross(uu,ww));
    
    oRo = ro;
    oFl = fl;

    return mat3(uu,vv,ww);
}

#define ZERO min(iFrame,0)
#define ZEROU min(uint(iFrame),0u)

`;

const buffA = `
// Renders the background (trees, ground, river and bridge). The
// render uses a super basic implementation of Temporal
// Antialiasing (TAA) without color clipping or anything,
// but it's enough to stabilize aliasing. It also outputs
// the deph buffer into the alpha channel for the next pass
// ("Buffer B") to consume and do proper Depth Of Field.


// The ground - it's a simple sine field.
//
float sdGround( in vec3 pos )
{
    pos -= vec3(120.0,-35.0,-700.0);
    pos.x += -150.0;
    pos.z += 30.0*sin(1.00*pos.x*0.016+0.0);
    pos.z += 10.0*sin(2.20*pos.x*0.016+1.0);
    pos.y += 20.0*sin(0.01*pos.x+2.0)*sin(0.01*pos.z+2.0);
    
    return sdBox(pos,vec3(1000.0,2.0,400.0))-10.0;
}

// The bridge. It's made of five boxes (repeated forever
// with a periodic - see the mod() calls), whcih are
// distorted with gentle sine waves so they don't look
// like geometrically perfect. 
//
vec2 sdBridge( in vec3 pos )
{
    float issnow = 0.0;
    vec3 opos = pos;
    pos.x  += 50.0*sin(pos.z*0.01)+10.0;
    pos.xz += 0.05*sin(pos.yx+vec2(0,2));                
    vec3 sos = vec3(abs(pos.x),pos.yz);
    float h = -16.0;
    
    // floor
    vec3 ros = vec3(sos.xy,mod(sos.z+2.0,4.0)-2.0 )-vec3(0.0,h,0.0);
    float d = sdBox(ros,vec3(20.0,1.0,1.85));

    // thick bars
    ros = vec3(sos.xy,mod(sos.z+5.0,10.0)-5.0 )-vec3(20.0,h+5.0-0.4,0.0);
    float d2 = sdBox(ros,vec3(1.2,5.0,0.7)+0.1)-0.1;
    d = min(d,d2);
    
    #if 0
    {
    float id = floor((sos.z+5.0)/10.0);
    ros = vec3(sos.xy,mod(sos.z+5.0,10.0)-5.0 )-vec3(20.0,h-0.4,0.0);
	ros-=vec3(-1.5,1,0);
    ros.x -= ros.y;
    float ra = 0.5 + 0.5*sin(float(id)+4.0);
    float d2 = sdEllipsoid(ros,vec3(2.0,2.0,1.3)*ra);
    issnow = clamp( 0.5+0.5*(d-d2)/0.7, 0.0, 1.0 );
    d = smin(d,d2,0.7);
    }
    #endif

    // small bars
    ros = vec3(sos.xy,mod(sos.z+1.25,2.5)-1.25 )-vec3(20.0,h+5.0,0.0);
    d2 = sdBox(ros,vec3(0.2,5.0,0.2))-0.05;
    d = min(d,d2);
    
    // handle
    d2 = sdBox(sos-vec3(20.0,h+10.0,0.0),vec3(0.5,0.1,300.0))-0.4;
    d = min(d,d2);
    
    // foot bar
    d2 = sdBox(sos-vec3(20.0,h+2.4,0.0),vec3(0.7,0.1,300.0))-0.2;
    d = min(d,d2);
    
	return vec2(d,issnow);
}

// The trees are ultra basic and look really bad without
// defocus, but all I needed was something like looked like
// pine trees so the viewers would complete the picture in
// their heads. Only four trees are evaluated at any time,
// and there inifinte many of them. Yet these four trees
// consume most of the rendering budget for the scene
//
vec3 sdForest( in vec3 pos, float tmin )
{
    float shid = 0.0;
    
    const float per = 200.0;
    
    pos -= vec3(120.0,-16.0,-600.0);
        
    vec3 vos = pos/per;
    vec3 ip = floor(vos);
    vec3 fp = fract(vos);
    
    bool hit = false;
    float d = tmin;
    float occ = 1.0;
    
    for( int j=0; j<=1; j++ )
    for( int i=0; i<=1; i++ )
    {
        vec2 of = vec2(i,j);
        ivec2 tid = ivec2(ip.xz + of );
        tid.y = min(tid.y,-0);
        
        uint treeId = uint(tid.y)*17u+uint(tid.x)*1231u;
        
        vec3 rf =  hash3( uint(treeId) )-0.5;
        
        vec3 ros = vec3( (float(tid.x)+rf.x)*per,
                         0.0,
                         (float(tid.y)+rf.y)*per );


        float hei = 1.0 + 0.2*sin( float(tid.x*115+tid.y*221) );
        hei *= (tid.y==0) ? 1.0 : 1.5;
          
        hei *= 275.0;

        float d2 = sdFakeRoundCone( pos-ros,hei,7.0,1.0);
        if( d2<d)
        {
            d = d2;
            hit = false;
        }
        
        if( d2-150.0>d ) continue;
        
        vec2 qos = pos.xz - ros.xz;
        float an = atan(qos.x,qos.y);
        float ra = length(qos);
        float vv = 0.3*sin(11.0*an) + 0.2*sin(28.0*an)+ 0.10*sin(53.0*an+4.0);

        
        // trick - only evalute 4 closest of the 10 cones
        int segid = int(floor(16.0*(pos.y-ros.y)/hei));
        for( uint k=ZEROU; k<4u; k++ )
        {
            uint rk = uint( min(max(segid+int(k),5),15) );
            
            float h = float(rk)/15.0;
            
            vec3 ran = hash3( treeId*24u+rk );
            
            h += 0.1*(1.0-h)*(ran.z-0.5) + 0.05*sin(1.0*an);

            ros.y = h*hei;
            
            float hh = 0.5 + 0.5*(1.0-h);
            float ww = 0.1 + 0.9*(1.0-h);
            hh *= 0.7+0.2*ran.x;
            ww *= 0.9+0.2*ran.y;
            hh *= 1.0+0.2*vv;
            
            vec2 rrr = vec2( ra, pos.y-ros.y );
            vec2 tmp = sdSegmentOri( rrr,vec2(120.0*ww,-100.0*hh));
            float d2 = tmp.x-mix(1.0,vv,tmp.y);
            if( d2<d )
            {
                hit = true;
                d = d2;
                shid = rf.z;
                occ = tmp.y * clamp(ra/100.0+h,0.0,1.0);
            }
        }
    }
    
    if( hit )
    {
        float dis = 0.5+0.5*fbm1(iChannel0,0.1*pos*vec3(1,0.3,1));
        d -= 8.0*dis-4.0;
        //occ = dis;
    }
    
	return vec3(d,shid,occ);
}


// The SDF of the landscape is made by combining ground, 
// bridge, river and trees. 
//
vec4 map( in vec3 pos, in float time, out float outMat, out vec3 uvw )
{
    pos.xz = rot(pos.xz,0.2);

    vec4 res = vec4(pos.y+36.0,0,0,0);    
    
    outMat = 1.0;
    uvw = pos;
    
    //-------
    {
    vec2 d2 = sdBridge(pos);
    if( d2.x<res.x )
    {
        res.xy = d2;
        outMat = 2.0;
    }
    }
    //-------
    float d = sdGround(pos);
    if( d<res.x )
    {
        res.x = d;
        outMat = 4.0;
    }
    //-------
    float bb = pos.z+450.0;
    if( bb<d )
    {
    vec3 d2 = sdForest(pos,d);
    if( d2.x<res.x )
    {
        res.x = d2.x;
        res.y = d2.y;
        res.z = d2.z;
        outMat = 3.0;
    }
    }
    
    return res;
}

// The landscape SDF again, but with extra high frequency
// modeling detail. While the previous one is used for
// raymarching and shadowing, this one is used for normal
// computation. This separation is conceptually equivalent
// to decoupling detail from base geometry with "normal
// maps", but done in 3D and with SDFs, which is way simpler
// and can be done corretly (something rarely seen in 3D
// engines) without any complexity.
//
float mapD( in vec3 pos, in float time )
{
    float matID; vec3 kk2;
    float d = map(pos,time,matID,kk2).x;
    
    if( matID<1.5 ) // water
    {
        float g = 0.5 + 0.5*fbm1f(iChannel2,0.02*pos.xz);
        g = g*g;
    	float f = 0.5 + 0.5*fbm1f(iChannel2,pos.xz);
        d -= g*12.0*(0.5+0.5*f*g*2.0);
    }
    else if( matID<2.5 ) // bridge
    {
    	d -= 0.07*(0.5+0.5*fbm1(iChannel0, pos*vec3(8,1,8) ));
    }
    else if( matID<4.5 ) // ground
    {
    	float dis = fbm1(iChannel0,0.1*pos);
    	d -= 3.0*dis;
    }
    
    return d;
}

// Computes the normal of the girl's surface (the gradient
// of the SDF). The implementation is weird because of the
// technicalities of the WebGL API that forces us to do
// some trick to prevent code unrolling. More info here:
//
// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
//
vec3 calcNormal( in vec3 pos, in float time, in float t )
{
    float eps = 0.001*t;
#if 0
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize( e.xyy*mapD( pos + e.xyy*eps,time ) + 
					  e.yyx*mapD( pos + e.yyx*eps,time ) + 
					  e.yxy*mapD( pos + e.yxy*eps,time ) + 
					  e.xxx*mapD( pos + e.xxx*eps,time ) );
#else
    vec4 n = vec4(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec4 s = vec4(pos, 0.0);
        s[i] += eps;
        n[i] = mapD(s.xyz, time);
        //if( n.x+n.y+n.z+n.w>100.0 ) break;
    }
    return normalize(n.xyz-n.w);
#endif    
}

// Compute soft shadows for a given light, with a single ray
// insead of using montecarlo integration or shadowmap
// blurring. More info here:
//
// http://iquilezles.org/www/articles/rmshadows/rmshadows.htm
//
float calcSoftshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax, in float time, float k )
{
    float res = 1.0;
    float t = mint;
    
    // first things first - let's do a bounding volume test
    float tm = (480.0-ro.y)/rd.y; if( tm>0.0 ) tmax=min(tmax,tm);
    
    // raymarch and track penumbra
    for( int i=ZERO; i<128; i++ )
    {
        float kk; vec3 kk2;
		float h = map( ro + rd*t, time, kk, kk2 ).x;
        res = min( res, k*h/t );
        t += clamp( h, 0.05, 25.0 );
        if( res<0.002 || t>tmax ) break;
    }
    return max( res, 0.0 );
}

// Computes convexity for our landscape SDF, which can be
// used to approximate ambient occlusion. More info here:
//
// https://iquilezles.org/www/material/nvscene2008/rwwtt.pdf
//
float calcOcclusion( in vec3 pos, in vec3 nor, in float time, float sca, in vec2 px )
{
    float kk; vec3 kk2;
	float ao = 0.0;
    float off = textureLod(iChannel3,px/256.0,0.0).x;
    vec4 k = vec4(0.7012912,0.3941462,0.8294585,0.109841)+off;
    for( int i=ZERO; i<16; i++ )
    {
		k = fract(k + H4);
        vec3 ap = normalize(-1.0+2.0*k.xyz);
        float h = k.w*1.0*sca;
        ap = (nor+ap)*h;
        float d = map( pos+ap, time, kk, kk2 ).x;
        ao += max(0.0,h-d);
        if( ao>10000.0 ) break;
    }
	ao /= 16.0;
    return clamp( 1.0-ao*2.0/sca, 0.0, 1.0 );
}

// Computes the intersection point between our landscape SDF
// and a ray (coming form the camera in this case). It's a
// traditional and basic/uncomplicated SDF raymarcher. More
// info here:
//
// https://iquilezles.org/www/material/nvscene2008/rwwtt.pdf
//
vec2 intersect( in vec3 ro, in vec3 rd, in float time, out vec3 cma, out vec3 uvw )
{
    cma = vec3(0.0);
    uvw = vec3(0.0);
    float matID = -1.0;

    float tmax = 2500.0;
    float t = 15.0;
	// bounding volume test first    
    float tm = (480.0-ro.y)/rd.y; if( tm>0.0 ) tmax=min(tmax,tm);
    
    // raymarch
    for( int i=ZERO; i<1024; i++ )
    {
        vec3 pos = ro + t*rd;

        float tmp;
        vec4 h = map(pos,time,tmp,uvw);
        if( (h.x)<0.0002*t )
        {
            cma = h.yzw;
            matID = tmp;
            break;
        }
        t += h.x*0.8;
        if( t>tmax ) break;
    }

    return vec2(t,matID);
}

// Renders the landscape. It finds the ray-landscape
// intersection point, computes the normal at the
// intersection point, computes the ambient occlusion
// approximation, does per material setup (color,
// specularity, and paints some fake occlusion), and
// finally does the lighting computations themseleves.

vec4 renderBackground( in vec2 p, in vec3 ro, in vec3 rd, in float time, in vec2 px )
{
    // sky color
    vec3 col = vec3(0.45,0.75,1.1) + rd.y*0.5;
    vec3 fogcol = vec3(0.3,0.5,1.0)*0.25;
    col = mix( col, fogcol, exp2(-8.0*max(rd.y,0.0)) );
    
    // -------------------------------
    // find ray-landscape intersection
    // -------------------------------
    float tmin = 1e20;
    vec3 cma, uvw;
    vec2 tm = intersect( ro, rd, time, cma, uvw);

    // --------------------------
    // shading/lighting	
    // --------------------------
    if( tm.y>0.0 )
    {
        tmin = tm.x;
        
        vec3 pos = ro + tmin*rd;
        vec3 nor = calcNormal(pos, time, tmin);

        col = cma;

        float ks = 1.0;
        float se = 16.0;
        float focc = 1.0;
        float occs = 1.0;
        float snow = 1.0;
        
    	// --------------------------
        // materials
    	// --------------------------

        // water
        if( tm.y<1.5 )
        {
            col = vec3(0.1,0.2,0.3);
            occs = 20.0;
        }
        // bridge
        else if( tm.y<2.5 )
        {
            float f = 0.5 + 0.5*fbm1(iChannel0,pos*vec3(8,1,8));
            ks = f*8.0;
            se = 12.0;
            col = mix(vec3(0.40,0.22,0.15)*0.63,
                      vec3(0.35,0.07,0.02)*0.2,f);
            f = fbm1(iChannel0,pos*0.5);
            col *= 1.0 + 1.1*f*vec3(0.5,1.0,1.5);
          	col *= 1.0 + 0.2*cos(cma.y*23.0+vec3(0,0.2,0.5));
            
            float g = 0.5 + 0.5*fbm1(iChannel0,0.21*pos);
            g -= 0.8*nor.x*nor.x;
            snow *= smoothstep(0.2,0.6,g);
        }
        // forest
        else if( tm.y<3.5 )
        {
            col = vec3(0.2,0.1,0.02)*0.7;
            focc = cma.y*(0.7+0.3*nor.y);
            occs = 100.0;
        }
        // ground
        else if( tm.y<4.5 )
        {
            col = vec3(0.7,0.3,0.1)*0.12;
            float d = smoothstep(1.0,6.0,pos.y-(-36.0));
            col *= 0.2+0.8*d;
            occs = 100.0;
            snow = 1.0;
        }

        float fre = clamp(1.0+dot(nor,rd),0.0,1.0);
        float occ = focc*calcOcclusion( pos, nor, time, occs, px );

        snow *= smoothstep(0.25,0.3,nor.y);
        if( abs(tm.y-2.0)<0.5 )
        {
            snow = max(snow,clamp(1.0-occ*occ*3.5,0.0,1.0));
            snow = max(snow,cma.x);
        }

        col = mix( col, vec3(0.7,0.75,0.8)*0.6, snow);
		
		
    	// --------------------------
        // lighting
    	// --------------------------
        vec3 lin = vec3(0.0);

        vec3  lig = normalize(vec3(0.5,0.4,0.6));
        vec3  hal = normalize(lig-rd);
        float dif = clamp(dot(nor,lig), 0.0, 1.0 );
        //float sha = 0.0; if( dif>0.001 ) sha=calcSoftshadow( pos, lig, 0.001, 500.0, time, 8.0 );
        float sha = calcSoftshadow( pos, lig, 0.001, 500.0, time, 8.0 );
        dif *= sha;
        float spe = ks*pow(clamp(dot(nor,hal),0.0,1.0),se)*dif*(0.04+0.96*pow(clamp(1.0+dot(hal,rd),0.0,1.0),5.0));
        vec3  amb = occ*vec3(0.55+0.45*nor.y);

        lin += col*vec3(0.4,0.7,1.1)*amb;
        lin += col*1.4*vec3(2.3,1.5,1.1)*dif;
        lin += spe*2.0;
        lin += snow*vec3(0.21,0.35,0.7)*fre*fre*fre*(0.5+0.5*dif*amb)*focc;

        #if 1
        if( abs(tm.y-2.0)<0.5 )
        {
			float dif = max(0.2+0.8*dot(nor,vec3(-1,-0.3,0)),0.0);
			lin += col*vec3(0.58,0.29,0.14)*dif;
        }
		#endif
		col = lin;

        col = mix( col, vec3(0.3,0.5,1.0)*0.25, 1.0-exp2(-0.0003*tmin) );
    }

    // sun flow
    float glow = max(dot(rd,vec3(0.5,0.4,0.2)),0.0);
    glow *= glow;
    col += vec3(6.0,4.0,3.6)*glow*glow;

    return vec4(col,tmin);
}
    
// The main rendering entry point. Basically it does some
// setup or creating the ray that will explore the 3D
// scene in search of the landscape for each pixel, does
// the rendering of the landscape, and performs the
// Temporal Antialiasing before spiting out the color (in
// linear space, not gama) and the deph of the scene.
//
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // render
    vec2 o = hash3( uint(iFrame) ).xy - 0.5;
    vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;
        
    float time = 2.0 + iTime;
    
    // skip pixels behind girl
    #if 1
    if( length((p-vec2(-0.56, 0.2))/vec2(0.78,1.0))<0.85 ||
        length((p-vec2(-0.56,-0.4))/vec2(1.00,1.0))<0.73)
    {
        fragColor = vec4( 0.55,0.55,0.65,1e20 ); return;
    }
    #endif

    // camera movement	
    vec3 ro; float fl;
    mat3 ca = calcCamera( time, ro, fl );
    vec3 rd = ca * normalize( vec3((p-vec2(-0.52,0.12))/1.1,fl));

    vec4 tmp = renderBackground(p,ro,rd,time,fragCoord);
    vec3 col = tmp.xyz;

    //---------------------------------------------------------------
	// reproject from previous frame and average (cheap TAA, kind of)
    //---------------------------------------------------------------
    
    mat4 oldCam = mat4( textureLod(iChannel1,vec2(0.5,0.5)/iResolution.xy, 0.0),
                        textureLod(iChannel1,vec2(1.5,0.5)/iResolution.xy, 0.0),
                        textureLod(iChannel1,vec2(2.5,0.5)/iResolution.xy, 0.0),
                        0.0, 0.0, 0.0, 1.0 );
    bool oldStarted = textureLod(iChannel1,vec2(3.5,0.5)/iResolution.xy, 0.0).x>0.5;
    
    // world space
    vec4 wpos = vec4(ro + rd*tmp.w,1.0);
    // camera space
    vec3 cpos = (wpos*oldCam).xyz; // note inverse multiply
    // ndc space
    vec2 npos = fl * cpos.xy / cpos.z;
    // undo composition hack
    npos = npos*1.1+vec2(-0.52,0.12); 
    // screen space
    vec2 spos = 0.5 + 0.5*npos*vec2(iResolution.y/iResolution.x,1.0);
    // undo dither
    spos -= o/iResolution.xy;
	// raster space
    vec2 rpos = spos * iResolution.xy;
    
    if( rpos.y<1.0 && rpos.x<4.0 )
    {
    }
	else
    {
        vec3 ocol = textureLod( iChannel1, spos, 0.0 ).xyz;
    	if( !oldStarted ) ocol = col;
        col = mix( ocol, col, 0.1 );
    }

    //----------------------------------
    bool started = textureSize(iChannel0,0).x>=2 &&
                   textureSize(iChannel2,0).x>=2 &&
                   textureSize(iChannel3,0).x>=2;
                           
	if( fragCoord.y<1.0 && fragCoord.x<4.0 )
    {
        if( abs(fragCoord.x-3.5)<0.5 ) fragColor = vec4( started?1.0:0.0, 0.0, 0.0, 0.0 );
        if( abs(fragCoord.x-2.5)<0.5 ) fragColor = vec4( ca[2], -dot(ca[2],ro) );
        if( abs(fragCoord.x-1.5)<0.5 ) fragColor = vec4( ca[1], -dot(ca[1],ro) );
        if( abs(fragCoord.x-0.5)<0.5 ) fragColor = vec4( ca[0], -dot(ca[0],ro) );
    }
    else
    {
        fragColor = vec4( col, tmp.w );
    }
    
    if( !started ) fragColor = vec4(0.0);
}
`;

const buffB = `
// DOF on the background. It's a basic gather approach, where each
// pixel's neighborhood gets scanned and the Circle of Confusion
// computed for each one of those neighbor pixels. If the distance
// to the pixel is smaller than the Circle of Confusion, the current
// pixel gets a contribution from it with a weight that is inversely
// proportional to the area of the Circle of Confusion, to conserve
// energy.


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    vec4 ref = texelFetch( iChannel0, ivec2(fragCoord),0);
    
    vec2 q = fragCoord/iResolution.xy;

    vec4 acc = vec4(0.0);
    const int N = 9;
	for( int j=-N; j<=N; j++ )
    for( int i=-N; i<=N; i++ )
    {
        vec2 off = vec2(float(i),float(j));
        
        vec4 tmp = texture( iChannel0, q + off/vec2(1280.0,720.0) ); 

        float coc = 0.01 + 9.0*(1.0-1.0/(1.0+0.01*abs(tmp.w)));
        
        if( dot(off,off) < coc*coc )
        {
            float w = 1.0/(coc*coc); 
            acc += vec4(tmp.xyz*w,w);
        }
    }
    vec3 col = acc.xyz / acc.w;

    fragColor = vec4(col,ref.w);
}

`;

const fragment = `
// Created by inigo quilez - iq/2020
// I share this piece (art and code) here in Shadertoy and through its Public API, only for educational purposes. 
// You cannot use, sell, share or host this piece or modifications of it as part of your own commercial or non-commercial product, website or project.
// You can share a link to it or an unmodified screenshot of it provided you attribute "by Inigo Quilez, @iquilezles and iquilezles.org". 
// If you are a teacher, lecturer, educator or similar and these conditions are too restrictive for your needs, please contact me and we'll work it out.

// Source code of the mathematical painting "Selfie Girl".
// Making-of video on Youtube:
//
// https://www.youtube.com/watch?v=8--5LwHRhjk

// The image is a single formula, but I had to break it
// down into 3 passes here so it could be shared without
// breaking the WebGL implementation of the web browsers
// (which is what Shadertoy uses to run the code below
// that implements the formula).

// This "Image" tab in particular renders the girl through
// raymarching and then performs the final composition with
// the background, which is computed in "Buffer B" (open
// the rest of the tabs to see explanations of what each
// one does). For the rendering/computer graphics people - 
// there's no TAA in this pass because I didn't want to
// compute velocity vectors for the animation, so things
// alias a bit (feel free to change the AA define below to
// 2 if you have a fast GPU)

#define AA 1


// This SDF is really 6 braids at once (through domain
// repetition) with three strands each (brute forced)
vec4 sdHair( vec3 p, vec3 pa, vec3 pb, vec3 pc, float an, out vec2 occ_id) 
{
    vec4 b = sdBezier(p, pa,pb,pc );
    vec2 q = rot(b.zw,an);
  	
    vec2 id2 = round(q/0.1);
    id2 = clamp(id2,vec2(0),vec2(2,1));
    q -= 0.1*id2;

    float id = 11.0*id2.x + id2.y*13.0;

    q += smoothstep(0.5,0.8,b.y)*0.02*vec2(0.4,1.5)*cos( 23.0*b.y + id*vec2(13,17));

    occ_id.x = clamp(length(q)*8.0-0.2,0.0,1.0);
    vec4 res = vec4(99,q,b.y);
    for( int i=0; i<3; i++ )
    {
        vec2 tmp = q + 0.01*cos( id + 180.0*b.y + vec2(2*i,6-2*i));
        float lt = length(tmp)-0.02;
        if( lt<res.x )
        { 
            occ_id.y = id+float(i); 
            res.x = lt; 
            res.yz = tmp;
        }
    }
    return res;
}

// The SDF for the hoodie and jacket. It's a very distorted
// ellipsoid, torus section, a segment and a sphere.
vec4 sdHoodie( in vec3 pos )
{
    vec3 opos = pos;

    pos.x   += 0.09*sin(3.5*pos.y-0.5)*sin(    pos.z) + 0.015;
    pos.xyz += 0.03*sin(2.0*pos.y)*sin(7.0*pos.zyx);
    
    // hoodie
    vec3 hos = pos-vec3(0.0,-0.33,0.15);
    hos.x -= 0.031*smoothstep(0.0,1.0,opos.y+0.33);
    hos.yz = rot(hos.yz,0.9);
    float d1 = sdEllipsoid(hos,vec3(0.96-pos.y*0.1,1.23,1.5));
	float d2 = 0.95*pos.z-0.312*pos.y-0.9;
    float d = max(opOnion(d1,0.01), d2 );
    
    // shoulders
    vec3 sos = vec3( abs(pos.x), pos.yz );    
    vec2 se = sdSegment(sos, vec3(0.18,-1.6,-0.3), vec3(1.1,-1.9,0.0) );
    d = smin(d,se.x-mix(0.25,0.43,se.y),0.4);
    d = smin(d,sdSphere(sos-vec3(0.3,-2.2,0.4), 0.5 ),0.2);

    // neck
    opos.x -= 0.02*sin(9.0*opos.y);
    vec4 w = opElongate( opos-vec3(0.0,-1.2,0.3), vec3(0.0,0.3,0.0) );
    d = smin(d,
             w.w+sdCappedTorus(vec3(w.xy,-w.z),vec2(0.6,-0.8),0.6,0.02),
             0.1);
    
    // bumps
    d += 0.004*sin(pos.x*90.0)*sin(pos.y*90.0)*sin(pos.z*90.0);
    d -= 0.002*sin(pos.x*300.0);
    d -= 0.02*(1.0-smoothstep(0.0,0.04,abs(opOnion(pos.x,1.1))));
    
    // border
    d = min(d,length(vec2(d1,d2))-0.015);
    
    return vec4(d,pos);
}

// moves the head (and hair and hoodie). This could be done
// more efficiently (with a single matrix or quaternion),
// but this code was optimized for editing, not for runtime
vec3 moveHead( in vec3 pos, in vec3 an, in float amount)
{
    pos.y -= -1.0;
    pos.xz = rot(pos.xz,amount*an.x);
    pos.xy = rot(pos.xy,amount*an.y);
    pos.yz = rot(pos.yz,amount*an.z);
    pos.y += -1.0;
    return pos;
}

// the animation state
vec3 animData; // { blink, nose follow up, mouth } 
vec3 animHead; // { head rotation angles }

// SDF of the girl. It is not as efficient as it should, 
// both in terms of performance and euclideanness of the
// returned distance. Among other things I tweaked the
// overal shape of the head though scaling right in the
// middle of the design process (see 1.02 and 1.04 numbers
// below). I should have backpropagated those adjustements
// to the  primitives themselves, but I didn't and now it's
// too late. So, I am paying some cost there.
//
// Generally, she is modeled to camera (her face's shape 
// looks bad from other perspectives. She's made of five
// ellipsoids blended together for the face, a cone and
// three spheres for the nose, a torus for the teeh and two
// quadratic curves for the lips. The neck is a cylinder,
// the hair is made of three quadratic that are repeated
// multiple times through domain repetition and each of
// them contains three more curves in order to make the
// braids. The hoodie is an ellipsoid deformed with
// two sine waves and cut in half, the neck is an elongated
// torus section and the shoulders are capsules.
//
vec4 map( in vec3 pos, in float time, out float outMat, out vec3 uvw )
{
    outMat = 1.0;

    vec3 oriPos = pos;
    
    // head deformation and transformation
    pos.y /= 1.04;
    vec3 opos;
    opos = moveHead( pos, animHead, smoothstep(-1.2, 0.2,pos.y) );
    pos  = moveHead( pos, animHead, smoothstep(-1.4,-1.0,pos.y) );
    pos.x *= 1.04;
    pos.y /= 1.02;
    uvw = pos;

    // symmetric coord systems (sharp, and smooth)
    vec3 qos = vec3(abs(pos.x),pos.yz);
    vec3 sos = vec3(sqrt(qos.x*qos.x+0.0005),pos.yz);

    
    
    // head
    float d = sdEllipsoid( pos-vec3(0.0,0.05,0.07), vec3(0.8,0.75,0.85) );
    
    // jaw
    vec3 mos = pos-vec3(0.0,-0.38,0.35); mos.yz = rot(mos.yz,0.4);
	mos.yz = rot(mos.yz,0.1*animData.z);
	float d2 = sdEllipsoid(mos-vec3(0,-0.17,0.16),
                 vec3(0.66+sclamp(mos.y*0.9-0.1*mos.z,-0.3,0.4),
                 	  0.43+sclamp(mos.y*0.5,-0.5,0.2),
                      0.50+sclamp(mos.y*0.3,-0.45,0.5)));
        
    // mouth hole
    d2 = smax(d2,-sdEllipsoid(mos-vec3(0,0.06,0.6+0.05*animData.z), vec3(0.16,0.035+0.05*animData.z,0.1)),0.01);
    
    // lower lip    
    vec4 b = sdBezier(vec3(abs(mos.x),mos.yz), 
                      vec3(0,0.01,0.61),
                      vec3(0.094+0.01*animData.z,0.015,0.61),
                      vec3(0.18-0.02*animData.z,0.06+animData.z*0.05,0.57-0.006*animData.z));
    float isLip = smoothstep(0.045,0.04,b.x+b.y*0.03);
    d2 = smin(d2,b.x - 0.027*(1.0-b.y*b.y)*smoothstep(1.0,0.4,b.y),0.02);
    d = smin(d,d2,0.19);

    // chicks
    d = smin(d,sdSphere(qos-vec3(0.2,-0.33,0.62),0.28 ),0.04);
    
    // who needs ears
    

    // eye sockets
    vec3 eos = sos-vec3(0.3,-0.04,0.7);
    eos.xz = rot(eos.xz,-0.2);
    eos.xy = rot(eos.xy,0.3);
    eos.yz = rot(eos.yz,-0.2);
    d2 = sdEllipsoid( eos-vec3(-0.05,-0.05,0.2), vec3(0.20,0.14-0.06*animData.x,0.1) );
	d = smax( d, -d2, 0.15 );

    eos = sos-vec3(0.32,-0.08,0.8);
    eos.xz = rot(eos.xz,-0.4);
    d2 = sdEllipsoid( eos, vec3(0.154,0.11,0.1) );
    d = smax( d, -d2, 0.05 );

    vec3 oos = qos - vec3(0.25,-0.06,0.42);
    
    // eyelid
    d2 = sdSphere( oos, 0.4 );
    oos.xz = rot(oos.xz, -0.2);
    oos.xy = rot(oos.xy, 0.2);
    vec3 tos = oos;        
    oos.yz = rot(oos.yz,-0.6+0.58*animData.x);

    //eyebags
    tos = tos-vec3(-0.02,0.06,0.2+0.02*animData.x);
    tos.yz = rot(tos.yz,0.8);
    tos.xy = rot(tos.xy,-0.2);
	d = smin( d, sdTorus(tos,0.29,0.01), 0.03 );
    
    // eyelids
    eos = qos - vec3(0.33,-0.07,0.53);
    eos.xy = rot(eos.xy, 0.2);
    eos.yz = rot(eos.yz,0.35-0.25*animData.x);
    d2 = smax(d2-0.005, -max(oos.y+0.098,-eos.y-0.025), 0.02 );
    d = smin( d, d2, 0.012 );

	// eyelashes
	oos.x -= 0.01;
    float xx = clamp( oos.x+0.17,0.0,1.0);
    float ra = 0.35 + 0.1*sqrt(xx/0.2)*(1.0-smoothstep(0.3,0.4,xx))*(0.6+0.4*sin(xx*256.0));
    float rc = 0.18/(1.0-0.7*smoothstep(0.15,0.5,animData.x));
    oos.y -= -0.18 - (rc-0.18)/1.8;
    d2 = (1.0/1.8)*sdArc( oos.xy*vec2(1.0,1.8), vec2(0.9,sqrt(1.0-0.9*0.9)), rc )-0.001;
    float deyelashes = max(d2,length(oos.xz)-ra)-0.003;
    
    // nose
    eos = pos-vec3(0.0,-0.079+animData.y*0.005,0.86);
    eos.yz = rot(eos.yz,-0.23);
    float h = smoothstep(0.0,0.26,-eos.y);
    d2 = sdCone( eos-vec3(0.0,-0.02,0.0), vec2(0.03,-0.25) )-0.04*h-0.01;
    eos.x = sqrt(eos.x*eos.x + 0.001);
    d2 = smin( d2, sdSphere(eos-vec3(0.0, -0.25,0.037),0.06 ), 0.07 );
    d2 = smin( d2, sdSphere(eos-vec3(0.1, -0.27,0.03 ),0.04 ), 0.07 );
    d2 = smin( d2, sdSphere(eos-vec3(0.0, -0.32,0.05 ),0.025), 0.04 );        
    d2 = smax( d2,-sdSphere(eos-vec3(0.07,-0.31,0.038),0.02 ), 0.035 );
    d = smin(d,d2,0.05-0.03*h);
    
    // mouth
    eos = pos-vec3(0.0,-0.38+animData.y*0.003+0.01*animData.z,0.71);
    tos = eos-vec3(0.0,-0.13,0.06);
    tos.yz = rot(tos.yz,0.2);
    float dTeeth = sdTorus(tos,0.15,0.015);
    eos.yz = rot(eos.yz,-0.5);
    eos.x /= 1.04;

    // nose-to-upperlip connection
    d2 = sdCone( eos-vec3(0,0,0.03), vec2(0.14,-0.2) )-0.03;
    d2 = max(d2,-(eos.z-0.03));
    d = smin(d,d2,0.05);

    // upper lip
    eos.x = abs(eos.x);
    b = sdBezier(eos, vec3(0.00,-0.22,0.17),
                      vec3(0.08,-0.22,0.17),
                      vec3(0.17-0.02*animData.z,-0.24-0.01*animData.z,0.08));
    d2 = length(b.zw/vec2(0.5,1.0)) - 0.03*clamp(1.0-b.y*b.y,0.0,1.0);
    d = smin(d,d2,0.02);
    isLip = max(isLip,(smoothstep(0.03,0.005,abs(b.z+0.015+abs(eos.x)*0.04))
                 -smoothstep(0.45,0.47,eos.x-eos.y*1.15)));

    // valley under nose
    vec2 se = sdSegment(pos, vec3(0.0,-0.45,1.01),  vec3(0.0,-0.47,1.09) );
    d2 = se.x-0.03-0.06*se.y;
    d = smax(d,-d2,0.04);
    isLip *= smoothstep(0.01,0.03,d2);

    // neck
    se = sdSegment(pos, vec3(0.0,-0.65,0.0), vec3(0.0,-1.7,-0.1) );
    d2 = se.x - 0.38;

    // shoulders
    se = sdSegment(sos, vec3(0.0,-1.55,0.0), vec3(0.6,-1.65,0.0) );
    d2 = smin(d2,se.x-0.21,0.1);
    d = smin(d,d2,0.4);
        
    // register eyelases now
    vec4 res = vec4( d, isLip, 0, 0 );
    if( deyelashes<res.x )
    {
        res.x = deyelashes*0.8;
        res.yzw = vec3(0.0,1.0,0.0);
    }
    // register teeth now
    if( dTeeth<res.x )
    {
        res.x = dTeeth;
        outMat = 5.0;
    }
 
    // eyes
	pos.x /=1.05;        
    eos = qos-vec3(0.25,-0.06,0.42);
    d2 = sdSphere(eos,0.4);
    if( d2<res.x ) 
    { 
        res.x = d2;
     	outMat = 2.0;
        uvw = pos;
    }
        
    // hair
    {
        vec2 occ_id, tmp;
		qos = pos; qos.x=abs(pos.x);

        vec4 pres = sdHair(pos,vec3(-0.3, 0.55,0.8), 
                               vec3( 0.95, 0.7,0.85), 
                               vec3( 0.4,-1.45,0.95),
                               -0.9,occ_id);

        vec4 pres2 = sdHair(pos,vec3(-0.4, 0.6,0.55), 
                                vec3(-1.0, 0.4,0.2), 
                                vec3(-0.6,-1.4,0.7),
                                0.6,tmp);
        if( pres2.x<pres.x ) { pres=pres2; occ_id=tmp;  occ_id.y+=40.0;}

        pres2 = sdHair(qos,vec3( 0.4, 0.7,0.4), 
                           vec3( 1.0, 0.5,0.45), 
                           vec3( 0.4,-1.45,0.55),
                           -0.2,tmp);
        if( pres2.x<pres.x ) { pres=pres2; occ_id=tmp;  occ_id.y+=80.0;}
    

        pres.x *= 0.8;
        if( pres.x<res.x )
        {
            res = vec4( pres.x, occ_id.y, 0.0, occ_id.x );
            uvw = pres.yzw;
            outMat = 4.0;
        }
    }

    // hoodie
    vec4 tmp = sdHoodie( opos );
    if( tmp.x<res.x )
    {
        res.x = tmp.x;
        outMat = 3.0;
        uvw  = tmp.yzw;
    }

    return res;
}

// SDF of the girl again, but with extra high frequency
// modeling detail. While the previous one is used for
// raymarching and shadowing, this one is used for normal
// computation. This separation is conceptually equivalent
// to decoupling detail from base geometry with "normal
// maps", but done in 3D and with SDFs, which is way
// simpler and can be done corretly (something rarely seen
// in 3D engines) without any complexity.
vec4 mapD( in vec3 pos, in float time )
{
    float matID;
    vec3 uvw;
    vec4 h = map(pos, time, matID, uvw);
    
    if( matID<1.5 ) // skin
    {
        // pores
        float d = fbm1(iChannel0,120.0*uvw);
        h.x += 0.0015*d*d;
    }
    else if( matID>3.5 && matID<4.5 ) // hair
    {
        // some random displacement to evoke hairs
        float te = texture( iChannel2,vec2( 0.25*atan(uvw.x,uvw.y),8.0*uvw.z) ).x;
    	h.x -= 0.02*te;
    }    
    return h;
}

// Computes the normal of the girl's surface (the gradient
// of the SDF). The implementation is weird because of the
// technicalities of the WebGL API that forces us to do
// some trick to prevent code unrolling. More info here:
//
// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
//
vec3 calcNormal( in vec3 pos, in float time )
{
    const float eps = 0.001;
#if 0    
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize( e.xyy*map( pos + e.xyy*eps,time,kk ).x + 
					  e.yyx*map( pos + e.yyx*eps,time,kk ).x + 
					  e.yxy*map( pos + e.yxy*eps,time,kk ).x + 
					  e.xxx*map( pos + e.xxx*eps,time,kk ).x );
#else
    vec4 n = vec4(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec4 s = vec4(pos, 0.0);
        float kk; vec3 kk2;
        s[i] += eps;
        n[i] = mapD(s.xyz, time).x;
      //if( n.x+n.y+n.z+n.w>100.0 ) break;
    }
    return normalize(n.xyz-n.w);
#endif   
}

// Compute soft shadows for a given light, with a single
// ray insead of using montecarlo integration or shadowmap
// blurring. More info here:
//
// http://iquilezles.org/www/articles/rmshadows/rmshadows.htm
//
float calcSoftshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax, in float time, float k )
{
    // first things first - let's do a bounding volume test
    vec2 sph = iCylinderY( ro, rd, 1.5 );
  //vec2 sph = iConeY(ro-vec3(-0.05,3.7,0.35),rd,0.08);
    tmax = min(tmax,sph.y);

    // raymarch and track penumbra    
    float res = 1.0;
    float t = mint;
    for( int i=0; i<128; i++ )
    {
        float kk; vec3 kk2;
		float h = map( ro + rd*t, time, kk, kk2 ).x;
        res = min( res, k*h/t );
        t += clamp( h, 0.005, 0.1 );
        if( res<0.002 || t>tmax ) break;
    }
    return max( res, 0.0 );
}

// Computes convexity for our girl SDF, which can be used
// to approximate ambient occlusion. More info here:
//
// https://iquilezles.org/www/material/nvscene2008/rwwtt.pdf
//
float calcOcclusion( in vec3 pos, in vec3 nor, in float time )
{
    float kk; vec3 kk2;
	float ao = 0.0;
    float off = textureLod(iChannel3,gl_FragCoord.xy/256.0,0.0).x;
    vec4 k = vec4(0.7012912,0.3941462,0.8294585,0.109841)+off;
    for( int i=ZERO; i<16; i++ )
    {
		k = fract(k + H4);
        vec3 ap = normalize(-1.0+2.0*k.xyz);
        float h = k.w*0.1;
        ap = (nor+ap)*h;
        float d = map( pos+ap, time, kk, kk2 ).x;
        ao += max(0.0,h-d);
        if( ao>16.0 ) break;
    }
	ao /= 16.0;
    return clamp( 1.0-ao*24.0, 0.0, 1.0 );
}

// Computes the intersection point between our girl SDF and
// a ray (coming form the camera in this case). It's a
// traditional and basic/uncomplicated SDF raymarcher. More
// info here:
//
// https://iquilezles.org/www/material/nvscene2008/rwwtt.pdf
//
vec2 intersect( in vec3 ro, in vec3 rd, in float tmax, in float time, out vec3 cma, out vec3 uvw )
{
    cma = vec3(0.0);
    uvw = vec3(0.0);
    float matID = -1.0;

    float t = 1.0;
    
    // bounding volume test first
    vec2 sph = iCylinderY( ro, rd, 1.5 );
  //vec2 sph = iConeY(ro-vec3(-0.05,3.7,0.35),rd,0.08);
    if( sph.y<0.0 ) return vec2(-1.0);
    
    // clip raymarch space to bonding volume
    tmax = min(tmax,sph.y);
    t    = max(1.0, sph.x);
    
    // raymarch
    for( int i=0; i<256; i++ )
    {
        vec3 pos = ro + t*rd;

        float tmp;
        vec4 h = map(pos,time,tmp,uvw);
        if( h.x<0.001 )
        {
            cma = h.yzw;
            matID = tmp;
            break;
        }
        t += h.x*0.95;
        if( t>tmax ) break;
    }

    return vec2(t,matID);
}

// This is a replacement for a traditional dot(N,L) diffuse
// lobe (called N.L in teh code) that fake some subsurface
// scattering (transmision of light thorugh the skin that
// surfaces as a red glow)
//
vec3 sdif( float ndl, float ir )
{
    float pndl = clamp( ndl, 0.0, 1.0 );
    float nndl = clamp(-ndl, 0.0, 1.0 );
    return vec3(pndl) + vec3(1.0,0.1,0.01)*0.7*pow(clamp(ir*0.75-nndl,0.0,1.0),2.0);
}

// Animates the eye central position (not the actual random
// darts). It's carefuly synched with the head motion, to
// make the eyes anticipate the head turn (without this
// anticipation, the eyes and the head are disconnected and
// it all looks like a zombie/animatronic)
//
float animEye( in float time )
{
    const float w = 6.1;
    float t = mod(time-0.31,w*1.0);
    
    float q = fract((time-0.31)/(2.0*w));
    float s = (q > 0.5) ? 1.0 : 0.0;
    return (t<0.15)?1.0-s:s;
}

// Renders the girl. It finds the ray-girl intersection
// point, computes the normal at the intersection point,
// computes the ambient occlusion approximation, does per
// material setup (color, specularity, subsurface
// coefficient and paints some fake occlusion), and finally
// does the lighting computations.
//
// Lighting is not based on pathtracing. Instead the bounce
// lighting occlusion signals are created manually (placed
// and sized by hand). The subsurface scattering in the
// nose area is also painted by hand. There's not much
// attention to the physicall correctness of the light
// response and materials, but generally all signal do
// follow physically based rendering practices.
//
vec3 renderGirl( in vec2 p, in vec3 ro, in vec3 rd, in float tmax, in vec3 col, in float time )
{
    // --------------------------
    // find ray-girl intersection
    // --------------------------
    vec3 cma, uvw;
    vec2 tm = intersect( ro, rd, tmax, time, cma, uvw );

    // --------------------------
    // shading/lighting	
    // --------------------------
    if( tm.y>0.0 )
    {
        vec3 pos = ro + tm.x*rd;
        vec3 nor = calcNormal(pos, time);

        float ks = 1.0;
        float se = 16.0;
        float tinterShadow = 0.0;
        float sss = 0.0;
        float focc = 1.0;
        //float frsha = 1.0;

        // --------------------------
        // material
        // --------------------------
        if( tm.y<1.5 ) // skin
        {
            vec3 qos = vec3(abs(uvw.x),uvw.yz);

            // base skin color
            col = mix(vec3(0.225,0.15,0.12),
                      vec3(0.24,0.1,0.066),
                      smoothstep(0.4 ,0.0,length( qos.xy-vec2(0.42,-0.3)))+
                      smoothstep(0.15,0.0,length((qos.xy-vec2(0,-0.29))/vec2(1.4,1))));
            
            // fix that ugly highlight
            col -= 0.03*smoothstep(0.13,0.0,length((qos.xy-vec2(0,-0.49))/vec2(2,1)));
                
            // lips
            col = mix(col,vec3(0.14,0.06,0.1),cma.x*step(-0.7,qos.y));
            
            // eyelashes
            col = mix(col,vec3(0.04,0.02,0.02)*0.6,0.9*cma.y);

            // fake skin drag
            uvw.y += 0.025*animData.x*smoothstep(0.3,0.1,length(uvw-vec3(0.0,0.1,1.0)));
			uvw.y -= 0.005*animData.y*smoothstep(0.09,0.0,abs(length((uvw.xy-vec2(0.0,-0.38))/vec2(2.5,1.0))-0.12));
            
            // freckles
            vec2 ti = floor(9.0+uvw.xy/0.04);
            vec2 uv = fract(uvw.xy/0.04)-0.5;
            float te = fract(111.0*sin(1111.0*ti.x+1331.0*ti.y));
            te = smoothstep(0.9,1.0,te)*exp(-dot(uv,uv)*24.0); 
            col *= mix(vec3(1.1),vec3(0.8,0.6,0.4), te);

            // texture for specular
            ks = 0.5 + 4.0*texture(iChannel3,uvw.xy*1.1).x;
            se = 12.0;
            ks *= 0.5;
            tinterShadow = 1.0;
            sss = 1.0;
            ks *= 1.0 + cma.x;
            
            // black top
            col *= 1.0-smoothstep(0.48,0.51,uvw.y);
            
            // makeup
            float d2 = sdEllipsoid(qos-vec3(0.25,-0.03,0.43),vec3(0.37,0.42,0.4));
            col = mix(col,vec3(0.06,0.024,0.06),1.0 - smoothstep(0.0,0.03,d2));

            // eyebrows
    		{
            #if 0
            // youtube video version
        	vec4 be = sdBezier( qos, vec3(0.165+0.01*animData.x,0.105-0.02*animData.x,0.89),
                                     vec3(0.37,0.18-0.005*animData.x,0.82+0.005*animData.x), 
                                     vec3(0.53,0.15,0.69) );
            float ra = 0.005 + 0.015*sqrt(be.y);
            #else
            // fixed version
        	vec4 be = sdBezier( qos, vec3(0.16+0.01*animData.x,0.11-0.02*animData.x,0.89),
                                     vec3(0.37,0.18-0.005*animData.x,0.82+0.005*animData.x), 
                                     vec3(0.53,0.15,0.69) );
            float ra = 0.005 + 0.01*sqrt(1.0-be.y);
            #endif
            float dd = 1.0+0.05*(0.7*sin((sin(qos.x*3.0)/3.0-0.5*qos.y)*350.0)+
                                 0.3*sin((qos.x-0.8*qos.y)*250.0+1.0));
    		float d = be.x - ra*dd;
        	float mask = 1.0-smoothstep(-0.005,0.01,d);
        	col = mix(col,vec3(0.04,0.02,0.02),mask*dd );
        	}

            // fake occlusion
            focc = 0.2+0.8*pow(1.0-smoothstep(-0.4,1.0,uvw.y),2.0);
            focc *= 0.5+0.5*smoothstep(-1.5,-0.75,uvw.y);
            focc *= 1.0-smoothstep(0.4,0.75,abs(uvw.x));
            focc *= 1.0-0.4*smoothstep(0.2,0.5,uvw.y);
            
            focc *= 1.0-smoothstep(1.0,1.3,1.7*uvw.y-uvw.x);
            
            //frsha = 0.0;
        }
        else if( tm.y<2.5 ) // eye
        {
            // The eyes are fake in that they aren't 3D. Instead I simply
			// stamp a 2D mathematical drawing of an iris and pupil. That
			// includes the highlight and occlusion in the eyesballs.
            
            sss = 1.0;

            vec3 qos = vec3(abs(uvw.x),uvw.yz);
			float ss = sign(uvw.x);
            
            // iris animation
            float dt = floor(time*1.1);
            float ft = fract(time*1.1);
            vec2 da0 = sin(1.7*(dt+0.0)) + sin(2.3*(dt+0.0)+vec2(1.0,2.0));
            vec2 da1 = sin(1.7*(dt+1.0)) + sin(2.3*(dt+1.0)+vec2(1.0,2.0));
            vec2 da = mix(da0,da1,smoothstep(0.9,1.0,ft));

            float gg = animEye(time);
            da *= 1.0+0.5*gg;
            qos.yz = rot(qos.yz,da.y*0.004-0.01);
            qos.xz = rot(qos.xz,da.x*0.004*ss-gg*ss*(0.03-step(0.0,ss)*0.014)+0.02);

            vec3 eos = qos-vec3(0.31,-0.055 - 0.03*animData.x,0.45);
            
            // iris
            float r = length(eos.xy)+0.005;
            float a = atan(eos.y,ss*eos.x);
            vec3 iris = vec3(0.09,0.0315,0.0135);
            iris += iris*3.0*(1.0-smoothstep(0.0,1.0, abs((a+3.14159)-2.5) ));
            iris *= 0.35+0.7*texture(iChannel2,vec2(r,a/6.2831)).x;
            // base color
            col = vec3(0.42);
            col *= 0.1+0.9*smoothstep(0.10,0.114,r);
            col = mix( col, iris, 1.0-smoothstep(0.095,0.10,r) );
            col *= smoothstep(0.05,0.07,r);
			
            // fake occlusion backed in
            float edis = length((vec2(abs(uvw.x),uvw.y)-vec2(0.31,-0.07))/vec2(1.3,1.0));
            col *= mix( vec3(1.0), vec3(0.4,0.2,0.1), linearstep(0.07,0.16,edis) );

            // fake highlight
            qos = vec3(abs(uvw.x),uvw.yz);
            col += (0.5-gg*0.3)*(1.0-smoothstep(0.0,0.02,length(qos.xy-vec2(0.29-0.05*ss,0.0))));
            
            se = 128.0;

            // fake occlusion
            focc = 0.2+0.8*pow(1.0-smoothstep(-0.4,1.0,uvw.y),2.0);
            focc *= 1.0-linearstep(0.10,0.17,edis);
            //frsha = 0.0;
        }
        else if( tm.y<3.5 )// hoodie
        {
            sss = 0.0;
            col = vec3(0.81*texture(iChannel0,uvw.xy*6.0).x);
            ks *= 2.0;
            
            // logo
            if( abs(uvw.x)<0.66 )
            {
                float par = length(uvw.yz-vec2(-1.05,0.65));
                col *= mix(vec3(1.0),vec3(0.6,0.2,0.8)*0.7,1.0-smoothstep(0.1,0.11,par));
                col *= smoothstep(0.005,0.010,abs(par-0.105));
            }                

            // fake occlusion
            focc = mix(1.0,
                	   0.03+0.97*smoothstep(-0.15,1.7,uvw.z),
                       smoothstep(-1.6,-1.3,uvw.y)*(1.0-clamp(dot(nor.xz,normalize(uvw.xz)),0.0,1.0))
                      );
            
            //frsha = mix(1.0,
            //            clamp(dot(nor.xz,normalize(uvw.xz)),0.0,1.0),
            //            smoothstep(-1.6,-1.3,uvw.y)
            //           );
            //frsha *= smoothstep(0.85,1.0,length(uvw-vec3(0.0,-1.0,0.0)));
        }
        else if( tm.y<4.5 )// hair
        {
            sss = 0.0;
            col = (sin(cma.x)>0.7) ? vec3(0.03,0.01,0.05)*1.5 :
                                     vec3(0.04,0.02,0.01)*0.4;
            ks *= 0.75 + cma.z*18.0;
            float te = texture( iChannel2,vec2( 0.25*atan(uvw.x,uvw.y),8.0*uvw.z) ).x;
            col *= 2.0*te;
            ks *= 1.5*te;
            
			// fake occlusion
            focc  = 1.0-smoothstep(-0.40, 0.8, uvw.y);
            focc *= 1.0-0.95*smoothstep(-1.20,-0.2,-uvw.z);
            focc *= 0.5+cma.z*12.0;
            //frsha = 1.0-smoothstep(-1.3,-0.8,uvw.y);
            //frsha *= 1.0-smoothstep(-1.20,-0.2,-uvw.z);
        }
        else if( tm.y<5.5 )// teeth
        {
            sss = 1.0;
            col = vec3(0.3);
            ks *= 1.5;
            //frsha = 0.0;
        }

        float fre = clamp(1.0+dot(nor,rd),0.0,1.0);
        float occ = focc*calcOcclusion( pos, nor, time );

        // --------------------------
        // lighting. just four lights
        // --------------------------
        vec3 lin = vec3(0.0);

        // fake sss
        float nma = 0.0;
        if( tm.y<1.5 )
        {
        nma = 1.0-smoothstep(0.0,0.12,length((uvw.xy-vec2(0.0,-0.37))/vec2(2.4,0.7)));
        }

        //vec3 lig = normalize(vec3(0.5,0.4,0.6));
        vec3 lig = vec3(0.57,0.46,0.68);
        vec3 hal = normalize(lig-rd);
        float dif = clamp( dot(nor,lig), 0.0, 1.0 );
        //float sha = 0.0; if( dif>0.001 ) sha=calcSoftshadow( pos+nor*0.002, lig, 0.0001, 2.0, time, 5.0 );
        float sha = calcSoftshadow( pos+nor*0.002, lig, 0.0001, 2.0, time, 5.0 );
        float spe = 2.0*ks*pow(clamp(dot(nor,hal),0.0,1.0),se)*dif*sha*(0.04+0.96*pow(clamp(1.0-dot(hal,-rd),0.0,1.0),5.0));

        // fake sss for key light
        vec3 cocc = mix(vec3(occ),
                        vec3(0.1+0.9*occ,0.9*occ+0.1*occ*occ,0.8*occ+0.2*occ*occ),
                        tinterShadow);
        cocc = mix( cocc, vec3(1,0.3,0.0), nma);
        sha = mix(sha,max(sha,0.3),nma);

        vec3  amb = cocc*(0.55 + 0.45*nor.y);
        float bou = clamp(0.3-0.7*nor.x, 0.0, 1.0 );

        lin +=      vec3(0.65,1.05,2.0)*amb*1.15;
        lin += 1.50*vec3(1.60,1.40,1.2)*sdif(dot(nor,lig),0.5+0.3*nma+0.2*(1.0-occ)*tinterShadow) * mix(vec3(sha),vec3(sha,0.2*sha+0.7*sha*sha,0.2*sha+0.7*sha*sha),tinterShadow);
        lin +=      vec3(1.00,0.30,0.1)*sss*fre*0.6*(0.5+0.5*dif*sha*amb)*(0.1+0.9*focc);
        lin += 0.35*vec3(4.00,2.00,1.0)*bou*occ*col;

        col = lin*col + spe + fre*fre*fre*0.1*occ;

        // overall
		col *= 1.1;
    }

    //if( tm.x==-1.0) col=vec3(1,0,0);
        
    return col;
}

// Animates the head turn. This is my first time animating
// and I am aware I'm in uncanny/animatronic land. But I
// have to start somwhere!
//
float animTurn( in float time )
{	
    const float w = 6.1;
    float t = mod(time,w*2.0);
    
    vec3 p = (t<w) ? vec3(0.0,0.0,1.0) : vec3(w,1.0,-1.0);
    return p.y + p.z*expSustainedImpulse(t-p.x,1.0,10.0);
}

// Animates the eye blinks. Blinks are motivated by head
// turns (again, to prevent animatronic and zoombie uncanny
// valley stuff), but also there are random blinks. This
// same funcion is called with some delay and extra
// smmoothness to get the blink of the eyes be followed by
// the face muscles around the face to react.
//
float animBlink( in float time, in float smo )
{
    // head-turn motivated blink
    const float w = 6.1;
    float t = mod(time-0.31,w*1.0);
    float blink = smoothstep(0.0,0.1,t) - smoothstep(0.18,0.4,t);

    // regular blink
    float tt = mod(1.0+time,3.0);
    blink = max(blink,smoothstep(0.0,0.07+0.07*smo,tt)-smoothstep(0.1+0.04*smo,0.35+0.3*smo,tt));
    
    // keep that eye alive always
    float blinkBase = 0.04*(0.5+0.5*sin(time));
    blink = mix( blinkBase, 1.0, blink );

    // base pose is a bit down
    float down = 0.15;
    return down+(1.0-down)*blink;
}

// The main rendering entry point. Basically it does some
// setup or creating the ray that will explore the 3D scene
// in search of the girl for each pixel, computes the
// animation variables (blink, mouth and head movements),
// does the rendering of the girl if it finds her, and
// finally does gamme correction and some minimal color
// processing and vignetting to the image.
//
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // render
    vec3 tot = vec3(0.0);
    
    #if AA>1
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
        float d = 0.5*sin(fragCoord.x*147.0)*sin(fragCoord.y*131.0);
        float time = iTime - 0.5*(1.0/24.0)*(float(m*AA+n)+d)/float(AA*AA-1);
        #else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
        float time = iTime;
        #endif
        
        time += 2.0;
        
        // camera movement	
        vec3 ro; float fl;
        mat3 ca = calcCamera( time, ro, fl );
    	vec3 rd = ca * normalize( vec3((p-vec2(-0.52,0.12))/1.1,fl));

        // animation (blink, face follow up, mouth)
        float turn = animTurn( time );
        animData.x = animBlink(time,0.0);
        animData.y = animBlink(time-0.02,1.0);
        animData.z = -0.25 + 0.2*(1.0-turn)*smoothstep(-0.3,0.9,sin(time*1.1)) + 0.05*cos(time*2.7);

        // animation (head orientation)
        animHead = vec3( sin(time*0.5), sin(time*0.3), -cos(time*0.2) );
        animHead = animHead*animHead*animHead;
        animHead.x = -0.025*animHead.x + 0.2*(0.7+0.3*turn);
        animHead.y =  0.1 + 0.02*animHead.y*animHead.y*animHead.y;
        animHead.z = -0.03*(0.5 + 0.5*animHead.z) - (1.0-turn)*0.05;
        
        // rendering
        vec4 tmp = texelFetch(iChannel1,ivec2(fragCoord),0);
        vec3 col = tmp.xyz;
        float tmin = tmp.w;
        
        if( p.x*1.4+p.y<0.8 && -p.x*4.5+p.y<6.5 && p.x<0.48)
        col = renderGirl(p,ro,rd,tmin,col,time);
        //else col=vec3(0,1,0);
        
        // gamma        
        col = pow( col, vec3(0.4545) );
	    tot += col;
    #if AA>1
    }
    tot /= float(AA*AA);
    #endif
 
    // compress
    tot = 3.8*tot/(3.0+dot(tot,vec3(0.333)));
  
    // vignette
    vec2 q = fragCoord/iResolution.xy;
    tot *= 0.5 + 0.5*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.15);

    // grade
    tot = tot*vec3(1.02,1.00,0.99)+vec3(0.0,0.0,0.045);
       
    fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'WsSBzh';
  }
  name(): string {
    return 'Selfie Girl';
  }
  // sort() {
  //   return 0;
  // }
  common() {
    return common;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
    return [
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffB, fi: 1 },
      webglUtils.DEFAULT_NOISE_BW,
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
