import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
const bool autoRotate = true;

const bool showBackground = true;
const bool showPlanet = true;
const bool showClouds = true;

const bool debugMaterials = false;
    
#define time (iTime)


///////////////////////////////////////////////////////////////////////////////////
// Morgan's standard Shadertoy helpers
#define Vector2      vec2
#define Point3       vec3
#define Vector3      vec3
#define Color3       vec3
#define Radiance3    vec3
#define Radiance4    vec4
#define Irradiance3  vec3
#define Power3       vec3
#define Biradiance3  vec3

const float pi          = 3.1415926535;
const float degrees     = pi / 180.0;
const float inf         = 1.0 / 1e-10;

float square(float x) { return x * x; }
float pow3(float x) { return x * square(x); }
float pow4(float x) { return square(square(x)); }
float pow8(float x) { return square(pow4(x)); }
float pow5(float x) { return x * square(square(x)); }
float infIfNegative(float x) { return (x >= 0.0) ? x : inf; }

struct Ray { Point3 origin; Vector3 direction; };	
struct Material { Color3 color; float metal; float smoothness; };
struct Surfel { Point3 position; Vector3 normal; Material material; };
struct Sphere { Point3 center; float radius; Material material; };
   
/** Analytic ray-sphere intersection. */
bool intersectSphere(Point3 C, float r, Ray R, inout float nearDistance, inout float farDistance) { Point3 P = R.origin; Vector3 w = R.direction; Vector3 v = P - C; float b = 2.0 * dot(w, v); float c = dot(v, v) - square(r); float d = square(b) - 4.0 * c; if (d < 0.0) { return false; } float dsqrt = sqrt(d); float t0 = infIfNegative((-b - dsqrt) * 0.5); float t1 = infIfNegative((-b + dsqrt) * 0.5); nearDistance = min(t0, t1); farDistance  = max(t0, t1); return (nearDistance < inf); }

float hash(float p) { p = fract(p * 0.011); p *= p + 7.5; p *= p + p; return fract(p); }
float hash(vec2 p) {vec3 p3 = fract(vec3(p.xyx) * 0.13); p3 += dot(p3, p3.yzx + 3.333); return fract((p3.x + p3.y) * p3.z); }
float noise(float x) { float i = floor(x); float f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), u); }
float noise(vec2 x) { vec2 i = floor(x); vec2 f = fract(x); float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0)); vec2 u = f * f * (3.0 - 2.0 * f); return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y; }
float noise(vec3 x) { const vec3 step = vec3(110, 241, 171); vec3 i = floor(x); vec3 f = fract(x); float n = dot(i, step); vec3 u = f * f * (3.0 - 2.0 * f); return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x), mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y), mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x), mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z); }

#define DEFINE_FBM(name, OCTAVES) float name(vec3 x) { float v = 0.0; float a = 0.5; vec3 shift = vec3(100); for (int i = 0; i < OCTAVES; ++i) { v += a * noise(x); x = x * 2.0 + shift; a *= 0.5; } return v; }
DEFINE_FBM(fbm3, 3)
DEFINE_FBM(fbm5, 5)
DEFINE_FBM(fbm6, 6)
    
///////////////////////////////////////////////////////////////////////////////////

const float       verticalFieldOfView = 25.0 * degrees;

// Directional light source
const Vector3     w_i             = Vector3(1.0, 1.3, 0.6) / 1.7464;
const Biradiance3 B_i             = Biradiance3(2.9);

const Point3      planetCenter    = Point3(0);

// Including clouds
const float       planetMaxRadius = 1.0;

const float       cloudMinRadius  = 0.85;

const Radiance3   atmosphereColor = Color3(0.3, 0.6, 1.0) * 1.6;


// This can g1 negative in order to make derivatives smooth. Always
// clamp before using as a density. Must be kept in sync with Buf A code.
float cloudDensity(Point3 X, float t) {
    Point3 p = X * vec3(1.5, 2.5, 2.0);
	return fbm5(p + 1.5 * fbm3(p - t * 0.047) - t * vec3(0.03, 0.01, 0.01)) - 0.42;
}

