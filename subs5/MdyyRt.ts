import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Venice. Created by Reinder Nijhoff 2013
// @reindernijhoff
//
// My attempt to create a procedural city with a lot of lights. The city is inspired by Venice. 

// #define SHOW_ORNAMENTS
#define SHOW_GALLERY
#define SHOW_LIGHTS
#define SHOW_BRIDGES
#define SHOW_MOON_AND_CLOUDS

//----------------------------------------------------------------------

#define BUMPFACTOR 0.2
#define EPSILON 0.1
#define BUMPDISTANCE 200.

#define CAMERASPEED 15.

#define BUILDINGSPACING 20.
#define MAXBUILDINGINSET 12.

#define GALLERYHEIGHT 10.5
#define GALLERYINSET 2.5

float time;

float hash( float n ) {
	return fract(sin(n)*32.5454412211233);
}
vec2 hash2( float n ) {
	return fract(sin(vec2(n,n+1.0))*vec2(11.1451239123,34.349430423));
}
vec3 hash3( float n ) {
	return fract(sin(vec3(n,n+1.0,n+2.0))*vec3(84.54531253,42.145259123,23.349041223));
}

float noise( in vec2 x ) {
    vec2 p = floor(x);
    vec2 f = fract(x);

	vec2 uv = p.xy + f.xy*f.xy*(3.0-2.0*f.xy);

	return -1.0 + 2.0*textureLod( iChannel0, (uv+0.5)/256.0, 0.0 ).x;
}

float noise( in vec3 x )
{
	float  z = x.z*64.0;
	vec2 offz = vec2(0.317,0.123);
	vec2 uv1 = x.xy + offz*floor(z); 
	vec2 uv2 = uv1  + offz;
	return mix(textureLod( iChannel0, uv1 ,0.0).x,textureLod( iChannel0, uv2 ,0.0).x,fract(z))-0.5;
}

const mat2 m2 = mat2( 0.80, -0.60, 0.60, 0.80 );

const mat3 m3 = mat3( 0.00,  0.80,  0.60,
                     -0.80,  0.36, -0.48,
                     -0.60, -0.48,  0.64 );

float fbm( vec3 p ) {
    float f = 0.0;
    f += 0.5000*noise( p ); p = m3*p*2.02;
    f += 0.2500*noise( p ); p = m3*p*2.03;
    f += 0.1250*noise( p ); p = m3*p*2.01;
    f += 0.0625*noise( p );
    return f/0.9375;
}

//----------------------------------------------------------------------
// distance functions

float sdBox( vec3 p, vec3 b ) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}
float sdSphere( vec3 p, float s ) {
    return length(p)-s;
}
float udBox( vec3 p, vec3 b) {
  return length(max(abs(p)-b,0.0));
}
float sdCylinderXY( vec3 p, vec2 h ) {
  return max( length(p.xy)-h.x, abs(p.z)-h.y );
}
float sdCylinderXZ( vec3 p, vec2 h ) {
  return max( length(p.xz)-h.x, abs(p.y)-h.y );
}
float sdTriPrism( vec3 p, vec2 h ) {
    vec3 q = abs(p);
    return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
}

//----------------------------------------------------------------------

float opS( float d1, float d2 ) {
    return max(-d2,d1);
}
float opU( float d1, float d2 ) {
    return min(d2,d1);
}
vec2 opU( vec2 d1, vec2 d2 ) {
	return (d1.x<d2.x) ? d1 : d2;
}
float opI( float d1, float d2 ) {
    return max(d1,d2);
}

//----------------------------------------------------------------------
// building functions

float getXoffset( float z ) {
	return 20.*sin( z*0.02);
}

vec2 getBuildingInfo( in vec3 pos ) {
	vec2 res;
	// base index	
	res.x = floor( pos.z/BUILDINGSPACING + 0.5 );
	// base z coord
	res.y = res.x * BUILDINGSPACING;
	
	// negative index for buildings at the right side
	res.x *= sign( pos.x + getXoffset(pos.z) );
	
	return res;
}

