import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.14159

// Minimum dot product value
const float minDot = 1e-3;

// Clamped dot product
float dot_c(vec3 a, vec3 b){
	return max(dot(a, b), minDot);
}

float saturate(float x){
	return clamp(x, 0.0, 1.0);
}

// Variable iterator initializer to stop loop unrolling
#define ZERO (min(iFrame,0))

const int MAX_STEPS = 50;
const float MIN_DIST = 0.01;
const float MAX_DIST = 5.0;
const float EPSILON = 1e-4;
const float DETAIL_EPSILON = 2e-3;
const float SHADOW_SHARPNESS = 2.0;
const float DETAIL_HEIGHT = 0.25;
const vec3 DETAIL_SCALE = vec3(1.0);
const vec3 BLENDING_SHARPNESS = vec3(8.0);

// The height where low and high frequency texturing switch. 
// The border between the magma and the rock on the upper body.
const float TRANSITION = 0.35;

// Comment out for simple lighting and potentially better performance
#define PBR

const vec3 skyColour = 0.025 * vec3(0.09, 0.33, 0.81);

// Azimuth
const float sunLocation = -1.2;
const float sunHeight = 0.75;

vec3 getSkyColour(vec3 rayDir){
    return skyColour + mix(vec3(0.015,0,0), vec3(0), rayDir.y);
}

float getGlow(float dist, float radius, float intensity){
    return pow(radius/dist, intensity);
}

vec3 rayDirection(float fieldOfView, vec2 fragCoord) {
    vec2 xy = fragCoord - iResolution.xy / 2.0;
    float z = (0.5 * iResolution.y) / tan(radians(fieldOfView) / 2.0);
    return normalize(vec3(xy, -z));
}

// https://www.geertarien.com/blog/2017/07/30/breakdown-of-the-lookAt-function-in-OpenGL/
mat3 lookAt(vec3 camera, vec3 at, vec3 up){
  vec3 zaxis = normalize(at-camera);    
  vec3 xaxis = normalize(cross(zaxis, up));
  vec3 yaxis = cross(xaxis, zaxis);

  return mat3(xaxis, yaxis, -zaxis);
}

//-------------------------------- Rotations --------------------------------

vec3 rotate(vec3 p, vec4 q){
  return 2.0 * cross(q.xyz, p * q.w + cross(q.xyz, p)) + p;
}
vec3 rotateX(vec3 p, float angle){
    return rotate(p, vec4(sin(angle/2.0), 0.0, 0.0, cos(angle/2.0)));
}
vec3 rotateY(vec3 p, float angle){
	return rotate(p, vec4(0.0, sin(angle/2.0), 0.0, cos(angle/2.0)));
}
vec3 rotateZ(vec3 p, float angle){
	return rotate(p, vec4(0.0, 0.0, sin(angle), cos(angle)));
}


//---------------------------- Distance functions ----------------------------

// Distance functions and operators from:
// https://iquilezles.org/www/articles/distfunctions/distfunctions.htm

float displacement(vec3 p){
    return sin(p.x)*sin(p.y)*sin(p.z);
}

float opDisplace(vec3 p){
    vec3 offset = 0.1*iTime * normalize(vec3(1.0, 1.0, 0.1));
    return displacement(15.0*(p+offset));
}

vec4 opElongate( in vec3 p, in vec3 h ){ 
    vec3 q = abs(p)-h;
    return vec4( max(q,0.0), min(max(q.x,max(q.y,q.z)),0.0) );
}

float opSmoothSub( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h); }

float sphereSDF(vec3 p, float radius) {
    return length(p) - radius;
}

float sdRoundCone( vec3 p, float r1, float r2, float h ){
  vec2 q = vec2( length(p.xz), p.y );
    
  float b = (r1-r2)/h;
  float a = sqrt(1.0-b*b);
  float k = dot(q,vec2(-b,a));
    
  if( k < 0.0 ) return length(q) - r1;
  if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
        
  return dot(q, vec2(a,b) ) - r1;
}

