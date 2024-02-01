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

float TIME = 11344.;
#define MAX_T 10.

uint baseHash(uvec2 p) {
    p = 1103515245U*((p >> 1U)^(p.yx));
    uint h32 = 1103515245U*((p.x)^(p.y>>3U));
    return h32^(h32 >> 16);
}

float hash1(inout float seed) {
    uint n = baseHash(floatBitsToUint(vec2(seed+=.1,seed+=.1)));
    return float(n)/float(0xffffffffU);
}

vec2 hash2(inout float seed) {
    uint n = baseHash(floatBitsToUint(vec2(seed+=.1,seed+=.1)));
    uvec2 rz = uvec2(n, n*48271U);
    return vec2(rz.xy & uvec2(0x7fffffffU))/float(0x7fffffff);
}

vec3 hash3(inout float seed) {
    uint n = baseHash(floatBitsToUint(vec2(seed+=.1,seed+=.1)));
    uvec3 rz = uvec3(n, n*16807U, n*48271U);
    return vec3(rz & uvec3(0x7fffffffU))/float(0x7fffffff);
}

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
            	float pth21 = floor(pos.z*5.);
	            float pth1 = hash1(pth21);
    	        vec3 pt1 = vec3(pos.x + .3*sin(pos.z)- pth1 *.02 + 0.02, pos.y-h - pth1 *.03, mod(pos.z, .2) - .1);
        	    pt1 = rotateZ(pt1, .6 * smoothstep(2.,3., pos.z));
            	dChain0 = sdTorus(pt1, vec2(.071, .02)); 
            }
            
            float pth2z = floor(pos.z*5. + .5);
            float pth2 = hash1(pth2z); 
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
    
	float secs = mod( floor(TIME),        60.0 );
	float mins = mod( floor(TIME/60.0),   60.0 );
	float hors = mod( floor(TIME/3600.0), 24.0 ) + mins/60.;
    
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
    float tmin = 0.001;
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
    
	float secs = mod( floor(TIME),        60.0 );
	float mins = mod( floor(TIME/60.0),   60.0 );
	float hors = mod( floor(TIME/3600.0), 24.0 ) + mins/60.;
    
    vec3 ps = rotateY( p1+vec3(0,0,.6), 6.2831*secs/60.0 );
    vec3 rds = rotateY( rd1, 6.2831*secs/60.0 );
    
    vec3 pm = rotateY( p1, 6.2831*mins/60.0 );
    vec3 rdm = rotateY( rd1, 6.2831*mins/60.0 );
    
    vec3 ph = rotateY( p1, 6.2831*hors/12.0 );
    vec3 rdh = rotateY( rd1, 6.2831*hors/12.0 );
    
    bool watchIntersect = boxIntserct(p1, rd1, vec3(1.1,.2,1.4));
    bool pencilIntersect = boxIntserct(ro + PENCIL_POS, rd, vec3(3.,.23,.23));
    
    for( int i=0; i<64; i++ ) {
	    float precis = 0.00001;
	    vec2 res = map( ro+rd*t, p1+rd1*t, ps+rds*t, pm+rdm*t, ph+rdh*t, 
                       watchIntersect, pencilIntersect );
        if( abs(res.x)<precis || t>tmax ) break; //return vec2(t, mat);
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
        for( int i=0; i<32; i++ ) {
            float precis = 0.0001;
            float res = mapGlass( p1+rd1*t );
            if( abs(res)<precis || t>tmax ) break; 
            t += res;
        }

        if( t>tmax ) t=-1.0;
    }
    return t;
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
    inout vec3 normal, inout vec3 albedo, inout float roughness, inout float metallic,
	sampler2D tex1, sampler2D tex2, sampler2D tex3) {
    
    vec3 pinv = rotateX( pos + vec3(0,-CLOCK_OFFSET_Y,0), CLOCK_ROT_X );
    pinv = rotateY( pinv, CLOCK_ROT_Y );
    
    normal = calcNormal( pos );
    metallic = 0.;
    
    vec4 noise = texNoise(tex1, pinv * .5, normal);
    float metalnoise = 1.- noise.r;
    metalnoise*=metalnoise;

    mat -= .5;
    if (mat < MAT_TABLE) {
        albedo = .7 * pow(texture(tex1, rotate(pos.xz * .4 + .25, -.3)).rgb, 2.2*vec3(0.45,0.5,0.5));
        roughness = 0.9 - albedo.r * .6;
        normal = vec3(0,1,0);
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
        	roughness = .85 - noise.b * .4;
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
	    albedo = mix(.5*vec3(0.5, 0.3, 0.2),vec3(0.560, 0.570, 0.580), (.5 + .5 * r) * (.5 + .5 * r)); // Iron
   		roughness = .8-.5*r;
   		metallic = 1.; 
    }
    else if( mat < MAT_DIAL ) {
        float dial = texture(tex2, vec2(-.5 * pinv.x + .5, +.5 * pinv.z + .5)).r;
        albedo = vec3(dial);
        roughness = dial + .95;
    }
    else if( mat < MAT_HAND ) {
        albedo = vec3(0.02);
        roughness = .8;
    }
    else if( mat < MAT_METAL_0 ) {
	    albedo = vec3(1.000, 0.766, 0.336); // Gold
   		roughness = .5;
   		metallic = 1.; 
    } 
    else if( mat < MAT_METAL_1 ) {
	    albedo = vec3(0.972, 0.960, 0.915); // Silver
   		roughness = .5 + max(.15 * length(pos.xz)-.3, 0.); // prevent aliasing
   		metallic = 1.; 
    }
    
    if (metallic > .5) {   
        roughness += metalnoise*4.;
        albedo *= max(.2, 1.-roughness * .6);
    }
    
    roughness = clamp(roughness, 0.01, 1.);
    albedo = clamp(albedo, vec3(0.01), vec3(1.));
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
            fragColor = vec4(floor(iResolution.xyx), mod(iDate.w, 12.*60.*60.));
        } else {
            vec2 uv = (2.0*fragCoord.xy-iResolution.xy)/iResolution.xy;

            fragColor = vec4( dial(uv), roughnessGlass(uv), 0., 1.0 );      
        }
    } else {
        fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
    }
}
`;

const buffB = `
#define PATH_LENGTH 5

