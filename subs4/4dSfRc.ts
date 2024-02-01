import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
#define SLIDE_FADE_STEPS 45

#define TITLE_DELAY   45
#define BODY_DELAY   90
#define CODE_DELAY   135
#define FOOTER_DELAY 180

#define NUM_SLIDES 25

int SLIDE = 0;
int SLIDE_STEPS_VISIBLE = 0;

ivec4 LoadVec4( in ivec2 vAddr ) {
    return ivec4( texelFetch( iChannel0, vAddr, 0 ) );
}

bool AtAddress( ivec2 p, ivec2 c ) { return all( equal( floor(vec2(p)), vec2(c) ) ); }

void StoreVec4( in ivec2 vAddr, in ivec4 vValue, inout vec4 fragColor, in ivec2 fragCoord ) {
    fragColor = AtAddress( fragCoord, vAddr ) ? vec4(vValue) : fragColor;
}

vec4 LoadFVec4( in ivec2 vAddr ) {
    return texelFetch( iChannel0, vAddr, 0 );
}

void StoreFVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in ivec2 fragCoord ) {
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

// key functions

// Keyboard constants definition
const int KEY_SPACE = 32;
const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;
const int KEY_A     = 65;
const int KEY_D     = 68;
const int KEY_S     = 83;
const int KEY_W     = 87;


bool KP(int key) {
	return texelFetch( iChannel1, ivec2(key, 0), 0 ).x > 0.0;
}

bool KT(int key) {
	return texelFetch( iChannel1, ivec2(key, 2), 0 ).x > 0.0;
}

// slide logic

struct SlideDataStruct {
    int title;
    int titleDelay;
    int body;
    int bodyDelay;
    int code;
    int codeDelay;
    vec3 ro;
    vec3 ta;
    int sceneMode;
    int codeS;
    int codeE;
    int distMode;
};

SlideDataStruct temp;
int tempCounter;

bool createSlideData( 
    const int title,
    const int titleDelay,
    const int body,
    const int bodyDelay,
    const int code,
    const int codeDelay,
    const vec3 ro,
    const vec3 ta,
    const int sceneMode,
    const int codeS,
    const int codeE,
	const int distMode ) {
        
    if(tempCounter == SLIDE) {
        temp.title = title;
  	  	temp.titleDelay = titleDelay;
   	 	temp.body = body;
   	 	temp.bodyDelay =bodyDelay;
   	 	temp.code = code;
   		temp.codeDelay =codeDelay;
   		temp.ro = ro;
   		temp.ta = ta;
   	 	temp.sceneMode = sceneMode;
  	 	temp.codeS = codeS;
  	  	temp.codeE = codeE;
		temp.distMode = distMode;
        return true;
    } else {
    	tempCounter++;
        return false;
    }
}

SlideDataStruct getSlideData() {
    tempCounter = 0;
    
    // intro
   if( createSlideData(1,TITLE_DELAY,1,BODY_DELAY,0,0, vec3(.0,0.,1.),vec3(0.,0.,-.5), 0, 0, 0, 0) ) return temp;

    // intro - show bw scene
   if( createSlideData(1,0,2,0,0,0, vec3(.0,0.,1.), vec3(0.,0.,-5.), -1, 0, 0, 0)) return temp;
    
    // create a ray - origin
   if( createSlideData(2,TITLE_DELAY,3,BODY_DELAY,0,0, vec3(2.,1.,2.),vec3(0.,0.2,-1.3), 1, 0, 0, 0)) return temp;
        
    // create a ray - origin / code    
   if( createSlideData(2,0,4,0,1,TITLE_DELAY, vec3(2.,1.,2.),vec3(0.,0.2,-1.3), 1, 1, 3, 0)) return temp;
    
    // place screen
   if( createSlideData(2,0,5,TITLE_DELAY,0,0, vec3(2.,1.,2.),vec3(0.,0.2,-1.3), 2, 0, 0, 0)) return temp;
    
    // create rd
   if( createSlideData(2,0,6,TITLE_DELAY,0,0, vec3(2.5,3.,2.5),vec3(0.,0.2,-1.3), 3, 0, 0, 0)) return temp;

	// create rd / code
   if( createSlideData(2,0,7,0,1,TITLE_DELAY, vec3(2.5,3.,2.5),vec3(0.,0.2,-1.3), 3, 3, 0, 0)) return temp;
   
    // interact with scene
   if( createSlideData(2,0,8,0,0,0, vec3(2.5,3.,2.5),vec3(0.,0.2,-1.3), 3, 3, 0, 0)) return temp;
    
    // distance fields intro
   if( createSlideData(3,TITLE_DELAY,9,BODY_DELAY,0,0, vec3(1.,6.,2.),vec3(0.,0.2,-1.3), 3, 0, 0, 0)) return temp;
    
    // distance fields def
   if( createSlideData(3,0,10,TITLE_DELAY,0,0, vec3(1.,6.,2.),vec3(0.,0.2,-1.3), 3, 0, 0, 0)) return temp;
        
    // distance fields one sphere
   if( createSlideData(3,TITLE_DELAY,11,BODY_DELAY,0,0, vec3(1.,6.,-2.),vec3(-1.,-0.5,-2.), 4, 0, 0, 0)) return temp;
    
     // distance fields one sphere
   if( createSlideData(3,0,11,0,0,0, vec3(1.,6.,-2.),vec3(-1.,-0.5,-2.), 4, 0, 0, 1)) return temp;
      
    // distance fields one sphere - code
   if( createSlideData(3,0,12,0,2,TITLE_DELAY, vec3(1.,6.,-2.),vec3(-1.,-0.5,-2.), 4, 0, 3, 1)) return temp;
    
    // distance fields one three spheres
   if( createSlideData(3,0,13,TITLE_DELAY,0,0, vec3(1.,6.,-2.),vec3(-1.,-0.5,-2.), 2, 0, 5, 2)) return temp;
    
    // distance fields one three spheres - in code
   if( createSlideData(3,0,14,0,2,TITLE_DELAY, vec3(1.,6.,-2.),vec3(-1.,-0.5,-2.), 2, 0, 5, 2)) return temp;
    
    // distance fields one three spheres - full code
   if( createSlideData(3,0,15,TITLE_DELAY,2,BODY_DELAY, vec3(1.,6.,-2.),vec3(-1.,-0.5,-2.), 2, 0, 0, 3)) return temp;
        
    // distance fields one three spheres - march
   if( createSlideData(3,0,16,TITLE_DELAY,0,0, vec3(2.5,3.,1.5),vec3(0.,0.2,-1.3), 5, 0, 0, 4)) return temp;
    
    // distance fields one three spheres - march code
   if( createSlideData(3,0,17,0,3,TITLE_DELAY, vec3(2.5,3.,1.5),vec3(0.,0.2,-1.3), 5, 0, 0, 4)) return temp;
        
    // distance fields one three spheres - interact
   if( createSlideData(3,0,8,TITLE_DELAY,0,0, vec3(.5,2.,2.5),vec3(0.,0.2,-.3), 5, 0, 0, 4)) return temp;

    // lighting - normal intro
   if( createSlideData(4,TITLE_DELAY,18,BODY_DELAY,0,0, vec3(2.5,3.,1.5),vec3(0.,0.2,-1.3), 6, 0, 0, 0)) return temp;

   // lighting - normal full
   if( createSlideData(4,0,19,TITLE_DELAY,4,BODY_DELAY, vec3(4.5,3.,-1.5),vec3(0.,0.2,-1.3), 6, 0, 0, 0)) return temp;

   // lighting - interact
   if( createSlideData(4,0,8,TITLE_DELAY,0,0, vec3(4.5,3.,-1.5),vec3(0.,0.2,-1.3), 6, 0, 0, 0)) return temp;

   // lighting - diffuse
   if( createSlideData(4,0,20,TITLE_DELAY,0,0, vec3(.0,0.,1.),vec3(0.,0.,-.5), 0, 0, 0, 0)) return temp;

   // lighting - diffuse
   if( createSlideData(4,0,21,0,5,TITLE_DELAY, vec3(.0,0.,1.),vec3(0.,0.,-.5), -1, 0, 0, 0)) return temp;
 
   // done
   if( createSlideData(1,TITLE_DELAY,22,BODY_DELAY,0,0, vec3(.0,0.,1.),vec3(0.,0.,-.5), -1, 0, 0, 0)) return temp;
 
    
    return temp;
}
    
mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

float sphIntersect( in vec3 ro, in vec3 rd, in vec4 sph ) {
	vec3 oc = ro - sph.xyz;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - sph.w*sph.w;
	float h = b*b - c;
	if( h<0.0 ) return 10000.0;
	return -b - sqrt( h );
}

float iPlane(in vec3 ro, in vec3 rd, in float d) {
	// equation of a plane, y=0 = ro.y + t*rd.y
    return -(ro.y+d)/rd.y;
}

vec3 intersectScene( vec3 ro, vec3 ta, vec2 p,  bool intersectPlane ) {    
    mat3 ca = setCamera( ro, ta, 0.0 );
    vec3 rd = ca * normalize( vec3(p.xy,1.0) );
    
    float d = 1000.;
    // sphere intersections ..
    if( intersectPlane ) {
	    if( rd.y < 0. ) d = min(d, iPlane(ro, rd, 0.));
    } else {
    	d = min( d, sphIntersect( ro, rd, vec4(-1,0,-5,1) ));
   		d = min( d, sphIntersect( ro, rd, vec4(2,0,-3,1) ));
  	  	d = min( d, sphIntersect( ro, rd, vec4(-2,0,-2,1) ));

	    if( rd.y < 0. ) d = min(d, iPlane(ro, rd, 1.));
    }
    
    if( d < 100. ) {
        return ro + d*rd;
    } else {
        return vec3(-1,0,-4);
    }
}
    
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	ivec2 uv = ivec2(fragCoord.xy);
    
    // wait for font-texture to load
    if( iFrame == 0 || texelFetch(iChannel2, ivec2(0,0), 0).b < .1) {
        vec4 ro = vec4(0,0,1,0);
		vec4 ta = vec4(0);
        
		StoreFVec4( ivec2(0,3), ro, fragColor, uv);
		StoreFVec4( ivec2(0,4), ta, fragColor, uv);
    } else if( uv.x < 2 && uv.y < 6) {
        ivec4 slideData = LoadVec4( ivec2(0,0) );
        SLIDE = slideData.x;
        SLIDE_STEPS_VISIBLE = slideData.y;
        SLIDE_STEPS_VISIBLE++;

        if( SLIDE_STEPS_VISIBLE > 16 ) {
            if( KP(KEY_SPACE) || KP(KEY_RIGHT) || KP(KEY_D) ) {
                SLIDE++;
                SLIDE_STEPS_VISIBLE=0;
            }
            if( KP(KEY_LEFT) || KP(KEY_W) ) {
                SLIDE = (SLIDE + NUM_SLIDES - 1);
                SLIDE_STEPS_VISIBLE=0;
            }
            
            SLIDE = SLIDE % NUM_SLIDES; 
        }
        
        SlideDataStruct slide = getSlideData();
        
        // screen resolution
        ivec4 res = LoadVec4( ivec2(1,0) );
        if( res.x != int(iResolution.x) || res.y != int(iResolution.y) ) {
            SLIDE_STEPS_VISIBLE = 0;
        }
        StoreVec4( ivec2(1,0), ivec4(iResolution.xy, 0,0), fragColor, uv );
        
		// slide navigation               
		StoreVec4( ivec2(0,0), ivec4(SLIDE, SLIDE_STEPS_VISIBLE, slide.sceneMode, slide.distMode), fragColor, uv);
        
        // text 
        ivec4 showText1 = ivec4(0);
        ivec4 showText2 = ivec4(0);
        
        if( SLIDE_STEPS_VISIBLE == 0) showText1.x = 1;
        
        if( slide.titleDelay == SLIDE_STEPS_VISIBLE) showText2.x = slide.title;
        if( slide.bodyDelay == SLIDE_STEPS_VISIBLE) showText2.y = slide.body;
        if( slide.codeDelay == SLIDE_STEPS_VISIBLE) showText2.z = slide.code;

        showText1.y = slide.codeS;
        showText1.z = slide.codeE;
        
		StoreVec4( ivec2(0,1), showText1, fragColor, uv);
		StoreVec4( ivec2(0,2), showText2, fragColor, uv);
        
        // camera
        
        vec4 ro = LoadFVec4( ivec2(0,3) );
        vec4 ta = LoadFVec4( ivec2(0,4) );
        
		if(SLIDE_STEPS_VISIBLE > SLIDE_FADE_STEPS) {
            ro.xyz = mix( ro.xyz, slide.ro, 0.055 );
            ta.xyz = mix( ta.xyz, slide.ta, 0.055 );
        }
        
		StoreFVec4( ivec2(0,3), ro, fragColor, uv);
		StoreFVec4( ivec2(0,4), ta, fragColor, uv);
                
        if(iMouse.z > 0.) {
            vec2 q = (iMouse.xy - .5 * iResolution.xy ) / iResolution.y;
			StoreFVec4( ivec2(0,5), vec4(intersectScene(ro.xyz, ta.xyz, q, slide.sceneMode == 5),1), fragColor, uv);
        } else {
			StoreFVec4( ivec2(0,5), vec4(intersectScene(vec3(0,0,1), vec3(1,0,0), vec2(0), slide.sceneMode == 5),1), fragColor, uv);
        }
    } else {  
	    fragColor = vec4(0);
    }
}
`;

const buffB = `
#define SLIDE_FADE_STEPS 60