vec4 getBuildingParams( in float buildingindex ) {
	vec3 h = hash3( buildingindex );
	return vec4(
		20. + 4.5*floor( h.x*7. ),	 // height
		h.y*MAXBUILDINGINSET,
		step(h.z, 0.5),				 // sidewalk
		step(abs(h.z-0.4),0.25)		 // balcony
	);
}

float baseBuilding( in vec3 pos, in float h ) {
	vec3 tpos = vec3( pos.z, pos.y, pos.x );
	
	float res = 
	opS(		
		// main building
		udBox( tpos, vec3( 8.75, h, 8.75 ) ),
			// windows
		opS(
			opU(
				sdBox( vec3( mod(tpos.x+1.75, 3.5)-1.75, mod(tpos.y+4.5, 9.)-2.5, tpos.z-5.), vec3( 1.,2.,4.) ),
				sdCylinderXY( vec3( mod(tpos.x+1.75, 3.5)-1.75, mod(tpos.y+4.5, 9.)-4.5, tpos.z-5.), vec2( 1.,4.) )
			),
			udBox( tpos+vec3(0.,-h,0.), vec3( 9.0, 1.0, 9.0 ) )
		)		
	);
	
	res =
	opU( 
		res,
		opI( // main building windows
			udBox( tpos, vec3( 8.75, h, 8.75 ) ), 
			opU(
				udBox(  vec3( mod(tpos.x+1.75, 3.5)-1.75, tpos.y, tpos.z-8.45), vec3( 0.05, h, 0.05 ) ),
				udBox(  vec3( tpos.x, mod(tpos.y+0.425, 1.75)-0.875, tpos.z-8.45), vec3( 10.0, 0.05, 0.05 ) )
			)
		)
	);
	return res;	
}

float baseGallery( in vec3 pos ) {
	vec3 tpos = vec3( pos.z, pos.y, pos.x );
	
	float res = 
	opU(	
		opS(
			udBox( tpos+vec3(0.,0.,-GALLERYINSET), vec3( 8.75, GALLERYHEIGHT, 0.125 ) ),
			opU(
				sdBox( vec3( mod(tpos.x+1.75, 3.5)-1.75, tpos.y-5., tpos.z-5.), vec3( 1.6,3.,10.) ),
				sdCylinderXY( vec3( mod(tpos.x+1.75, 3.5)-1.75, tpos.y-8., tpos.z-5.), vec2( 1.6,10.) )
			)
		),
		sdTriPrism( vec3( tpos.z+3.4,-44.4+3.9*tpos.y, tpos.x), vec2( 7.5, 8.7 ) )
	);
	
	return res;	
}

float baseBalcony( in vec3 pos, in float h ) {
	float res = opI(		
		// main building
		udBox( pos, vec3( 9.0, h, 9.0 ) ),
			// balcony
		sdBox( vec3( pos.x, mod(pos.y+4.5, 9.)-7.5, pos.z-5.), vec3( 40.,0.5,40.) )
	);
	return res;		
}

float baseBridge( in vec3 pos ) {
	pos.x *= 0.38;
	float res = 
	opS(	
		opU( 
			sdBox( pos, vec3( 4., 2., 2.5 ) ),
			sdTriPrism( vec3( pos.x,-8.+3.*pos.y, pos.z), vec2( 4.5, 2.5 ) )
		),
		sdCylinderXY( pos+vec3( 0., 1.5, 0. ), vec2( 3.8, 3. ) )
	);
	return res;
}

// dinstancefield definitions

float mapSimpleTerrain( in vec3 p ) {	
	p.x += getXoffset( p.z );	
	p.x = -abs( p.x );
	vec2 res = vec2( udBox( vec3(p.x+30., p.y-1., p.z) , vec3( 20., 100.25, 99999. ) ), 1.);

#ifdef SHOW_BRIDGES
	float zcenter = mod(p.z+60.,120.)-70.;
	res = opU( res, vec2( baseBridge( vec3( p.x, p.y, zcenter) ), 8. ) ); // bridge
#endif
	
	return min( res.x, p.y+10. );
}

