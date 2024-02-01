import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define ENABLE_REFLECTIONS
//#define ENABLE_SHADOWS

#define MATERIAL_FLOOR 0
#define MATERIAL_WALL 1
#define MATERIAL_CARPET 2
#define MATERIAL_PICTURE_FIRST 3
#define PICTURE_COUNT 9

mat3 xrotate(float t) {
	return mat3(1.0, 0.0, 0.0,
                0.0, cos(t), -sin(t),
                0.0, sin(t), cos(t));
}

mat3 yrotate(float t) {
	return mat3(cos(t), 0.0, -sin(t),
                0.0, 1.0, 0.0,
                sin(t), 0.0, cos(t));
}

mat3 zrotate(float t) {
    return mat3(cos(t), -sin(t), 0.0,
                sin(t), cos(t), 0.0,
                0.0, 0.0, 1.0);
}

vec4 planeDistance(vec3 pos, vec3 center, vec3 normal) {
    vec3 delta = pos - center;
    float dist = dot(delta, normal);
    vec3 surface = pos - normal * dist;
    return vec4(surface, dist);
}

vec3 rectDistance(vec3 pos, vec3 center, vec3 normal, float size) {
    vec3 up = vec3(0.0, 1.0, 0.0);
    if (abs(dot(up, normal)) > 0.9) {
        up = vec3(0.0, 0.0, 1.0);
    }
    vec3 left = normalize(cross(up, normal));
    up = normalize(cross(normal, left));
    
    vec3 localPos = pos - center;
    
	float u = clamp(dot(localPos, up), -size, size);
    float v = clamp(dot(localPos, left), -size, size);
    
    vec3 clampPos = center + up * u + left * v;
    
    return vec3(length(clampPos - pos), v/size, u/size);
}

float boxDistance(vec3 pos, vec3 center, vec3 scale) {
    vec3 localPos = pos - center;
    vec3 boxPos = clamp(localPos, -scale*0.5, scale*0.5);
    return length(pos - boxPos - center);
}

vec2 segDistance(vec3 pos, vec3 start, vec3 end, float radius) {
    // thanks to iq
    vec3 a = pos - start;
    vec3 b = end - start;
   	float prod = dot(a, b);
    float norm = prod / dot(b,b);
    norm = clamp(norm, 0.0, 1.0);
    vec3 segPos = start * (1.0 - norm) + end * norm;
    return vec2(length(pos - segPos) - radius, norm);
}

mat3 combinedDistance(vec3 pos) {
	float dist;
    float material;
    vec3 shadingParameters;
   
    vec4 ground = planeDistance(pos, vec3(0.0,-1.0,0.0), vec3(0.0,1.0,0.0));
    dist = ground.w;
    material = float(MATERIAL_FLOOR);
    shadingParameters.xy = ground.xz;
    
    float side = pos.x < 0.0 ? 1.0 : -1.0;
    vec4 wall = planeDistance(pos, vec3(-3.0*side,0.0,0.0), vec3(1.0*side,0.0,0.0));
    if (wall.w < dist) {
        dist = wall.w;
        material = float(MATERIAL_WALL);
        shadingParameters.xy = wall.zy;
    }

    float modPos = floor(pos.z/5.0+0.5);
    vec3 screen = rectDistance(pos, vec3(-2.9*side, 1.0, modPos*5.0), vec3(-1.0*side,0.0,0.0), 1.0);
    if (screen.x < dist) {
        dist = screen.x;
        float screenIndex = abs(modPos) + side;
        material = floor(mod(screenIndex, float(PICTURE_COUNT)));
        material += float(MATERIAL_PICTURE_FIRST);
        shadingParameters.xy = screen.yz;
    }

    vec3 frame = rectDistance(pos, vec3(-2.95*side, 1.0, modPos*5.0), vec3(-1.0*side,0.0,0.0), 1.2);
    if (frame.x < dist) {
        dist = frame.x;
        material = float(MATERIAL_FLOOR);
        shadingParameters.xy = frame.yz;
    }

    float timberHeight = 10.0;
    float modTimberPos = floor(pos.z/10.0+0.5);
    float timber = boxDistance(pos, vec3(-3.0*side,0.0,2.5+modTimberPos*10.0), vec3(1.0, timberHeight, 0.5));
    if (timber < dist) {
        dist = timber;
        material = float(MATERIAL_FLOOR);
    }
    
    float timberHigh = boxDistance(pos, vec3(-3.0*side,timberHeight/2.0,pos.z), vec3(1.0, 1.0, 0.5));
    if (timberHigh < dist) {
        dist = timberHigh;
        material = float(MATERIAL_FLOOR);
    }
    
    vec3 carpet = rectDistance(pos, vec3(0.0, -0.99, pos.z), vec3(0.0, -1.0, 0.0), 1.0);
    if (carpet.x < dist) {
        dist = carpet.x;
        material = float(MATERIAL_CARPET);
    }
                      
    return mat3(dist, material, 0.0,
                shadingParameters.x, shadingParameters.y, shadingParameters.z,
                0.0, 0.0, 0.0);
}

