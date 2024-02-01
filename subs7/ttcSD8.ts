import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
/**
  Common tab contains all the control values for the terrain, clouds, sky etc, along
  with all the helper functions used in multiple buffers. 
*/


#define PI 3.1415926535

#define SAT(x) clamp(x, 0., 1.)

#define TERRAIN_FREQ .1
#define TERRAIN_HEIGHT 3.
#define HQ_OCTAVES 12
#define MQ_OCTAVES 7

#define CAMERA_NEAR .001
#define CAMERA_FAR 200.
#define CAMERA_FOV 75.
#define CAMERA_HEIGHT 1.6
#define CAMERA_PITCH .15
#define CAMERA_ZOOM -2.
#define CAMERA_DEPTH -1125.

#define FOG_B .3
#define FOG_C .1

#define SUN_INTENSITY 6.66
#define SUN_COLOR vec3(1.2, 1., .6)
#define SKY_COLOR vec3(.25, .5, 1.75)
#define SUN_SPEED .04

#define EARTH_RADIUS 6378100. 
#define CLOUD_BOTTOM 2500.
#define CLOUD_TOP 4200.
#define CLOUD_COVERAGE .555 // lower means more cloud coverage, and vice versa
#define CLOUD_BASE_FREQ .00006
#define CLOUD_DETAIL_FREQ .0018
#define CLOUD_STEPS 18
#define CLOUD_LIGHT_STEPS 6
#define CLOUD_TOP_OFFSET 250.
#define CLOUD_ABSORPTION_TOP 1.8
#define CLOUD_ABSORPTION_BOTTOM 3.6

#define WIND_DIR vec3(.4, .1, 1.)
#define WIND_SPEED 75.

#define CLOUDS_AMBIENT_TOP vec3(1., 1.2, 1.6)
#define CLOUDS_AMBIENT_BOTTOM vec3(.6, .4, .8)

#define BAYER_LIMIT 16
#define BAYER_LIMIT_H 4

// 4 x 4 Bayer matrix
const int bayerFilter[BAYER_LIMIT] = int[]
(
	 0,  8,  2, 10,
	12,  4, 14,  6,
	 3, 11,  1,  9,
	15,  7, 13,  5
);

struct Ray
{
	vec3 origin, direction;   
};
    
//-------------------------------------------------------------------------------------
//  Helper functions
//-------------------------------------------------------------------------------------
    
float remap(float x, float a, float b, float c, float d)
{
    return (((x - a) / (b - a)) * (d - c)) + c;
}

float remap01(float x, float a, float b)
{
	return ((x - a) / (b - a));   
}

bool writeToPixel(vec2 fragCoord, int iFrame)
{
    ivec2 iFragCoord = ivec2(fragCoord);
    int index = iFrame % BAYER_LIMIT;
    return (((iFragCoord.x + BAYER_LIMIT_H * iFragCoord.y) % BAYER_LIMIT)
            == bayerFilter[index]);
		
}

//-------------------------------------------------------------------------------------
//  Camera stuff
//-------------------------------------------------------------------------------------

mat3 getCameraMatrix(vec3 origin, vec3 target)
{
    vec3 lookAt = normalize(target - origin);
    vec3 right = normalize(cross(lookAt, vec3(0., 1., 0.)));
    vec3 up = normalize(cross(right, lookAt));
    return mat3(right, up, -lookAt);
}

Ray getCameraRay(vec2 uv, float t)
{
    uv *= (CAMERA_FOV / 360.) * PI; // fov
    vec3 origin = vec3(0., CAMERA_HEIGHT, CAMERA_DEPTH);
    vec3 target = vec3(0., origin.y + CAMERA_PITCH,  CAMERA_DEPTH - 1.2);
    mat3 camera = getCameraMatrix(origin, target);
    vec3 direction = normalize(camera * vec3(uv, CAMERA_ZOOM));
    return Ray(origin, direction);
}

vec3 getSun(vec2 mouse, float iTime)
{
    vec2 sunPos = mouse;
    
    if (mouse.y < -.95)
    {
        sunPos = vec2(cos(mod(iTime * SUN_SPEED, PI)) * .7, 0.);
    	sunPos.y = 1. - 3.05 * sunPos.x * sunPos.x;
    }
    
    float sunHeight = (max(0., sunPos.y * .75 + .25));
    
    return vec3(sunPos, sunHeight);
}

//-------------------------------------------------------------------------------------
//  Atmospheric Scattering
//-------------------------------------------------------------------------------------

/** Slightly modified version of robobo1221's fake atmospheric scattering
 	(https://www.shadertoy.com/view/4tVSRt)
*/
vec3 miePhase(float dist, vec3 sunL)
{
    return max(exp(-pow(dist, .3)) * sunL - .4, 0.);
}