vec2 mapTerrain( in vec3 p ) {	
	vec2 buildingInfo = getBuildingInfo( p );
	vec4 buildingParams = getBuildingParams( buildingInfo.x );
	
	vec3 pos = p;
	pos.x += getXoffset( pos.z );
	pos.x = -abs( pos.x );
	
	vec2 res = vec2( udBox( vec3(pos.x+30., pos.y, pos.z) , vec3( 20., 0.25, 99999. ) ), 1.); // ground
	
	float z = buildingInfo.y;
	float zcenter = mod(pos.z+10.,20.)-10.;

#ifdef SHOW_BRIDGES
	res = opU( res, vec2( baseBridge( vec3( pos.x, pos.y,  mod(pos.z+60.,120.)-70.) ), 8. ) ); // bridge
#endif
		
	res =  opU( res, vec2( sdSphere( vec3( pos.x+11.5, pos.y-6.0, zcenter) , 0.5 ), 3. ) ); // light	
	res =  opU( res, vec2( sdSphere( vec3( pos.x+11.5, pos.y-5.4, zcenter+0.6) , 0.35 ), 3. ) ); // light	
	res =  opU( res, vec2( sdSphere( vec3( pos.x+11.5, pos.y-5.4, zcenter-0.6) , 0.35 ), 3. ) ); // light
	
	res =  opU( res, vec2( sdCylinderXZ( vec3( pos.x+11.5, pos.y, zcenter), vec2( 0.1, 6.0) ), 4.)); // 
						  
	pos += vec3( 28.75+buildingParams.y, 2.5, 0.);		
	res =  opU( res, vec2( baseBuilding( vec3( pos.x, pos.y, zcenter), buildingParams.x+2.5  ), 2. ) );

#ifdef SHOW_ORNAMENTS
	res = mix( res, opU( res, vec2( baseBalcony( vec3( pos.x, pos.y, zcenter), buildingParams.x+2.5  ), 9. ) ), buildingParams.w );
#endif
	
#ifdef SHOW_GALLERY
	pos.x += -8.75-GALLERYINSET;		
	res = mix( res, opU( res, vec2( baseGallery( vec3( pos.x, pos.y, zcenter) ), 5. ) ), buildingParams.z );
#endif	
									  
	return vec2( min( res.x,  11.-zcenter ), res.y );
}

float waterHeightMap( vec2 pos ) {
	vec2 posm = 0.02*pos * m2;
	posm.x += 0.001*time;
	float f = fbm( vec3( posm*1.9, time*0.01 ));
	float height = 0.5+0.1*f;
	height += 0.05*sin( posm.x*6.0 + 10.0*f );
	
	return  height;
}

// intersection functions

bool intersectPlane(vec3 ro, vec3 rd, float height, out float dist) {	
	if (rd.y==0.0) {
		return false;
	}
		
	float d = -(ro.y - height)/rd.y;
	d = min(100000.0, d);
	if( d > 0. ) {
		dist = d;
		return true;
	}
	return false;
}

bool intersectSphere ( in vec3 ro, in vec3 rd, in vec4 sph, out vec3 normal ) {
    vec3  ds = ro - sph.xyz;
    float bs = dot( rd, ds );
    float cs = dot(  ds, ds ) - sph.w*sph.w;
    float ts = bs*bs - cs;
	
    if( ts > 0.0 ) {
        ts = -bs - sqrt( ts );
		if( ts>0. ) {
			normal = normalize( ((ro+ts*rd)-sph.xyz)/sph.w );
			return true;
		}
    }

    return false;
}

vec3 intersect( const vec3 ro, const vec3 rd ) {
	float maxd = 1500.0;
	float precis = 0.01;
    float h=precis*2.0;
    float t = 0.0;
	float d = 0.0;
    float m = 1.0;
    for( int i=0; i<140; i++ ) {
		if( abs(h)<precis || t>maxd ) break; {
			t += h;
			vec2 mt = mapTerrain( ro+rd*t );
			h = 0.96*mt.x;
			m = mt.y;
		}
    }

    if( t>maxd ) m=-1.0;
    return vec3( t, d, m );
}

