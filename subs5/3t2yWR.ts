import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
/* ----------------------------------------------------------
	CONFIGURABLE SETTINGS
//----------------------------------------------------------*/
//  MAX_PICK_DISTANCE: distance for block selection with mouse (default = 10)
#define MAX_PICK_DISTANCE 10.
//  FAST_NOISE: use cheaper noise function 
#define FAST_NOISE
//	OCCLUSION: enable voxel occlusion
#define OCCLUSION
//  SUBVOXEL: enable shapes actions with keys R,F,G
#define SUBVOXEL
//	SUBTEXTURE: apply texture scaled on subvoxels (more detailed but aliased)
#define SUBTEXTURE
//	TREE_DETAIL: if enabled, tree blocks are detailed with subvoxels 
#define TREE_DETAIL
//	TREE SIZE: height of the trees 
#define TREE_SIZE 3.
//  GRASS_DETAIL: enable grass
#define GRASS_DETAIL
//  SHADOW 0.=disabled else shadow intensity
#define SHADOW 1.
//  CLOUDS 0.=disabled else cloud density (*)
//#define CLOUDS 1.5
//  FALLING_SAND: sand blocks fall if unstable 
//#define FALLING_SAND
//  MAP: map rendering
//#define MAP
//	HIGHLIGHT 0.=disabled else higlight of  unconnected blocks, sand with 4+ horizontal steps, cascading diamonds connected to gold
#define HIGHLIGHT 0.
//	SURFACE_CACHE:  secondary cache mode with buffer C (1=surface blocks,2=heightmap,0=disabled)
#define SURFACE_CACHE 2 
//	STRUCTURES: build pyramids & towers; values 0=none, 1=basic, 2=detailed
#define STRUCTURES 2 
//  STATS: display debug info if F3,F4,F5 keys pressed 
//#define STATS
//	FLAT: flat world
//#define FLAT
//  XRAY_MODE: fly mode, with no collisions and transparent blocks (*)
//#define XRAY_MODE
// 	EXCLUDE_CACHE:view only mode, with disabled buffer B 
//#define EXCLUDE_CACHE
//	WATER_LEVEL: level of water (10.=caves, 55.= islands); 50% of the areas use WATER_LEVEL2
#define WATER_LEVEL 40.
#define WATER_LEVEL2 10.
//	WATER_FLOW: enable water flow (value= levelling distance)
//#define WATER_FLOW 250.
//  BUILD_DISTANCE average distance between costructions
#define BUILD_DISTANCE 160.

//------------------------------------------------------
//"Cubemap utils" by rory618. https://shadertoy.com/view/wdsBRn
#define FACES_B 1
#define FACES_C 1
#define ResB vec2(1024*FACES_B, 1024)
#define ResC vec2(1024*FACES_C, 1024)

//-------------------------------------

//SHARED VARIABLES
#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
#define load( coord)  texture(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[0].xy)) 
#define getTexture( id,  c) texture(iChannel0, 16. * (clamp(c,0.001,.999) + vec2(mod(id, 8.), floor(id / 8.)+2.)) / iChannelResolution[0].xy, 0.0)

//shared variables are stored in buffer A where  y=0
var(_pos, 0, varRow);//_old _pos
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange_B, 4, varRow);
var(_loadRange_C, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);//_old _pick
var(_pickTimer, 8, varRow);  //_old _pickTimer
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_stats, 14, varRow);
var(_rayDistMax,15,varRow);
var(_loadDistLimit,16,varRow);
var(_rayLimit,17,varRow);
var(_map,18,varRow);
var(_pixelSize,19,varRow);
var(_inventory,20,varRow);
var(_demo,21,varRow);
var(_mouseBusy,22,varRow);
//old value are stored in rows with y=n where n is the iFrame difference
var(_old, 0, 1); 

//BUFFER B
const int  BUFFER_B = 1;
const vec2 packedChunkSize_B = vec2(10,10);
const float heightLimit_B = packedChunkSize_B.x * packedChunkSize_B.y;

//BUFFER C
#if SURFACE_CACHE==1
const int  BUFFER_C = 2;
const float SURFACE_C=45.;
const vec2 packedChunkSize_C = vec2(6,6);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;
#elif SURFACE_CACHE==2
const int  BUFFER_C = 2;
const vec2 packedChunkSize_C = vec2(1,1);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;
#endif


//INVENTORY ITEMS FOR EACH ROW
const float NUM_ITEMS=8.;
//INVENTORY ROWS
const float NUM_ITEM_ROWS=2.;
//
const float N_SUBVOXEL=5.;
// USED BY FALLING SANDS
const float MAX_GROUND=45.;

   
// VOXEL CACHE FUNCTION
vec2 unswizzleChunkCoord(vec2 storageCoord) {
 	vec2 s = floor(storageCoord);
    float dist = max(s.x, s.y);
    float offset = floor(dist / 2.);
    float neg = step(0.5, mod(dist, 2.)) * 2. - 1.;
    return neg * (s - offset);
}

vec2 swizzleChunkCoord(vec2 chunkCoord) {
    vec2 c = chunkCoord;
    float dist = max(abs(c.x), abs(c.y));
    vec2 c2 = floor(abs(c - 0.5));
    float offset = max(c2.x, c2.y);
    float neg = step(c.x + c.y, 0.) * -2. + 1.;
    return (neg * c) + offset;
}


float calcLoadDist_B() {
    vec2  chunks = floor(ResB / packedChunkSize_B); 
    float gridSize = min(chunks.x, chunks.y);    
    return floor((gridSize - 1.) / 2.);
}

vec4 calcLoadRange_B(vec2 pos, float border) {
	vec2 d = (calcLoadDist_B() - border)* vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}

#if SURFACE_CACHE>0
float calcLoadDist_C() {
    vec2  chunks = floor(ResC / packedChunkSize_C); 
    float gridSize = min(chunks.x, chunks.y);    
    return floor((gridSize - 1.) / 2.);
}


vec4 calcLoadRange_C(vec2 pos, float border) {
	vec2 d = (calcLoadDist_C() - border)* vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}
#endif 

vec3 texToVoxCoord(vec2 textelCoord, vec3 offset,int bufferId) {
#if SURFACE_CACHE>0
    vec2 packedChunkSize= bufferId==1?packedChunkSize_B:packedChunkSize_C;
#else
    vec2 packedChunkSize= packedChunkSize_B;
#endif
	vec3 voxelCoord = offset;
    voxelCoord.xy += unswizzleChunkCoord(textelCoord / packedChunkSize);
    voxelCoord.z += mod(textelCoord.x, packedChunkSize.x) + packedChunkSize.x * mod(textelCoord.y, packedChunkSize.y);
    return voxelCoord;
}

vec2 voxToTexCoord(vec3 voxCoord,int bufferId) {
#if SURFACE_CACHE>0
    vec2 packedChunkSize= bufferId==1?packedChunkSize_B:packedChunkSize_C;
#else
    vec2 packedChunkSize= packedChunkSize_B;
#endif
    vec3 p =floor(voxCoord);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}


struct voxel {
	float id;
    int value; //1=modified,2=selected,3=falling
    vec2 light;
    float life;
    int shape;
    float rotation;
    float ground;
    float surface;
    int buffer;
     
};
 
float gb(float c, float start, float bits){return mod(floor(c/pow(2.,start)),pow(2.,bits));}//get bits

//lazy version:
#define sb(f,s,b,v) f+=(v-gb(f,s,b))*pow(2.,s)
//strict version (use in case of strange behaviours):
//#define sb(f,s,b,v) f+=(clamp(floor(v+.5),0.,pow(2.,b)-1.)-gb(f,s,b))*pow(2.,s)

// each voxel is decoded/encoded with the pixel 64 bits
// r bit 1-6 id        bit 7-8 value     bit 9-16 unused
// g bit 1-4 light.s   bit 5-8 light.t   bit 9-16 life
// b bit 1-4 shape     bit 5-8 rotation  bit 9-16 unused 
// a bit 1-8 ground                      bit 9-16 surface
voxel decodeVoxel(vec4 t) {
	voxel o;
    o.id        = gb(t.r,0., 6.);
    o.value     = int(gb(t.r,6., 2.));
    
    o.light.s   = gb(t.g,0., 4.) ;
    o.light.t   = gb(t.g,4., 4.);
    o.life      = gb(t.g,8., 7.);
    
    o.shape     = int(gb(t.b,0., 4.));
    o.rotation  = gb(t.b,4., 4.);
    
    o.ground    = gb(t.a,0., 8.);
    o.surface   = gb(t.a,8., 8.);
    return o;
}

vec4 encodeVoxel(voxel v) {
	vec4 t=vec4(0.);
    sb(t.r,0.,6.,v.id);
    sb(t.r,6.,2.,float(v.value));
    
    sb(t.g,0.,4.,v.light.s);
    sb(t.g,4.,4.,v.light.t);
    sb(t.g,8.,7.,v.life); 
    
    sb(t.b,0.,4.,float(v.shape));
    sb(t.b,4.,4.,v.rotation);
    
    sb(t.a,0.,8.,v.ground);
    sb(t.a,8.,7.,v.surface);
    return t;
}

float lightDefault(float z){
	if(z>55.) return 15.;
    else if(z>45.) return 14.; 
    else if(z>35.) return 12.; 
    else if(z>10.) return 4.;
    else return 1.;
}

voxel newVox(float z){
    voxel vox;
    vox.life=0.;
    vox.rotation=0.;
    vox.value=0;
    vox.shape=0;
    vox.ground=200.;
    vox.surface=0.;
	vox.id=0.;
    vox.light.t = z>10.? 0.:12.;
    vox.light.s = lightDefault(z);
 	vox.id=0.;
    vox.buffer=0;
    return vox;
}
/*
vec4 readMapTex(vec2 pos, sampler2D iChannel,vec2 resolution) {
    return texture(iChannel, (floor(pos) + 0.5) /  (floor (resolution.xy)), 0.0);   
 
}
*/

vec4 tx(samplerCube tx, vec2 p, int id){    
  
    vec2 uv = fract(p) - .5;
    // It's important to snap to the pixel centers.
    //p = (floor(p*cubemapRes) + .5)/cubemapRes; 
    
    vec3[6] fcP = vec3[6](vec3(-.5, uv.yx), vec3(.5, uv.y, -uv.x), vec3(uv.x, -.5, uv.y),
                          vec3(uv.x, .5, -uv.y), vec3(-uv.x, uv.y, -.5), vec3(uv, .5));
    
    return texture(tx, fcP[id]);
}

vec4 readMapTexCube(vec2 pos, samplerCube iChannel,int bufferId) {

     
    int faceId=0;
    if(bufferId==2)  faceId=5;
    
    return tx(iChannel,  (floor(pos) + 0.5) /  floor (ResB) ,faceId);
 
}

voxel getCachedVoxelCube(vec3 p,samplerCube iChannel,int bufferId) {
    if(p.z>heightLimit_B || p.z<0.){voxel vox; vox.id=0.; return vox;}
    
    voxel vox= decodeVoxel(readMapTexCube(voxToTexCoord(p, bufferId),iChannel,bufferId));
    vox.buffer=bufferId;
    return vox;
}

float isSolidVoxel(voxel vox) {
    
    return (vox.id==0. || vox.id==12. ||vox.id==26.)?0.:1.;
}

float getInventory(float slot) {
	return slot + 1. + step(2.5, slot);  
}



// WORLD GENERATION 
#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)

const float PI = 3.14159265359;


float hash( float n ) {
    return fract(sin(n)*43758.5453);
}