float combinedDistanceOnly(vec3 pos) {
	mat3 d = combinedDistance(pos);
    return d[0].x;
}

vec3 surfaceNormal(vec3 pos) {
 	vec3 delta = vec3(0.01, 0.0, 0.0);
    vec3 normal;
    normal.x = combinedDistanceOnly(pos + delta.xyz) - combinedDistanceOnly(pos - delta.xyz);
    normal.y = combinedDistanceOnly(pos + delta.yxz) - combinedDistanceOnly(pos - delta.yxz);
    normal.z = combinedDistanceOnly(pos + delta.zyx) - combinedDistanceOnly(pos - delta.zyx);
    return normalize(normal);
}

float ambientOcclusion(vec3 origin, vec3 ray) {
    float delta = 0.1;
    const int samples = 6;
    float r = 0.0;
    for (int i = 1; i <= samples; ++i) {
        float t = delta * float(i);
     	vec3 pos = origin + ray * t;
        mat3 d = combinedDistance(pos);
        float dist = d[0].x;
        float len = abs(t - dist);
        r += len * pow(2.0, -float(i));
    }
    return r;
}

mat3 trace(vec3 origin, vec3 ray, float far) {
	float t = 0.0;
    float m = -1.0;
    float s = 1.0;
    vec3 shadingParameters;
    for (int i = 0; i < 64; ++i) {
        
        vec3 pos = origin + ray * t;
        
		mat3 r = combinedDistance(pos);
        
        vec3 d = r[0];
        shadingParameters = r[1];
        
        if (abs(d.x) < 0.001) {
       		m = d.y;
            break;
        }
        
        m = d.y;
     	t += abs(d.x) * 0.5;
        
        if (t >= far) {
         	m = -1.0;
            break;
        }
        
        if (abs(d.x) > 0.1) {
        	s = min(s, abs(d.x)/t);
        }
    }
    return mat3(t, m, s, /* distance, material, shadow blend */
               	shadingParameters.x, shadingParameters.y, shadingParameters.z,
                0.0, 0.0, 0.0);
}

float prngNext(inout float state) {
    // http://obge.paradice-insight.us/wiki/Includes_%28Effects%29
    vec2 uv = vec2(state, state*2.0);
    state += 0.01;
	float noise = (fract(sin(dot(uv ,vec2(12.9898,78.233)*2.0)) * 43758.5453));
	return noise;
}

vec3 starfield(vec2 uv) {
    float r = 0.0;
    float prng = 1.0;
    for (int i = 0; i < 64; ++i) {
        vec3 starPos = vec3(prngNext(prng),prngNext(prng),prngNext(prng));
        starPos.xy = (starPos.xy * 2.0 - 1.0) * 8.0;
        float maxDepth = 5.0;
        starPos.z = fract(starPos.z - iTime * 0.3) * maxDepth;
        if (starPos.z < 0.0)  continue;
        starPos.xy /= (starPos.z + 1.0) * 3.0;
        vec2 delta = uv - starPos.xy;
        float len = dot(delta, delta);
        starPos.z /= maxDepth;
        float fade = (1.0 - starPos.z) * starPos.z;
        float shine = 1.0 / (1.0 * len * 500.0);
        r += shine * fade;
        r = min(r, 1.0);

    }
    return vec3(r, r, r);
}

vec3 plasma(vec2 uv) {
	vec2 center = uv - vec2(cos(iTime), sin(iTime));
    float len = length(center);
    float shade0 = sin(len * 10.0 + iTime) * 0.5 + 0.5;
    
    float theta = iTime * -1.0;
    float phi = uv.x * sin(theta) + uv.y * cos(theta*2.0);
    float shade1 = sin(phi * 10.0 + iTime);
    
    float shade2 = sin(uv.x * 10.0 + iTime * 2.0);
    
    float r = (shade0 + shade1 + shade2) / 3.0;
    
    return vec3(cos(r*3.14), sin(r*3.14), 0.0) * 0.5 + 0.5;
}

vec3 planeZoom(vec2 uv) {
    vec3 origin = vec3(0.0, 0.0, iTime * 5.0);
	vec3 ray = normalize(vec3(uv, 1.0)) * xrotate(iTime) * zrotate(iTime);
	float ta = (-1.0 - origin.y) / ray.y;
    float tb = (1.0 - origin.y) / ray.y;
    float t = max(ta, tb);
    vec3 view = origin + ray * t;
    float mat = max(sign(ta-tb), 0.0);
    vec3 tex = texture(iChannel1, view.xz * 0.01).xzy;
    vec3 diff = mix(tex.yxz, tex.zyx, mat);
    float fog = 1.0 / (1.0 + t * 0.1);
    return diff * fog;
}