Color3 shadowedAtmosphereColor(vec2 fragCoord, vec3 iResolution, float minVal) {
    vec2 rel = 0.65 * (fragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    const float maxVal = 1.0;
    
    float a = min(1.0,
                  pow(max(0.0, 1.0 - dot(rel, rel) * 6.5), 2.4) + 
                  max(abs(rel.x - rel.y) - 0.35, 0.0) * 12.0 +                   
	              max(0.0, 0.2 + dot(rel, vec2(2.75))) + 
                  0.0
                 );
    
    float planetShadow = mix(minVal, maxVal, a);
    
    return atmosphereColor * planetShadow;

}

`;

let buffA = `
// Planet implicit surface ray tracer
// by Morgan McGuire, @CasualEffects, http://casual-effects.com
//
// Prototype for a new Graphics Codex programming project.
//
// The key functions are the scene() distance estimator in Buf A and
// the renderClouds() shading in Buf B. Everything else is relatively 
// standard ray marching infrastructure.

mat3 planetRotation;

const Material ROCK = Material(Color3(0.50, 0.35, 0.15), 0.0, 0.0);
const Material TREE = Material(Color3(0.05, 1.15, 0.10), 0.2, 0.1);
const Material SAND = Material(Color3(1.00, 1.00, 0.85), 0.0, 0.0);
const Material ICE  = Material(Color3(0.85, 1.00, 1.20), 0.2, 0.6);

/**
 Conservative distance estimator for the entire scene. Returns true if
 the surface is closer than distance. Always updates distance and material.
 The material code compiles out when called from a context that ignores it.
*/
bool scene(Point3 X, inout float distance, inout Material material, const bool shadow) { 
    Material planetMaterial;
    
    // Move to the planet's reference frame (ideally, we'd just trace in the 
    // planet's reference frame and avoid these operations per distance
    // function evaluation, but this makes it easy to integrate with a
    // standard framework)
    X = planetRotation * (X - planetCenter);
    Point3 surfaceLocation = normalize(X);
    
    // Compute t = distance estimator to the planet surface using a spherical height field, 
    // in which elevation = radial distance
    //
	// Estimate *conservative* distance as always less than that to the bounding sphere
    // (i.e., push down). Work on range [0, 1], and then scale by planet radius at the end
    
	float mountain = clamp(1.0 - fbm6(surfaceLocation * 4.0) + (max(abs(surfaceLocation.y) - 0.6, 0.0)) * 0.03, 0.0, 1.0);
    mountain = pow3(mountain) * 0.25 + 0.8;
    
    const float water = 0.85;
    float elevation = mountain;    
    
    Vector3 normal = normalize(cross(dFdx(surfaceLocation * mountain), dFdy(surfaceLocation * mountain)));
    
    // Don't pay for fine details in the shadow tracing pass
	if (! shadow) {
        if (elevation < water) {
            float relativeWaterDepth = min(1.0, (water - mountain) * 30.0);
            const float waveMagnitude = 0.0014;
            const float waveLength = 0.01;

            // Create waves. Shallow-water waves conform to coasts. Deep-water waves follow global wind patterns.
            const Color3 shallowWaterColor = Color3(0.4, 1.0, 1.9);
            // How much the waves conform to beaches
            const float shallowWaveRefraction = 4.0;        
            float shallowWavePhase = (surfaceLocation.y - mountain * shallowWaveRefraction) * (1.0 / waveLength);

            const Color3 deepWaterColor = Color3(0, 0.1, 0.7);
            float deepWavePhase    = (atan(surfaceLocation.z, surfaceLocation.x) + noise(surfaceLocation * 15.0) * 0.075) * (1.5 / waveLength);

            // This is like a lerp, but it gives a large middle region in which both wave types are active at nearly full magnitude
            float wave =  (cos(shallowWavePhase + time * 1.5) * sqrt(1.0 - relativeWaterDepth) + 
                           cos(deepWavePhase + time * 2.0) * 2.5 * (1.0 - abs(surfaceLocation.y)) * square(relativeWaterDepth)) *
                waveMagnitude;

            elevation = water + wave;

            // Set material, making deep water darker
            planetMaterial = Material(mix(shallowWaterColor, deepWaterColor, pow(relativeWaterDepth, 0.4)), 0.5 * relativeWaterDepth, 0.7);

            // Lighten polar water color
            planetMaterial.color = mix(planetMaterial.color, Color3(0.7, 1.0, 1.2), square(clamp((abs(surfaceLocation.y) - 0.65) * 3.0, 0.0, 1.0)));            
        } else {
            float materialNoise = noise(surfaceLocation * 200.0);

            float slope = clamp(2.0 * (1.0 - dot(normal, surfaceLocation)), 0.0, 1.0);

            bool iceCap     = abs(surfaceLocation.y) + materialNoise * 0.2 > 0.98; 
            bool rock       = (elevation + materialNoise * 0.1 > 0.94) || (slope > 0.3);
            bool mountainTop = (elevation + materialNoise * 0.05 - slope * 0.05) > (planetMaxRadius * 0.92);

            // Beach
            bool sand        = (elevation < water + 0.006) && (noise(surfaceLocation * 8.0) > 0.3);

            // Equatorial desert
            sand = sand || (elevation < 0.89) && 
                (noise(surfaceLocation * 1.5) * 0.15 + noise(surfaceLocation * 73.0) * 0.25 > abs(surfaceLocation.y));

            if (rock) {
                // Rock
                planetMaterial = ROCK;
            } else {
                // Trees
                planetMaterial = TREE;
            }

            if (iceCap || mountainTop) {
                // Ice (allow to slightly exceed physical conservation in the blue channel
                // to simulate subsurface effects)
                planetMaterial = ICE;
            } else if (! rock && sand) {
                planetMaterial = SAND;
            } else if (! rock && (iResolution.x > 420.0)) {
                // High frequency bumps for trees when in medium resolution
                elevation += noise(surfaceLocation * 150.0) * 0.02;
            }

            // Add high-frequency material detail
            if (! sand && ! iceCap) {
                planetMaterial.color *= mix(noise(surfaceLocation * 256.0), 1.0, 0.4);
            }

        }
    }
        
    elevation *= planetMaxRadius;
    
    float sampleElevation = length(X);
    float t = sampleElevation - elevation;
    
    // Be a little more conservative because a radial heightfield is not a great
    // distance estimator.
    t *= 0.8;
        
    // Compute output variables
    bool closer = (t < distance);       
    distance = closer ? t : distance;    
    if (closer) { material = planetMaterial; }
    return closer;    
}


// Version that ignores materials
bool scene(Point3 X, inout float distance) {
    Material ignoreMaterial;
    return scene(X, distance, ignoreMaterial, true); 
}

float distanceEstimator(Point3 X) {
    float d = inf;
    Material ignoreMaterial;
    scene(X, d, ignoreMaterial, false);
    return d;
}

// Weird structure needed because WebGL does not support BREAK in a FOR loop
bool intersectSceneLoop(Ray R, float minDist, float maxDist, inout Surfel surfel) {
    const int maxIterations = 75;
    
    // Making this too large causes bad results because we use
    // screen-space derivatives for normal estimation.
    
    const float closeEnough = 0.0011;
    const float minStep = closeEnough;
    float closest = inf;
    float tForClosest = 0.0;
    float t = minDist;
    
    for (int i = 0; i < maxIterations; ++i) {
        surfel.position = R.direction * t + R.origin;

        float dt = inf;
        scene(surfel.position, dt);
        if (dt < closest) {            
	        closest = dt;
            tForClosest = t;            
        }
        
        t += max(dt, minStep);
        if (dt < closeEnough) {
            return true;
        } else if (t > maxDist) {
            return false;
        }
    }    

    // "Screen space" optimization from Mercury for shading a reasonable
    // point in the event of failure due to iteration count
    if (closest < closeEnough * 5.0) {
        surfel.position = R.direction * tForClosest + R.origin;
        return true;
    }
    
    return false;
}


bool intersectScene(Ray R, float minDist, float maxDist, inout Surfel surfel) {
    if (intersectSceneLoop(R, minDist, maxDist, surfel)) {
        const float eps = 0.0001;
        
        float d = inf;
        scene(surfel.position, d, surfel.material, false);
        surfel.normal =
            normalize(Vector3(distanceEstimator(surfel.position + Vector3(eps, 0, 0)), 
                              distanceEstimator(surfel.position + Vector3(0, eps, 0)), 
                              distanceEstimator(surfel.position + Vector3(0, 0, eps))) - 
                              d);
        return true;
    } else {
        return false;
    }
}


bool shadowed(Ray R, float minDist, float maxDist) {
    const int maxIterations = 30;    
    const float closeEnough = 0.0011 * 4.0;
    const float minStep = closeEnough;
    float t = 0.0;
    
    for (int i = 0; i < maxIterations; ++i) {
        float dt = inf;
        scene(R.direction * t + R.origin, dt);        
        t += max(dt, minStep);
        if (dt < closeEnough) {
            return true;
        } else if (t > maxDist) {
            return false;
        }
    }
    
    return false;
}



void computeReflectivities(Material material, out Color3 p_L, out Color3 p_G, out float glossyExponent) {
	p_L = mix(material.color, Color3(0.0), material.metal);
	p_G = mix(Color3(0.04), material.color, material.metal);
	glossyExponent = exp2(material.smoothness * 15.0);
}


Radiance3 shade(Surfel surfel, Vector3 w_i, Vector3 w_o, Biradiance3 B_i) {
	Vector3 n   = surfel.normal;
    
    float cos_i = dot(n, w_i);
    if (cos_i < 0.0) {
        // Backface, don't bother shading or shadow casting
        return Radiance3(0.0);
    }
    
    // Cast a shadow ray
    Ray shadowRay = Ray(surfel.position + (surfel.normal + w_o) * 0.003, w_i);
    float shadowDist, ignore;
    // Find the outer bounding sphere on the atmosphere and trace shadows up to it
    intersectSphere(planetCenter, planetMaxRadius, shadowRay, shadowDist, ignore);
    if (shadowed(shadowRay, 0.0, shadowDist)) {
        return Radiance3(0.0);
    }
    
	Color3 p_L, p_G;
	float glossyExponent;
	computeReflectivities(surfel.material, p_L, p_G, glossyExponent);

	// Compute the light contribution from the directional source
	Vector3 w_h = normalize(w_i + w_o);
	return cos_i * B_i * 
		// Lambertian
		(p_L * (1.0 / pi) + 

		// Glossy
        pow(max(0.0, dot(n, w_h)), glossyExponent) * p_G * (glossyExponent + 8.0) / (14.0 * pi));
}


/** Returns true if the world-space ray hits the planet */
bool renderPlanet(Ray eyeRay, float minDistanceToPlanet, float maxDistanceToPlanet, inout Radiance3 L_o, inout Point3 hitPoint) {    
    Surfel surfel;
    
    if (intersectScene(eyeRay, minDistanceToPlanet, maxDistanceToPlanet, surfel)) {
        // Render the planet
        Radiance3 L_directOut = shade(surfel, w_i, -eyeRay.direction, B_i);

        // Clouds vary fairly slowly in elevation, so we can just measure at the
        // surface as an estimate of the density above the surface
        float cloudShadow = pow4(1.0 - clamp(cloudDensity(surfel.position, time), 0.0, 1.0));
        
        // "Ambient"
        Irradiance3 E_indirectIn = max(Irradiance3(0), Irradiance3(0.4) - 0.4 * Irradiance3(surfel.normal.yxx)); 
        Radiance3 L_indirectOut = 
            mix(E_indirectIn * surfel.material.color,
                mix(Color3(1.0), surfel.material.color, surfel.material.metal) * texture(iChannel0, reflect(w_i, surfel.normal).xy).rgb * 2.7, surfel.material.smoothness) * (1.0 / pi);
        
        hitPoint = surfel.position;
        L_o = (L_directOut + L_indirectOut) * cloudShadow;

        if (debugMaterials) {
            L_o = surfel.material.color;
        }
            
        return true;
    } else {
        // Missed the bounding sphere or final ray-march
        return false;
    }    
}



void mainImage(out vec4 fragColor, in vec2 fragCoord) {
	// Rotate over time
	float yaw   = -((iMouse.x / iResolution.x) * 2.5 - 1.25) + (autoRotate ? -time * 0.015 : 0.0);
	float pitch = ((iMouse.y > 0.0 ? iMouse.y : iResolution.y * 0.3) / iResolution.y) * 2.5 - 1.25;
 	planetRotation = 
    	mat3(cos(yaw), 0, -sin(yaw), 0, 1, 0, sin(yaw), 0, cos(yaw)) *
    	mat3(1, 0, 0, 0, cos(pitch), sin(pitch), 0, -sin(pitch), cos(pitch));

    
    Vector2 invResolution = 1.0 / iResolution.xy;
	
	// Outgoing light
	Radiance3 L_o;
	
	Surfel surfel;	
	
	Ray eyeRay = Ray(Point3(0.0, 0.0, 5.0), normalize(Vector3(fragCoord.xy - iResolution.xy / 2.0, iResolution.y / (-2.0 * tan(verticalFieldOfView / 2.0)))));
	    
    Point3 hitPoint;    
    float minDistanceToPlanet, maxDistanceToPlanet;
        
    bool hitBounds = (showClouds || showPlanet) && intersectSphere(planetCenter, planetMaxRadius, eyeRay, minDistanceToPlanet, maxDistanceToPlanet);

    Color3 shadowedAtmosphere = shadowedAtmosphereColor(fragCoord, iResolution, 0.5);
    
    if (hitBounds && renderPlanet(eyeRay, minDistanceToPlanet, maxDistanceToPlanet, L_o, hitPoint)) {
        // Tint planet with atmospheric scattering
        L_o = mix(L_o, shadowedAtmosphere, min(0.8, square(1.0 - (hitPoint.z - planetCenter.z) * (1.0 / planetMaxRadius))));
        // Update distance
        maxDistanceToPlanet = min(maxDistanceToPlanet, dot(eyeRay.direction, hitPoint - eyeRay.origin));
    } else if (showBackground) {
        // Background starfield
        float galaxyClump = (pow(noise(fragCoord.xy * (30.0 * invResolution.x)), 3.0) * 0.5 +
            pow(noise(100.0 + fragCoord.xy * (15.0 * invResolution.x)), 5.0)) / 1.5;
        L_o = Color3(galaxyClump * pow(hash(fragCoord.xy), 1500.0) * 80.0);
        
        // Color stars
        L_o.r *= sqrt(noise(fragCoord.xy) * 1.2);
        L_o.g *= sqrt(noise(fragCoord.xy * 4.0));
        
        // Twinkle
        L_o *= noise(time * 0.5 + fragCoord.yx * 10.0);
        vec2 delta = (fragCoord.xy - iResolution.xy * 0.5) * invResolution.y * 1.1;
        float atmosphereRadialAttenuation = min(1.0, 0.06 * pow8(max(0.0, 1.0 - (length(delta) - 0.9) / 0.9)));
        
        // Gradient around planet
        float radialNoise = mix(1.0, noise(normalize(delta) * 40.0 + iTime * 0.5), 0.14);
        L_o += radialNoise * atmosphereRadialAttenuation * shadowedAtmosphere;
    }   
        
	fragColor.xyz = L_o;
    fragColor.a   = maxDistanceToPlanet;
}

`;

let buffB = `
// Cloud ray-march shader
// by Morgan McGuire, @CasualEffects, http://casual-effects.com


/** Computes the contribution of the clouds on [minDist, maxDist] along eyeRay towards net radiance 
    and composites it over background */
Radiance4 renderClouds(Ray eyeRay, float minDist, float maxDist, Color3 shadowedAtmosphere) {    
    const int    maxSteps = 80;
    const float  stepSize = 0.012;
    const Color3 cloudColor = Color3(0.95);
    const Radiance3 ambient = Color3(0.9, 1.0, 1.0);

    // The planet should shadow clouds on the "bottom"...but apply wrap shading to this term and add ambient
    float planetShadow = clamp(0.4 + dot(w_i, normalize(eyeRay.origin + eyeRay.direction * minDist)), 0.25, 1.0);

    Radiance4 result = Radiance4(0.0);
    
    // March towards the eye, since we wish to accumulate shading.
    float t = maxDist;
    for (int i = 0; i < maxSteps; ++i) {
        if (t > minDist) {
            Point3 X = ((eyeRay.direction * t + eyeRay.origin) - planetCenter) * (1.0 / planetMaxRadius);
            // Sample the clouds at X
            float density = cloudDensity(X, time);
            
            if (density > 0.0) {

                // Shade cloud
                // Use a directional derivative http://www.iquilezles.org/www/articles/derivative/derivative.htm
                // for efficiency in computing a directional term             
                const float eps = stepSize;
                float wrapShading = clamp(-(cloudDensity(X + w_i * eps, time) - density) * (1.0 / eps), -1.0, 1.0) * 0.5 + 0.5;

                // Darken the portion of the cloud facing towards the planet
                float AO = pow8((dot(X, X) - 0.5) * 2.0);
                Radiance3 L_o = cloudColor * (B_i * planetShadow * wrapShading * mix(1.0, AO, 0.5) + ambient * AO);
                
                // Atmosphere tinting
		        L_o = mix(L_o, shadowedAtmosphere, min(0.5, square(max(0.0, 1.0 - X.z))));

                // Fade in at the elevation edges of the cloud layer (do this *after* using density for derivative)
                density *= square(1.0 - abs(2.0 * length(X - planetCenter) - (cloudMinRadius + planetMaxRadius)) * (1.0 / (planetMaxRadius - cloudMinRadius)));
                
                // Composite over result as premultiplied radiance
                result = mix(result, Radiance4(L_o, 1.0), density);
                
                // Step more slowly through empty space
	            t += stepSize * 2.0;
            } 
            
            t -= stepSize * 3.0;
        } else {
            return result;
        }
    }
    
    return result;
}


void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    fragColor = vec4(0.0);
    
    // Run at 1/3 resolution
    fragCoord.xy = (fragCoord.xy - 0.5) * 3.0 + 0.5;
    if ((fragCoord.x > iResolution.x) || (fragCoord.y > iResolution.y)) { return; }
    
    Ray eyeRay = Ray(Point3(0.0, 0.0, 5.0), normalize(Vector3(fragCoord.xy - iResolution.xy / 2.0, iResolution.y / (-2.0 * tan(verticalFieldOfView / 2.0)))));

    float minDistanceToPlanet, maxDistanceToPlanet;
    if (showClouds && intersectSphere(planetCenter, planetMaxRadius, eyeRay, minDistanceToPlanet, maxDistanceToPlanet)) {
        // This ray hits the cloud layer, so ray march the clouds
        
        // Find the hit point on the planet or back of cloud sphere and override
        // the analytic max distance with it.
    	maxDistanceToPlanet = texture(iChannel1, fragCoord.xy / iResolution.xy).a;
        
        Color3 shadowedAtmosphere = 1.1 * shadowedAtmosphereColor(fragCoord, iResolution, 0.08);
        fragColor = renderClouds(eyeRay, minDistanceToPlanet, maxDistanceToPlanet, shadowedAtmosphere);   
    }
    fragColor.a = 1.;
}
`;

let buffC = `
// Composite and temporal blur shader
// by Morgan McGuire, @CasualEffects, http://casual-effects.com

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float mouseDeltaX = iMouse.x - texture(iChannel2, vec2(0, 0)).a; 
    
    // Increase blur constants when small because the screen-space derivatives
    // will be unstable at that scale. Both are on [0, 1]
    float hysteresis    = (abs(mouseDeltaX) > 1.0) ? 0.05 : 
        (iResolution.x > 800.0) ? 0.8 : 0.9;
    float spatialBlur   = (iResolution.x > 900.0) ? 0.70 : 0.90;

    vec2 invResolution = 1.0 / iResolution.xy;
    vec3 planet = texture(iChannel1, (fragCoord.xy + spatialBlur * 0.5) * invResolution).rgb;
    // Upsample clouds from 1/2 resolution
    vec4 clouds = texture(iChannel2, ((fragCoord.xy - 0.5) / 3.0 + 0.5) * invResolution);
    clouds = vec4(0);
    vec3 dst    = texture(iChannel3, fragCoord.xy * invResolution).rgb;
    
	// Hide clouds
   	// clouds = vec4(0.0); hysteresis = 0.0;
    
    if (! showPlanet) { planet *= 0.0; }
    
	fragColor.rgb = mix(planet * (1.0 - clouds.a) + clouds.rgb, dst, hysteresis);

    // Save the old mouse position. Most users only rotate horizontally, so save
    // a texture fetch on read by not storing the y component.
    fragColor.a   = iMouse.x;   
}