float hash13(vec3 p3)
{
	p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

    
float hash2(in vec2 p) { return hash(dot(p, vec2(87.1, 313.7))); }

vec2 hash22(in float p) {
	float x = hash(p);
	return vec2(x, hash(p+x));
}
//vec2 hash22(in vec2 p) { return hash2(dot(p, vec2(87.1, 313.7))); }


vec2 hash22( vec2 p ) 
{
	p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

vec4 hash44(vec4 p4)
{
	p4 = fract(p4  * HASHSCALE4);
    p4 += dot(p4, p4.wzxy+19.19);
    return fract(vec4((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}


// Fork of "Optimized Ashima SimplexNoise3D" by Makio64.
// 2020-04-23 14:52:01

// Optimized AshimaSimplexNoise by @makio64
// Original : https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl

#ifndef FAST_NOISE
lowp vec4 permute(in lowp vec4 x){return mod(x*x*34.+x,289.);}
lowp float snoise(in mediump vec3 v){
  const lowp vec2 C = vec2(0.16666666666,0.33333333333);
  const lowp vec4 D = vec4(0,.5,1,2);
  lowp vec3 i  = floor(C.y*(v.x+v.y+v.z) + v);
  lowp vec3 x0 = C.x*(i.x+i.y+i.z) + (v - i);
  lowp vec3 g = step(x0.yzx, x0);
  lowp vec3 l = (1. - g).zxy;
  lowp vec3 i1 = min( g, l );
  lowp vec3 i2 = max( g, l );
  lowp vec3 x1 = x0 - i1 + C.x;
  lowp vec3 x2 = x0 - i2 + C.y;
  lowp vec3 x3 = x0 - D.yyy;
  i = mod(i,289.);
  lowp vec4 p = permute( permute( permute(
	  i.z + vec4(0., i1.z, i2.z, 1.))
	+ i.y + vec4(0., i1.y, i2.y, 1.))
	+ i.x + vec4(0., i1.x, i2.x, 1.));
  lowp vec3 ns = .142857142857 * D.wyz - D.xzx;
  lowp vec4 j = -49. * floor(p * ns.z * ns.z) + p;
  lowp vec4 x_ = floor(j * ns.z);
  lowp vec4 x = x_ * ns.x + ns.yyyy;
  lowp vec4 y = floor(j - 7. * x_ ) * ns.x + ns.yyyy;
  lowp vec4 h = 1. - abs(x) - abs(y);
  lowp vec4 b0 = vec4( x.xy, y.xy );
  lowp vec4 b1 = vec4( x.zw, y.zw );
  lowp vec4 sh = -step(h, vec4(0));
  lowp vec4 a0 = b0.xzyw + (floor(b0)*2.+ 1.).xzyw*sh.xxyy;
  lowp vec4 a1 = b1.xzyw + (floor(b1)*2.+ 1.).xzyw*sh.zzww;
  lowp vec3 p0 = vec3(a0.xy,h.x);
  lowp vec3 p1 = vec3(a0.zw,h.y);
  lowp vec3 p2 = vec3(a1.xy,h.z);
  lowp vec3 p3 = vec3(a1.zw,h.w);
  lowp vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  lowp vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.);
  return -0.334 +.5 + 12. * dot( m * m * m, vec4( dot(p0,x0), dot(p1,x1),dot(p2,x2), dot(p3,x3) ) );
}
// Optimized Ashima Simplex noise2D by @makio64
// Original shader : https://github.com/ashima/webgl-noise/blob/master/src/noise2D.glsl
// snoise return a value between 0 & 1

lowp vec3 permute(in lowp vec3 x) { return mod( x*x*34.+x, 289.); }
lowp float snoise(in lowp vec2 v) {
  lowp vec2 i = floor((v.x+v.y)*.36602540378443 + v),
      x0 = (i.x+i.y)*.211324865405187 + v - i;
  lowp float s = step(x0.x,x0.y);
  lowp vec2 j = vec2(1.0-s,s),
      x1 = x0 - j + .211324865405187, 
      x3 = x0 - .577350269189626; 
  i = mod(i,289.);
  lowp vec3 p = permute( permute( i.y + vec3(0, j.y, 1 ))+ i.x + vec3(0, j.x, 1 )   ),
       m = max( .5 - vec3(dot(x0,x0), dot(x1,x1), dot(x3,x3)), 0.),
       x = fract(p * .024390243902439) * 2. - 1.,
       h = abs(x) - .5,
      a0 = x - floor(x + .5);
  return -0.278 + .5 + 65. * dot( pow(m,vec3(4.))*(- 0.85373472095314*( a0*a0 + h*h )+1.79284291400159 ), a0 * vec3(x0.x,x1.x,x3.x) + h * vec3(x0.y,x1.y,x3.y));
}
#endif

#ifdef FAST_NOISE
float snoise( in vec2 p )
{
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2  i = floor( p + (p.x+p.y)*K1 );
    vec2  a = p - i + (i.x+i.y)*K2;
    float m = step(a.y,a.x); 
    vec2  o = vec2(m,1.0-m);
    vec2  b = a - o + K2;
	vec2  c = a - 1.0 + 2.0*K2;
    vec3  h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
	vec3  n = h*h*h*h*vec3( dot(a,hash22(i+0.0)), dot(b,hash22(i+o)), dot(c,hash22(i+1.0)));
    
    return dot( n, vec3(70.0) );
}

float noise3D(vec3 p)
{
	return fract(sin(dot(p ,vec3(12.9898,78.233,128.852))) * 43758.5453)*2.0-1.0;
}
float snoise(vec3 p)
{
 	
	float f3 = 1.0/3.0;
	float s = (p.x+p.y+p.z)*f3;
	int i = int(floor(p.x+s));
	int j = int(floor(p.y+s));
	int k = int(floor(p.z+s));
	
	float g3 = 1.0/6.0;
	float t = float((i+j+k))*g3;
	float x0 = float(i)-t;
	float y0 = float(j)-t;
	float z0 = float(k)-t;
	x0 = p.x-x0;
	y0 = p.y-y0;
	z0 = p.z-z0;
	
	int i1,j1,k1;
	int i2,j2,k2;
	
	if(x0>=y0)
	{
		if(y0>=z0){ i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; } // X Y Z order
		else if(x0>=z0){ i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; } // X Z Y order
		else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }  // Z X Z order
	}
	else 
	{ 
		if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; } // Z Y X order
		else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; } // Y Z X order
		else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; } // Y X Z order
	}
	
	float x1 = x0 - float(i1) + g3; 
	float y1 = y0 - float(j1) + g3;
	float z1 = z0 - float(k1) + g3;
	float x2 = x0 - float(i2) + 2.0*g3; 
	float y2 = y0 - float(j2) + 2.0*g3;
	float z2 = z0 - float(k2) + 2.0*g3;
	float x3 = x0 - 1.0 + 3.0*g3; 
	float y3 = y0 - 1.0 + 3.0*g3;
	float z3 = z0 - 1.0 + 3.0*g3;	
				 
	vec3 ijk0 = vec3(i,j,k);
	vec3 ijk1 = vec3(i+i1,j+j1,k+k1);	
	vec3 ijk2 = vec3(i+i2,j+j2,k+k2);
	vec3 ijk3 = vec3(i+1,j+1,k+1);	
            
	vec3 gr0 = normalize(vec3(noise3D(ijk0),noise3D(ijk0*2.01),noise3D(ijk0*2.02)));
	vec3 gr1 = normalize(vec3(noise3D(ijk1),noise3D(ijk1*2.01),noise3D(ijk1*2.02)));
	vec3 gr2 = normalize(vec3(noise3D(ijk2),noise3D(ijk2*2.01),noise3D(ijk2*2.02)));
	vec3 gr3 = normalize(vec3(noise3D(ijk3),noise3D(ijk3*2.01),noise3D(ijk3*2.02)));
	
	float n0 = 0.0;
	float n1 = 0.0;
	float n2 = 0.0;
	float n3 = 0.0;

	float t0 = 0.5 - x0*x0 - y0*y0 - z0*z0;
	if(t0>=0.0)
	{
		t0*=t0;
		n0 = t0 * t0 * dot(gr0, vec3(x0, y0, z0));
	}
	float t1 = 0.5 - x1*x1 - y1*y1 - z1*z1;
	if(t1>=0.0)
	{
		t1*=t1;
		n1 = t1 * t1 * dot(gr1, vec3(x1, y1, z1));
	}
	float t2 = 0.5 - x2*x2 - y2*y2 - z2*z2;
	if(t2>=0.0)
	{
		t2 *= t2;
		n2 = t2 * t2 * dot(gr2, vec3(x2, y2, z2));
	}
	float t3 = 0.5 - x3*x3 - y3*y3 - z3*z3;
	if(t3>=0.0)
	{
		t3 *= t3;
		n3 = t3 * t3 * dot(gr3, vec3(x3, y3, z3));
	}
	return 96.0*(n0+n1+n2+n3);
	
}

#endif

bool overworld(vec3 p) {
	float density = 48. - p.z;
    density += mix(0., 40., pow(.5 + .5 * snoise(p.xy /557. + vec2(0.576, .492)), 2.)) * snoise(p / 31.51 + vec3(0.981, .245, .497));

    return density > 0.;
}

//https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdOctahedron( vec3 p, float s)
{
  p = abs(p);
  return (p.x+p.y+p.z-s)*0.57735027;
}

float sdCross( vec3 p, vec3 b )
{
  float d1 = length(max( abs(p) - b,0.));
  float d2 = length(max( abs(p) - b.zyx,0.));
  float d3 = length(max( abs(p) - b.xzy,0.));
  return min(d1, min(d2,d3));
}


voxel getGeneratedVoxel(vec3 voxelCoord,bool caves){

    	voxel vox=newVox(voxelCoord.z);
#ifdef FLAT
    	vox.id=(voxelCoord.z>=50.?0.:3.);
#else 
    
    	bool layer[4];
    	for (int i =0; i <=3 ; i++) {
            float h;
            if(i==1) h=1.; 
            else if(i==2) h=3.; 
            else if(i==3)  h=-1.; 
            else h=0.;
            
            layer[i]=overworld(voxelCoord+ vec3(0,0,h));
            if(!layer[0]) break;
        }
         
    	bool solid = layer[0];
    
   
        if (solid) {
            //GRASS
            vox.id = 3.;
                             
            //DIRT
            if (layer[1]) vox.id = 2.; 
            //ROCK
            if (layer[2]) vox.id = 1.; 
            //TORCH
            if (hash13(voxelCoord) > 0.98 && !layer[3]) {vox.id = 6.;vox.light.t = 15.;}
 
            //TREE BASE
            if (hash13(voxelCoord) > 0.98 && !layer[1]) {vox.id = 10.;vox.life = 2.+ TREE_SIZE; vox.shape=9;}

             // CAVE
            if(caves){
                caves=snoise(voxelCoord / 27.99 + vec3(0.981, .245, .497).yzx * 17.) > 1. - (smoothstep(0., 5., voxelCoord.z) - 0.7 * smoothstep(32., 48., voxelCoord.z));
	        	if (caves) {vox.id = 0.;}
            }
        } 
 	    
    	//WATER
    	if(vox.id == 0. && voxelCoord.z < WATER_LEVEL) {
            vox.id=12.; 
#ifdef WATER_FLOW
            vox.life=WATER_FLOW;    
#endif                
         }
        //GEMS
        if (hash13(voxelCoord) > 0.995 && voxelCoord.z < 20.  &&  vox.id!=12. && vox.id!=0. ) {if(hash13(voxelCoord +vec3(1.))>.5) vox.id = 6.; else vox.id=8.;}    
        //BEDROCK
        if (voxelCoord.z < 1.) vox.id = 16.; 
    
#if STRUCTURES>0    
    	// STRUCTURES REPEATED EVERY BUILD_DISTANCE SQUARE
    	vec3  buildCoord = vec3(floor((voxelCoord.xy -vec2(3260. -40.,9650. -40.))/BUILD_DISTANCE)*BUILD_DISTANCE,0.)   +vec3(3260.,9650.,50.);
 		//RANDOM POSITION INSIDE THE 80x80 SQUARE	 buildCoord += hash33(buildCoord)
    	if(length(voxelCoord.xy -vec2(3260, 9650.))>50.) buildCoord += floor(hash33(buildCoord) *vec3(50.,50, .10)) -vec3(25.,25, 5.);
   
    	float type =hash13(buildCoord);
    	float type2 =hash13(buildCoord+vec3(1.));
        if(type2<.5 && vox.id == 0. && voxelCoord.z < WATER_LEVEL2) {
            vox.id=12.; 
#ifdef WATER_FLOW
            vox.life=WATER_FLOW;
            
            
            if(voxelCoord.z > WATER_LEVEL2-2.) vox.shape=3;
#endif                
         }
    	if(type<.2) {
            //PYRAMID          
            if(sdOctahedron(voxelCoord -  buildCoord -vec3(-2.,-3.,2.),30.)<=0.) vox.id=13.;

        }
    	else{

            //TOWER
             if(length(voxelCoord.xy - buildCoord.xy - vec2(-2.,-3.))<2.  && voxelCoord.z <75.)  {vox.id=1.;  vox.light.t=8.;}
            if(length(voxelCoord - buildCoord  - vec3(-2.,-3.,30.))<1.5)  {vox.id=6.;  vox.light.t=15.;}
        }
#endif
    
#endif       
  	
        return vox;
		
}



// MIX PROCEDURAL AND MEMORY VOXEL
bool inRange(vec2 p, vec4 r) {
	return (p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w);
}