// https://www.iquilezles.org/www/articles/smin/smin.htm
float smoothMin(float a, float b, float k){
    float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

float getSDF(vec3 p){
    p.y -= 0.4;
    float dist = 1e5;
    vec3 q = p;
    
    // Upper body
    // Two round cones for chest and shoulders
    q.z = abs(q.z);
    q = rotateX(q, -1.7);
    
    dist = smoothMin(dist, sdRoundCone(q, 0.6, 0.45, 0.5), 0.5);
    
    // Neck
    q = p;
    q.y -= 0.1;
    q.x += 0.05;
    q = rotateZ(q, 0.65);
    dist = smoothMin(dist, sdRoundCone(q, 0.45, 0.2, 0.75), 0.1);
    
    // Head
    q = p;
    q.y -= 0.4;
    q.x -= 0.75;
    
    // Make a round box by elongating a sphere
    float distHead = sphereSDF(opElongate(q, vec3(0.1, 0.22, 0.3)).xyz, 0.05);
    
    // Subtract two smooth spheres from either side of the head for a skull-like look
    q.z = abs(q.z);
    q.z -= 0.4;
    q.y += 0.4;
    float distSphere = sphereSDF(q, 0.3);
    
    distHead = opSmoothSub(distSphere, distHead, 0.1);
    
    dist = smoothMin(dist, distHead, 0.1);
    
    // Lower body
    q = rotateX(p, PI);
    q.y -= 0.15;
    q.x += 0.05;
    dist = smoothMin(dist, sdRoundCone(q, 0.55, 0.25, 1.2), 0.15);
     
    // Arms
    q = p;
    q.z = abs(q.z);
    q.z -= 0.7;
    q.y += 0.1;
    q = rotateZ(q, -1.7);
    q = rotateX(q, -0.2);
    dist = smoothMin(dist, sdRoundCone(q, 0.3, 0.2, 0.6), 0.15);
    
    // Forearms
    q = p;
    q.z = abs(q.z);
    q.z -= 0.825;
    q.y += 0.7;
    q.x -= 0.2;
    q = rotateZ(q, -2.);
    dist = smoothMin(dist, sdRoundCone(q, 0.2, 0.15, 0.4), 0.05);
    
    // Fists
    q = p;
    q.z = abs(q.z);
    q.z -= 0.77;
    q.y += 0.95;
    q.x -= 0.7;
    q = rotateZ(q, PI*0.56);
    dist = smoothMin(dist, sdRoundCone(q, 0.16, 0.1, 0.15), 0.15);
    
    // Lava droplets
    q = p;
    q.y += 1.9;
    q.x += 0.06;
    q.z -= 0.05;
    dist = smoothMin(dist, sdRoundCone(q, 0.02, 0.01, 0.5), 0.15);
    

    q = p;
    q.y += 1.7;
    q.xz -= 0.1;
    dist = smoothMin(dist, sdRoundCone(q, 0.02, 0.01, 0.5), 0.15);
   
    q = p;
    q.z -= 0.77;
    q.y += 1.4;
    q.x -= 0.65;
   
    dist = smoothMin(dist, sdRoundCone(q, 0.02, 0.01, 0.25), 0.1); 
   
    // Displace the surface for larger waves
    // Add more displacement lower down
    float strength = mix(0.0, 0.025, smoothstep(TRANSITION, TRANSITION-0.1, p.y+0.4));
    dist -= strength * (0.5+0.5*opDisplace(p));
   
    return dist;
}

float distanceToScene(vec3 cameraPos, vec3 rayDir, float start, float end, out float glow){
	
    // Start at a predefined distance from the camera in the ray direction
    float depth = start;
    
    // Variable that tracks the distance to the scene at the current ray endpoint
    float dist;
    
    // For a set number of steps
    for (int i = ZERO; i < MAX_STEPS; i++) {
        
        // Get the sdf value at the ray endpoint, giving the maximum 
        // safe distance we can travel in any direction without hitting a surface
        dist = getSDF(cameraPos + depth * rayDir);
        glow += getGlow(dist, 1e-3, 0.6);
        
        // If it is small enough, we have hit a surface
        // Return the depth that the ray travelled through the scene
        if (dist < EPSILON){
            return depth;
        }
        
        // Else, march the ray by the sdf value
        depth += dist;
        
        // Test if we have left the scene
        if (depth >= end){
            return end;
        }
    }

    return depth;
}


//----------------------------- Texture distortion -----------------------------

// Find the local gradients in the X and Y directions which we use as the velocities 
// of the texure distortion
vec2 getGradient(vec2 uv){

    float scale = 0.1;
    float delta = 1e-1;
    
    uv *= scale;
    
    float data = texture(iChannel2, uv).r;
    float gradX = data - texture(iChannel2, uv-vec2(delta, 0.0)).r;
    float gradY = data - texture(iChannel2, uv-vec2(0.0, delta)).r;
    
    return vec2(gradX, gradY);
}

// https://catlikecoding.com/unity/tutorials/flow/texture-distortion/
float getDistortedTexture(vec2 uv, float height){

    float strength = 0.6;
    
    // The texture is distorted in time and we switch between two texture states.
    // The transition is based on Worley noise which will shift the change of differet parts
    // for a more organic result
    float time = 0.25 * iTime + texture(iChannel2, uv).g;
   
    // Make the texture on the upper body of the elemental static and more coarse
    if(height > TRANSITION){
        time = 0.0;
        uv *= 0.2;
    }
    
    float f = fract(time);
    
    // Get the velocity at the current location
    vec2 grad = getGradient(uv);
    vec2 distortion = strength * vec2(grad.x, grad.y);
    
    distortion += smoothstep(TRANSITION, TRANSITION-0.1, height) * vec2(0, 0.03);
    
    // Get two shifted states of the texture distorted in time by the local velocity.
    // Loop the distortion from 0 -> 1 using fract(time)
    float distort1 = texture(iChannel2, uv + f * distortion).r;
    float distort2 = texture(iChannel2, 0.1 + uv + fract(time + 0.5) * distortion).r;

    // Mix between the two texture states to hide the sudden jump from 1 -> 0.
    // Modulate the value returned by the velocity to make slower regions darker in the final
    // lava render.
    return (1.0-length(grad)) * (mix(distort1, distort2, abs(1.0 - 2.0 * f)));
}

//----------------------------- Normal mapping -----------------------------

// https://tinyurl.com/y5ebd7w7
vec3 getTriplanar(vec3 position, vec3 normal, float height){
    
    // A hack to get the flow direction on the arms to be consistent
    vec2 xpos = position.zx;
    if(abs(position.z) > 0.6){
        // If position is below 0.0, flip the uv direction for downwards flow
        xpos = mix(xpos, vec2(position.z, -position.x), smoothstep(-0.0, -0.2, position.y));
    }
    vec3 xaxis = vec3(getDistortedTexture(DETAIL_SCALE.x*(position.zy), height));
    vec3 yaxis = vec3(getDistortedTexture(DETAIL_SCALE.y*(xpos), height));
    vec3 zaxis = vec3(getDistortedTexture(DETAIL_SCALE.z*(position.xy), height));
   
    vec3 blending = abs(normal);
	blending = normalize(max(blending, 0.00001));
    blending = pow(blending, BLENDING_SHARPNESS);
	float b = (blending.x + blending.y + blending.z);
	blending /= b;

    return	xaxis * blending.x + 
       		yaxis * blending.y + 
        	zaxis * blending.z;
}

// Return the position of p extruded in the normal direction by normal map
vec3 getDetailExtrusion(vec3 p, vec3 normal, float height){

    float detail = DETAIL_HEIGHT * length(getTriplanar(p, normal, height));
    
    // Increase the normal extrusion height on the upper body
    float d = 1.0 + smoothstep(TRANSITION-0.1, TRANSITION, height);
    return p + d * detail * normal;
}

// Tetrahedral normal technique with a loop to avoid inlining getSDF()
// This should improve compilation times
// https://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 getNormal(vec3 p){
    vec3 n = vec3(0.0);
    int id;
    for(int i = ZERO; i < 4; i++){
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*getSDF(p+e*EPSILON);
    }
    return normalize(n);
}

