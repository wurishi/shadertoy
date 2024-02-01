import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float ndot(vec2 a, vec2 b ) { return a.x*b.x - a.y*b.y; }

float sdRhombus( in vec2 p, in vec2 b, in float r ) 
{
    vec2 q = abs(p);
    float h = clamp( (-2.0*ndot(q,b) + ndot(b,b) )/dot(b,b), -1.0, 1.0 );
    float d = length( q - 0.5*b*vec2(1.0-h,1.0+h) );
    d *= sign( q.x*b.y + q.y*b.x - b.x*b.y );
	return d - r;
}

float usdBox( in vec3 p, in vec3 b )
{
    return length( max(abs(p)-b,0.0 ) );
}

float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float sdBox( float p, float b )
{
  return abs(p) - b;
}

vec2 opRepLim( in vec2 p, in float s, in vec2 lim )
{
    return p-s*clamp(round(p/s),-lim,lim);
}

vec2 opRepLim( in vec2 p, in float s, in vec2 limmin, in vec2 limmax )
{
    return p-s*clamp(round(p/s),-limmin,limmax);
}


//#define STATICCAM

//#define AA
#define STEP 14
#define CAMERA_OSC_SPEED 0.1
#define CAMERA_OSC_RANGE 0.85

#define PILLAR_HEIGHT 6.0
#define PILLAR_RAD_BASE 0.75
#define PILLAR_RAD_DEC 0.05
#define NB_RIPPLES 24.0
#define PILLAR_BLOCK_OFFSET 0.3
#define PILLAR_BLOCK_TILING 3.0
#define PILLAR_DIST 4.0
#define PILLAR_OFFSET_X 2.0
#define PILLAR_BASE_ROUNDING 0.1
// copy matrix is 1 original pillar + 4*X + 4*-X
// same principle for z 
#define PILLAR_REPETITIONS_XZ vec2(4.0,2.0)
#define PILLAR_CLIPPING_BOX vec3(14.0,6.0,6.0)
#define FLOOR_TILES vec3(2.0,0.4,2.0)
#define FLOOR_TILES2 vec3(2.0,1.3,2.0)
#define TILES_GAP_XYZ vec3(0.05,0.0,0.05)
#define TILES_OFFSET_Y 5.7
#define TILES_OFFSET_Y2 6.4
#define TILES_OFFSET_Y3 8.1
#define TILES_ROUNDING 0.1
#define SPIKES 2.0
#define ROTTEN 0.65

// lights
// all keylight shadows will be filled by ambient light
//keylight 5-10 times stronger than ambient light

// keylights are NEVER modelled by occlusion!

#define LIGHT_POWER 1.2

#define SUN vec3(0.8,0.2,0.4)
#define SUN_POWER 1.0
#define KEYLIGHT_COLOR vec3(0.90,0.55,0.35)
#define KEYLIGHT_POWER 4.0
#define AMBIENT_COLOR vec3(0.25,0.25,0.35)
#define AMBIENT_POWER 0.65
// backlight is bounced keylight
#define BACKLIGHT_COLOR vec3(0.10,0.09,0.11)
#define BACKLIGHT_POWER 1.6
#define BOUNCELIGHT_POWER 0.6
#define BOUNCELIGHT_COLOR vec3(1.0,0.4,0.005)
#define OVEREXPOSE 6.0
#define OVEREXPOSE_COLOR vec3(1.0,0.7,0.4)
#define OVEREXPOSE_POWER 0.25

// horizon
#define SKYBASE_COLOR vec3(0.2,0.3,0.4)
#define SKYBASE_POWER 0.25

// #define SKYBLUE_COLOR vec3(0.2,0.25,0.30)
// horizon line
#define SKYBLUE_COLOR vec3(0.3,0.35,0.50)
#define SKYBLUE_POWER 0.75

#define CLOUDS vec2(0.35,0.9)
//#define SKYRED_COLOR vec3(0.3,0.2,0.1)
#define CLOUDSRED_COLOR vec3(0.7,0.5,0.3)
#define SKYGRAY_COLOR vec3(0.2,0.25,0.30)
#define SKYGRAY_POWER 0.4

#define SKYRED_COLOR vec3(1.5,0.30,0.05)
#define SKYRED_POWER 0.8

// vec3(0.1,0.125,0.15)

// landscape distance fog
#define FOG_COLOR vec3(0.22,0.25,0.30)
#define FOG_POWER 0.42
#define FOG_EXPONENT 0.0016