voxel getVoxelData( vec3 voxelCoord,
                    samplerCube iChannel_Cube, 
                    int frame, 
                    vec4 range_B,
                    vec4 range_C,
                    vec3 offset,
                    bool caves,
                    int caller){
  
#ifdef EXCLUDE_CACHE
    return getGeneratedVoxel(voxelCoord,true); 
#else    
    
 
    if (inRange(voxelCoord.xy,range_B) && frame > 0 && voxelCoord.z <heightLimit_B  
        && (caller!=2)  //comment this line to enable persistence between cache (doesn't handle resolution change)
       ) {
        return getCachedVoxelCube(voxelCoord  - offset,iChannel_Cube,BUFFER_B); 
        
    }
#if SURFACE_CACHE==1     
     if (inRange(voxelCoord.xy,range_C) && frame > 0  
               &&  voxelCoord.z >= SURFACE_C
         		&& voxelCoord.z <heightLimit_C +SURFACE_C
              //&& (caller!=1) //
              
             ) {
        return getCachedVoxelCube(voxelCoord - vec3(0.,0.,SURFACE_C) - offset,iChannel_Cube,BUFFER_C); 
         
    }
#elif SURFACE_CACHE==2
    if (inRange(voxelCoord.xy,range_C) && frame > 0){
         if ( voxelCoord.z >= 0.&& voxelCoord.z <heightLimit_C  && (caller==2) ) {
            // BUFFER C previous frame
        	return getCachedVoxelCube(voxelCoord - offset,iChannel_Cube,BUFFER_C); 
         }
        if(caller!=2){
        	voxel vo= getCachedVoxelCube(vec3(voxelCoord.xy,0.) - offset,iChannel_Cube,BUFFER_C);
         	if(vo.ground>0. && vo.ground< heightLimit_B  ){
                //Above max height of BUFFER C --> air
                float h=voxelCoord.z-vo.ground;
                if(h==0. ) { return vo;}
                
                voxel vox=newVox(voxelCoord.z);
             	if(h>0. && caller==3) { 
                   	//GRASS
                    if(h==1. &&vo.id==3.) vox.life=1.;
                    //TREE TRUNK
                    if(h<TREE_SIZE+2. && vo.id==10. && vo.ground >= WATER_LEVEL-1.) {vox.id=10.; vox.life=2.+TREE_SIZE-h; ; vox.shape=9;}                   
                    return vox;
                }
             	
                if(h>-3. && h<0. && vo.id==11. && caller==3) {
                    //TREE LEAFS
                    vox.id=11.; 
                    vox.shape=8;
                    vox.life=0.;
                    return vox;
                }
					
         	}
         }
    }    
#endif
  
    return getGeneratedVoxel(voxelCoord,caves);
#endif
}

#define getCVoxel(p,v,id)           \
	{vec2 frame=(id!=3&&id!=0?_old:vec2(0.) );\
    vec4 range_B = load(frame+_loadRange_B);  \
    vec4 range_C = load(frame+_loadRange_C);  \
    vec3 offset =(id==0?vec3(0.): floor(vec3(load(frame+_pos).xy, 0.)));   \
    if(id==2)  v= getCachedVoxelCube(p-offset,iChannel1,2); \
    else v= getCachedVoxelCube(p-offset,iChannel1,1);}


#define getVoxel(p,v,id)           \
	{vec2 frame=(id!=3&&id!=0?_old:vec2(0.) );\
    vec4 range_B = load(frame+_loadRange_B);  \
    vec4 range_C = load(frame+_loadRange_C);  \
    vec3 offset =(id==0?vec3(0.): floor(vec3(load(frame+_pos).xy, 0.)));   \
    v= getVoxelData(p,iChannel1,iFrame,range_B,range_C,offset,true,id);}






    `;

const buffA = `
    #define KEY_FORWARDS 87
#define KEY_BACKWARDS 83
#define KEY_LEFT 65
#define KEY_RIGHT 68
#define KEY_JUMP 32
#define KEY_SNEAK 16
#define KEY_PLACE 81
#define KEY_DESTROY 69
#define KEY_SHAPE 82
#define KEY_ROTATE_Z 70
#define KEY_ROTATE_Y 71
#define KEY_MULTISELECT 67
#define KEY_DECREASE_ZOOM 33
#define KEY_INCREASE_ZOOM 34
#define KEY_DECREASE_PIXELSIZE 75
#define KEY_INCREASE_PIXELSIZE 76
#define KEY_INCREASE_TIME_SCALE 80
#define KEY_DECREASE_TIME_SCALE 79
#define KEY_STATS 114
#define KEY_DUMP1 115
#define KEY_DUMP2 116
#define KEY_TELEPORT 84
#define KEY_INCREASE_PERFORMANCE 117
#define KEY_WORLD 89
#define KEY_MAP 77
#define KEY_INVENTORY 73


//ACTIONS 



bool inBox(vec2 coord, vec4 bounds) {
    return coord.x >= bounds.x && coord.y >= bounds.y && coord.x < (bounds.x + bounds.z) && coord.y < (bounds.y + bounds.w);
}
vec2 currentCoord;
vec4 outValue;
bool store4(vec2 coord, vec4 value) {
    if (inBox(currentCoord, vec4(coord, 1., 1.))) {
        outValue = value;
        return true;
    }
    else return false;
}
bool store3(vec2 coord, vec3 value) { return store4(coord, vec4(value, 1)); }
bool store2(vec2 coord, vec2 value) { return store4(coord, vec4(value, 0, 1)); }
bool store1(vec2 coord, float value) { return store4(coord, vec4(value, 0, 0, 1)); }

float keyDown(int keyCode) {
    return texture(iChannel2, vec2((float(keyCode) + 0.5) / 256., .5/3.), 0.0).r;   
}

float keyPress(int keyCode) {
    return texture(iChannel2, vec2((float(keyCode) + 0.5) / 256., 1.5/3.), 0.0).r;   
}

float keySinglePress(int keycode) {
    bool now = bool(keyDown(keycode));
    bool previous = bool(texture(iChannel0, vec2(256. + float(keycode) + 0.5, 0.5) / iResolution.xy, 0.0).r);
    return float(now && !previous);
}


float keyToggled(int keyCode) {
    return texture(iChannel2, vec2((float(keyCode) + 0.5) / 256., 2.5/3.), 0.0).r;   
}

float rectangleCollide(vec2 p1, vec2 p2, vec2 s) {
    return float(all(lessThan(abs(p1 - p2), s)));   
}

float horizontalPlayerCollide(vec2 p1, vec2 p2, float h) {
    vec2 s = (vec2(1) + vec2(.6, h)) / 2.;
    p2.y += h / 2.;
    return rectangleCollide(p1, p2, s);
}


/*
voxel getCachedVoxel(vec3 p) {
    return getCachedVoxel(p,iChannel1,iChannelResolution[1],BUFFER_B);
}*/



float isSolidVoxel(bool slope,vec3 p) {
    voxel t;
  
    getCVoxel(p,t,0);
    //t= getCachedVoxelCube2(p,iChannel1,ResB);
    return isSolidVoxel(t) * (!slope || t.shape!=6?1.:0.);
}

struct rayCastResults {
    bool hit;
    vec3 mapPos;
    vec3 normal;
};

rayCastResults  getMouseRay(){
       
   vec4 mouseRay=  texture(iChannel3, vec2(0.));
   rayCastResults res;
   res.hit = mouseRay.a!=0.;
   res.mapPos = mouseRay.rgb;
    
   float eN = mouseRay.a -1.;
   res.normal=vec3(mod(eN,3.),floor(mod(eN,9.)/3.),floor(eN/9.))- vec3(1.);  
   return res;
}

float mouseSelect(vec2 c,float h) {
	float scale = floor(iResolution.y / 128.);
    c /= scale;
    vec2 r = iResolution.xy / scale;
    float xStart = (r.x - 16. * NUM_ITEMS) / 2.;
    c.x -= xStart;
    if (c.x <NUM_ITEMS * 16. && c.x >= 0. && c.y < 16.*h) {
        float slot = floor(c.x / 16.) + NUM_ITEMS*floor(c.y / 16.);
    	return slot;
    }

    return -1.;
}

bool mouseDoubleClick(){
    
    if(iMouse.z <1. ) {
   
        int changeCount=0;
        for(int i=0;i<20;i++){

            int mouseChange=          
               (load(_old *vec2(i) + _mouse ).z>0.?0:1)
              +(load( _old * vec2(i+1) +_mouse ).z>0.?0:1);


            if(mouseChange==1)changeCount++;
            if(load(_mouseBusy).r>0.) {store1(_mouseBusy,float(1.));return false;}
                               
            if(changeCount>2){
                //if(load(_time).r - load(_old*vec2(i) +_time).r<1.) return false;
                if(length(load(_mouse).xy -load(_old * vec2(i+1) +_mouse).xy)>.05) return false;
                store1(_mouseBusy,float(1.));
                return true;

            }         
        }
    }
    store1(_mouseBusy,float(0.));
    return false; 
}



#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)


float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}


float tileableWorley(in vec2 p, in float numCells)
{
	p *= numCells;
	float d = 1.0e10;
	for (int xo = -1; xo <= 1; xo++)
	{
		for (int yo = -1; yo <= 1; yo++)
		{
			vec2 tp = floor(p) + vec2(xo, yo);
			tp = p - tp - hash22(256. * mod(tp, numCells));
			d = min(d, dot(tp, tp));
		}
	}
	return sqrt(d);
	//return 1.0 - d;// ...Bubbles.
}

float crackingAnimation(vec2 p, float t) {
    t = ceil(t * 8.) / 8.;
	float d = 1.0e10;
    //t *= ;
    for (float i = 0.; i < 25.; i++) {
    	vec2 tp = hash22(p )-.5; //texture(iChannel1, vec2(4, i) / 256.).xy - 0.5;
        tp *= max(0., (length(tp) + clamp(t, 0., 1.) - 1.) / length(tp));
        d = min(d, length(tp + 0.5 - p));
    }
    return pow(mix(clamp(1. - d * 3., 0., 1.), 1., smoothstep(t - 0.3, t + 0.3, max(abs(p.x - 0.5), abs(p.y - 0.5)) * 2.)), .6) * 1.8 - 0.8;
}

float brickPattern(vec2 c) {
	float o = 1.;
    if (mod(c.y, 4.) < 1.) o = 0.;
    if (mod(c.x - 4. * step(4., mod(c.y, 8.)), 8.) > 7.) o = 0.;
    return o;
}
float woodPattern(vec2 c) {
	float o = 1.;
    if (mod(c.y, 4.) < 1.) o = 0.;
    if (mod(c.x + 2. - 6. * step(4., mod(c.y, 8.)), 16.) > 15.) o = 0.;
    return o;
}

void setTexture( out vec4 o, in vec2 fragCoord )
{
    
 	if(fragCoord.x>8.*16. || fragCoord.y >10.*16.) discard;
    vec2 gridPos = floor((fragCoord -vec2(0.,32.))/ 16.) ;
    vec2 c = mod(fragCoord, 16.);
    int id = int(gridPos.x + gridPos.y * 8.);
 
   
    vec2 uv = floor( c );	
    float h = hash12(uv +vec2(float(id)));
    float br = 1. - h * (96./255.);		
	float xm1 = mod((uv.x * uv.x * 3. + uv.x * 81.) / 4., 4.);

    if (iFrame > 10 && iChannelResolution[0].x > 0. && id!=32  ) discard;
    o.a = 1.;
    if (id == 0) { //NO TEXTURE
    	o = vec4(1,0,1,1);
    }
    if (id == 1) { //STONE
       
        o.rgb =  vec3( 127./255., 127./255., 127./255.) *br;        
    }
    if (id == 2) { //DIRT
        
        o.rgb =  vec3( 150./255., 108./255.,  74./255.) *br;
    }
    if (id == 3) { //GRASS LATERAL
        
        o.rgb =  vec3( 150./255., 108./255.,  74./255.) *br;
        if (c.y  + hash( c.x*2.) *3.  > 14. ) 
         o.rgb =  vec3( 96./255., 157./255.,  59./255.)*br;
    }
    if (id == 4) { //GRASS UP
   		
        o.rgb = vec3( 96./255., 157./255.,  59./255.)*br;
    }
    if (id == 5) { //ROCK
       
        o.rgb = vec3( 106./255., 170./255.,  64./255.)*br;
        o.rgb = vec3(clamp(pow(1. - tileableWorley(c / 16., 4.), 2.), 0.2, 0.6) + 0.2 * tileableWorley(c / 16., 5.));
 
    }
    if (id == 6 || id == 26) {//LIGHT OR FIREFLY
        float w = 1. - tileableWorley(c / 16., 4.);
        float l = clamp(0.7 * pow(w, 4.) + 0.5 * w, 0., 1.);
        o.rgb = mix(vec3(.3, .1, .05), vec3(1,1,.6), l);
        if (w < 0.2) o.rgb = vec3(0.3, 0.25, 0.05);
    }
    if (id == 7) { //BRICK
        o.rgb = vec3( 181./255.,  58./255.,  21./255.)*br; 
		if ( mod(uv.x + (floor(uv.y / 4.) * 5.), 8.) == 0. || mod( uv.y, 4.) == 0.) {
			o.rgb = vec3( 188./255., 175./255., 165./255.); 
		}
        
    	//o.rgb = -0.1 * hash12(c) + mix(vec3(.6,.3,.2) + 0.1 * (1. - brickPattern(c + vec2(-1,1)) * brickPattern(c)), vec3(0.8), 1. - brickPattern(c));
    }
    if (id == 8) {//GOLD
    	o.rgb = mix(vec3(1,1,.2), vec3(1,.8,.1), sin((c.x - c.y) / 3.) * .5 + .5);
        if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(1,.8,.1);
    }
    if (id == 9) { //WOOD
        
         o.rgb= vec3(0.5,0.4,0.25)*(0.5 + 0.5 * woodPattern(c))*br;        
    }    
    if (id == 10) {//TREE
		
        if ( h < 0.5 ) {
			br = br * (1.5 - mod(uv.x, 2.));
		}
        o.rgb = vec3( 103./255., 82./255.,  49./255.)*br; 				
	}	
    if (id == 11) {//LEAF
	        o.rgb=  vec3(  40./255., 117./255.,  38./255.)*br;		
	}
    if (id == 12) {//WATER		
        o.rgb=vec3(  64./255.,  64./255., 255./255.)*br;		
	}	
    if (id == 13) {//SAND
		//getMaterialColor(10,c,o.rgb);
		o.rgb= vec3(0.74,0.78,0.65);
	}	
    if (id == 14) {//RED APPLE	- MIRROR	
		o.rgb= vec3(.95,0.,0.05);
       
	}
    if (id == 15) {//PINK MARBLE	
        o.rgb= vec3(.95,0.5,.5)*br;
    	//o.rgb = mix(vec3(.2,1,1), vec3(1,.8,.1), sin((c.x - c.y) / 3.) * .5 + .5);
       // if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(.1,.8,1);
       
	}
    if (id == 16) { //BEDROcK
        
    
        o.rgb =   .2*vec3( 127./255., 127./255., 127./255.) *br;   
    }
    if (id == 17) {//DIAMOND	
       
    	o.rgb = mix(vec3(.2,1,1), vec3(.1,.8,1), sin((c.x - c.y) / 3.) * .5 + .5);
       if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(.1,.8,1);
       
	}
 /*   
    
    if (id == 18) {//	
        o.rgb= vec3(0.04, 0.14, 0.42)*br;
       
	}
    if (id == 19) {//	
        o.rgb=  vec3(0.05, 0.50, 0.95)*br;
       
	}
    if (id == 20) {//	
        o.rgb= vec3(0.36, 0.72, 0.68)*br;
       
	}
    if (id == 21) {//	
        o.rgb= vec3(0.48, 0.46, 0.28)*br;
       
	}
    if (id == 22) {//	
        o.rgb= vec3(0.69, 0.58, 0.27)*br;
       
	}
    if (id == 23) {//	
        o.rgb= vec3(0.42, 0.51, 0.20)*br;
       
	}    
    if (id == 24) {//	
        o.rgb= vec3(0.23, 0.53, 0.16)*br;
       
	}
    if (id == 25) {//	
        o.rgb= vec3(0.06, 0.20, 0.07)*br;
       
	}
    if (id == 26) {//	
        o.rgb= vec3(0.32, 0.33, 0.27)*br;
       
	}
    if (id == 27) {//	
        o.rgb= vec3(0.25, 0.37, 0.41)*br;
       
	}
    if (id == 28) {//	
        o.rgb= vec3(0.44, 0.67, 0.74)*br;
       
	}  
    if (id == 29) {//	
        o.rgb= vec3(0.73, 0.86, 0.91)*br;
       
	}  
*/  

    if (id == 32) { //DESTROYING BLOCK ANIMATION
    	o.rgb = vec3(crackingAnimation(c / 16., load(_pickTimer).r));
    }
    if (id == 48) { 
    	o = vec4(vec3(0.2), 0.7);
        vec2 p = c - 8.;
        float d = max(abs(p.x), abs(p.y));
        if (d > 6.) {
            o.rgb = vec3(0.7);
            o.rgb += 0.05 * hash12(c);
            o.a = 1.;
            if ((d < 7. && p.x < 6.)|| (p.x > 7. && abs(p.y) < 7.)) o.rgb -= 0.3;
        }
        o.rgb += 0.05 * hash12(c);
        
    }
    
}