// Get orthonormal basis from surface normal
// https://graphics.pixar.com/library/OrthonormalB/paper.pdf
void pixarONB(vec3 n, out vec3 b1, out vec3 b2){
	float sign_ = sign(n.z);
	float a = -1.0 / (sign_ + n.z);
	float b = n.x * n.y * a;
	b1 = vec3(1.0 + sign_ * n.x * n.x * a, sign_ * b, -sign_ * n.x);
	b2 = vec3(b, sign_ + n.y * n.y * a, -n.y);
}

// Return the normal after applying a normal map
vec3 getDetailNormal(vec3 p, vec3 normal, float h){

    vec3 tangent;
    vec3 bitangent;
    
    // Construct orthogonal directions tangent and bitangent to sample detail gradient in
    pixarONB(normal, tangent, bitangent);
    
    tangent = normalize(tangent);
    bitangent = normalize(bitangent);

    vec3 delTangent = vec3(0);
    vec3 delBitangent = vec3(0);
    
    for(int i = ZERO; i < 2; i++){
        
        //i to  s
        //0 ->  1
        //1 -> -1
        float s = 1.0 - 2.0 * float(i&1);
    
        delTangent += s * getDetailExtrusion(p + s * tangent * DETAIL_EPSILON, normal, h);
        delBitangent += s * getDetailExtrusion(p + s * bitangent * DETAIL_EPSILON, normal, h);

    }
    
    return normalize(cross(delTangent, delBitangent));
}
//------------------------------- Shadows -------------------------------

// https://www.iquilezles.org/www/articles/rmshadows/rmshadows.htm
float softShadow(vec3 pos, vec3 rayDir, float start, float end, float k ){
    float res = 1.0;
    float depth = start;
    for(int counter = ZERO; counter < 32; counter++){
        float dist = getSDF(pos + rayDir * depth);
        if( abs(dist) < EPSILON){ return 0.0; }       
        if( depth > end){ break; }
        res = min(res, k*dist/depth);
        depth += dist;
    }
    return saturate(res);
}

//--------------------------------- PBR ---------------------------------

// Trowbridge-Reitz
float distribution(vec3 n, vec3 h, float roughness){
    float a_2 = roughness*roughness;
	return a_2/(PI*pow(pow(dot_c(n, h),2.0) * (a_2 - 1.0) + 1.0, 2.0));
}

// GGX and Schlick-Beckmann
float geometry(float cosTheta, float k){
	return (cosTheta)/(cosTheta*(1.0-k)+k);
}

float smiths(vec3 n, vec3 viewDir, vec3 lightDir, float roughness){
    float k = pow(roughness + 1.0, 2.0)/8.0; 
	return geometry(dot_c(n, lightDir), k) * geometry(dot_c(n, viewDir), k);
}

// Fresnel-Schlick
vec3 fresnel(float cosTheta, vec3 F0){
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
} 

