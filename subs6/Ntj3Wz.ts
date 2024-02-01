import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/******************************************************************************
 * constants
 */
#define MAXX 10000000.0

const float PI = 3.14159265358979323846;
const float  ONE_OVER_PI = 1.0 / PI;

// array sizes
const int NUM_SPHERES = 3;

// samples per pixel
const int NUM_SAMPLES = 1;


/******************************************************************************
 * counters
 */
// seed for random numbers 
float seed = 0.0;

/******************************************************************************
 * misc functions
 */
// background gradient color
vec3 bgColor(vec3 rayDir) {
  float u =  0.5*(1.0 + rayDir[1]);
  return u*vec3(0.7, 0.8, 0.9) + (1.0-u)*vec3(0.05, 0.05, 0.2);
}
    
// random number between 0 and 1
float random() {
  return fract(sin(seed++)*43758.5453123);
}

// square number
float sqr(float x) { return x*x; }

/******************************************************************************
 * transformations
 */
// rotate
vec3 rotate(in vec3 axis, in float angle, in vec3 v) {
  return v*cos(angle) + cross(axis, v) * sin(angle) + axis * dot(axis, v) * (1.0-cos(angle));
}

// rotation matrix
mat4 RotationMatrix(in vec3 axis, in float angle) {
  mat4 rot = mat4(1.0);
  rot[0] = vec4(rotate(axis, angle, vec3(1,0,0)), 0.0);
  rot[1] = vec4(rotate(axis, angle, vec3(0,1,0)), 0.0);
  rot[2] = vec4(rotate(axis, angle, vec3(0,0,1)), 0.0);
  return rot;
}

// affine transformation matrix (translate & scale)
mat4 TransformationMatrix(in vec3 position, in float scale) {
  mat4 M = mat4(scale);
  M[3] = vec4(position, 1);
  return M;
}


/******************************************************************************
 * brdf code
 */
// all the brdf code is from 
// https://github.com/wdas/brdf/blob/main/src/brdfs/disney.brdf
// Thanks to Brent Burley and disneyanimation.com
vec3 calc_diffuse_term(float dot_nl, float dot_nv, float dot_lh, vec3 base_color, float rough_s) {
  float fd_90_minus_1 = 2.0 * dot_lh * dot_lh * rough_s - 0.5;
  
  return base_color * ONE_OVER_PI 
    * (1.0 + fd_90_minus_1 * pow(1.0 - dot_nl, 5.0))
    * (1.0 + fd_90_minus_1 * pow(1.0 - dot_nv, 5.0));
}

// anisotropic GGX / Trowbridge-Reitz
float calc_distribution_ggx(float dot_nh, float dot_ht, float dot_hb, vec2 linear_roughness) {
  float rought_x  = linear_roughness.x * linear_roughness.x;
  float rought_y  = linear_roughness.y * linear_roughness.y;
  float rough_x_s = rought_x * rought_x;
  float rough_y_s = rought_y * rought_y;
    
  float d = (dot_nh * dot_nh
    + dot_ht * dot_ht * (1.0 / rough_x_s)
    + dot_hb * dot_hb * (1.0 / rough_y_s));
  
  return ONE_OVER_PI * (1.0 / (rought_x * rought_y * d * d));
}

vec3 calc_fresnel_schlick(vec3 f0, float dot_vn) {
  return f0 + (1.0 - f0) * pow(1.0 - dot_vn, 5.0);
}

float calc_smith_lambda(float a2, float cos_angle) {
  if (cos_angle < 0.01) return 0.0;
    
  float sin_angle = sqrt(1.0 - cos_angle * cos_angle);
  float tan_angle = sin_angle * (1.0 * cos_angle);

  return sqrt(1.0 + a2 * tan_angle * tan_angle) * 0.5 - 0.5;
}

float calc_masking_shadow_factor(float dot_nl, float dot_nv, float rought_s) {
  // smith correlated
  float a2     = rought_s * 0.5;
  float lambda_l   = calc_smith_lambda(a2, dot_nl);
  float lambda_v   = calc_smith_lambda(a2, dot_nv);
  return 1.0f / (1.0 + lambda_l + lambda_v);
}

vec3 calc_specular_term(vec3 fresnel, float dot_nl, float dot_nv, float dot_nh, float dot_lh, 
                        float dot_ht, float dot_hb, vec2 linear_roughness, float rough_s) {
  float v_1_over_denom = 1.0 / (4.0 * dot_nl * dot_nv);

  return fresnel
    * calc_distribution_ggx(dot_nh, dot_ht, dot_hb, linear_roughness)
    * calc_masking_shadow_factor(dot_nl, dot_nv, rough_s)
    * v_1_over_denom;
}

vec3 mon2lin(vec3 x) {
  return vec3(pow(x[0], 2.2), pow(x[1], 2.2), pow(x[2], 2.2));
}

/******************************************************************************
 * objects and collections
 */
struct Material {
  vec3 baseColor;      
  float metallic;      
  float subsurface;    
  float specular;      
  float roughness;     
  float specularTint;  
  float anisotropic;   
  float sheen;         
  float sheenTint;     
  float clearcoat;     
  float clearcoatGloss;
} materials[NUM_SPHERES];