`;

let fragment = `
// Bloom shader
// by Morgan McGuire, @CasualEffects, http://casual-effects.com

float square(int x) { return float(x * x); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    const int   blurRadius    = 5;
    const float blurVariance  = 0.1 * float(blurRadius * blurRadius);    
    vec2        invResolution = 1.0 / iResolution.xy;
    
    // Center tap
    vec4 sum = vec4(texture(iChannel3, fragCoord.xy * invResolution).rgb * 13.0, 13.0);
    
    for (int dx = -blurRadius; dx < blurRadius; dx += 2) {
        for (int dy = -blurRadius; dy < blurRadius; dy += 2) {
            // Bilinear taps at pixel corners
	        vec3 src = texture(iChannel3, (fragCoord.xy + vec2(dx, dy) + 0.5) * invResolution).rgb;
            float weight = exp2(-(square(dx) + square(dy)) / blurVariance);
            sum += vec4(src, 1.0) * weight;
        }
    }
    
	fragColor.xyz = pow(sum.rgb / sum.a, Color3(0.65));  
  fragColor.a = 1.;  
}

`;

fragment = common + fragment;
buffA = common + buffA;
buffB = common + buffB;
buffC = common + buffC;

export default class implements iSub {
  key(): string {
    return 'lt3XDM';
  }
  name(): string {
    return 'Tiny Planet: Earth';
  }
  sort() {
    return 481;
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
      webglUtils.TEXTURE2, //
      { type: 1, f: buffA, fi: 1 },
      { type: 1, f: buffB, fi: 2 },
      { type: 1, f: buffC, fi: 3 },
    ];
  }
}