vec3 atmosphericScattering(vec2 uv, vec2 sunPos, bool isSun)
{
    
    float sunDistance = distance(uv, sunPos);
	float scatterMult = SAT(sunDistance);
	float dist = uv.y;
	dist = (.5 * mix(scatterMult, 1., dist)) / dist;
    vec3 mieScatter = miePhase(sunDistance, vec3(1.)) * SUN_COLOR;
	vec3 color = dist * SKY_COLOR;
    color = max(color, 0.);
    vec3 sun = .0002 / pow(length(uv-sunPos), 1.7) * SUN_COLOR;
    
	color = max(mix(pow(color, .8 - color),
	color / (2. * color + .5 - color * 1.3),
	SAT(sunPos.y * 2.5)), 0.)
	+ (isSun ? (sun + mieScatter) : vec3(0.));
    
	color *=  (pow(1. - scatterMult, 5.) * 10. * SAT(.666 - sunPos.y)) + 1.5;
	float underscatter = distance(sunPos.y, 1.);
	color = mix(color, vec3(0.), SAT(underscatter));
	
	return color;	
}

//-------------------------------------------------------------------------------------
//  Hash Functions
//-------------------------------------------------------------------------------------
    
// Hash functions by Dave_Hoskins
#define UI0 1597334673U
#define UI1 3812015801U
#define UI2 uvec2(UI0, UI1)
#define UI3 uvec3(UI0, UI1, 2798796415U)
#define UIF (1. / float(0xffffffffU))

vec3 hash33(vec3 p)
{
	uvec3 q = uvec3(ivec3(p)) * UI3;
	q = (q.x ^ q.y ^ q.z)*UI3;
	return -1. + 2. * vec3(q) * UIF;
}

float hash13(vec3 p)
{
	uvec3 q = uvec3(ivec3(p)) * UI3;
	q *= UI3;
	uint n = (q.x ^ q.y ^ q.z) * UI0;
	return float(n) * UIF;
}

float hash12(vec2 p)
{
	uvec2 q = uvec2(ivec2(p)) * UI2;
	uint n = (q.x ^ q.y) * UI0;
	return float(n) * UIF;
}

//-------------------------------------------------------------------------------------
// Noise generation
//-------------------------------------------------------------------------------------

// Iq's value noise, and its analytical derivatives
vec3 valueNoiseDerivative(vec2 x, sampler2D smp)
{
    vec2 f = fract(x);
    vec2 u = f * f * (3. - 2. * f);

#if 1
    // texel fetch version
    ivec2 p = ivec2(floor(x));
    float a = texelFetch(smp, (p + ivec2(0, 0)) & 255, 0).x;
	float b = texelFetch(smp, (p + ivec2(1, 0)) & 255, 0).x;
	float c = texelFetch(smp, (p + ivec2(0, 1)) & 255, 0).x;
	float d = texelFetch(smp, (p + ivec2(1, 1)) & 255, 0).x;
#else    
    // texture version    
    vec2 p = floor(x);
	float a = textureLod(smp, (p + vec2(.5, .5)) / 256., 0.).x;
	float b = textureLod(smp, (p + vec2(1.5, .5)) / 256., 0.).x;
	float c = textureLod(smp, (p + vec2(.5, 1.5)) / 256., 0.).x;
	float d = textureLod(smp, (p + vec2(1.5, 1.5)) / 256., 0.).x;
#endif
    
	return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y,
				6. * f * (1. - f) * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
}

float valueNoise(vec3 x, float freq)
{
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3. - 2. * f);
	
    return mix(mix(mix(hash13(mod(i + vec3(0, 0, 0), freq)),  
                       hash13(mod(i + vec3(1, 0, 0), freq)), f.x),
                   mix(hash13(mod(i + vec3(0, 1, 0), freq)),  
                       hash13(mod(i + vec3(1, 1, 0), freq)), f.x), f.y),
               mix(mix(hash13(mod(i + vec3(0, 0, 1), freq)),  
                       hash13(mod(i + vec3(1, 0, 1), freq)), f.x),
                   mix(hash13(mod(i + vec3(0, 1, 1), freq)),  
                       hash13(mod(i + vec3(1, 1, 1), freq)), f.x), f.y), f.z);
}

