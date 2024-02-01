import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
/* ----------------------------------------------------------
	CONFIGURABLE SETTINGS
//----------------------------------------------------------*/

//#define HQ //high quality
#define MAX_PICK_DISTANCE 10.
#define TREE_SIZE 3.
#define SHADOW 1.
//#define FLAT
#define XRAY_MODE
#define WATER_LEVEL 45.
#define MC
//------------------------------------------------------

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
var(_torch,23,varRow);
var(_flow,24,varRow);
//old value are stored in rows with y=n where n is the iFrame difference
var(_old, 0, 1); 

//BUFFER B
const int  BUFFER_B = 1;
const vec2 packedChunkSize_B = vec2(9,6);
const float heightLimit_B = packedChunkSize_B.x * packedChunkSize_B.y;

//BUFFER C
const int  BUFFER_C = 2;
const vec2 packedChunkSize_C = vec2(1,1);
const float heightLimit_C = packedChunkSize_C.x * packedChunkSize_C.y ;



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


float calcLoadDist_B(vec2 iResolutionxy) {
    vec2  chunks = floor(iResolutionxy / packedChunkSize_B); 
    float gridSize = min(chunks.x, chunks.y);    
    return floor((gridSize - 1.) / 2.);
}

vec4 calcLoadRange_B(vec2 pos,vec2 iResolutionxy, float border) {
	vec2 d = (calcLoadDist_B(iResolutionxy) - border)* vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}


float calcLoadDist_C(vec2 iResolutionxy) {
    vec2  chunks = floor(iResolutionxy / packedChunkSize_C); 
    float gridSize = min(chunks.x, chunks.y);    
    return floor((gridSize - 1.) / 2.);
}

vec4 calcLoadRange_C(vec2 pos,vec2 iResolutionxy, float border) {
	vec2 d = (calcLoadDist_C(iResolutionxy) - border)* vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}


vec3 texToVoxCoord(vec2 textelCoord, vec3 offset,int bufferId) {

    vec2 packedChunkSize= bufferId==1?packedChunkSize_B:packedChunkSize_C;
	vec3 voxelCoord = offset;
    voxelCoord.xy += unswizzleChunkCoord(textelCoord / packedChunkSize);
    voxelCoord.z += mod(textelCoord.x, packedChunkSize.x) + packedChunkSize.x * mod(textelCoord.y, packedChunkSize.y);
    return voxelCoord;
}

vec2 voxToTexCoord(vec3 voxCoord,int bufferId) {

    vec2 packedChunkSize= bufferId==1?packedChunkSize_B:packedChunkSize_C;
    vec3 p = floor(voxCoord);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}


struct voxel {
	float id;
    int value; //1=modified,2=selected,3=falling
    vec2 light;
    float life;
    //int shape;
    //float rotation;
    float ground;
    float surface;
    int buffer;
   
     
};

//from https://www.shadertoy.com/view/wsBfzW
float gb(float c, float start, float bits){return mod(floor(c/pow(2.,start)),pow(2.,bits));}//get bits

//lazy version:
#define sb(f,s,b,v) f+=(v-gb(f,s,b))*pow(2.,s)
//strict version (use in case of strange behaviours):
//#define sb(f,s,b,v) f+=(clamp(floor(v+.5),0.,pow(2.,b)-1.)-gb(f,s,b))*pow(2.,s)

voxel decodeVoxel(vec4 t) {
	voxel o;
    o.id        = gb(t.r,0., 6.);
    o.value     = int(gb(t.r,6., 2.));
    
    o.light.s   = gb(t.g,0., 4.) ;
    o.light.t   = gb(t.g,4., 4.);
    o.life      = gb(t.g,8., 8.);
    
    //o.shape     = int(gb(t.b,0., 4.));
   // o.rotation  = gb(t.b,4., 4.);
    
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
    sb(t.g,8.,8.,v.life); 
    
   // sb(t.b,0.,4.,float(v.shape));
    //sb(t.b,4.,4.,v.rotation);
    
    sb(t.a,0.,8.,v.ground);
    sb(t.a,8.,8.,v.surface);
    return t;
}



voxel newVox(float z){
    voxel vox;
    vox.life=0.;
    //vox.rotation=0.;
    vox.value=0;
   // vox.shape=0;
    vox.ground=200.;
    vox.surface=0.;
	vox.id=0.;
    vox.light.t = z>10.? 0.:12.;
    vox.light.s = 15.;
 	vox.id=0.;
    vox.buffer=0;
    return vox;
}

vec4 readMapTex(vec2 pos, sampler2D iChannel,vec3 resolution) {
    //return texture(iChannel, (floor(pos) + 0.5) /  (floor (resolution.xy)), 0.0);   
    return texelFetch(iChannel, ivec2(pos), 0);   
 
}


