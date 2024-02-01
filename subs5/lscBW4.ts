import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define MAT_TABLE    1.
#define MAT_PENCIL_0 2.
#define MAT_PENCIL_1 3.
#define MAT_PENCIL_2 4.
#define MAT_DIAL     5.
#define MAT_HAND     6.
#define MAT_METAL_0  7.
#define MAT_METAL_1  8.

#define CLOCK_ROT_X -0.26
#define CLOCK_ROT_Y 0.2
#define CLOCK_OFFSET_Y 0.42
#define PENCIL_POS vec3(-0.31,-0.2, -.725)

float MAX_T = 10.;

//
// SDF functions (by Inigo Quilez).
//

float sdPlane( const vec3 p ) {
	return p.y;
}

float sdTorus( const vec3 p, const vec2 t ) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float sdTorusYZ( const vec3 p, const vec2 t ) {
  vec2 q = vec2(length(p.yz)-t.x,p.x);
  return length(q)-t.y;
}

float sdTorusYX( const vec3 p, const vec2 t ) {
  vec2 q = vec2(length(p.yx)-t.x,p.z);
  return length(q)-t.y;
}

float sdCylinder( const vec3 p, const vec2 h ) {
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdCylinderZY( const vec3 p, const vec2 h ) {
  vec2 d = abs(vec2(length(p.zy),p.x)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdCylinderXY( const vec3 p, const vec2 h ) {
  vec2 d = abs(vec2(length(p.xy),p.z)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}


float sdHexPrism( const vec3 p, const vec2 h ) {
    vec3 q = abs(p);
#if 0
    return max(q.x-h.y,max((q.z*0.866025+q.y*0.5),q.y)-h.x);
#else
    float d1 = q.x-h.y;
    float d2 = max((q.z*0.866025+q.y*0.5),q.y)-h.x;
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
#endif
}

float sdEllipsoid( const vec3 p, const vec3 r ) {
    return (length( p/r ) - 1.0) * min(min(r.x,r.y),r.z);
}

float sdCapsule( const vec3 p, const vec3 a, const vec3 b, const float r ) {
	vec3 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - r;
}

float sdSphere( const vec3 p, const float r ) {
    return length(p) - r;
}

float sdCone( const vec3 p, const vec2 c ) {
    float q = length(p.yz);
    return dot(c,vec2(q,p.x));
}

float sdSegment2D( const vec2 p, const vec2 a, const vec2 b, const float w ) {
	vec2 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - w;
}

float opS( const float d1, const float d2 ) {
    return max(-d1,d2);
}

float opU( const float d1, const float d2 ) {
    return min(d1,d2);
}

vec3 rotateX( in vec3 p, const float t ) {
    float co = cos(t);
    float si = sin(t);
    p.yz = mat2(co,-si,si,co)*p.yz;
    return p;
}

vec3 rotateY( in vec3 p, const float t ) {
    float co = cos(t);
    float si = sin(t);
    p.xz = mat2(co,-si,si,co)*p.xz;
    return p;
}

vec3 rotateZ( in vec3 p, const float t ) {
    float co = cos(t);
    float si = sin(t);
    p.xy = mat2(co,-si,si,co)*p.xy;
    return p;
}

vec2 rotate( in vec2 p, const float t ) {
    float co = cos(t);
    float si = sin(t);
    p = mat2(co,-si,si,co) * p;
    return p;
}

//
// Hash without Sine by Dave Hoskins.
//

float hash11(float p) {
	vec3 p3  = fract(vec3(p) * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

//
// SDF of the scene.
//

float mapHand( const vec3 pos, const float w, const float l, const float r ) {
    float d = sdSegment2D(pos.xz, vec2(0,-w*10.), vec2(0,l), w);
    d = min(d, length(pos.xz) - (.03+r));
    return max(d, abs(pos.y)-.005);
}

vec2 map( in vec3 pos, in vec3 p1, in vec3 ps, in vec3 pm, in vec3 ph, 
         const bool watchIntersect, const bool pencilIntersect ) {
    //--- table
    vec2 res = vec2(sdPlane(pos), MAT_TABLE);
    
    // chain
    if (pos.z > 1.1) {
        float h = smoothstep(3., -.4, pos.z)*.74 + .045;
        float dChain0 = length(pos.xy+vec2(.3*sin(pos.z), -h))-.1;
        if (dChain0 < 0.1) {
            dChain0 = 10.;
            float pth1z = floor(pos.z*5.);
            if (pth1z > 5.) {
	            float pth1 = hash11(floor(pos.z*5.));
    	        vec3 pt1 = vec3(pos.x + .3*sin(pos.z)- pth1 *.02 + 0.02, pos.y-h - pth1 *.03, mod(pos.z, .2) - .1);
        	    pt1 = rotateZ(pt1, .6 * smoothstep(2.,3., pos.z));
            	dChain0 = sdTorus(pt1, vec2(.071, .02)); 
            }
            
            float pth2z = floor(pos.z*5. + .5);
            float pth2 = hash11(pth2z); 
            vec3 pt2 = vec3(pos.x + .3*sin(pos.z)- pth2 *.02 + 0.02, pos.y-h - pth2 *.03, mod(pos.z + .1, .2) - .1);
            pt2 = rotateZ(pt2, 1.1 * smoothstep(2.,3., pos.z));
            dChain0 = opU(dChain0, sdTorusYZ(pt2, vec2(.071, .02)));          
        }
        if (dChain0 < res.x) res = vec2(dChain0, MAT_METAL_1);
    }
    //--- pencil
    if (pencilIntersect) {
        float dPencil0 = sdHexPrism(pos + PENCIL_POS, vec2(.2, 2.));
        dPencil0 = opS(-sdCone(pos + (PENCIL_POS + vec3(-2.05,0,0)), vec2(.95,0.3122)),dPencil0);
        dPencil0 = opS(sdSphere(pos + (PENCIL_POS + vec3(-2.4,-2.82,-1.03)), 3.), dPencil0);
        dPencil0 = opS(sdSphere(pos + (PENCIL_POS + vec3(-2.5,-0.82,2.86)), 3.), dPencil0);
        if (dPencil0 < res.x) res = vec2(dPencil0, MAT_PENCIL_0);

        float dPencil1 = sdCapsule(pos, -PENCIL_POS - vec3(2.2,0.,0.), -PENCIL_POS-vec3(2.55, 0., 0.), .21);
        if (dPencil1 < res.x) res = vec2(dPencil1, MAT_PENCIL_1);
        float ax = abs(-2.25 - pos.x - PENCIL_POS.x);
        float r = .02*abs(2.*fract(30.*pos.x)-1.)*smoothstep(.08,.09,ax)*smoothstep(.21,.2,ax);

        float dPencil2 = sdCylinderZY(pos + PENCIL_POS + vec3(2.25,-0.0125,0), vec2(.22 - r,.25));
        if (dPencil2 < res.x) res = vec2(dPencil2, MAT_PENCIL_2);
    }
    
    //--- watch
    if (watchIntersect) {
        float dDial = sdCylinder(p1, vec2(1.05,.13));
        if (dDial < res.x) res = vec2(dDial, MAT_DIAL);

        float dC = sdTorusYX(vec3(max(abs(p1.x)-.5*p1.y-0.19,0.),p1.y+0.12,p1.z-1.18), vec2(0.11,0.02));
        if (dC < res.x) res = vec2(dC, MAT_METAL_1);
        
        float dM = sdTorus(p1 + vec3(0,-.165,0), vec2(1.005,.026));   
        float bb = sdCylinderXY(p1+vec3(0,0,-1.3), vec2(0.15,0.04));
        if(bb < 0.5) {
            float a = atan(p1.y, p1.x);
            float c = abs(fract(a*3.1415)-.5);
            float d = min(abs(p1.z-1.3), .02);
            bb = sdCylinderXY(p1+vec3(0,0,-1.3), vec2(0.15 - 40.*d*d - .1*c*c,0.04));
        } 
        dM = opU(dM, bb);
         
        dM = opU(dM, sdCylinderZY(p1+vec3(0,0,-1.18), vec2(0.06,0.2)));
        float rr = min(abs(p1.z-1.26), .2);
        dM = opU(dM, sdCylinderXY(p1+vec3(0,0,-1.2), vec2(0.025 + 0.35*rr,0.1)));
       
        p1.y = abs(p1.y);
        dM = opU(dM, sdTorus(p1 + vec3(0,-.1,0), vec2(1.025,.075)));
        dM = opU(dM, sdCylinder(p1, vec2(1.1,.1)));
        dM = opS(sdTorus(p1 + vec3(0,-.1,0), vec2(1.11,.015)), dM);
        dM = opU(dM, sdCylinder(p1, vec2(0.01,0.175)));
        dM = opU(dM, sdCylinder(p1+vec3(0,0,.6), vec2(0.01,0.155)));
        if (dM < res.x) res = vec2(dM, MAT_METAL_0);

        // minutes hand
        float dMin = mapHand(pm + vec3(0,-.16,0), .02, 0.7, 0.015);
        if (dMin < res.x) res = vec2(dMin, MAT_HAND);
        // hours hand
        float dHour = mapHand(ph + vec3(0,-.15,0), .02, 0.4, 0.03);
        if (dHour < res.x) res = vec2(dHour, MAT_HAND);
        // seconds hand
        float dSeconds = mapHand(ps + vec3(0,-.14,0), .01, 0.17, 0.006);
        if (dSeconds < res.x) res = vec2(dSeconds, MAT_HAND);
    }
    
    return res;
}

vec2 map( in vec3 pos ) {
    vec3 p1 = rotateX( pos + vec3(0,-CLOCK_OFFSET_Y,0), CLOCK_ROT_X );
    p1 = rotateY( p1, CLOCK_ROT_Y );
    
	float secs = mod( floor(iDate.w),        60.0 );
	float mins = mod( floor(iDate.w/60.0),   60.0 );
	float hors = mod( floor(iDate.w/3600.0), 24.0 ) + mins/60.;
    
    vec3 ps = rotateY( p1+vec3(0,0,.6), 6.2831*secs/60.0 );
    vec3 pm = rotateY( p1, 6.2831*mins/60.0 );
    vec3 ph = rotateY( p1, 6.2831*hors/12.0 );
    
    return map( pos, p1, ps, pm, ph, true, true );
}

float mapGlass( in vec3 pos ) {
    return sdEllipsoid( pos - vec3(0,.10,0), vec3(1.,.2,1.) );
}

//
// Ray march code.
//

vec2 sphIntersect( in vec3 ro, in vec3 rd, in float r ) {
	vec3 oc = ro;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - r * r;
	float h = b*b - c;
	if( h<0.0 ) return vec2(-1.0);
    h = sqrt( h );
	return vec2(-b - h, -b + h);
}

bool boxIntserct( in vec3 ro, in vec3 rd, in vec3 rad ) {
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
	
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	
	if( tN > tF || tF < 0.0) return false;

	return true;
}

vec3 calcNormal( in vec3 pos ) {
    const vec2 e = vec2(1.0,-1.0)*0.0075;
    return normalize( e.xyy*map( pos + e.xyy ).x + 
					  e.yyx*map( pos + e.yyx ).x + 
					  e.yxy*map( pos + e.yxy ).x + 
					  e.xxx*map( pos + e.xxx ).x );
}

vec2 castRay( in vec3 ro, in vec3 rd ) {
    float tmin = 0.5;
    float tmax = MAX_T;
    
    // bounding volume
    const float top = 0.95;
    float tp1 = (0.0-ro.y)/rd.y; if( tp1>0.0 ) tmax = min( tmax, tp1 );
    float tp2 = (top-ro.y)/rd.y; if( tp2>0.0 ) { if( ro.y>top ) tmin = max( tmin, tp2 );
                                                 else           tmax = min( tmax, tp2 ); }
    
    float t = tmin;
    float mat = -1.;
    
    vec3 p1 = rotateX( ro + vec3(0,-CLOCK_OFFSET_Y,0), CLOCK_ROT_X );
    p1 = rotateY( p1, CLOCK_ROT_Y );
    vec3 rd1 = rotateX( rd, CLOCK_ROT_X );
    rd1 = rotateY( rd1, CLOCK_ROT_Y );
    
	float secs = mod( floor(iDate.w),        60.0 );
	float mins = mod( floor(iDate.w/60.0),   60.0 );
	float hors = mod( floor(iDate.w/3600.0), 24.0 ) + mins/60.;
    
    vec3 ps = rotateY( p1+vec3(0,0,.6), 6.2831*secs/60.0 );
    vec3 rds = rotateY( rd1, 6.2831*secs/60.0 );
    
    vec3 pm = rotateY( p1, 6.2831*mins/60.0 );
    vec3 rdm = rotateY( rd1, 6.2831*mins/60.0 );
    
    vec3 ph = rotateY( p1, 6.2831*hors/12.0 );
    vec3 rdh = rotateY( rd1, 6.2831*hors/12.0 );
    
    bool watchIntersect = boxIntserct(p1, rd1, vec3(1.1,.2,1.4));
    bool pencilIntersect = boxIntserct(ro + PENCIL_POS, rd, vec3(3.,.23,.23));
    
    for( int i=0; i<48; i++ ) {
	    float precis = 0.00025*t;
	    vec2 res = map( ro+rd*t, p1+rd1*t, ps+rds*t, pm+rdm*t, ph+rdh*t, 
                       watchIntersect, pencilIntersect );
        if( res.x<precis || t>tmax ) break; //return vec2(t, mat);
        t += res.x;
        mat = res.y;
    }

    if( t>tmax ) t=-1.0;
    return vec2(t, mat);
}

vec3 calcNormalGlass( in vec3 pos ) {
    const vec2 e = vec2(1.0,-1.0)*0.005;
    return normalize( e.xyy*mapGlass( pos + e.xyy ) + 
					  e.yyx*mapGlass( pos + e.yyx ) + 
					  e.yxy*mapGlass( pos + e.yxy ) + 
					  e.xxx*mapGlass( pos + e.xxx ) );
}

float castRayGlass( in vec3 ro, in vec3 rd ) {
    vec3 p1 = rotateX( ro + vec3(0,-CLOCK_OFFSET_Y,0), CLOCK_ROT_X );
    p1 = rotateY( p1, CLOCK_ROT_Y );
    vec3 rd1 = rotateX( rd, CLOCK_ROT_X );
    rd1 = rotateY( rd1, CLOCK_ROT_Y );

    float t = -1.;
    vec2 bb = sphIntersect( p1- vec3(0,.10,0), rd1, 1.);
    if (bb.y > 0.) {
        t = max(bb.x, 0.);
        float tmax = bb.y;
        for( int i=0; i<24; i++ ) {
            float precis = 0.00025*t;
            float res = mapGlass( p1+rd1*t );
            if( res<precis || t>tmax ) break; 
            t += res;
        }

        if( t>tmax ) t=-1.0;
    }
    return t;
}


float calcAO( in vec3 ro, in vec3 rd ) {
	float occ = 0.0;
    float sca = 1.0;
    
    vec3 p1 = rotateX( ro + vec3(0,-CLOCK_OFFSET_Y,0), CLOCK_ROT_X );
    p1 = rotateY( p1, CLOCK_ROT_Y );
    vec3 rd1 = rotateX( rd, CLOCK_ROT_X );
    rd1 = rotateY( rd1, CLOCK_ROT_Y );
    
	float secs = mod( floor(iDate.w),        60.0 );
	float mins = mod( floor(iDate.w/60.0),   60.0 );
	float hors = mod( floor(iDate.w/3600.0), 24.0 ) + mins/60.;
    
    vec3 ps = rotateY( p1+vec3(0,0,.6), 6.2831*secs/60.0 );
    vec3 rds = rotateY( rd1, 6.2831*secs/60.0 );
    
    vec3 pm = rotateY( p1, 6.2831*mins/60.0 );
    vec3 rdm = rotateY( rd1, 6.2831*mins/60.0 );
    
    vec3 ph = rotateY( p1, 6.2831*hors/12.0 );
    vec3 rdh = rotateY( rd1, 6.2831*hors/12.0 );
    
    bool watchIntersect = true; //boxIntserct(p1, rd1, vec3(1.1,.2,1.4));
    bool pencilIntersect = true; //boxIntserct(ro + PENCIL_POS, rd, vec3(3.,.23,.23));
    
    
    for( int i=0; i<6; i++ ) {
        float h = 0.001 + 0.25*float(i)/5.0;
        float d = map( ro+rd*h, p1+rd1*h, ps+rds*h, pm+rdm*h, ph+rdh*h, 
                       watchIntersect, pencilIntersect ).x;
        occ += (h-d)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 1.5*occ, 0.0, 1.0 );    
}

//
// Material properties.
//

vec4 texNoise( sampler2D sam, in vec3 p, in vec3 n ) {
	vec4 x = texture( sam, p.yz );
	vec4 y = texture( sam, p.zx );
	vec4 z = texture( sam, p.xy );

	return x*abs(n.x) + y*abs(n.y) + z*abs(n.z);
}

void getMaterialProperties(
    in vec3 pos, in float mat,
    inout vec3 normal, inout vec3 albedo, inout float ao, inout float roughness, inout float metallic,
	sampler2D tex1, sampler2D tex2, sampler2D tex3) {
    
    vec3 pinv = rotateX( pos + vec3(0,-CLOCK_OFFSET_Y,0), CLOCK_ROT_X );
    pinv = rotateY( pinv, CLOCK_ROT_Y );
    
    normal = calcNormal( pos );
    ao = calcAO(pos, normal);
    metallic = 0.;
    
    vec4 noise = texNoise(tex1, pinv * .5, normal);
    float metalnoise = 1.- noise.r;
    metalnoise*=metalnoise;

    mat -= .5;
    if (mat < MAT_TABLE) {
        albedo = .7 * pow(texture(tex1, rotate(pos.xz * .4 + .25, -.3)).rgb, 2.2*vec3(0.45,0.5,0.5));
        roughness = 0.95 - albedo.r * .6;
    }
    else if( mat < MAT_PENCIL_0 ) {
        vec2 npos = pos.yz + PENCIL_POS.yz;
        if (length(npos) < 0.055) {
        	albedo = vec3(0.02);
        	roughness = .9;
        } else if(sdHexPrism(pos + PENCIL_POS, vec2(.195, 3.)) < 0.) {
        	albedo = .8* texture(tex1, pos.xz).rgb;
        	roughness = 0.99;
        } else {
        	albedo = .5*pow(vec3(1.,.8,.15), vec3(2.2));
        	roughness = .75 - noise.b * .4;
        }
        albedo *= noise.g * .75 + .7;
    }
    else if( mat < MAT_PENCIL_1 ) {
       	albedo = .4*pow(vec3(.85,.75,.55), vec3(2.2));
       	roughness = 1.;
    }
    else if( mat < MAT_PENCIL_2 ) {
        float ax = abs(-2.25 - pos.x - PENCIL_POS.x);
        float r = 1. - abs(2.*fract(30.*pos.x)-1.)*smoothstep(.08,.09,ax)*smoothstep(.21,.2,ax);

        r -= 4. * metalnoise;  
        ao *= .5 + .5 * r;
	    albedo = mix(vec3(0.5, 0.3, 0.2),vec3(0.560, 0.570, 0.580), ao * ao); // Iron
   		roughness = 1.-.25*r;
   		metallic = 1.; 
    }
    else if( mat < MAT_DIAL ) {
        float dial = texture(tex2, vec2(-.5 * pinv.x + .5, +.5 * pinv.z + .5)).r;
        albedo = vec3(dial);
        roughness = dial + .95;
    }
    else if( mat < MAT_HAND ) {
        albedo = vec3(0.02);
        roughness = .65;
    }
    else if( mat < MAT_METAL_0 ) {
	    albedo = vec3(1.000, 0.766, 0.336); // Gold
   		roughness = .6;
   		metallic = 1.; 
    } 
    else if( mat < MAT_METAL_1 ) {
	    albedo = vec3(0.972, 0.960, 0.915); // Silver
   		roughness = .7 + max(.15 * length(pos.xz)-.3, 0.); // prevent aliasing
   		metallic = 1.; 
    }
    
    if (mat < MAT_PENCIL_2) {
        ao = min(ao, smoothstep(.95, 1.5, length(pos.xz)));
    }
    
    if (metallic > .5) {   
        albedo *= 1.-metalnoise;
        roughness += metalnoise*4.;
    }
    
    ao = clamp(.1+.9*ao, 0., 1.);
    roughness = clamp(roughness, 0., 1.);
}

mat3 setCamera( in vec3 ro, in vec3 ta ) {
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(0.0, 1.0,0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}
`;

const buffA = `
bool resolutionChanged() {
    return floor(texelFetch(iChannel0, ivec2(0), 0).r) != floor(iResolution.x);
}

float printChar(vec2 uv, uint char) {
    float d = textureLod(iChannel1, (uv + vec2( char & 0xFU, 0xFU - (char >> 4))) / 16.,0.).a;
	return smoothstep(1.,0., smoothstep(.5,.51,d));
}

float dialSub( in vec2 uv, float wr ) {
    float r = length( uv );
    float a = atan( uv.y, uv.x )+3.1415926;

    float f = abs(2.0*fract(0.5+a*60.0/6.2831)-1.0);
    float g = 1.0-smoothstep( 0.0, 0.1, abs(2.0*fract(0.5+a*12.0/6.2831)-1.0) );
    float w = fwidth(f);
    f = 1.0 - smoothstep( 0.2*g+0.05-w, 0.2*g+0.05+w, f );
    float s = abs(fwidth(r));
    f *= smoothstep( 0.9 - wr -s, 0.9 - wr, r ) - smoothstep( 0.9, 0.9+s, r );
    float hwr = wr * .5;
    f -= 1.-smoothstep(hwr+s,hwr,abs(r-0.9+hwr)) - smoothstep(hwr-s,hwr,abs(r-0.9+hwr));

    return .1 + .8 * clamp(1.-f,0.,1.);
}

float dial(vec2 uv) {
    float d = dialSub(uv, 0.05);

    vec2 uvs = uv;
    
    uvs.y += 0.6;
    uvs *= 1./(0.85-0.6);

    d = min(d, dialSub(uvs, 0.1));
    
    vec2 center = vec2(0.5);
    vec2 radius = vec2(3.65, 0.);
    
    for (int i=0; i<9; i++) {
        if(i!=5) {
	        float a = 6.28318530718 * float(i+4)/12.;
    	    vec2 uvt = clamp(uv * 5. + center + rotate(radius, a), vec2(0), vec2(1));
        	d = mix(d, 0.3, printChar(uvt, uint(49+i)));
        }
    }
    for (int i=0; i<3; i++) {
	    float a = 6.28318530718 * float(i+13)/12.;
    	vec2 uvt1 = clamp(uv * 5. + center + rotate(radius, a) + vec2(.25,0.), vec2(0), vec2(1));
        d = mix(d, 0.3, printChar(uvt1, uint(49)));
    	vec2 uvt = clamp(uv * 5. + center + rotate(radius, a)+ vec2(-.15,0.), vec2(0), vec2(1));
        d = mix(d, 0.3, printChar(uvt, uint(48+i)));
    }
    
    d *= .9 + .25*texture(iChannel2, uv*.5+.5).r;
    
    return pow(clamp(d, 0., 1.), 2.2);
}

float roughnessGlass(vec2 uv) {
    uv = uv * .5 + .5;
    return smoothstep(0.2, 0.8, texture(iChannel2, uv * .3).r) * .4 + .2;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {   
    if(resolutionChanged() && iChannelResolution[1].x > 0.  && iChannelResolution[2].x > 0.) {
        if (fragCoord.x < 1.5 && fragCoord.y < 1.5) {
            fragColor = floor(iResolution.xyxy);
        } else {
            vec2 uv = (2.0*fragCoord.xy-iResolution.xy)/iResolution.xy;

            fragColor = vec4( dial(uv), roughnessGlass(uv), 0., 1.0 );      
        }
    } else {
        fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
    }
    fragColor.a = 1.;
}
`;

const buffB = `
const float PI = 3.14159265359;

// see: http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
float PartialGeometryGGX(float NdotV, float a) {
    float k = a / 2.0;

    float nominator   = NdotV;
    float denominator = NdotV * (1.0 - k) + k;

    return nominator / denominator;
}

float GeometryGGX_Smith(float NdotV, float NdotL, float roughness) {
    float a = roughness*roughness;
    float G1 = PartialGeometryGGX(NdotV, a);
    float G2 = PartialGeometryGGX(NdotL, a);
    return G1 * G2;
}

float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 Hammersley(int i, int N) {
    return vec2(float(i)/float(N), RadicalInverse_VdC(uint(i)));
} 

vec3 ImportanceSampleGGX(vec2 Xi, float roughness) {
    float a = roughness*roughness;
    float phi      = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    vec3 HTangent;
    HTangent.x = sinTheta*cos(phi);
    HTangent.y = sinTheta*sin(phi);
    HTangent.z = cosTheta;

    return HTangent;
}

vec2 IntegrateBRDF(float roughness, float NdotV) {
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    float A = 0.0;
    float B = 0.0;

    const int SAMPLE_COUNT = 128;

    vec3 N = vec3(0.0, 0.0, 1.0);
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = cross(N, TangentX);

    for(int i = 0; i < SAMPLE_COUNT; ++i)  {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 HTangent = ImportanceSampleGGX(Xi, roughness);
        
        vec3 H = normalize(HTangent.x * TangentX + HTangent.y * TangentY + HTangent.z * N);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0) {
            float G = GeometryGGX_Smith(NdotV, NdotL, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}

bool resolutionChanged() {
    return floor(texelFetch(iChannel0, ivec2(0), 0).r) != floor(iResolution.x);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    if(resolutionChanged()) {
        if (fragCoord.x < 1.5 && fragCoord.y < 1.5) {
            fragColor = floor(iResolution.xyxy);
        } else {
	   		vec2 uv = fragCoord / iResolution.xy;
    		vec2 integratedBRDF = IntegrateBRDF(uv.y, uv.x);
   	 		fragColor = vec4(integratedBRDF, 0.0,1.0);
        }
    } else {
        fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
    }
}
`;

const fragment = `
#define MAX_LOD 8.
#define DIFFUSE_LOD 6.75
#define AA 2
// #define P_MALIN_AO 

vec3 getSpecularLightColor( vec3 N, float roughness ) {
    // This is not correct. You need to do a look up in a correctly pre-computed HDR environment map.
    return pow(textureLod(iChannel0, N.xy, roughness * MAX_LOD).rgb, vec3(4.5)) * 6.5;
}

vec3 getDiffuseLightColor( vec3 N ) {
    // This is not correct. You need to do a look up in a correctly pre-computed HDR environment map.
    return .25 +pow(textureLod(iChannel0, N.xy, DIFFUSE_LOD).rgb, vec3(3.)) * 1.;
}

//
// Modified FrenelSchlick: https://seblagarde.wordpress.com/2011/08/17/hello-world/
//
vec3 FresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

//
// Image based lighting
//

vec3 lighting(in vec3 ro, in vec3 pos, in vec3 N, in vec3 albedo, in float ao, in float roughness, in float metallic ) {
    vec3 V = normalize(ro - pos); 
    vec3 R = reflect(-V, N);
    float NdotV = max(0.0, dot(N, V));

    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, albedo, metallic);

    vec3 F = FresnelSchlickRoughness(NdotV, F0, roughness);

    vec3 kS = F;

    vec3 prefilteredColor = getSpecularLightColor(R, roughness);
    vec2 envBRDF = texture(iChannel3, vec2(NdotV, roughness)).rg;
    vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);

    vec3 kD = vec3(1.0) - kS;

    kD *= 1.0 - metallic;

    vec3 irradiance = getDiffuseLightColor(N);

    vec3 diffuse  = albedo * irradiance;

#ifdef P_MALIN_AO
    vec3 color = kD * diffuse * ao + specular * calcAO(pos, R);
#else
    vec3 color = (kD * diffuse + specular) * ao;
#endif

    return color;
}

//
// main 
//

vec3 render( const in vec3 ro, const in vec3 rd ) {
    vec3 col = vec3(0); 
    vec2 res = castRay( ro, rd );

    if (res.x > 0.) {
        vec3 pos = ro + rd * res.x;
        vec3 N, albedo;
        float roughness, metallic, ao;

        getMaterialProperties(pos, res.y, N, albedo, ao, roughness, metallic, iChannel1, iChannel2, iChannel3);

        col = lighting(ro, pos, N, albedo, ao, roughness, metallic);
        col *= max(0.0, min(1.1, 10./dot(pos,pos)) - .15);
    }

    // Glass. 
    float glass = castRayGlass( ro, rd );
    if (glass > 0. && (glass < res.x || res.x < 0.)) {
        vec3 N = calcNormalGlass(ro+rd*glass);
        vec3 pos = ro + rd * glass;

        vec3 V = normalize(ro - pos); 
        vec3 R = reflect(-V, N);
        float NdotV = max(0.0, dot(N, V));

        float roughness = texture(iChannel2, pos.xz*.5 + .5).g;

        vec3 F = FresnelSchlickRoughness(NdotV, vec3(.08), roughness);
        vec3 prefilteredColor = getSpecularLightColor(R, roughness);
        vec2 envBRDF = texture(iChannel3, vec2(NdotV, roughness)).rg;
        vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);

        col = col * (1.0 -  (F * envBRDF.x + envBRDF.y) ) + specular;
    } 

    // gamma correction
    col = max( vec3(0), col - 0.004);
    col = (col*(6.2*col + .5)) / (col*(6.2*col+1.7) + 0.06);
    
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord/iResolution.xy;
    vec2 mo = iMouse.xy/iResolution.xy - .5;
    if(iMouse.z <= 0.) {
        mo = vec2(.2*sin(-iTime*.1+.3)+.045,.1-.2*sin(-iTime*.1+.3));
    }
    float a = 5.05;
    vec3 ro = vec3( .25 + 2.*cos(6.0*mo.x+a), 2. + 2. * mo.y, 2.0*sin(6.0*mo.x+a) );
    vec3 ta = vec3( .25, .5, .0 );
    mat3 ca = setCamera( ro, ta );

    vec3 colT = vec3(0);
    
    for (int x=0; x<AA; x++) {
        for(int y=0; y<AA; y++) {
		    vec2 p = (-iResolution.xy + 2.0*(fragCoord + vec2(x,y)/float(AA) - .5))/iResolution.y;
   			vec3 rd = ca * normalize( vec3(p.xy,1.6) );  
            colT += render( ro, rd);           
        }
    }
    
    colT /= float(AA*AA);
    
    fragColor = vec4(colT, 1.0);
}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 ro, in vec3 rd ) {
	MAX_T = 1000.;
    fragColor = vec4(render(ro * 25. + vec3(0.5,4.,1.5), rd), 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'lscBW4';
  }
  name(): string {
    return 'Old watch (IBL)';
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
  common() {
    return common;
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
      webglUtils.FONT_TEXTURE,
      webglUtils.TEXTURE5, //
      { type: 1, f: buffB, fi: 3 },
    ];
  }
}
