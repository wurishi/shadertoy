import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// antialiasing - make AA 2, meaning 4x AA, if you have a fast machine
#define AA 1

const vec3 sunDir = normalize( vec3(1.0,0.5,0.7) );


void computeCamera( in float time, out mat3 rCam, out vec3 rRo, out float rFl )
{
    vec3 ro = vec3(-0.045+0.05*sin(0.25*time),-0.04,1.3);
	vec3 ta = vec3(-0.19,-0.08,0.0);
	float fl = 2.45;
    
    vec3 w = normalize(ta-ro);
	float k = inversesqrt(1.0-w.y*w.y);
    rCam = mat3( vec3(-w.z,0.0,w.x)*k, 
                 vec3(-w.x*w.y,1.0-w.y*w.y,-w.y*w.z)*k,
                 -w);
    rRo = ro;
    rFl = fl;
}

//------------------------------------------------------

// http://iquilezles.org/www/articles/texture/texture.htm
float textureGood( sampler2D sam, in vec2 x )
{
	ivec2 p = ivec2(floor(x));
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float a = texelFetch(sam,(p+ivec2(0,0))&255,0).x;
	float b = texelFetch(sam,(p+ivec2(1,0))&255,0).x;
	float c = texelFetch(sam,(p+ivec2(0,1))&255,0).x;
	float d = texelFetch(sam,(p+ivec2(1,1))&255,0).x;
	return mix(mix( a, b,f.x), mix( c, d,f.x), f.y);
}

//------------------------------------------------------

// http://iquilezles.org/www/articles/functions/functions.htm
float almostIdentity( float x, float m, float n )
{
    if( x>m ) return x;
    float a = 2.0*n - m;
    float b = 2.0*m - 3.0*n;
    float t = x/m;
    return (a*t + b)*t*t + n;
}

// http://iquilezles.org/www/articles/smin/smin.htm
float smin( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}

// http://iquilezles.org/www/articles/smin/smin.htm
float smax( float a, float b, float k )
{
	float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( a, b, h ) + k*h*(1.0-h);
}