voxel getCachedVoxel(vec3 p,sampler2D iChannel,vec3 resolution,int bufferId) {
    if(p.z>heightLimit_B || p.z<0.){voxel vox; vox.id=0.; return vox;}
    voxel vox= decodeVoxel(readMapTex(voxToTexCoord(p, bufferId),iChannel,resolution));
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



float overworld(vec3 p) {
	float density = 48. - p.z;
    density += mix(0., 40., pow(.5 + .5 * snoise(p.xy /557. + vec2(0.576, .492)), 2.)) * snoise(p / 31.51 + vec3(0.981, .245, .497));

    return density ;
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


voxel getGeneratedVoxel(vec3 voxelCoord,bool caves,int frame){
        voxelCoord.z+=40.;
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
            
            float o= overworld(voxelCoord+ vec3(0,0,h));
            layer[i]= (o>0.);
            if(i==0 && o> -2.) vox.surface=1.;
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
            if (hash13(voxelCoord) > 0.995 && !layer[1]) {vox.id = 10.;vox.life = 2.+ TREE_SIZE;}

             // CAVE
            if(caves){
                caves=snoise(voxelCoord / 27.99 + vec3(0.981, .245, .497).yzx * 17.) > 1. - (smoothstep(0., 5., voxelCoord.z) - 0.7 * smoothstep(32., 48., voxelCoord.z));
	        	if (caves) {vox.id = 0.;}
            }
        } 
 	    
    	//WATER
    	if(vox.id == 0. && voxelCoord.z < WATER_LEVEL) {
            vox.id=12.; 
            vox.surface=1.;
                
         }
        //GEMS
        if (hash13(voxelCoord) > 0.995 && voxelCoord.z < 20.  &&  vox.id!=12. && vox.id!=0. ) {if(hash13(voxelCoord +vec3(1.))>.5) vox.id = 6.; else vox.id=8.;}    
        //BEDROCK
        if (voxelCoord.z < 1.) vox.id = 16.; 
    

    
#endif
        
  	
        return vox;
		
}



// MIX PROCEDURAL AND MEMORY VOXEL
bool inRange(vec2 p, vec4 r) {
	return (p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w);
}


voxel getVoxelData( vec3 voxelCoord,
                    sampler2D iChannel_B, 
                    sampler2D iChannel_C, 
                    int frame, 
                    vec3 resolution_B, 
                    vec3 resolution_C,
                    vec4 range_B,
                    vec4 range_C,
                    vec3 offset,
                    bool caves,
                    int caller){
  
#ifdef EXCLUDE_CACHE
    return getGeneratedVoxel(voxelCoord,true,frame); 
#else    
    
 
    if (inRange(voxelCoord.xy,range_B) && frame > 0 && voxelCoord.z <heightLimit_B  
        && (caller!=2)  //comment this line to enable persistence between cache (doesn't handle resolution change)
       ) {
        return getCachedVoxel(voxelCoord  - offset,iChannel_B,resolution_B,BUFFER_B); 
        
    }

    if (inRange(voxelCoord.xy,range_C) && frame > 0){
         if ( voxelCoord.z >= 0.&& voxelCoord.z <heightLimit_C  && (caller==2) ) {
            // BUFFER C previous frame
        	return getCachedVoxel(voxelCoord - offset,iChannel_C,resolution_C,BUFFER_C); 
         }
        if(caller!=2){
        	voxel vo= getCachedVoxel(vec3(voxelCoord.xy,0.) - offset,iChannel_C,resolution_C,BUFFER_C);
         	if(vo.ground>0. && vo.ground< heightLimit_B  ){
                //Above max height of BUFFER C --> air
                float h=voxelCoord.z-vo.ground;
                if(h==0. ) { vo.surface=1.; return vo;}
                
                voxel vox=newVox(voxelCoord.z);
                vox.surface=1.;
             	if(h>0. && caller==3) { 
                   	//GRASS
                    if(h==1. &&vo.id==3.) { vox.life=1.;}
                    
                    //TREE TRUNK
                    if(h<TREE_SIZE+2. && vo.id==10. && vo.ground >= WATER_LEVEL-1.) {vox.id=10.; vox.life=2.+TREE_SIZE-h; ;}                   
                    else if( vo.id==10. && h<TREE_SIZE+3. && vo.ground >= WATER_LEVEL-1.) {vox.id=11.; vox.life=0.; } 
                    return vox;

                }
             	
                if(h>-3. && h<0. && vo.id==11. && caller==3) {
                    //TREE LEAFS
                    vox.id=11.; 
                    
                    vox.life=0.;
                    return vox;
                }
					
         	}
         }
    }    

  
    return getGeneratedVoxel(voxelCoord,caves,frame);
#endif
}


#define getCVoxel(p,v,id)           \
	{vec2 frame=(id!=3&&id!=0?_old:vec2(0.) );\
    vec4 range_B = load(frame+_loadRange_B);  \
    vec4 range_C = load(frame+_loadRange_C);  \
    vec3 offset =(id==0?vec3(0.): floor(vec3(load(frame+_pos).xy, 0.)));   \
    if(id==2)  v= getCachedVoxel(p-offset,iChannel2,iChannelResolution[2],2); \
    else v= getCachedVoxel(p-offset,iChannel1,iChannelResolution[1],1);}


#define getVoxel(p,v,id)           \
	{vec2 frame=(id!=3&&id!=0?_old:vec2(0.) );\
    vec4 range_B = load(frame+_loadRange_B);  \
    vec4 range_C = load(frame+_loadRange_C);  \
    vec3 offset =(id==0?vec3(0.): floor(vec3(load(frame+_pos).xy, 0.)));   \
    v= getVoxelData(p,iChannel1,iChannel2,iFrame,iChannelResolution[1],iChannelResolution[2],range_B,range_C,offset,true,id);}
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
#define KEY_TORCH 118
#define KEY_FLOW 119
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
    return isSolidVoxel(t) * (!slope ?1.:0.);
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


//From https://www.shadertoy.com/view/4djGRh
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
        o.rgb=vec3(  48./255.,  48./255., 196./255.)*br;		
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
    if (texCoord.x < 512. && texCoord.y<30.) {
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
 
                    pos = vec3(2952.8,10140.8,25.);
                    offset = vec3(floor(pos.xy), 0.);
                    oldPos = pos;
                    angle = vec2(0.8,2.1 );                   
                 
                    demo=1.;
                    oldMouse = vec4(-1);
                    vel = vec3(0);
                    renderScale = -2.;
                    time = vec2(0.,0);
                    selected = 0.;
                    inventory=0.;
                    rayDistMax=100.;
                    map=1.;
                    pixelSize=2.;
                }
                if(demo>0. && 
                   (keyDown(KEY_JUMP)>.0||keyDown(KEY_FORWARDS)>0. ))
                {
              
                    demo=0.;
                }
                
                if ( bool(keyDown(KEY_TELEPORT))) {
					
                    if(hash(iTime) <.5) pos=vec3(3221.5,10159.5,70.);
                    else pos =vec3(hash33(pos).xy *10000.,72.); 
                       
                    offset = vec3(floor(pos.xy), 0.);
                    oldPos = pos;                
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
                float torch = bool(keyToggled(KEY_TORCH))?1.:0.;
                float flow = bool(keyToggled(KEY_FLOW))?1.:0.;
                
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

                if(demo>0.)vel=dirFwd*20.;
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
                store4(_loadRange_B,calcLoadRange_B(pos.xy,iChannelResolution[1].xy,0.));
                store4(_loadRange_C,calcLoadRange_C(pos.xy,iChannelResolution[1].xy,0.));

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
                store1(_pixelSize,pixelSize);
                store1(_inventory,inventory);
                store1(_demo,demo);
                store1(_torch,torch);
                store1(_flow,flow);
               


                fragColor = outValue;
            }
        }  
        else fragColor = texture(iChannel0, (fragCoord - _old) / iChannelResolution[0].xy);
    }