float intersectSimple( const vec3 ro, const vec3 rd ) {
	float maxd = 10000.0;
	float precis = 0.01;
    float h=precis*2.0;
    float t = 0.0;
    for( int i=0; i<50; i++ ) {
		if( abs(h)<precis || t>maxd ) break;  {
			t += h;
			h = mapSimpleTerrain( ro+rd*t );
		}
    }

    return t;
}

vec3 calcNormal( const vec3 pos ) {
    vec3 eps = vec3(0.1,0.0,0.0);

	return normalize( vec3(
           mapTerrain(pos+eps.xyy).x - mapTerrain(pos-eps.xyy).x,
           mapTerrain(pos+eps.yxy).x - mapTerrain(pos-eps.yxy).x,
           mapTerrain(pos+eps.yyx).x - mapTerrain(pos-eps.yyx).x ) );
}

//-----------------------------------------------------

vec3 path( float time ) {
	float z = time*CAMERASPEED;	
	return vec3( -getXoffset(z)+5.*cos(time*0.1), 1.25, z );	
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    time = iTime/1.5+43.;
    vec2 q = fragCoord.xy / iResolution.xy;
	vec2 p = -1.0 + 2.0*q;
	p.x *= iResolution.x / iResolution.y;
	
    // camera	
	vec3 ro = path( time+0.0 );
	vec3 ta = path( time+1.6 );
	
	ta.y *= 1.1 + 0.25*sin(0.09*time);
	float roll = 0.3*sin(1.0+0.07*time);
	
	// camera tx
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(roll), cos(roll),0.0);
	vec3 cu = normalize(cross(cw,cp));
	vec3 cv = normalize(cross(cu,cw));
	
	vec3 rd = normalize( p.x*cu + p.y*cv + 2.1*cw );
	
	// raymarch
    float distSimple = intersectSimple(ro,rd);
	bool reflection = false;
	
	float dist, totaldist = 0., depth = 0.;
	vec3 normal=vec3(1.), tmat = vec3(1000.), lp, lig;
	
	if( intersectPlane( ro, rd, 0., dist ) && dist < distSimple ) {			
		ro = ro+rd*dist;
		totaldist = dist;
		
		depth = mapTerrain(ro).x;
		
		vec2 coord = ro.xz;
		vec2 dx = vec2( EPSILON, 0. );
		vec2 dz = vec2( 0., EPSILON );
		
		float bumpfactor = BUMPFACTOR * (1. - smoothstep( 0., BUMPDISTANCE, dist) );
				
		normal = vec3( 0., 1., 0. );
		normal.x = -bumpfactor * (waterHeightMap(coord + dx) - waterHeightMap(coord-dx) ) / (2. * EPSILON);
		normal.z = -bumpfactor * (waterHeightMap(coord + dz) - waterHeightMap(coord-dz) ) / (2. * EPSILON);
		normal = normalize( normal );
		
		rd = reflect( rd, normal );
		reflection = true;
	} 
	
	// intersect scene	
	tmat = intersect(ro,rd);
	totaldist += tmat.x;
	
    vec3 pos = ro + tmat.x*rd;
	vec3 nor = vec3(0.);
    if( tmat.z>-0.5 && totaldist < 500.) {
        nor = calcNormal(pos);
	}
    else{
    	tmat.x = 500.;
    } 
    fragColor = vec4( nor, tmat.x);
}

`;

const buffB = `
/*----------------------
	Edge Detection
----------------------*/
#define _DepthDiffCoeff 5.
#define _NormalDiffCoeff 1.
#define _CameraDepthNormalsTexture iChannel3
#define R iResolution.xy

