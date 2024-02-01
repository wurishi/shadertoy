import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// in progress
//#define WITH_PLANETS  


const float PI = 3.14159265359;
const float DEG_TO_RAD = (PI / 180.0);
const float MAX = 10000.0;

// Unit = 10 UA
const int   GALAXY_FIELD_VOXEL_STEPS = 10;
const float GALAXY_FIELD_VOXEL_STEP_SIZE = 250000.; // 2,500,000 AL
const float GALAXY_RADIUS = .015;  // (% of 250000)  50,000 AL

const int   STAR_FIELD_VOXEL_STEPS = 13;
const float STAR_FIELD_VOXEL_STEP_SIZE = .5;  // 5AL 
const float STAR_RADIUS = .01; // 2e-8 in true life !   // (% of 5)   1e-8

const float PLANET_FIELD_SCALE = 75.;
const int   PLANET_FIELD_VOXEL_STEPS = 10;
const float PLANET_FIELD_VOXEL_STEP_SIZE = .5;  // 5AL 
const float PLANET_RADIUS = .04; 


const float kU2G = GALAXY_FIELD_VOXEL_STEP_SIZE/STAR_FIELD_VOXEL_STEP_SIZE;
const float kG2U = STAR_FIELD_VOXEL_STEP_SIZE/GALAXY_FIELD_VOXEL_STEP_SIZE;




float time;

float keyPress(int ascii) {
	return texture(iChannel2,vec2((.5+float(ascii))/256.,0.25)).x ;
}





// Time spend traveling to clicked point
#define TRAVEL_DELAY 4.

#define IN_UNIVERSE 1.
#define IN_GALAXY 2.
#define IN_SOLAR_SYSTEM 3.

#define MOVING     1.
#define STATIONARY 2.

#define NONE     0.
#define GALAXY   1.
#define STAR     2.
#define PLANET   3.