#ifdef MC    
    else if (texCoord.x < 512. && texCoord.y<32.) {
            if(iFrame>3) discard;
            else if(texCoord.y<31.&& texCoord.x<256.)
            {
               int _edgeTable[256]= int[256](
                -1   , 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00, 
                0x190, 0x099, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90, 
                0x230, 0x339, 0x033, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30, 
                0x3a0, 0x2a9, 0x1a3, 0x0aa, 0x7a6, 0x6af, 0x5a5, 0x4ac, 0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0, 
                0x460, 0x569, 0x663, 0x76a, 0x066, 0x16f, 0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60, 
                0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0x0ff, 0x3f5, 0x2fc, 0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 
                0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x055, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950, 
                0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0x0cc, 0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0, 
                0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc, 0x0cc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0, 
                0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x055, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650, 
                0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc, 0x2fc, 0x3f5, 0x0ff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0, 
                0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c, 0x36c, 0x265, 0x16f, 0x066, 0x76a, 0x663, 0x569, 0x460, 
                0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0x0aa, 0x1a3, 0x2a9, 0x3a0, 
                0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x033, 0x339, 0x230, 
                0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x099, 0x190, 
                0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0
               );
               fragColor=vec4(_edgeTable[int(texCoord.x)]);
           }
           else if(texCoord.y<32.&& texCoord.x<256.){

            int  _triTableCompact[1024] = int[1024](
                65535,65535,65535,65535, 62336,65535,65535,65535, 63760,65535,65535,65535, 37761,65304,65535,65535, 64033,65535,65535,65535, 
                4992,65442,65535,65535, 2601,65426,65535,65535, 9090,39562,65528,65535, 62131,65535,65535,65535, 33456,65291,65535,65535, 
                8337,65459,65535,65535, 4785,35257,65531,65535, 45475,65338,65535,65535, 416 ,47272,65530,65535, 12435,43931,65529,65535, 
                43657,65464,65535,65535, 63604,65535,65535,65535, 28724,65347,65535,65535, 35088,65396,65535,65535, 18708,14103,65521,65535,
                35361,65396,65535,65535, 14147,8512,65530,65535, 39465,18464,65527,65535, 10658,29305,18803,65535, 14152,65323,65535,65535,
                46923,578 ,65524,65535, 33033,12916,65531,65535, 39796,47540,4754,65535, 12707,34731,65524,65535, 6833,436 ,19316,65535, 39028,
                47536,12474,65535, 19316,47515,65530,65535, 62553,65535,65535,65535, 1113,65336,65535,65535, 5200,65285,65535,65535, 33880,4947,
                65525,65535, 39457,65349,65535,65535, 6147,38050,65525,65535, 23077,1060,65522,65535, 13730,21330,33844,65535, 9305,65459,65535,
                65535, 688 ,38072,65525,65535, 1104,12881,65531,65535, 9490,33413,22603,65535, 43834,22833,65524,65535, 1428,43032,43905,65535,
                20549,46512,12474,65535, 22597,35496,65531,65535, 22649,65431,65535,65535, 36921,30005,65523,65535, 2160,20849,65527,65535, 13137,
                65397,65535,65535, 39033,6773,65522,65535, 37402,13573,14160,65535, 33288,22610,9639,65535, 9634,21301,65527,65535, 30103,45976,
                65522,65535, 38745,10535,46880,65535, 2866,29057,29976,65535, 45355,6001,65525,65535, 34905,6773,45987,65535, 20597,46992,40976,
                61611, 45227,23088,28800,61557, 30123,65371,65535,65535, 62826,65535,65535,65535, 21376,65386,65535,65535, 20745,65386,65535,65535,
                4993,42377,65526,65535, 9569,65302,65535,65535, 5473,866  ,65528,65535, 38249,8288,65526,65535, 22677,9512,33334,65535, 43826,65366,
                65535,65535, 47115,27138,65525,65535, 10512,42419,65526,65535, 5797,47401,47250,65535, 27446,5429,65523,65535, 2944,20571,27473,65535,
                1715,24675,38149,65535, 26966,39865,65528,65535, 18085,65415,65535,65535, 16436,22071,65530,65535, 20625,18538,65527,65535, 5482,
                29049,18803,65535, 25110,29717,65528,65535, 21793,866 ,29748,65535, 38728,24656,25093,65535, 31031,9033,26969,63842, 29363,27208,
                65525,65535, 18085,9255,46880,65535, 18704,12935,27227,65535, 37161,18731,19323,63141, 14152,21339,27473,65535, 23317,363 ,19323,
                64320, 2384,12374,14006,63304, 26966,29881,39801,65535, 26954,65444,65535,65535, 18084,32937,65523,65535, 41226,17926,65520,65535,
                33080,26721,41316,65535, 6465,25154,65524,65535, 6147,17042,17961,65535, 17440,65378,65535,65535, 33336,9282,65526,65535, 43338,
                11078,65523,65535, 8832,38072,27210,65535, 691 ,24673,41316,65535, 24902,33953,45345,61880, 37993,6499,14003,65535, 33208,27393,
                16785,61766, 14003,24582,65524,65535, 47174,65414,65535,65535, 30375,39080,65530,65535, 880,36986,42858,65535, 5994,29050,2072,
                65535, 42858,28951,65523,65535, 5665,33158,30345,65535, 10594,30233,14601,63799, 28807,1632,65522,65535, 25143,65319,65535,65535,
                43826,35462,30345,65535, 9986,37047,42855,63401, 4225,41351,42855,64306, 45355,27249,5985,65535, 34456,6518,14006,63025, 45456,
                65398,65535,65535, 28807,45920,1712,65535, 63159,65535,65535,65535, 64359,65535,65535,65535, 47107,65383,65535,65535, 47376,65383,
                65535,65535, 35096,31507,65526,65535, 25114,65403,65535,65535, 14881,46720,65527,65535, 8338,46746,65527,65535, 10166,35386,35235,
                65535, 25383,65394,65535,65535, 30727,9734,65520,65535, 9842,4211,65529,65535, 4705,37224,26504,65535, 42618,12657,65527,65535, 
                5754,33191,32791,65535, 1840,41127,31337,65535, 31335,43146,65529,65535, 46214,65384,65535,65535, 15203,16480,65526,65535, 35688,
                2404,65521,65535, 38473,14646,25521,65535, 25734,41611,65521,65535, 14881,24752,25611,65535, 18612,8374,39465,65535, 41882,18723,
                25523,62308, 33576,25636,65522,65535, 16960,65318,65535,65535, 8337,16963,33606,65535, 5265,16932,65526,65535, 33560,18454,6758,
                65535, 40986,1632,65524,65535, 17252,42627,37635,62362, 25754,65354,65535,65535, 30100,65462,65535,65535, 17280,31577,65526,65535,
                20741,26372,65531,65535, 34427,21315,20788,65535, 42073,26401,65531,65535, 6070,32930,22851,65535, 23399,9380,8266,65535, 14403,
                9029,9637,63099, 29479,17702,65529,65535, 1113,24680,30818,65535, 12899,20839,1104,65535, 26662,4728,22600,63569, 42073,29025,29462,
                65535, 6753,359 ,1927,62553, 18948,12378,31338,64115, 31335,17802,43082,65535, 26006,35739,65529,65535, 2915,20534,22790,65535, 
                2224,4277,46677,65535, 25526,13651,65521,65535, 39457,47541,26040,65535, 944 ,37046,38486,64033, 46475,2149,9637,62752, 25526,
                41555,13731,65535, 22917,25986,10290,65535, 38489,24582,65522,65535, 6225,25864,10296,63526, 9809,65377,65535,65535, 5681,33702,
                38486,63128, 40986,22880,1616,65535, 22576,65446,65535,65535, 63066,65535,65535,65535, 31323,65461,65535,65535, 47707,14423,65520,
                65535, 22453,37306,65520,65535, 42362,35195,4993,65535, 45595,22295,65521,65535, 4992,29042,45685,65535, 38265,2418,31522,65535, 
                29271,38322,33330,62089, 10834,29523,65525,65535, 32808,30757,21157,65535, 20745,13626,10807,65535, 37513,30738,21154,62039,
                13617,65367,65535,65535, 1920,28951,65525,65535, 37641,13651,65527,65535, 22409,65401,65535,65535, 21637,47754,65528,65535, 21509,
                42251,955 ,65535, 35088,43172,21675,65535, 42170,15188,5268,62483, 8530,45656,34120,65535, 2880,21563,6955,64277, 1312,45717,34117,
                62859, 9545,65339,65535,65535, 14930,17189,18485,65535, 21157,9282,65520,65535, 12963,33701,34117,63760, 21157,37186,9362,65535, 
                34120,21301,65521,65535, 5440,65360,65535,65535, 34120,2357,21253,65535, 62793,65535,65535,65535, 18356,43449,65531,65535, 17280,
                47481,47767,65535, 7073,16715,46192,65535, 13331,41348,46196,62650, 38836,10571,8603,65535, 38009,6523,6955,62336, 46203,16932,
                65520,65535, 46203,14372,16948,65535, 10898,12951,38007,65535, 38825,10823,1927,63234, 14963,18218,2586,64004, 33441,65351,65535,
                65535, 16788,6001,65523,65535, 16788,32881,6017,65535, 29444,65332,65535,65535, 63364,65535,65535,65535, 43177,65419,65535,65535,
                14595,39865,65530,65535, 2576,43146,65531,65535, 47635,65443,65535,65535, 6945,47515,65528,65535, 14595,8633,39721,65535, 35616,
                65456,65535,65535, 64291,65535,65535,65535, 10290,35496,65529,65535, 681 ,65321,65535,65535, 10290,4264,35352,65535, 62113,65535,
                65535,65535, 38961,65409,65535,65535, 61840,65535,65535,65535, 63536,65535,65535,65535, 65535,65535,65535,65535
            );

             int id= int(texCoord.x)*4;
             fragColor= vec4(_triTableCompact[id],_triTableCompact[id+1],_triTableCompact[id+2],_triTableCompact[id+3] );

         }
    }