// Tileable 3D worley noise
float worleyNoise(vec3 uv, float freq, bool tileable)
{    
    vec3 id = floor(uv);
    vec3 p = fract(uv);
    float minDist = 10000.;
    
    for (float x = -1.; x <= 1.; ++x)
    {
        for(float y = -1.; y <= 1.; ++y)
        {
            for(float z = -1.; z <= 1.; ++z)
            {
                vec3 offset = vec3(x, y, z);
                vec3 h = vec3(0.);
                if (tileable)
                    h = hash33(mod(id + offset, vec3(freq))) * .4 + .3; // [.3, .7]
				else
                    h = hash33(id + offset) * .4 + .3; // [.3, .7]
    			h += offset;
            	vec3 d = p - h;
           		minDist = min(minDist, dot(d, d));
            }
        }
    }
    
    // inverted worley noise
    return 1. - minDist;
}

// Fbm for Perlin noise based on iq's blog
float perlinFbm(vec3 p, float freq, int octaves)
{
    float G = exp2(-.85);
    float amp = 1.;
    float noise = 0.;
    for (int i = 0; i < octaves; ++i)
    {
        noise += amp * valueNoise(p * freq, freq);
        freq *= 2.;
        amp *= G;
    }
    
    return noise;
}

// Tileable Worley fbm inspired by Andrew Schneider's Real-Time Volumetric Cloudscapes
// chapter in GPU Pro 7.
float worleyFbm(vec3 p, float freq, bool tileable)
{
    float fbm = worleyNoise(p * freq, freq, tileable) * .625 +
        	 	worleyNoise(p * freq * 2., freq * 2., tileable) * .25 +
        	 	worleyNoise(p * freq * 4., freq * 4., tileable) * .125;
    return max(0., fbm * 1.1 - .1);
}`;

const buffA = `
/**
  Buffer A generates Perlin-Worley and Worley fbm noises used for modeling clouds
  in buffer C. This buffer only writes to texture at the beginning or whenever the
  viewport resolution is changed.
*/

bool resolutionChanged() {
    return int(texelFetch(iChannel1, ivec2(0), 0).r) != int(iResolution.x);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    if (resolutionChanged())
    {
        vec2 uv = fragCoord / iResolution.xy;
        vec4 col = vec4(0.);
        col.r += perlinFbm(vec3(uv, .4), 4., 15) * .5;
        col.r = abs(col.r * 2. - 1.);
        col.r = remap(col.r,  worleyFbm(vec3(uv, .2), 4., true) - 1., 1., 0., 1.);
        col.g += worleyFbm(vec3(uv, .5), 8., true) * .625 + 
            	 worleyFbm(vec3(uv, .5), 16., true) * .25  +
            	 worleyFbm(vec3(uv, .5), 32., true) * .125;
        col.b = 1. - col.g;
        fragColor = col;
    }
    else
    {
		fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);   
    }
}`;

const buffB = `
/**
  Buffer B ray marches and shades the terrain using iq's 3 light model and improved
  height fog. This buffer only updates 1 pixel in a 4x4 grid per frame, and the rest
  are reprojected.
*/

// Iq's slightly modified terrain fbm
const mat2 m2 = mat2(.8, -.6, .6, .8);

float terrainFbm(vec2 uv, int octaves, sampler2D smp)
{
    vec2  p = uv * TERRAIN_FREQ;
    float a = 0.;
    float b = 1.;
	vec2  d = vec2(0.);
    
    for (int i = 0; i < octaves; ++i)
    {
        vec3 n = valueNoiseDerivative(p, smp);
        d += n.yz;
        a += b * n.x / (1. + dot(d, d));
		b *= .5;
        p = m2 * p * 2.;
    }
    
    a = abs(a) * 2. - 1.;
    
    return smoothstep(-.95, .5, a) * a * TERRAIN_HEIGHT;
}

vec3 calcNormal(vec3 pos, float freq, float t)
{
    vec2 eps = vec2( 0.002 * t, 0.0 );
    int norLod = int(max(5., float(HQ_OCTAVES) - (float(HQ_OCTAVES) - 1.)
                         * t / CAMERA_FAR));
    return normalize( 
        vec3(terrainFbm(pos.xz - eps.xy, norLod, iChannel0) - terrainFbm(pos.xz
					+ eps.xy, norLod, iChannel0),
             2.0 * eps.x,
             terrainFbm(pos.xz - eps.yx, norLod, iChannel0) - terrainFbm(pos.xz
					+ eps.yx, norLod, iChannel0)));
}

float raymarchShadow(Ray ray)
{
    float shadow = 1.;
	float t = CAMERA_NEAR;
    vec3 p = vec3(0.);
    float h = 0.;
    for(int i = 0; i < 80; ++i)
	{
	    p = ray.origin + t * ray.direction;
        h = p.y - terrainFbm(p.xz, MQ_OCTAVES, iChannel0);
		shadow = min(shadow, 8. * h / t);
		t += h;
		if (shadow < 0.001 || p.z > CAMERA_FAR) break;
	}
	return SAT(shadow);
}