#define FAKE_OCCLUSION_FACTOR 0.9

#define FLOOR_DARKENING_FACTOR 0.5

#define SHADOW_Y_DEPTH 0.6

#define WETLINE_DARKEN 0.35

#define OCEAN_BASE_COLOR vec3(0.05,0.11,0.15)
#define OCEAN_BASE_POWER 0.35
#define OCEAN_COAST_COLOR vec3(0.01,0.03,0.03)
#define OCEAN_COAST_POWER 2.5

float hash1( vec2 p )
{
    p  = 50.0*fract( p*0.3183099 );
    return fract( p.x*p.y*(p.x+p.y) );
}

float hash( uint n ) 
{
	n = (n << 13U) ^ n;
    n = n * (n * n * 15731U + 789221U) + 1376312589U;
    return uintBitsToFloat( (n>>9U) | 0x3f800000U ) - 1.0;
}

vec2 hash2( float n ) { return fract(sin(vec2(n,n+1.0))*vec2(43758.5453123,22578.1459123)); }

float noise( in vec2 x )
{
    ivec2 p = ivec2(floor(x));
    vec2 f = fract(x);
	f = f*f*(3.0-2.0*f);
	ivec2 uv = p.xy;
	float rgA = texelFetch( iChannel1, (uv+ivec2(0,0))&255, 0 ).x;
    float rgB = texelFetch( iChannel1, (uv+ivec2(1,0))&255, 0 ).x;
    float rgC = texelFetch( iChannel1, (uv+ivec2(0,1))&255, 0 ).x;
    float rgD = texelFetch( iChannel1, (uv+ivec2(1,1))&255, 0 ).x;
    return mix( mix( rgA, rgB, f.x ),
                mix( rgC, rgD, f.x ), f.y );
}

float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( iChannel1, (uv+0.5)/256.0, 0.0).yx;
	return mix( rg.x, rg.y, f.z );
}

float fbm4( in vec3 p )
{
    float n = 0.0;
    n += 1.000*noise( p*1.0 );
    n += 0.500*noise( p*2.0 );
    n += 0.250*noise( p*4.0 );
    n += 0.125*noise( p*8.0 );
    return n;
}

float fbm6( in vec3 p )
{
    float n = 0.0;
    n += 1.00000*noise( p*1.0 );
    n += 0.50000*noise( p*2.0 );
    n += 0.25000*noise( p*4.0 );
    n += 0.12500*noise( p*8.0 );
    n += 0.06250*noise( p*16.0 );
    n += 0.03125*noise( p*32.0 );
    return n;
}

float fbm6( in vec2 p )
{
    float n = 0.0;
    n += 1.00000*noise( p*1.0 );
    n += 0.50000*noise( p*2.0 );
    n += 0.25000*noise( p*4.0 );
    n += 0.12500*noise( p*8.0 );
    n += 0.06250*noise( p*16.0 );
    n += 0.03125*noise( p*32.0 );
    return n;
}

float fbm4( in vec2 p )
{
    float n = 0.0;
    n += 1.00000*noise( p*1.0 );
    n += 0.50000*noise( p*2.0 );
    n += 0.25000*noise( p*4.0 );
    n += 0.12500*noise( p*8.0 );
    return n;
}


vec4 textureGood( sampler2D sam, in vec2 uv )
{
    uv = uv*1024.0 - 0.5;
    vec2 iuv = floor(uv);
    vec2 f = fract(uv);
    f = f*f*(3.0-2.0*f);
	vec4 rg1 = textureLod( sam, (iuv+ vec2(0.5,0.5))/1024.0, 0.0 );
	vec4 rg2 = textureLod( sam, (iuv+ vec2(1.5,0.5))/1024.0, 0.0 );
	vec4 rg3 = textureLod( sam, (iuv+ vec2(0.5,1.5))/1024.0, 0.0 );
	vec4 rg4 = textureLod( sam, (iuv+ vec2(1.5,1.5))/1024.0, 0.0 );
	return mix( mix(rg1,rg2,f.x), mix(rg3,rg4,f.x), f.y );
}

#define ZERO (min(iFrame,0))

//------------
const float ocean = -25.0;