#endif    
    else setTexture(fragColor,fragCoord);
}


`;

const buffB = `
void  lightDiffusion(inout voxel vox,in voxel temp ,vec3 rPos){
  if(vox.id != 6. && vox.id != 26. ){
    vox.light.s =  max( vox.light.s  ,  	temp.light.s  -(rPos.z==1.?0.:1.) - (vox.id==0.?0.: vox.id==11.?5.:15.));       	
    vox.light.t =  max( vox.light.t,   temp.light.t - (vox.id==0.|| vox.id==12.?1.:vox.id==11.? 5.:15.)); 
    
  }        
}
const vec3 VertexOffset[8] =vec3[8]
(
      vec3(0,0,0), vec3(1,0,0),vec3(1,1,0),vec3(0,1,0),
      vec3(0,0,1), vec3(1,0,1),vec3(1,1,1),vec3(0,1,1)
);

//VOXEL MEMORY 1 - NEAR BLOCKS
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
#ifdef EXCLUDE_CACHE
  discard;
#else
 
  vec2 textelCoord = floor(fragCoord);
  vec3 offset = floor(vec3(load(_pos).xy, 0.));
  vec3 voxelCoord = texToVoxCoord(textelCoord, offset,BUFFER_B); 

  vec4 newRange= calcLoadRange_B(offset.xy,iChannelResolution[1].xy,0.);
  
  if(!inRange(voxelCoord.xy, newRange)) {discard;}
  
  vec4 pick = load(_pick);   

  voxel vox ; 
  getVoxel( voxelCoord,vox,1);

  if (voxelCoord == pick.xyz || vox.value==2 )  {
      if(vox.value==0)vox.value=1;
      
      if (pick.a == 1. &&  vox.id != 16. && load(_pickTimer).r > 1.) 
      {vox.value=1; 
              vox.id = 0.; 
               
           vox.light.t=0.;
           vox.life=0.;
           vox.ground=0.;
      }
      else if (pick.a == 2.) 
      {
          vox.id = getInventory(load(_selectedInventory).r);
          if(vox.id==10.) vox.life=3.;
          else if (vox.id==12.)vox.life=64.;
          else vox.life=0.;               
          vox.value=1;
     
      } 
  
  } 
      
   if(voxelCoord == pick.xyz  &&  pick.a == 6. ) 
   {vox.value= 2 ;}
  
  if(voxelCoord == pick.xyz  &&  pick.a == 7. ) 
   {
      if(vox.value==2) vox.value=1;
       else vox.value=2;          
   }
  if(load(_pickTimer).r >1. && pick.a == 6. && vox.value==2)
   {vox.value= 1 ;}

   // SUN LIGHT SOURCES
 
  if (voxelCoord.z >= heightLimit_B - 2.) {
      vox.light.s = 15.;   
  } else  {
      //vox.light.s=0.; //correct but initial value is better oon surface
      vox.light.s = 15.;       
  }
  
  // TORCH LIGHT SOURCES
  if(vox.id==12.) vox.light.t=max(2.,vox.light.t);
  else if(vox.id==6.) vox.light.t=15.;
  else vox.light.t=clamp(vox.light.t- (hash(iTime)>.5?1.:0.),0.,15.);
   
  if(length( load(_pos).xyz + vec3(0,0,3.)- voxelCoord.xyz) <2.) vox.light.t=max( 12.,vox.light.t);


  voxel temp;
 
  
  //NEIGHBOURS 2=ABOVE 5=BELOW, 0-1-3-4= SIDES
  float iE=0.;
    
  float g=MAX_GROUND;
  // vox.surface=0.;
  voxel next[6];
  for(int j=0;j<=1;j++){
      for(int i=0;i<3;i++){
          vec3 n= vec3(i==0?1.:0. ,i==1?1.:0.,i==2?1.:0.) * vec3((j==0?1.:-1.));
        
          voxel temp;
          getVoxel(voxelCoord + n ,temp,1 );           
      next[i+3*j]= temp;
  
          if(voxelCoord.z> 80.) {vox.light.s=15.;vox.light.t=0.;}
          else  lightDiffusion(vox,temp,n);

          //LEAFS:
         if(temp.id==11.  && temp.life>0. &&vox.id==0.) {vox.id=11.;  vox.life=temp.life-1.; }  

      }
  }
  
  //MC SURFACE
  for(int id=1;id<8;id++)
  {
      vec3 p= voxelCoord+VertexOffset[id];
      voxel temp;
      getVoxel(p,temp,1 );
      if(vox.id==0. && (temp.id==10. || temp.id==11.) ) vox.surface=1.;
      if((vox.id==11. || vox.id==10.)&& temp.id==0. ) vox.surface=1.;
  }    
    
  vec3 pos = load(_pos).xyz;
  
         