float raymarchTerrain(Ray ray)
{
	float t = CAMERA_NEAR, h = 0.;
    for (int i = 0; i < 200; ++i)
    {
    	vec3 pos = ray.origin + ray.direction * t;
        h = pos.y - terrainFbm(pos.xz, MQ_OCTAVES, iChannel0);
        if (abs(h) < (t * .002) || t > CAMERA_FAR)
            break;
        t += h * .5;
    }
    return t;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 st = fragCoord / iResolution.xy;
    vec2 uv = (2. * fragCoord - iResolution.xy) / iResolution.y;
    vec2 mouse = (2. * iMouse.xy - iResolution.xy) / iResolution.y;
    
    bool updatePixel = writeToPixel(fragCoord, iFrame);
    
    vec4 col = textureLod(iChannel1, st, 0.);
    
    if(updatePixel) // only draw 1/16th resolution per frame
    {
        Ray ray = getCameraRay(uv, iTime);
    
        float terrainDist = raymarchTerrain(ray);

        vec3 sun = getSun(mouse, iTime);
        vec3 sunDir = normalize(vec3(sun.x, sun.z, -1.));
        vec3 sunHalf = normalize(sunDir+ray.direction);
        float sunDot = max(0., dot(ray.direction, sunDir));
        
		vec3 terrainNormal = vec3(0.);
        
        col *= 0.;
        
        if (terrainDist > CAMERA_FAR)
        {
            // sky
            col.rgb += atmosphericScattering(uv * .5 + .225, sun.xy * .5 + .225, true);
            col.gb += .006 - uv.y * .0048; // slight night time blue-green tint

            // stars
            float t = iTime * .15;
            float stars = pow(hash12(fragCoord), 4. * iResolution.x);
            float twinkle = sin(t * 3.7 + uv.x - sin(uv.y * 20. + t) * 10.) * 2.;
            twinkle *= cos(uv.y + t * 4.4 - sin(uv.x * 15. + t) * 7.) * 1.5;
            twinkle = twinkle * .5 + .5;
            col += max(0., stars * twinkle * smoothstep(.075, 0., sun.z) * 2.);
        }
        else
        {
            vec3 marchPos = ray.origin + ray.direction * terrainDist;
            terrainNormal += calcNormal(marchPos, TERRAIN_FREQ, terrainDist); 
			
            // terrain colors
            vec3 rock = vec3(.1, .1, .08);
            vec3 snow = vec3(.9);
            vec3 grass = vec3(.02, .1, .05);

            vec3 albedo = mix(grass, rock, smoothstep(0., .1 * TERRAIN_HEIGHT,
								marchPos.y)); 
            albedo = mix(albedo, snow, smoothstep(.4 * TERRAIN_HEIGHT,
							1.4 * TERRAIN_HEIGHT, marchPos.y));
            albedo = mix(rock, albedo, smoothstep(.4, .7, terrainNormal.y));

            float terrainShadow = clamp(raymarchShadow(Ray(marchPos - sunDir * .001, 
										sunDir)), 0., 8.) + .2;

            float diffuse = max(dot(sunDir, terrainNormal), 0.) * terrainShadow;
            float specular = SAT(dot(sunHalf, ray.direction));
            float skyAmbient = SAT(.5 + .5 * terrainNormal.y);

            col.rgb += SUN_INTENSITY * SUN_COLOR * diffuse; // sun diffuse
            // sky ambient
            col.rgb += vec3(.5, .7, 1.2) * skyAmbient;
            // backlight ambient
            col.rgb += SUN_COLOR * (SAT(.5 + .5 * dot(
                normalize(vec3(-sunDir.x, sunDir.y, sunDir.z)), terrainNormal)));
            // terrain tex color
            col.rgb *= albedo;

            // specular
            col.rgb += SUN_INTENSITY * .4 * SUN_COLOR * diffuse 
                			* pow(SAT(specular), 16.);

            // Iq's height based density fog
            float fogMask = FOG_C * exp(-ray.origin.y * FOG_B) *
                (1. - exp(-pow(terrainDist * FOG_B, 1.5) * ray.direction.y))
                / ray.direction.y;
            vec3 fogCol = mix(atmosphericScattering(uv * .5 + .75, sun.xy * .5 + .225,
								false) * .75, vec3(.8, .6, .3), pow(sunDot, 8.));
            // shitty night time fog hack
            fogCol = mix(vec3(.4, .5, .6), fogCol, smoothstep(0., .1, sun.z));
            col.rgb = mix(col.rgb, fogCol, SAT(fogMask));

            col.rgb *= max(.0, sun.z)
                + mix(vec3(smoothstep(.1, 0., sun.z)) * terrainNormal.y, fogCol, 
                      SAT(fogMask)) * (.012, .024, .048);
        }
        col.a = terrainDist;
    }
    
    fragColor = col;
    
    if (fragCoord.x < 1. && fragCoord.y < 1.)
    {
    	fragColor = vec4(iResolution.x, vec3(0.));   
    }
}`;

const buffC = `/**
Buffer C draws the clouds in the sky. The texture from buffer A is used to model the
clouds in the ray march and the light march loops. Just like buffer B, only 1 out 16
pixels are processed per frame and the rest are reprojected. If anyone's interested,
I've compiled a useful list of resources for rendering realtime volumetric clouds
here: https://gist.github.com/pxv8270/e3904c49cbd8ff52cb53d95ceda3980e
*/