vec3 getBGColor( vec3 N ) {
    if (N.y <= 0.) {
        return vec3(0.); 
    } else {
	    return (.25 + pow(textureLod(iChannel0, N.xy, 0.).rgb, vec3(6.5)) * 8.5) * (N.y) * .3;
    }
}

float FresnelSchlickRoughness(float cosTheta, float F0, float roughness) {
    return F0 + (max((1. - roughness), F0) - F0) * pow(abs(1. - cosTheta), 5.0);
}

vec3 cosWeightedRandomHemisphereDirection( const vec3 n, inout float seed ) {
  	vec2 r = hash2(seed);
    
	vec3  uu = normalize(cross(n, abs(n.y) > .5 ? vec3(1.,0.,0.) : vec3(0.,1.,0.)));
	vec3  vv = cross(uu, n);
	
	float ra = sqrt(r.y);
	float rx = ra*cos(6.2831*r.x); 
	float ry = ra*sin(6.2831*r.x);
	float rz = sqrt( abs(1.0-r.y) );
	vec3  rr = vec3( rx*uu + ry*vv + rz*n );
    
    return normalize(rr);
}

vec3 modifyDirectionWithRoughness( const vec3 n, const float roughness, inout float seed ) {
  	vec2 r = hash2(seed);
    
	vec3  uu = normalize(cross(n, abs(n.y) > .5 ? vec3(1.,0.,0.) : vec3(0.,1.,0.)));
	vec3  vv = cross(uu, n);
	
    float a = roughness*roughness;
    a *= a; a *= a; // I want to have a really shiny watch.
	float rz = sqrt(abs((1.0-r.y) / clamp(1.+(a - 1.)*r.y,.00001,1.)));
	float ra = sqrt(abs(1.-rz*rz));
	float rx = ra*cos(6.2831*r.x); 
	float ry = ra*sin(6.2831*r.x);
	vec3  rr = vec3( rx*uu + ry*vv + rz*n );
    
    return normalize(rr);
}

vec2 randomInUnitDisk(inout float seed) {
    vec2 h = hash2(seed) * vec2(1.,6.28318530718);
    float phi = h.y;
    float r = sqrt(h.x);
	return r*vec2(sin(phi),cos(phi));
}

//
// main 
//