if(sdBox(pos-voxelCoord -vec3(0.,0.,1.),vec3(.5,.5,.5))<=.01 &&vox.id==3.) vox.id=2.;
     
  //ABOVE    
  if(next[2].id==0.  &&  vox.id==2.) {if(hash13(voxelCoord +iTime ) >.95 && hash(iTime)>.99) vox.id=3.;vox.life=0.;}
  if(next[2].id==0.  &&  vox.id==3.) {if(hash13(voxelCoord +iTime+30.) >.95 && hash(iTime +30.)>.99) vox.life=clamp(vox.life+1.,0.,3.);}
  if(next[2].id==3.  &&  vox.id==3.) {vox.id=2.;}
  if(next[2].value==3 && (vox.id==0.|| vox.id==12.)) {vox.id=next[2].id;} 
  
  //BELOW
  if(next[5].id==10.  && next[5].life>0. && vox.id==0.) {vox.id=10.;  vox.life=next[5].life-1.; vox.ground=0.;}
  if(next[5].id==10.  && next[5].life<1.) {vox.id=11.;  vox.life=TREE_SIZE;}	
  if((next[5].id!=3.)  &&  vox.id==0.) {vox.life=0.;}
  if((next[5].id!=0.|| next[5].id==12.)  &&  vox.value==3) {vox.id=0.; vox.value=0;vox.life=0.;}


  if(next[5].id==3.  &&  vox.id==0.) {vox.life=1.;}
  
  
  fragColor = encodeVoxel(vox);