int SLIDE = 0;
int SLIDE_STEPS_VISIBLE = 0;
int SCENE_MODE = 0;
int DIST_MODE = 0;
int MAX_MARCH_STEPS;

vec3 intersections[7];
vec3 intersectionNormal;

float aspect;
vec3 USER_INTERSECT;

ivec4 LoadVec4( in ivec2 vAddr ) {
    return ivec4( texelFetch( iChannel0, vAddr, 0 ) );
}

vec4 LoadFVec4( in ivec2 vAddr ) {
    return texelFetch( iChannel0, vAddr, 0 );
}

bool AtAddress( ivec2 p, ivec2 c ) { return all( equal( floor(vec2(p)), vec2(c) ) ); }

void StoreVec4( in ivec2 vAddr, in ivec4 vValue, inout vec4 fragColor, in ivec2 fragCoord ) {
    fragColor = AtAddress( fragCoord, vAddr ) ? vec4(vValue) : fragColor;
}

void loadData() {
    ivec4 slideData = LoadVec4( ivec2(0,0) );
    SLIDE = slideData.x;
    SLIDE_STEPS_VISIBLE = slideData.y;
    SCENE_MODE = slideData.z;
	DIST_MODE = slideData.w;
}


// tutorial Scene
float tut_map(vec3 p) {
    float d = distance(p, vec3(-1, 0, -5)) - 1.;
    d = min(d, distance(p, vec3(2, 0, -3)) - 1.);
    d = min(d, distance(p, vec3(-2, 0, -2)) - 1.);
    d = min(d, p.y + 1.);
    return d;
}

vec3 tut_calcNormal(in vec3 pos) {
    vec2 e = vec2(1.0, -1.0) * 0.0005;
    return normalize(
        e.xyy * tut_map(pos + e.xyy) +
        e.yyx * tut_map(pos + e.yyx) +
        e.yxy * tut_map(pos + e.yxy) +
        e.xxx * tut_map(pos + e.xxx));
}

vec4 tut_render(in vec2 uv, const int steps) {
    vec3 ro = vec3(0, 0, 1);
    vec3 rd = normalize(vec3(uv, 0.) - ro);

    float h, t = 1.;
    for (int i = 0; i < steps; i++) {
        h = tut_map((ro + rd * t));
        t += h;
        if (h < 0.01) break;
    }

    if (h < 0.01) {
        vec3 p = ro + rd * t;
        vec3 normal = tut_calcNormal(p);
        vec3 light = vec3(0, 2, 0);

        float dif = clamp(dot(normal, normalize(light - p)), 0., 1.);
        dif *= 5. / dot(light - p, light - p);
        return vec4(pow(vec3(dif), vec3(1. / 2.2)), 1);
    } else {
        return vec4(0, 0, 0, 1);
    }
}

float sdPlane( vec3 p, float d ) {
	return p.y - d;
}

float sdSphere( vec3 p, float s ) {
    return length(p)-s;
}

float sdBox( vec3 p, vec3 b ) {
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
	vec3 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - r;
}

//------------------------------------------------------------------

vec2 opU( vec2 d1, vec2 d2 ) {
	return (d1.x<d2.x) ? d1 : d2;
}

//------------------------------------------------------------------

vec2 map_0( in vec3 pos ) { // basic scene
    vec2 res = opU( vec2( sdPlane(     pos, -1.), 1.0 ),
	                vec2( sdSphere(    pos-vec3(-1,0,-5),1.), 50. ) );
    res = opU( res, vec2( sdSphere(    pos-vec3(2,0,-3),1.), 65. ) );
    res = opU( res, vec2( sdSphere(    pos-vec3(-2,0,-2),1.),41. ) );
        
    return res;
}

vec2 map_1( in vec3 pos ) { // scene + ro
    vec2 res = map_0(pos);
    res = opU( res, vec2( sdSphere(    pos-vec3(0,0,1),.1),2. ) );
    return res;
}