// Cook-Torrance BRDF
vec3 BRDF(vec3 p, vec3 n, vec3 viewDir, vec3 lightDir,
          vec3 albedo, vec3 F0, float roughness, float metalness){
    vec3 h = normalize(viewDir + lightDir);
    float cosTheta = dot_c(h, viewDir);
    vec3 lambertian = albedo / PI;
    float D = distribution(n, h, roughness);
    vec3 F = fresnel(cosTheta, F0);
    float G = smiths(n, viewDir, lightDir, roughness);
    
    vec3 specular =  D * F * G / max(0.0001, (4.0 * dot_c(lightDir, n) * dot_c(viewDir, n)));
    
    vec3 kD = (1.0 - F) * (1.0 - metalness);
    return kD * lambertian + specular;
}


//------------------------------- Shading -------------------------------

vec3 shadingPBR(vec3 p, vec3 n, vec3 rayDir, vec3 geoNormal){
    vec3 I = vec3(0);

    vec3 albedo = vec3(0.01);
    vec3 F0 = vec3(0.04);
    float roughness = 0.7;
    float metalness = 0.0;

    vec3 lightPosition = 100.0*normalize(vec3(cos(sunLocation), sunHeight, sin(sunLocation)));
    vec3 lightColour = vec3(5);

    vec3 vectorToLight = lightPosition - p;
   	vec3 lightDir = normalize(vectorToLight);
    vec3 radiance = lightColour;
    float shadow = softShadow(p + n * EPSILON * 2.0, lightDir, MIN_DIST,
                              length(vectorToLight), SHADOW_SHARPNESS);
                              
    I += shadow
        * BRDF(p, n, -rayDir, lightDir, albedo, F0, roughness, metalness) 
        * radiance 
        * dot_c(n, lightDir);

  
    // How much the fragment faces down
    float lava = max(dot(n, vec3(0,-1,0)), 0.0);
    // A reddish light from directly below.
	vec3 lavaLight = lava * vec3(1, 0.1, 0.01);
    
    float ambientStrength = 0.15;
    vec3 ambientColour = getSkyColour(n);
    
    // Combine light
    vec3 ambient = 0.02 * lavaLight + ambientStrength * ambientColour;
    
    return ambient + I;
}

vec3 shadingSimple(vec3 org, vec3 position, vec3 normal, vec3 rayDir){
    
    float ambientStrength = 0.15;
    float diffuseStrength = 0.025;
    float specularStrength = 0.02;
    float shininess = 8.0;
    
    vec3 ambientColour = getSkyColour(normal);
    vec3 diffuseColour = vec3(1.5);
    vec3 specularColour = vec3(1);

    vec3 lightPos = 100.0*normalize(vec3(cos(sunLocation), sunHeight, sin(sunLocation)));
    vec3 lightDirection = normalize(lightPos-position);
    
    // How much a fragment faces the light
	float diff = max(dot(normal, lightDirection), 0.0);
    
    // Colour when lit by light
	vec3 diffuse = diff * diffuseColour;
    
	vec3 halfwayDir = normalize(lightDirection - rayDir);  
	float spec = pow(max(dot(normal, halfwayDir), 0.0), shininess);

	// Colour of light sharply reflected into the camera
	vec3 specular = spec * specularColour;

	vec3 result = vec3(0.0); 
        
    float shadow = softShadow(position + normal * EPSILON * 2.0, lightDirection, MIN_DIST,
                              length(lightPos-position), SHADOW_SHARPNESS);
    
    // How much the fragment faces down
    float lava = max(dot(normal, vec3(0,-1,0)), 0.0);
    // A reddish light from directly below.
	vec3 lavaLight = lava * vec3(1, 0.2, 0.0);
    
    // Combine light
    result += 0.02 * lavaLight;

    // Light and material interaction
    result += ambientStrength * ambientColour + 
              shadow * (diffuseStrength * diffuse + specularStrength * specular);
    
    return  result;
}

// Glow from magma
vec3 getEmissive(vec3 p, vec3 n, float h){

    // The depressions in the texture where we want to have glowing magma.
    float depth = (1.0-length(getTriplanar(p, n, h)));
    
    if(h > TRANSITION){
        // Upper body has deep grooves and is mostly cooled rock
        // Modulate by distance from transition boundary to avoid abrupt cutoffs of glow
        depth = smoothstep(TRANSITION, TRANSITION+0.1, h) * pow(2.25*(depth), 3.5);
        // Add a subtle pulsating inner glow
        depth += 0.0125 * (0.5+0.5*sin( 4.0 * p.y +iTime * 4.0));
    }else{
        // Lower body has mostly low level liquid lava
        depth *= 1.4;
        // Darken lava near the transition border
        depth *= 1.0-smoothstep(TRANSITION-0.225, TRANSITION+0.1, h);
    }
    
    // Lighten lower parts
    if(h < -0.8){
        depth += 0.15*smoothstep(-0.8, -1.1, h);;
    }
    
    // For two glowing eyes, increase the emission within the vicinity of two positions
    // on the face
    vec3 eyes = vec3(0.9, 0.8, 0.15);
    float dist = smoothstep(0.05, 0.0, length(abs(p) - eyes));
    depth += dist * 0.5;
    
    depth = saturate(depth);
    
    vec3 glow = 0.2 * texture(iChannel1, vec2(depth)).rgb;
    return glow;

}