/*--------------------

x=0 && y<256: global variables
x=0 &&  256<=y<512: keyboard state for each ascii code with millisecs since laste change
1<=x<16 y<512: previous values fo variables and keys
x<= 128 && 16<=y< 140 : textures 


*///-------------------
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    currentCoord = fragCoord;
    if(fragCoord.x>512. || fragCoord.y >160.) discard;
    vec2 texCoord = floor(fragCoord);
    if (texCoord.x < 512. && texCoord.y<32.) {
        if (texCoord.y == varRow) {
            if (texCoord.x >= 256.) {
                fragColor.r = texture(iChannel2, (fragCoord - 256.) / vec2(256,3)).r;
                vec4 old = texture(iChannel0, (_old + fragCoord) / iChannelResolution[0].xy);
                if (fragColor.r != old.r) old.a = 0.;
                fragColor.a = old.a + iTimeDelta;
            }
            else {
                vec3 pos = load(_pos).xyz;
                vec3 oldPos = pos;
                vec3 offset = vec3(floor(pos.xy), 0.);
                vec2 angle = load(_angle).xy;
                vec4 oldMouse = load(_mouse);
                vec3 vel = load(_vel).xyz;
                vec4 mouse = iMouse / length(iResolution.xy);
                float renderScale = load(_renderScale).r;
                vec2 time = load(_time).rg;
                vec2 flightMode = load(_flightMode).rg;
                vec2 sprintMode = load(_sprintMode).rg;
                float selected = load(_selectedInventory).r;
                float dt = min(iTimeDelta, .05);
                float rayDistMax = max(load(_rayDistMax).r,50.);
				
                float pixelSize =load(_pixelSize).r;
                float inventory =load(_inventory).r;
                float demo =load(_demo).r;
				float map=load(_map).r;;

                if (iFrame <2  ) {
#ifdef FAST_NOISE  
                    pos = vec3(2952.8,10140.8,89.);
                    offset = vec3(floor(pos.xy), 0.);
                    oldPos = pos;
                    angle = vec2(-0.6,1.8  );                   
#else
                    pos = vec3(3265.5,9654.5,50.);                   
                    angle = vec2(-2.,1.6  );
#endif                    
                    demo=1.;
                    oldMouse = vec4(-1);
                    vel = vec3(0);
                    renderScale = -2.;
                    time = vec2(0.,4);
                    selected = 0.;
                    inventory=0.;
                    rayDistMax=250.;
                    map=1.;
                    pixelSize=2.;
                }
                if(demo>0. && 
                   (keyDown(KEY_JUMP)>.0||keyDown(KEY_FORWARDS)>0. || iMouse.z>0. ))
                {
                    //inventory=1.;
                    map=1.;
                    demo=0.;
                }
                
                if ( bool(keyDown(KEY_TELEPORT))) {
					
                    if(hash(iTime) <.5) pos=vec3(3221.5,10159.5,70.);
                    else pos =vec3(hash33(pos).xy *10000.,72.); 
                       
                    offset = vec3(floor(pos.xy), 0.);
                    oldPos = pos;
                    time.r=hash13(pos)*1200.;
                    oldMouse = vec4(-1);
                    vel = vec3(0);
                    renderScale = -2.;                  
                    selected = 0.;
                    rayDistMax=250.;
                }
                if (oldMouse.z > 0. && iMouse.z > 0. && map<1.5)
                    if(1==1){
                        float zoom = pow(10., load(_renderScale).r/10.);
                        angle += 5.*(mouse.xy - oldMouse.xy) * vec2(-1,-1)/zoom;
                        angle.y = clamp(angle.y, 0.1, PI - 0.1);
                    }
                vec3 dir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
                vec3 dirU = vec3(normalize(vec2(dir.y, -dir.x)), 0);
                vec3 dirV = cross(dirU, dir);
                vec3 move = vec3(0);

                
                vec3 dirFwd = vec3(cos(angle.x), sin(angle.x), 0);;
                    vec3 dirRight = vec3(dirFwd.y, -dirFwd.x, 0);
                vec3 dirUp = vec3(0,0,1);
                
                float inBlock = 0.;      
                vec3  vColPos, hColPos;
                
                //z of closest  blocks below
                float minHeight = 0.; 
                
                //z of closest  blocks above
                float maxHeight = 1000.;
                
                //XY of closest lateral blocks
                float minX = pos.x - 1000.; 
                float maxX = pos.x + 1000.;
                float minY = pos.y - 1000.;
                float maxY = pos.y + 1000.;
#ifndef XRAY_MODE
                if(isSolidVoxel(false,pos-offset) >.5)  pos.z+=clamp(3./iTimeDelta,.3,1.);
                
                //DOWN
                for (float i = 0.; i < 4.; i++) {
                    vColPos = vec3(floor(pos.xy - 0.5), floor(pos.z - 1. - i));
                    float solid=0.;
                    for(int j=0;j<4;j++){
                        solid+=
                          isSolidVoxel(false,vColPos - offset + vec3(j/2,j%2,min(iFrame,0))) * rectangleCollide(vColPos.xy + vec2(0.5 +float(j/2),0.5+float(j%2)), pos.xy, vec2(.8));
                    }
                    if ( solid> .5) {
                        minHeight = vColPos.z + 1.001; 
                        inBlock = 1.;
                        break;
                    }
                }
				
                //UP
                vColPos = vec3(floor(pos.xy - 0.5), floor(pos.z + 1.8 + 1.));
                float solidUp=0.;
                for(int j=0;j<4;j++){
                 	solidUp+= isSolidVoxel(false,vColPos - offset + vec3(j/2,j%2,min(iFrame,0))) * rectangleCollide(vColPos.xy + vec2(0.5 +float(j/2),0.5+float(j%2)), pos.xy, vec2(.8));
                }
				if(  solidUp > .5) {
                    maxHeight = vColPos.z - 1.8 - .001; 
                    inBlock = 1.;     

                }
               
                //LATERAL
                float solidL[4];
                for(int i=0;i<4;i++){
                    vec2 posL;
                    vec2 hColPosL;
                    if(i==0) {hColPos = vec3(floor(pos.xy - vec2(.3, .5)) + vec2(-1,0), floor(pos.z)); hColPosL=hColPos.yz;posL=pos.yz;}
                    if(i==1) {hColPos = vec3(floor(pos.xy - vec2(-.3, .5)) + vec2(1,0), floor(pos.z));hColPosL=hColPos.yz;posL=pos.yz;}
                    if(i==2) {hColPos = vec3(floor(pos.xy - vec2(.5, .3)) + vec2(0,-1), floor(pos.z));hColPosL=hColPos.xz;posL=pos.xz;}
                    if(i==3) {hColPos = vec3(floor(pos.xy - vec2(.5, -.3)) + vec2(0,1), floor(pos.z));hColPosL=hColPos.xz;posL=pos.xz;}
                    solidL[i]=0.;
                    for(int j=0;j<6;j++){
                        
       
                        solidL[i ] += isSolidVoxel(true,hColPos - offset + vec3((i/2)*(j%2),(1-i/2)*(j%2),(j/2)+min(iFrame,0))) 
                            * horizontalPlayerCollide(hColPosL + vec2(0.5+float(j%2), 0.5+float(j/2)), posL, 1.8);
                    }
                
                    if(i==0 && solidL[i]>.5) minX = hColPos.x + 1.301;
                    if(i==1 && solidL[i]>.5) maxX = hColPos.x - .301;
                    if(i==2 && solidL[i]>.5) minY = hColPos.y + 1.301;
                    if(i==3 && solidL[i]>.5) maxY = hColPos.y - .301;
                }
                

                
                if (abs(pos.z - minHeight) < 0.01) flightMode.r = 0.; 
#else
                flightMode.rg=vec2(.3,1.);
                if(iFrame==0) pos.z=65.;
#endif
                
                if (bool(keySinglePress(KEY_JUMP))) {
                    if (flightMode.g > 0.) {
                        flightMode.r = 1.- flightMode.r;
                        sprintMode.r = 0.;
                    }
                    flightMode.g = 0.3;
                }
                flightMode.g = max(flightMode.g - dt, 0.);

                if (bool(keySinglePress(KEY_FORWARDS))) {
                    if (sprintMode.g > 0.) sprintMode.r = 1.;
                    sprintMode.g = 0.3;
                }
                if (!bool(keyDown(KEY_FORWARDS))) {
                    if (sprintMode.g <= 0.) sprintMode.r = 0.;
                }
                sprintMode.g = max(sprintMode.g - dt, 0.);

                vec3 stats =vec3(
                    bool(keyToggled(KEY_STATS))?1.:0.,
                    bool(keyToggled(KEY_DUMP1))?1.:0.,
                    bool(keyToggled(KEY_DUMP2))?1.:0.
                );
                 
                map = mod( map +keyPress(KEY_MAP),3.);
                inventory = floor(mod( inventory + keyPress(KEY_INVENTORY),3.));
                if(inventory<2.) selected=clamp(selected,0., NUM_ITEMS-1.);

                float loadDistLimit=80.;
                float rayLimit=500.; 
                if(bool(keyToggled(KEY_INCREASE_PERFORMANCE))){        
                    pixelSize=max(2.,pixelSize) ;
                    loadDistLimit=50.;
                    rayLimit=200.;
                }
                pixelSize=clamp( pixelSize  + keyPress(KEY_INCREASE_PIXELSIZE) - keyPress(KEY_DECREASE_PIXELSIZE)  ,1.,4.);


                if (bool(flightMode.r)) {
                    if (length(vel) > 0.) vel -= min(length(vel), 25. * dt) * normalize(vel);
                    vel += 50. * dt * dirFwd * sign(keyDown(KEY_FORWARDS)-keyDown(KEY_BACKWARDS)+keyDown(38)-keyDown(40));
                    vel += 50. * dt * dirRight * sign(keyDown(KEY_RIGHT)-keyDown(KEY_LEFT)+keyDown(39)-keyDown(37));
                    vel += 50. * dt * dirUp * sign(keyDown(KEY_JUMP) - keyDown(KEY_SNEAK));
                    if (length(vel) > 20.) vel = normalize(vel) * 20.;
                }
                else {
                    vel.xy *= max(0., (length(vel.xy) - 25. * dt) / length(vel.xy));
                    vel += 50. * dt * dirFwd * sign(keyDown(KEY_FORWARDS)-keyDown(KEY_BACKWARDS)+keyDown(38)-keyDown(40));
                    vel += 50. * dt * dirFwd * 0.4 * sprintMode.r;
                    vel += 50. * dt * dirRight * sign(keyDown(KEY_RIGHT)-keyDown(KEY_LEFT)+keyDown(39)-keyDown(37));
                    if (abs(pos.z - minHeight) < 0.01) {
                        vel.z = 9. * keyDown(32);
                    }
                    
                    else {
                        //voxel t;
                        //getCVoxel(pos -offset,t,0);
                        //bool isWater=(t.id ==12.);
                        vel.z -= 32. * dt;
                        vel.z = clamp(vel.z, -80., 30.);
                    }
					
                    if (length(vel.xy) > 4.317 * (1. + 0.4 * sprintMode.r)) vel.xy = normalize(vel.xy) * 4.317 * (1. + 0.4 * sprintMode.r);
                }


                pos += dt * vel; 
                if (pos.z < minHeight) {
                    pos.z = minHeight;
                    vel.z = 0.;
                }
                if (pos.z > maxHeight ) {
                    pos.z = maxHeight;
                    vel.z = 0.;
                }
                
                if (pos.x < minX) {
                    pos.x = minX;
                    vel.x = 0.;
                }
                if (pos.x > maxX) {
                    pos.x = maxX;
                    vel.x = 0.;
                }
                if (pos.y < minY) {
                    pos.y = minY;
                    vel.y = 0.;
                }
                if (pos.y > maxY) {
                    pos.y = maxY;
                    vel.y = 0.;
                }

                float timer = load(_old+_pickTimer).r;
                vec4 oldPick = load(_old+_pick);
                vec4 pick;
                float pickAction;
                           
                rayCastResults mousePointer = getMouseRay();
            
                bool dblClk =mouseDoubleClick();
                if(dblClk){
                    if (mousePointer.hit ) {
                        
                            pick.xyz = mousePointer.mapPos;
                            pick.a = 7.;
                  }                
                }
                
                if (iMouse.z > 0. ) {                    
                    
                    float h= (inventory>1.?NUM_ITEM_ROWS:1.);
                    float slot = mouseSelect(iMouse.xy,h);
                    if(slot>= 0. && inventory>0. ){
                        selected = slot;
                    }
                    else {	
                    
                    if (mousePointer.hit ) {
                        pick.xyz = mousePointer.mapPos;
                        if (bool(keyDown(KEY_DESTROY))) {
                            pick.a = 1.;
                            store1(_pick,pick.a);
                            timer += dt / 0.25;
                        }
                        else if (dblClk || bool(keySinglePress(KEY_PLACE))) {
                            pick.a = 2.;
                            pick.xyz += mousePointer.normal;                         
                        }
                        else if (bool(keySinglePress(KEY_SHAPE))) {
                            pick.a = 3.;
                        }
                        else if (bool(keySinglePress(KEY_ROTATE_Z))) {
                            pick.a = 4.;
                         }
                        else if (bool(keySinglePress(KEY_ROTATE_Y))) {
                            pick.a = 5.;
                        }
                         else if (bool(keyDown(KEY_MULTISELECT))) {
                            pick.a = 6.;
                             store1(_pick,pick.a);
                             timer += dt / 0.25;
                        }
                        if (oldPick != pick) timer = 0.;
                    }
                    else {
                        //pick = vec4(-1,-1,-1,0);
                        timer = 0.;
                    }
                }
                }
                else { 
                    
                    // NO MOUSE KEY PRESSED  
                    //pick = vec4(-1,-1,-1,0);
						if (bool(keyDown(KEY_DESTROY))) {
                            pick.a = 1.;
                            store1(_pick,pick.a);
                            timer += dt / 0.25;
                        }
                        else if (bool(keySinglePress(KEY_PLACE))) {
                            pick.a = 2.;
                        }
                        else if (bool(keySinglePress(KEY_SHAPE))) {
                            pick.a = 3.;
                         }
                        else if (bool(keySinglePress(KEY_ROTATE_Z))) {
                            pick.a = 4.;
                        }
                        else if (bool(keySinglePress(KEY_ROTATE_Y))) {
                            pick.a = 5.;
                        }
                        else if (bool(keyDown(KEY_MULTISELECT))) {
                            pick.a = 6.;
                             store1(_pick,pick.a);
                             timer += dt / 0.25;                   
                        }else timer = 0.;
                }


                renderScale = clamp(renderScale + keySinglePress(KEY_DECREASE_ZOOM) - keySinglePress(KEY_INCREASE_ZOOM), -5., 10.);
                time.g = clamp(time.g + keySinglePress(KEY_INCREASE_TIME_SCALE) - keyPress(KEY_DECREASE_TIME_SCALE), 0., 8.);
                time.r = mod(time.r + dt * sign(time.g) * pow(2., time.g - 1.), 1200.);

                bool still= length(pos-oldPos)<0.01 && length(angle -load(_angle).xy )<0.01  &&  iMouse.z<1.;
                rayDistMax= rayLimit;/*clamp(rayDistMax  
                                  +(still?10.:0.) 
                                  - ((iTimeDelta>0.03 && !still)?5.:0.)
                                  -((iTimeDelta>0.1)?1.:0.) 
                                  -((iTimeDelta>0.1  && !still)?50.:0.) 
                                  + ((iTimeDelta<0.03 && still)?20.:0.)
                                  ,loadDistLimit*2.5,rayLimit);*/


                store3(_pos, pos);
                store2(_angle, angle);
                store4(_loadRange_B,calcLoadRange_B(pos.xy,0.));
#if SURFACE_CACHE>0
                store4(_loadRange_C,calcLoadRange_C(pos.xy,0.));
#endif
                store4(_mouse, mouse);
                //store1(_inBlock, inBlock);
                store3(_vel, vel);
                store4(_pick, pick);
                store1(_pickTimer, timer);
                store1(_renderScale, renderScale);
                store1(_selectedInventory, selected);
                store2(_flightMode, flightMode);
                store2(_sprintMode, sprintMode);
                store2(_time, time);
                store3(_stats, stats);
                store1(_rayDistMax, rayDistMax);
                store1(_loadDistLimit, loadDistLimit);
                store1(_rayLimit, rayLimit);
                store1(_map,map);
                store1(_pixelSize,1.);
                store1(_inventory,inventory);
                store1(_demo,demo);
               


                fragColor = outValue;
            }
        }  
        else fragColor = texture(iChannel0, (fragCoord - _old) / iChannelResolution[0].xy);
    }
    else setTexture(fragColor,fragCoord);
}