vec2 map_2( in vec3 pos ) { // scene + ro + screen
    vec2 res = map_0(pos);
            
    res = opU( res, vec2( sdSphere(    pos-vec3(0,0,1),.1),3. ) );
    res = opU( res, vec2( sdBox( pos,  vec3(.5*aspect, .5,.025)), 4.));
    return res;
}

vec2 map_3( in vec3 pos ) { // scene + ro + rd + intersection
    vec2 res = map_2(pos);
    
    res = opU( res, vec2( sdSphere(     pos-USER_INTERSECT,.1),2. ) );
    res = opU( res, vec2( sdCapsule(    pos, vec3(0,0,1.), USER_INTERSECT,.025),2. ) );
    
    return res;
}

vec2 map_4( in vec3 pos ) { // scene + ro + one sphere
    vec2 res = opU( vec2( sdPlane(     pos, -1.), 1.0 ),
	                vec2( sdSphere(    pos-vec3(-1,0,-5),1.), 50. ) );
    
    res = opU( res, vec2( sdSphere(    pos-vec3(0,0,1),.1),3. ) );
    res = opU( res, vec2( sdBox( pos,  vec3(.5*aspect, .5,.025)), 4.));
    
    return res;
}

vec2 map_5( in vec3 pos ) { // scene + ro + screen + march steps
    vec2 res = map_2(pos);
    
    res = opU( res, vec2( sdCapsule(    pos, vec3(0,0,1.), USER_INTERSECT,.025),3. ) );
    for( int i=0; i<intersections.length(); i++ ){
        if (i <= MAX_MARCH_STEPS) {
	    	res = opU( res, vec2( sdSphere( pos-intersections[i],.1), (i==MAX_MARCH_STEPS)?2.:3. ) );
        }
    }
    
    return res;
}

vec2 map_6( in vec3 pos ) { // scene + ro + rd + intersection + normal
    vec2 res = map_2(pos);
    
    res = opU( res, vec2( sdSphere(     pos-USER_INTERSECT,.1),3. ) );
    res = opU( res, vec2( sdCapsule(    pos, USER_INTERSECT + intersectionNormal, USER_INTERSECT,.025),2. ) );
    
    res = opU( res, vec2( sdCapsule(    pos, vec3(0,0,1.), USER_INTERSECT,.025),3. ) );
    return res;
}


vec2 castRay( in vec3 ro, in vec3 rd )
{
    float tmin = .5;
    float tmax = 20.0;
       
    float t = tmin;
    float m = -1.0;

    if( SCENE_MODE == 0 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_0( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    } else if( SCENE_MODE == 1 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_1( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    } else if( SCENE_MODE == 2 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_2( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    } else if( SCENE_MODE == 3 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_3( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    } else if( SCENE_MODE == 4 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_4( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    } else if( SCENE_MODE == 5 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_5( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    }  else if( SCENE_MODE == 6 ) {
        for( int i=0; i<64; i++ )
        {
            float precis = 0.00005*t;
            vec2 res = map_6( ro+rd*t );
            if( res.x<precis || t>tmax ) break;
            t += res.x;
            m = res.y;
        }
    } 

    if( t>tmax ) m=-1.0;
    return vec2( t, m );
}

float softshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
	float res = 1.0;
    float t = mint, h;
    for( int i=0; i<16; i++ )
    {
        
	    if( SCENE_MODE == 0 ) {
			h = map_0( ro + rd*t ).x;
    	} else if( SCENE_MODE == 1 ) {
			h = map_1( ro + rd*t ).x;
    	} else if( SCENE_MODE == 2 ) {
			h = map_2( ro + rd*t ).x;
   		} else if( SCENE_MODE == 3 ) {
			h = map_3( ro + rd*t ).x;
   		} else if( SCENE_MODE == 4 ) {
			h = map_4( ro + rd*t ).x;
   		} else if( SCENE_MODE == 5 ) {
			h = map_5( ro + rd*t ).x;
   		} else if( SCENE_MODE == 6 ) {
			h = map_6( ro + rd*t ).x;
   		}
        
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.02, 0.10 );
        if( h<0.001 || t>tmax ) break;
    }
    return clamp( res, 0.0, 1.0 );
}

vec3 calcNormal( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    
    if( SCENE_MODE == 0 ) {
 	   return normalize( e.xyy*map_0( pos + e.xyy ).x + 
					  e.yyx*map_0( pos + e.yyx ).x + 
					  e.yxy*map_0( pos + e.yxy ).x + 
					  e.xxx*map_0( pos + e.xxx ).x );
    } else if( SCENE_MODE == 1 ) {
            return normalize( e.xyy*map_1( pos + e.xyy ).x + 
					  e.yyx*map_1( pos + e.yyx ).x + 
					  e.yxy*map_1( pos + e.yxy ).x + 
					  e.xxx*map_1( pos + e.xxx ).x );
    } else if( SCENE_MODE == 2 ) {
            return normalize( e.xyy*map_2( pos + e.xyy ).x + 
					  e.yyx*map_2( pos + e.yyx ).x + 
					  e.yxy*map_2( pos + e.yxy ).x + 
					  e.xxx*map_2( pos + e.xxx ).x );
    } else if( SCENE_MODE == 3 ) {
            return normalize( e.xyy*map_3( pos + e.xyy ).x + 
					  e.yyx*map_3( pos + e.yyx ).x + 
					  e.yxy*map_3( pos + e.yxy ).x + 
					  e.xxx*map_3( pos + e.xxx ).x );
    } else if( SCENE_MODE == 4 ) {
            return normalize( e.xyy*map_4( pos + e.xyy ).x + 
					  e.yyx*map_4( pos + e.yyx ).x + 
					  e.yxy*map_4( pos + e.yxy ).x + 
					  e.xxx*map_4( pos + e.xxx ).x );
    } else if( SCENE_MODE == 5 ) {
            return normalize( e.xyy*map_5( pos + e.xyy ).x + 
					  e.yyx*map_5( pos + e.yyx ).x + 
					  e.yxy*map_5( pos + e.yxy ).x + 
					  e.xxx*map_5( pos + e.xxx ).x );
    } else if( SCENE_MODE == 6 ) {
            return normalize( e.xyy*map_6( pos + e.xyy ).x + 
					  e.yyx*map_6( pos + e.yyx ).x + 
					  e.yxy*map_6( pos + e.yxy ).x + 
					  e.xxx*map_6( pos + e.xxx ).x );
    }
}

float calcAO( in vec3 pos, in vec3 nor )
{
	float occ = 0.0;
    float sca = 1.0, dd;
    for( int i=0; i<5; i++ )
    {
        float hr = 0.01 + 0.12*float(i)/4.0;
        vec3 aopos =  nor * hr + pos;
	    if( SCENE_MODE == 0 ) {
			dd = map_0( aopos ).x;
    	} else if( SCENE_MODE == 1 ) {
			dd = map_1( aopos ).x;
    	} else if( SCENE_MODE == 2 ) {
			dd = map_2( aopos ).x;
   		} else if( SCENE_MODE == 3 ) {
			dd = map_3( aopos ).x;
   		} else if( SCENE_MODE == 4 ) {
			dd = map_4( aopos ).x;
   		} else if( SCENE_MODE == 5 ) {
			dd = map_5( aopos ).x;
   		} else if( SCENE_MODE == 6 ) {
			dd = map_6( aopos ).x;
   		}
        occ += -(dd-hr)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );    
}

vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
{
    return a + b*cos( 6.28318*(c*t+d) );
}

vec3 render( in vec3 ro, in vec3 rd )
{ 
    vec3 col = vec3(0.75,0.9,1.0) + max(rd.y*.8,0.);
    vec2 res = castRay(ro,rd);
    float t = res.x;
	float m = res.y;
    if( m>-0.5 )
    {
        vec3 pos = ro + t*rd;
        vec3 nor = calcNormal( pos );
        vec3 ref = reflect( rd, nor );
        
        // material        
		col = 0.45 + 0.35*sin( vec3(0.05,0.08,0.10)*(m-1.0) );
        if( m<1.5 ) {            
            float f = mod( floor(1.0*pos.z) + floor(1.0*pos.x), 2.0);
            col = 0.35 + 0.05*f*vec3(1.0);
        } else if (m < 2.5 ) {
            col = vec3(.5 + .3*sin(iTime*6.28318530718 ),0,0);
        } else if (m < 3.5 ) {
            col = vec3(.8,0,0);
        } else if (m < 4.5 ) {
            col = tut_render(pos.xy, 64).rgb;
        }

        // lighitng        
        float occ = calcAO( pos, nor );
		vec3  lig = normalize( vec3(0.4, 0.7, 0.6) );
		float amb = clamp( 0.5+0.5*nor.y, 0.0, 1.0 );
        float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
        float bac = clamp( dot( nor, normalize(vec3(-lig.x,0.0,-lig.z))), 0.0, 1.0 )*clamp( 1.0-pos.y,0.0,1.0);
        float dom = smoothstep( -0.1, 0.1, ref.y );
        float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
		float spe = pow(clamp( dot( ref, lig ), 0.0, 1.0 ),16.0);
        
        dif *= softshadow( pos, lig, 0.02, 2.5 );
        dom *= softshadow( pos, ref, 0.02, 2.5 );

		vec3 lin = vec3(0.0);
        lin += 1.30*dif*vec3(1.00,0.80,0.55);
		lin += 2.00*spe*vec3(1.00,0.90,0.70)*dif;
        lin += 0.40*amb*vec3(0.40,0.60,1.00)*occ;
        lin += 0.50*dom*vec3(0.40,0.60,1.00)*occ;
        lin += 0.50*bac*vec3(0.25,0.25,0.25)*occ;
        lin += 0.25*fre*vec3(1.00,1.00,1.00)*occ;
		col = col*lin;

        
        if( DIST_MODE > 0 ) {
            // intersect with plane;
            float d = -(ro.y)/rd.y;
            vec3 dint = ro + d*rd;
            
            float m = sdSphere(dint-vec3(-1,0,-5),1.);
            
            if( DIST_MODE > 1 ) { 
                m = min( m, sdSphere(dint-vec3(2,0,-3),1.));
                m = min( m, sdSphere(dint-vec3(-2,0,-2),1.));
            }
            if( DIST_MODE > 2 ) { 
                m = min( m, dint.y + 1.);
            }
            vec3 dcol = vec3(abs(mod(m, 0.1)/0.1 - 0.5));
            dcol = mix( dcol, pal( m*.115+.6, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.10,0.20) ), .7);
            
            if( SCENE_MODE == 5) {
                for( int i=0; i<intersections.length(); i++ ){
                    if (i<MAX_MARCH_STEPS) {
                        float dti = distance(intersections[i], dint);
                        float mai = map_0(intersections[i]).x;
                        float outer = smoothstep( mai-0.15, mai, dti);
                        dcol = mix( dcol, vec3(1,0,0), .3*smoothstep( mai+0.01, mai, dti)*(outer+1.) );
                    }
                }            
            }
            if( d < t ) {
                col = mix(col, dcol, .6);
            }
        }
        
    	col = mix( col, vec3(0.75,0.9,1.0), .05+.95* smoothstep(10.,20.,t) );
    }

	return vec3( clamp(col,0.0,1.0) );
}

vec3 calcNormal_0( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    
    return normalize( e.xyy*map_0( pos + e.xyy ).x + 
					  e.yyx*map_0( pos + e.yyx ).x + 
					  e.yxy*map_0( pos + e.yxy ).x + 
					  e.xxx*map_0( pos + e.xxx ).x );
}

mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}


vec3 renderScene( vec2 p, vec3 ro, vec3 ta ) {
    // camera-to-world transformation
    mat3 ca = setCamera( ro, ta, 0.0 );
    // ray direction
    vec3 rd = ca * normalize( vec3(p.xy,1.0) );
    // render	
    vec3 col = render( ro, rd );
    
    return col;
}


void initIntersecions( in vec3 ro, in vec3 rd ) {
    float t = 1.;
    
    for( int i=0; i<intersections.length(); i++ ){
        vec2 res = map_0( ro+rd*t );
        t += res.x;
        intersections[i] = ro + rd*t;
    }
}

//

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 q = (fragCoord.xy - .5 * iResolution.xy ) / iResolution.y;
    
    aspect = iResolution.x/iResolution.y;
    
    loadData();
    
    if(SCENE_MODE == -1) {
        fragColor = tut_render(q, 96);
    } else {
        vec3 ro = LoadFVec4( ivec2(0,3) ).xyz;
        vec3 ta = LoadFVec4( ivec2(0,4) ).xyz;
        USER_INTERSECT = LoadFVec4( ivec2(0,5) ).xyz;
        
        if( SCENE_MODE == 5 ) {
            MAX_MARCH_STEPS = min(max(int( SLIDE_STEPS_VISIBLE/40-1),0), intersections.length()-1);
            
            initIntersecions(vec3(0,0,1), normalize(USER_INTERSECT - vec3(0,0,1)) );
            for (int i=0; i<intersections.length(); i++) {
                if (i<MAX_MARCH_STEPS+1) {
            		USER_INTERSECT = intersections[i];
                }
            }
        }
        if( SCENE_MODE == 6 ) {
            intersectionNormal = calcNormal_0(USER_INTERSECT) * .5;
        }
        
        fragColor = vec4(renderScene(q, ro, ta),1);
    }
}`;

const buffC = `
#define SLIDE_FADE_STEPS 60 

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    int SLIDE_STEPS_VISIBLE = int(texelFetch( iChannel0, ivec2(0,0), 0 ).y);
    
    if(iFrame == 0) {
  		fragColor = vec4(0,0,0,1);
    } else if(SLIDE_STEPS_VISIBLE > SLIDE_FADE_STEPS) {
  		fragColor = texelFetch(iChannel1, ivec2(fragCoord), 0);
    } else {
    	fragColor = texelFetch(iChannel2, ivec2(fragCoord), 0);
    }
}`;

const buffD = `
#define FONT_UV_WIDTH 160.