//----------------------------- Tonemapping and output ------------------------------

//https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 ACESFilm(vec3 x){
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    
	//----------------- Define a camera -----------------
    
    vec3 rayDir = rayDirection(60.0, fragCoord);

    vec3 cameraPos = texelFetch(iChannel0, ivec2(0.5, 1.5), 0).xyz;

    vec3 targetDir = -cameraPos;

    vec3 up = vec3(0.0, 1.0, 0.0);

    // Get the view matrix from the camera orientation.
    mat3 viewMatrix = lookAt(cameraPos, targetDir, up);

    // Transform the ray to point in the correct direction.
    rayDir = normalize(viewMatrix * rayDir);

    //---------------------------------------------------
	
    // Accumulate a glow along the view ray from the distance marching. Use it for a subtle
    // silhouette effect.
    float glow = 0.0;
    
    // Find the distance to where the ray stops.
    float dist = distanceToScene(cameraPos, rayDir, MIN_DIST, MAX_DIST, glow);
    
    vec3 col = vec3(0);
    
    if(dist < MAX_DIST){
        vec3 position = cameraPos + rayDir * dist;
        vec3 geoNormal = getNormal(position);

        // Avoid artefacts when trying to sample detail normals across Z-plane. Shape 
        // deformation increases the region where visible errors occur.
        if(abs(geoNormal.z) < 1e-5){
            geoNormal.z = 1e-5;
        }

        geoNormal = normalize(geoNormal);
   
        // Because the texture shifts in time, there isn't a way to smoothly transition 
        // to larger scale or slower speed regions. We therefore use a sharp border at a 
        // given height but offset the y value in the immediate region by noise. This will 
        // produce a curve instead of a line which looks better. Regions far away are not 
        // shifted.

        float height = position.y;
        vec2 uv = 0.15 * vec2(sin(position.x), cos(position.z));
        float noise = 2.0 * (texture(iChannel2, uv).r - 0.5);
        
        // Get a gradient from 0.0 to 0.3 around the transition height
        // Offset by a noise value in the range (-0.5, 0.5)
        height += (1.0-smoothstep(0.0, 0.3, length(position.y - TRANSITION))) * noise;
        
        vec3 detailNormal = normalize(getDetailNormal(position, geoNormal, height));
        
        #ifdef PBR
            col = shadingPBR(position, detailNormal, rayDir, geoNormal);
        #else
            col = shadingSimple(cameraPos, position, detailNormal, rayDir);
        #endif
        
        col += getEmissive(position, geoNormal, height);

    } else {
        col = getSkyColour(rayDir);
        col += 0.01 * glow * vec3(1.0,0.15,0.0);
    }
    
    // Uncomment to see spectrum texture
    //col = texture(iChannel1, fragCoord.xy/iResolution.xy).rgb;
    
    // Tonemapping
    col = ACESFilm(col);
    
    // Gamma
    col = pow(col, vec3(0.4545));

    fragColor = vec4(col, 1.0);
}
`;

const fc = `
// Perlin noise FBM for heightmap and Worley noise for texture fade out control.

// GLSL version of 2D periodic seamless perlin noise.
// https://github.com/g-truc/glm/blob/master/glm/gtc/noise.inl

vec4 taylorInvSqrt(vec4 r){
    return 1.79284291400159-0.85373472095314*r;
}

vec4 mod289(vec4 x){
  return x-floor(x*(1.0/289.0))*289.0;
}

vec4 permute(vec4 x){
  return mod289(((x*34.0)+1.0)*x);
}

vec2 fade(vec2 t){
  return (t * t * t) * (t * (t * 6.0 - 15.0) + 10.0);
}

float perlin(vec2 Position, vec2 rep){
    vec4 Pi = floor(vec4(Position.x, Position.y, Position.x, Position.y)) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(vec4(Position.x, Position.y, Position.x, Position.y)) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, vec4(rep.x, rep.y, rep.x, rep.y)); // To create noise with explicit period
    Pi = mod(Pi, vec4(289)); // To avoid truncation effects in permutation
    vec4 ix = vec4(Pi.x, Pi.z, Pi.x, Pi.z);
    vec4 iy = vec4(Pi.y, Pi.y, Pi.w, Pi.w);
    vec4 fx = vec4(Pf.x, Pf.z, Pf.x, Pf.z);
    vec4 fy = vec4(Pf.y, Pf.y, Pf.w, Pf.w);

    vec4 i = permute(permute(ix) + iy);

    vec4 gx = float(2) * fract(i / float(41)) - float(1);
    vec4 gy = abs(gx) - float(0.5);
    vec4 tx = floor(gx + float(0.5));
    gx = gx - tx;

    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);

    vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
    g00 *= norm.x;
    g01 *= norm.y;
    g10 *= norm.z;
    g11 *= norm.w;

    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));

    vec2 fade_xy = fade(vec2(Pf.x, Pf.y));
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return float(2.3) * n_xy;
}

float hash(float n){
	return fract(sin(n) * 43758.5453);
}

