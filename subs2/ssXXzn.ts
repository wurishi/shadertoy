import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
#define MAX_STEPS 50
#define MAX_STEPS_F float(MAX_STEPS)

#define FIXED_STEP_SIZE .025

#define MAX_DISTANCE 50.0
#define MIN_DISTANCE 4.0
#define EPSILON .025
#define EPSILON_MEDIUM .75
#define EPSILON_NORMAL .05

// hg_sdf
const vec3 GDFVectors[19] = vec3[19](
	vec3(1.0,.0,.0),
	vec3(.0,1.0,.0),
	vec3(.0,.0,1.0),
	vec3(.577,.577,.577),
	vec3(-.577,.577,.577),
	vec3(.577,-.577,.577),
	vec3(.577,.577,-.577),
	vec3(.0,.357,.934),
	vec3(.0,-.357,.934),
	vec3(.934,.0,.357),
	vec3(-.934,.0,.357),
	vec3(.357,.934,.0),
	vec3(-.357,.934,.0),
	vec3(.0,.851,.526),
	vec3(.0,-.851,.526),
	vec3(.526,.0,.851),
	vec3(-.526,.0,.851),
	vec3(.851,.526,.0),
	vec3(-.851,.526,.0)
);

/*
float sdf(vec3 p)
{
	float d = 0.0;
    
    p = abs(p);
    
    d = max(d, dot(p, GDFVectors[2]));
    d = max(d, dot(p, GDFVectors[3]));
    d = max(d, dot(p, GDFVectors[4]));
    d = max(d, dot(p, GDFVectors[5]));
    d = max(d, dot(p, GDFVectors[6]));
    d = max(d, dot(p, GDFVectors[7]));
    d = max(d, dot(p, GDFVectors[8]));
    d = max(d, dot(p, GDFVectors[9]));
    d = max(d, dot(p, GDFVectors[10]));    
    d = max(d, dot(p, GDFVectors[11]));
    d = max(d, dot(p, GDFVectors[12]));
    d = max(d, dot(p, GDFVectors[13]));
    d = max(d, dot(p, GDFVectors[14]));
    d = max(d, dot(p, GDFVectors[15]));
    d = max(d, dot(p, GDFVectors[16]));    
    d = max(d, dot(p, GDFVectors[17]));
    d = max(d, dot(p, GDFVectors[18]));
    
    return (d - 3.0) * 1.25;
}
*/

// ---------------------------------------------------------

struct Intersection
{
    float totalDistance;
    float mediumDistance;
    float sdf;
    float density;
    int materialID;
};
    
struct Camera
{
	vec3 origin;
    vec3 direction;
    vec3 left;
    vec3 up;
};

float sdf(vec3 p)
{
    float s = 3.;
    p = abs(p);
    float m = p.x + p.y + p.z - s;
    vec3 r = 3.0*p - m;
    
    // my original version
	vec3 q;
         if( r.x < 0.0 ) q = p.xyz;
    else if( r.y < 0.0 ) q = p.yzx;
    else if( r.z < 0.0 ) q = p.zxy;
    else return m*0.57735027;
    float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
    return length(vec3(q.x,q.y-s+k,q.z-k));    
}
    
// ---------------------------------------------------------

Intersection Raymarch(Camera camera)
{    
    Intersection outData;
    outData.sdf = 0.0;
    outData.density = 0.0;
    outData.totalDistance = MIN_DISTANCE;
        
	for(int j = 0; j < MAX_STEPS; ++j)
	{
        vec3 p = camera.origin + camera.direction * outData.totalDistance;
		outData.sdf = sdf(p);

		outData.totalDistance += outData.sdf;
                
		if(outData.sdf < EPSILON || outData.totalDistance > MAX_DISTANCE)
            break;
	}
    
    return outData;
}

Camera GetCamera(vec2 uv, float zoom)
{
    float dist = 4.0 / zoom;
    float time = 2.9 + iTime * .2;
    
    vec3 target = vec3(0.0, 1.0, 0.0);
    vec3 p = vec3(0.0, 3.5, 0.0) + vec3(cos(time), 0.0, sin(time)) * dist;
        
    vec3 forward = normalize(target - p);
    vec3 left = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(forward, left));

    Camera cam;   
    cam.origin = p;
    cam.direction = normalize(forward - left * uv.x * zoom - up * uv.y * zoom);
    cam.up = up;
    cam.left = left;
        
    return cam;
}

/*
vec3 sdfNormal(vec3 p, float epsilon)
{
    vec3 eps = vec3(epsilon, -epsilon, 0.0);
    
	float dX = sdf(p + eps.xzz) - sdf(p + eps.yzz);
	float dY = sdf(p + eps.zxz) - sdf(p + eps.zyz);
	float dZ = sdf(p + eps.zzx) - sdf(p + eps.zzy); 

	return normalize(vec3(dX,dY,dZ));
}
*/