#endif
}
`;

const buffC = `
/*
VOXEL MEMORY 2 - SURFACE 
  mode = 1 it's just a copy of buffer B, working in a limited z range
  mode = 2 stores onlythe surface block with the height, for a wider area
*/

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
#ifdef EXCLUDE_CACHE
    discard;
#else
    vec2 textelCoord = floor(fragCoord);
    vec3 offset = floor(vec3(load(_pos).xy, 0.));
    vec3 voxelCoord = texToVoxCoord(textelCoord, offset,BUFFER_C); 

    vec4 newRange_C= calcLoadRange_C(offset.xy,iChannelResolution[1].xy,0.);

    if(!inRange(voxelCoord.xy, newRange_C)) {
        discard;
     
    }
    voxel vox;  
    getVoxel( voxelCoord,vox,2);

    if(voxelCoord.z==0. && vox.ground >100.){
    	voxel temp;
        float h= vox.ground-100.;
        getVoxel(vec3(voxelCoord.xy,h),temp,2);
        float id = temp.id;
        if(id !=0.){
            vox=temp;
            vox.ground=h;
        }
        else vox.ground--;           
    } 	
 
    //NEIGHBOURS
    if(voxelCoord.z==0. && vox.ground<100.){
       vec3 s = vec3(1.,0.,0. );
       vec3 t = vec3(0.,1.,0. );    
       voxel v[9];    
       for (int i =-1; i <=1; i++) {
            for (int j =-1; j <=1  ; j++) {
               
                getVoxel(voxelCoord + s* float(i)+t*float(j),v[4+ i+3*j +min(iFrame,0) ] ,2 ); 
                
                voxel temp = v[4+ i+3*j ];
                if(i+3*j !=0 && temp.id==10. && temp.ground <100. && temp.ground> vox.ground -TREE_SIZE -1.) {
                	vox.id=11.;vox.ground=temp.ground+TREE_SIZE+2.;vox.life=0.;
                }
            }
        }
    }
    vox.surface=1.;
    fragColor = encodeVoxel(vox);
#endif
}
`;

const buffD = `
#ifdef MC


int gFrame=0; 

//--------------------
//porting of "Marching Cubes" algorithm by Paul Bourke (1994)
//http://paulbourke.net/geometry/polygonise/ 
 struct TRIANGLE {
   vec3 p[3];
} ;


 struct GRIDCELL{
   vec3 p[8];
   float val[8];
} ;

 const vec3 VertexOffset[8] =vec3[8]
(
        vec3(0,0,0), vec3(1,0,0),vec3(1,1,0),vec3(0,1,0),
        vec3(0,0,1), vec3(1,0,1),vec3(1,1,1),vec3(0,1,1)
);


//lookup tables retrieved from BufferA
#define edgeTable(i) int(texelFetch(confChannel, ivec2(i,30),0).x)
#define triTableRow(i) ivec4(texelFetch(confChannel, ivec2(i,31),0))
#define triTableVal(tt,j) int((tt[j>>2]&(15*(1<<((j&3)*4))))>>((j&3)*4))

const int  vertexTable[24] =int[24](
   0,1,   1,2,  2,3,   3,0, 
   4,5,   5,6,  6,7,   7,4,   
   0,4,   1,5,  2,6,   3,7);
   
/*
   Linearly interpolate the position where an isosurface cuts
   an edge between two vertices, each with their own scalar value
*/
float  VertexWeight(float isolevel,float valp1, float valp2)
{  
   return  (isolevel - valp1) / (valp2 - valp1);
}