float CheckDiff(vec4 _centerNormalDepth,vec4 _otherNormalDepth) {
    float depth_diff = abs(_centerNormalDepth.w - _otherNormalDepth.w);
    vec3 normal_diff = abs(_centerNormalDepth.xyz - _otherNormalDepth.xyz);
    return 
        (float(depth_diff > _DepthDiffCoeff))
        +
        float(dot(normal_diff,normal_diff))*_NormalDiffCoeff;
}
float FastEdge(vec2 uv) {
    vec3 e = vec3(1./R, 0.);
    vec4 Center_P = texture(_CameraDepthNormalsTexture,uv);
    vec4 LD = texture(_CameraDepthNormalsTexture, uv + e.xy);
    vec4 RD = texture(_CameraDepthNormalsTexture, uv + vec2(e.x,-e.y));

    float Edge = 0.;
    Edge += CheckDiff(Center_P,LD);
    Edge += CheckDiff(Center_P,RD);
    return float(smoothstep(1., 0., Edge));
}


void mainImage( out vec4 C, in vec2 U )
{
	C = vec4(FastEdge(U/R));
  C.a = 1.;
}
`;

const fragment = `
//This FreeStyle OutLine Edge by 834144373(恬纳微晰)
/*----------------------
	FXAA
hum...you can also find on wiki
----------------------*/
#define _Strength 10.
#define R iResolution.xy
#define _EdgeTexture iChannel4
float GetLumi(vec3 col){
    return dot(col,vec3(0.299, 0.587, 0.114));
}
vec4 FXAA(sampler2D _Tex,vec2 uv){
    vec3 e = vec3(1./R,0.);

    float reducemul = 0.125;// 1. / 8.;
    float reducemin = 0.0078125;// 1. / 128.;

    vec4 Or = texture(_Tex,uv); //P
    vec4 LD = texture(_Tex,uv - e.xy); //左下
    vec4 RD = texture(_Tex,uv + vec2( e.x,-e.y)); //右下
    vec4 LT = texture(_Tex,uv + vec2(-e.x, e.y)); //左上
    vec4 RT = texture(_Tex,uv + e.xy); // 右上

    float Or_Lum = GetLumi(Or.rgb);
    float LD_Lum = GetLumi(LD.rgb);
    float RD_Lum = GetLumi(RD.rgb);
    float LT_Lum = GetLumi(LT.rgb);
    float RT_Lum = GetLumi(RT.rgb);

    float min_Lum = min(Or_Lum,min(min(LD_Lum,RD_Lum),min(LT_Lum,RT_Lum)));
    float max_Lum = max(Or_Lum,max(max(LD_Lum,RD_Lum),max(LT_Lum,RT_Lum)));

    //x direction,-y direction
    vec2 dir = vec2((LT_Lum+RT_Lum)-(LD_Lum+RD_Lum),(LD_Lum+LT_Lum)-(RD_Lum+RT_Lum));
    float dir_reduce = max((LD_Lum+RD_Lum+LT_Lum+RT_Lum)*reducemul*0.25,reducemin);
    float dir_min = 1./(min(abs(dir.x),abs(dir.y))+dir_reduce);
    dir = min(vec2(_Strength),max(-vec2(_Strength),dir*dir_min)) * e.xy;

    //------
    vec4 resultA = 0.5*(texture(_Tex,uv-0.166667*dir)+texture(_Tex,uv+0.166667*dir));
    vec4 resultB = resultA*0.5+0.25*(texture(_Tex,uv-0.5*dir)+texture(_Tex,uv+0.5*dir));
    float B_Lum = GetLumi(resultB.rgb);

    //return resultA;
    if(B_Lum < min_Lum || B_Lum > max_Lum)
        return resultA;
    else 
        return resultB;
}
void mainImage( out vec4 C, in vec2 U )
{
	C = FXAA(_EdgeTexture,U/R);
    if(iMouse.y>R.y/2.)
		C = texture(_EdgeTexture,U/R);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdyyRt';
  }
  name(): string {
    return 'Edge FXAA';
  }
  sort() {
    return 541;
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
    return buffB;
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
      webglUtils.TEXTURE2,
      webglUtils.TEXTURE11,
      webglUtils.TEXTURE4, //
      { type: 1, f: buffA, fi: 3 },
      // { type: 1, f: buffB, fi: 3 },
    ];
  }
}