float cubeRotDistance(vec3 pos) {
    vec3 center = vec3(0.0, 0.0, 0.0);
    vec3 size = vec3(1.0, 1.0, 1.0);
    pos += vec3(0.0,0.0,-1.5);
    pos *= yrotate(iTime) * zrotate(iTime);
	return boxDistance(pos, center, size);
}

vec3 cubeRot(vec2 uv) {
	vec3 ray = normalize(vec3(uv, 1.0));
    float t = 0.0;
    for (int i = 0; i < 16; ++i) {
      	float dist = cubeRotDistance(ray * t);
		if (dist < 0.0) {
			break;   
		}
		t += dist;
    }
    vec3 pos = ray * t;
    vec3 delta = vec3(0.01, 0.0, 0.0);
    vec3 normal;
    normal.x = cubeRotDistance(pos+delta.xyz) - cubeRotDistance(pos-delta.xyz);
    normal.y = cubeRotDistance(pos+delta.yxz) - cubeRotDistance(pos-delta.yxz);
    normal.z = cubeRotDistance(pos+delta.zyx) - cubeRotDistance(pos-delta.zyx);
    normal = normalize(normal);
    float prod = max(dot(normal,-ray),0.0);
    float fog = 1.0 - 1.0 / (1.0 + t);
    return mix(vec3(fog, fog, fog), vec3(1.0,0.0,0.0), prod);
}

vec3 noise(vec2 uv) {
    // http://obge.paradice-insight.us/wiki/Includes_%28Effects%29
    vec2 pos = floor(uv * 16.0);
    float noise = fract(sin(iTime+dot(pos ,vec2(12.9898,78.233)*2.0)) * 43758.5453);
	float r = abs(noise);
    return vec3(r, r, r);
}

vec3 pulse(vec2 uv) {
 	float theta = length(uv);
    float x = sin(theta * 10.0 - iTime * 5.0);
    x *= x;
    float n = x * 0.5 + 0.5;
    return vec3(0.0, n, 0.0);
}

vec3 mandelbrot(vec2 uv) {
    uv.x = uv.x * 0.5 + 0.5;
    uv.x = uv.x * 3.5 - 2.5;
    uv.y *= 3.5 / 2.0;
    vec2 misiurewicz = vec2(-0.1011, 0.9563);
    uv -= misiurewicz;
    uv *= 0.01 * (0.5 - sin(iTime) * 0.5);
    uv += misiurewicz;
    vec2 pos = vec2(0.0, 0.0);
    vec2 escape = vec2(0.0, 0.0);
    float dist = 100.0;
    for (int i = 0; i < 32; ++i) {
        pos = vec2(pos.x*pos.x - pos.y*pos.y, 2.0*pos.x*pos.y);
        pos += uv;
        dist = min(dist, distance(pos,escape));
        if (dot(uv,uv) > 4.0) {
            dist = 0.0;
        	break;   
        }
    }
    dist = 1.0 / (1.0 + dist);
    vec3 inner = vec3(0.0, 0.7, 0.9);
    vec3 outer = inner * 0.3;
    return mix(inner, outer, dist);
}

vec4 material(float type, vec3 shadingParameters) {
    if (type == float(MATERIAL_FLOOR)) {
     	vec2 coords = shadingParameters.yx * 1.1;
        return vec4(texture(iChannel1, coords).xyz, 0.5);
    } else if (type == float(MATERIAL_WALL)) {
     	vec2 coords = sin(shadingParameters.xy * 0.3) * 0.5 + 0.5;
        return vec4(texture(iChannel2, coords).xyz, 0.0);
    } else if (type == float(MATERIAL_CARPET)) {
     	return vec4(0.5, 0.0, 0.0, 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+0)) {
     	return vec4(starfield(shadingParameters.xy), 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+1)) {
     	return vec4(plasma(shadingParameters.xy), 0.0);  
    } else if (type == float(MATERIAL_PICTURE_FIRST+2)) {
        return vec4(planeZoom(shadingParameters.xy), 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+3)) {
        return vec4(cubeRot(shadingParameters.xy), 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+4)) {
        return vec4(noise(shadingParameters.xy), 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+5)) {
        return vec4(1.0,1.0,1.0,-1.0); /* mirror */
    } else if (type == float(MATERIAL_PICTURE_FIRST+6)) {
        vec3 ray = normalize(vec3(shadingParameters.xy, 1.0));
        ray *= zrotate(iTime) * yrotate(iTime);
        return vec4(texture(iChannel0, ray.xy).xyz, 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+7)) {
        return vec4(pulse(shadingParameters.xy), 0.0);
    } else if (type == float(MATERIAL_PICTURE_FIRST+8)) {
        return vec4(mandelbrot(shadingParameters.xy), 0.0);
    }
    return vec4(1.0, 0.0, 1.0, 0.0); /* missing material */
}