const vec3 noiseKernel[6u] = vec3[] 
(
vec3( .38051305,  .92453449, -.02111345),
vec3(-.50625799, -.03590792, -.86163418),
vec3(-.32509218, -.94557439,  .01428793),
vec3( .09026238, -.27376545,  .95755165),
vec3( .28128598,  .42443639, -.86065785),
vec3(-.16852403,  .14748697,  .97460106)
);

//-------------------------------------------------------------------------------------
// Clouds modeling
//-------------------------------------------------------------------------------------

float raySphereIntersect(Ray ray, float radius)
{
  // note to future me: don't need "a" bcuz rd is normalized and dot(rd, rd) = 1
 float b = 2. * dot(ray.origin, ray.direction);
  float c = dot(ray.origin, ray.origin) - radius * radius;
  float d = sqrt(b * b - 4. * c);
  return (-b + d) * .5;
}

float cloudGradient(float h)
{
  return smoothstep(0., .05, h) * smoothstep(1.25, .5, h);
}

float cloudHeightFract(float p)
{
return (p - EARTH_RADIUS - CLOUD_BOTTOM) / (CLOUD_TOP - CLOUD_BOTTOM);
}

float cloudBase(vec3 p, float y)
{
  vec3 noise = textureLod(iChannel2, (p.xz - (WIND_DIR.xz * iTime * WIND_SPEED))
                          * CLOUD_BASE_FREQ, 0.).rgb;
  float n = y * y * noise.b + pow(1. - y, 12.);
  float cloud = remap01(noise.r - n, noise.g - 1., 1.);
  return cloud;
}

float cloudDetail(vec3 p, float c, float y)
{
  p -= WIND_DIR * 3. * iTime * WIND_SPEED;
  // this is super expensive :(
  float hf = worleyFbm(p, CLOUD_DETAIL_FREQ, false) * .625 +
           worleyFbm(p, CLOUD_DETAIL_FREQ*2., false) * .25 +
           worleyFbm(p, CLOUD_DETAIL_FREQ*4., false) * .125;
  hf = mix(hf, 1. - hf, y * 4.);
  return remap01(c, hf * .5, 1.);
}

float getCloudDensity(vec3 p, float y, bool detail)
{
  p.xz -= WIND_DIR.xz * y * CLOUD_TOP_OFFSET;
  float d = cloudBase(p, y);
  d = remap01(d, CLOUD_COVERAGE, 1.) * (CLOUD_COVERAGE);
  d *= cloudGradient(y);
  bool cloudDetailTest = (d > 0. && d < .3) && detail; 
  return ((cloudDetailTest) ? cloudDetail(p, d, y) : d);
}

//-------------------------------------------------------------------------------------
// Clouds lighting
//-------------------------------------------------------------------------------------

float henyeyGreenstein( float sunDot, float g) {
float g2 = g * g;
return (.25 / PI) * ((1. - g2) / pow( 1. + g2 - 2. * g * sunDot, 1.5));
}

float marchToLight(vec3 p, vec3 sunDir, float sunDot, float scatterHeight)
{
  float lightRayStepSize = 11.;
vec3 lightRayDir = sunDir * lightRayStepSize;
  vec3 lightRayDist = lightRayDir * .5;
  float coneSpread = length(lightRayDir);
  float totalDensity = 0.;
  for(int i = 0; i < CLOUD_LIGHT_STEPS; ++i)
  {
      // cone sampling as explained in GPU Pro 7 article
     vec3 cp = p + lightRayDist + coneSpread * noiseKernel[i] * float(i);
      float y = cloudHeightFract(length(p));
      if (y > .95 || totalDensity > .95) break; // early exit
      totalDensity += getCloudDensity(cp, y, false) * lightRayStepSize;
      lightRayDist += lightRayDir;
  }
  
  return 32. * exp(-totalDensity * mix(CLOUD_ABSORPTION_BOTTOM,
      CLOUD_ABSORPTION_TOP, scatterHeight)) * (1. - exp(-totalDensity * 2.));
}

