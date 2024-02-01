import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define SCENE_SCALE (10.)
#define INV_SCENE_SCALE (.1)

#define MOUNTAIN_HEIGHT (5000.)
#define MOUNTAIN_HW_RATIO (0.00016)

#define SUN_DIR normalize(vec3(-.7,.5,.75))
#define SUN_COLOR (vec3(1.,.9,.85)*1.4)

#define FLAG_POSITION (vec3(3900.5,720.,-2516.)*INV_SCENE_SCALE)
#define HUMANOID_SCALE (2.)

#define CAMERA_RO (vec3(3980.,730.,-2650.)*INV_SCENE_SCALE)
#define CAMERA_FL 2.

#define HEIGHT_BASED_FOG_B 0.02
#define HEIGHT_BASED_FOG_C 0.05


mat3 getCamera( in float time, in vec4 mouse, inout vec3 ro, inout vec3 ta ) {
    ro = CAMERA_RO;
    vec3 cw;
    if (mouse.z > 0.) {
        vec2 m = (mouse.xy - .5) * 2.3;
        float my = -sin(m.y);
        cw = normalize(vec3(-sin(-m.x), my+.15, cos(-m.x)));
    } else {
    	ro.x += -cos(time*.13)*5.*INV_SCENE_SCALE;
    	ro.z += (-cos(time*.1)*100.+20.)*INV_SCENE_SCALE;
    	cw = normalize(vec3(-.1,.18,1.));
    }   
    ta = ro + cw*(200.*INV_SCENE_SCALE);
	vec3 cp = vec3(0.0,1.0, 0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void getRay( in float time, in vec2 fragCoord, in vec2 resolution, in vec4 mouse, inout vec3 ro, inout vec3 rd) {
	vec3 ta;
	mat3 cam = getCamera( time, mouse, ro, ta );
    vec2 p = (-resolution.xy + 2.0*(fragCoord))/resolution.y;
    rd = cam * normalize(vec3(p,CAMERA_FL));     
}

vec4 saveCamera( in float time, in vec2 fragCoord, in vec4 mouse ) {   
    vec3 ro, ta;
    mat3 cam = getCamera( time, mouse, ro, ta );
    vec4 fragColor;
    
    if( abs(fragCoord.x-4.5)<0.5 ) fragColor = vec4( cam[2], -dot(cam[2],ro) );
    if( abs(fragCoord.x-3.5)<0.5 ) fragColor = vec4( cam[1], -dot(cam[1],ro) );
    if( abs(fragCoord.x-2.5)<0.5 ) fragColor = vec4( cam[0], -dot(cam[0],ro) );
    
    return fragColor;
}

vec2 reprojectPos( in vec3 pos, in vec2 resolution, in sampler2D storage ) {
    mat4 oldCam = mat4( texelFetch(storage,ivec2(2,0),0),
                        texelFetch(storage,ivec2(3,0),0),
                        texelFetch(storage,ivec2(4,0),0),
                        0.0, 0.0, 0.0, 1.0 );

    vec4 wpos = vec4(pos,1.0);
    vec3 cpos = (wpos*oldCam).xyz; 
    vec2 npos = CAMERA_FL * cpos.xy / cpos.z;
    return 0.5 + 0.5*npos*vec2(resolution.y/resolution.x,1.0);
}

vec3 getSkyColor(vec3 rd) {
    float sundot = clamp(dot(rd,SUN_DIR),0.0,1.0);
	vec3 col = vec3(0.2,0.5,0.85)*1.1 - max(rd.y,0.01)*max(rd.y,0.01)*0.5;
    col = mix( col, 0.85*vec3(0.7,0.75,0.85), pow(1.0-max(rd.y,0.0), 6.0) );

    col += 0.25*vec3(1.0,0.7,0.4)*pow( sundot,5.0 );
    col += 0.25*vec3(1.0,0.8,0.6)*pow( sundot,64.0 );
    col += 0.20*vec3(1.0,0.8,0.6)*pow( sundot,512.0 );
    
    col += clamp((0.1-rd.y)*10., 0., 1.) * vec3(.0,.1,.2);
    col += 0.2*vec3(1.0,0.8,0.6)*pow( sundot, 8.0 );
    return col;
}

bool letterBox(vec2 fragCoord, const vec2 resolution, const float aspect) { 
    if( fragCoord.x < 0. || fragCoord.x > resolution.x ||
        abs(2.*fragCoord.y-resolution.y) > resolution.x * (1./aspect) ) {
        return true;
    } else {
        return false;
    }
}

float hash12( vec2 p ) {
    p  = 50.0*fract( p*0.3183099 );
    return fract( p.x*p.y*(p.x+p.y) );
}

float hash13(vec3 p3) {
    p3  = fract(p3 * 1031.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

float valueHash(vec3 p3) {
    p3  = fract(p3 * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

//
// Noise functions used for cloud shapes
//
float valueNoise( in vec3 x, float tile ) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
	
    return mix(mix(mix( valueHash(mod(p+vec3(0,0,0),tile)), 
                        valueHash(mod(p+vec3(1,0,0),tile)),f.x),
                   mix( valueHash(mod(p+vec3(0,1,0),tile)), 
                        valueHash(mod(p+vec3(1,1,0),tile)),f.x),f.y),
               mix(mix( valueHash(mod(p+vec3(0,0,1),tile)), 
                        valueHash(mod(p+vec3(1,0,1),tile)),f.x),
                   mix( valueHash(mod(p+vec3(0,1,1),tile)), 
                        valueHash(mod(p+vec3(1,1,1),tile)),f.x),f.y),f.z);
}

float voronoi( vec3 x, float tile ) {
    vec3 p = floor(x);
    vec3 f = fract(x);

    float res = 100.;
    for(int k=-1; k<=1; k++){
        for(int j=-1; j<=1; j++) {
            for(int i=-1; i<=1; i++) {
                vec3 b = vec3(i, j, k);
                vec3 c = p + b;

                if( tile > 0. ) {
                    c = mod( c, vec3(tile) );
                }

                vec3 r = vec3(b) - f + hash13( c );
                float d = dot(r, r);

                if(d < res) {
                    res = d;
                }
            }
        }
    }

    return 1.-res;
}

float tilableVoronoi( vec3 p, const int octaves, float tile ) {
    float f = 1.;
    float a = 1.;
    float c = 0.;
    float w = 0.;

    if( tile > 0. ) f = tile;

    for( int i=0; i<octaves; i++ ) {
        c += a*voronoi( p * f, f );
        f *= 2.0;
        w += a;
        a *= 0.5;
    }

    return c / w;
}

float tilableFbm( vec3 p, const int octaves, float tile ) {
    float f = 1.;
    float a = 1.;
    float c = 0.;
    float w = 0.;

    if( tile > 0. ) f = tile;

    for( int i=0; i<octaves; i++ ) {
        c += a*valueNoise( p * f, f );
        f *= 2.0;
        w += a;
        a *= 0.5;
    }

    return c / w;
}


`;

const buffA = `
// Buffer A: The main look-up texture for the cloud shapes. 
// Buffer B: A 3D (32x32x32) look-up texture with Worley Noise used to add small details 
//           to the shapes of the clouds. I have packed this 3D texture into a 2D buffer.
bool resolutionChanged() {
    return floor(texelFetch(iChannel1, ivec2(0), 0).r) != floor(iResolution.x);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) { 
    if (resolutionChanged()) {
        vec2 vUV = fragCoord / iResolution.xy;
        vec3 coord = fract(vec3(vUV + vec2(.2,0.62), .5));
        
        vec4 col = vec4(1);
        
        float mfbm = 0.9;
        float mvor = 0.7;
        
        col.r = mix(1., tilableFbm( coord, 7, 4. ), mfbm) * 
            	mix(1., tilableVoronoi( coord, 8, 9. ), mvor);
        col.g = 0.625 * tilableVoronoi( coord + 0., 3, 15. ) +
        		0.250 * tilableVoronoi(  coord + 0., 3, 19. ) +
        		0.125 * tilableVoronoi( coord + 0., 3, 23. ) 
            	-1.;
        col.b = 1. - tilableVoronoi( coord + 0.5, 6, 9. );
        
	    fragColor = col;
    } else {
        fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
    }
}
`;

const buffB = `
// Buffer A: The main look-up texture for the cloud shapes. 
// Buffer B: A 3D (32x32x32) look-up texture with Worley Noise used to add small details 
//           to the shapes of the clouds. I have packed this 3D texture into a 2D buffer.
bool resolutionChanged() {
    return floor(texelFetch(iChannel1, ivec2(0), 0).r) != floor(iResolution.x);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) { 
    if (resolutionChanged()) {
        // pack 32x32x32 3d texture in 2d texture (with padding)
        float z = floor(fragCoord.x/34.) + 8.*floor(fragCoord.y/34.);
        vec2 uv = mod(fragCoord.xy, 34.) - 1.;
        vec3 coord = vec3(uv, z) / 32.;

        float r = tilableVoronoi( coord, 16,  3. );
        float g = tilableVoronoi( coord,  4,  8. );
        float b = tilableVoronoi( coord,  4, 16. );

        float c = max(0., 1.-(r + g * .5 + b * .25) / 1.75);

        fragColor = vec4(c,c,c,c);
    } else {
        fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
    }
}
`;

const buffC = `
vec3 noised( in vec2 x ) {
    vec2 f = fract(x);
    vec2 u = f*f*(3.0-2.0*f);
    
    vec2 p = vec2(floor(x));
    float a = hash12( (p+vec2(0,0)) );
	float b = hash12( (p+vec2(1,0)) );
	float c = hash12( (p+vec2(0,1)) );
	float d = hash12( (p+vec2(1,1)) );
    
	return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y,
				6.0*f*(1.0-f)*(vec2(b-a,c-a)+(a-b-c+d)*u.yx));
}

const mat2 m2 = mat2(1.6,-1.2,1.2,1.6);

float terrainMap( in vec2 x, const int OCTAVES ) {
	vec2 p = x*(MOUNTAIN_HW_RATIO*SCENE_SCALE);
    float s = mix(1., smoothstep(.0,.4, abs(p.y)), .75);
    
    float a = 0.;
    float b = 1.;
	vec2  d = vec2(0.0);
    for( int i=0; i<OCTAVES; i++ ) {
        vec3 n = noised(p);
        d += n.yz;
        a += b*n.x/(1.0+dot(d,d));
		b *= 0.5;
        p = m2*p;
    }
	return s*a*(MOUNTAIN_HEIGHT*INV_SCENE_SCALE*.5);
}

float terrainMapB( in vec2 x, const int OCTAVES ) {
	vec2 p = x*(MOUNTAIN_HW_RATIO*SCENE_SCALE);
    float s = mix(1., smoothstep(.0,.4, abs(p.y)), .75);
    
    float a = 0.;
    float b = 1.;
	vec2  d = vec2(0.0);
    for( int i=0; i<OCTAVES; i++ ) {
        vec3 n = noised(p);
        d += n.yz;
        a += b*n.x/(1.0+dot(d,d));
		b *= 0.5;
        p = m2*p;
    }
	return s*a*(MOUNTAIN_HEIGHT*INV_SCENE_SCALE*.5);
}
vec3 calcNormal(in vec3 pos, float t, const int OCTAVES) {
    vec2  eps = vec2( (0.0015)*t, 0.0 );
    return normalize( vec3( terrainMap(pos.xz-eps.xy, OCTAVES) - terrainMap(pos.xz+eps.xy, OCTAVES),
                            2.0*eps.x,
                            terrainMap(pos.xz-eps.yx, OCTAVES) - terrainMap(pos.xz+eps.yx, OCTAVES) ) );
}

vec4 render( in vec3 ro, in vec3 rd ) {
	vec3 col, bgcol;
    
    float tmax = 10000.;
    // bouding top plane
    float topd = ((MOUNTAIN_HEIGHT*INV_SCENE_SCALE)-ro.y)/rd.y;
    if( rd.y > 0.0 && topd > 0.0 ) {
        tmax = min(tmax, topd);
    }
    
    // intersect with heightmap
    float t = 1.;
	for( int i=0; i<128; i++ ) {
        vec3 pos = ro + t*rd;
		float h = pos.y - terrainMap( pos.xz, 7 );
        if(abs(h)<(0.003*t) || t>tmax ) break; // use abs(h) to bounce back if under terrain
	    t += .9 * h;
	}
   	
    bgcol = col = getSkyColor(rd);
	if( t<tmax) {
		vec3 pos = ro + t*rd;
        vec3 nor = calcNormal( pos, t, 15);
           
        // terrain color - just back and white
        float s = smoothstep(0.5,0.9,dot(nor, vec3(.3,1.,0.05)));
        col = mix( vec3(.01), vec3(0.5,0.52,0.6), smoothstep(.1,.7,s ));
		
        // lighting	
        // shadow is calculated based on the slope of a low frequency version of the heightmap
        float shadow = .5 + clamp( -8.+ 16.*dot(SUN_DIR, calcNormal(pos, t, 5)), 0.0, .5 );
        shadow *= smoothstep(20.,80.,pos.y);
        
        float ao = terrainMap(pos.xz, 10)-terrainMap(pos.xz,7);
        ao = clamp(.25 + ao / (MOUNTAIN_HEIGHT*INV_SCENE_SCALE) * 200., 0., 1.);

        float ambient  = max(0.5+0.5*nor.y,0.0);
		float diffuse  = max(dot(SUN_DIR, nor), 0.0);
		float backlight = max(0.5 + 0.5*dot( normalize( vec3(-SUN_DIR.x, 0., SUN_DIR.z)), nor), 0.0);
	 	
        //
        // use a 3-light setup as described by Íñigo Quílez
        // http://iquilezles.org/www/articles/outdoorslighting/outdoorslighting.htm
        //
		vec3 lin = (diffuse*shadow*3.) * SUN_COLOR;
		lin += (ao*ambient)*vec3(0.40,0.60,1.00);
        lin += (backlight)*vec3(0.40,0.50,0.60);
		col *= lin;
        col *= (.6+.4*smoothstep(400.,100.,abs(pos.z))); // dark in the distance
    
        // height based fog, see http://iquilezles.org/www/articles/fog/fog.htm
        float fogAmount = HEIGHT_BASED_FOG_C * (1.-exp( -t*rd.y*HEIGHT_BASED_FOG_B))/rd.y;
        col = mix( col, bgcol, fogAmount);
    } else {
        t = 10000.;
    }

	return vec4( col, t );
}


bool resolutionChanged() {
    return floor(texelFetch(iChannel1, ivec2(0), 0).r) != floor(iResolution.x);
}

bool mouseChanged() {
    return iMouse.z * texelFetch(iChannel1, ivec2(1,0), 1).w < 0.;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    if( letterBox(fragCoord, iResolution.xy, 2.25) ) {
        fragColor = vec4( 0., 0., 0., 1. );
        return;
    } else {
        vec3 ro, rd;
        vec3 o = hash33( vec3(fragCoord,iFrame) ) - 0.5; // dither
        getRay( iTime, (fragCoord+o.xy), iResolution.xy, iMouse/iResolution.xyxy, ro, rd);

        vec4 res = render( ro + rd*o.z, rd );

        vec2 spos = reprojectPos(ro+rd*res.w, iResolution.xy, iChannel1);
        spos -= o.xy/iResolution.xy; // undo dither
        
        vec2 rpos = spos * iResolution.xy;
        
        if( !letterBox(rpos.xy, iResolution.xy, 2.3) 
            && !resolutionChanged() && !mouseChanged()) {
            vec4 ocol = texture( iChannel0, spos, 0.0 );
            res.rgb = mix(max(ocol.rgb,vec3(0)), res.rgb, .125);
        }

        fragColor = res;
    }
}
`;

const buffD = `
// Buffer A: The main look-up texture for the cloud shapes. 
// Buffer B: A 3D (32x32x32) look-up texture with Worley Noise used to add small details 
//           to the shapes of the clouds. I have packed this 3D texture into a 2D buffer.
// Buffer D: Rendering of the clouds.
#define CLOUD_MARCH_STEPS 12
#define CLOUD_SELF_SHADOW_STEPS 6

#define EARTH_RADIUS    (1500000.) // (6371000.)
#define CLOUDS_BOTTOM   (1350.)
#define CLOUDS_TOP      (2350.)

#define CLOUDS_LAYER_BOTTOM   (-150.)
#define CLOUDS_LAYER_TOP      (-70.)

#define CLOUDS_COVERAGE (.52)
#define CLOUDS_LAYER_COVERAGE (.41)

#define CLOUDS_DETAIL_STRENGTH (.225)
#define CLOUDS_BASE_EDGE_SOFTNESS (.1)
#define CLOUDS_BOTTOM_SOFTNESS (.25)
#define CLOUDS_DENSITY (.03)
#define CLOUDS_SHADOW_MARGE_STEP_SIZE (10.)
#define CLOUDS_LAYER_SHADOW_MARGE_STEP_SIZE (4.)
#define CLOUDS_SHADOW_MARGE_STEP_MULTIPLY (1.3)
#define CLOUDS_FORWARD_SCATTERING_G (.8)
#define CLOUDS_BACKWARD_SCATTERING_G (-.2)
#define CLOUDS_SCATTERING_LERP (.5)

#define CLOUDS_AMBIENT_COLOR_TOP (vec3(149., 167., 200.)*(1.5/255.))
#define CLOUDS_AMBIENT_COLOR_BOTTOM (vec3(39., 67., 87.)*(1.5/255.))
#define CLOUDS_MIN_TRANSMITTANCE .1

#define CLOUDS_BASE_SCALE 1.51
#define CLOUDS_DETAIL_SCALE 20.

//
// Cloud shape modelling and rendering 
//
float HenyeyGreenstein( float sundotrd, float g) {
	float gg = g * g;
	return (1. - gg) / pow( 1. + gg - 2. * g * sundotrd, 1.5);
}

float interectCloudSphere( vec3 rd, float r ) {
    float b = EARTH_RADIUS * rd.y;
    float d = b * b + r * r + 2. * EARTH_RADIUS * r;
    return -b + sqrt( d );
}

float linearstep( const float s, const float e, float v ) {
    return clamp( (v-s)*(1./(e-s)), 0., 1. );
}

float linearstep0( const float e, float v ) {
    return min( v*(1./e), 1. );
}

float remap(float v, float s, float e) {
	return (v - s) / (e - s);
}

float cloudMapBase(vec3 p, float norY) {
	vec3 uv = p * (0.00005 * CLOUDS_BASE_SCALE);
    vec3 cloud = texture(iChannel0, uv.xz).rgb;
   
    float n = norY*norY;
    n *= cloud.b ;
        n+= pow(1.-norY, 16.); 
	return remap( cloud.r - n, cloud.g, 1.);
}

float cloudMapDetail(vec3 p) { 
    // 3d lookup in 2d texture :(
    p = abs(p) * (0.0016 * CLOUDS_BASE_SCALE * CLOUDS_DETAIL_SCALE);
  
    float yi = mod(p.y,32.);
    ivec2 offset = ivec2(mod(yi,8.), mod(floor(yi/8.),4.))*34 + 1;
    float a = texture(iChannel3, (mod(p.xz,32.)+vec2(offset.xy)+1.)/iResolution.xy).r;
    
    yi = mod(p.y+1.,32.);
    offset = ivec2(mod(yi,8.), mod(floor(yi/8.),4.))*34 + 1;
    float b = texture(iChannel3, (mod(p.xz,32.)+vec2(offset.xy)+1.)/iResolution.xy).r;
    
    return mix(a,b,fract(p.y));
}

float cloudGradient( float norY ) {
    return linearstep( 0., .05, norY ) - linearstep( .8, 1.2, norY);
}

float cloudMap(vec3 pos, vec3 rd, float norY) {
    vec3 ps = pos;
    
    float m = cloudMapBase(ps, norY);
	m *= cloudGradient( norY );

	float dstrength = smoothstep(1., 0.5, m);
    
    // erode with detail
    if(dstrength > 0.) {
		m -= cloudMapDetail( ps ) * dstrength * CLOUDS_DETAIL_STRENGTH;
    }

	m = smoothstep( 0., CLOUDS_BASE_EDGE_SOFTNESS, m+(CLOUDS_COVERAGE-1.) );
    m *= linearstep0(CLOUDS_BOTTOM_SOFTNESS, norY);

    return clamp(m * CLOUDS_DENSITY * (1.+max((ps.x-7000.)*0.005,0.)), 0., 1.);
}

float volumetricShadow(in vec3 from, in float sundotrd ) {
    float dd = CLOUDS_SHADOW_MARGE_STEP_SIZE;
    vec3 rd = SUN_DIR;
    float d = dd * .5;
    float shadow = 1.0;

    for(int s=0; s<CLOUD_SELF_SHADOW_STEPS; s++) {
        vec3 pos = from + rd * d;
        float norY = (length(pos) - (EARTH_RADIUS + CLOUDS_BOTTOM)) * (1./(CLOUDS_TOP - CLOUDS_BOTTOM));

        if(norY > 1.) return shadow;

        float muE = cloudMap( pos, rd, norY );
        shadow *= exp(-muE * dd);

        dd *= CLOUDS_SHADOW_MARGE_STEP_MULTIPLY;
        d += dd;
    }
    return shadow;
}

vec4 renderClouds( vec3 ro, vec3 rd, inout float dist ) {
    if( rd.y < 0. ) {
        return vec4(0,0,0,10);
    }

    ro.xz *= SCENE_SCALE;
    ro.y = sqrt(EARTH_RADIUS*EARTH_RADIUS-dot(ro.xz,ro.xz));

    float start = interectCloudSphere( rd, CLOUDS_BOTTOM );
    float end  = interectCloudSphere( rd, CLOUDS_TOP );
    
    if (start > dist) {
        return vec4(0,0,0,10);
    }
    
    end = min(end, dist);
    
    float sundotrd = dot( rd, -SUN_DIR);

    // raymarch
    float d = start;
    float dD = (end-start) / float(CLOUD_MARCH_STEPS);

    float h = hash13(rd + fract(iTime) );
    d -= dD * h;

    float scattering =  mix( HenyeyGreenstein(sundotrd, CLOUDS_FORWARD_SCATTERING_G),
        HenyeyGreenstein(sundotrd, CLOUDS_BACKWARD_SCATTERING_G), CLOUDS_SCATTERING_LERP );

    float transmittance = 1.0;
    vec3 scatteredLight = vec3(0.0, 0.0, 0.0);

    dist = EARTH_RADIUS;

    for(int s=0; s<CLOUD_MARCH_STEPS; s++) {
        vec3 p = ro + d * rd;

        float norY = clamp( (length(p) - (EARTH_RADIUS + CLOUDS_BOTTOM)) * (1./(CLOUDS_TOP - CLOUDS_BOTTOM)), 0., 1.);

        float alpha = cloudMap( p, rd, norY );

        if( alpha > 0. ) {
            dist = min( dist, d);
            vec3 ambientLight = mix( CLOUDS_AMBIENT_COLOR_BOTTOM, CLOUDS_AMBIENT_COLOR_TOP, norY );

            vec3 S = (ambientLight + SUN_COLOR * (scattering * volumetricShadow(p, sundotrd))) * alpha;
            float dTrans = exp(-alpha * dD);
            vec3 Sint = (S - S * dTrans) * (1. / alpha);
            scatteredLight += transmittance * Sint; 
            transmittance *= dTrans;
        }

        if( transmittance <= CLOUDS_MIN_TRANSMITTANCE ) break;

        d += dD;
    }

    return vec4(scatteredLight, transmittance);
}

//
//
// !Because I wanted a second cloud layer (below the horizon), I copy-pasted 
// almost all of the code above:
//

float cloudMapLayer(vec3 pos, vec3 rd, float norY) {
    vec3 ps = pos;

    float m = cloudMapBase(ps, norY);
	// m *= cloudGradient( norY );
	float dstrength = smoothstep(1., 0.5, m);
    
    // erode with detail
    if (dstrength > 0.) {
		m -= cloudMapDetail( ps ) * dstrength * CLOUDS_DETAIL_STRENGTH;
    }

	m = smoothstep( 0., CLOUDS_BASE_EDGE_SOFTNESS, m+(CLOUDS_LAYER_COVERAGE-1.) );

    return clamp(m * CLOUDS_DENSITY, 0., 1.);
}

float volumetricShadowLayer(in vec3 from, in float sundotrd ) {
    float dd = CLOUDS_LAYER_SHADOW_MARGE_STEP_SIZE;
    vec3 rd = SUN_DIR;
    float d = dd * .5;
    float shadow = 1.0;

    for(int s=0; s<CLOUD_SELF_SHADOW_STEPS; s++) {
        vec3 pos = from + rd * d;
        float norY = clamp( (pos.y - CLOUDS_LAYER_BOTTOM ) * (1./(CLOUDS_LAYER_TOP - CLOUDS_LAYER_BOTTOM)), 0., 1.);

        if(norY > 1.) return shadow;

        float muE = cloudMapLayer( pos, rd, norY );
        shadow *= exp(-muE * dd);

        dd *= CLOUDS_SHADOW_MARGE_STEP_MULTIPLY;
        d += dd;
    }
    return shadow;
}

vec4 renderCloudLayer( vec3 ro, vec3 rd, inout float dist ) {
    if( rd.y > 0. ) {
        return vec4(0,0,0,10);
    }

    ro.xz *= SCENE_SCALE;
    ro.y = 0.;

    float start = CLOUDS_LAYER_TOP/rd.y;
    float end  = CLOUDS_LAYER_BOTTOM/rd.y;
    
    if (start > dist) {
        return vec4(0,0,0,10);
    }
    
    end = min(end, dist);
    
    float sundotrd = dot( rd, -SUN_DIR);

    // raymarch
    float d = start;
    float dD = (end-start) / float(CLOUD_MARCH_STEPS);

    float h = hash13(rd + fract(iTime) );
    d -= dD * h;

    float scattering =  mix( HenyeyGreenstein(sundotrd, CLOUDS_FORWARD_SCATTERING_G),
        HenyeyGreenstein(sundotrd, CLOUDS_BACKWARD_SCATTERING_G), CLOUDS_SCATTERING_LERP );

    float transmittance = 1.0;
    vec3 scatteredLight = vec3(0.0, 0.0, 0.0);

    dist = EARTH_RADIUS;

    for(int s=0; s<CLOUD_MARCH_STEPS; s++) {
        vec3 p = ro + d * rd;

        float norY = clamp( (p.y - CLOUDS_LAYER_BOTTOM ) * (1./(CLOUDS_LAYER_TOP - CLOUDS_LAYER_BOTTOM)), 0., 1.);

        float alpha = cloudMapLayer( p, rd, norY );

        if( alpha > 0. ) {
            dist = min( dist, d);
            vec3 ambientLight = mix( CLOUDS_AMBIENT_COLOR_BOTTOM, CLOUDS_AMBIENT_COLOR_TOP, norY );

            vec3 S = .7 * (ambientLight +  SUN_COLOR * (scattering * volumetricShadowLayer(p, sundotrd))) * alpha;
            float dTrans = exp(-alpha * dD);
            vec3 Sint = (S - S * dTrans) * (1. / alpha);
            scatteredLight += transmittance * Sint; 
            transmittance *= dTrans;
        }

        if( transmittance <= CLOUDS_MIN_TRANSMITTANCE ) break;

        d += dD;
    }

    return vec4(scatteredLight, transmittance);
}

//
// Main function
//
bool resolutionChanged() {
    return floor(texelFetch(iChannel1, ivec2(0), 0).r) != floor(iResolution.x);
}

bool mouseChanged() {
    return iMouse.z * texelFetch(iChannel1, ivec2(1,0), 1).w < 0.;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {            
    if (fragCoord.y < 1.5) {
        fragColor = saveCamera(iTime, fragCoord, iMouse/iResolution.xyxy);
        if( abs(fragCoord.x-1.5)<0.5 ) fragColor = vec4(iMouse);
        if( abs(fragCoord.x-0.5)<0.5 ) fragColor = mouseChanged() ? vec4(0) : vec4(iResolution.xy,0,0);
    } else {
        if( letterBox(fragCoord, iResolution.xy, 2.25) ) {
        	fragColor = vec4( 0., 0., 0., 1. );
       		return;
        } else {
            float dist = texelFetch(iChannel2, ivec2(fragCoord),0).w * SCENE_SCALE;
            vec4 col = vec4(0,0,0,1);
            
            vec3 ro, rd;
    		getRay( iTime, fragCoord, iResolution.xy, iMouse/iResolution.xyxy, ro, rd);

            if( rd.y > 0. ) {
                // clouds
                col = renderClouds(ro, rd, dist);
                float fogAmount = 1.-(.1 + exp(-dist*0.0001));
                col.rgb = mix(col.rgb, getSkyColor(rd)*(1.-col.a), fogAmount);
            } else {
                // cloud layer below horizon
                col = renderCloudLayer(ro, rd, dist);
                // height based fog, see http://iquilezles.org/www/articles/fog/fog.htm
                float fogAmount = HEIGHT_BASED_FOG_C * 
                    (1.-exp( -dist*rd.y*(INV_SCENE_SCALE*HEIGHT_BASED_FOG_B)))/rd.y;
                col.rgb = mix(col.rgb, getSkyColor(rd)*(1.-col.a), clamp(fogAmount,0.,1.));
            }

            if( col.w > 1. ) {
                fragColor = vec4(0,0,0,1);
            } else {
                vec2 spos = reprojectPos(ro+rd*dist, iResolution.xy, iChannel1);
                vec2 rpos = spos * iResolution.xy;

        		if( !letterBox(rpos.xy, iResolution.xy, 2.3) 
                    && !resolutionChanged() && !mouseChanged()) {
                    vec4 ocol = texture( iChannel1, spos, 0.0 ).xyzw;
                    col = mix(ocol, col, 0.05);
                }
                fragColor = col;
            }
        }
    }
}
`;

const fragment = `
// Buffer A: The main look-up texture for the cloud shapes. 
// Buffer B: A 3D (32x32x32) look-up texture with Worley Noise used to add small details 
//           to the shapes of the clouds. I have packed this 3D texture into a 2D buffer.
// Buffer D: Rendering of the clouds.
// Buffer C: Landscape

#define AA 3

float RoundMax( float a, float b, float r ) {
    a += r; b += r;    
    float f = ( a > 0. && b > 0. ) ? sqrt(a*a+b*b) : max(a,b);    
    return f - r;
}

float RoundMin( float a, float b, float r ) {
    return -RoundMax(-a,-b,r);
}

float Humanoid( in vec2 uv, in float phase ) {
    float n3 = sin((uv.y-uv.x*.7)*11.+phase)*.014; // "pose"
    float n0 = sin((uv.y+uv.x*1.1)*23.+phase*2.)*.007;
    float n1 = sin((uv.y-uv.x*.8)*37.+phase*4.)*.004;
    float n2 = sin((uv.y+uv.x*.9)*71.+phase*8.)*.002;

    
    float head = length((uv-vec2(0,1.65))/vec2(1,1.2))-.15/1.2;
    float neck = length(uv-vec2(0,1.5))-.05;
    float torso = abs(uv.x)-.25 - uv.x*.3;

    torso = RoundMax( torso, uv.y-1.5, .2 );
    torso = RoundMax( torso, -(uv.y-.6), .0 );

    float f = RoundMin(head,neck,.04);
    f = RoundMin(f,torso,.02);
    
    float leg = abs(abs(uv.x+(uv.y-.9)*.1*cos(phase*3.))-.15+.075*uv.y)-.07-.07*uv.y; 
    leg = max( leg, uv.y-1. );
    
    f = RoundMin(f,leg,.1);

    float stick = max(abs(uv.x+.4-uv.y*.04)-0.025, uv.y-1.15);
    float arm = max(max(abs(uv.y-1.-uv.x*.3) - .06, uv.x), -uv.x-.4);
    
    f = RoundMin(f, stick, 0.0);
    f = RoundMin(f, arm, 0.05);
    
    f += (-n0+n1+n2+n3)*(.1+.9*uv.y/1.6);
    
    return max( f, -uv.y );
}

float lensflare(vec2 fragCoord) {
    vec3 ro, ta;
    mat3 cam = getCamera( iTime, iMouse/iResolution.xyxy, ro, ta );
    vec3 cpos = SUN_DIR*cam; 
    vec2 pos = CAMERA_FL * cpos.xy / cpos.z;
    vec2 uv = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
    
	vec2 uvd = uv*(length(uv));
	float f = 0.1/(length(uv-pos)*16.0+1.0);
	f += max(1.0/(1.0+32.0*pow(length(uvd+0.8*pos),2.0)),.0)*0.25;
	vec2 uvx = mix(uv,uvd,-0.5);
	f += max(0.01-pow(length(uvx+0.4*pos),2.4),.0)*6.0;
	f += max(0.01-pow(length(uvx-0.3*pos),1.6),.0)*6.0;
	uvx = mix(uv,uvd,-0.4);
	f += max(0.01-pow(length(uvx+0.2*pos),5.5),.0)*2.0;
    
	return f;
}

bool intersectSphere ( in vec3 ro, in vec3 rd, in vec4 sph ) {
    vec3  ds = ro - sph.xyz;
    float bs = dot(rd, ds);
    float cs = dot(ds, ds) - sph.w*sph.w;
    float ts = bs*bs - cs;
	
    if( ts > 0.0 ) {
        ts = -bs - sqrt( ts );
		if( ts>0. ) {
			return true;
		}
    }
    return false;
}

bool intersectPlane (in vec3 ro, in vec3 rd, in vec3 n, in vec3 p0, inout float dist) {   
    dist = dot(p0 - ro, n)/dot(rd,n);
    return dist > 0.;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {  
    if( letterBox(fragCoord, iResolution.xy, 2.35) ) {
        fragColor = vec4( 0., 0., 0., 1. );
    } else {
        vec4 col = texelFetch(iChannel0, ivec2(fragCoord), 0);
        vec4 clouds = texelFetch(iChannel1, ivec2(fragCoord), 0);
    	
        col.rgb = clouds.rgb + col.rgb * clouds.a;
       
        vec3 ro, rd, ta;
		mat3 cam = getCamera( iTime, iMouse/iResolution.xyxy, ro, ta );
        float dist;
        vec4 tcol = vec4(0.);
        vec2 p = (-iResolution.xy + 2.0*(fragCoord))/iResolution.y;
        rd = cam * normalize(vec3(p,CAMERA_FL)); 
        
        if (intersectSphere(ro,rd,vec4(FLAG_POSITION,HUMANOID_SCALE*INV_SCENE_SCALE*2.))) {
            for(int x=0; x<AA; x++) {
                for(int y=0; y<AA; y++) {
                    vec2 p = (-iResolution.xy + 2.0*(fragCoord + vec2(x,y)/float(AA) - .5))/iResolution.y;
                    rd = cam * normalize(vec3(p,CAMERA_FL)); 

                    if (intersectPlane(ro, rd, vec3(0,0,1), FLAG_POSITION, dist) && dist < col.w) {
                        vec3 pos = ro + rd * dist;
                        vec2 uv = (pos.xy - FLAG_POSITION.xy)*(SCENE_SCALE/HUMANOID_SCALE);
                        uv.x = -uv.x + uv.y*0.05;
                        float sdf = Humanoid( uv, 3. );
                        float a = smoothstep(.4,.6,.5-.5*sdf/(abs(sdf)+.002));
                        float sdf2 = Humanoid( uv+vec2(.025,0.05), 3. );
                        float a2 = smoothstep(.4,.6,.5-.5*sdf2/(abs(sdf2)+.002));
                        float c = (a-a2)*2.;
                        c = clamp(c+uv.x*.2+.6,0.,1.); c*=c; c*=c;
                        tcol += vec4(mix(vec3(.04,0.05,0.06),SUN_COLOR,c),a);
                    }
                }
            }
            tcol /= float(AA*AA);
        }
        
        col.rgb = mix(col.rgb, tcol.rgb, tcol.w);    
            
        // lens flare
        col.rgb += SUN_COLOR*lensflare(fragCoord)*smoothstep(-.3,.5,dot(rd,SUN_DIR));       
        col.rgb = clamp(col.rgb, vec3(0), vec3(1));
        
        // gamma and contrast
        col.rgb = mix(col.rgb, pow(col.rgb, vec3(1./2.2)), .85);
        col.rgb = mix( col.rgb, col.bbb, 0.2 ); 
     
        // vignette
        vec2 uv = fragCoord / iResolution.xy;
        col.rgb = mix(col.rgb*col.rgb, col.rgb, pow( 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.1 ));
        
        // noise
        col.rgb -= hash12(fragCoord)*.025;
        
        fragColor = vec4( col.rgb, 1. );
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'MdGfzh';
  }
  name(): string {
    return 'Himalayas';
  }
  sort() {
    return 482;
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
  common() {
    return common;
  }
  userFragment(): string {
    return buffC;
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
      { type: 1, f: buffB, fi: 1 },
      { type: 1, f: buffC, fi: 2 },
      { type: 1, f: buffD, fi: 3 },
    ];
  }
}