struct Config {
 	float movingMode;
    float targetType;
    float coordSystem;
    float time;
    vec3 ro_cam;
    vec3 rd_cam;
    vec3 target_pos;
    vec3 galaxy_pos;
    vec3 ro_from;
    vec3 ro_to;
    vec3 rd_from;
    vec3 rd_to;
};
    
    
#define HASHSCALE1 .1031
float hash(vec3 p3) {
	p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

/*
vec3 hash33( const in vec3 p) {
    return fract(vec3(
        sin(dot(p,    vec3(127.1,311.7,758.5453123))),
        sin(dot(p.zyx,vec3(127.1,311.7,758.5453123))),
        sin(dot(p.yxz,vec3(127.1,311.7,758.5453123))))*43758.5453123);
}
*/

#define HASHSCALE3 vec3(.1031, .1030, .0973)
//#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)
vec3 hash33(vec3 p3){
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float distanceRayPoint(vec3 ro, vec3 rd, vec3 p, out float h) {
    h = dot(p-ro,rd);
    return length(p-ro-rd*h);
}

// Toujours en coordonnes Univers
bool renderGalaxyField( in vec3 roU, in vec3 rd, out vec3 out_posU, out vec3 out_id) { 
    float d, dint;
    vec3 ros = roU + rd*d,   
		pos = floor(ros),
		ri = 1./rd,
		rs = sign(rd),
		dis = (pos-ros + 0.5 + rs*0.5) * ri,
		offset, id, galaxyro;
    
    float pitch = 10./iResolution.x;
    
	for( int i=0; i<GALAXY_FIELD_VOXEL_STEPS; i++ ) {
        id = hash33(pos);
        offset = clamp(id, GALAXY_RADIUS, 1.-GALAXY_RADIUS);
        
        // Si on intersectionne avec la boundingbox (sphere)
        d = distanceRayPoint(ros, rd, pos+offset, dint);
        if( dint > 0. && d < GALAXY_RADIUS*.5+dint*pitch ) {
            galaxyro = pos+offset;
            out_posU = galaxyro;
        	out_id = id;
        	return true;	    
        }
        
		vec3 mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
		dis += mm * rs * ri;
        pos += mm * rs;
	}
    
	return false;
}



// Toujours en coordonnes Galaxy
bool renderStarField(vec3 galaxyId, in vec3 roG, in vec3 rd, out vec3 out_posG, out vec3 out_id) { 
    out_id = vec3(9);

    float d, dint;
    vec3 ros = roG + rd*d,
	 	pos = floor(ros),
		ri = 1./rd,
		rs = sign(rd),
		dis = (pos-ros + 0.5 + rs*0.5) * ri,	
		mm, offset = vec3(0.), id, galaxyro;

    float pitch = 10./iResolution.x;
    
	for( int i=0; i<STAR_FIELD_VOXEL_STEPS; i++ ) {
        id = hash33(pos);
        offset = clamp(id, STAR_RADIUS, 1.-STAR_RADIUS);
        d = distanceRayPoint(ros, rd, pos+offset, dint);
        if (dint > 0. && d < STAR_RADIUS*.5+dint*pitch) {
	        out_posG = pos+offset;
   	     	out_id = id;
        	return true;
        }
		mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
		dis += mm * rs * ri;
        pos += mm * rs;
	}

	return false;
}


#ifdef WITH_PLANETS

bool renderPlanetField(in vec3 sunPos, in vec3 roG, in vec3 rd, out vec3 out_posG, out vec3 out_id) { 
    out_id = vec3(9);
    float scale = 50.;
    roG -= sunPos;
    roG *= PLANET_FIELD_SCALE;
    roG.z+=.5;

    float rayon = 3.;
    float min_dist=0., max_dist=100.;
    
    vec4 col, sum = vec4(0);
    float pitch = 10./iResolution.x;
    float dint, d = max(0., (length(roG)-rayon)); //min_dist;
    vec3 offset, id,
        ros = roG + rd*d,  
        pos = floor(ros),
        ri = 1./rd,
        rs = sign(rd),
        dis = (pos-ros + .5 + rs*.5) * ri;

    for( int i=0; i<PLANET_FIELD_VOXEL_STEPS; i++ ) {
        if (length(pos) < rayon && abs(pos.z)<1. && hash(pos+sunPos)>.75) {
            id = hash33(pos+sunPos);
            offset = clamp(id,PLANET_RADIUS, 1.-PLANET_RADIUS);
            offset.z = .5;
            d = distanceRayPoint(ros, rd, pos+offset, dint);
            if(dint > 0. && d<PLANET_RADIUS+dint*pitch ) {
                vec3 pp = pos+offset;
                pp.z-=.5;
                out_posG = (pp/scale)+sunPos;
                out_id = id;
                return true;
            }
        }
        vec3 mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
        dis += mm * rs * ri;
        pos += mm * rs;

    }
    return false;
}

#endif
    
//--------------------------------------------------------------------
// from iq shader Brick [https://www.shadertoy.com/view/MddGzf]
//--------------------------------------------------------------------   
float isInside( vec2 p, vec2 c ) { vec2 d = abs(p-.5-c) - .5; return -max(d.x,d.y); }
void store( in vec2 re, in vec4 va, inout vec4 fragColor, in vec2 fragCoord) {
    fragColor = ( isInside(fragCoord,re) > 0. ) ? va : fragColor;
}
void store( in vec2 re, in vec3 va, inout vec4 fragColor, in vec2 fragCoord) {
    fragColor = ( isInside(fragCoord,re) > 0. ) ? vec4(va,0.) : fragColor;
}
//--------------------------------------------------------------------


void saveConfig(Config cfg, inout vec4 c, in vec2 f) {
	store(vec2(0.,0.), vec4(cfg.movingMode, cfg.targetType, cfg.coordSystem, cfg.time), c, f);
	store(vec2(1.,0.), cfg.ro_cam,    c, f);
	store(vec2(2.,0.), cfg.rd_cam,    c, f);
	store(vec2(3.,0.), cfg.target_pos,c, f);
    store(vec2(4.,0.), cfg.galaxy_pos,c, f);
	store(vec2(5.,0.), cfg.ro_from,   c, f);
    store(vec2(6.,0.), cfg.ro_to,     c, f);
    store(vec2(7.,0.), cfg.rd_from,   c, f);
    store(vec2(8.,0.), cfg.rd_to,     c, f);
}

#define CONF(id)  texture(iChannel0, vec2(id+.5,.5)/ iChannelResolution[0].xy, -100.0).xyz;
#define CONF4(id) texture(iChannel0, vec2(id+.5,.5)/ iChannelResolution[0].xy, -100.0);
Config getConfig() { 
    vec4 v1        = CONF4(0.);
    Config cfg;
    cfg.movingMode = v1.x > 1.5 ? STATIONARY : 
                     MOVING;
    cfg.targetType = v1.y > 2.5 ? PLANET : 
    				 v1.y > 1.5 ? STAR:
    				 v1.y > 0.5 ? GALAXY:
    				 NONE;
    cfg.coordSystem =v1.z > 2.5 ? IN_SOLAR_SYSTEM :
    				 v1.z > 1.5 ? IN_GALAXY :				
                     IN_UNIVERSE;
    cfg.time = v1.w;
    cfg.ro_cam     = CONF(1.);
    cfg.rd_cam     = CONF(2.);
    cfg.target_pos = CONF(3.);
    cfg.galaxy_pos = CONF(4.);
    cfg.ro_from    = CONF(5.);
    cfg.ro_to      = CONF(6.);
    cfg.rd_from    = CONF(7.);
    cfg.rd_to      = CONF(8.);
    return cfg;
}


bool isInGalaxy(in vec3 roU, out vec3 out_GalaxyId, out vec3 out_GalaxyPosU) {
    vec3 pos = floor(roU);
    out_GalaxyId = hash33(pos);
    
    vec3 offset = clamp(out_GalaxyId, GALAXY_RADIUS, 1.-GALAXY_RADIUS);
    out_GalaxyPosU = (pos+offset);
    
    return length(roU - out_GalaxyPosU) < GALAXY_RADIUS;
}

// Echelle 1 pour la grille des galaxies 
vec3 galaxyToUniverse(vec3 galaxyPosU, vec3 coord) {
    return coord*kG2U + galaxyPosU;
}

// Centré sur le centre de la galaxie
// Echelle 1 pour la grille des etoiles
vec3 universeToGalaxy(vec3 galaxyPosU, vec3 coord) {
    return (coord-galaxyPosU)*kU2G;
}

Config galaxyToUniverse(vec3 galaxyPosU, Config cfg) {
	cfg.coordSystem = IN_UNIVERSE;
    cfg.galaxy_pos = galaxyPosU;
    cfg.ro_cam =  galaxyToUniverse(galaxyPosU, cfg.ro_cam);
    cfg.ro_from = galaxyToUniverse(galaxyPosU, cfg.ro_from);
    cfg.ro_to =   galaxyToUniverse(galaxyPosU, cfg.ro_to);
    cfg.target_pos = galaxyToUniverse(galaxyPosU, cfg.target_pos);
    return cfg;
}

Config universeToGalaxy(vec3 galaxyPosU, Config cfg) {
	cfg.coordSystem = IN_GALAXY;
    cfg.galaxy_pos = galaxyPosU;
    cfg.ro_cam =  universeToGalaxy(galaxyPosU, cfg.ro_cam);
    cfg.ro_from = universeToGalaxy(galaxyPosU, cfg.ro_from);
    cfg.ro_to =   universeToGalaxy(galaxyPosU, cfg.ro_to);
    cfg.target_pos = universeToGalaxy(galaxyPosU, cfg.target_pos);
	return cfg;
}

#define R(p, a) p=cos(a)*p+sin(a)*vec2(p.y, -p.x)

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
		
    if (fragCoord.y > 0.5 || fragCoord.x > 10.) discard;
            vec2 uv = iMouse.xy / iResolution.xy;
        vec2 p = -1.0 + 2.0 * uv;
        p.x *= iResolution.x/iResolution.y;

// - Initialisation si besoin -------------------------
    Config cfg;    
    if(iFrame < 10) { 
        
        cfg.rd_cam = normalize(vec3(1.,0.,0.));
 
        vec3 pos = floor(vec3(10.));
        vec3 id = hash33(pos),
        offset = clamp(id, GALAXY_RADIUS, 1.-GALAXY_RADIUS);
        cfg.ro_cam = pos + offset-.03*cfg.rd_cam;
        vec3 mov = .03*cfg.rd_cam;
        vec3 center = cfg.ro_cam + mov; 
        R(mov.yz, 1.);
        R(mov.xy, 1.);
        cfg.ro_cam = center - mov;
        cfg.rd_cam = normalize(mov);
        
        cfg.movingMode = STATIONARY;
        cfg.targetType = GALAXY;
        cfg.coordSystem = IN_UNIVERSE;
        cfg.time = iTime;
        cfg.ro_from = cfg.ro_cam;
        cfg.rd_from = cfg.rd_cam;
        cfg.ro_to = cfg.ro_cam;
        cfg.rd_to = cfg.rd_cam;
        cfg.galaxy_pos = vec3(0);
        cfg.target_pos = vec3(1);//center;

    } else {

// - Lecture de la configuration -----------------------
        cfg = getConfig();

		bool isU = (cfg.coordSystem == IN_UNIVERSE),
			 isG = (cfg.coordSystem == IN_GALAXY);

        float time = iTime - cfg.time;
        
// - Camera --------------------------------------------        
        vec3 ro, ta, rd_cam, up;
        float smoth = smoothstep(0., TRAVEL_DELAY, time);
        
        if (cfg.movingMode == MOVING) { 
            ro =     mix(cfg.ro_from, cfg.ro_to, smoth);
            rd_cam = mix(cfg.rd_from, cfg.rd_to, smoth);
        } else {
            // rotation autour de la cible
            if (cfg.targetType != NONE) {                
                vec3 mov = cfg.rd_to*(cfg.targetType==PLANET?(.03/PLANET_FIELD_SCALE):.03);
                vec3 center = cfg.ro_to + mov; 
                R(mov.yz, .05*smoth*time);
                R(mov.xy, .05*smoth*time);
                ro = center - mov;
                rd_cam = normalize(mov);
            } else {
                // ballade
	        	ro = cfg.ro_cam+.005*cfg.rd_cam;
    	        rd_cam = cfg.rd_cam;
                R(rd_cam.yz, .002);
            }
        }
        
        // leger tangage
        up = normalize(vec3(.1*cos(.1*iTime), .3*cos(.1*iTime), 1.));

        vec3 ww = normalize(rd_cam),
        	 uu = normalize(cross(ww,up)),
        	 vv = normalize(cross(uu,ww)),
        	 rd = normalize(-p.x*uu + p.y*vv + 2.*ww );

// - Est t on dans une galaxie ? --------------------------------     
        vec3 galaxyId, galaxyPosU;
        bool inGalaxy = isInGalaxy(isU ? ro : galaxyToUniverse(cfg.galaxy_pos, ro), galaxyId, galaxyPosU);

// - Recherche des clicks sur les objets
        vec3 targetPosU, targetPosG, targetId;
     
        // - Click Galaxy Field ------------------------------------------

        bool isHitGalaxy = false, isHitStar = false, isHitPlanet = false;

        // Le calcul se fait toujours en coordonnees univers
        vec3 roU = isG ? galaxyToUniverse(cfg.galaxy_pos, ro) : ro;
        isHitGalaxy = renderGalaxyField( roU, rd, targetPosU, targetId);
        if (isG && length(roU - targetPosU) > 3.) isHitGalaxy = false;
        if (isHitGalaxy) {
            targetPosG = universeToGalaxy(cfg.galaxy_pos,targetPosU);    
        }
// - Click Star Field ------------------------------------------

        if (isG && !isHitGalaxy) {
            // Le calcul se fait toujours en coordonnees Galaxie       
            vec3 roG = ro;    
            isHitStar = renderStarField(galaxyId, roG, rd, targetPosG, targetId );
			if (isHitStar) targetPosU = galaxyToUniverse(cfg.galaxy_pos,targetPosG);                 
            
#ifdef WITH_PLANETS
            vec3 id0 = hash33(floor(roG));
        	vec3 posSun = floor(roG) + clamp(id0, STAR_RADIUS, 1.-STAR_RADIUS);            
            isHitPlanet = renderPlanetField(posSun, roG, rd, targetPosG, targetId);
            if (isHitPlanet) targetPosU = galaxyToUniverse(cfg.galaxy_pos,targetPosG);                 
#endif
        }
        


// - Generate new Configuration ----------------------------

        cfg.ro_cam = ro;
        cfg.rd_cam = rd_cam;

        // On est en mode attente
        if (cfg.movingMode == STATIONARY) { // stationary
            
            // click en cours
            bool isClick = (iMouse.z != 0. && abs(iMouse.z - iMouse.x) < 3. && abs(iMouse.w - iMouse.y) <3.)
                           || (keyPress(32) >.5);

            if (isClick) {
                // On va declancher un mouvement vers le point cliqué
				cfg.targetType = 
                    	isHitGalaxy ? GALAXY :
                		isHitStar ? STAR :
                		isHitPlanet ? PLANET : NONE;
                cfg.ro_from = ro;
                cfg.ro_to = 
                    isHitGalaxy ? (isU ? targetPosU-(cfg.target_pos==vec3(1)||targetPosU==cfg.target_pos?0.:.03)*rd : targetPosG-.03*rd*kU2G) : // vers la cible
                    isHitStar ? targetPosG-.03*rd :
                	isHitPlanet ? targetPosG-.06*rd/PLANET_FIELD_SCALE :
                    ro + 3.*rd; // 3 unitees dans la direction du click

                cfg.rd_from = rd_cam;
                cfg.rd_to = rd;
                cfg.movingMode = MOVING;            
                cfg.time = iTime;
                cfg.target_pos = isU ? targetPosU : targetPosG;
                //((isHitGalaxy && targetId!=cfg.target_id)) ? targetId : isHitStar ? vec3(.5) : isHitPlanet ? vec3(9.) : vec3(0.);
            }
            
        } else { 
          // En mouvement vers une cible
            if (isU && inGalaxy) {
                // On vient de rentrer dans une galaxie, on change de coordonnes pour garder la precision
                cfg = universeToGalaxy(galaxyPosU, cfg);
                
            } else if (isG && !inGalaxy) {
                if (length(ro)*kG2U > GALAXY_RADIUS*3.) {
                // On vient de sortir de la galaxy, on change de systeme de coordonnes pour garder la precision   
       				cfg = galaxyToUniverse(galaxyPosU, cfg);
                }
            } 
          
            if (iTime - cfg.time > TRAVEL_DELAY+1.) {
                cfg.movingMode = STATIONARY;            
                cfg.time = iTime;  
            }
        }

    }
    
    
// - Save new Configuration -----------------------------------
    fragColor = vec4(0.);
    saveConfig(cfg, fragColor, fragCoord);
}


`;

const fragment = `
// Created by sebastien durand - 11/2016
//-------------------------------------------------------------------------------------
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
//-------------------------------------------------------------------------------------
// Some part of code are extracted, adaptated or inspired by
//
// Planet Shadertoy by Reinder Nijhoff [https://www.shadertoy.com/view/4tjGRh]
// Type 2 Supernova by Duke (https://www.shadertoy.com/view/lsyXDK) 
// Supernova remnant by Duke [https://www.shadertoy.com/view/MdKXzc]
// Awesome star by Foxes [https://www.shadertoy.com/view/4lfSzS]
// Black Body Spectrum plank by FabriceNeyret2 [https://www.shadertoy.com/view/4tdGWM]
// Alien Beacon by otaviogood's [https://www.shadertoy.com/view/ld2SzK]
// Hash without Sine by Dave_Hoskins [https://www.shadertoy.com/view/4djSRW]
// Noise - value - 3D by iq [https://www.shadertoy.com/view/4sfGzS]
// Smooth HSV by iq [https://www.shadertoy.com/view/MsS3Wc]
// And many others  :)
//-------------------------------------------------------------------------------------


// Some stranges behaviours detected under 
//     Ubunto - Firefox and 
//     Manjaro linux - chromium - ati 280
//  => strange navigation, star disaper when clicked
 

#define WITH_INTERGALACTIC_CLOUDS

// in progress
//#define WITH_PLANETS  

// If fast enougth
#define WITH_SUPERNOVA_REMNANT
//#define WITH_DOUBLE_GALAXY;


#define R(p, a) p=cos(a)*p+sin(a)*vec2(p.y, -p.x)


#define SPIRAL_NOISE_ITER 6

const float PI = 3.14159265359;
const float DEG_TO_RAD = (PI / 180.0);

// Unit = 10 UA
const int   GALAXY_FIELD_VOXEL_STEPS = 16;
const int   GALAXY_FIELD_VOXEL_STEPS_HD = 7;
const float GALAXY_FIELD_VOXEL_STEP_SIZE = 250000.; // 2,500,000 AL
const float GALAXY_RADIUS = .015;  // (% of 250000)  50,000 AL

const int   STAR_FIELD_VOXEL_STEPS = 22;
const float STAR_FIELD_VOXEL_STEP_SIZE = .5;  // 5AL 
const float STAR_RADIUS = .01; // 2e-8 in true life !   // (% of 5)   1e-8

const float PLANET_FIELD_SCALE = 75.;
const int   PLANET_FIELD_VOXEL_STEPS = 10;
const float PLANET_FIELD_VOXEL_STEP_SIZE = .5;  // 5AL 
const float PLANET_RADIUS = .04;


const float kU2G = GALAXY_FIELD_VOXEL_STEP_SIZE/STAR_FIELD_VOXEL_STEP_SIZE;
const float kG2U = STAR_FIELD_VOXEL_STEP_SIZE/GALAXY_FIELD_VOXEL_STEP_SIZE;

const vec3  SUN_COLOR = vec3(.3, .21, .165);

float time;


//-----------------------------------------------------


#define IN_UNIVERSE 1.
#define IN_GALAXY 2.
#define IN_SOLAR_SYSTEM 3.

#define MOVING     1.
#define STATIONARY 2.

#define NONE     0.
#define GALAXY   1.
#define STAR     2.
#define PLANET   3.


struct Config {
 	float movingMode;
    float targetType;
    float coordSystem;
    float time;
    vec3 ro_cam;
    vec3 rd_cam;
    vec3 target_pos;
    vec3 galaxy_pos;
};
    
//--------------------------------------------------------------------
// from iq shader Brick [https://www.shadertoy.com/view/MddGzf]
//--------------------------------------------------------------------

#define CONF(id)  texture(iChannel0, vec2(id+.5,.5)/ iChannelResolution[0].xy, -100.0).xyz;
#define CONF4(id) texture(iChannel0, vec2(id+.5,.5)/ iChannelResolution[0].xy, -100.0);

Config getConfig() { 
    vec4 v1 = CONF4(0.);
    Config cfg;
    
    cfg.movingMode = v1.x > 1.5 ? STATIONARY : 
                     MOVING;
    cfg.targetType = v1.y > 2.5 ? PLANET : 
    				 v1.y > 1.5 ? STAR:
    				 v1.y > 0.5 ? GALAXY:
    				 NONE;
    cfg.coordSystem = v1.z > 2.5 ? IN_SOLAR_SYSTEM :
    				  v1.z > 1.5 ? IN_GALAXY :				
                      IN_UNIVERSE;
    cfg.time = v1.w;
    cfg.ro_cam = CONF(1.);
    cfg.rd_cam = CONF(2.);
    cfg.target_pos = CONF(3.);
    cfg.galaxy_pos = CONF(4.);
    return cfg;
}

//-----------------------------------------------------
// Paletes functions
//-----------------------------------------------------

// from FabriceNeyret2 shader Black Body Spectrum plank [https://www.shadertoy.com/view/4tdGWM]
vec3 blackBodyColor(float k) {
    float T = (k*2.)*16000.;
    vec3 c = vec3(1.,3.375,8.)/(exp((19e3*vec3(1.,1.5,2.)/T)) - 1.); // Planck law
    return c / max(c.r,max(c.g,c.b));  // chrominance
}

//-----------------------------------------------------
// Noise functions
//-----------------------------------------------------
// Hash without Sine by Dave_Hoskins [https://www.shadertoy.com/view/4djSRW]
//----------------------------------------------------------------------------------------

#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)
#define HASHSCALE1 .1031

float hash(float p)
{
	vec3 p3  = fract(vec3(p) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

//----------------------------------------------------------------------------------------
//  1 out, 2 in...
float hash(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

//----------------------------------------------------------------------------------------
//  1 out, 3 in...
float hash(vec3 p3)
{
	p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec4 hash4(const in vec4 n) { return fract(sin(n)*1399763.5453123); }


vec3 hash33(vec3 p3) {
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

vec4 hash43(vec3 p) {
	vec4 p4 = fract(vec4(p.xyzx)  * HASHSCALE4);
    p4 += dot(p4, p4.wzxy+19.19);
	return fract(vec4((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}

//----------------------------------------------------------------------------------------



// [iq] https://www.shadertoy.com/view/4sfGzS
float noise(const in vec3 x) {
    vec3 p = floor(x), f = fract(x);
	f *= f*(3.-f-f);
	vec2 uv = (p.xy+vec2(37.,17.)*p.z) + f.xy,
	     rg = textureLod( iChannel1, (uv+.5)/256., -100.).yx;
	return mix(rg.x, rg.y, f.z);
}

float pn(const in vec3 x) {
    vec3 p = floor(x), f = fract(x);
	f *= f*(3.-f-f);
	vec2 uv = (p.xy+vec2(37.,17.)*p.z) + f.xy,
	     rg = textureLod( iChannel1, (uv+.5)/256., -100.).yx;
	return 2.4*mix(rg.x, rg.y, f.z)-1.;
}

float bm(const in vec3 x) {
    vec3 p = floor(x), f = fract(x);
	f *= f*(3.-f-f);
	vec2 uv = (p.xy+vec2(37.,17.)*p.z) + f.xy,
	     rg = textureLod( iChannel1, (uv+ .5)/256., -100.).yx;
	return 1.-.82*mix(rg.x, rg.y, f.z);
}

float fpn(const in vec3 p) { 
    return pn(p*.06125)*.5 + 
           pn(p*.125)*.25 + 
           pn(p*.25)*.125;// + pn(p*.5)*.625;
}

float fbm(const in vec3 p) {
   return bm(p*.06125)*.5 + 
          bm(p*.125)*.25 + 
          bm(p*.25)*.125 + 
          bm(p*.4)*.2;
}

const mat3 msun = mat3(0., .8, .6, -.8, .36, -.48, -.6, -.48, .64);

float smoothNoise(in vec3 q){
	float f  = .5000*noise(q); q=msun*q*2.01;
          f += .2500*noise(q); q=msun*q*2.02;
          f += .1250*noise(q); q=msun*q*2.03;
          f += .0625*noise(q);
	return f;
}

//-------------------------------------------------------------------------------------
// otaviogood's noise from https://www.shadertoy.com/view/ld2SzK
//--------------------------------------------------------------
// This spiral noise works by successively adding and rotating sin waves while increasing frequency.
// It should work the same on all computers since it's not based on a hash function like some other noises.
// It can be much faster than other noise functions if you're ok with some repetition.
const float nudge = 20.;	// size of perpendicular vector
float normalizer = 1.0 / sqrt(1.0 + nudge*nudge);	// pythagorean theorem on that perpendicular to maintain scale
float SpiralNoiseC(vec3 p, vec4 id) {
    float iter = 2., n = 2.-id.x; // noise amount
    for (int i = 0; i < SPIRAL_NOISE_ITER; i++) {
        n += -abs(sin(p.y*iter) + cos(p.x*iter)) / iter; // add sin and cos scaled inverse with the frequency (abs for a ridged look)
        p.xy += vec2(p.y, -p.x) * nudge; // rotate by adding perpendicular and scaling down
        p.xy *= normalizer;
        p.xz += vec2(p.z, -p.x) * nudge; // rotate on other axis
        p.xz *= normalizer;  
        iter *= id.y + .733733;          // increase the frequency
    }
    return n;
}

float mapIntergalacticCloud(vec3 p, vec4 id) {
	float k = 2.*id.w +.1;  // p/=k;
    return k*(.5 + SpiralNoiseC(p.zxy*.4132+333., id)*3. + pn(p*8.5)*.12);
}

#ifdef WITH_SUPERNOVA_REMNANT

bool RaySphereIntersect(vec3 org, vec3 dir, out float near, out float far)
{
	float b = dot(dir, org);
	float c = dot(org, org) - 8.;
	float delta = b*b - c;
	if( delta < 0.0) 
		return false;
	float deltasqrt = sqrt(delta);
	near = -b - deltasqrt;
	far = -b + deltasqrt;
	return far > 0.0;
} 

const float nudge2 = .9;	// size of perpendicular vector
float normalizer2 = 1. / sqrt(1. + nudge2*nudge2);	// pythagorean theorem on that perpendicular to maintain scale
float SpiralNoiseC2(vec3 p) {
    float n = 0., iter = 2.;
    for (int i = 0; i < 8; i++) {
        n += -abs(sin(p.y*iter) + cos(p.x*iter)) / iter;	// abs for a ridged look
        p.xy += vec2(p.y, -p.x) * nudge2;
        p.xy *= normalizer2;
        p.xz += vec2(p.z, -p.x) * nudge2;
        p.xz *= normalizer2;
        iter *= 1.733733;
    }
    return n;
}

float length2( vec2 p) {
	return sqrt(p.x*p.x + p.y*p.y);
}

float length8(vec2 p) {
	p = p*p; p = p*p; p = p*p;
	return pow(p.x + p.y, .125);
}

float Disk(vec3 p, vec3 t) {
    vec2 q = vec2(length2(p.xy)-t.x,p.z*0.5);
    return max(length8(q)-t.y, abs(p.z) - t.z);
}

float mapSupernovaRemnant(vec3 p) {
	p*=2.;
    float noi = Disk(p.xzy,vec3(2.0,1.8,1.25))+
    	+ fbm(p*90.)
    	+ SpiralNoiseC2(p.zxy*0.5123+100.0)*3.0;
	return abs(noi*.5)+0.07;
}

#endif // WITH_SUPERNOVA_REMNANT




//-----------------------------------------------------
// Intersection functions (mainly adapted from iq ones)
//-----------------------------------------------------

bool intersectSphere(in vec3 ro, in vec3 rd, in float r, out float dist, out float edge) {
	float b = dot(rd,-ro), d = b*b - dot(ro,ro) + r*r;
	if (d < 0.) return false;
    edge = sqrt(d);
	dist = b - edge;
	return dist > 0.;
}

bool cylinder(vec3 ro, vec3 rd, float r, float h, out float tn, out float tf) {
	float a = dot(rd.xy, rd.xy), b = dot(ro.xy, rd.xy),
		  d = b*b - a*(dot(ro.xy, ro.xy) - r*r);    
	if(d < 0.) return false;
	d = sqrt(d);
	tn = (-b - d)/a; tf = (-b + d)/a;
	a = min(tf, tn); tf = max(tf, tn); tn = a; // order roots
	a = ro.z + tn * rd.z;
    b = ro.z + tf * rd.z;
	// top, bottom
	vec2 zcap = h*vec2(.5, -.5), cap = (zcap - ro.z) / rd.z;
    tn = a < zcap.y ? cap.y : a > zcap.x ? cap.x : tn;
	tf = b < zcap.y ? cap.y : b > zcap.x ? cap.x : tf;
    return tf > 0. && tf > tn;
}

float distanceRayPoint(vec3 ro, vec3 rd, vec3 p, out float h) {
    h = dot(p-ro,rd);
    return length(p-ro-rd*h);
	//return length(cross(p-ro,rd));
}

// +------------------------------------------------------+
// |                 Star ray effect                      |
// +------------------------------------------------------+

//---------------------------------------------------------
// Awesome star by Foxes [https://www.shadertoy.com/view/4lfSzS]
//---------------------------------------------------------
 
float noise4q(vec4 x) {
	vec4 n3 = vec4(0,.25,.5,.75);
	vec4 p2 = floor(x.wwww+n3);
	vec4 b = floor(x.xxxx+n3) + floor(x.yyyy+n3)*157. + floor(x.zzzz +n3)*113.;
	vec4 p1 = b + fract(p2*.00390625)*vec4(164352., -164352., 163840., -163840.);
	p2 = b + fract((p2+1.0)*.00390625)*vec4(164352., -164352., 163840., -163840.);
	vec4 f1 = fract(x.xxxx+n3),f2 = fract(x.yyyy+n3);
	f1 *= f1*(3.0-f1-f1);
	f2 *= f2*(3.0-f2-f2);
	vec4 n1 = vec4(0,1.,157.,158.), 
         n2 = vec4(113.,114.,270.0,271.);	
	vec4 vs1 = mix(hash4(p1), hash4(n1.yyyy+p1), f1),
         vs2 = mix(hash4(n1.zzzz+p1), hash4(n1.wwww+p1), f1),
         vs3 = mix(hash4(p2), hash4(n1.yyyy+p2), f1),
         vs4 = mix(hash4(n1.zzzz+p2), hash4(n1.wwww+p2), f1);	
	vs1 = mix(vs1, vs2, f2);
	vs3 = mix(vs3, vs4, f2);
	vs2 = mix(hash4(n2.xxxx+p1), hash4(n2.yyyy+p1), f1);
	vs4 = mix(hash4(n2.zzzz+p1), hash4(n2.wwww+p1), f1);
	vs2 = mix(vs2, vs4, f2);
	vs4 = mix(hash4(n2.xxxx+p2), hash4(n2.yyyy+p2), f1);
	vec4 vs5 = mix(hash4(n2.zzzz+p2), hash4(n2.wwww+p2), f1);
	vs4 = mix(vs4, vs5, f2);
	f1 = fract(x.zzzz+n3);
	f2 = fract(x.wwww+n3);
	f1 *= f1*(3.-f1-f1);
	f2 *= f2*(3.-f2-f2);
	vs1 = mix(vs1, vs2, f1);
	vs3 = mix(vs3, vs4, f1);
	vs1 = mix(vs1, vs3, f2);
	float r = dot(vs1,vec4(.25));
	return r*r*(3.-r-r);
}

// rays of a star
float ringRayNoise(vec3 ray, vec3 pos, float r, float size, float anim) {
  	float b = dot(ray,pos);
    vec3 pr = ray*b-pos;
    float c = length(pr),
     	  s = max(0.,(1.-size*abs(r-c)));
    pr = pr/c;
    float n=.4, ns=1., nd = noise4q(vec4(pr*1.0,-anim+c))*2.0;
    if (c > r) {
        n  = noise4q(vec4(pr*10.0,-anim+c));
        ns = noise4q(vec4(pr*50.0,-anim*2.5+ c+c))*2.;
    }
    n *= n*nd*nd*ns;
    return s*s*(s*s+n);
}


// +------------------------------------------------------+
// |                  Sun Lava effect                     |
// +------------------------------------------------------+

vec3 getSunColor(in vec3 p, in vec4 id, in float time) {
    float lava = smoothNoise((p+vec3(time*.03))*50.*(.5+id.z) );
    return blackBodyColor(.02+3.*clamp(id.x*id.x,.05,1.)*(1. - sqrt(lava)));
}

vec4 renderSun(in vec3 ro, in vec3 rd, in vec4 id, in float time) {
	// Rotate view to integrate sun rotation 
    // R(ro.zx, 1.6-time*.5*id.w);
    // R(rd.zx, 1.6-time*.5*id.w);
    vec4 color = vec4(0.);
    float dist, edge;   
    if (intersectSphere(ro, rd, 1., dist, edge)) {
        vec3  pos = ro+rd*dist,
        	  nor = normalize(pos);
    	color = vec4(getSunColor(pos, id, time), smoothstep(0., .2, edge));
    }
    // Rays
    float s3 = ringRayNoise(rd,ro,1.0,5.-4.*id.y,time);
	color.a = max(color.a, clamp(s3,0.,.98));
    color.rgb += blackBodyColor(id.x)*s3;
    color.rgb *=  1.-.03*cos(5.*time+2.*hash(time));  // twinkling;
	return clamp(color, vec4(0.),vec4(1.));
}

// ---------------------------------------------------
// Render Supernova Remnant
// ---------------------------------------------------
// Supernova remnant by Duke [https://www.shadertoy.com/view/MdKXzc]
// ---------------------------------------------------

#ifdef WITH_SUPERNOVA_REMNANT

vec3 computeColorSR(float density, float radius) {
	return mix( vec3(1.,.9,.8), vec3(.4,.15,.1), density)
		 * mix( 7.*vec3(.8,1.,1.), 1.5*vec3(.48,0.53,.5), min( (radius+.5)/.9, 1.15 ) );
}

vec4 renderSupernova(vec3 ro, vec3 rd) {
	float td=0., lDist, d, t;
    const float h = .1;
    vec4 sum = vec4(0.);
    float min_dist=0., max_dist=0.;
    vec3 pos;
    
    if (RaySphereIntersect(ro, rd, min_dist, max_dist)) {       
        t = max(min_dist,0.) + .01*hash(rd);
        for (int i=0; i<64; i++) {
            if (td>.9 || sum.a > .99 || t>max_dist) break;
            pos = ro + t*rd;
            d = mapSupernovaRemnant(pos);
            //d = max(d, 0.);
            // point light calculations
            lDist = max(length(pos), .001);
            sum+= vec4(.67,.75,1.,1.)/(lDist*lDist*10.)*.0125; // star itself
            sum+= vec4(1.,.5,.25,.6)/exp(lDist*lDist*lDist*.08)*.033; // bloom
            if (d<h) {
                td += (1. - td) * (h - d) + .005;
                vec4 col = vec4(computeColorSR(td,lDist), td*.2 );
                sum.rgb += sum.a * sum.rgb * .2;	
                col.rgb *= col.a;
                sum += col*(1. - sum.a);  
            }
            td += .014;
            // trying to optimize step size near the camera and near the light source
            t += max(d * .1 * max(min(lDist,length(ro)),1.0), 0.01);
        }
        // simple scattering
      //  sum *= 1. / exp( ld * 0.2 ) * 0.6;
        sum = clamp(sum, 0., 1.);
        sum.xyz *= sum.xyz*(3.-sum.xyz-sum.xyz);
	}    
	return sum;
}

#endif

// +----------------------------------------+
// |               Galaxy                   |
// +----------------------------------------+

float spiralArm(in vec3 p, in float thickness, in float blurAmout, in float blurStyle) {
    float dephase = 2., loop = 4.;
    float a = atan(p.x,p.z),  // angle     
		  r = length(p.xz), lr = log(r), // distance to center
    	  th = .1-.25*r, // thickness according to distance
    	  d = fract(.5*(a-lr*loop)/PI); //apply rotation and scaling.
    d = (.5/dephase - abs(d-.5))*2.*PI*r;
  	d *= (1.-lr)/thickness;  // space fct of distance
    // Perturb distance fiel1
    float radialBlur = blurAmout*mix(fpn(8.*vec3(r*43.,40.*d,24.*p.y)),fpn(p*400.0), blurStyle);
    return sqrt(d*d+10.*p.y*p.y/thickness)-th*r*.2-radialBlur;
}

void galaxyTransForm(inout vec3 ro, const in vec4 id ) {
    R(ro.yz, (id.y-.5));
 // R(ro.xy, .25*id.x*iTime);
}

float mapGalaxy(vec3 p, vec4 id) {  
	float d1 = spiralArm(p.xzy*.2, 10.*(.5+.5*id.x), .2+.3*id.y, id.z);
#ifdef WITH_DOUBLE_GALAXY
    if (id.z<.25) {
   		float d2 = spiralArm(vec3(-p.y,p.z,p.x)*.205, 10.*(.5+.5*id.x), .2+.3*id.y, id.z);        
   		return min(d2, d1);
     } 
#endif    
     return d1;
}

// assign color to the media
vec3 computeColor( float density, float radius ) {
	// color based on density alone, gives impression of occlusion within the media
	return  mix(vec3(.25,.22,.2), vec3(.1,.0375,.025), density )*
	        mix(vec3(4.8,6.,6.),  vec3(.96,1.06,1.), min((radius+.5)*.5, 1.15)); // color added for disk
}

vec4 renderGalaxy(in vec3 ro, in vec3 rd, in vec4 id, in bool fast) { 
	vec4 col, sum = vec4(0);
    float min_dist=0., max_dist=100.;
 
    galaxyTransForm(ro,id);
    galaxyTransForm(rd,id);
    
    if (cylinder(ro, rd, 3.,3.5, min_dist, max_dist)) {
        float ld, td=0., d, t;
		float lDist, lDist2;
        vec3 pos, ldst, ldst2, lightColor;
        const float h = .1;

        t = max(min_dist,t) + .2*hash(rd+iTime);;

        // raymarch loop
        for (int i=0; i<48; i++)  {
            // Loop break conditions.
            if ((fast&&i>20) || td>.9 ||  sum.a > 0.99 || t>max_dist) break;
		
            pos = ro + t*rd;
            
            d = mapGalaxy(3.5*pos, id); // evaluate distance function
            d = abs(d)+.05;  // kind of countour drawing
            d = max(d,.005); // change this string to control density 
            
            if (d<h) {
                // compute local density 
                ld = h - d;         
                ld +=  clamp((ld - mapGalaxy(pos*3.5-.2*normalize(pos), id))*2.5, 0., 1. );
                td += (1. - td) * ld + .005;
                col = vec4(computeColor(td,length(pos)), td*.25 );
                col.rgb *= col.a;
                sum += col*(1. - sum.a);  
            }

            td += .014;
            // point light calculations
            ldst = pos*.25;
            ldst2 = pos*.05;
            ldst2.z *= 2.5;
            lDist  = max(length(ldst),.0001); //max(length(ldst), 0.001);
            lDist2 = max(length(ldst2),.0001);
            // star in center
            lightColor = (1.-smoothstep(3.,4.5,lDist*lDist))*
                mix(.07*vec3(1.,.5,.25)/(lDist),
                    .008*vec3(1.,1.7,2.)/(lDist2), 
                    smoothstep(.2,.7,lDist));

            // star in center
            sum.rgb += lightColor/(lDist*20.); //add a bloom around the light
            d = max(d, .04); 
            t +=  max(d * .3, .02);
        }
   		sum = clamp(sum, 0., 1.);
      	sum.xyz *= sum.xyz*(3.-sum.xyz-sum.xyz);
    }
    
    return sum;
}


//--------------------------------------------------------------
// Adapted from Planet Shadertoy - Reinder Nijhoff [https://www.shadertoy.com/view/4tjGRh]
//--------------------------------------------------------------
// Toujours en coordonnes Univers
vec4 renderGalaxyField(in vec3 roU, in vec3 rd, out vec3 out_posU, out vec3 out_id, in bool fast) { 
    out_id = vec3(9);
      
    float dint, d=0.;
    vec3 offset, id, galaxyro,
         ros = roU + rd*d,
         pos = floor(ros),
         ri = 1./rd,
         rs = sign(rd),
         dis = (pos-ros + .5 + rs*.5) * ri;
	vec4 col, sum = vec4(0);
    
	for( int i=0; i<GALAXY_FIELD_VOXEL_STEPS_HD; i++ ) {
        
        if (!fast || i!=0 ) {//galaxyId != id) {
            id = hash33(pos);
        	offset = clamp(id, GALAXY_RADIUS, 1.-GALAXY_RADIUS);
       		d = distanceRayPoint(ros, rd, pos+offset, dint);
        	if (dint > 0. && d<GALAXY_RADIUS) {
                galaxyro = ros-(pos+offset);
                col = renderGalaxy(galaxyro/GALAXY_RADIUS*3., rd, vec4(id,.5), fast);
            	col.rgb *= smoothstep(float(GALAXY_FIELD_VOXEL_STEPS),0.,length(roU -pos));
                out_id = id;
                sum += (1.-sum.a)*col;
                if (sum.a>.99)
                    break;
            }
        }
		vec3 mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
		dis += mm * rs * ri;
        pos += mm * rs;
	}
    
    if (!fast && sum.a<.99) {
        for( int i=GALAXY_FIELD_VOXEL_STEPS_HD; i<GALAXY_FIELD_VOXEL_STEPS; i++ ) {
            id = hash33(pos);
            offset = clamp(id, GALAXY_RADIUS, 1.-GALAXY_RADIUS);
            d = distanceRayPoint(ros, rd, pos+offset, dint);
            if (dint > 0.) { 
                col = vec4(.9,.9,.8, 1.)*(1.-smoothstep(GALAXY_RADIUS*.25,GALAXY_RADIUS*.5,d));
                col.rgb *= smoothstep(float(GALAXY_FIELD_VOXEL_STEPS),0.,length(roU -pos));
                out_id = id;
                sum += (1.-sum.a)*col;
                if (sum.a>.99)
                    break;
            }

            vec3 mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
            dis += mm * rs * ri;
            pos += mm * rs;
        }
    }

	return sum; 
}

//--------------------------------------------------------------
// Adapted from Planet Shadertoy - Reinder Nijhoff [https://www.shadertoy.com/view/4tjGRh]
//--------------------------------------------------------------
// Toujours en coordonnes Galaxy
vec4 renderStarField(in vec3 roG, in vec3 rd, inout float out_dStar, out vec3 out_id) { 
    out_id = vec3(9);
    
    float dint, d = 0.;
    vec3 offset, id,
         ros = roG + rd*d,  
         pos = floor(ros),
         ri = 1./rd,
         rs = sign(rd),
         dis = (pos-ros + .5 + rs*.5) * ri;
    vec4 col, sum = vec4(0);
    
    float pitch = 10. / iResolution.x;
    
	for( int i=0; i<STAR_FIELD_VOXEL_STEPS; i++ ) {
        id = hash33(pos);
        offset = clamp(id,STAR_RADIUS, 1.-STAR_RADIUS);
        
        d = distanceRayPoint(ros, rd, pos+offset, dint);
        if (dint > 0.) { 
            if (dint < 2. && d<STAR_RADIUS) {
                col =
#ifdef WITH_SUPERNOVA_REMNANT
                	id.x>.8 ? renderSupernova((ros-(pos+offset))*3./STAR_RADIUS, rd) :
#endif
                renderSun((ros-(pos+offset))*2./STAR_RADIUS, rd, vec4(id,.5), iTime);
                out_id = id;
            	if (col.a>.99) out_dStar = dint;
            } else {
                col = (vec4(blackBodyColor(max(id.x-.1, .01)), 1.)*(1.-smoothstep(STAR_RADIUS*.5,STAR_RADIUS,d)));
            }
            col.rgb *= smoothstep(float(STAR_FIELD_VOXEL_STEPS), .5, dint);
            col.rgb *= col.a;				                                
            sum += (1.-sum.a)*col;
            if (sum.a>.99)
                break;
        }
		vec3 mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
		dis += mm * rs * ri;
        pos += mm * rs;
	}
	return sum;
}

#ifdef WITH_PLANETS

vec3 getPlanetColor(in vec3 p, vec4 id) {
    float lava = smoothNoise(p*1.5*(5.*id.z) );
    return blackBodyColor((.5+id.x)*(1. - pow(lava,2.*id.y))); // todo: le faire sur une constante
}

vec4 renderPlanet(in vec3 ro, in vec3 rd, in vec4 id, in vec3 lightDir, float dSun) {
    vec4 color = vec4(0.);
  	float r = 1.;
    float dist, edge;   
    
    if (intersectSphere(ro, rd, r, dist, edge)) {
        if (dist<dSun) {

            vec3  pos = ro+rd*dist,
                  nor = normalize(pos);
            float a = smoothstep(0., .8*r, edge); 
            vec3 oCol = getPlanetColor(pos, id);

            vec3 norm = -normalize(pos);
            float dif = clamp(dot(lightDir, norm), 0.0, 1.0);

            vec3 h = normalize(-rd + lightDir);
            float spe = pow(clamp(dot(h, norm), 0.0, 1.0), 4.0);

            oCol = dif * oCol ;
            oCol += dif * spe;
            color = vec4(oCol, 1.);
       }
    }
	return clamp(color, vec4(0.),vec4(1.));
}


// TODO ue 2D field ex: iq : https://www.shadertoy.com/view/4dSGW1
vec4 renderPlanetField(in vec3 sunPos, in vec3 roG, in vec3 rd, inout float out_dStar, out vec3 out_id) { 
    out_id = vec3(9);

    roG -= sunPos;
    roG *= PLANET_FIELD_SCALE;
    roG.z+=.5;
    
    float distSunDrawing = out_dStar*PLANET_FIELD_SCALE;
    float rayon = 3.;
    float min_dist=0., max_dist=100.;
    
    vec4 col, sum = vec4(0);

  //  if (cylinder(roG, rd, rayon, 1., min_dist, max_dist)) {
        float dint, d = max(0., (length(roG)-rayon)); //min_dist;
        vec3 offset, id,
             ros = roG + rd*d,  
             pos = floor(ros),
             ri = 1./rd,
             rs = sign(rd),
             dis = (pos-ros + .5 + rs*.5) * ri;

        for( int i=0; i<PLANET_FIELD_VOXEL_STEPS; i++ ) {
            if (length(pos) < rayon && abs(pos.z)<1. && hash(pos+sunPos)>.75) {
                id = hash33(pos+sunPos);
                offset = clamp(id,PLANET_RADIUS, 1.-PLANET_RADIUS);
                offset.z = .5;
				
                col = renderPlanet((ros-(pos+offset))/PLANET_RADIUS, rd, vec4(id,.5), normalize((pos+offset)-ros), distSunDrawing);
                out_id = id;
                if (col.a>.95) out_dStar = dint;
                col.rgb *= col.a;				                                
                sum += (1.-sum.a)*col;
                if (sum.a>.99)
                    break;
            }
            vec3 mm = step(dis.xyz, dis.yxy) * step(dis.xyz, dis.zzx);
            dis += mm * rs * ri;
            pos += mm * rs;
            
        }
  //  }
    return sum;
}

#endif
// ---------------------------------------------------
// Render intergalactic clouds
// ---------------------------------------------------


#ifdef WITH_INTERGALACTIC_CLOUDS

//-------------------------------------------------------------------------------------
// Adapted from [iq: https://www.shadertoy.com/view/MsS3Wc]
//-------------------------------------------------------------------------------------
vec3 hsv2rgb(float x, float y, float z) {	
	return z+z*y*(clamp(abs(mod(x*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.)-1.);
}

//-------------------------------------------------------------------------------------
// Based on "Type 2 Supernova" by Duke (https://www.shadertoy.com/view/lsyXDK) 
//-------------------------------------------------------------------------------------
vec4 renderIntergalacticClouds(vec3 ro, vec3 rd, float tmax, const vec4 id) {
    
    float max_dist= min(tmax, float(STAR_FIELD_VOXEL_STEPS)),
		  td=0., d, t, noi, lDist, a, sp = 9.,         
    	  rRef = 2.*id.x,
          h = .05+.25*id.z;
    vec3 pos, lightColor;   
    vec4 sum = vec4(0);
   	
    t = .1*hash(hash(rd)); 

    for (int i=0; i<100; i++)  {
	    if(td>.9 ||  sum.a > .99 || t>max_dist) break;
        a = smoothstep(max_dist,0.,t);
        pos = ro + t*rd;
        d = abs(mapIntergalacticCloud(pos, id))+.07;

        // Light calculations
        lDist = max(length(mod(pos+sp*.5,sp)-sp*.5), .001); // TODO add random offset
        noi = pn(.05*pos);
        lightColor = mix(hsv2rgb(noi,.5,.6), 
                         hsv2rgb(noi+.3,.5,.6), 
                         smoothstep(rRef*.5,rRef*2.,lDist));
        sum.rgb += a*lightColor/exp(lDist*lDist*lDist*.08)/30.;
		// Edges coloring
        if (d<h) {
			td += (1.-td)*(h-d)+.005;  // accumulate density
            sum.rgb += sum.a * sum.rgb * .25 / lDist;  // emission	
			sum += (1.-sum.a)*.02*td*a;  // uniform scale density + alpha blend in contribution 
        } 
        td += .015;
        t += max(d * .08 * max(min(lDist,d),2.), .01);  // trying to optimize step size
    }
    
   	sum = clamp(sum, 0., 1.);   
    sum.xyz *= sum.xyz*(3.-sum.xyz-sum.xyz);
	return sum;
}

#endif 

//-----------------------------------------------------
//        Coordinate system conversions
//-----------------------------------------------------

bool isInGalaxy(in vec3 roU, out vec3 out_GalaxyId, out vec3 out_GalaxyPosU) {
    vec3 pos = floor(roU);
    out_GalaxyId = hash33(pos);
    vec3 offset = clamp(out_GalaxyId, GALAXY_RADIUS, 1.-GALAXY_RADIUS);
    out_GalaxyPosU = (pos+offset);
    return length(roU - out_GalaxyPosU) < GALAXY_RADIUS;
}

// Echelle 1 pour la grille des galaxies 
vec3 galaxyToUniverse(vec3 galaxyPosU, vec3 coord) {
    return coord*kG2U + galaxyPosU;
}

// Centré sur le centre de la galaxie
// Echelle 1 pour la grille des etoiles
vec3 universeToGalaxy(vec3 galaxyPosU, vec3 coord) {
    return (coord-galaxyPosU)*kU2G;
}



/*
float DigitBin( const int x )
{
    return x==0?480599.0:x==1?139810.0:x==2?476951.0:x==3?476999.0:x==4?350020.0:x==5?464711.0:x==6?464727.0:x==7?476228.0:x==8?481111.0:x==9?481095.0:0.0;
}

float PrintValue( const vec2 vStringCoords, const float fValue, const float fMaxDigits, const float fDecimalPlaces )
{
    if ((vStringCoords.y < 0.0) || (vStringCoords.y >= 1.0)) return 0.0;
	float fLog10Value = log2(abs(fValue)) / log2(10.0);
	float fBiggestIndex = max(floor(fLog10Value), 0.0);
	float fDigitIndex = fMaxDigits - floor(vStringCoords.x);
	float fCharBin = 0.0;
	if(fDigitIndex > (-fDecimalPlaces - 1.01)) {
		if(fDigitIndex > fBiggestIndex) {
			if((fValue < 0.0) && (fDigitIndex < (fBiggestIndex+1.5))) fCharBin = 1792.0;
		} else {		
			if(fDigitIndex == -1.0) {
				if(fDecimalPlaces > 0.0) fCharBin = 2.0;
			} else {
                float fReducedRangeValue = fValue;
                if(fDigitIndex < 0.0) { fReducedRangeValue = fract( fValue ); fDigitIndex += 1.0; }
				float fDigitValue = (abs(fReducedRangeValue / (pow(10.0, fDigitIndex))));
                fCharBin = DigitBin(int(floor(mod(fDigitValue, 10.0))));
			}
        }
	}
    return floor(mod((fCharBin / pow(2.0, floor(fract(vStringCoords.x) * 4.0) + (floor(vStringCoords.y * 5.0) * 4.0))), 2.0));
}
// Original interface

float PrintValue(const in vec2 fragCoord, const in vec2 vPixelCoords, const in vec2 vFontSize, const in float fValue, const in float fMaxDigits, const in float fDecimalPlaces)
{
    vec2 vStringCharCoords = (fragCoord.xy - vPixelCoords) / vFontSize;
    
    return PrintValue( vStringCharCoords, fValue, fMaxDigits, fDecimalPlaces );
}
*/

//-----------------------------------------------------
// mainImage
//-----------------------------------------------------

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = -1. + 2. * uv;
    p.x *= iResolution.x/iResolution.y;
    
    vec3 col = vec3(0);
    
    
// Lecture de la configuration -------------------------
        Config cfg = getConfig();

		bool isU = cfg.coordSystem == IN_UNIVERSE,
			 isG = cfg.coordSystem == IN_GALAXY;

// camera ----------------------------------------------

    vec3 ro, rdcam, ta, up;
    ro = cfg.ro_cam; 
    rdcam = cfg.rd_cam;

    // Leger tangage
    up = normalize(vec3(.1*cos(.1*iTime), .3*cos(.1*iTime), 1.));
    vec3 ww = normalize( rdcam ),
         uu = normalize( cross(ww,up) ),
         vv = normalize( cross(uu,ww)),
         rd = normalize( -p.x*uu + p.y*vv + 2.*ww );

// - Est t on dans une galaxie ? --------------------------------     
    vec3 galaxyId, galaxyPosU;
    bool inGalaxy = isInGalaxy(isU ? ro : galaxyToUniverse(cfg.galaxy_pos, ro), galaxyId, galaxyPosU);
       
// - rendu des etoiles -----------------------------------

    bool isHitStar = false;
	vec3 starPosG, starId = vec3(90);  
	vec4 star = vec4(0);
    if (inGalaxy) {
        // Le calcul se fait toujours en coordonnees Galaxie       
        vec3 roG = isU ? universeToGalaxy(cfg.galaxy_pos, ro) : ro;    
        float dStar = 9999.;
        star = renderStarField(roG, rd, dStar, starId ); 
    
#ifdef WITH_PLANETS    
        vec3 id0, posSun;
        if (cfg.targetType == STAR) {
            posSun = cfg.target_pos;
        } else if (cfg.targetType == PLANET) {
	        id0 = hash33(floor(cfg.target_pos));
            posSun = floor(cfg.target_pos) + clamp(id0, STAR_RADIUS, 1.-STAR_RADIUS);
        } else {
        	id0 = hash33(floor(roG));
        	posSun = floor(roG) + clamp(id0, STAR_RADIUS, 1.-STAR_RADIUS);
        }
            
        float dPlanet = dStar;
        vec3 planetPosG, planetId = vec3(90);  
        vec4 planet = renderPlanetField(posSun, roG, rd, dPlanet, planetId);  
        star = planet + (1.-planet.a) *sqrt(star)*star.a;
#endif 
        
#ifdef WITH_INTERGALACTIC_CLOUDS
        vec4 clouds = renderIntergalacticClouds(roG, rd, dStar, vec4(0.5,0.4,0.16,0.7));
        star = clouds + (1.-clouds.a) *sqrt(star)*star.a;
#endif        
        
    }

// - rendu des galaxies ----------------------------------

    vec3 targetPosU, targetId = vec3(90);
    // Le calcul se fait toujours en coordonnees univers
	vec3 roU = isG ? galaxyToUniverse(cfg.galaxy_pos, ro) : ro;
	vec4 colGalaxy = renderGalaxyField(roU, rd, targetPosU, targetId, isG);

    star.rgb += colGalaxy.rgb* (1. - star.a);

    col = star.rgb;
    
    
 //   float digit = PrintValue(fragCoord, iResolution.xy*vec2(.0,.7), vec2(20.), cfg.galaxy_pos.x, 8., 10.);
 //   digit += PrintValue(fragCoord, iResolution.xy*vec2(.0,.6), vec2(20.), cfg.galaxy_pos.y, 8., 10.);
 //   digit += PrintValue(fragCoord, iResolution.xy*vec2(.0,.5), vec2(20.), cfg.galaxy_pos.z, 8., 10.);
 //	col = mix(col, vec3(1,0,0), digit);
    
    fragColor = vec4((isU ? vec3(0.03,0.,.1)+col : col), 1.);

    fragColor.a = 1.;
}

`;

export default class implements iSub {
  key(): string {
    return 'XlcSDr';
  }
  name(): string {
    return 'Clickable Starfield';
  }
  // sort() {
  //   return 0;
  // }
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
      { type: 1, f: buffA, fi: 0 },
      webglUtils.DEFAULT_NOISE, //
    ];
  }
}