//-------------------------------------------------------------------------------------

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2 st = fragCoord / iResolution.xy;
  vec2 uv = (2. * fragCoord - iResolution.xy) / iResolution.y;
  vec2 mouse = (2. * iMouse.xy - iResolution.xy) / iResolution.y;
  float terrainDist = texelFetch(iChannel0, ivec2(fragCoord), 0).w;
  vec4 prevCol = textureLod(iChannel1, st, 0.);
  vec4 col = vec4(0.);
  
  bool updatePixel = writeToPixel(fragCoord, iFrame);
  
  if (updatePixel) // only draw 1/16th resolution per frame
  {
      
      Ray ray = getCameraRay(uv, iTime);
      vec3 sun = getSun(mouse, iTime);
      // clouds don't get blindingly bright with sun at zenith
      sun.z = clamp(sun.z, 0., .8);
      vec3 sunDir = normalize(vec3(sun.x, sun.z, -1.));
      float sunDot = max(0., dot(ray.direction, sunDir));
      float sunHeight = smoothstep(.01, .1, sun.z + .025);
      
      if (terrainDist > CAMERA_FAR)
      {

          // clouds
          ray.origin.y = EARTH_RADIUS;
          float start = raySphereIntersect(ray, EARTH_RADIUS + CLOUD_BOTTOM);
          float end = raySphereIntersect(ray, EARTH_RADIUS + CLOUD_TOP);
          float cameraRayDist = start;
          float cameraRayStepSize = (end - start) / float(CLOUD_STEPS);
          
          // blue noise offset
          cameraRayDist += cameraRayStepSize * texelFetch(iChannel3,
            (ivec2(fragCoord) + iFrame * ivec2(113, 127)) & 1023, 0).r;
          vec3 skyCol = atmosphericScattering(vec2(0.15, 0.05),
                              vec2(.5, sun.y*.5+.25), false);
          skyCol.r *= 1.1;
    skyCol = SAT(pow(skyCol * 2.1, vec3(4.2)));
          float sunScatterHeight = smoothstep(.15, .4, sun.z);
          float hgPhase = mix(henyeyGreenstein(sunDot, .4),
                              henyeyGreenstein(sunDot, -.1), .5);
          // sunrise/sunset hack
          hgPhase = max(hgPhase, 1.6 * henyeyGreenstein(sqrt(sunDot),
            SAT(.8 - sunScatterHeight)));
          // shitty night time hack
          hgPhase = mix(pow(sunDot, .25), hgPhase, sunHeight);
          
          vec4 intScatterTrans = vec4(0., 0., 0., 1.);
          vec3 ambient = vec3(0.);
          for (int i = 0; i < CLOUD_STEPS; ++i)
          {
              vec3 p = ray.origin + cameraRayDist * ray.direction;
              float heightFract = cloudHeightFract(length(p));
              float density = getCloudDensity(p, heightFract, true);
              if (density > 0.)
              {
                  ambient = mix(CLOUDS_AMBIENT_BOTTOM, CLOUDS_AMBIENT_TOP, 
                                  heightFract);
        
                  // cloud illumination
                  vec3 luminance = (ambient * SAT(pow(sun.z + .04, 1.4))
          + skyCol * .125 + (sunHeight * skyCol + vec3(.0075, .015, .03))
          * SUN_COLOR * hgPhase
          * marchToLight(p, sunDir, sunDot, sunScatterHeight)) * density;

                  // improved scatter integral by Sébastien Hillaire
                  float transmittance = exp(-density * cameraRayStepSize);
                  vec3 integScatter = (luminance - luminance * transmittance)
                      * (1. / density);
                  intScatterTrans.rgb += intScatterTrans.a * integScatter; 
                  intScatterTrans.a *= transmittance;

              }

              if (intScatterTrans.a < .05)
                  break;
              cameraRayDist += cameraRayStepSize;
          }

          // blend clouds with sky at a distance near the horizon (again super hacky)
          float fogMask = 1. - exp(-smoothstep(.15, 0., ray.direction.y) * 2.);
          vec3 fogCol = atmosphericScattering(uv * .5 + .2, sun.xy * .5 + .2, false);
          intScatterTrans.rgb = mix(intScatterTrans.rgb,
                                    fogCol * sunHeight, fogMask);
          intScatterTrans.a = mix(intScatterTrans.a, 0., fogMask);

          col = vec4(max(vec3(intScatterTrans.rgb), 0.), intScatterTrans.a);
          
          //temporal reprojection
      col = mix(prevCol, col, .5);
      }
  }
  else
  {
  col = prevCol;
  }
  
  fragColor = col;
}`;

const buffD = `
/**
  Buffer D performs TXAA on the clouds from buffer C to hide some blue noise and
  ghosting artifacts.
*/