// From Shadertoy somewhere but not sure where originally.
float noise(in vec3 x){
	vec3 p = floor(x);
	vec3 f = fract(x);

	f = f*f*(3.0 - 2.0 * f);
	float n = p.x + p.y*57.0 + 113.0*p.z;
	return mix(
	mix(
       	mix(hash(n + 0.0), hash(n + 1.0), f.x),
		mix(hash(n + 57.0), hash(n + 58.0), f.x),
		f.y),
	mix(
		mix(hash(n + 113.0), hash(n + 114.0), f.x),
		mix(hash(n + 170.0), hash(n + 171.0), f.x),
		f.y),
	f.z);
}

float TILES = 1.0;

float worley(vec3 pos, float numCells){
	vec3 p = pos * numCells;
	float d = 1.0e10;
	for (int x = -1; x <= 1; x++){
		for (int y = -1; y <= 1; y++){
			for (int z = -1; z <= 1; z++){
                vec3 tp = floor(p) + vec3(x, y, z);
                tp = p - tp - noise(mod(tp, numCells / TILES));
                d = min(d, dot(tp, tp));
            }
        }
    }
	return 1.0 - clamp(d, 0.0, 1.0);
}

float fbm(vec2 pos, vec2 scale){
    float res = 0.0;
    float freq = 1.0;
    float amp = 1.0;
    float sum = 0.0;
    
    int limit = 5;
    
    for(int i = 0; i < limit; i++){ 
        float offset = float(limit-i);
        res += perlin(freq*(pos+offset), freq*scale) * amp;

        freq *= 2.0;
        amp *= 0.5;
    }
    return res/float(limit);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord ){
   
    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = vec3(0);
    
    bool resolutionChanged = texelFetch(iChannel0, ivec2(0.5, 2.5), 0).r > 0.0;
    
    if(iFrame == 0 || resolutionChanged){

        float scale = 32.0;

        // For seamless texture, UV scale has to match rep
        float noise = perlin(scale*uv, vec2(scale));
        noise = 0.5+0.5*(fbm(scale*uv, vec2(scale)));

        scale = 2.0;
        float worley = worley(scale*vec3(uv, 0.0), (scale));
        
        col = vec3(noise, worley, 0.0);
        
    }else{
        col = texelFetch(iChannel1, ivec2(fragCoord.xy), 0).rgb;
    }
    
    // Output to screen
    fragColor = vec4(col,1.0);
}
`;

const fb = `
// In C
float MAX_TEMP = 2500.0;

// The Draper point is the limit above which all solids glow with visible light
float draperPoint = 525.0;

// Given a temperature T, return the spectral radiance for wavelength lambda
float planck(float T, float wavelength){

    // Wavelength in metres
    float wlm = wavelength * 1e-9;
    
    return (3.74183e-16 / pow(wlm, 5.0)) / (exp(1.4388e-2 / (wlm * T)) - 1.0);
}

const mat3 XYZ_RGB_Matrix = (mat3(
     3.2404542,-0.9692660, 0.0556434,
    -1.5371385, 1.8760108,-0.2040259,
    -0.4985314, 0.0415560, 1.0572252
));

vec3 XYZToRGB(vec3 XYZ){
    return XYZ_RGB_Matrix * XYZ;
}