`;

const fragment = `
// Fork of "Voxel Game Evolution" by kastorp. https://shadertoy.com/view/wsByWV
// 2020-07-07 07:20:30

/*---------------------------------------------------------
	THIS SHADER IS BASED ON  "[SH16C] Voxel Game" by fb39ca4  
  	

CONTROLS:
    drag mouse to move view 
    WASD or arrows to move
    Space to jump
    Double-tap space to start flying, use space and shift to go up and down.

	O,P to decrease/increase speed of day/night cycles   
    k,L to decrease/increase pixel sizes 
	T to teleport to a random location
    Page Up/Down to increase or decrease zoom 


//-----------------------------------------------------*/

vec2 max24(vec2 a, vec2 b, vec2 c, vec2 d) {
	return max(max(a, b), max(c, d));   
}

float lightLevelCurve(float t) {
    t = mod(t, 1200.);
	return 1. - ( smoothstep(400., 700., t) - smoothstep(900., 1200., t));
}

vec3 lightmap(in vec2 light) {
    light = 15. - light;
	//if(load(_torch).r>0.5) light.t=13.;
    
    return clamp(mix(vec3(0), mix(vec3(0.11, 0.11, 0.21), vec3(1), lightLevelCurve(load(_time).r)), pow(.8, light.s)) + mix(vec3(0), vec3(1.3, 1.15, 1), pow(.75, light.t)), 0., 1.);   

}

float vertexAo(float side1, float side2, float corner) {
	return 1. - (side1 + side2 + max(corner, side1 * side2)) / 5.0;
}

float opaque(float id) {
	//return id > .5 ? 1. : 0.;
    return  id != 0. && id!= 12. && id!= 26. ? 1. :0.;
}

vec3 calcOcclusion(vec3 r,vec3 n, vec2 uv,voxel vox) {
#ifndef OCCLUSION
    return vec3(vox.light , .75);
#else    
 	//tangents:
    vec3 s = vec3(step(.1,abs(n.y)), 1.- step( .1, abs(n.y)) ,0.                  );
    vec3 t = vec3(step(.1,abs(n.z)), 0.                   ,1.- step(.1,abs(n.z)  ));
    
   //neightbours vector
   //v[0],v[1],v[2]
   //v[3],v[4],v[5]
   //v[6],v[7],v[8]
   voxel v[9]; 
   
   for (int i =-1; i <=1; i++) {
        for (int j =-1; j <=1  ; j++) {            
             getVoxel(r +n + s* float(i)+t*float(j),v[4+ i+3*j +min(iFrame,0) ] ,3 );                     	
        }
    }
      
    float aom, ao[4];
    vec2 lightm,light[4];
    for(int i=0;i<=3;i++){
        
        ivec4 ids;
        if(i==0) ids=ivec4(6,7,3,4);
        if(i==1) ids=ivec4(7,8,4,5);
        if(i==2) ids=ivec4(3,4,0,1);
        if(i==3) ids=ivec4(4,5,1,2);
    	light[i +min(iFrame,0)] =max24(v[ids.x].light, v[ids.y].light, v[ids.z].light, v[ids.w].light);
    }
    lightm = mix(mix(light[2], light[3], uv.x), mix(light[0], light[1], uv.x), uv.y);
    
    for(int i=0;i<=3 ;i++){

        ivec3 ids;
        if(i==0) ids=ivec3(7,3,6);
        if(i==1) ids=ivec3(7,5,8);
        if(i==2) ids=ivec3(1,3,0);          
        if(i==3) ids=ivec3(1,5,2);;
        ao[i] = vertexAo(opaque(v[ids.x].id), opaque(v[ids.y].id), opaque(v[ids.z].id));
    }
    aom = mix(mix(ao[2], ao[3], uv.x), mix(ao[0], ao[1], uv.x), uv.y);
   if(opaque(v[4].id)>0.) {aom*=0.75;}  
    
     
    return vec3(lightm , aom);
#endif    

}

// RENDERING

vec3 rayDirection(vec2 angle, vec2 uv, vec2 renderResolution){
    vec3 cameraDir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
    vec3 cameraPlaneU = vec3(normalize(vec2(cameraDir.y, -cameraDir.x)), 0);
    vec3 cameraPlaneV = cross(cameraPlaneU, cameraDir) * renderResolution.y / renderResolution.x;
	return normalize(cameraDir + uv.x * cameraPlaneU + uv.y * cameraPlaneV);

}

struct rayCastResults {
	bool hit;
    vec3 rayPos;
    vec3 mapPos;
    vec3 normal;
    vec2 uv;
#ifdef SUBTEXTURE  
    vec2 uv_txt;
#endif    
    float dist;
    voxel vox;
    float water;
    float fog;
    bool grass;
    bool mirror;
    vec3 color;
    float fresnel;

};
mat3 rotate(float theta,int axis) {
    float c = cos(theta);
    float s = sin(theta);

    if (axis==1) return mat3(
        vec3(1, 0, 0),
        vec3(0, c, s),
        vec3(0, -s, c)
    );
    if (axis==2) return mat3(
        vec3(c, 0, s),
        vec3(0, 1, 0),
        vec3(-s, 0, c)
    );
    return mat3(
        vec3(c, s, 0),
        vec3(-s, c, 0),
        vec3(0, 0, 1)
    );
}

//From https://github.com/hughsk/glsl-hsv2rgb
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 sun(){
    float t = load(_time).r;
    float sunAngle = (t * PI * 2. / 1200.) + PI / 4.;
    const float risingAngle=PI/6.;
    return  vec4(cos(sunAngle)*sin(risingAngle), cos(sunAngle)*cos(risingAngle), sin(sunAngle),lightLevelCurve(t));
}

#ifdef CLOUDS 
float fogDensity(vec3 p) {

	float density = 2. - abs(p.z - 80.)*1.7;
    //density += mix(0., 40., pow(.5 + .5 * snoise(p.xy /557. + vec2(0.576, .492)), 2.)) * snoise(p / 31.51 + vec3(0.981, .245, .497));
    density += mix(0., 30., pow(.2 + 1.5 * snoise((p.xy +iTime)/207. + vec2(0.576 +iTime/200., .492)), 2.)) * snoise((p +iTime) / 30.99 + vec3(0.981, .245, .497 +iTime/2000.));

     return clamp(density ,0.,50.);

}
void applyFog( inout vec3  rgb,       // original color of the pixel
               in float distance ) // camera to point distance
{
    
    float fogAmount = 1.0 - exp( -distance*0.015 );
    vec3  fogColor  = vec3(0.5,0.6,0.7)*clamp(sun().w,.1,1.);
    rgb= mix( rgb, fogColor, fogAmount );
}
#endif