float terrain( in vec2 p )
{
    #if (STEP >= 1)
    float h = 90.0*textureGood( iChannel2, p.yx*0.0001 + 0.35 + vec2(0.02,0.05) ).x - 70.0 + 5.0;
    #else
    float h = 90.0*texture( iChannel2, p.yx*0.0001 + 0.35 + vec2(0.02,0.05) ).x - 70.0 + 5.0;
    #endif
    #if  (STEP >= 2)
    h = mix( h, -7.2, 1.0-smoothstep(16.0,60.0,length(p)));
        #if (STEP >= 3)
        h -= 7.0*textureGood( iChannel2, p*0.002 ).x;
            #if (STEP >= 4)
            float d = textureLod( iChannel0, p*0.02, 0.0 ).x;
            #if (STEP >= 5)
            h -= 1.0*d*d*d*d;
            #else
            h -= 1.0*d;
            #endif
            #endif
        #endif
    #endif
    return h;
}

vec3 temple( in vec3 p )
{
    vec3 op = p;    
    vec3 res = vec3(-1.0,-1.0,0.5);

    p.y += 2.0;

    // bounding box
    float bbox = usdBox(p,vec3(15.0,12.0,15.0)*1.5 );
    if( bbox>5.0 ) return vec3(bbox+1.0,-1.0,0.5);
    
    vec3 q = p;
    
    q.xz = opRepLim(q.xz,PILLAR_DIST,PILLAR_REPETITIONS_XZ);
    
    // pillars
    vec2 id = floor((p.xz+2.0)/4.0);
    float rad = PILLAR_RAD_BASE;
    float d = length(q) - rad;

    d = length(q.xz) - rad;
    float dyn_rad = rad; // base size
    dyn_rad -= PILLAR_RAD_DEC*q.y; // shape thinner on top
    // atan wraps around unit circle
    dyn_rad += 0.075*pow(0.5 + 0.5*sin(NB_RIPPLES*atan(q.x,q.z)),SPIKES);
    dyn_rad += 0.2*pow(0.5 + 0.5*sin((q.y+PILLAR_BLOCK_OFFSET)*PILLAR_BLOCK_TILING),0.05)-0.15;
    res.z = hash1( id + 11.0*floor(0.25 + (q.y*3.0+0.6)/6.2831) );
    d = length(q.xz) - dyn_rad;
    float d2 = p.y-PILLAR_HEIGHT;
    d = max(d,d2);
    // -p.y because of plane normal flip
    d = max(d,-p.y-5.0);
    d*=0.7;
    float d3 = 0.0;
    vec3 qq = vec3(q.x,q.y,q.z);;
    float off_y_mirror_plane = 0.3;
    qq = vec3(q.x,abs(q.y-off_y_mirror_plane)-5.5,q.z);
    d3 = sdBox(qq,vec3(1.4,0.2,1.4)-PILLAR_BASE_ROUNDING)-PILLAR_BASE_ROUNDING;
    d = min(d,d3);
    
    d = max(d,-sdBox(p, PILLAR_CLIPPING_BOX));
    
    float ra = 0.0;
    ra = 0.25 * hash1(id+vec2(1.0,3.0));
    
    // floor
    {
    q = p;
    q.y += TILES_OFFSET_Y;
    // repetition function
    q.xz = opRepLim(p.xz,PILLAR_DIST,PILLAR_REPETITIONS_XZ);
    //rounded TILES
    vec3 floor_distribution = vec3(FLOOR_TILES.x,FLOOR_TILES.y-ra,FLOOR_TILES.z);
    d = min(d,sdBox(q, floor_distribution-TILES_GAP_XYZ-TILES_ROUNDING)-TILES_ROUNDING);
    }
    {
    q = p;
    q.z -= PILLAR_DIST/2.0;
    q.x += PILLAR_DIST/2.0;
    q.y += TILES_OFFSET_Y2;
    id = floor((q.xz+2.0)/4.0);
    ra = 0.3 * hash1(id+vec2(2.0,3.0)+23.1);
    q.xz = opRepLim(q.xz,PILLAR_DIST,vec2(4.0,3.0),vec2(5.0,2.0));
    vec3 floor_distribution = vec3(FLOOR_TILES.x,FLOOR_TILES.y-ra,FLOOR_TILES.z);
    d = min(d,sdBox(q, floor_distribution-TILES_GAP_XYZ-TILES_ROUNDING)-TILES_ROUNDING);
    }
    {
    q = p;
    q.y += TILES_OFFSET_Y3;
    q.xz = opRepLim(q.xz,PILLAR_DIST,vec2(5.0,3.0),vec2(5.0,3.0));
    id = floor((q.xz+2.0)/4.0);
    ra = 0.3 * hash1(id+vec2(1.0,3.0)+37.7);
    vec3 floor_distribution = vec3(FLOOR_TILES2.x,FLOOR_TILES2.y-ra,FLOOR_TILES2.z);
    d = min(d,sdBox(q, floor_distribution-TILES_GAP_XYZ-TILES_ROUNDING)-TILES_ROUNDING);
    d*=ROTTEN;
    } 
    
    // roof
    float b = 0.0;
    b = sdRhombus( p.yz-vec2(8.2,0.0), vec2(3.0,11.0), 0.05 ) ;
    //q = vec3( mod(p.x+1.0,2.0)-1.0, p.y, mod(p.z+1.0,2.0)-1.0 );
    b = max( b, -sdBox( vec3( abs(p.x)-20.0,p.y,q.z)-vec3(0.0,8.0,0.0), vec3(2.0,5.0,0.1) )-0.02 );
    b = max( b, -p.y+8.2 );
    b = max( b, usdBox(p-vec3(0.0,8.0,0.0),vec3(19.0,12.0,11.0)) );
    float c = sdRhombus( p.yz-vec2(8.3,0.0), vec2(2.25,8.5), 0.05 );
    c = max( c, sdBox(abs(p.x)-19.0,2.0) );
    b = max( b, -c );
    d = min( d, b );
    q = vec3( mod(p.x+0.5,1.0)-0.5, p.y, mod(p.z+0.5,1.0)-0.5 );
    b = sdBox( q-vec3(0.0,8.0,0.0), vec3(0.45,0.5,0.45)-0.02 )-0.02;
    b = max( b, sdBox(p-vec3(0.0,8.0,0.0),vec3(19.0,0.2,11.0)) );
    q = p+vec3(0.0,0.0,-0.5); q.xz = opRepLim( q.xz, 1.0, vec2(19.0,10.0) );
    b = sdBox( q-vec3(0.0,8.0,0.0), vec3(0.45,0.2,0.45)-0.02 )-0.02;
    if( b<d ) { d = b; res.z = hash1( floor((p.xz+0.5)/1.0) + 7.8 ); }
    q = vec3( mod(p.x+2.0,4.0)-2.0, p.y, mod(p.z+0.0,4.0)-2.0 );
    b = sdBox( q-vec3(0.0,7.0,0.0), vec3(1.95,1.0,1.95)-0.15 )-0.15;
    b = max( b, sdBox(p-vec3(0.0,7.0,0.0),vec3(18.0,1.0,10.0)-TILES_ROUNDING)-TILES_ROUNDING);
    if( b<d ) { d = b; res.z = hash1( floor((p.xz+vec2(2.0,0.0))/4.0) + 31.1 ); }
    d = min( d, b );
    d = max( d,-sdBox(p-vec3(0.0,9.5,0.0),vec3(15.0,4.0,9.0)) );
    d -= 0.04*smoothstep(0.5,1.0,fbm4( p.zxy ));
    d -= 0.03*smoothstep(0.4,0.8,fbm4( op*3.0 ));
    d += 0.005;

    res = vec3( d, 1.0, res.z );

    return res;
}