vec3 render( in vec3 ro, in vec3 rd, inout float seed ) {
    vec3 col = vec3(1.); 
    vec3 firstPos = vec3(100.);
    bool firstHit = false;
    
    for (int i=0; i<PATH_LENGTH; ++i) {    
    	vec2 res = castRay( ro, rd );
		float gd = castRayGlass( ro, rd );
        
		vec3 gpos = ro + rd * gd;
		vec3 gN = calcNormalGlass(gpos);
        
        if (gd > 0. && (res.x < 0. || gd < res.x) && dot(gN, rd) < 0.) {
            // Glass material. 
            // Not correct: I only handle rays that enter the glass and the glass
            // is modelled as one solid piece, instead as a thin layer. By using a
            // non-physically plausible refraction index of 1.25, it still looks
            // good (I think).
            float F = FresnelSchlickRoughness(max(0., dot(-gN, rd)), (0.08), 0.);
            if (F < hash1(seed)) {
                rd = refract(rd, gN, 1./1.25);
            } else {
                rd = reflect(rd, gN);
            }
            ro = gpos;
        }
        else if (res.x > 0.) {
			vec3 pos = ro + rd * res.x;
			vec3 N, albedo;
            float roughness, metallic;

			getMaterialProperties(pos, res.y, N, albedo, roughness, metallic, iChannel1, iChannel2, iChannel3);

            float F = FresnelSchlickRoughness(max(0., -dot(N, rd)), 0.04, roughness);
            
            ro = pos;
            if (F > hash1(seed) - metallic) { // Reflections and metals.
                if (metallic > .5) {
                    col *= albedo; 
                }
				rd = modifyDirectionWithRoughness(reflect(rd,N), roughness, seed);            
                if (dot(rd, N) <= 0.) {
                    rd = cosWeightedRandomHemisphereDirection(N, seed);
                }
            } else { // Diffuse
				col *= albedo;
				rd = cosWeightedRandomHemisphereDirection(N, seed);
            }
        } else {
            col *= getBGColor(rd);
			col *= max(0.0, min(1.1, 10./dot(firstPos,firstPos)) - .15);
			return col;
        }            
        if (!firstHit) {
            firstHit = true;
            firstPos = ro;
        }
    }  
    return vec3(0.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    bool reset = iFrame == 0;
    ivec2 f = ivec2(fragCoord);
    vec4 data1 = texelFetch(iChannel3, ivec2(0), 0);
    vec4 data2 = texelFetch(iChannel2, ivec2(0), 0);
    
    vec2 uv = fragCoord/iResolution.xy;
    vec2 mo = abs(iMouse.xy)/iResolution.xy - .5;
    if (iMouse.xy == vec2(0)) mo = vec2(.05,.1);
    
    if (floor(mo*iResolution.xy*10.) != data1.yz) {
        reset = true;
    }
    if (data2.xy != iResolution.xy) {
        reset = true;
    }
    
    TIME = data2.w;
    
    float a = 5.05;
    vec3 ro = vec3( .25+ 2.*cos(6.0*mo.x+a), 2. + 2. * mo.y, 2.0*sin(6.0*mo.x+a) );
    vec3 ta = vec3( .25, .5, 0.0 );
    mat3 ca = setCamera( ro, ta );

    float fpd = data1.x;
    if(all(equal(f, ivec2(0)))) {
        // Calculate focus plane and store distance.
        float nfpd = castRay(ro, normalize(vec3(0.,.2,0.)-ro)).x;
		fragColor = vec4(nfpd, floor(mo*iResolution.xy*10.), iResolution.x);
        return;
    }
    
    vec2 p = (-iResolution.xy + 2.0*fragCoord - 1.)/iResolution.y;
    float seed = float(baseHash(floatBitsToUint(p)))/float(0xffffffffU) + iTime;

    // AA
	p += 2.*hash2(seed)/iResolution.y;
    vec3 rd = ca * normalize( vec3(p.xy,1.6) );  
    
    // DOF
    vec3 fp = ro + rd * fpd;
    ro = ro + ca * vec3(randomInUnitDisk(seed), 0.)*.02;
    rd = normalize(fp - ro);
    
    vec3 col = render(ro, rd, seed);           
  
    if (reset) {
       fragColor = vec4(col, 1.0);
    } else {
       fragColor = vec4(col, 1.0) + texelFetch(iChannel3, ivec2(fragCoord), 0);
    }
}
`;

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec4 data = texelFetch(iChannel3, ivec2(fragCoord), 0);
    vec3 col = data.rgb / data.w;
    
    // gamma correction
    col = max( vec3(0), col - 0.004);
    col = (col*(6.2*col + .5)) / (col*(6.2*col+1.7) + 0.06);
    
    // Output to screen
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MlyyzW';
  }
  name(): string {
    return 'Old watch (RT)';
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
      { type: 1, f: buffA, fi: 0 }, //
      webglUtils.FONT_TEXTURE,
      webglUtils.TEXTURE2,
      { type: 1, f: buffB, fi: 3 },
    ];
  }
}