const ivec2 offsets[8u] = ivec2[]
(
    ivec2(-1,-1), ivec2(-1, 1), 
	ivec2(1, -1), ivec2(1, 1), 
	ivec2(1, 0), ivec2(0, -1), 
	ivec2(0, 1), ivec2(-1, 0)
);

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    vec4 currentBuffer = textureLod(iChannel0, uv, 0.);
    vec4 historyBuffer = textureLod(iChannel1, uv, 0.);

    vec4 colorAvg = currentBuffer;
    vec4 colorVar = currentBuffer * currentBuffer;
    
    // Marco Salvi's Implementation (by Chris Wyman)
    for(int i = 0; i < 8; i++)
    {
        vec4 neighborTexel = texelFetch(iChannel0, ivec2(fragCoord.xy) + offsets[i], 0);
        colorAvg += neighborTexel;
        colorVar += neighborTexel * neighborTexel;
    }
    colorAvg /= 9.;
    colorVar /= 9.;
    float gColorBoxSigma = .75;
	vec4 sigma = sqrt(max(vec4(0.), colorVar - colorAvg * colorAvg));
	vec4 colorMin = colorAvg - gColorBoxSigma * sigma;
	vec4 colorMax = colorAvg + gColorBoxSigma * sigma;
    
    historyBuffer = clamp(historyBuffer, colorMin, colorMax);

	fragColor = mix(currentBuffer, historyBuffer, 0.95);
}`;

const fragment = `
/**
  My first attempt at rendering volumetric clouds and ray marched terrain. Terrain is
  rendered based on ray marching techniques by iq, and the clouds are rendered based
  on techniques by Nathan Vos and Andrew Schneider(Guerrilla), and Sébastien Hillaire
  (Epic), see buffer C for more details. 

  This main image tab mostly apples some post-process effects to the terrain and cloud
  textures, including a gaussian blue for the clouds to hide noise/ray marching
  artifacts, and some lens flares and light scattering effects, along with a
  luminance based reinhard tonemapper. 
*/

//-------------------------------------------------------------------------------------
// Gaussian Blur
//-------------------------------------------------------------------------------------

#define texelOffset vec2(1.75 / iResolution.xy)

const float kernel[9] = float[]
(
	.0625, .125, .0625,
    .125,  .25,  .125,
    .0625, .125, .0625  
);

vec4 gaussianBlur(sampler2D buffer, vec2 uv)
{
    vec4 col = vec4(0.);
    
 	vec2 offsets[9] = vec2[](
        vec2(-texelOffset.x,  texelOffset.y),  // top-left
        vec2( 			0.,   texelOffset.y),  // top-center
        vec2( texelOffset.x,  texelOffset.y),  // top-right
        vec2(-texelOffset.x,  			 0.),  // center-left
        vec2( 			0.,			 	 0.),  // center-center
        vec2( texelOffset.x,  	 		 0.),  // center-right
        vec2(-texelOffset.x,  -texelOffset.y), // bottom-left
        vec2( 			0.,   -texelOffset.y), // bottom-center
        vec2( texelOffset.x,  -texelOffset.y)  // bottom-right    
    );
    
    for(int i = 0; i < 9; i++)
    {
        col += textureLod(buffer, uv + offsets[i], 0.) * kernel[i];
    }
    
    return col;
}

//-------------------------------------------------------------------------------------
// Lens Flare (from shadertoy.com/view/XdfXRX)
//-------------------------------------------------------------------------------------

#define ORB_FLARE_COUNT	8
#define DISTORTION_BARREL 1.3

vec2 GetDistOffset(vec2 uv, vec2 pxoffset)
{
    vec2 tocenter = uv.xy;
    vec3 prep = normalize(vec3(tocenter.y, -tocenter.x, 0.0));
    
    float angle = length(tocenter.xy) * 2.221 * DISTORTION_BARREL;
    vec3 oldoffset = vec3(pxoffset, 0.);
    
    vec3 rotated = oldoffset * cos(angle) + cross(prep, oldoffset)
        * sin(angle) + prep * dot(prep, oldoffset) * (1. - cos(angle));
    
    return rotated.xy;
}