vec3 map( in vec3 p )
{
    vec3 res = temple(p); 
    // floor
    float m = p.y + 15.5;
    {
        float h = terrain( p.xz );
        float m = p.y - h;
        m *= 0.35;
        if( m<res.x ) res = vec3( m, 2.0, 0.0 );
    }
    {
        float w = p.y + 25.0;
        if( w<res.x ) res = vec3(w,3.0, 0.0 );
    }
    return res;
}

// http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal( in vec3 p, in float t )
{
#if 0    
    float e = 0.001*t;

    vec2 h = vec2(1.0,-1.0)*0.5773;
    return normalize( h.xyy*map( p + h.xyy*e ).x + 
					  h.yyx*map( p + h.yyx*e ).x + 
					  h.yxy*map( p + h.yxy*e ).x + 
					  h.xxx*map( p + h.xxx*e ).x );
#else    
    // inspired by tdhooper and klems - a way to prevent the compiler from inlining map() 4 times
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(p+e*0.001*t).x;
    }
    return normalize(n);
#endif    
}

vec3 intersect( in vec3 ro, in vec3 rd )
{
    vec2 ma = vec2(0.0);

    vec3 res = vec3(-1.0);
    
    float tmax = 1000.0;

    float tp = (ocean-ro.y)/rd.y;
    if( tp>0.0 )
    {
        tmax = tp;
        res = vec3( tp, 3.0, 0.0 );
    }
        
    float t = 10.0;
    for( int i=0; i<256; i++ )
    {
        vec3 pos = ro + t*rd;
        vec3 h = map( pos );
        if( h.x<(0.0001*t) || t>tmax ) break;
        t += h.x;

        ma = h.yz;
    }

    if( t<tmax )
    {
    	res = vec3(t, ma);
    }

    return res;
}