//input: isolevel value at 8 cube vertexs and isolevel threshold
//output: number of triangles (-1= outside) and list of triangles (up to 5 in worst case)
uvec4  Polygonise(inout GRIDCELL grid,float isolevel,inout TRIANGLE[5] triangles,sampler2D confChannel)
{
 
   /*
      Determine the index into the edge table which
      tells us which vertices are inside of the surface
   */
   int cubeindex = 0;
   for(int i=gFrame;i<8;i++) if (grid.val[i] < isolevel) cubeindex |= 1<<i;

   /* Cube is entirely in/out of the surface -1=IN, 0=OUT */
   int e=edgeTable(cubeindex);
   if ( e<= 0) return uvec4(e);

   /* Find the vertices where the surface intersects the cube */
   vec3 vertlist[12];
   float vertW[12];


   for(int i=0;i<12;i++)
   if ((e & (1<<i))>0)  {
       vertW[i]= VertexWeight(isolevel,grid.val[vertexTable[i*2]], grid.val[vertexTable[i*2+1]]);
          
       vertlist[i]= mix( grid.p[vertexTable[i*2]], grid.p[vertexTable[i*2+1]],vertW[i]);
   }
   /* Create the triangle */
   uvec4 tridata=uvec4(0u); //x=number of triangles, yzw= tritable
   
   ivec4 ttr=triTableRow(cubeindex); 
   for (int i=gFrame;triTableVal(ttr,i)!=15 && i<15;i+=3) {
       
       for(int j=gFrame;j<3;j++)   {
           uint k =uint(triTableVal(ttr,(i+j)));
           int idx =(i+j);
           if(idx<8) tridata.y +=  k*( 1u<<(idx*4));
           else tridata.z += k*( 1u<<(idx*4-32));
        
           tridata.w+=  uint( floor(vertW[k]*4. )  ) 
                        *( 1u<<(idx*2));
           triangles[tridata.x].p[j] = vertlist[k];
       }
      
      tridata.x++;
   }

   return uvec4(tridata);
}
//-------------------------------------
//Iq
vec2 boxIntersection( in vec3 ro, in vec3 rd, in vec3 rad) 
{
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
	
    if( tN>tF || tF<0.0) return vec2(-1.0); 
    
    //vec3 normal = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);

    return vec2( tN, tF );
}


// triangle degined by vertices v0, v1 and  v2
vec3 triIntersect( in vec3 ro, in vec3 rd, in vec3 v0, in vec3 v1, in vec3 v2 )
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
    if( u<0.0 || u>1.0 || v<0.0 || (u+v)>1.0 ) t = -1.0;
    return vec3( t, u, v );
}
#endif
//--------------------------

float lightLevelCurve(float t) {
    t = mod(t, 1200.);
	return 1. - ( smoothstep(400., 700., t) - smoothstep(900., 1200., t));
}

vec3 lightmap(in vec2 light) {
    light = 15. - light;
	if(load(_torch).r>0.5) light.t=13.;
    
    return clamp(mix(vec3(0), mix(vec3(0.11, 0.11, 0.21), vec3(1), lightLevelCurve(load(_time).r)), pow(.8, light.s)) + mix(vec3(0), vec3(1.3, 1.15, 1), pow(.75, light.t)), 0., 1.);   

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
   
    float dist;
    voxel vox;
   // float water;
    //float fog;
   // bool grass;
   // bool mirror;
    vec3 color;
   // float fresnel;

};




vec4 sun(){
    float t = load(_time).r;
    float sunAngle = (t * PI * 2. / 1200.) + PI / 4.;
    const float risingAngle=PI/6.;
    return  vec4(cos(sunAngle)*sin(risingAngle), cos(sunAngle)*cos(risingAngle), sin(sunAngle),lightLevelCurve(t));
}



//-------------

float noise(in vec2 p) {
	vec2 F = floor(p), f = fract(p);
	f = f * f * (3. - 2. * f);
	return mix(
		mix(hash2(F), 			 hash2(F+vec2(1.,0.)), f.x),
		mix(hash2(F+vec2(0.,1.)), hash2(F+vec2(1.)),	  f.x), f.y);
}



//------------------------*/
vec4 VoxelHitPos(vec3 pos, vec3 ro, vec3 rd){
    vec3 ri = 1.0/rd;
	vec3 rs = sign(rd);
    vec3 mini = (pos-ro + 0.5 - 0.5*vec3(rs))*ri;
    float t=  max ( mini.x, max ( mini.y, mini.z ) );
    return vec4(t*rd+ro,t);
}


vec3    g_n;
vec2    g_uv;