vec3 flare(vec2 uv, vec2 pos, float dist, float size)
{
    pos = GetDistOffset(uv, pos);
    
    float r = max(.01 - pow(length(uv + (dist - .05)*pos), 2.4) 
                  *(1. / (size * 2.)), 0.) * 6.0;
	float g = max(.01 - pow(length(uv +  dist       *pos), 2.4) 
                  *(1. / (size * 2.)), 0.) * 6.0;
	float b = max(.01 - pow(length(uv + (dist + .05)*pos), 2.4) 
                  *(1. / (size * 2.)), 0.) * 6.0;
    
    return vec3(r, g, b);
}

vec3 ring(vec2 uv, vec2 pos, float dist)
{
    vec2 uvd = uv*(length(uv));
    
    float r = max(1. / (1. + 32. * pow(length(uvd + (dist - .05)
				  * pos), 2.)), 0.) * .25;
	float g = max(1. / (1. + 32. * pow(length(uvd +  dist       
				  * pos), 2.)), 0.) * .23;
	float b = max(1. / (1. + 32. * pow(length(uvd + (dist + .05)
				  * pos), 2.)), 0.) * .21;
    
    return vec3(r,g,b);
}

vec3 lensflare(vec2 uv,vec2 pos, float brightness, float size)
{
	
    vec3 c = flare(uv, pos, -1., size) * 3.;
    c += flare(uv, pos, .5, .8 * size) * 2.;
    c += flare(uv, pos, -.4, .8 * size);
    
    c += ring(uv, pos, -1.) * .5 * size;
    c += ring(uv, pos, 1.) * .5 * size;
    
    return c * brightness;
}

//-------------------------------------------------------------------------------------
// Light Scattering
//-------------------------------------------------------------------------------------

#define NUM_SAMPLES 48
#define DENSITY .768
#define WEIGHT .14
#define DECAY .97

vec3 lightScattering(vec2 uv, vec2 lightPos, vec3 sun)
{    
    vec2 deltauv = vec2(uv - lightPos);
    vec2 st = uv;
    uv = uv * 2. - 1.;
    uv.x *= iResolution.x / iResolution.y;
    deltauv *= 1. /  float(NUM_SAMPLES) * DENSITY;
    float illuminationDecay = 1.;
    vec3 result = vec3(0.);

    for(int i = 0; i < NUM_SAMPLES; i++)
    {
        st -= deltauv;
        float lightStep = textureLod(iChannel1, st, 0.).a
            		* smoothstep(2.5, -1., length(uv-sun.xy));

        lightStep *= illuminationDecay * WEIGHT;

        result += lightStep;

        illuminationDecay *= DECAY;
    }
    
    return result * (SUN_COLOR) * .2;
}

//-------------------------------------------------------------------------------------
// Tone mapping
//-------------------------------------------------------------------------------------

vec3 luminanceReinhard(vec3 color)
{
	float lum = dot(color, vec3(.2126, .7152, .0722));
	float toneMappedLum = lum / (1. + lum);
	color *= toneMappedLum / lum;
	return color;
}

//-------------------------------------------------------------------------------------

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 st = fragCoord/iResolution.xy;
    vec2 uv = (2. * fragCoord - iResolution.xy) / iResolution.y;
    vec2 mouse = (2. * iMouse.xy - iResolution.xy) / iResolution.y;
    vec3 sun = getSun(mouse, iTime);

	vec4 terrain = textureLod(iChannel0, vec2(st.x, st.y - 1. / iResolution.y), 0.);
    vec4 clouds = gaussianBlur(iChannel1, st);
    float cloudsAlphaMask = clouds.a + (terrain.a > CAMERA_FAR ? 0. : 1.);
    
    vec2 lightPosScreenSpace = vec2(sun.x * iResolution.y/iResolution.x, sun.y) * .5 + .5;
    float lensflareMask = textureLod(iChannel1, lightPosScreenSpace, 0.).a;
    
    vec3 col = vec3(0.);
    col = vec3(clouds.rgb + terrain.rgb * cloudsAlphaMask);
    col += lightScattering(st, lightPosScreenSpace, sun) * smoothstep(.01, .16, sun.z)
        		* smoothstep(.3, 1.5, terrain.a);
	col += lensflare(uv, sun.xy, .8, 4.) * vec3(1.4, 1.2, 1.) * lensflareMask;
    col = mix(col, pow(luminanceReinhard(col), vec3(.4545)), .75);
    col += hash12(fragCoord) * .004;

    fragColor = vec4(col, 1.);
    
    // hide the ugly red pixel
    if (fragCoord.y < 2. && fragCoord.x < 2.)
        fragColor = vec4(.6) * sun.z;
}
`;

export default class implements iSub {
  key(): string {
    return 'ttcSD8';
  }
  name(): string {
    return 'Swiss Alps';
  }
  // sort() {
  //   return 0;
  // }
  webgl() {
    return WEBGL_2;
  }
  common() {
    return common;
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
}