//-------------

float noise(in vec2 p) {
	vec2 F = floor(p), f = fract(p);
	f = f * f * (3. - 2. * f);
	return mix(
		mix(hash2(F), 			 hash2(F+vec2(1.,0.)), f.x),
		mix(hash2(F+vec2(0.,1.)), hash2(F+vec2(1.)),	  f.x), f.y);
}

//GRASS ADAPTED FROM POLYANKA by W23
#ifdef GRASS_DETAIL
const int c_grassmarch_steps = 48;
const float c_gscale = 37.;
const float c_gheight = 0.4;
//const float c_rgslope = 2. / (c_gscale * c_gheight);


vec2 noise2(in vec2 p) {
	vec2 F = floor(p), f = fract(p);
	f = f * f * (3. - 2. * f);
	return mix(
		mix(hash22(F), 			  hash22(F+vec2(1.,0.)), f.x),
		mix(hash22(F+vec2(0.,1.)), hash22(F+vec2(1.)),	f.x), f.y);
}

float fnoise(in vec2 p) {
	return .5 * noise(p) + .25 * noise(p*2.03) + .125 * noise(p*3.99);
}

vec2 wind_displacement(in vec2 p) {
	return noise2(p*.1+iTime)/100. - 0.005;
}

float grass_height(in vec3 p,float gheight) {
	float base_h= 0.15;
	float depth = 1. - (base_h - p.z) / gheight;
	vec2 gpos = (p.xy  + depth * wind_displacement(p.xy));
	return base_h - noise(gpos * c_gscale) * gheight;
}


struct xs_t {
    bool hit;
	vec3 pos; 
	float occlusion;
    float dist;
};


xs_t trace_grass(vec3 o, vec3 d,vec3 mapPos,float gheight) {
    bool hit=false;
	float L = .005;
    //float Lmax= 1.8;
	for (int i = 0; i < c_grassmarch_steps; ++i) {
		vec3 pos = o + d * L ;
		float h = grass_height(pos +mod(mapPos,10.),gheight);
		float dh = pos.z - h;
        if (dh < .005) {hit=true; break;}
		L += dh * 2. / (c_gscale * gheight);
        vec3  dist = abs(pos-.5);
        //if (L > Lmax) break;
		if (max(dist.z, max(dist.x,dist.y))>.5) break;
	}
	vec3 pos = o + d * L;
	float occlusion = 1. - 2.*(0. - pos.z) / gheight;
	return xs_t(hit, pos + mod(mapPos,99.),  (hit)?1.:min(1.,occlusion),L);
}

vec3 shade_grass(in xs_t xs) {
    
	vec2 typepos = xs.pos.xy + wind_displacement(xs.pos.xy);
	float typemask1 = fnoise(2.5*typepos);
	float typemask2 = pow(fnoise(.4*typepos), 3.);
	float typemask3 = step(.71,fnoise(.8*typepos));
	vec3 col1 = vec3( 106./255., 170./255.,  64./255.);
	vec3 col2 = vec3(.7, .73, .3)*.3;
	vec3 col3 = vec3(1., 1., .1);
	vec3 col4 = vec3(1., .4, .7);
	vec3 color = mix(mix(mix(col1, col2, typemask1),
			col3, typemask2), col4, typemask3) *.8;
	color *= xs.occlusion;
	return color;
}	
#endif

#define BUMPFACTOR 0.3
#define EPSILON 0.1

float waterHeightMap( vec2 pos ) {
    return 0.9+.2*noise(pos +iTime/3.);
    //better but requires more compilation time
    //return 0.9+.1*snoise(vec3(pos,iTime/3.));
}

float fresnelR(vec3 d, vec3 n)
{
    //float a = clamp(1.0-dot(n,-d), 0.0, 1.0);   
   // return clamp(exp((5.0*a)-5.0), 0.0, 1.0);
    return pow( clamp( 1.0 + dot(d,n), 0.0, 1.0 ), 5.0 );
}
//------------------------*/
vec4 VoxelHitPos(vec3 pos, vec3 ro, vec3 rd){
    vec3 ri = 1.0/rd;
	vec3 rs = sign(rd);
    vec3 mini = (pos-ro + 0.5 - 0.5*vec3(rs))*ri;
    float t=  max ( mini.x, max ( mini.y, mini.z ) );
    return vec4(t*rd+ro,t);
}

#ifdef SUBVOXEL
rayCastResults raySubCast(vec3 rayPosOrig, vec3 rayDir, int shape,float rotation,vec3 seed){
 
	rayCastResults  res;
    
    
    vec3 c=vec3(.5);
    float theta1= PI/2.*floor(mod(rotation,4.));
    rayPosOrig = rotate( theta1,3) *(rayPosOrig-c) +c;
    rayDir= rotate( theta1,3)*rayDir; 
    float theta2= PI/2.*(floor(rotation/4.));
    rayPosOrig = rotate( theta2,2) *(rayPosOrig-c)+c;
    rayDir= rotate( theta2,2)*rayDir; 
       
     vec3 ro = (rayPosOrig) *N_SUBVOXEL;
   
	//if(abs(ro.x -N/2.)>N/2. ||abs(ro.y -N/2.)>N/2. ||abs(ro.y -N/2.)>N/2.)return vec4(0.,0.,0.,1.);
       
	vec3 ri = 1.0/rayDir;
	vec3 rs = sign(rayDir);
    vec3 pos = floor(ro-rayDir*0.002);
	vec3 dis = (pos-ro + 0.5 + rs*0.5) * ri;
	
	res.hit=false;
	vec3 mm = vec3(0.);
    float t=0.;
       
	for( int i=0; i<int(N_SUBVOXEL)*3; i++ ) 
    {	
		if(i>=0){
       	 mm = step(dis.xyz, dis.yzx) * step(dis.xyz, dis.zxy);           
        }
         dis += mm * rs * ri;
         pos += mm * rs;
        
        //if( sdBox( ro+t*rayDir-vec3(N_SUBVOXEL/2.),vec3(N_SUBVOXEL/2.) )>.05) {res.hit=false; break;}
        
        //float timestep= floor(mod(iTime,N_SUBVOXEL));
        //SHAPES
       
        //SINGLE BLOCK
        //if( sdBox( pos-vec3(x,x,x) +rs*0.001 ,vec3(.5,.5,.5) )<.01) {res.hit=true; break;}
     

        if(shape==1){// POLE
        	if( sdBox( pos-vec3(2.,2.,2.) ,vec3(.5,.5,2.5) )<.001) {res.hit=true; break;}
	      
        }else if(shape==2){//STEP 1
            if(sdBox( pos-vec3(2.,2.,0.)  ,vec3(2.5,2.5,0.5) )<.001) {res.hit=true; break;}
          
        }else if(shape==3){//STEP 2
             if( sdBox( pos-vec3(2.,2.,0.) ,vec3(2.5,2.5,1.5) )<.001) {res.hit=true; break;}
           
        }else if(shape==4){//FENCE 1
         	if( sdBox( pos-vec3(2.,2.,2.)  ,vec3(.5,.5,2.5) )<.001) {res.hit=true; break;}
          	if( sdBox( pos-vec3(2.,2.,4.)  ,vec3(.5,2.5,.5) )<.001) {res.hit=true; break;}
          
        }else if(shape==5){//FENCE 2
        	if( sdBox( pos-vec3(2.,2.,2.) ,vec3(.5,.5,2.5) )<.001) {res.hit=true; break;}
          	if( sdBox( pos-vec3(1.,2.,4.)  ,vec3(1.5,.5,.5) )<.001) {res.hit=true; break;}
          	if( sdBox( pos-vec3(2.,1.,4.)  ,vec3(.5,1.5,.5) )<.001) {res.hit=true;break;}

        }else if(shape==6){//SLOPE 1
            if( dot(pos,  vec3(0.,sqrt(2.),sqrt(2.))) -6. <0.001 
            && sdBox( pos-vec3(2.,2.,2.),vec3(2.5,2.5,2.5) )<.001  ) {res.hit=true; break;}
            
        }else if(shape==7){//PANEL
            if(sdBox( pos-vec3(0.,2.,2.)  ,vec3(.5,2.5,2.5) )<.001) {res.hit=true; break;}
            
        }
#ifdef TREE_DETAIL        
        else if(shape==8){//TREE W LEAFS
            
     		if( sdCross( pos-vec3(2.,2.,2.)  ,vec3(.5,.5,1.5) )<.001) {res.hit=true; res.vox.id=10.; break;}
            vec3 applePos= vec3(1.,1.,1.);//floor(hash33(seed)*5.);
            if( sdBox( pos-applePos  ,vec3(.5,.5,.5) )<.01 // && hash13(seed)<.95 
                 ){res.hit=true; res.vox.id=14.; break;}

            if( sdBox( pos-vec3(2.,2.,2.)  ,vec3(2.5,2.5,2.5) )<.001 && hash13(floor(pos)+seed+.5 )  >.75){res.hit=true; res.vox.id=11.; break;}
    
            //
        }else if(shape==9){//TRUNK
			vec3 p=pos-vec3(2.,2.,2.);
            //p= vec3(abs(p.x)+abs(p.y),max(p.x,p.y),p.z);
            if(sdBox( p ,vec3(1.5,1.5,2.5) )<.001){res.hit=true; res.vox.id=10.; break;}
         
        }
#endif        
	}
	
	
    if(res.hit){
        res.normal = - mm*rs; 
        vec4 hitPos=VoxelHitPos(pos,ro,rayDir);
        res.dist=hitPos.a/N_SUBVOXEL;
        vec3 xyz = hitPos.xyz - pos;
        res.uv = vec2( dot(mm.yzx, xyz), dot(mm.zxy, xyz) );
        if(abs(mm.x)>0.) res.uv=res.uv.yx; //invert xz 
        //relative to absolute normals:
   		res.normal  = rotate( -theta2,2) * rotate(- theta1,3) *res.normal;
    }
    return res;  
}
#endif