// a Light is defined by a location and a color
struct Light {
  vec3 location;
  vec3 color;
} lights[1];

// Sphere is defined by a center and radius and material: color
struct Sphere {
  float radius;
  vec3 center;
  vec3 color;
} spheres[NUM_SPHERES];

// Ray is define by an origin point and a direction vector
struct Ray {
  vec3 origin;
  vec3 direction;
};

/******************************************************************************
 * intersections
 */
struct Intersection {
  int obj;
  float t;
};

// Intersection code for Ray-Sphere    
float raySphereIntersect(in Ray ray, in Sphere sphere) {
  vec3 rayToSphere = ray.origin - sphere.center;
  float b = dot(rayToSphere, ray.direction);
  float c = dot(rayToSphere, rayToSphere) - (sphere.radius * sphere.radius);
  float disc = b*b - c;
  float t;

  if (disc > 0.0) {
    t = -b - sqrt(disc);
    if (t > 0.00001) return t;

    t = -b + sqrt(disc);
    if (t > 0.00001) return t;
  }
  return MAXX;
}

// Traverses the entire scene and 
// returns the objectID and the intersection point
Intersection intersectAllObjects(Ray ray) {
  float minT = MAXX;
  int iSphere = -1;
    
  for (int i=0; i < NUM_SPHERES; i++) {
    Sphere sphere = spheres[i];
      
    float t = raySphereIntersect(ray, sphere);
        
    if (t < minT && t >= 0.001) {
      // keep track of the closest sphere and intersection
      iSphere = i;
      minT = t;
    }
  }
  
  return Intersection(iSphere, minT);
}

/******************************************************************************
 * lights, shadows, colors
 */
// convert directionToLight and directionToView to tangent space
void convertToTangentSpace(vec3 toLight, vec3 toView, vec3 hitPoint, out vec3 toLightTS, out vec3 toViewTS, out vec3 nTS) {
  // use a matrix to convert
  vec3 t = normalize(dFdx(hitPoint));
  vec3 b = normalize(dFdy(hitPoint));
  vec3 n = normalize(cross(t, b));
  mat3 xformMatrix = transpose(mat3(t, b, n));
  
  toLightTS = xformMatrix * toLight;
  toViewTS = xformMatrix * toView;
  nTS = n;
}

// Classic Perlin 3D Noise 
// by Stefan Gustavson
// see https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 

  return 2.2 * n_xyz;
}

vec3 addMyPerlinTexture1(in vec2 fragCoord, int f) {
  vec2 uv = fragCoord/iResolution.xy;

  // Displace the UV
  vec2 displacedUv = uv + cnoise(vec3(uv * 5.0, iTime * .1));

  // Perlin noise
  float strength = cnoise(vec3(displacedUv * 5.0, iTime * .2));
  
  float outerGlow = distance(uv, vec2(0.5)) * 5.0 - 1.2;
  //gl_FragColor = vec4(outerGlow, outerGlow, outerGlow, 1.0);
  
  strength += outerGlow;

  // Apply cool step
  strength += step(-0.2, strength) * .8;

  strength = clamp(strength, 0.0, 1.0);

  vec3 colorStart = vec3(0.2,0.2,.2);
  vec3 colorEnd = vec3(1.,1.,1.);

  vec3 colorMixed = mix(colorStart, colorEnd, strength);
  return colorMixed;
}

/******************************************************************************
 * the scene and main entry point
 */
// create 4 spheres at different locations in different colors
void makeScene(int f) {
  lights[0] = Light(vec3(.8, 1.0, 0.20), vec3(1, 1, 1));

  spheres[0] = Sphere(0.2, vec3(0.0, 0, -1.0), vec3(1, 1, 0));
  // spheres[1] = Sphere(0.1, vec3(-0.3, 0, -1.0), vec3(1, 1, 0));
  // spheres[2] = Sphere(0.1, vec3(0.0), vec3(1, 1, 0));

  // materials[0].baseColor = vec3(0.8, 0.6, 0.2);
  // materials[0].roughness = 0.5;

  // vec3 baseColor;      
  // float metallic;      
  // float subsurface;    
  // float specular;      
  // float roughness;     
  // float specularTint;  
  // float anisotropic;   
  // float sheen;         
  // float sheenTint;     
  // float clearcoat;     
  // float clearcoatGloss;

  // See also Blender: Principled BSDF
  materials[0].baseColor = vec3(.8, 0.0, 0.011);
  materials[0].metallic = 0.5;
  materials[0].specular = 0.5;
  materials[0].specularTint = 0.796;
  materials[0].roughness = 0.5;
  materials[0].anisotropic = 0.181;
  materials[0].sheen = 0.218;
  materials[0].sheenTint = 0.5;
  materials[0].clearcoat = .720;
  materials[0].subsurface = 1.;
  materials[0].clearcoatGloss = .161;

  float width = iResolution.x;
  float height = iResolution.y; 
  float aspectRatio = width/height;
   
  materials[0].metallic += (iMouse.x / width * aspectRatio * 2.0 - 1.0) * .1;
  materials[0].roughness += (iMouse.y / height * 2.0 - 1.0) * .1; // TODO
}