vec4 textureBox( in sampler2D tex, in vec3 pos, in vec3 nor )
{
    vec4 cx = texture( tex, pos.yz );
    vec4 cy = texture( tex, pos.xz );
    vec4 cz = texture( tex, pos.xy );
    vec3 m = nor*nor;
    return (cx*m.x + cy*m.y + cz*m.z)/(m.x+m.y+m.z);
}

float calcShadow( in vec3 ro, in vec3 rd, float k )
{
    float res = .60;
    //float res = 1.0;
    
    float t = 0.01;
    for( int i=0; i<130; i++ )
    {
        vec3 pos = ro + t*rd;
        float h = map( pos ).x;
        //res = min( res, k*max(h,0.0)/t );
        res = min( res, k*max(h*0.3,0.0)/t );
        if( res<0.0001 ) break;
        t += clamp(h,0.01,0.7);
    }

    return res;
}

float calcOcclusion( in vec3 pos, in vec3 nor, float ra )
{
    float occ = 0.0;
    for( int i=ZERO; i<32; i++ )
    {
        float h = 0.01 + 4.0*pow(float(i)/31.0,2.0);
        vec2 an = hash2( ra + float(i)*13.1 )*vec2( 3.14159, 6.2831 );
        vec3 dir = vec3( sin(an.x)*sin(an.y), sin(an.x)*cos(an.y), cos(an.x) );
        dir *= sign( dot(dir,nor) );
        occ += clamp( 5.0*map( pos + h*dir ).x/h, -1.0, 1.0);
    }
    return clamp( occ/32.0, 0.0, 1.0 );
}


vec3 sunLig = normalize(SUN);

vec3 skyColor( in vec3 ro, in vec3 rd )
{
    vec3 col = SKYBASE_COLOR*SKYBASE_POWER- 0.3*rd.y;

    float t = (1000.0-ro.y)/rd.y;
    if( t>0.0 )
    {
        vec2 uv = (ro+t*rd).xz;
        float cl = texture( iChannel0, .000003*uv.yx ).x;
        vec2 cl_smooth = CLOUDS;
        cl = smoothstep(cl_smooth.x,cl_smooth.y,cl);
        col = mix( col, CLOUDSRED_COLOR, 0.1*cl );
    }

    col = mix( col, SKYGRAY_COLOR*SKYGRAY_POWER, exp(-30.0*rd.y) ) ;
    float sd = pow( clamp( 0.25 + 0.75*dot(sunLig,rd), 0.0, 1.0 ), 4.0 );
    col = mix( col, SKYRED_COLOR*SKYRED_POWER, sd*exp(-abs((60.0-50.0*sd)*rd.y))*0.75 ) ;

    return col;
}

vec3 doBumpMap( in vec3 pos, in vec3 nor )
{
    float e = 0.002;
    float b = 0.015;
    
	float ref = fbm6( 4.0*pos );
    vec3 gra = -b*vec3( fbm6(4.0*vec3(pos.x+e, pos.y, pos.z))-ref,
                        fbm6(4.0*vec3(pos.x, pos.y+e, pos.z))-ref,
                        fbm6(4.0*vec3(pos.x, pos.y, pos.z+e))-ref )/e;
	
	vec3 tgrad = gra - nor * dot ( nor , gra );
    return normalize( nor - tgrad );
}

vec3 doBumpMapGrass( in vec2 pos, in vec3 nor, out float hei )
{
    float e = 0.002;
    float b = 0.03;
    
	float ref = fbm6( 4.0*pos );
    hei = ref;
    
    vec3 gra = -b*vec3( fbm6(4.0*vec2(pos.x+e, pos.y))-ref,
                        e,
                        fbm6(4.0*vec2(pos.x, pos.y+e))-ref )/e;
	
	vec3 tgrad = gra - nor*dot( nor, gra );
    return normalize( nor - tgrad );
}

mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{

    float isThumbnail = step(iResolution.x,499.0);
    vec2 o = (1.0-isThumbnail)*(hash2( float(iFrame) ) - 0.5);
    
	vec2 p = (2.0*fragCoord-iResolution.xy) / iResolution.y;
    
    uvec2 px = uvec2(fragCoord);
    float ran = hash( px.x + 1920U*px.y + (1920U*1080U)*uint(iFrame*0) );    
    
    #ifdef STATICCAM
    float an = -0.96;
    #else
    // oscillating camera
    float offset = 0.0;
    offset = 3.141592/8.0;
    float an = sin(iTime*CAMERA_OSC_SPEED)*CAMERA_OSC_RANGE;
    an = -0.96 + sin(iTime*CAMERA_OSC_SPEED)*CAMERA_OSC_RANGE+0.75-offset;
    // camera distance
    float ra = 25.0;
    ra = 50.0;
    #endif
    float fl = 3.0;
    vec3 ta = vec3(0.0,-2.0,0.0);
    ra = 75.0;
    ta = vec3(0.0,-3.0,-23.0);
    vec3 ro = ta + vec3(ra*sin(an),6.0,ra*cos(an));
    ro = ta + vec3(ra*sin(an),10.0,ra*cos(an));
    mat3 ca = setCamera( ro, ta, 0.0 );
    vec3 rd = ca * normalize( vec3(p.xy,fl));
    
    vec3 col = vec3(0.0);
    
    col = skyColor( ro, rd );
    float resT = 10000.0;
    vec3 res = intersect( ro, rd );
    if( res.y>0.0 )
    {

        float t = res.x;
        resT = t;
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal( pos, t );
        
        float fre = pow( clamp( 1.0+dot(nor,rd), 0.0, 1.0), 5.0 );
		float foc = 1.0;
        
        vec3 mate = vec3(0.2);
        vec2 mspe = vec2(0.0);
        float mbou = 0.0;
        float mter = 0.0;
        if( res.y<1.5 )
        {
            vec3 te = textureBox( iChannel0, pos*0.05, nor ).xyz;
            //mate = vec3(0.12,0.08,0.05) + 0.15*te;
            mate = vec3(0.14,0.10,0.07) + 0.1*te;
            mate *= 0.8 + 0.4*res.z;
            mate *= 1.15;            
            mspe = vec2(1.0,8.0);
            mbou = 1.0;
            
            nor = doBumpMap( pos, nor );
            
            foc = 0.7 + 0.3*smoothstep(0.4,0.7,fbm4( 3.0*pos ));

            float ho = 1.0;
            if( pos.y>-7.5 ) ho *= smoothstep( 0.0, 5.0, (pos.y+7.5)  );
            // horizontal occlusion in xz - something like negative lightsource -> darken areas inside
            // measure angle of surface normal and ray to center of temple
            ho = mix( 0.1+ho*0.3, 1.0, clamp( 0.6 + 0.4*dot( normalize(nor.xz*vec2(0.5,1.0)), normalize(pos.xz*vec2(0.5,1.0)) ) + 1.0*nor.y*nor.y, 0.0, 1.0 ) );
            foc *= ho;
            // ellipsoid 2 times x 4 times y for darkening floor
            foc *= 0.4 + FLOOR_DARKENING_FACTOR*smoothstep( 2.0, 15.0, length(pos*vec3(1.0/2.0,1.0/4.0,1.0)) );
            float rdis = clamp( -0.15*max(sdRhombus( pos.yz-vec2(8.3,0.0)+vec2(2.0,0.0), vec2(2.25,8.5), 0.05 ),-(pos.y-8.3+2.0)), 0.0, 1.0 );
            if( rdis>0.0001 ) foc = 0.1 + sqrt(rdis);
            // vertical gradients
            // "painting" shadows on pillars and beneath ceiling  
			if( pos.y<5.8 ) foc *= 0.6 + SHADOW_Y_DEPTH*smoothstep( 0.0, 1.5, -(pos.y-5.8) );
            if( pos.y<3.4 ) foc *= 0.6 + SHADOW_Y_DEPTH*smoothstep( 0.0, 5.5, -(pos.y-3.4)  );
            foc *= 0.8;
        }
        else if( res.y<2.5 )
        {
            float h;
            
            {
                #if (STEP != 6)
                    // iChannel0 texture only for brown color variation
                    mate = vec3(0.95,0.9,0.85) * 0.4*texture( iChannel0, pos.xz*0.015 ).xyz;
                    #if (STEP >= 8)
                        // wet "shoreline"
                        mate *= WETLINE_DARKEN + 0.75*smoothstep( -25.0, -24.0, pos.y );
                    #endif
                #else
                    mate = vec3(0.95,0.9,0.85) * 0.4;
                #endif
                mate *= 0.32;
                #if (STEP != 6) && (STEP != 7) && (STEP != 8)
                vec3 mor = doBumpMapGrass( pos.xz, nor, h );
                mspe = vec2(2.5,4.0);
                float is_grass = smoothstep( 0.9,0.95,mor.y);

                #if (STEP != 9)
                    mate = mix( mate, vec3(0.15,0.1,0.0)*0.8*0.7 + h*h*h*vec3(0.12,0.1,0.05)*0.15, is_grass );
                    // remove specular lightning
                    mspe = mix( mspe, vec2(0.5,4.0), is_grass );
                #endif
                nor = mor;
                #endif
                mter = 1.0;
            }
        }
        else
        {
            // ocean
            mate = OCEAN_BASE_COLOR*OCEAN_BASE_POWER;
            #if (STEP!=11)
                mate += OCEAN_COAST_COLOR*OCEAN_COAST_POWER*(1.0-smoothstep(0.0,10.0,pos.y-terrain(pos.xz)));
                mate *= 0.4;
                #if (STEP>12)
                    float foam = (1.0-smoothstep(0.0,1.0,pos.y*1.01-terrain(pos.xz)));
                    foam *= smoothstep( 0.2,0.6,texture(iChannel0,pos.xz*0.017).x );
                    mate += vec3(0.05)*foam*0.85;
                    #if (STEP>13)
                        mspe = vec2(0.5,8.0);
                        vec2 e = vec2(0.01,0.0);
                        float ho = fbm4( (pos.xz     )*vec2(2.0,0.5) );
                        float hx = fbm4( (pos.xz+e.xy)*vec2(2.0,0.5) );
                        float hy = fbm4( (pos.xz+e.yx)*vec2(2.0,0.5) );
                        float sm = (1.0-smoothstep(0.0,4.0,pos.y-terrain(pos.xz)));
                        sm *= 0.02 + 0.03*foam;
                        ho *= sm;
                        hx *= sm;
                        hy *= sm;

                        nor = normalize( vec3(ho-hx,e.x,ho-hy) );
                    #endif
                #endif
            #endif
        }

        float occ = 0.33 + 0.5*nor.y;
        occ = calcOcclusion(pos,nor,ran) * foc * FAKE_OCCLUSION_FACTOR;
        
        vec3 lig = vec3(0);
        float sm = 1.0-smoothstep(30.0,80.0, length(pos.xz));
        lig = normalize(vec3(sunLig.x,sunLig.y+0.2*sm,sunLig.z))*SUN_POWER;
        vec3 ligbak = normalize(vec3(-lig.x,0.0,-lig.z));
        float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
        float sha = calcShadow( pos+nor*0.001, lig, 48.0 );
              dif *= sha;
        float amb = (0.8 + 0.2*nor.y);
              amb = mix( amb, amb*(0.5+0.5*smoothstep( -8.0,-1.0,pos.y)), mbou );

        float bou = 1.0;
        bou = smoothstep(3.0, 1.0, length((pos.xz-vec2(5,-5)))*0.15);
        bou *= clamp(0.5-0.5*nor.x,0.0,1.0);
        vec3 qos = pos/1.5 - vec3(0.0,1.0,0.0);

        float bak = clamp( 0.4+0.6*dot( nor, ligbak ), 0.0, 1.0 );
              bak *= 0.6 + 0.4*smoothstep( -8.0,-1.0,qos.y);
        
        vec3 hal = normalize( lig -rd );
        float spe = pow( clamp( dot(nor,hal), 0.0, 1.0), mspe.y )*(0.1+0.9*fre)*sha*(0.5+0.5*occ);

        col = vec3(0.0);

        col += amb*AMBIENT_POWER*AMBIENT_COLOR*occ*(1.0+mter);
        col += dif*KEYLIGHT_POWER*KEYLIGHT_COLOR;
        col += bak*BACKLIGHT_POWER*BACKLIGHT_COLOR*occ*mbou;
        col += spe*8.0*mspe.x*occ;
        // to lighten the inside of the temple add another bounce light
        col += bou*BOUNCELIGHT_POWER*BOUNCELIGHT_COLOR*occ;
        
        col *= mate;
        
        //vec3 fogcol = FOG_COLOR*FOG_POWER;
        // t = res.x
        //float fog = 1.0 - exp(-FOG_EXPONENT*t);
        //col *= 1.0-0.1*fog;
        //col = mix( col, fogcol, fog );
        vec3 fogcol = FOG_COLOR*FOG_POWER;
        float sd = pow( clamp( 0.25 + 0.75*dot(lig,rd), 0.0, 1.0 ), 4.0 );
	    fogcol = mix( fogcol, vec3(1.0,0.25,0.042), sd*exp(-abs((60.0-50.0*sd)*abs(rd.y))) ) ;

        float fog = 1.0 - exp(-FOG_EXPONENT*t);
        col *= 1.0-0.5*fog;
        col = mix( col, fogcol, fog*0.9 );
    }

    col = max( col, 0.0 );
    
    //col = LIGHT_POWER*col/(1.0+col*4.5);

    col += OVEREXPOSE_POWER*OVEREXPOSE_COLOR*pow(clamp(dot(sunLig, rd),0.0,1.0),OVEREXPOSE);
    col = 1.4*col/(1.0+col*4.5);
    col = sqrt( col );
    
    col = clamp( 1.6*col-0.1, 0.0, 1.0 );
    col = col*0.1 + 0.9*col*col*(3.0-2.0*col);
    col = pow( col, vec3(0.96,0.98,1.0) );  

    #ifdef STATICCAM
        vec3 ocol = texelFetch( iChannel3, ivec2(fragCoord-0.5), 0 ).xyz;
        if( iFrame==0 ) ocol = col;
        col = mix( ocol, col, 0.05 );
        fragColor = vec4( col, 1.0 );
    #else
        #ifdef AA
            mat4 oldCam = mat4( texelFetch(iChannel3,ivec2(0,0),0),
                                texelFetch(iChannel3,ivec2(1,0),0),
                                texelFetch(iChannel3,ivec2(2,0),0),
                                0.0, 0.0, 0.0, 1.0 );

            // world space
            vec4 wpos = vec4(ro + rd*resT,1.0);
            // camera space
            vec3 cpos = (wpos*oldCam).xyz; // note inverse multiply
            // ndc space
            vec2 npos = fl * cpos.xy / cpos.z;
            // screen space
            vec2 spos = 0.5 + 0.5*npos*vec2(iResolution.y/iResolution.x,1.0);
            // undo dither
            spos -= o/iResolution.xy;
            // raster space
            vec2 rpos = spos * iResolution.xy;

            if( (rpos.y<1.0 && rpos.x<3.0) || (isThumbnail>0.5)  )
            {
            }
            else
            {
                vec4 data = textureLod( iChannel3, spos, 0.0 );
                vec3 ocol = data.xyz;
                float dt = abs(data.w - resT)/resT;
                if( iFrame==0 ) ocol = col;
                col = mix( ocol, col, 0.1 + 0.5*smoothstep(0.1,0.2,dt) );
            }

            if( fragCoord.y<1.0 && fragCoord.x<3.0 )
            {
                if( abs(fragCoord.x-2.5)<0.5 ) fragColor = vec4( ca[2], -dot(ca[2],ro) );
                if( abs(fragCoord.x-1.5)<0.5 ) fragColor = vec4( ca[1], -dot(ca[1],ro) );
                if( abs(fragCoord.x-0.5)<0.5 ) fragColor = vec4( ca[0], -dot(ca[0],ro) );
            }
            else
            {
                fragColor = vec4( col*1.85, resT );
            }
        #else
             col = pow(col, vec3(0.7));	// gamma correction
             fragColor = vec4( col*1.0, 1);
        #endif
    #endif
    //fragColor = vec4( col, 1.0 );
}

`;

export default class implements iSub {
  key(): string {
    return 'fdl3z8';
  }
  name(): string {
    return 'IQ_TUT: Greek Holiday 2021';
  }
  sort() {
    return 50;
  }
  webgl() {
    return WEBGL_2;
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
  channels() {
    return [webglUtils.TEXTURE5, webglUtils.DEFAULT_NOISE, webglUtils.TEXTURE6];
  }
}