rayCastResults rayCast(vec3 rayPos0, vec3 rayDir,int maxRayDist,vec4 range,int rayType) {
	   
    voxel vox;
    vox.id=0.;

    rayCastResults res;
    res.hit = false;
    res.color=vec3(-1.);

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

	bool xRay=(currentVoxel.id!=0. );
        
    for (int i = 0; i < 1000; i++) {

        if(i>0){
       		mask = step(sideDist.xyz, sideDist.yzx) * step(sideDist.xyz, sideDist.zxy);

        }
		sideDist += mask *  raySign *rayInv;
        mapPos += mask *  raySign;
        
        if ( mapPos.z < 0. ) break;
        if ( mapPos.z >= heightLimit_B && rayDir.z > 0.)  break;
                   
        getVoxel( mapPos, vox ,3 );
        
      
       

#ifdef MC
         if(vox.surface!=0. ){// && vox.id!=12.){//&& rayType==1){ 
                gFrame=min(iFrame,0);
                vec3 hitVoxelPos =VoxelHitPos(mapPos,rayPos,rayDir).xyz;
                if( sdBox( mapPos+vec3(.5) -rayPos,vec3(.5,.5,.5) )<.001) hitVoxelPos=rayPos;
                GRIDCELL g;
                float csz=1.;
                float mcid=0.;
                bool surface=false;
                for(int id=0;id<8;id++)
                {
                    g.p[id]=mapPos+  VertexOffset[id];
                }
                for(int id=0;id<8;id++)
                {
                    voxel temp;
#ifdef HQ
                    getVoxel(g.p[id],temp,3  );
#else
                    getCVoxel(g.p[id],temp,3  );
#endif 
                    if(temp.id==3.) temp.id=4.;
                    mcid =max(mcid,temp.id);
                    g.val[id]= temp.id!=0.?1.:-1.;
                    surface = surface || ( g.val[id]*g.val[0]<0.);
                }    

                if(surface ){

                    TRIANGLE[5] triangles;

                        //calculate vertexes & triangles (requires buffer A and B)

                    uvec4 tridata = Polygonise(g,0.,triangles,iChannel0);

                    int ntriangles=int(tridata.x);          
                    float t = 1000.0; 
                    for(int i=min(iFrame,0);i<ntriangles;i++) {
                        vec3 tri =triIntersect( hitVoxelPos,rayDir,triangles[i].p[0],triangles[i].p[1],triangles[i].p[2]);
                        if(tri.x>0.  && tri.x <t) {
                            t=tri.x;
                             g_n=-normalize(cross(triangles[i].p[1]-triangles[i].p[0],triangles[i].p[2]-triangles[i].p[0]));
                             g_uv= tri.yz;
                         }
                    }
                    if(t< 1000. ) {
                    
                        subRes.hit = true; 
                        subRes.mapPos = mapPos;
                        subRes.normal =- g_n;
                        subRes.uv=g_uv;
                        subRes.rayPos = hitVoxelPos + rayDir*t;
                        subRes.dist = length(rayPos0 - subRes.rayPos);
                        vox.id=mcid;
                        subRes.vox=vox;
                        subRes.color = getTexture(mcid, g_uv).rgb *(.6 - .4*dot( sun().xyz,g_n));;             

                        return subRes;
   
                    }else vox.id=0.;
                }
                
        }
#endif       

        if( vox.id !=0.  ){
        	if(xRay) continue;
            else{
            	res.hit = true; 
                break;
            }
        } 

     
        //NO HIT
        xRay=false; 
        if(!inRange(mapPos.xy, range) && i> maxRayDist) break;

        if(i > int( load(_rayLimit).r)) break;
	}
    
    if(!res.hit  &&rayDir.z < 0. && !inRange(mapPos.xy, range)){
        if(mapPos.z>15.) {vox.id = 0.; res.hit=false;}
        else { vox.id=3.; res.hit = true;}
    }
    
    res.mapPos = mapPos;
    res.normal = res.hit? -raySign * mask:vec3(0.);
    res.rayPos = VoxelHitPos(mapPos,rayPos,rayDir).xyz;
    res.dist = length(rayPos0 - res.rayPos);
    res.vox=vox;

    
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
    if(res.hit ){
        float textureId = res.vox.id;
        if (textureId == 3.) textureId += res.normal.z;
        vec2 uv_txt= res.uv;           
        res.color = getTexture(textureId, uv_txt).rgb *(.6 - .4*dot( sun().xyz, res.normal));; ;
    
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
        maxRayDist=  25;
        rt=3;           
    }
    
   rayCastResults res = rays[0];
	
	vec3 color = vec3(0.);
    
    if (res.hit) {
        			
        float shadow =rays[1].hit?SHADOW:0.;
        //color=res.color*(1.-shadow*.2);
        color = res.color*lightmap( vec2(res.vox.light.s*(1.-shadow*.2),res.vox.light.t)   );
        if(rayType==1 ){
			
            // SELECTION AND MOUSE OVER
            vec4 pick = load(_pick);
            if (res.mapPos == pick.xyz || res.vox.value==2) {
                if (pick.a == 1.) color *= getTexture(32., res.uv).r;
                else if (res.vox.value==2) color = mix(color, vec3(1.,0.,0.), 0.5);
                
                else color = mix(color, vec3(1), 0.2);
            }
        }
        
    }
     else color = skyColor(rayDir);

    if(rayType==1) {
        color = pow( color, vec3(0.9) );
             
    }
    fragColor.rgb = color; 
    
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





void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
 
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
       
                  
    }   

    render(fragColor,cameraPos, cameraDir, int(load(_rayDistMax).r),rayType);
       

}
`;

const fragment = `
/*---------------------------------------------------------
	fork of Voxel Game Evolution 	
    
TIPS:    
	when switching to full screen press L until you get better performance (K for higher resolution)
CONTROLS:
    see Voxel Game Evolution

//-----------------------------------------------------*/



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
    fragColor = texture(iChannel3, fragCoord * renderResolution / iResolution.xy / iResolution.xy);
    //fragColor = texture(iChannel3, fragCoord);
    
    if(load(_inventory).r>.0){   
   	     vec4 gui = drawInventory(fragCoord);
   	    fragColor = mix(fragColor, gui, gui.a);
    }
    

}

`;

export default class implements iSub {
  key(): string {
    return '7lj3zw';
  }
  name(): string {
    return 'MC World';
  }
  // sort() {
  //   return 0;
  // }
  common() {
    return common;
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
    return [
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffB, fi: 1 }, //
      { type: 1, f: buffC, fi: 2 }, //
      { type: 1, f: buffD, fi: 3 }, //
    ];
  }
}