// The main entry point: This is called for every pixel on the screen 
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // fragCoord ranges from 
  //   in x: 0.5 to iResolution.x-0.5
  //   in y: 0.5 to iResolution.y-0.5
  // pixel (0,0) is at the bottom left corner
  
  makeScene(iFrame);
  
  vec3 rayOrigin = vec3(0.0, 0.0, 0.0);
  
  float screenDepth = -2.0;
  
  float width = iResolution.x;
  float height = iResolution.y; 
  float aspectRatio = width/height;
   
  vec3 samp = vec3(0, 0, 0);
  seed = 0.0;

  // position light by mouse coord 
  // lights[0].location.x = (iMouse.x / width * aspectRatio * 2.0 - 1.0);
  // lights[0].location.y = (iMouse.y / height * 2.0 - 1.0);

  float theta = 1.5*float(iFrame)/360.*PI;
  lights[0].location.xy = mat2(cos(theta), -sin(theta), sin(theta), cos(theta)) * lights[0].location.xy;

  for (int i=0; i<1*NUM_SAMPLES; i++) {
    float x = fragCoord.x + random() - 0.5;
    float y = fragCoord.y + random() - 0.5;
    
    // map (0.5, w-0.5) to (-1, 1)
    // and (0.5, h-0.5) to (-1, 1)
    x = (x/width)*2.0 - 1.0;
    y = (y/height)*2.0 - 1.0;
    
    // account for the non-square window
    y = y/aspectRatio;
              
    // normalized ray direction
    vec3 rayDirection = normalize(vec3(x, y, screenDepth));
       
    Ray ray = Ray(rayOrigin, rayDirection);
              
    // traverse the scene (all spheres) and find the 
    // closest intersected object and intersection point
    Intersection intersection = intersectAllObjects(ray);
       
    int iSphere = intersection.obj;
    float minT = intersection.t;
       
    Sphere sphere;
       
    if (iSphere > -1) { // if there is an intersection
      // to get around iSphere not being constant
      // TODO: Not entirely sure why this is needed, need to look into this.
      for (int i=0; i<NUM_SPHERES; i++) {
        if (i==iSphere) {
          sphere = spheres[i];
          break;
        }
      }
           
      // hit coordinates
      vec3 hit = ray.origin + minT*ray.direction;
      // normal at the point of ray-sphere intersection
      vec3 hitPointNormal = normalize(hit-sphere.center);         
      // vector from intersection to light
      vec3 hitPointToLight = normalize(lights[0].location-hit);
      vec3 hitPointToView = ray.origin-hit;
           
      vec3 toViewTS;
      vec3 toLightTS;
      vec3 nTS;

      convertToTangentSpace(hitPointToLight, hitPointToView, hit, toLightTS, toViewTS, nTS); 

      vec3 h_ts     = normalize(toLightTS + toViewTS);
      float dot_nl  = clamp(toLightTS.z, 0.0, 1.0);
      float dot_nv  = clamp(toViewTS.z, 0.0, 1.0);
      float dot_nh  = clamp(h_ts.z, 0.0, 1.0);
      float dot_lh  = clamp(dot(toLightTS, h_ts), 0.0, 1.0); // same as dot(v_ts, h_ts)
      float dot_ht  = h_ts.x;
      float dot_hb  = h_ts.y;

      Material m = materials[0];

      // lighting
      vec3 f0 = vec3(0.0, 0.0, 0.0); // TODO: Next Class
      vec3 fresnel  = calc_fresnel_schlick(f0, dot_nv);
      float rough_s = dot_ht * dot_ht * m.roughness * m.roughness
          + dot_hb * dot_hb * m.roughness * m.roughness; 
   
      vec3 diffuse_factor = (1.0 - fresnel) * (1.0 - m.metallic);
            
      vec3 diffuse_term = diffuse_factor * calc_diffuse_term(dot_nl, dot_nv, dot_lh, m.baseColor, rough_s);
      vec3 specular_term = vec3(0.0, 0.0, 0.0); // TODO: Next Class
           
      vec3 col = diffuse_term * dot_nl;

      col /= addMyPerlinTexture1(fragCoord, iFrame);

      vec3 toneMappedColor = col * (1.0 / (col + 1.0));
      float gamma = 1.0 / 2.2;

      vec3 finalColor = vec3(pow(toneMappedColor.x, gamma),
                             pow(toneMappedColor.y, gamma),
                             pow(toneMappedColor.z, gamma));

      samp = samp + finalColor; 
    } 
    else {
      samp = samp + bgColor(ray.direction);
    }
  }

  // average all the samples per pixel
  fragColor = vec4(samp/float(NUM_SAMPLES), 1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'Ntj3Wz';
  }
  name(): string {
    return 'Class 5 Homework BRDF (gerrit)';
  }
  sort() {
    return 640;
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
}