rayCastResults rayCast(vec3 rayPos0, vec3 rayDir,int maxRayDist,vec4 range,int rayType) {
	   
    voxel vox;
    vox.id=0.;
    float waterDist=0.;
    float fog=0.; 
    rayCastResults res;
    res.hit = false;
    res.color=vec3(-1.);
    res.fresnel=0.;
    res.mirror=false;
    rayCastResults subRes;
    subRes.hit=false;

    vec3 raySign= sign(rayDir);
    vec3 rayInv = 1./rayDir;
	vec3 rayPos=rayPos0;
    
    vec3 mapPos=floor(rayPos);
    if ( rayPos.z >= heightLimit_B && rayDir.z<0.){
       
        //MAP RAY FROM ABOVE
        float nstep= (rayPos.z - heightLimit_B)*rayInv.z;
        mapPos = floor(rayPos-rayDir *nstep+ raySign*0.001);
    }
    vec3 sideDist = (mapPos-rayPos + 0.5 + sign(rayDir)*0.5) *rayInv;
    vec3 mask=vec3(0.); 

    
    //vec3 offset = floor(vec3(load(_pos).xy, 0.));
    voxel currentVoxel;
    getCVoxel( mapPos,currentVoxel,3);
	vec3 hitWater = (currentVoxel.id==12.? rayPos: vec3(0.));
	bool xRay=(currentVoxel.id!=0. && currentVoxel.id!=12.);
        
    for (int i = 0; i < 1000; i++) {

        if(i>0){
       		mask = step(sideDist.xyz, sideDist.yzx) * step(sideDist.xyz, sideDist.zxy);

        }
		sideDist += mask *  raySign *rayInv;
        mapPos += mask *  raySign;
        
        if ( mapPos.z < 0. ) break;
        if ( mapPos.z >= heightLimit_B && rayDir.z > 0.)  break;
                   
        getVoxel( mapPos, vox ,3 );
        
        //GRASS
#ifdef  GRASS_DETAIL      
        if(vox.id==0. && vox.life>0. && rayType==1 ){
			vec4 vd =VoxelHitPos(mapPos,rayPos,rayDir);
            res.rayPos= vd.xyz;
            res.dist=vd.a;
    		vec3 relativePos = res.rayPos -mapPos;
            
            float grass = c_gheight*vox.life;
           	xs_t xs = trace_grass(relativePos,rayDir,mapPos,grass);
            
            if (xs.hit ) {
                
                //color = mix(color, c_skycolor, smoothstep(c_maxdist*.35, c_maxdist, xs.l));
            	res.hit = true;                
                res.vox=vox;
                res.grass=true;
                res.color=shade_grass(xs);
                res.mapPos = mapPos;
                res.water =waterDist;
    			res.fog=fog;
                res.normal = vec3(0,0,1);
                res.dist+=  xs.dist ;
    			res.rayPos += rayDir * xs.dist ;
                return res;
            } 
	
        }
#endif        
       
#ifdef SUBVOXEL        
        if(vox.shape!=0 && vox.id!=0. ){ 
            //SUB VOXEL

    		vec3 hitVoxelPos = VoxelHitPos(mapPos,rayPos,rayDir).xyz;
            
            if( sdBox( mapPos+vec3(.5) -rayPos,vec3(.5,.5,.5) )<.001) hitVoxelPos=rayPos;
            float rotation= vox.rotation;
            
             subRes = raySubCast( hitVoxelPos - mapPos ,  rayDir, vox.shape,rotation,mapPos);
            if(subRes.hit && vox.id!=12.) { 		
       		 	res.hit = true; 
                if(subRes.vox.id!=0.) vox.id=subRes.vox.id;             
                break;
            }
            else if(vox.id==12. && subRes.hit && rayType!=3) { 
            	//nothing to do
            }
            else {vox.id=0.;res.hit = false;}
        }
#endif        
        if(vox.id==14. &&rayType!=3){ //&& length(rayPos-mapPos -vec3(0.,0.,1.))<=6.){
            //MIRROR 
                
            vec3 endRayPos = VoxelHitPos(mapPos,rayPos,rayDir).xyz;
            rayDir*= (vec3(1.) - 2.* mask); 				
            rayDir=normalize(rayDir);rayInv=1./rayDir;raySign= sign(rayDir);

            sideDist = (mapPos-endRayPos + 0.5 + raySign*0.5) /rayDir;
            vox.id=0.;
            res.mirror=true;
            rayPos=endRayPos;
            continue;
        }
        if(vox.id==12.  ){ //vox.life < WATER && vox.life>0.){
        	//ENTERING WATER
            if(hitWater.z<1.) {
                
                // deviate ray xy if intercept water NOT EXACT                
    			vec3 endRayPos = VoxelHitPos(mapPos,rayPos,rayDir).xyz;
                vec3 n=mask;
                if(subRes.hit) {
                    	endRayPos+=rayDir * subRes.dist;                    	
                        n=subRes.normal;
                }
     			hitWater=endRayPos;

                if(abs(n.z)>0.) {
                    vec2 coord = hitWater.xy;
                    vec2 dx = vec2( EPSILON, 0. );
                    vec2 dy = vec2( 0., EPSILON );
                    float bumpfactor = BUMPFACTOR ;//* (1. - smoothstep( 0., BUMPDISTANCE, dist) );

                    vec3 normal = vec3( 0., 0., 1. );
                    normal.x = -bumpfactor * (waterHeightMap(coord + dx) - waterHeightMap(coord-dx) ) / (2. * EPSILON);
                    normal.y = -bumpfactor * (waterHeightMap(coord + dy) - waterHeightMap(coord-dy) ) / (2. * EPSILON);
                    normal = normalize( normal );
                   
                    vec3 rayDirOld=rayDir;
                    
                    res.fresnel=fresnelR(rayDir, normal);
    				
                    
                    rayDir = refract( rayDir, normal ,1.3);
                    if(res.fresnel>.005){
                        rayDir = reflect( rayDirOld, normal );
                        hitWater=vec3(0.,0.,-1.);
                    }
                }else if(abs(n.x)>0.) rayDir.yz*=(0.7+.4*noise(endRayPos.yz+iTime));
                else  rayDir.xz*=(0.7+.4*noise(endRayPos.xz+iTime));
                rayDir=normalize(rayDir);rayInv=1./rayDir;raySign=sign(rayDir);

                rayPos=endRayPos;
                sideDist = (mapPos-endRayPos + 0.5 + raySign*0.5) /rayDir;
                               
            }
            subRes.hit=false;
            //vox.id=0.;
            continue;
        }
        if( vox.id !=0. && vox.id!=26. && vox.id!=12. ){
        	if(xRay) continue;
            else{
            	res.hit = true; 
                break;
            }
        } 

#ifdef CLOUDS         
        //FOG & CLOUDS
        if(CLOUDS>0.) {
        	float fogd= fogDensity(mapPos)/4.*CLOUDS;
        	if(fogd >4. && rayType!=2) break;        
        	fog += fogd;
        }
#endif        
        //NO HIT
        xRay=false; 
        if(hitWater.z>0. && vox.id==0.)  {waterDist +=length(hitWater-mapPos); hitWater=vec3(-1.);res.fresnel=.001;}
        
        if(!inRange(mapPos.xy, range) && i> maxRayDist) break;

        if(i > int( load(_rayLimit).r)) break;
	}
    if(hitWater.z>0.)  waterDist +=length(hitWater-mapPos);
    if(hitWater.z<0.)  waterDist =0.;   //reflection
    
    
    if(load(_stats).r>0.5){
    	vec4 range_B= calcLoadRange_B(rayPos.xy,1.);
        if(res.hit && inRange(mapPos.xy, range)  && !inRange(mapPos.xy, range_B)) vox.id = 8.;    


#if SURFACE_CACHE>0        
        vec4 range_C1= calcLoadRange_C(rayPos.xy,1.);
		vec4 range_C0 = load(_old+_loadRange_C);
        if(res.hit && inRange(mapPos.xy, range_C0)  && !inRange(mapPos.xy, range_C1)) vox.id = 17.;    
#endif
    }
        
    if(!res.hit  &&rayDir.z < 0. && !inRange(mapPos.xy, range)){
        if(mapPos.z>55.) {vox.id = 0.; res.hit=false;}
        else { vox.id=3.; res.hit = true;}
    }
    
    res.mapPos = mapPos;
    res.normal = res.hit? -raySign * mask:vec3(0.);
    res.rayPos = VoxelHitPos(mapPos,rayPos,rayDir).xyz;
    res.dist = length(rayPos0 - res.rayPos);
    res.vox=vox;
    res.water =waterDist;
    res.fog=fog;
    
    if(subRes.hit){
        
       	res.normal=  subRes.normal; 
      	mask=abs(subRes.normal);
        res.rayPos += rayDir * subRes.dist ;
        res.dist = length(rayPos - res.rayPos);
        
#ifdef SUBTEXTURE
        // uv coordinates are relative to subvoxel (more detailed but aliased)
    	res.uv_txt = subRes.uv ;
    	//return res;
#endif
    }
    
    //uv coordinates are relative to block (also with subvoxels)                       
    if (abs(mask.x) > 0.) {
        res.uv = fract(res.rayPos.yz);
    }
    else if (abs(mask.y) > 0.) {
        res.uv = fract(res.rayPos.xz);
    }
    else {
        res.uv = fract(res.rayPos.yx);
    }  
    if(res.hit && !res.grass){
        float textureId = res.vox.id;
        if (textureId == 3.) textureId += res.normal.z;
        vec2 uv_txt= res.uv;
#ifdef SUBTEXTURE                
        if(res.vox.shape!=0) uv_txt= res.uv_txt;
#endif               
        res.color = getTexture(textureId, uv_txt).rgb;
    
    }   
    return res;
}


vec3 skyColor(vec3 rayDir) {
    
    vec4 s= sun();
    float lightLevel = s.w;

    vec3 sunDir=s.xyz;
    vec3 daySkyColor = vec3(.5,.75,1);
    vec3 dayHorizonColor = vec3(0.8,0.8,0.9);
    vec3 nightSkyColor = vec3(0.1,0.1,0.2) / 2.;
    
    vec3 skyColor = mix(nightSkyColor, daySkyColor, lightLevel);
    vec3 horizonColor = mix(nightSkyColor, dayHorizonColor, lightLevel);
    float sunVis = smoothstep(.99, 0.995, dot(sunDir, rayDir));
    float moonVis = smoothstep(.999, 0.9995, dot(-sunDir, rayDir));
    return mix(mix(mix(horizonColor, skyColor, clamp(dot(rayDir, vec3(0,0,1)), 0., 1.)), vec3(1,1,0.95), sunVis), vec3(0.8), moonVis);
    
}



// ---- 8< -------- 8< -------- 8< -------- 8< ----


void render( out vec4 fragColor, vec3 rayPos, vec3 rayDir ,int  maxRayDist, int rayType) {

    vec4 range_B = load(_old+_loadRange_B);
    vec3 sunDir = sun().xyz; sunDir *= sign(sunDir.z);
      
    rayCastResults rays[2] ;//0=view,1 =shadow
    vec3 ro=rayPos;
    vec3 rd=rayDir;
    int rt=rayType;
    for(int i=0; i<=1;i++){
    	rays[i]=rayCast(ro, rd,maxRayDist,range_B,rt);
		if(!rays[i].hit) break;
 		if(SHADOW<0.) break;
        ro=rays[i].rayPos +rays[i].normal*0.01;
        rd=sunDir;
        maxRayDist=  25;//inRange(rays[i].rayPos.xy, range_B) ? 25:5;
        rt=3;
            
    }
    
   rayCastResults res = rays[0];
	
	vec3 color = vec3(0.);
    
    if (res.hit) {
        
			
        float shadow =rays[1].hit?SHADOW:0.;

        color=res.color;


        if(rayType==1 ){
            bool hB=(res.vox.ground>=MAX_GROUND && res.vox.id!=0. &&res.vox.buffer==BUFFER_B)  
                   || (res.vox.id==17. && res.vox.life >0.) ;        
                             
            if(hB && HIGHLIGHT>0. ){              
                color  *=(fract(iTime*4.)+.5);
            }
            
            if(res.grass) {              
            	color *= lightmap( vec2(res.vox.light.s*(1.-shadow*.2),res.vox.light.t)   );                 
            }else{
              vec3 occ=calcOcclusion(res.mapPos, res.normal, res.uv,res.vox);
                color *= lightmap(vec2(occ.x*(1.-shadow*.2),occ.y)) *occ.z; 
            }
			
            // SELECTION AND MOUSE OVER
            vec4 pick = load(_pick);
            if (res.mapPos == pick.xyz || res.vox.value==2) {
                if (pick.a == 1.) color *= getTexture(32., res.uv).r;
                else if (res.vox.value==2) color = mix(color, vec3(1.,0.,0.), 0.5);
                
                else color = mix(color, vec3(1), 0.2);
            }
        }else
        {	
            //MAP
 			 color *=  clamp( (res.mapPos.z-30.) /30.,0.,1.);
            color = mix(color, vec3(1), 0.2);
          
        }
        
    }
     else color = skyColor(rayDir);
    
    vec3 wcolor= vec3(.03,.1,.60)* lightmap( vec2(res.vox.light.s,res.vox.light.t)   );
    //if(res.water>0.) color *= pow( wcolor ,vec3(sqrt(res.water)/(7. + res.fresnel*1000.)));
    if(res.water>0.) {
        color *= pow( wcolor ,vec3(sqrt(res.water)/7.));
        color = mix(color,wcolor, clamp(res.fresnel*500.,0.3,1.));
    }
    else if(res.fresnel>0. ) color =mix(wcolor ,color,clamp(res.fresnel*4.,0.,.9));
    if(res.mirror) color *= vec3(.9,.5,.5);
    if(rayType==1) {
#ifdef CLOUDS        
        applyFog(color.rgb,res.fog);
#endif
        color = pow( color, vec3(0.9) );
             
    }
    fragColor.rgb = color; //pow(color, vec3(1.));
    
    if(rayType==3 ) {
        
        float encodeNormal=14.+ res.normal.x + res.normal.y*3. + res.normal.z*9.;
        fragColor=vec4(res.mapPos,(res.hit && res.dist >1. && res.dist <MAX_PICK_DISTANCE ? encodeNormal:0.));
    }  
     
    //DEBUG:
    //fragColor=vec4( vec2(1.- res.dist /50.),  res.hit?1.:0.,1.);
    //fragColor=vec4( (1.-.5* sign(res.normal))* abs(res.normal) ,1.);
    //fragColor=vec4( res.uv,max(abs(res.uv -.5).x,abs(res.uv-.5).y)<.5?1:0 ,1.);
    //if(res.vox.id==12.) fragColor=vec4(vec2(res.vox.life<2. ? .5:0.),1.- res.vox.life/255.,1.);
}


#define NB 8
float[] 
    camx = float[]   (2954. , 2952. , 2972. , 2972.,2971. ,2955. ,2955. ,2954.),
	camy = float[]   (10139., 10140., 10151.,10151.,10152.,10151.,10153.,10139.),
	camz = float[]   (71.   , 83.   , 48.   ,34.   ,50.   ,50.   ,71.   ,71.),
    lookx = float[]  (2970. ,2972.  , 2972. ,2952. ,2955. ,2955. ,2954. ,2970.),
	looky = float[]  (10152.,10153. , 10154.,10133.,10151.,10150.,10139.,10152.),
	lookz = float[]  (55.   , 50.   , 34.   ,27.   ,50.   ,71.   ,71.   ,55.); 
 

mat3 LookAt(in vec3 ro, in vec3 up){
    vec3 fw=normalize(ro),
    	 rt=normalize(cross(fw,up));
    return mat3(rt, cross(rt,fw),fw);
}

vec3 RD(in vec3 ro, in vec3 cp, vec2 uv, vec2 res) {
    return LookAt(cp-ro, vec3(0,0,1))*normalize(vec3((2.*uv-res.xy)/res.y, 3.5));
}