float map( in vec3 pos )
{
    float rad = 0.1*(0.5+0.5*sin(iTime*2.0));
    return sdf(pos) - rad;
}
vec3 sdfNormal( vec3 p, float epsilon )
{
    vec2 e = vec2(1.0,-1.0)*0.5773;
    return normalize( e.xyy*map( p + e.xyy*epsilon ) + 
					  e.yyx*map( p + e.yyx*epsilon ) + 
					  e.yxy*map( p + e.yxy*epsilon ) + 
					  e.xxx*map( p + e.xxx*epsilon ) );
}
float curv(in vec3 p, in float w)
{
    vec2 e = vec2(-1., 1.) * w;
    
    float t1 = sdf(p + e.yxx), t2 = sdf(p + e.xxy);
    float t3 = sdf(p + e.xyx), t4 = sdf(p + e.yyy);
    
    return .25/e.y*(t1 + t2 + t3 + t4 - 4.0 * sdf(p));
}

vec3 triplanar(vec3 P, vec3 N)
{   
    vec3 Nb = abs(N);
    
    float b = (Nb.x + Nb.y + Nb.z);
    Nb /= vec3(b);
    
    vec3 c0 = textureLod(iChannel0, P.xy, 3.0).rgb * Nb.z;
    vec3 c1 = textureLod(iChannel0, P.yz, 3.0).rgb * Nb.x;
    vec3 c2 = textureLod(iChannel0, P.xz, 3.0).rgb * Nb.y;
    
    return c0 + c1 + c2;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (-iResolution.xy + (fragCoord*2.0)) / iResolution.y;    
    
    // Cheating here...
    if(abs(uv.y) > .75)
    {
        fragColor = vec4(0.0);
        return;
    }
    
    Camera camera = GetCamera(uv, .5);
    Intersection isect = Raymarch(camera);
    
    vec3 p = camera.origin + camera.direction * isect.totalDistance;
    
    float c = curv(p, .15);
    float longC = curv(p, .45);
    vec3 normal = sdfNormal(p, EPSILON_NORMAL);
    
    vec3 tx = triplanar(p * .75, normal) + triplanar(p * 1.5, normal) * .2;
    tx = tx * 2.0 - 1.0;
    tx *= .025 + longC * .075;
        
    
    // By feeding the curvature into the normal and distance, we ad enough weirdness to make it plausible
    if(isect.sdf < EPSILON)
        isect.totalDistance -= c * 1.5;
    
    fragColor =vec4(normalize(normal + tx - c * .25), isect.totalDistance);
}
`;

const fragment = `
#define FIXED_STEP_SIZE .0175
#define FIXED_STEPS 100

#define MAX_DISTANCE 50.0
#define MIN_DISTANCE 4.0
#define EPSILON .025
#define EPSILON_MEDIUM .75

#define MEDIUM_ETA .5757575

//  3 out, 3 in...
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}
//  1 out, 3 in...
float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float dot2(vec3 p)
{
    return dot(p, p);
}

float worley(vec3 p)
{
    float d = 10.0;
    
    vec3 n = floor(p);
    
    for(int z = -1; z <= 1; z++)
    for(int y = -1; y <= 1; y++)
    for(int x = -1; x <= 1; x++)
    {
        vec3 neighbor = n + vec3(x,y,z);
        vec3 centerPosition = neighbor + hash33(neighbor);
        
        d = min(d, dot2(centerPosition - p) + .7);
        
        if(d < 0.0)
            break;
	}

	return d;
}

float density(vec3 p)
{
   	p.xz -= worley(p * 2.342) * .2;
    p.y += .45;
    p *= .15;
    p.xz *= .75;
    float d = p.y * 1.5;
    p.y += sin(p.x * 12.0) * .05 - .05;
    p.xz += sin(p.y * 12.0) * .01 + .01;
    p.y *= .35;
    
    float edge0 = p.y * 8.0 + (sin(p.y * 1.0)  * .5 + .5) * .3;    
   	float terrain = smoothstep(edge0 + .2, edge0, texture(iChannel1, p.xz * 2.0).r) * 1.25;
    
    d += terrain;
    
    // This adds a nice rim over the terrain
    d += sin(terrain * 3.14 - .5) * 1.5; 
    d += p.y + .4;
    d -= smoothstep(.1, -.05, p.y - d * .005);    
    
	return d;
}

float terrain(vec3 p)
{
	p.xz -= worley(p * 2.342) * .2;
    p.y += .45;
    p *= .15;
    p.xz *= .75;
    p.y += sin(p.x * 12.0) * .05 - .05;
    p.xz += sin(p.y * 12.0) * .01 + .01;
    p.y *= .35;
    
    float tx = texture(iChannel1, p.xz).r + .05;    

   	float terrain = smoothstep(.3, .0, tx * .2 + texture(iChannel1, p.xz * 2.0).r * .5) * 1.5;
    return terrain;
}