vec3 spectrumToXYZ(float T){

    // http://www.cie.co.at/technical-work/technical-resources
    vec3 standardObserver1931[] =
        vec3[] (
        vec3( 0.001368, 0.000039, 0.006450 ), // 380 nm
        vec3( 0.002236, 0.000064, 0.010550 ), // 385 nm
        vec3( 0.004243, 0.000120, 0.020050 ), // 390 nm
        vec3( 0.007650, 0.000217, 0.036210 ), // 395 nm
        vec3( 0.014310, 0.000396, 0.067850 ), // 400 nm
        vec3( 0.023190, 0.000640, 0.110200 ), // 405 nm
        vec3( 0.043510, 0.001210, 0.207400 ), // 410 nm
        vec3( 0.077630, 0.002180, 0.371300 ), // 415 nm
        vec3( 0.134380, 0.004000, 0.645600 ), // 420 nm
        vec3( 0.214770, 0.007300, 1.039050 ), // 425 nm
        vec3( 0.283900, 0.011600, 1.385600 ), // 430 nm
        vec3( 0.328500, 0.016840, 1.622960 ), // 435 nm
        vec3( 0.348280, 0.023000, 1.747060 ), // 440 nm
        vec3( 0.348060, 0.029800, 1.782600 ), // 445 nm
        vec3( 0.336200, 0.038000, 1.772110 ), // 450 nm
        vec3( 0.318700, 0.048000, 1.744100 ), // 455 nm
        vec3( 0.290800, 0.060000, 1.669200 ), // 460 nm
        vec3( 0.251100, 0.073900, 1.528100 ), // 465 nm
        vec3( 0.195360, 0.090980, 1.287640 ), // 470 nm
        vec3( 0.142100, 0.112600, 1.041900 ), // 475 nm
        vec3( 0.095640, 0.139020, 0.812950 ), // 480 nm
        vec3( 0.057950, 0.169300, 0.616200 ), // 485 nm
        vec3( 0.032010, 0.208020, 0.465180 ), // 490 nm
        vec3( 0.014700, 0.258600, 0.353300 ), // 495 nm
        vec3( 0.004900, 0.323000, 0.272000 ), // 500 nm
        vec3( 0.002400, 0.407300, 0.212300 ), // 505 nm
        vec3( 0.009300, 0.503000, 0.158200 ), // 510 nm
        vec3( 0.029100, 0.608200, 0.111700 ), // 515 nm
        vec3( 0.063270, 0.710000, 0.078250 ), // 520 nm
        vec3( 0.109600, 0.793200, 0.057250 ), // 525 nm
        vec3( 0.165500, 0.862000, 0.042160 ), // 530 nm
        vec3( 0.225750, 0.914850, 0.029840 ), // 535 nm
        vec3( 0.290400, 0.954000, 0.020300 ), // 540 nm
        vec3( 0.359700, 0.980300, 0.013400 ), // 545 nm
        vec3( 0.433450, 0.994950, 0.008750 ), // 550 nm
        vec3( 0.512050, 1.000000, 0.005750 ), // 555 nm
        vec3( 0.594500, 0.995000, 0.003900 ), // 560 nm
        vec3( 0.678400, 0.978600, 0.002750 ), // 565 nm
        vec3( 0.762100, 0.952000, 0.002100 ), // 570 nm
        vec3( 0.842500, 0.915400, 0.001800 ), // 575 nm
        vec3( 0.916300, 0.870000, 0.001650 ), // 580 nm
        vec3( 0.978600, 0.816300, 0.001400 ), // 585 nm
        vec3( 1.026300, 0.757000, 0.001100 ), // 590 nm
        vec3( 1.056700, 0.694900, 0.001000 ), // 595 nm
        vec3( 1.062200, 0.631000, 0.000800 ), // 600 nm
        vec3( 1.045600, 0.566800, 0.000600 ), // 605 nm
        vec3( 1.002600, 0.503000, 0.000340 ), // 610 nm
        vec3( 0.938400, 0.441200, 0.000240 ), // 615 nm
        vec3( 0.854450, 0.381000, 0.000190 ), // 620 nm
        vec3( 0.751400, 0.321000, 0.000100 ), // 625 nm
        vec3( 0.642400, 0.265000, 0.000050 ), // 630 nm
        vec3( 0.541900, 0.217000, 0.000030 ), // 635 nm
        vec3( 0.447900, 0.175000, 0.000020 ), // 640 nm
        vec3( 0.360800, 0.138200, 0.000010 ), // 645 nm
        vec3( 0.283500, 0.107000, 0.000000 ), // 650 nm
        vec3( 0.218700, 0.081600, 0.000000 ), // 655 nm
        vec3( 0.164900, 0.061000, 0.000000 ), // 660 nm
        vec3( 0.121200, 0.044580, 0.000000 ), // 665 nm
        vec3( 0.087400, 0.032000, 0.000000 ), // 670 nm
        vec3( 0.063600, 0.023200, 0.000000 ), // 675 nm
        vec3( 0.046770, 0.017000, 0.000000 ), // 680 nm
        vec3( 0.032900, 0.011920, 0.000000 ), // 685 nm
        vec3( 0.022700, 0.008210, 0.000000 ), // 690 nm
        vec3( 0.015840, 0.005723, 0.000000 ), // 695 nm
        vec3( 0.011359, 0.004102, 0.000000 ), // 700 nm
        vec3( 0.008111, 0.002929, 0.000000 ), // 705 nm
        vec3( 0.005790, 0.002091, 0.000000 ), // 710 nm
        vec3( 0.004109, 0.001484, 0.000000 ), // 715 nm
        vec3( 0.002899, 0.001047, 0.000000 ), // 720 nm
        vec3( 0.002049, 0.000740, 0.000000 ), // 725 nm
        vec3( 0.001440, 0.000520, 0.000000 ), // 730 nm
        vec3( 0.001000, 0.000361, 0.000000 ), // 735 nm
        vec3( 0.000690, 0.000249, 0.000000 ), // 740 nm
        vec3( 0.000476, 0.000172, 0.000000 ), // 745 nm
        vec3( 0.000332, 0.000120, 0.000000 ), // 750 nm
        vec3( 0.000235, 0.000085, 0.000000 ), // 755 nm
        vec3( 0.000166, 0.000060, 0.000000 ), // 760 nm
        vec3( 0.000117, 0.000042, 0.000000 ), // 765 nm
        vec3( 0.000083, 0.000030, 0.000000 ), // 770 nm
        vec3( 0.000059, 0.000021, 0.000000 ), // 775 nm
        vec3( 0.000042, 0.000015, 0.000000 )  // 780 nm
    );
    int size = 81;
    
    vec3 XYZ = vec3(0);
    
    for (int i = 0; i < size; i++){
    
        float radiance = planck(T, 380.0 + float(i) * 5.0);
        
        XYZ += radiance * standardObserver1931[i];
        
    }

    return XYZ;
}