//------------------------------------------------------

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdEllipsoid( in vec3 p, in vec3 c, in vec3 r )
{
  p = p-c;
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0-1.0)/k1;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdCapsule( in vec3 p, in vec3 a, in vec3 b, in float r )
{
  vec3 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h) - r;
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
vec2 sdCapsule( in vec3 p, in vec4 a, in vec4 b )
{
  vec3 pa = p-a.xyz, ba = b.xyz-a.xyz;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return vec2( length(pa-ba*h) - mix(a.w,b.w,h), h );
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdSphere( in vec3 p, in vec3 c, in float r )
{
  return length(p-c)-r;
}

float sdEllipsoidXY2Z( in vec3 p, in vec3 r )
{
  vec3 d = p/r;
  float h = pow(d.x*d.x + abs(d.y*d.y*d.y) + d.z*d.z, 1.0/3.0); 
  return (h-1.0)*min(r.x,min(r.y,r.z));
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdCappedCylinder( vec3 p, vec2 h )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
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

// http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
float det( vec2 a, vec2 b ) { return a.x*b.y-b.x*a.y; }
vec3 getClosest( vec2 b0, vec2 b1, vec2 b2 ) 
{
  float a =     det(b0,b2);
  float b = 2.0*det(b1,b0);
  float d = 2.0*det(b2,b1);
  float f = b*d - a*a;
  vec2 d21 = b2-b1;
  vec2 d10 = b1-b0;
  vec2 d20 = b2-b0;
  vec2 gf = 2.0*(b*d21+d*d10+a*d20); gf = vec2(gf.y,-gf.x);
  vec2 pp = -f*gf/dot(gf,gf);
  vec2 d0p = b0-pp;
  float ap = det(d0p,d20);
  float bp = 2.0*det(d10,d0p);
  float t = clamp( (ap+bp)/(2.0*a+b+d), 0.0 ,1.0 );
  return vec3( mix(mix(b0,b1,t), mix(b1,b2,t),t), t );
}

// http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
vec4 sdBezier2( vec3 a, vec3 b, vec3 c, vec3 p, out vec3 resP )
{
  vec3 w = normalize( cross( c-b, a-b ) );
  vec3 u = normalize( c-b );
  vec3 v =          ( cross( w, u ) );

  vec2 m = vec2( dot(a-b,u), dot(a-b,v) );
  vec2 n = vec2( dot(c-b,u), dot(c-b,v) );
  vec3 q = vec3( dot(p-b,u), dot(p-b,v), dot(p-b,w) );

  vec3 cp = getClosest( m-q.xy, -q.xy, n-q.xy );

  resP = mix( mix(a,b,cp.z), mix(b,c,cp.z), cp.z );

  return vec4( sqrt(dot(cp.xy,cp.xy)+q.z*q.z), cp.z, length(cp.xy), q.z );
}

vec4 sdBezier( vec3 a, vec3 b, vec3 c, vec3 p )
{
  vec3 kk;
  return sdBezier2(a,b,c,p,kk);
}

// trick by klems
#define ZERO (min(iFrame,0))

`;

const buffA = `
float noise( in vec2 p )
{
  return -1.0+2.0*textureGood( iChannel0, p-0.5 );
}

const float hmin = -6.0;
const float hmax = -1.0;

float mapWater( in vec3 p )
{
    float w = 0.0;
    float s = 0.5;
    vec2 q = p.xz;
    for( int i=0; i<4; i++ )
    {
        w += s*noise(q*vec2(0.5,1.0));
        q = 2.01*(q + vec2(0.03,0.07));
        s = 0.5*s;
    }
    w /= 0.9375;
    
    
    float h = hmin + (hmax-hmin)*w;
    

    float cr = 0.0;
    float wh = 0.2 + 0.8*smoothstep( 0.0, 75.0, -p.z );
    vec2 pp = p.xz/50.0;
    float d = 1e20;
    for( int j=-2; j<=2; j++ )
    for( int i=-2; i<=2; i++ )
    {
        vec2 o = floor( pp );
        o += vec2( float(i), float(j) );
        vec4 ra = texelFetch( iChannel0, ivec2(o)&255, 0 );
        o += ra.xy;
        vec3 r = p - vec3(o.x*50.0,-4.0-(1.0-wh)*5.0+ra.z*ra.z*2.0-3.0,o.y*50.0 + mod(10.0*iTime*0.2,50.0));
        r.yz = mat2(0.99,0.141,-0.141,0.99)*r.yz;
        d = smin( d, sdEllipsoid( r, vec3(0.0,0.0,0.0), (0.2+0.8*wh)*vec3(35.0,(0.1+0.9*ra.z*ra.z)*3.0,15.0)), 2.10 );
        
        float pm = (0.1+0.9*wh)*15.0;
        float cc = 1.0-smoothstep( 0.0, 2.0, abs(abs(r.z)-pm) );
        cr = max( cr, cc );
    }
    d = d - w*0.5;
    d = smin( d, p.y+4.0, 1.0);
    d = d - w*0.03;

    return d;
}

const vec3 bnor = normalize(vec3(0.0,0.9,-0.05));

float mapBeach( in vec3 p )
{
    float d = dot(p,bnor)-2.8;
    
    vec2 w = vec2(0.0);
    vec2 s = vec2(0.5);
    vec2 t = vec2(0.0);
	
    vec2 q = p.xz*1.25;
    q += 1.0*cos( 0.3*q.yx );
    for( int i=0; i<7;i++ )
    {
        float n = 0.5 + 0.5*noise(q);
		w += s*vec2(1.0-almostIdentity(abs(-1.0+2.0*n),0.1,0.05 ),n);
		t += s;
        q = mat2(1.6,1.2,-1.2,1.6)*q;
		s *= vec2(0.3,0.5);
    }
	w /= t;

	float f = w.x + w.y*0.4;
    
    float wet = 1.0-smoothstep(-16.0, -10.0, p.z );
    
    return d - 0.15*mix(f, (1.0-f)*0.1, wet );
}

// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormalmapWater( in vec3 pos, in float ep )
{
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize(e.xyy*mapWater(pos+e.xyy*ep) + 
					 e.yyx*mapWater(pos+e.yyx*ep) + 
					 e.yxy*mapWater(pos+e.yxy*ep) + 
					 e.xxx*mapWater(pos+e.xxx*ep) );
}

// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormalmapBeach( in vec3 pos, in float ep )
{
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize(e.xyy*mapBeach(pos+e.xyy*ep) + 
					 e.yyx*mapBeach(pos+e.yyx*ep) + 
					 e.yxy*mapBeach(pos+e.yxy*ep) + 
					 e.xxx*mapBeach(pos+e.xxx*ep) );
}


float intersectWater( in vec3 ro, in vec3 rd, in float mint )
{
    float t = mint;
    for( int i=0; i<200; i++ )
    {
        vec3 p = ro + t*rd;
        float h = mapWater( p );
        if( abs(h)<(0.0004*t) ) break;
        t += h;
    }
	return t;
}

vec3 sky( in vec3 rd )
{
    if( rd.y<0.0 ) return vec3(0.0,0.05,0.10);
    
    // gradient
    float dy = max(0.0,rd.y);
    vec3 col = vec3(0.3,0.7,0.9) - dy*0.5;
	col = mix( col, vec3(1.3,0.45,0.10), exp(-4.0*dy) );
	col = mix( col, vec3(1.5,0.10,0.05), exp(-30.0*dy) );
	col = mix( col, vec3(0.1,0.10,0.10), exp(-60.0*dy) );
    
    // clouds
    vec2 uv = 0.003*rd.xz/rd.y;
	uv += 0.006*sin(100.0*uv.yx);
    float f  = 0.5000*texture( iChannel0, 1.0*uv.xy ).x;
          f += 0.2500*texture( iChannel0, 1.9*uv.yx ).x;
          f += 0.1250*texture( iChannel0, 4.1*uv.xy ).x;
          f += 0.0625*texture( iChannel0, 7.9*uv.yx ).x;
          
    return mix( col, vec3(1.0,0.37,0.4)*(1.0-f)*0.5,0.3*smoothstep(0.4,0.7,f) );
}

vec4 render( in vec3 ro, in vec3 rd )
{
	vec3 col = vec3(0.0);
    
    float ma = -1.0;
    float tmin = 1e20;
    
    float t = (hmax-ro.y)/rd.y;
    if( t>5.0 )
    {
        t = intersectWater( ro, rd, t );
        ma = 0.0;
        tmin = t;
    }

    t = (-2.8-dot(ro,bnor))/dot(rd,bnor);
    if( t>0.0 && t<tmin)
    {
		tmin = t;
		ma = 1.0;
    }

    if( ma<0.0 )
    {
        col = sky( rd );
    }
    else if( ma<0.5 )
    {
    	vec3 pos = ro + tmin*rd;
        vec3 nor = calcNormalmapWater(pos,0.0001*tmin);

        float h = (pos.y - hmin)/(hmax-hmin);
        float f = exp(-0.01*tmin);
        col = mix( vec3(0.03,0.1,0.1), vec3(0.02,0.04,0.08), 1.0-f );
        
        h = 1.0-abs(nor.y);
        col += h*vec3(0.00,0.03,0.03)*2.0;

        vec3 ref = reflect( rd, nor );
        float kr = pow( clamp(1.0 + dot( rd, nor ),0.0,1.0), 5.0 );
        col += 0.7*(0.01 + 0.99*kr)*sky( ref );
        
        
        float dif = clamp( dot(nor,sunDir),0.0,1.0);
        col *= 0.8 + 0.4*dif;
        col *= 0.75;
        
        // foam waves
        float foam = smoothstep( -0.5, 0.1, -nor.y );
		// foam shore
		float te = texture(iChannel0,0.016*pos.xz + vec2(-0.002,-.007)*iTime).x;
		foam += 
		smoothstep(-24.0,-23.0,pos.z + 0.5*sin(pos.x*0.4+te*2.0))*
		smoothstep(0.4,0.5,te)*0.8;
	    col = mix( col, vec3(0.8,0.9,1.0), 0.4*foam );
    
        // fog
		col = mix( col, vec3(0.1), 1.0-exp(-0.000001*tmin*tmin) );
    }
	else if( ma<1.5 )
    {
        col = vec3(0.0);

        vec3 pos = ro + tmin*rd;
        vec3 nor = calcNormalmapBeach(pos,0.0002);

		vec3 mateD = vec3(1.0,0.7,0.5)*0.17;
        vec2 mateK = vec2(1.0,0.5);
        float mateS = 0.0;

		
        float fr = pow(clamp( 1.0+dot(rd,nor), 0.0, 1.0 ),2.0);
		mateD += 0.05*vec3(1.0,0.5,0.2)*fr;

		
        float wet = 1.0-smoothstep(-17.0, -11.0, pos.z );
		mateD = mix( mateD, vec3(0.05,0.02,0.0)*0.8, wet );
        mateK.x += 12.0*wet;
        mateK.y += 9.0*wet;
        
		mateD *= 0.9;
        
		float dif1 = clamp( -0.1+1.4*dot(nor,sunDir),0.0,1.0);
        vec3 hal = normalize( sunDir-rd );
        float spe = pow(clamp(dot(hal,nor),0.0,1.0),0.001+8.0*mateK.y);
		col += mateD*4.0*vec3(2.5,1.0,0.5)*dif1;
			col += mateK.x*vec3(1.4,1.30,1.3)*dif1*spe*(0.04+0.96*pow(clamp(dot(hal,nor),0.0,1.0),5.0));

        col += mateD*vec3(1.0,0.9,0.9)*(0.5+0.5*nor.y)*0.2;
        col += mateK.x*vec3(0.8,0.8,0.9)*smoothstep( -0.1,0.3,reflect(rd,nor).y) *(0.04+0.96*pow(clamp(dot(rd,nor),0.0,1.0),5.0));
        
    }
    
    return vec4(col,tmin);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    mat3 ca; vec3 ro; float fl;
    computeCamera( iTime, ca, ro, fl );
    
    vec2  p = (2.0*fragCoord.xy-iResolution.xy)/iResolution.y;
    vec3  rd = normalize( ca * vec3(p,-fl) );
    
    fragColor = render( ro, rd );
}
`;

const buffB = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    vec2 q = fragCoord/iResolution.xy;

    vec4 acc = vec4(0.0);
    const int N = 5;
	for( int j=-N; j<=N; j++ )
    for( int i=-N; i<=N; i++ )
    {
        vec2 off = vec2(float(i),float(j));
        
        vec4 tmp = texture( iChannel1, q + off/vec2(1280.0,720.0) ); 
        if( dot(off,off) < float(N*N) )
        {
            acc += vec4(tmp.xyz,1.0);
        }
    }
    vec3 col = acc.xyz / acc.w;

    fragColor = vec4(col,1.0);
}
`;

const buffC = `
const vec3 corner1 = vec3(-0.088,-0.103,0.084);
const vec3 center  = vec3(-0.005,-0.193,0.14);
const vec3 corner2 = vec3( 0.098,-0.105,0.08);

vec3 transformHead( in vec3 p )
{
  p.x += 0.012;
  return mat3( 0.986264,-0.097838, -0.133010,
               0.086792, 0.992467, -0.086465,
               0.140468, 0.073733,  0.987326)*p;
}

vec3 transformHat(in vec3 p)
{
  p.y -= 0.03;
  p = mat3( 0.79200, -0.141, 0.59400,
           -0.26976,  0.792, 0.54768,
           -0.54768, -0.594, 0.58924)*p;
  p.y -= 0.1;
  return p;
}

const float eyeOff = 0.005;

vec3 map( vec3 p )
{
	vec3 headp = transformHead( p );
	vec3 headq = vec3( abs(headp.x), headp.yz );

    // head
	float d = sdEllipsoid( headp, vec3(0.0,0.015,-0.06 ),vec3(0.33,0.365,0.34) );
	d = smax(d,-sdEllipsoid( vec3( almostIdentity( headq.x, 0.03, 0.01 ), headp.yz),  vec3( 0.25,0.06,0.4),vec3(0.4,0.2,0.2) ), 0.015);
    //d = smax(d,-sdEllipsoid( vec3( sqrt(headq.x*headq.x+0.0001), headp.yz),  vec3( 0.25,0.06,0.4),vec3(0.4,0.2,0.2) ), 0.015);
	d = smin(d,sdEllipsoid( headp, vec3(0.0,-0.165,0.13),vec3(0.22,0.15,0.145)), 0.01 );
	d = smin(d,sdEllipsoid( headp, vec3(0.01,-0.2,0.17),vec3(0.12,0.115,0.105)), 0.01 );
	d = smin(d,sdEllipsoid( headq, vec3(0.1,-0.103,0.09),vec3(0.175,0.146,0.18) ), 0.02);

    
    // nose
	vec3 n = headp-vec3(0.0,0.1,0.23);
	n.x -= n.y*n.y*0.18;
	n.yz = mat2(0.98,0.198997,-0.198997,0.98)*n.yz;
	d = smin( d, sdCone( n, vec2(0.01733,-0.13) ), 0.03);
	n.yz -= vec2(-0.102975, 0.004600);
	vec3 m = vec3(abs(n.x),n.yz);
	float na = sdCone( n, vec2(0.527,-0.85) );
	na = smax( na, sdSphere(n,vec3(0.0,-0.03,-0.04),0.1), 0.015 );
	na = smin( na, sdEllipsoid(m, vec3(0.038,-0.085,0.0),vec3(0.027)), 0.016 );
	na = smin( na, sdEllipsoid(m, vec3(0.0,-0.11,-0.01), vec3(0.02,0.02,0.02)), 0.02 );
	na = smax(na,-sdEllipsoid(m, vec3(0.033,-0.09,0.008),vec3(0.01,0.02,0.009)*1.5), 0.008 );
	d = smin( d, na, 0.01);

    // mouth
	vec3 bocap = headp-vec3(-0.006,-0.026,0.22);
	vec3 bocap3 = bocap;
	bocap.xy = mat2x2(0.99,-0.141,0.141,0.99)*bocap.xy;
	vec3 bocap2 = bocap;
	bocap.yz = mat2x2(0.9,-0.346,0.346,0.9)*bocap.yz;
	float  labioa = sdCone(bocap, vec2(0.219,-0.18) );
	labioa = smax( labioa, sdEllipsoid(bocap,vec3(0.0,0.1,-0.15), vec3(0.22,0.35,0.34)), 0.02 );
	d = smin( d, labioa, 0.015 );
	d = smax( d, -sdCapsule( bocap, vec3(0.0,-0.077,0.115),vec3(0.0,-0.09,0.135), 0.013 ), 0.01 );
	bocap2.y -= min(bocap2.x*bocap2.x*4.0,0.04);
	d = smax( d, -sdEllipsoid(bocap2,vec3(0.0,-0.172,0.15), vec3(0.09+0.008*sign(bocap.x),0.017,0.25)), 0.01 );		
	vec4 b = sdBezier( corner1, center, corner2, bocap );
	d = smin(d,b.x - 0.0075*sqrt(4.0*b.y*(1.0-b.y)), 0.005);

    // ears
	vec3 earq = headq - vec3(0.34,-0.04,0.02);
	earq.xy = mat2(0.9,0.436,-0.436,0.9)*earq.xy;
	earq.xz = mat2(0.8,0.6,-0.6,0.8)*earq.xz;
	float ear = sdEllipsoid( earq, vec3(0.0),vec3(0.08,0.12,0.09) );
	ear = smax( ear, (abs(earq.z)-0.016), 0.01 );
	ear = smin( ear, sdSphere(earq,vec3(0.015,0.0,-0.03),0.04), 0.02);        
	ear = smax( ear, -0.8*sdEllipsoid( earq, vec3(0.0,0.022,0.02),vec3(0.06,0.08,0.027) ),0.01 );
	ear = smax( ear, -sdEllipsoid( earq, vec3(-0.01,-0.01,0.01),vec3(0.04,0.04,0.05) ), 0.01 );
	d = smin(d,ear, 0.015);
    
    
    // eye sockets
	d = smax(d,-sdEllipsoid( headq, vec3(0.1+eyeOff,0.03,0.11),vec3(0.105,max(0.0,0.12-0.2*headq.x),0.115)+0.01),0.01 );
	b = sdBezier( vec3(0.053+eyeOff,0.017,0.225), vec3(0.12+eyeOff,-0.02,0.255), vec3(0.18+eyeOff,0.02,0.205), headq-vec3(0.0,0.03-0.04,0.0) );
	d = smin(d,b.x - 0.003*b.y*(1.0-b.y)*4.0,0.012);

    // chin fold
	n = (headp-vec3(0.14,-0.16,0.297));
	n.xy = mat2(0.8,0.6,-0.6,0.8)*n.xy;
	d = smax(d, -sdEllipsoid( n,  vec3(0.0), vec3(0.096,0.01,0.03)), 0.007);
	
    // neck/body
	{
	vec3 q = vec3( abs(p.x), p.yz );
	d = smin( d, sdCapsule( p, vec4(0.0,-0.1,-0.1,0.1), vec4(0.0,-0.6,-0.1, 0.12 )).x, 0.05 );
	d = smin( d, sdCapsule( q, vec3(0.0,-0.62,-0.08), vec3(0.24,-0.71,0.02-0.1), 0.16 ), 0.05 );        
	d = smin( d, sdCapsule( q, vec4(0.046,-0.555,0.05,0.01), vec4(0.250,-0.55,-0.035,-0.02) ).x, 0.03 );
	}
    
	vec3 res = vec3(d,1.0,1.0);
    

    // eyes
	m = headq - vec3(0.0021,0.0,0.019);
	d = sdEllipsoid( m, vec3(0.1+eyeOff,0.03,0.11),vec3(0.105,0.09,0.1) );
	d = smax(d,-sdEllipsoid( headq, vec3(0.102+eyeOff+0.004*sign(headp.x)*1.8,0.03+0.004*1.8,0.28),vec3(0.07) ),0.001);
	if( d<res.x ) res = vec3(d,2.0,1.0);

    // teeth
	{
	bocap3 = bocap3 - vec3(0.01,-0.055,0.04);
	bocap3.xz = mat2x2(0.99,0.141,-0.141,0.99)*bocap3.xz;
	d = sdCappedCylinder( bocap3.xzy, vec2(0.11,0.01) );
	vec3 dd = bocap3;
	dd.x = mod(dd.x+0.0075,0.015)-0.0075;
	float sp = sdBox( dd-vec3(0.0,-0.1,0.0), vec3(0.0004,0.018,0.015) );
	d = smax(d,-sp,0.003);
	d = max( d, dot(bocap3.xy,vec2(-0.707,0.707))+0.05 );
	if( d<res.x ) res = vec3(d,8.0,1.0);
	}

	
	// eyebrows
	b = sdBezier( vec3(0.035,0.16,0.0), vec3(0.1,0.18,-0.02), vec3(0.2,0.12,-0.1), 
	(headq-vec3(0.0,0.0,0.25))*vec3(1.0,1.0,2.0) );
	d = b.x - 0.01*sqrt(clamp(1.0-b.y,0.0,0.9));
	float fr = (sign(b.w)*headq.x*0.436+0.9*headq.y);
	float cp = cos(1300.0*fr);
	cp -= 0.5*cos(600.0*fr); 
	cp += 0.3*cos(330.0*fr);
	cp *= clamp(1.0-3.0*headq.x,0.0,0.8);
	d -= cp*0.0017;
	d/=1.5;
	if( d<res.x ) { res = vec3(d,3.0,0.4);}

    // hair
	//if( p.x>-0.4 && p.y>-0.1) // +10%
	{
		float hh = 0.27 - headp.y;

		float ss = sign(headp.x);

		vec3 pelop = headp;
		pelop.x += (1.0-hh)*0.007*cos(pelop.y*30.0);
		vec3 peloq = vec3( abs(pelop.x), pelop.yz );
		
		vec3 ta = vec3(0.0);
		float vc = 0.0;

		{
		const vec3 p0a = vec3(0.05,0.3,0.15);
		const vec3 p0b = vec3(0.18,0.17,0.22);
		const vec3 p0c = vec3(0.1,0.2,0.23);
		vec4 b = sdBezier( p0a, p0c, p0b, pelop );
		float d1 = b.x - 0.06*(1.0-0.9*b.y);
		d = d1; ta = p0b - p0a; vc = b.y;
		}
		{
		const vec4 p1a = vec4(-0.04,0.26,0.15,0.075);
		const vec4 p1c = vec4(0.02,0.2,0.24,0.015);
		vec2 b = sdCapsule(pelop, p1a, p1c );
		float d1 = b.x;
		if( d1<d ) { d=d1; ta = (p1a.xyz-p1c.xyz)*vec3(ss,1.0,1.0); vc = b.y;}
		}
		{
		const vec4 p2a = vec4(0.16,0.25,0.14,0.07);
		vec4 p2b = vec4(0.185+0.025*ss,0.14,0.23-0.02*ss,0.006);
		vec2 b = sdCapsule(peloq, p2a, p2b );
		float d1 = b.x;
		if( d1<d ) { d=d1; ta = p2b.xyz-p2a.xyz; vc = b.y;}
		}
		{
		const vec3 p3a = vec3(0.205,0.20,0.14);
		vec3 p3b = vec3(0.255+0.01*ss,0.05,0.17);
		vec3 p3c = vec3(0.21+0.01*ss,0.15,0.18);
		vec4 b = sdBezier( p3a, p3c, p3b, peloq );
		float d1 = b.x - 0.06*(1.0-0.9*b.y);
		if( d1<d ) { d=d1; ta = p3b-p3a; vc = b.y;}
		}
		{
		const vec4 p4a = vec4(0.24,0.16,0.11,0.06);
		vec4 p4b = vec4(0.285,-0.04,0.14,0.006);
		vec2 b = sdCapsule(peloq, p4a, p4b );
		float d1 = b.x;
		if( d1<d ) { d=d1; ta = p4b.xyz-p4a.xyz; vc = b.y; }
		}
		{
		const vec4 p5a = vec4(0.275,0.12,0.07,0.06);
		vec4 p5b = vec4(0.295,-0.09,0.1,0.006);
		vec2 b = sdCapsule(peloq, p5a, p5b );
		float d1 = b.x;
		if( d1<d ) { d=d1; ta = p5b.xyz-p5a.xyz; vc = b.y; }
		}

		
		{
		vec3 vv = normalize(vec3(ta.z*ta.z+ta.y*ta.y, -ta.x*ta.y, -ta.x*ta.z) );
		float ps  = dot(peloq,vv);
		d -= 0.003*sin(300.0*ps);
		d -= 0.008*(-1.0+2.0*textureGood( iChannel0, vec2(1024.0*ps,vc*5.12) ));
		}
		
		if( d<res.x ) res = vec3(d,3.0,vc);
	}

    // eyelashes
	{
	vec3 cp;
	vec4 b = sdBezier2(  vec3(0.0525+0.0025*sign(headp.x)+eyeOff,0.063, 0.225), 
			vec3(0.120+eyeOff,0.135, 0.215), vec3(0.1825+eyeOff+0.0025*sign(headp.x),0.050, 0.200), 
			headq, cp );
	float ls = 4.0*b.y*sqrt(1.0-b.y);
	d = b.x - 0.002*ls;
	d += 0.001*ls*sin(headq.x*300.0-headq.y*300.0)*step(cp.y,headq.y);
	d += 0.001*ls*sin(headq.x*1000.0-headq.y*1000.0)*step(cp.y,headq.y);
	if( d<res.x ) { res = vec3(d,3.0,0.35);}
    }
	

    // hat
    {
	vec3 hatp = transformHat( headp );
	d = sdEllipsoidXY2Z( hatp, vec3(0.36,0.38,0.365) );
	d = abs(d+0.003)-0.003;
	d = smax(d,-0.065-hatp.y,0.006);
	float gb = abs(hatp.x)-hatp.z-0.0975;
	d -= 0.002*sqrt(clamp(abs(gb)/0.015,0.0,1.0)) - 0.002;
	hatp.y += 0.1;
	float p1 = abs(sin(600.0*hatp.x+hatp.y*200.0));
	float p2 = abs(cos(150.0*hatp.z)*sin(150.0*hatp.y));
	p2 *= smoothstep(0.01,0.02,hatp.y-0.035);
	d -= 0.0005*mix(p1,2.0*p2,smoothstep(0.0,0.01,gb));
	if( d<res.x ) res = vec3(d,4.0,1.0);
	vec3 vp = hatp - vec3(0.0,0.19,0.0);
	vp.yz = mat2(0.8,-0.6,0.6,0.8)*vp.yz;
	vp.y -= 0.2*sqrt(clamp(1.0-vp.x*vp.x/0.115,0.0,1.0))-0.1;
	d = 0.8*sdEllipsoid( vp, vec3(0.0,0.0,0.25),vec3(0.3,0.04,0.35) );
	if( d<res.x ) res = vec3(d,5.0,1.0);
    }	
	
	
	return res;
}

// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormalmap( in vec3 pos, in float ep )
{
#if 0    
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize(e.xyy*map(pos+e.xyy*ep).x + 
					 e.yyx*map(pos+e.yyx*ep).x + 
					 e.yxy*map(pos+e.yxy*ep).x + 
					 e.xxx*map(pos+e.xxx*ep).x );
#else
    // inspired by tdhooper and klems - a way to prevent the compiler from inlining map() 4 times
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(pos+e*ep).x;
    }
    return normalize(n);
#endif    
}

//=========================================================================

float calcAO( in vec3 pos, in vec3 nor )
{
	float ao = 0.0;

	vec3 v = normalize(vec3(0.7,0.5,0.2));
	for( int i=ZERO; i<12; i++ )
	{
		float h = abs(sin(float(i)));
		vec3 kv = v + 2.0*nor*max(0.0,-dot(nor,v));
		ao += clamp( map(pos+nor*0.01+kv*h*0.08).x*3.0, 0.0, 1.0 );
		v = v.yzx; if( (i&2)==2) v.yz *= -1.0;
	}
	ao /= 12.0;
	ao = ao + 2.0*ao*ao;
	return clamp( ao*5.0, 0.0, 1.0 );
}

// http://iquilezles.org/www/articles/rmshadows/rmshadows.htm
float calcSoftShadow( in vec3 ro, in vec3 rd, float k )
{
	float res = 1.0;
	float t = 0.001;
	for( int i=ZERO; i<50; i++ )
	{
		float h = map(ro + rd*t ).x;
		res = min( res, smoothstep(0.0,1.0,1.4*k*(h+0.0015)/sqrt(t)) );
		t += clamp( h, 0.003, 0.1 );
		if( res<0.001 || t>0.8) break;
	}
	return clamp(res,0.0,1.0);
}


vec3 shade( in vec3 ro, in vec3 rd, in float t, in float m, in float matInfo )
{
	float eps = (abs(m-3.0)<0.2) ? 0.002: 0.0002;
	
	vec3 pos = ro + t*rd;
	vec3 nor = calcNormalmap( pos, eps );
	

	vec3 mateD = vec3(0.0);
	vec2 mateK = vec2(0.0);
	float mateS = 0.0;
	vec3 mateSG = vec3(1.0);

	if( m<1.5 )
	{
		mateD = vec3(0.132,0.06,0.06);
		
		vec3 p = transformHead( pos );
		vec3 headp = p;
		vec3 q = vec3( abs(p.x), p.yz );

		float m = 1.0 - smoothstep( 0.04, 0.14, length(q-vec3(0.16,-0.11,0.23)) );
		float no = texture(iChannel0,p.xy).x;
		m = clamp( m + 0.25*(-1.0+2.0*no), 0.0, 1.0 );
		mateD = mix( mateD, vec3(0.13,0.03,0.03), m );
		

		mateSG = vec3(0.75,0.97,1.0);

					
		m = 1.0 - smoothstep( 0.04, 0.17, length(q-vec3(0.45,-0.01,0.0)) );
		mateD += vec3(1.0,0.01,0.0)*m*0.3*(1.0+0.4*sign(p.x));
		mateSG = mix( mateSG, vec3(0.3-0.1*sign(p.x),0.9,1.0), m );;

		m = 1.0 - smoothstep( 0.05, 0.1, length(vec3(0.5,1.0,1.0)*(q-vec3(0.0,-0.06,0.23))) );

		vec2 uv = pos.xy*22.0;
		vec2 iuv = floor(uv);
		vec2 fuv = fract(uv);
		vec4 ran = texelFetch( iChannel0, (ivec2(iuv)+6)&255, 0 );
		vec2 off = ran.xy;
		float sss = pow(ran.z,5.0);
		float size = max(0.0,(0.5+0.5*m)*(0.3+0.7*sss)*0.12);
		float fr = 1.0 - smoothstep( size*0.5, size*2.0, length(fuv-off) );
		mateD = mix(mateD,vec3(0.25,0.05,0.0)*0.2, 0.6*(1.0-0.4*sss)*fr );
					
		mateK = vec2(0.08,0.5);
		mateS = 1.0;    

		
		vec3 bocap = headp-vec3(-0.006,-0.025,0.22);
		bocap.xy = mat2x2(0.99,-0.141,0.141,0.99)*bocap.xy;
		bocap.yz = mat2x2(0.9,-0.346,0.346,0.9)*bocap.yz;
		
		{
		vec4 b = sdBezier( corner1, center, corner2, bocap );
		float d1 = b.x - 0.01*4.0*b.y*(1.0-b.y);
		float isLip = 1.0-smoothstep( 0.0005, 0.0050, d1 );
		mateD = mix( mateD, vec3(0.14,0.04,0.05), 0.7*isLip );
		mateK = mix( mateK, vec2(0.4,1.5), isLip );
		}
		
		mateK *= 0.5 + no;
	}
	else if( m<2.5 )
	{
		mateD = vec3(0.18,0.18,0.225)*0.85;
		mateK = vec2(0.5,10.0);
		mateSG = vec3(1.0,1.0,0.9);
		
        
		vec3 p = transformHead( pos );
		vec3 q = vec3( abs(p.x), p.yz );
        q.x -= eyeOff;
        
		
		vec2 r = q.xy-vec2(0.102+0.004*sign(p.x),0.03+0.004);
		
		float m = length(r) - 0.042;
		if( m<0.0 )
		{
			m = abs(m);
			mateD = mix( mateD, vec3(0.0), smoothstep(0.0,0.003,m));
			mateD = mix( mateD, vec3(0.06,0.02,0.0), smoothstep(0.003,0.006,m));
			
			r.x *= -sign(p.x);
			float an = atan(r.y,r.x) + 1.5;
			float ca = 1.0-smoothstep(0.0,1.0,abs(an-1.0));
			ca *= 1.0-smoothstep(0.0,0.008,abs(m-0.011));

			float te = texture(iChannel0, vec2(an*0.1,m)).x;
			mateD = mix( mateD, (1.8*te*vec3(0.06,0.02,0.0)+(0.5+0.5*te)*ca*1.3*vec3(0.1,0.07,0.05)), smoothstep(0.003,0.006,m));

			mateD = mix( mateD, vec3(0.0), smoothstep(0.017,0.018,m-0.001));
			mateK = vec2(0.05,8.0);
		}

		r = q.xy-vec2(0.105+0.03*sign(p.x),0.058);
		mateD += (1.0-smoothstep(0.00,0.012,length(r)))*1.0;
	}
	else if( m<3.5 )
	{
		float focc = smoothstep(0.0,1.0,matInfo);

		mateD = vec3(0.025,0.015,0.01)*0.6*focc;
		mateK = vec2(0.1*focc,1.0);
	}
	else if( m<4.5 )
	{
		vec3 hatp = pos;
		hatp = transformHat(hatp);
		hatp.y += 0.1;
		float f = abs(hatp.x)-hatp.z;
		f = smoothstep(0.19,0.2,f );
		
		vec3 blue = vec3(0.01,0.04,0.08);
		vec3 te = 
		texture( iChannel0, 0.15*pos.yz ).xyz+
		texture( iChannel0, 1.0*pos.yz ).xyz;
		blue *= 0.5+0.5*te.z;
		mateD = mix( vec3(0.18), blue, f );
		mateS = 0.05;
		
			
		vec2 si = (hatp.xy-vec2(0.0,-0.18)) * 3.5;
		float h = si.y - 0.1*sin( 8.0*si.x );
		h = min( abs(h-1.15)-0.06, abs(h-1.0)-0.015 );
		h += clamp( (abs(hatp.x)-0.25)/0.1, 0.0, 1.0 );
		mateD = mix( mateD, vec3(0.004,0.008,0.014), 1.0-smoothstep( 0.01, 0.02, h ) );
		
	}
	else if( m<5.5 )
	{
		mateD = 0.5*vec3(0.01,0.04,0.08);
		mateD *= 0.7+0.6*texture( iChannel0, 2.0*pos.xz ).x;
		mateS = 0.05;
	}
	else if( m<8.5 )
	{
		mateD = vec3(0.30,0.30,0.40)*0.5;
		mateK = vec2(0.5,1.0);
		mateS = 0.2;
		
	}
	
	float fre = clamp(1.0+dot(nor,rd), 0.0, 1.0 );
	float occ = calcAO( pos, nor );
	
	vec3 col = vec3(0.0);
	
    {
		// key
		float dif1 = dot(nor,sunDir);
		vec3 hal = normalize( sunDir-rd );
		float spe = pow(clamp(dot(hal,nor),0.0,1.0),0.001+8.0*mateK.y);
		float sha = calcSoftShadow( pos+nor*0.0005, sunDir, 24.0 ); 
		float ssha = 1.0;
		if( abs(m-3.0)<0.2 ) { dif1=0.5*dif1+0.5; sha=0.95*sha+0.05;  }
		if( abs(m-2.0)<0.2 ) { sha=clamp(0.2+sha*dif1*2.0,0.0,1.0); dif1=0.4+0.6*dif1; ssha=0.0; }
		
		dif1 = clamp(dif1,0.0,1.0);

        float sks = (abs(m-1.0)<0.2)?0.5:0.0;
		vec3 sha3 = vec3((1.0-sks)*sha+sks*sqrt(sha),sha*0.4+0.6*sha*sha,sha*sha);
		
		col += mateD*3.1*vec3(2.5,1.1,0.5)*dif1*sha3;
		col += mateK.x*vec3(1.5,1.4,1.3)*dif1*sha*spe*(0.04+0.96*pow(clamp(dot(hal,nor),0.0,1.0),5.0))*ssha;
    }
	{
		// fill
		col += mateD*vec3(0.45,0.75,1.0)*occ*occ*occ*(0.5+0.5*nor.y)*4.5;
		float dif1 = 0.5 + 0.5*nor.y;
		float sha = 1.0;
		float spe = smoothstep( -0.15, 0.15, reflect(rd,nor).y );
		col += mateK.x*vec3(0.7,0.9,1.0)*dif1*sha*spe*(0.04+0.96*pow(clamp(dot(rd,nor),0.0,1.0),5.0))*occ*occ*3.0;
	}
	{
		// bounce
		vec3 bak = normalize( sunDir*vec3(-1.0,-3.5,-1.0));
		float dif = clamp(0.3+0.7*dot(nor,bak),0.0,1.0);
		col += mateD*vec3(1.2,0.8,0.6)*occ*occ*dif*2.5;
	}
	{
		col += mateS*mateD*fre    *vec3(2.0,0.95,0.80)*0.7*occ;
		col += mateS*mateD*fre*fre*vec3(1.1,0.80,0.65)*1.2*occ;
	}

	col = pow( col, mateSG );

    return col;
}

//--------------------------------------------

vec3 intersect( in vec3 ro, in vec3 rd, float mindist, float maxdist )
{
	vec3 res = vec3(-1.0);
	
	float t = mindist;
	for( int i=ZERO; i<150; i++ )
	{
		vec3 p = ro + t*rd;
		vec3 h = map( p );
		res = vec3(t,h.yz);
		if( abs(h.x)<0.00025 || t>maxdist ) break;
		t += h.x;
	}
	return res;
}

///////////////////////////////////////////////

vec3 render( in vec3 ro, in vec3 rd, in vec2 uv, in int sampleID )
{
	vec4 res = texture(iChannel2,uv);
	vec3 col = res.xyz;
	
	const float mindist = 0.8;
	const float maxdist = 1.8;
	
	vec3 tm = intersect( ro, rd, mindist, maxdist );
	if( tm.y>-0.5 && tm.x < maxdist )
	{
		col = shade( ro, rd, tm.x, tm.y, tm.z );
	}

	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	mat3 ca; vec3 ro; float fl;
	computeCamera( iTime, ca, ro, fl );
#if AA<2
	vec2  p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec3  rd = normalize( ca*vec3(p,-fl) );
	vec3 col = render( ro, rd, fragCoord.xy/iResolution.xy, 0 );
#else
	vec3 col = vec3(0.0);
	for( int m=ZERO; m<AA; m++ )
	for( int n=ZERO; n<AA; n++ )
	{
		vec2 rr = vec2( float(m), float(n) ) / float(AA) - 0.5;
		vec2 p = (2.0*(fragCoord.xy+rr)-iResolution.xy)/iResolution.y;
		vec3 rd = normalize( ca * vec3(p,-fl) );
		col += render( ro, rd, (fragCoord+rr)/iResolution.xy, AA*m+n );
	}    
	col /= float(AA*AA);
#endif
		
	fragColor = vec4( col, 1.0 );
}
`;

const fragment = `
// Created by inigo quilez - iq/2018
// I share this piece (art and code) here in Shadertoy and through its Public API, only for educational purposes. 
// You cannot use, sell, share or host this piece or modifications of it as part of your own commercial or non-commercial product, website or project.
// You can share a link to it or an unmodified screenshot of it provided you attribute "by Inigo Quilez, @iquilezles and iquilezles.org". 
// If you are a teacher, lecturer, educator or similar and these conditions are too restrictive for your needs, please contact me and we'll work it out.


// A surfer boy in the beach, disney/pixar style. I had to be very careful
// with the complexity, otherwise the browser would crash during shader
// compilation. I also had to split the boy in two layers because of that,
// see below (the single pass version is smaller of course but takes 3 extra
// seconds to compile, and renders a bit more slowly)
//
// This is totally painted to camera, it won't work from others perspectives.
//
// Common   - contains some basic stuff
// Buffer A - renders the brackground - not super polished really
// Buffer B - blurs the background
// Buffer C - paints the boy, except the hand and the board
// Image    - paints the hand and the board, and does some minimal postpro
//
// If you have a slow PC, you can watch it here: https://www.youtube.com/watch?v=ya3FRzuozQ0


// hands and board
vec3 map( vec3 p )
{
    // hands
    float d = 1.0;
	if( p.x<-0.8 && p.y<-0.1)
	{
		vec3 hp = p - vec3(-0.9,-0.30,0.12);

		hp.z *= 1.2;
		
		float ss = sign(hp.y+0.05);

		vec4 a1 = vec4(-0.030+0.010*ss, -0.050 +0.050 *ss, 0.06, 0.0225);
		vec4 b1 = vec4(-0.070+0.010*ss, -0.049 +0.051 *ss, 0.05, 0.024);
		vec4 c1 = vec4(-0.145+0.015*ss, -0.0465+0.0535*ss, 0.01, 0.027);
		vec4 d1 = vec4(-0.12,           -0.0465+0.0535*ss,-0.06, 0.030);
		vec3 u1 = vec3(-0.0290+0.011*ss,-0.05  +0.05  *ss, 0.08);
		vec3 v1 = vec3(-0.0185,         -0.05  +0.05  *ss, 0.08);

		float dd =     sdCapsule( hp, a1, b1 ).x;
		dd = smin( dd, sdCapsule( hp, b1, c1 ).x, 0.005 );
		dd = smin( dd, sdCapsule( hp, c1, d1 ).x, 0.005 );
		dd = smax( dd,-sdCapsule( hp, u1, v1, 0.021 ),0.005);
		d = min( d, dd/1.2 );
		
		ss = sign(hp.y+0.1);
		
		if( hp.y>-0.1 )
		{
			const vec4 a2 = vec4(-0.02,-0.050, 0.06, 0.024);
			const vec4 b2 = vec4(-0.06,-0.050, 0.05, 0.0256);
			const vec4 c2 = vec4(-0.15,-0.050, 0.01, 0.0288);
			const vec4 d2 = vec4(-0.13,-0.050,-0.06, 0.032);
			const vec3 u2 = vec3(-0.018,-0.05,0.08);
			const vec3 v2 = vec3(-0.017,-0.05,0.08);

			dd =           sdCapsule( hp, a2, b2 ).x;
			dd = smin( dd, sdCapsule( hp, b2, c2 ).x, 0.005 );
			dd = smin( dd, sdCapsule( hp, c2, d2 ).x, 0.005 );
			dd = smax( dd,-sdCapsule( hp, u2, v2, 0.021 ),0.005);
		}
		else
		{
			const vec4 a2 = vec4(-0.07,-0.145, 0.06, 0.021);
			const vec4 b2 = vec4(-0.10,-0.145, 0.05, 0.0224);
			const vec4 c2 = vec4(-0.16,-0.145, 0.01, 0.0252);
			const vec4 d2 = vec4(-0.15,-0.145,-0.06, 0.028);
			const vec3 u2 = vec3(-0.07,-0.145,0.08);
			const vec3 v2 = vec3(-0.05,-0.145,0.08);

			dd =           sdCapsule( hp, a2, b2 ).x;
			dd = smin( dd, sdCapsule( hp, b2, c2 ).x, 0.005 );
			dd = smin( dd, sdCapsule( hp, c2, d2 ).x, 0.005 );
			dd = smax( dd,-sdCapsule( hp, u2, v2, 0.019 ),0.005);
		}
        d = min( d, dd/1.2 );
	}
    
	vec3 res = vec3(d,1.0,1.0);

    // nails
	{
		vec3 np = mat3(0.990,0.0,0.141,
					   0.000,1.0,0.000,
					   -0.141,0.0,0.990)*
					   (p-vec3(-0.9,-0.30,0.12));
		d =       sdEllipsoid(np, vec3(-0.025, 0.000,0.056), vec3(0.022,0.018,0.006) );
		d = min(d,sdEllipsoid(np, vec3(-0.025,-0.050,0.056), vec3(0.023,0.019,0.006) ));
		d = min(d,sdEllipsoid(np, vec3(-0.046,-0.100,0.053), vec3(0.022,0.018,0.006) ));
		d = min(d,sdEllipsoid(np, vec3(-0.073,-0.145,0.048), vec3(0.021,0.017,0.006) ));
		if( d<res.x ) res = vec3(d,9.0,1.0);
	}

	
    // board
	//if( p.x<-0.2 )
	{
	vec3 bp = p - vec3(-0.695,-1.5,0.1 );
    bp.x = 0.15 + sqrt( bp.x*bp.x+0.0002 );
	d = sdEllipsoid( bp, vec3(0.0),vec3(0.65,1.8,0.1) );
	if( d<res.x ) res = vec3(d,6.0,1.0);
	}
	
	return res;
}

// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormalmap( in vec3 pos, in float ep )
{
#if 0    
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize(e.xyy*map(pos+e.xyy*ep).x + 
					 e.yyx*map(pos+e.yyx*ep).x + 
					 e.yxy*map(pos+e.yxy*ep).x + 
					 e.xxx*map(pos+e.xxx*ep).x );
#else
    // inspired by tdhooper and klems - a way to prevent the compiler from inlining map() 4 times
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(pos+e*ep).x;
    }
    return normalize(n);
#endif    
    
}


//=========================================================================

float calcAO( in vec3 pos, in vec3 nor, in int sampleID )
{
	float ao = 0.0;

	vec3 v = normalize(vec3(0.7,0.5,0.2));
	for( int i=ZERO; i<12; i++ )
	{
		float h = abs(sin(float(i+12*sampleID)));
		
		vec3 kv = v + 2.0*nor*max(0.0,-dot(nor,v));
		ao += clamp( map(pos+nor*0.01+kv*h*0.08).x*3.0, 0.0, 1.0 );
        
		v = v.yzx; if( (i&2)==2) v.yz *= -1.0;
	}
	ao /= 12.0;
	ao = ao + 2.0*ao*ao;
	return clamp( ao*5.0, 0.0, 1.0 );
}

// http://iquilezles.org/www/articles/rmshadows/rmshadows.htm
float calcSoftShadow( in vec3 ro, in vec3 rd, float k )
{
	float res = 1.0;
	float t = 0.001;
	for( int i=ZERO; i<50; i++ )
	{
		float h = map(ro + rd*t ).x;

		res = min( res, smoothstep(0.0,1.0,1.8*k*(h+0.001)/sqrt(t)) );
		
		t += clamp( h, 0.003, 0.1 );
		if( res<0.001 || t>0.8) break;
	}
	return clamp(res,0.0,1.0);
}

vec3 shade( in vec3 ro, in vec3 rd, in float t, in float m, in float matInfo, in int sampleID )
{
	vec3 pos = ro + t*rd;
	vec3 nor = calcNormalmap( pos, 0.0002 );
	

	vec3 mateD = vec3(0.0);
	vec2 mateK = vec2(0.0);
	float mateS = 0.0;
	vec3 mateSG = vec3(1.0);

	if( m<1.5 )
	{
		mateD = vec3(0.132,0.06,0.06);
		
		vec3 p = pos;
		float no = texture(iChannel0,p.xy).x;
		mateSG = vec3(0.75,0.97,1.0);
		mateK = vec2(0.08,0.5);
		mateS = 1.0;    
		mateK *= 0.5 + no;
	}
	else if( m<6.5 )
	{
        mateD = vec3(0.22,0.24,0.26);
		
		vec3 bp = pos - vec3(-0.695,-1.6,0.1 );

		mateD = mix( mateD, vec3(0.15,0.08,0.05), 1.0-smoothstep(0.003,0.01,abs(bp.x)) );
		
		float h = bp.y - 0.15*sin( 6.0*bp.x );
		h = min( abs(h-1.15)-0.04, abs(h-1.05)-0.01 );
		
		mateD = mix( mateD, vec3(0.004), 1.0-smoothstep( 0.01, 0.02, h ) );
		
		mateD *= 0.9 + 0.1*texture(iChannel0, 1.0*pos.xy ).x;
		mateS = 3.0;
		mateK = vec2(1.0,16.0);
		
		vec2 uv = pos.xy*0.1;
		float te = 0.0;
		float s = 0.5;
		for( int i=0; i<9; i++ )
		{
			te += s*texture(iChannel0,uv).x;
			uv *= 2.11;
			s *= 0.6;
		}
		mateD = mix( mateD, vec3(0.16,0.08,0.0)*0.27, 			0.15*smoothstep(0.6,0.9,te) );
		mateK.x *= 1.0-te;
		
		
	}
	else if( m<9.5 )
	{
		mateD = vec3(0.134,0.07,0.07);
		
		vec3 hp = pos - vec3(-0.945,-0.30,0.12);
		
		float r = length(hp.xy);
		r = min( r, length(hp.xy-vec2(0.0,-0.05)) );
		r = min( r, length(hp.xy-vec2(-0.02,-0.095)) );
		r = min( r, length(hp.xy-vec2(-0.048,-0.14)) );
		
		mateD += 0.023*(1.0 - smoothstep( 0.014,0.018,r));
		
		mateK = vec2(0.2,2.0);
		mateS = 1.0;
		
	}
	
	float fre = clamp(1.0+dot(nor,rd), 0.0, 1.0 );
	float occ = calcAO( pos, nor, sampleID );
	
	vec3 col = vec3(0.0);
	
    {
		// key
		float dif1 = dot(nor,sunDir);
		vec3 hal = normalize( sunDir-rd );
		float spe = pow(clamp(dot(hal,nor),0.0,1.0),0.001+8.0*mateK.y);

		float sha = calcSoftShadow( pos+nor*0.0005, sunDir, 24.0 ); 
        
        sha *= 0.15+0.85*smoothstep(0.1,0.3,length((pos-vec3(-0.45,0.16,0.1))*vec3(1.4,0.4,1.0)));
        
		float ssha = 1.0;
		if( abs(m-3.0)<0.2 ) { dif1=0.5*dif1+0.5; sha=0.95*sha+0.05; }
		if( abs(m-2.0)<0.2 ) { sha=clamp(0.2+sha*dif1*2.0,0.0,1.0); dif1=0.4+0.6*dif1; ssha=0.0; }
		
		dif1 = clamp(dif1,0.0,1.0);

		vec3 sha3 = vec3(sha,sha*0.4+0.6*sha*sha,sha*sha);
		
		col += mateD*3.1*vec3(2.5,1.1,0.5)*dif1*sha3;
		col += mateK.x*vec3(1.5,1.4,1.3)*dif1*sha*spe*(0.04+0.96*pow(clamp(dot(hal,nor),0.0,1.0),5.0))*ssha;
    }
	{
		// fill
		
		col += mateD*vec3(0.45,0.75,1.0)*occ*occ*occ*(0.5+0.5*nor.y)*4.5;

		float dif1 = 0.5 + 0.5*nor.y;
		float sha = 1.0;
		float spe = smoothstep( -0.15, 0.15, reflect(rd,nor).y );
		col += mateK.x*vec3(0.7,0.9,1.0)*dif1*sha*spe*(0.04+0.96*pow(clamp(dot(rd,nor),0.0,1.0),5.0))*occ*occ*3.0;
	}
	{
		// bounce
		vec3 bak = normalize( sunDir*vec3(-1.0,-3.5,-1.0));
		float dif = clamp(0.3+0.7*dot(nor,bak),0.0,1.0);
		col += mateD*vec3(1.2,0.8,0.6)*occ*occ*dif*2.5;
	}
	{
		col += mateS*mateD*fre    *vec3(2.0,0.95,0.80)*0.7*occ;
		col += mateS*mateD*fre*fre*vec3(1.1,0.80,0.65)*1.2*occ;
	}

	col = pow( col, mateSG );

    return col;        
}

//--------------------------------------------

vec3 intersect( in vec3 ro, in vec3 rd, float mindist, float maxdist )
{
	vec3 res = vec3(-1.0);
	
	float t = mindist;
	for( int i=ZERO; i<150; i++ )
	{
		vec3 p = ro + t*rd;
		vec3 h = map( p );
		res = vec3(t,h.yz);
		if( abs(h.x)<0.00025 || t>maxdist ) break;
		t += h.x;
	}
	return res;
}

///////////////////////////////////////////////

vec3 render( in vec3 ro, in vec3 rd, in vec2 uv, in int sampleID )
{
	vec4 res = texture(iChannel3,uv);
	vec3 col = res.xyz;
	
	const float mindist = 0.8;
	const float maxdist = 1.8;
	
	vec3 tm = intersect( ro, rd, mindist, maxdist );
	if( tm.y>-0.5 && tm.x < maxdist )
	{
		col = shade( ro, rd, tm.x, tm.y, tm.z, sampleID );
	}

	float sun = clamp(0.5+0.5*dot( rd, sunDir ),0.0,1.0);
	col += 20.0*vec3(1.2,0.7,0.4)*pow(sun,8.0);

	col = pow( col, vec3(0.4545) );

	//col.z += 0.005;

	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	

	mat3 ca; vec3 ro; float fl;
	computeCamera( iTime, ca, ro, fl );

#if AA<2
	vec2  p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec3  rd = normalize( ca*vec3(p,-fl) );
	vec3 col = render( ro, rd, fragCoord.xy/iResolution.xy, 0 );
#else
	vec3 col = vec3(0.0);
	for( int m=ZERO; m<AA; m++ )
	for( int n=ZERO; n<AA; n++ )
	{
		vec2 rr = vec2( float(m), float(n) ) / float(AA) - 0.5;
		vec2 p = (2.0*(fragCoord.xy+rr)-iResolution.xy)/iResolution.y;
		vec3 rd = normalize( ca * vec3(p,-fl) );
		col += render( ro, rd, (fragCoord+rr)/iResolution.xy, AA*m+n );
	}    
	col /= float(AA*AA);
#endif
		
	vec2 q = fragCoord.xy/iResolution.xy;
	col *= 0.3 + 0.7*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.1);

	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'ldd3DX';
  }
  name(): string {
    return 'Surfer Boy';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  common() {
    return common;
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
    return [
      {
        ...webglUtils.DEFAULT_NOISE,
        ...webglUtils.TEXTURE_MIPMAPS,
        ...webglUtils.NO_FLIP_Y,
      }, //
      { type: 1, f: buffA, fi: 1 },
      { type: 1, f: buffB, fi: 2 },
      { type: 1, f: buffC, fi: 3 },
    ];
  }
}
