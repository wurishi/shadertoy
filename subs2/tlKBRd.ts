import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float maxSteps = 64.;
const float hitThreshold = .002;
const float maxDistance = 1000.;

struct Sphere
{
    vec3 center;
    float radius;
};

struct Ray
{
    vec3 origin;
    vec3 dir;
};

struct Light
{
    vec3 point;
    float intensity;
    vec3 color;
    float sharpness;
};



vec3 rayToPos(Ray ray, float t)
{
    return ray.origin + ray.dir * t;
}

// Signed distance functions for different shapes

float sphereSDF(vec3 p, Sphere s)
{
    return length(p - s.center) - s.radius;
}

float raiden_sdf(vec3 p)
{
    float power = 2.;
    vec3 z = p.zxy - vec3(1, 0, 0);
    float dr = 2.;
    float r;
    
    for (int i = 0; i < 20; i++)
    {
        r = length(z);
        if (r > 2.)
        {
            break;
        }
        float theta = acos(z.z / r) * power + sin(1.618 * iTime);
        float phi = atan(z.y/z.x) * power + sin(iTime);
        float zr = pow(r, power);
        dr = pow(r, power - 1.) * power * dr + 1.;
        z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
        z += p;
    }
    return 0.5 * log(r) * r / dr;
}

// Smooth min to cause shapes to morph into eachother
float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

// Define the objects in the scene and their relations to eachother
float map(vec3 p)
{
    return raiden_sdf(p);
}

// Calculate the gradient of the world at a point
vec3 calcNormal(vec3 p)
{
    const vec3 eps = vec3(0.001, 0., 0.);
    
    float deltaX = map(p + eps.xyy) - map(p - eps.xyy);
    float deltaY = map(p + eps.yxy) - map(p - eps.yxy);
    float deltaZ = map(p + eps.yyx) - map(p - eps.yyx);
    
    return normalize(vec3(deltaX, deltaY, deltaZ));
}

//Convert a ray into a shadow scalar
float calcShadow(Ray ray, float maxT, float k)
{
    float res = 1.0;
    float ph = 1.;
    for (float t = hitThreshold * 50.; t < maxT; )
    {
        float h = map(rayToPos(ray, t));
        if (h < hitThreshold)
        {
            return 0.;
        }
        float hsqr = pow(h, 2.);
        float y = hsqr/(2. * ph);
        float d = sqrt(hsqr - pow(y, 2.));
        res = min(res, k * d / max(0., t - y));
        ph += h;
        t += h;
    }
    return res;
}

// Combine all the lights in the scene to color objects
vec3 calcLight(vec3 p, vec3 n)
{
    const int lCount = 3;
    Light[lCount] lights = Light[lCount](
        Light(vec3(0., 5., 5.), 20., vec3(1., 0., 0.), 8.),
        Light(vec3(0., -5., 5.), 3., vec3(1., 1., 0.), 8.),
        Light(vec3(5., 0., 5.), 8., vec3(1., 0., 1.), 1.)
    );
    vec3 ambient = vec3(0.6745, 0.9255, 1.0) * .1;
    
    vec3 color = vec3(0.);
    for (int i = 0; i < lCount; i++)
    {
        vec3 ldir = lights[i].point - p;
        float lmag = length(ldir); 
        ldir /= lmag;

        Ray r = Ray(p, ldir);

        float shadow = calcShadow(r, lmag, lights[i].sharpness);

        float strength = shadow * lights[i].intensity * (1./pow(lmag, 2.));
        color += strength * lights[i].color * max(0., dot(ldir, n));
    }
    
    return ambient + color;
}

// Convert Pixel Rays to Colors
vec3 marchRay(Ray ray, out float criticalT, out float steps)
{   
    float t = 0.;
    float i = 0.;
    float closestT;
    criticalT = closestT;

    while (i < maxSteps)
    {
        steps = i;
        vec3 pos = rayToPos(ray, t);
        closestT = map(pos);

        if (closestT <= criticalT) 
            criticalT = closestT;
        
        if (closestT < hitThreshold)
        {
            vec3 normal = calcNormal(pos);
            vec3 color = calcLight(pos, normal);
            criticalT = 0.;
            return color;
        }
        
        if (t > maxDistance) {
            criticalT = t;
            break;
        }

        t += closestT;
        i += 1.;
    }
    return vec3(0.01, 0.02, 0.03);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Convert pixel coordinates to uv coordinates
    vec2 uv = fragCoord/iResolution.xy * 2. - 1.;
    uv.y *= iResolution.y/iResolution.x;
    
    // Define Camera
    vec3 viewpoint = vec3(0., 0., 0.);
    vec3 e = vec3(0., 0., 5.);
    
    // Construct camera Matrix
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 w = -normalize(viewpoint - e);
    vec3 u = cross(w, up);
    vec3 v = normalize(cross(u, w));
    
    mat4 view = mat4(
        u, 0.0,
        v, 0.0,
        w, 0.0,
        e, 1.0
    );
    
    // Create viewing rays and get colors from them
    vec3 p = (view * vec4(uv, -1., 1.)).xyz;
    Ray viewRay = Ray(e, normalize(p - e));

    float minT;
    float steps;
    vec3 color = marchRay(viewRay, minT, steps);

    // color = pow(color, vec3(0.45));

    vec3 glow = vec3(0.8902, 1.0, 0.9961) * .5;

    if (minT == 0. || minT > maxDistance)
        color += glow * 0.4 * smoothstep(0.,1., steps/(2.*maxSteps));

    fragColor = vec4(color ,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'tlKBRd';
  }
  name(): string {
    return 'raymarching';
  }
  sort() {
    return 201;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return ['raymarching'];
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