ivec4 LoadVec4( in ivec2 vAddr ) {
    return ivec4( texelFetch( iChannel0, vAddr, 0 ) );
}

void drawStr(const uint str, const ivec2 c, const vec2 uv, const vec2 caret, const float size, const vec3 fontCol, inout vec4 outCol) {    
    if( !(str == 0x0U || c.y < 0 || c.x < 0) ) {
        int x = c.x % 4;
        uint xy = (str >> ((3 - x) * 8)) % 256U;

        if( xy > 0x0aU ) {
            vec2 K = fract((uv - caret) / vec2(size * .45, size));
            K.x = K.x * .6 + .2;
            K.y = K.y * .95 - .05;
            float d = textureLod(iChannel2, (K + vec2( xy & 0xFU, 0xFU - (xy >> 4))) / 16.,0.).a;

            outCol.rgb = mix( fontCol, vec3(0) , smoothstep(.0,1.,smoothstep(.47,.53,d)) * .9 );
            outCol.a = smoothstep(1.,0., smoothstep(.53,.59,d));
        } 
    }
}

void mainImage( out vec4 outCol, in vec2 fragCoord ) {
    ivec4 slideData = LoadVec4( ivec2(0,0) );
    ivec4 text1 = LoadVec4(ivec2(0,1));
    ivec4 text2 = LoadVec4(ivec2(0,2));

    if( text1.x == 1 ) {
        outCol = vec4(0);
    } else {
        outCol = texelFetch(iChannel1, ivec2(fragCoord), 0);    
    }

    vec2 uv = ((fragCoord-iResolution.xy*.5)/iResolution.y) * FONT_UV_WIDTH;

    if(text2.x > 0) { // title
        int i = text2.x;
		uint f = 0x0U;
		if( i == 1 ) {
			ivec2 c = ivec2( (uv - vec2(-79, 60)) * (1./vec2(5.85, -13)) + vec2(1,2)) - 1;
			if(c.y == 0) f = c.x < 4 ? 0x5261796dU : c.x < 8 ? 0x61726368U : c.x < 12 ? 0x696e6720U : c.x < 16 ? 0x64697374U : c.x < 20 ? 0x616e6365U : c.x < 24 ? 0x20666965U : c.x < 28 ? 0x6c647320U : f;
			drawStr( f, c, uv, vec2(-79, 60), 13., vec3(255./255., 208./255., 128./255.), outCol );		}
		else if( i == 2 ) {
			ivec2 c = ivec2( (uv - vec2(-35.1, 60)) * (1./vec2(5.85, -13)) + vec2(1,2)) - 1;
			if(c.y == 0) f = c.x < 4 ? 0x43726561U : c.x < 8 ? 0x74652061U : c.x < 12 ? 0x20726179U : f;
			drawStr( f, c, uv, vec2(-35.1, 60), 13., vec3(255./255., 208./255., 128./255.), outCol );		}
		else if( i == 3 ) {
			ivec2 c = ivec2( (uv - vec2(-43.9, 60)) * (1./vec2(5.85, -13)) + vec2(1,2)) - 1;
			if(c.y == 0) f = c.x < 4 ? 0x44697374U : c.x < 8 ? 0x616e6365U : c.x < 12 ? 0x20666965U : c.x < 16 ? 0x6c647320U : f;
			drawStr( f, c, uv, vec2(-43.9, 60), 13., vec3(255./255., 208./255., 128./255.), outCol );		}
		else if( i == 4 ) {
			ivec2 c = ivec2( (uv - vec2(-23.4, 60)) * (1./vec2(5.85, -13)) + vec2(1,2)) - 1;
			if(c.y == 0) f = c.x < 4 ? 0x4c696768U : c.x < 8 ? 0x74696e67U : f;
			drawStr( f, c, uv, vec2(-23.4, 60), 13., vec3(255./255., 208./255., 128./255.), outCol );		}

    }
    if(text2.y > 0) { // body
        int i = text2.y;
		ivec2 c = ivec2( (uv - vec2(-120, 40)) * (1./vec2(3.6, -8)) + vec2(1,2)) - 1;
		uint f = 0x0U;
		if( i == 1 || i == 2 ) {
			if(c.y == 0) f = c.x < 4 ? 0x496e2074U : c.x < 8 ? 0x68697320U : c.x < 12 ? 0x7475746fU : c.x < 16 ? 0x7269616cU : c.x < 20 ? 0x20796f75U : c.x < 24 ? 0x2077696cU : c.x < 28 ? 0x6c206c65U : c.x < 32 ? 0x61726e20U : c.x < 36 ? 0x686f7720U : c.x < 40 ? 0x746f2072U : c.x < 44 ? 0x656e6465U : c.x < 48 ? 0x7220200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x61203364U : c.x < 8 ? 0x2d736365U : c.x < 12 ? 0x6e652069U : c.x < 16 ? 0x6e205368U : c.x < 20 ? 0x61646572U : c.x < 24 ? 0x746f7920U : c.x < 28 ? 0x7573696eU : c.x < 32 ? 0x67206469U : c.x < 36 ? 0x7374616eU : c.x < 40 ? 0x63652066U : c.x < 44 ? 0x69656c64U : c.x < 48 ? 0x732e2020U : f;
		}
		if( i == 2 ) {
			if(c.y == 3) f = c.x < 4 ? 0x41732061U : c.x < 8 ? 0x6e206578U : c.x < 12 ? 0x616d706cU : c.x < 16 ? 0x652c2077U : c.x < 20 ? 0x65207769U : c.x < 24 ? 0x6c6c2063U : c.x < 28 ? 0x72656174U : c.x < 32 ? 0x65207468U : c.x < 36 ? 0x69732062U : c.x < 40 ? 0x6c61636bU : c.x < 44 ? 0x20616e64U : c.x < 48 ? 0x2020200aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x77686974U : c.x < 8 ? 0x65207363U : c.x < 12 ? 0x656e6520U : c.x < 16 ? 0x6f662074U : c.x < 20 ? 0x68726565U : c.x < 24 ? 0x20737068U : c.x < 28 ? 0x65726573U : c.x < 32 ? 0x206f6e20U : c.x < 36 ? 0x6120706cU : c.x < 40 ? 0x616e652eU : f;
		}
		else if( i == 3 || i == 4 ) {
			if(c.y == 0) f = c.x < 4 ? 0x46697273U : c.x < 8 ? 0x74207765U : c.x < 12 ? 0x20637265U : c.x < 16 ? 0x61746520U : c.x < 20 ? 0x61207261U : c.x < 24 ? 0x792e200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x54686520U : c.x < 8 ? 0x72617920U : c.x < 12 ? 0x6f726967U : c.x < 16 ? 0x696e2028U : c.x < 20 ? 0x726f2920U : c.x < 24 ? 0x77696c6cU : c.x < 28 ? 0x20626520U : c.x < 32 ? 0x61742028U : c.x < 36 ? 0x302c302cU : c.x < 40 ? 0x31292e20U : f;
		}
		if( i == 4 ) {
			if(c.y == 3) f = c.x < 4 ? 0x496e2063U : c.x < 8 ? 0x6f64653aU : f;
		}
		else if( i == 5 ) {
			if(c.y == 0) f = c.x < 4 ? 0x4e6f7720U : c.x < 8 ? 0x77652070U : c.x < 12 ? 0x6c616365U : c.x < 16 ? 0x20612076U : c.x < 20 ? 0x69727475U : c.x < 24 ? 0x616c2073U : c.x < 28 ? 0x63726565U : c.x < 32 ? 0x6e20696eU : c.x < 36 ? 0x20746865U : c.x < 40 ? 0x20736365U : c.x < 44 ? 0x6e652e0aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x49742069U : c.x < 8 ? 0x73206c6fU : c.x < 12 ? 0x63617465U : c.x < 16 ? 0x64206174U : c.x < 20 ? 0x20746865U : c.x < 24 ? 0x206f7269U : c.x < 28 ? 0x67696e20U : c.x < 32 ? 0x616e6420U : c.x < 36 ? 0x6861730aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x64696d65U : c.x < 8 ? 0x6e73696fU : c.x < 12 ? 0x6e73206fU : c.x < 16 ? 0x66206173U : c.x < 20 ? 0x70656374U : c.x < 24 ? 0x5f726174U : c.x < 28 ? 0x696f2078U : c.x < 32 ? 0x20312e20U : f;
		}
		else if( i == 6 || i == 7 ) {
			if(c.y == 0) f = c.x < 4 ? 0x57652063U : c.x < 8 ? 0x6f6d7075U : c.x < 12 ? 0x74652074U : c.x < 16 ? 0x68652072U : c.x < 20 ? 0x61792064U : c.x < 24 ? 0x69726563U : c.x < 28 ? 0x74696f6eU : c.x < 32 ? 0x20287264U : c.x < 36 ? 0x2920666fU : c.x < 40 ? 0x72206561U : c.x < 44 ? 0x6368200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x70697865U : c.x < 8 ? 0x6c202866U : c.x < 12 ? 0x72616743U : c.x < 16 ? 0x6f6f7264U : c.x < 20 ? 0x2e787929U : c.x < 24 ? 0x206f6620U : c.x < 28 ? 0x6f757220U : c.x < 32 ? 0x76697274U : c.x < 36 ? 0x75616c20U : c.x < 40 ? 0x73637265U : c.x < 44 ? 0x656e2e20U : f;
		}
		if( i == 7 ) {
			if(c.y == 3) f = c.x < 4 ? 0x496e2063U : c.x < 8 ? 0x6f64653aU : f;
		}
		else if( i == 8 ) {
			if(c.y == 0) f = c.x < 4 ? 0x55736520U : c.x < 8 ? 0x796f7572U : c.x < 12 ? 0x206d6f75U : c.x < 16 ? 0x73652074U : c.x < 20 ? 0x6f20696eU : c.x < 24 ? 0x74657261U : c.x < 28 ? 0x63742077U : c.x < 32 ? 0x69746820U : c.x < 36 ? 0x74686520U : c.x < 40 ? 0x7363656eU : c.x < 44 ? 0x652e2020U : f;
		}
		else if( i == 9 ) {
			if(c.y == 0) f = c.x < 4 ? 0x41206469U : c.x < 8 ? 0x7374616eU : c.x < 12 ? 0x63652066U : c.x < 16 ? 0x69656c64U : c.x < 20 ? 0x20697320U : c.x < 24 ? 0x75736564U : c.x < 28 ? 0x20746f20U : c.x < 32 ? 0x66696e64U : c.x < 36 ? 0x20746865U : c.x < 40 ? 0x2020200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x696e7465U : c.x < 8 ? 0x72736563U : c.x < 12 ? 0x74696f6eU : c.x < 16 ? 0x206f6620U : c.x < 20 ? 0x6f757220U : c.x < 24 ? 0x72617920U : c.x < 28 ? 0x28726f2cU : c.x < 32 ? 0x20726429U : c.x < 36 ? 0x20616e64U : c.x < 40 ? 0x20746865U : c.x < 44 ? 0x20737068U : c.x < 48 ? 0x65726573U : c.x < 52 ? 0x2020200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x616e6420U : c.x < 8 ? 0x706c616eU : c.x < 12 ? 0x65206f66U : c.x < 16 ? 0x20746865U : c.x < 20 ? 0x20736365U : c.x < 24 ? 0x6e652e20U : f;
		}
		else if( i == 10 ) {
			if(c.y == 0) f = c.x < 4 ? 0x41206469U : c.x < 8 ? 0x7374616eU : c.x < 12 ? 0x63652066U : c.x < 16 ? 0x69656c64U : c.x < 20 ? 0x20697320U : c.x < 24 ? 0x61206675U : c.x < 28 ? 0x6e637469U : c.x < 32 ? 0x6f6e2074U : c.x < 36 ? 0x68617420U : c.x < 40 ? 0x67697665U : c.x < 44 ? 0x7320616eU : c.x < 48 ? 0x2020200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x65737469U : c.x < 8 ? 0x6d617465U : c.x < 12 ? 0x20286120U : c.x < 16 ? 0x6c6f7765U : c.x < 20 ? 0x7220626fU : c.x < 24 ? 0x756e6420U : c.x < 28 ? 0x6f662920U : c.x < 32 ? 0x74686520U : c.x < 36 ? 0x64697374U : c.x < 40 ? 0x616e6365U : c.x < 44 ? 0x20746f20U : c.x < 48 ? 0x7468650aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x636c6f73U : c.x < 8 ? 0x65737420U : c.x < 12 ? 0x73757266U : c.x < 16 ? 0x61636520U : c.x < 20 ? 0x61742061U : c.x < 24 ? 0x6e792070U : c.x < 28 ? 0x6f696e74U : c.x < 32 ? 0x20696e20U : c.x < 36 ? 0x73706163U : c.x < 40 ? 0x652e2020U : f;
		}
		else if( i == 11 ) {
			if(c.y == 0) f = c.x < 4 ? 0x54686520U : c.x < 8 ? 0x64697374U : c.x < 12 ? 0x616e6365U : c.x < 16 ? 0x2066756eU : c.x < 20 ? 0x6374696fU : c.x < 24 ? 0x6e20666fU : c.x < 28 ? 0x72206120U : c.x < 32 ? 0x73706865U : c.x < 36 ? 0x72652069U : c.x < 40 ? 0x73207468U : c.x < 44 ? 0x65206469U : c.x < 48 ? 0x7374616eU : c.x < 52 ? 0x63652074U : c.x < 56 ? 0x6f20200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x74686520U : c.x < 8 ? 0x63656e74U : c.x < 12 ? 0x6572206fU : c.x < 16 ? 0x66207468U : c.x < 20 ? 0x65207370U : c.x < 24 ? 0x68657265U : c.x < 28 ? 0x206d696eU : c.x < 32 ? 0x75732074U : c.x < 36 ? 0x68652072U : c.x < 40 ? 0x61646975U : c.x < 44 ? 0x73206f66U : c.x < 48 ? 0x20746865U : c.x < 52 ? 0x20737068U : c.x < 56 ? 0x6572652eU : f;
		}
		else if( i == 12 ) {
			if(c.y == 0) f = c.x < 4 ? 0x54686520U : c.x < 8 ? 0x636f6465U : c.x < 12 ? 0x20666f72U : c.x < 16 ? 0x20612073U : c.x < 20 ? 0x70686572U : c.x < 24 ? 0x65206c6fU : c.x < 28 ? 0x63617465U : c.x < 32 ? 0x64206174U : c.x < 36 ? 0x20282d31U : c.x < 40 ? 0x2c302c2dU : c.x < 44 ? 0x35293a20U : f;
		}
		else if( i == 13 || i == 14 ) {
			if(c.y == 0) f = c.x < 4 ? 0x57652063U : c.x < 8 ? 0x6f6d6269U : c.x < 12 ? 0x6e652064U : c.x < 16 ? 0x69666665U : c.x < 20 ? 0x72656e74U : c.x < 24 ? 0x20646973U : c.x < 28 ? 0x74616e63U : c.x < 32 ? 0x65206675U : c.x < 36 ? 0x6e637469U : c.x < 40 ? 0x6f6e7320U : c.x < 44 ? 0x62792074U : c.x < 48 ? 0x616b696eU : c.x < 52 ? 0x6720200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x74686520U : c.x < 8 ? 0x6d696e69U : c.x < 12 ? 0x6d756d20U : c.x < 16 ? 0x76616c75U : c.x < 20 ? 0x65206f66U : c.x < 24 ? 0x20746865U : c.x < 28 ? 0x73652066U : c.x < 32 ? 0x756e6374U : c.x < 36 ? 0x696f6e73U : c.x < 40 ? 0x2e202020U : f;
		}
		if( i == 14 ) {
			if(c.y == 3) f = c.x < 4 ? 0x496e2063U : c.x < 8 ? 0x6f64653aU : f;
		}
		else if( i == 15 ) {
			if(c.y == 0) f = c.x < 4 ? 0x54686520U : c.x < 8 ? 0x746f7461U : c.x < 12 ? 0x6c206469U : c.x < 16 ? 0x7374616eU : c.x < 20 ? 0x63652066U : c.x < 24 ? 0x756e6374U : c.x < 28 ? 0x696f6e20U : c.x < 32 ? 0x666f7220U : c.x < 36 ? 0x74686973U : c.x < 40 ? 0x20736365U : c.x < 44 ? 0x6e65200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x28696e63U : c.x < 8 ? 0x6c756469U : c.x < 12 ? 0x6e672074U : c.x < 16 ? 0x68652070U : c.x < 20 ? 0x6c616e65U : c.x < 24 ? 0x29206973U : c.x < 28 ? 0x20676976U : c.x < 32 ? 0x656e2062U : c.x < 36 ? 0x793a2020U : f;
		}
		else if( i == 16 || i == 17 ) {
			if(c.y == 0) f = c.x < 4 ? 0x4e6f7720U : c.x < 8 ? 0x77652063U : c.x < 12 ? 0x616e206dU : c.x < 16 ? 0x61726368U : c.x < 20 ? 0x20746865U : c.x < 24 ? 0x20736365U : c.x < 28 ? 0x6e652066U : c.x < 32 ? 0x726f6d20U : c.x < 36 ? 0x726f2069U : c.x < 40 ? 0x6e206469U : c.x < 44 ? 0x72656374U : c.x < 48 ? 0x696f6e20U : c.x < 52 ? 0x72642e0aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x45616368U : c.x < 8 ? 0x20737465U : c.x < 12 ? 0x70207369U : c.x < 16 ? 0x7a652069U : c.x < 20 ? 0x73206769U : c.x < 24 ? 0x76656e20U : c.x < 28 ? 0x62792074U : c.x < 32 ? 0x68652064U : c.x < 36 ? 0x69737461U : c.x < 40 ? 0x6e636520U : c.x < 44 ? 0x6669656cU : c.x < 48 ? 0x642e2020U : f;
		}
		if( i == 17 ) {
			if(c.y == 3) f = c.x < 4 ? 0x57652073U : c.x < 8 ? 0x746f7020U : c.x < 12 ? 0x74686520U : c.x < 16 ? 0x6d617263U : c.x < 20 ? 0x68207768U : c.x < 24 ? 0x656e2077U : c.x < 28 ? 0x65206669U : c.x < 32 ? 0x6e642061U : c.x < 36 ? 0x6e20696eU : c.x < 40 ? 0x74657273U : c.x < 44 ? 0x65637469U : c.x < 48 ? 0x6f6e3a20U : f;
		}
		else if( i == 18 ) {
			if(c.y == 0) f = c.x < 4 ? 0x4e6f7720U : c.x < 8 ? 0x74686174U : c.x < 12 ? 0x20776520U : c.x < 16 ? 0x68617665U : c.x < 20 ? 0x20666f75U : c.x < 24 ? 0x6e642074U : c.x < 28 ? 0x68652069U : c.x < 32 ? 0x6e746572U : c.x < 36 ? 0x73656374U : c.x < 40 ? 0x696f6e20U : c.x < 44 ? 0x2870203dU : c.x < 48 ? 0x20726f20U : c.x < 52 ? 0x2b207264U : c.x < 56 ? 0x202a2074U : c.x < 60 ? 0x2920200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x666f7220U : c.x < 8 ? 0x6f757220U : c.x < 12 ? 0x7261792cU : c.x < 16 ? 0x20776520U : c.x < 20 ? 0x63616e20U : c.x < 24 ? 0x67697665U : c.x < 28 ? 0x20746865U : c.x < 32 ? 0x20736365U : c.x < 36 ? 0x6e652073U : c.x < 40 ? 0x6f6d6520U : c.x < 44 ? 0x6c696768U : c.x < 48 ? 0x74696e67U : c.x < 52 ? 0x2e20200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x2020200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x546f2061U : c.x < 8 ? 0x70706c79U : c.x < 12 ? 0x20646966U : c.x < 16 ? 0x66757365U : c.x < 20 ? 0x206c6967U : c.x < 24 ? 0x6874696eU : c.x < 28 ? 0x67207765U : c.x < 32 ? 0x20686176U : c.x < 36 ? 0x6520746fU : c.x < 40 ? 0x2063616cU : c.x < 44 ? 0x63756c61U : c.x < 48 ? 0x7465200aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x74686520U : c.x < 8 ? 0x6e6f726dU : c.x < 12 ? 0x616c206fU : c.x < 16 ? 0x66207368U : c.x < 20 ? 0x6164696eU : c.x < 24 ? 0x6720706fU : c.x < 28 ? 0x696e7420U : c.x < 32 ? 0x702e2020U : f;
		}
		else if( i == 19 ) {
			if(c.y == 0) f = c.x < 4 ? 0x54686520U : c.x < 8 ? 0x6e6f726dU : c.x < 12 ? 0x616c2063U : c.x < 16 ? 0x616e2062U : c.x < 20 ? 0x65206361U : c.x < 24 ? 0x6c63756cU : c.x < 28 ? 0x61746564U : c.x < 32 ? 0x20627920U : c.x < 36 ? 0x74616b69U : c.x < 40 ? 0x6e672074U : c.x < 44 ? 0x68652063U : c.x < 48 ? 0x656e7472U : c.x < 52 ? 0x616c200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x64696666U : c.x < 8 ? 0x6572656eU : c.x < 12 ? 0x63657320U : c.x < 16 ? 0x6f6e2074U : c.x < 20 ? 0x68652064U : c.x < 24 ? 0x69737461U : c.x < 28 ? 0x6e636520U : c.x < 32 ? 0x6669656cU : c.x < 36 ? 0x643a2020U : f;
		}
		else if( i == 20 || i == 21 ) {
			if(c.y == 0) f = c.x < 4 ? 0x57652063U : c.x < 8 ? 0x616c6375U : c.x < 12 ? 0x6c617465U : c.x < 16 ? 0x20746865U : c.x < 20 ? 0x20646966U : c.x < 24 ? 0x66757365U : c.x < 28 ? 0x206c6967U : c.x < 32 ? 0x6874696eU : c.x < 36 ? 0x6720666fU : c.x < 40 ? 0x7220610aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x706f696eU : c.x < 8 ? 0x74206c69U : c.x < 12 ? 0x67687420U : c.x < 16 ? 0x61742070U : c.x < 20 ? 0x6f736974U : c.x < 24 ? 0x696f6e20U : c.x < 28 ? 0x28302c32U : c.x < 32 ? 0x2c30292eU : f;
		}
		if( i == 21 ) {
			if(c.y == 3) f = c.x < 4 ? 0x496e2063U : c.x < 8 ? 0x6f64653aU : f;
		}
		else if( i == 22 ) {
			if(c.y == 0) f = c.x < 4 ? 0x416e6420U : c.x < 8 ? 0x77652061U : c.x < 12 ? 0x72652064U : c.x < 16 ? 0x6f6e6521U : c.x < 20 ? 0x2020200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x2020200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x41646469U : c.x < 8 ? 0x6e672061U : c.x < 12 ? 0x6d626965U : c.x < 16 ? 0x6e74206fU : c.x < 20 ? 0x63636c75U : c.x < 24 ? 0x73696f6eU : c.x < 28 ? 0x2c202866U : c.x < 32 ? 0x616b6529U : c.x < 36 ? 0x20726566U : c.x < 40 ? 0x6c656374U : c.x < 44 ? 0x696f6e73U : c.x < 48 ? 0x2c20200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x736f6674U : c.x < 8 ? 0x20736861U : c.x < 12 ? 0x646f7773U : c.x < 16 ? 0x2c20666fU : c.x < 20 ? 0x672c2061U : c.x < 24 ? 0x6d626965U : c.x < 28 ? 0x6e74206cU : c.x < 32 ? 0x69676874U : c.x < 36 ? 0x696e6720U : c.x < 40 ? 0x616e6420U : c.x < 44 ? 0x73706563U : c.x < 48 ? 0x756c6172U : c.x < 52 ? 0x206c6967U : c.x < 56 ? 0x6874696eU : c.x < 60 ? 0x6720200aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x6973206cU : c.x < 8 ? 0x65667420U : c.x < 12 ? 0x61732061U : c.x < 16 ? 0x6e206578U : c.x < 20 ? 0x65726369U : c.x < 24 ? 0x73652066U : c.x < 28 ? 0x6f722074U : c.x < 32 ? 0x68652072U : c.x < 36 ? 0x65616465U : c.x < 40 ? 0x722e2020U : f;
		}
		drawStr( f, c, uv, vec2(-120, 40), 8., vec3(1), outCol );
    }
    if(text2.z > 0) { // code
        int i = text2.z;
		ivec2 c = ivec2( (uv - vec2(-120, 0)) * (1./vec2(3.6, -8)) + vec2(1,2)) - 1;
		uint f = 0x0U;
		if( i == 1 ) {
			if(c.y == 0) f = c.x < 4 ? 0x766f6964U : c.x < 8 ? 0x206d6169U : c.x < 12 ? 0x6e496d61U : c.x < 16 ? 0x6765286fU : c.x < 20 ? 0x75742076U : c.x < 24 ? 0x65633420U : c.x < 28 ? 0x66726167U : c.x < 32 ? 0x436f6c6fU : c.x < 36 ? 0x722c2069U : c.x < 40 ? 0x6e207665U : c.x < 44 ? 0x63322066U : c.x < 48 ? 0x72616743U : c.x < 52 ? 0x6f6f7264U : c.x < 56 ? 0x29207b0aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656333U : c.x < 12 ? 0x20726f20U : c.x < 16 ? 0x3d207665U : c.x < 20 ? 0x63332830U : c.x < 24 ? 0x2c20302cU : c.x < 28 ? 0x2031293bU : c.x < 32 ? 0x2020200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x2020200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656332U : c.x < 12 ? 0x2071203dU : c.x < 16 ? 0x20286672U : c.x < 20 ? 0x6167436fU : c.x < 24 ? 0x6f72642eU : c.x < 28 ? 0x7879202dU : c.x < 32 ? 0x202e3520U : c.x < 36 ? 0x2a206952U : c.x < 40 ? 0x65736f6cU : c.x < 44 ? 0x7574696fU : c.x < 48 ? 0x6e2e7879U : c.x < 52 ? 0x2029202fU : c.x < 56 ? 0x20695265U : c.x < 60 ? 0x736f6c75U : c.x < 64 ? 0x74696f6eU : c.x < 68 ? 0x2e793b0aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656333U : c.x < 12 ? 0x20726420U : c.x < 16 ? 0x3d206e6fU : c.x < 20 ? 0x726d616cU : c.x < 24 ? 0x697a6528U : c.x < 28 ? 0x76656333U : c.x < 32 ? 0x28712c20U : c.x < 36 ? 0x302e2920U : c.x < 40 ? 0x2d20726fU : c.x < 44 ? 0x293b200aU : f;
		}
		else if( i == 2 ) {
			if(c.y == 0) f = c.x < 4 ? 0x666c6f61U : c.x < 8 ? 0x74206d61U : c.x < 12 ? 0x70287665U : c.x < 16 ? 0x63332070U : c.x < 20 ? 0x29207b0aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x666c6f61U : c.x < 12 ? 0x74206420U : c.x < 16 ? 0x3d206469U : c.x < 20 ? 0x7374616eU : c.x < 24 ? 0x63652870U : c.x < 28 ? 0x2c207665U : c.x < 32 ? 0x6333282dU : c.x < 36 ? 0x312c2030U : c.x < 40 ? 0x2c202d35U : c.x < 44 ? 0x2929202dU : c.x < 48 ? 0x20312e3bU : c.x < 52 ? 0x2020200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x64203d20U : c.x < 12 ? 0x6d696e28U : c.x < 16 ? 0x642c2064U : c.x < 20 ? 0x69737461U : c.x < 24 ? 0x6e636528U : c.x < 28 ? 0x702c2076U : c.x < 32 ? 0x65633328U : c.x < 36 ? 0x322c2030U : c.x < 40 ? 0x2c202d33U : c.x < 44 ? 0x2929202dU : c.x < 48 ? 0x20312e29U : c.x < 52 ? 0x3b20200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x64203d20U : c.x < 12 ? 0x6d696e28U : c.x < 16 ? 0x642c2064U : c.x < 20 ? 0x69737461U : c.x < 24 ? 0x6e636528U : c.x < 28 ? 0x702c2076U : c.x < 32 ? 0x65633328U : c.x < 36 ? 0x2d322c20U : c.x < 40 ? 0x302c202dU : c.x < 44 ? 0x32292920U : c.x < 48 ? 0x2d20312eU : c.x < 52 ? 0x293b200aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x64203d20U : c.x < 12 ? 0x6d696e28U : c.x < 16 ? 0x642c2070U : c.x < 20 ? 0x2e79202bU : c.x < 24 ? 0x20312e29U : c.x < 28 ? 0x3b20200aU : f;
			if(c.y == 5) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x72657475U : c.x < 12 ? 0x726e2064U : c.x < 16 ? 0x3b20200aU : f;
			if(c.y == 6) f = c.x < 4 ? 0x7d202020U : f;
		}
		else if( i == 3 ) {
			if(c.y == 0) f = c.x < 4 ? 0x666c6f61U : c.x < 8 ? 0x7420682cU : c.x < 12 ? 0x2074203dU : c.x < 16 ? 0x20312e3bU : c.x < 20 ? 0x2020200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x666f7220U : c.x < 8 ? 0x28696e74U : c.x < 12 ? 0x2069203dU : c.x < 16 ? 0x20303b20U : c.x < 20 ? 0x69203c20U : c.x < 24 ? 0x3235363bU : c.x < 28 ? 0x20692b2bU : c.x < 32 ? 0x29207b0aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x68203d20U : c.x < 12 ? 0x6d617028U : c.x < 16 ? 0x726f202bU : c.x < 20 ? 0x20726420U : c.x < 24 ? 0x2a207429U : c.x < 28 ? 0x3b20200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x74202b3dU : c.x < 12 ? 0x20683b0aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x69662028U : c.x < 12 ? 0x68203c20U : c.x < 16 ? 0x302e3031U : c.x < 20 ? 0x29206272U : c.x < 24 ? 0x65616b3bU : c.x < 28 ? 0x2020200aU : f;
			if(c.y == 5) f = c.x < 4 ? 0x7d202020U : f;
		}
		else if( i == 4 ) {
			if(c.y == 0) f = c.x < 4 ? 0x76656333U : c.x < 8 ? 0x2063616cU : c.x < 12 ? 0x634e6f72U : c.x < 16 ? 0x6d616c28U : c.x < 20 ? 0x696e2076U : c.x < 24 ? 0x65633320U : c.x < 28 ? 0x7029207bU : c.x < 32 ? 0x2020200aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656332U : c.x < 12 ? 0x2065203dU : c.x < 16 ? 0x20766563U : c.x < 20 ? 0x3228312eU : c.x < 24 ? 0x302c202dU : c.x < 28 ? 0x312e3029U : c.x < 32 ? 0x202a2030U : c.x < 36 ? 0x2e303030U : c.x < 40 ? 0x353b200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x72657475U : c.x < 12 ? 0x726e206eU : c.x < 16 ? 0x6f726d61U : c.x < 20 ? 0x6c697a65U : c.x < 24 ? 0x2820200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x20202020U : c.x < 12 ? 0x652e7879U : c.x < 16 ? 0x79202a20U : c.x < 20 ? 0x6d617028U : c.x < 24 ? 0x70202b20U : c.x < 28 ? 0x652e7879U : c.x < 32 ? 0x7929202bU : c.x < 36 ? 0x2020200aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x20202020U : c.x < 12 ? 0x652e7979U : c.x < 16 ? 0x78202a20U : c.x < 20 ? 0x6d617028U : c.x < 24 ? 0x70202b20U : c.x < 28 ? 0x652e7979U : c.x < 32 ? 0x7829202bU : c.x < 36 ? 0x2020200aU : f;
			if(c.y == 5) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x20202020U : c.x < 12 ? 0x652e7978U : c.x < 16 ? 0x79202a20U : c.x < 20 ? 0x6d617028U : c.x < 24 ? 0x70202b20U : c.x < 28 ? 0x652e7978U : c.x < 32 ? 0x7929202bU : c.x < 36 ? 0x2020200aU : f;
			if(c.y == 6) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x20202020U : c.x < 12 ? 0x652e7878U : c.x < 16 ? 0x78202a20U : c.x < 20 ? 0x6d617028U : c.x < 24 ? 0x70202b20U : c.x < 28 ? 0x652e7878U : c.x < 32 ? 0x7829293bU : c.x < 36 ? 0x2020200aU : f;
			if(c.y == 7) f = c.x < 4 ? 0x7d202020U : f;
		}
		else if( i == 5 ) {
			if(c.y == 0) f = c.x < 4 ? 0x69662028U : c.x < 8 ? 0x68203c20U : c.x < 12 ? 0x302e3031U : c.x < 16 ? 0x29207b0aU : f;
			if(c.y == 1) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656333U : c.x < 12 ? 0x2070203dU : c.x < 16 ? 0x20726f20U : c.x < 20 ? 0x2b207264U : c.x < 24 ? 0x202a2074U : c.x < 28 ? 0x3b20200aU : f;
			if(c.y == 2) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656333U : c.x < 12 ? 0x206e6f72U : c.x < 16 ? 0x6d616c20U : c.x < 20 ? 0x3d206361U : c.x < 24 ? 0x6c634e6fU : c.x < 28 ? 0x726d616cU : c.x < 32 ? 0x2870293bU : c.x < 36 ? 0x2020200aU : f;
			if(c.y == 3) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x76656333U : c.x < 12 ? 0x206c6967U : c.x < 16 ? 0x6874203dU : c.x < 20 ? 0x20766563U : c.x < 24 ? 0x3328302cU : c.x < 28 ? 0x20322c20U : c.x < 32 ? 0x30293b0aU : f;
			if(c.y == 4) f = c.x < 4 ? 0x2020200aU : f;
			if(c.y == 5) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x666c6f61U : c.x < 12 ? 0x74206469U : c.x < 16 ? 0x66203d20U : c.x < 20 ? 0x636c616dU : c.x < 24 ? 0x7028646fU : c.x < 28 ? 0x74286e6fU : c.x < 32 ? 0x726d616cU : c.x < 36 ? 0x2c206e6fU : c.x < 40 ? 0x726d616cU : c.x < 44 ? 0x697a6528U : c.x < 48 ? 0x6c696768U : c.x < 52 ? 0x74202d20U : c.x < 56 ? 0x7029292cU : c.x < 60 ? 0x20302e2cU : c.x < 64 ? 0x20312e29U : c.x < 68 ? 0x3b20200aU : f;
			if(c.y == 6) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x64696620U : c.x < 12 ? 0x2a3d2035U : c.x < 16 ? 0x2e202f20U : c.x < 20 ? 0x646f7428U : c.x < 24 ? 0x6c696768U : c.x < 28 ? 0x74202d20U : c.x < 32 ? 0x702c206cU : c.x < 36 ? 0x69676874U : c.x < 40 ? 0x202d2070U : c.x < 44 ? 0x293b200aU : f;
			if(c.y == 7) f = c.x < 4 ? 0x20202020U : c.x < 8 ? 0x66726167U : c.x < 12 ? 0x436f6c6fU : c.x < 16 ? 0x72203d20U : c.x < 20 ? 0x76656334U : c.x < 24 ? 0x28766563U : c.x < 28 ? 0x3328706fU : c.x < 32 ? 0x77286469U : c.x < 36 ? 0x662c2030U : c.x < 40 ? 0x2e343534U : c.x < 44 ? 0x3529292cU : c.x < 48 ? 0x2031293bU : c.x < 52 ? 0x2020200aU : f;
			if(c.y == 8) f = c.x < 4 ? 0x7d202020U : f;
		}
		drawStr( f, c, uv, vec2(-120, 0), 8., vec3(.8,.95,1.), outCol );
        if( text1.y > 0 ) {
           if(uv.y >  - (-1.+float(text1.y))*8. && c.y >= 0 ) {
                outCol *= vec4(.5,.2,.6,.8);
            }
        }
        if( text1.z > 0 ) {
            if(uv.y <  - (-2.+float(text1.z))*8. && c.y >= 0 ) {
                outCol *= vec4(.5,.2,.6,.8);
            }
        }
    }
    if(slideData.y == 120) { // footer
        int i = 1;
		uint f = 0x0U;
		if( i == 1 ) {
			ivec2 c = ivec2( (uv - vec2(-38.8, -78)) * (1./vec2(3.38, -7.5)) + vec2(1,2)) - 1;
			if(c.y == 0) f = c.x < 4 ? 0x50726573U : c.x < 8 ? 0x73207370U : c.x < 12 ? 0x61636520U : c.x < 16 ? 0x746f2063U : c.x < 20 ? 0x6f6e7469U : c.x < 24 ? 0x6e756520U : f;
			drawStr( f, c, uv, vec2(-38.8, -78), 7.5, vec3(.9), outCol );		}

    }
}`;

const fragment = `
#define SLIDE_FADE_STEPS 60

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    int SLIDE_STEPS_VISIBLE = int(texelFetch( iChannel0, ivec2(0,0), 0 ).y);
    
    vec4 current = texelFetch(iChannel1, ivec2(fragCoord), 0);
    vec4 prev    = texelFetch(iChannel2, ivec2(fragCoord), 0);
    vec4 font    = texelFetch(iChannel3, ivec2(fragCoord), 0);

	fragColor = mix( prev, current, clamp( float(SLIDE_STEPS_VISIBLE)/float(SLIDE_FADE_STEPS), 0., 1.) );
    fragColor = mix( fragColor * .75, font, font.a );
}`;

export default class implements iSub {
  key(): string {
    return '4dSfRc';
  }
  name(): string {
    return '[SH17C] Raymarching tutorial';
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
  webgl() {
    return WEBGL_2;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [
      webglUtils.DEFAULT_NOISE,
      webglUtils.DEFAULT_NOISE,
      webglUtils.FONT_TEXTURE, //
    ];
  }
}