void getCam(in vec2 uv, in vec2 res, in float time, out vec3 ro, out vec3 rd) {
       
	vec2 q = uv/res;
    
    float t = .16* time,
		 kt = smoothstep(0.,1.,fract(t));

    // - Interpolate positions  and direction
    int  i0 = int(t)%NB, i1 = i0+1;
    
    vec3 cp = mix(vec3(lookx[i0],looky[i0],lookz[i0]), vec3(lookx[i1],looky[i1],lookz[i1]), kt); 
  
    ro = mix(vec3(camx[i0],camy[i0],camz[i0]), vec3(camx[i1],camy[i1],camz[i1]), kt),
    ro += vec3(.01*cos(2.*time), .01*cos(time),0.);
    rd = RD(ro, cp, uv, res);
}

void mainImage_D( out vec4 fragColor, in vec2 fragCoord ) {
 
    float pixelSize = load(_pixelSize).r;
    vec2 renderResolution = ceil(iResolution.xy / pixelSize); 
    if (any(greaterThan(fragCoord, renderResolution))) {
        fragColor = vec4(0);
        return;
    }
        
    vec3 cameraPos;    
    vec3 cameraDir;
    int  rayType = 1;
 
#ifdef MAP    
    float MAP_SIZE= iResolution.y/8./pixelSize; 
    vec2 MapCenter=vec2(iResolution.x/pixelSize -MAP_SIZE , iResolution.y/pixelSize - MAP_SIZE);
    if(abs(load(_map).r-1.) <.1 && distance(fragCoord,MapCenter)<MAP_SIZE) rayType=2;
    if(abs(load(_map).r-2.) <.1) {
        rayType=2;
        MapCenter=vec2(iResolution.x/pixelSize/2. , iResolution.y/pixelSize/2.);
    }
    
#endif    
    
    if(max(fragCoord.x,fragCoord.y)<1. ) rayType=3;
    if(rayType==3){
        //MOUSE RAY
        float zoom = pow(10., load(_renderScale).r/10.);///pixelSize;
        vec2 renderResolution = iResolution.xy *zoom; 
        vec2 renderCenter=vec2(0.5);
        vec2 uv = (iMouse.xy- renderCenter) / renderResolution - (renderCenter/zoom);//  /pixelSize;
         cameraPos = load(_pos).xyz + vec3(0,0,1.6);    
         cameraDir = rayDirection(load(_angle).xy,uv,renderResolution);
  
    } 
#ifdef MAP 
    else if(rayType==2){
     
        // MAP CAMERA
        float cameraHeight =1500.;
        float zoom = cameraHeight/iResolution.x/pixelSize*(load(_map).r>1.5?1.6:.4);
        vec2 renderResolution = iResolution.xy *zoom; 
        vec2 renderCenter=MapCenter/iResolution.xy*pixelSize;
        vec2 uv = (fragCoord.xy- renderCenter) / renderResolution - (renderCenter/zoom/pixelSize);    
        vec2 angle = vec2(0.,PI);
        if(load(_map).r>1.5){
        	angle=iMouse.xy/iResolution.xy*vec2(PI,-PI/3.)+vec2(0,PI);
        }
        cameraDir = rayDirection(angle,uv,renderResolution); 
        vec3 cameraCenterDir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
        cameraPos = load(_pos).xyz -cameraCenterDir* cameraHeight;
    }       
#endif            
    else if(rayType==1) 
    {    
        // MAIN CAMERA
        float zoom = pow(10., load(_renderScale).r/10.)/pixelSize;
        vec2 renderResolution = iResolution.xy *zoom; 
        vec2 renderCenter=vec2(0.5);
        vec2 uv = (fragCoord.xy- renderCenter) / renderResolution - (renderCenter/zoom/pixelSize);
         cameraPos = load(_pos).xyz + vec3(0,0,1.6);    
         cameraDir = rayDirection(load(_angle).xy,uv,renderResolution);
     
      //DEMO VIEW     
         if(load(_demo).r >.5)
             getCam((fragCoord.xy- renderCenter) , renderResolution, iTime, cameraPos, cameraDir);
                  
    }   

    render(fragColor,cameraPos, cameraDir, int(load(_rayDistMax).r),rayType);
       
    //MAP BORDER:
#ifdef MAP
    if(rayType==2){
        if(load(_map).r <1.5){
        	if(abs(distance(fragCoord,MapCenter)-MAP_SIZE)<1.) fragColor.rgb=vec3(0.);    
        	if(distance(fragCoord,MapCenter + vec2(sin( load(_angle).x), -cos( load(_angle).x))*MAP_SIZE )<3.) fragColor.rgb= vec3(1.,0.,0.);
        }
    }
#endif        
    //fragColor = texture(iChannel2, fragCoord / 3. / iResolution.xy);
}
#ifdef STATS

// ---- 8< ---- GLSL Number Printing - @P_Malin ---- 8< ----
// Creative Commons CC0 1.0 Universal (CC-0) 

float DigitBin(const in int x)
{
    return x==0?480599.0:x==1?139810.0:x==2?476951.0:x==3?476999.0:x==4?350020.0:x==5?464711.0:x==6?464727.0:x==7?476228.0:x==8?481111.0:x==9?481095.0:0.0;
}

float PrintValue(const in vec2 fragCoord, const in vec2 vPixelCoords, const in vec2 vFontSize, const in float fValue, const in float fMaxDigits, const in float fDecimalPlaces)
{
    vec2 vStringCharCoords = (fragCoord.xy - vPixelCoords) / vFontSize;
    if ((vStringCharCoords.y < 0.0) || (vStringCharCoords.y >= 1.0)) return 0.0;
	float fLog10Value = log2(abs(fValue)) / log2(10.0);
	float fBiggestIndex = max(floor(fLog10Value), 0.0);
	float fDigitIndex = fMaxDigits - floor(vStringCharCoords.x);
	float fCharBin = 0.0;
	if(fDigitIndex > (-fDecimalPlaces - 1.01)) {
		if(fDigitIndex > fBiggestIndex) {
			if((fValue < 0.0) && (fDigitIndex < (fBiggestIndex+1.5))) fCharBin = 1792.0;
		} else {		
			if(fDigitIndex == -1.0) {
				if(fDecimalPlaces > 0.0) fCharBin = 2.0;
			} else {
				if(fDigitIndex < 0.0) fDigitIndex += 1.0;
				float fDigitValue = (abs(fValue / (pow(10.0, fDigitIndex))));
                float kFix = 0.0001;
                fCharBin = DigitBin(int(floor(mod(kFix+fDigitValue, 10.0))));
			}		
		}
	}
    return floor(mod((fCharBin / pow(2.0, floor(fract(vStringCharCoords.x) * 4.0) + (floor(vStringCharCoords.y * 5.0) * 4.0))), 2.0));
}

#endif


vec4 drawSelectionBox(vec2 c) {
	vec4 o = vec4(0.);
    float d = max(abs(c.x), abs(c.y));
    if (d > 6. && d < 9.) {
        o.a = 1.;
        o.rgb = vec3(0.9);
        if (d < 7.) o.rgb -= 0.3;
        if (d > 8.) o.rgb -= 0.1;
    }
    return o;
}

mat2 inv2(mat2 m) {
  return mat2(m[1][1],-m[0][1], -m[1][0], m[0][0]) / (m[0][0]*m[1][1] - m[0][1]*m[1][0]);
}

vec4 drawInventory(vec2 c) {
    
    float h= (load(_inventory).r>1.?NUM_ITEM_ROWS:1.);
	float scale = floor(iResolution.y / 128.);
    c /= scale;
    vec2 r = iResolution.xy / scale;
    vec4 o = vec4(0);
    float xStart = (r.x - 16. * NUM_ITEMS) / 2.;
    c.x -= xStart;
    float selected = load(_selectedInventory).r;
    vec2 p = (fract(c / 16.) - .5) * 3.;
    vec2 u = vec2(sqrt(3.)/2.,.5);
    vec2 v = vec2(-sqrt(3.)/2.,.5);
    vec2 w = vec2(0,-1);
    if (c.x < NUM_ITEMS * 16. && c.x >= 0. && c.y < 16.* h ) {
        float slot = floor(c.x / 16.) + NUM_ITEMS*floor(c.y / 16.) ;
    	o = getTexture(48., fract(c / 16.));
        vec3 b = vec3(dot(p,u), dot(p,v), dot(p,w));
        vec2 texCoord;
        //if (all(lessThan(b, vec3(1)))) o = vec4(dot(p,u), dot(p,v), dot(p,w),1.);
        float top = 0.;
        float right = 0.;
        if (b.z < b.x && b.z < b.y) {
        	texCoord = inv2(mat2(u,v)) * p.xy;
            top = 1.;
        }
        else if(b.x < b.y) {
        	texCoord = 1. - inv2(mat2(v,w)) * p.xy;
            right = 1.;
        }
        else {
        	texCoord = inv2(mat2(u,w)) * p.xy;
            texCoord.y = 1. - texCoord.y;
        }
        if (all(lessThanEqual(abs(texCoord - .5), vec2(.5)))) {
            float id = getInventory(slot);
            if (id == 3.) id += top;
            o.rgb = getTexture(id, texCoord).rgb * (0.5 + 0.25 * right + 0.5 * top);
            o.a = 1.;
        }
    }
    vec4 selection = drawSelectionBox(c - 8. - vec2(16. * mod(selected,NUM_ITEMS), 16.* floor(selected/NUM_ITEMS)));
    o = mix(o, selection, selection.a);
    return o;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float pixelSize = load(_pixelSize).r;
    vec2 renderResolution = ceil(iResolution.xy / pixelSize); 
     mainImage_D( fragColor, fragCoord ) ;
    //fragColor = texture(iChannel3, fragCoord);
    
    if(load(_inventory).r>.0){   
   	     vec4 gui = drawInventory(fragCoord);
   	    fragColor = mix(fragColor, gui, gui.a);
    }
    
#ifdef STATS    
    //DISPLAY STATS IF F3 IS TOGGGLED
    float stats = load(_stats).r;    
    if (stats >0.5) {
        vec3 pos = load(_pos).xyz;
        

        //POS
        fragColor = mix( fragColor, vec2(1,.5).xyyx, PrintValue(fragCoord, vec2(0., iResolution.y - 20.), vec2(8,15), pos.x, 5.0, 5.0));
        fragColor = mix( fragColor, vec2(1,.5).yxyx, PrintValue(fragCoord, vec2(0., iResolution.y - 40.), vec2(8,15), pos.y, 5.0, 5.0));
        fragColor = mix( fragColor, vec2(1,.5).xxyx, PrintValue(fragCoord, vec2(0., iResolution.y - 60.), vec2(8,15), pos.z, 5.0, 5.0));

        //ANGLE
        fragColor = mix( fragColor, vec2(1,.5).xyyx, PrintValue(fragCoord, vec2(0., iResolution.y -80.), vec2(8,15),  load(_angle).x, 5.0, 2.0));
        fragColor = mix( fragColor, vec2(1,.5).xxxx, PrintValue(fragCoord, vec2(50., iResolution.y -80.), vec2(8,15),  load(_angle).y, 5.0, 2.0)); 
 
        //TIME
        fragColor = mix( fragColor, vec2(1,.5).xxxx , PrintValue(fragCoord, vec2(0., iResolution.y -100.), vec2(8,15), load(_time).r, 5.0, 2.0));


        
        //if (fragCoord.x < 20.) fragColor.rgb = mix(fragColor.rgb, texture(iChannel0, fragCoord / iResolution.xy).rgb, texture(iChannel0, fragCoord / iResolution.xy).a);
        
        //FRAMERATE, MEMORY RANGE, HEIGHT LIMIT, RAY DISTANCE
        fragColor = mix( fragColor, vec2(1,.5).xxyx, PrintValue(fragCoord, vec2(0.0, 105.), vec2(8,15), load(_pixelSize).r, 5.0, 1.0));
        fragColor = mix( fragColor, vec2(1,.5).xxyx, PrintValue(fragCoord, vec2(0.0, 85.), vec2(8,15), 1./ iTimeDelta, 5.0, 1.0));

#if SURFACE_CACHE>0
        fragColor = mix( fragColor, vec2(1,.5).yxxx, PrintValue(fragCoord, vec2(0., 65.), vec2(8,15), calcLoadDist_C(), 5.0, 2.0));
        fragColor = mix( fragColor, vec2(1,.5).xxxx, PrintValue(fragCoord, vec2(0., 45.), vec2(8,15),  heightLimit_C, 5.0, 2.0));
#endif
        fragColor = mix( fragColor, vec2(1,.5).xxxx, PrintValue(fragCoord, vec2(0., 25.), vec2(8,15),  load(_rayDistMax).r, 5.0, 2.0));

    }
	
    // "BUFFER C" DUMP
    if(load(_stats).g>.5) {               
        vec3 offset = floor(vec3(load(_pos).xy, 0.));
        vec4  color= texture(iChannel2,fragCoord / iResolution.xy);
        fragColor = color;       
    }
    //"BUFFER A" DUMP

    if(load(_stats).b>.5) fragColor= texture(iChannel0, fragCoord /iResolution.xy/3.);

#endif
}

`;

export default class implements iSub {
  key(): string {
    return '3t2yWR';
  }
  name(): string {
    return 'Voxel Game Evolution (Cubemap)';
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
    return [{ type: 1, f: buffA, fi: 0 }];
  }
}