vec3 constrainRGB(vec3 col){

    float w = -min(col.r, min(col.g, col.b));
    
    if (w > 0.0) {
        col += w;
    }

    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){

    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = vec3(0);
    
    bool resolutionChanged = texelFetch(iChannel0, ivec2(0.5, 2.5), 0).r > 0.0;
    
    if(iFrame == 0 || resolutionChanged){
    
        float T;

        T = 0.25 * draperPoint + uv.x * MAX_TEMP;

        // C to K
        T += 273.15;
        MAX_TEMP += 273.15;
        draperPoint += 273.15;

        col = spectrumToXYZ(T);
        
        if(iFrame == 0 || resolutionChanged){
            col = XYZToRGB(col);
        }

        col = constrainRGB(col);

        float largest = max(max(col.r, col.g), col.b);
        col /= largest > 0.0 ? largest : 1.0;

        // The Stefan–Boltzmann law gives the luminosity of a black body from its temperature
        // The amount of radiance emitted is proportional to the 4th power of the temperature
        float luminosity = 5.670374419e-8 * pow(T, 4.0);
        float minLuminosity = 5.670374419e-8 * pow(draperPoint*0.25, 4.0);
        float maxLuminosity = 5.670374419e-8 * pow(MAX_TEMP, 4.0);

        // Pretty hacky
        float EXPOSURE = 60.0;

        col *= EXPOSURE * max(0.0,(luminosity-minLuminosity) / (maxLuminosity-minLuminosity));
    
    }else{
        col = texelFetch(iChannel1, ivec2(fragCoord.xy), 0).rgb;
    }
    
    fragColor = vec4(col, 1.0);
}
`;

const fa = `
#define PI 3.14159

// Minimum dot product value
const float minDot = 1e-3;

// Clamped dot product
float dot_c(vec3 a, vec3 b){
	return max(dot(a, b), minDot);
}

float saturate(float x){
	return clamp(x, 0.0, 1.0);
}

// Track mouse movement and resolution change between frames and set camera position.

#define CAMERA_DIST 2.9

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    
    // Work with just the first four pixels.
    if((fragCoord.x == 0.5) && (fragCoord.y < 4.0)){
        
        vec4 oldMouse = texelFetch(iChannel0, ivec2(0.5), 0).xyzw;
        vec4 mouse = (iMouse / iResolution.xyxy); 
        vec4 newMouse = vec4(0);

        float mouseDownLastFrame = texelFetch(iChannel0, ivec2(0.5, 3.5), 0).x;
        
        // If mouse button is down and was down last frame
        if(iMouse.z > 0.0 && mouseDownLastFrame > 0.0){
            
            // Difference between mouse position last frame and now.
            vec2 mouseMove = mouse.xy-oldMouse.zw;
            newMouse = vec4(oldMouse.xy + vec2(5.0, 3.0)*mouseMove, mouse.xy);
        }else{
            newMouse = vec4(oldMouse.xy, mouse.xy);
        }
        newMouse.x = mod(newMouse.x, 2.0*PI);
        newMouse.y = min(0.99, max(-0.99, newMouse.y));

        // Store mouse data in the first pixel of Buffer A.
        if(fragCoord == vec2(0.5, 0.5)){
            // Set value at first frames
            if(iFrame < 5){
                newMouse = vec4(1.15, 0.2, 0.0, 0.0);
            }
            fragColor = vec4(newMouse);
        }

        // Store camera position in the second pixel of Buffer A.
        if(fragCoord == vec2(0.5, 1.5)){
            // Set camera position from mouse information.
            vec3 cameraPos = CAMERA_DIST * 
                                vec3(sin(newMouse.x), -sin(newMouse.y), -cos(newMouse.x));
                                
            fragColor = vec4(cameraPos, 1.0);
        }
        
        // Store resolution change data in the third pixel of Buffer A.
        if(fragCoord == vec2(0.5, 2.5)){
            float resolutionChangeFlag = 0.0;
            // The resolution last frame.
            vec2 oldResolution = texelFetch(iChannel0, ivec2(0.5, 2.5), 0).yz;
            
            if(iResolution.xy != oldResolution){
            	resolutionChangeFlag = 1.0;
            }
            
        	fragColor = vec4(resolutionChangeFlag, iResolution.xy, 1.0);
        }
           
        // Store whether the mouse button is down in the fourth pixel of Buffer A
        if(fragCoord == vec2(0.5, 3.5)){
            if(iMouse.z > 0.0){
            	fragColor = vec4(vec3(1.0), 1.0);
            }else{
            	fragColor = vec4(vec3(0.0), 1.0);
            }
        }
        
    }
    // fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'sdBGWh';
  }
  name(): string {
    return 'MAGMA ELEMENTAL';
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
      webglUtils.DEFAULT_NOISE,
      webglUtils.DEFAULT_NOISE,
      webglUtils.DEFAULT_NOISE,
      // { type: 1, f: fa, fi: 0 },
      // { type: 1, f: fb, fi: 1 },
      // { type: 1, f: fc, fi: 2 },
    ];
  }
}