vec4 shade(inout vec3 origin, inout vec3 ray) {
    vec3 lighting = vec3(0.2, 0.2, 0.2) * 5.0;
    vec3 lightingSpecular = vec3(0.0, 0.0, 0.0);
    
    float farPlane = 50.0;
    
	mat3 traced = trace(origin, ray, farPlane);
    vec3 t = traced[0];
    
    vec3 worldPos = origin + ray * t.x;
    
    vec3 normal = surfaceNormal(worldPos);
    
    float fresnel = 1.0 - max(dot(-ray, normal), 0.0);
    
    vec3 specular = normalize(reflect(ray, normal));
    
    if (t.y == -1.0) { /* sky */
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    
    vec4 diff = material(t.y, traced[1]);
        
    const int lightCount = 1;
    for (int i = -1; i <= lightCount; ++i) {
        float theta = iTime * 1.0 + float(i) / float(lightCount) * 6.28;

    	float modTimberPos = floor(worldPos.z/10.0+0.5) + float(i);
        vec3 lightPos = vec3(0.0, 2.0, 2.5+modTimberPos*10.0);
        
        vec3 surfaceToLight = lightPos - worldPos;
        float lightDist = length(surfaceToLight);
        surfaceToLight /= lightDist;
        

#ifdef ENABLE_SHADOWS
        float lightVisible = 0.0;
        mat3 lightTrace = trace(lightPos, -surfaceToLight, lightDist*0.999);
        if (lightTrace[0].y == -1.0) {
            //mat3 shadowTrace = trace(lightPos, -surfaceToLight, lightDist*0.9);
            lightVisible = 1.0;//min(shadowTrace[0].z * 16.0, 1.0);
        }
#else
        float lightVisible = 1.0;
#endif
        
        lightVisible *= max(dot(surfaceToLight, normal), 0.0);
        
        vec3 lightReflection = reflect(-surfaceToLight, normal);
        float lightSpecular = max(dot(-ray, lightReflection), 0.0);
        lightSpecular = min(pow(0.2 + lightSpecular, 4.0), 1.0);
        
        float lightPower = lightVisible * 1.0 / (1.0 + lightDist*lightDist*0.01);
        vec3 lightColour = vec3(1.0, 1.0, 1.0) * lightPower / float(lightCount);
        
        lighting += lightColour;
        lightingSpecular += lightSpecular * lightColour;
    }

    float fog = 1.0 - t.x / farPlane;
    
    float aoc = 1.0 - ambientOcclusion(worldPos, -ray);
    aoc = pow(max(aoc, 0.0), 8.0);
    
    vec3 final = aoc * fog * (diff.xyz * lighting) + lightingSpecular * 0.01;
    
    origin = worldPos + specular * 0.05;
    ray = specular;
                                 
    if (diff.w < 0.0) {
     	return vec4(lightingSpecular.xyz, 0.5);   
    }
    
    return vec4(final, diff.w * fresnel);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	vec2 uv = fragCoord.xy / iResolution.xy * 2.0 - 1.0;
	uv.x *= iResolution.x / iResolution.y;
    
    float theta = iTime * 0.1;
    vec2 mouseNorm = iMouse.xy / iResolution.xy * 2.0 - 1.0;
    mat3 rot = xrotate(-mouseNorm.y * 0.5) * yrotate(-mouseNorm.x * 3.14);
    
    if (iMouse.z < 1.0) {
     	rot = mat3(1.0);   
    }
    
    vec3 origin = vec3(0.0, 0.5, iTime);
    vec3 ray = normalize(vec3(uv, 1.0/tan(70.0*0.00872664625))) * rot;
    
    vec3 result = vec3(0.0, 0.0, 0.0);
    
#ifdef ENABLE_REFLECTIONS
    const int iter = 2;
#else
    const int iter = 1;
#endif
    
    float gloss = 1.0;
    
    for (int i = 0; i < iter; ++i) {
    
        vec4 trace = shade(origin, ray);
        
		result += trace.xyz * gloss;
        
        gloss = trace.w;
        
        if (gloss == 0.0) {
        	break;   
        }
        
    }
    
	fragColor = vec4(result, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XsSSzG';
  }
  name(): string {
    return 'The Gallery';
  }
  sort() {
    return 265;
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
      webglUtils.WOOD_TEXTURE,
      webglUtils.WOOD_TEXTURE,
      webglUtils.ROCK_TEXTURE,
    ];
  }
}