// ---------------------------------------------------------

struct Intersection
{
    float totalDistance;
    float mediumDistance;
    float sdf;
    float density;
    int materialID;
};
    
struct Camera
{
	vec3 origin;
    vec3 direction;
    vec3 left;
    vec3 up;
};
    
// ---------------------------------------------------------
    
Intersection FinalizeRaymarch(Camera camera, vec4 bufA)
{    
    Intersection outData;
    outData.sdf = 0.0;
    outData.density = 0.0;
    outData.totalDistance = bufA.w;

    // INNER MEDIUM
    if(outData.totalDistance < MAX_DISTANCE)
    {
        float t = FIXED_STEP_SIZE;
        float d = 0.0;
        
        vec3 hitPosition = camera.origin + camera.direction * (outData.totalDistance + EPSILON);
        vec3 normal = bufA.xyz;
        
        float roughETA = MEDIUM_ETA + hash13(hitPosition * 44.) *.02;
        vec3 refr = refract(camera.direction, normal, roughETA);
        
        for(int i = 0; i < FIXED_STEPS; ++i)
        {            
            vec3 p = hitPosition + refr * t;
            
            // We know the size of the rock
            if(length(p) > length(hitPosition))
                break;
            
            float dd = density(p);
            d += dd;
            t += FIXED_STEP_SIZE * dd * (.9 + hash13(p * 22.2) * .3);
            
            if(dd < EPSILON_MEDIUM || t > 4.5)
                break;
        }
        
        outData.density = d;
        outData.mediumDistance = t;
    }
    
    return outData;
}

vec3 Render(Camera camera, Intersection isect, vec4 bufA, vec2 uv)
{
    vec3 p = camera.origin + camera.direction * isect.totalDistance;
    
    if(isect.totalDistance < MAX_DISTANCE)
    {        
        vec3 lPos = camera.origin - camera.left * 6.0 - camera.up * 15.0;
        vec3 normal = bufA.xyz;
        
        vec3 refl = reflect(camera.direction, normal);
        vec3 env = texture(iChannel0, refl.xy).rgb;
        
        float fresnel = smoothstep(.65, .2, -dot(normal, camera.direction));
        
        vec3 innerColor = vec3(.25, .75, 1.0);
        
        float den = max(0.0001, isect.density) * .0075;
        vec3 refr = refract(camera.direction, normal, MEDIUM_ETA);
        vec3 innerP = p + refr * isect.mediumDistance;
                
        float deposit = terrain(innerP);
        vec3 toLight = normalize(lPos - innerP);
        vec3 volumetric = innerColor * vec3(den + deposit * .375) + vec3(deposit * .2);
        
        // Smooth the interface
        volumetric *= volumetric * smoothstep(-.0, .65, isect.mediumDistance);
        
        return env * fresnel * .75 * smoothstep(-.05, .2, normal.y) + volumetric;        
    }
    
    float vignette = 1.0 - pow(length(uv) / 2., 2.0);
    return vec3(.15, .175, .25) * vignette * vignette * .5;
}


Camera GetCamera(vec2 uv, float zoom)
{
    float dist = 4.0 / zoom;
    float time = 2.9 + iTime * .2;
    
    vec3 target = vec3(0.0, 1.0, 0.0);
    vec3 p = vec3(0.0, 3.5, 0.0) + vec3(cos(time), 0.0, sin(time)) * dist;
        
    vec3 forward = normalize(target - p);
    vec3 left = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(forward, left));

    Camera cam;   
    cam.origin = p;
    cam.direction = normalize(forward - left * uv.x * zoom - up * uv.y * zoom);
    cam.up = up;
    cam.left = left;
        
    return cam;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (-iResolution.xy + (fragCoord*2.0)) / iResolution.y;    
    
    // Cheating here...
    if(abs(uv.y) > .75)
    {
        fragColor = vec4(0);
        return;
    }
    
    vec2 rawUV = fragCoord / iResolution.xy;
    vec4 bufA = texture(iChannel2, rawUV);
    
    Camera camera = GetCamera(uv, .5);
    Intersection isect = FinalizeRaymarch(camera, bufA);
    
    vec3 color = Render(camera, isect, bufA, uv);
    
    
	fragColor = vec4(color, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'ssXXzn';
  }
  name(): string {
    return 'Fork Creation S gusandr 800';
  }
  sort() {
    return 272;
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
      webglUtils.TEXTURE7,
      webglUtils.TEXTURE2, //
      { type: 1, f, fi: 2 },
    ];
  }
}
