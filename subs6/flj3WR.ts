import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.14159265359
#define viewAngle (PI*0.6)
#define distToScreen (0.5*max(iResolution.x, iResolution.y)/tan(0.5*viewAngle))
#define maxDist 70.0
#define maxStep 500
#define nEPS 0.0125

#define meanWaterLevel -0.5

#define SKY 0.0
#define WATER 1.0
#define LAND 2.0

// MODE 0 sticks the camera to the ground. Drag the mouse to explore.
// MODE 1 makes the camera fly above the terrain
#define MODE 1

float noise(in vec2 uv)
{
    
    return sin(uv.x*1.5)+cos(uv.y/1.5);
}


#define OCTAVES 6
float fbm(in vec2 uv)
{
    //this function generates the terrain height
    uv /= 1.5;
    float value = 0.;
    float amplitude = 1.5;
    float freq = 0.8;
    
    for (int i = 0; i < OCTAVES; i++)
    {
        // From Dave_Hoskins https://www.shadertoy.com/user/Dave_Hoskins
        value = max(value,value+(.45-abs(noise(uv * freq)-.45) * amplitude));
        
        amplitude *= -.27;
        
        freq *= 3.5-value/8.0;
        
        //uv = uv.yx;
        //uv += vec2(cos(uv.x/freq),sin(uv.y/freq));
    }
    
    return value-2.6;
}



struct MarchResult {
    float dist;
    vec3 pos;
    float type;
};

float getElevation(vec2 uv, float d) {
    float factor = 3.0;
    return fbm(uv/factor)*factor;
}

vec3 getNormal(vec3 p, float d) {
    return normalize(vec3(
        getElevation(vec2(p.x-nEPS,p.z), d) - getElevation(vec2(p.x+nEPS,p.z), d),
        2.0*nEPS,
        getElevation(vec2(p.x,p.z-nEPS), d) - getElevation(vec2(p.x,p.z+nEPS), d)
    ));
}

float getWaterLevel(vec2 p, float d) {
    if (d<5.0) {
    	float t = iTime*1.0;
    	p*=7.0;
    	float w = 0.00025*smoothstep(0.0, 1.0, 0.5/(d+0.00001));
    	return w*(sin(p.y*7.37+t*2.0) + sin(p.x*2.37+t)) + meanWaterLevel;
    }
	else return meanWaterLevel;
}

vec3 getWaterNormal(vec3 p, float d) {
    return normalize(vec3(
        getWaterLevel(vec2(p.x-nEPS,p.z), d) - getWaterLevel(vec2(p.x+nEPS,p.z), d),
        2.0*nEPS,
        getWaterLevel(vec2(p.x,p.z-nEPS), d) - getWaterLevel(vec2(p.x,p.z+nEPS), d)
    ));
}

vec3 rayToPixel(vec2 pixel) {
    pixel -= 0.5*iResolution.xy;
    return normalize(vec3(pixel.x, pixel.y, distToScreen));
}

float estDistToTrn(vec3 p, float d) {
    return (p.y - getElevation(p.xz, d))*(d*0.015+0.35);
}


// TODO generate procedural textures for rocks and grass on the fly
vec4 rock(vec3 p) {
    return texture(iChannel0, p.xz);
}

vec4 grass(vec3 p) {
    return mix(vec4(0.2, 0.4, 0.15, 1.0), texture(iChannel1, p.xz), 0.1);
}

vec4 snow(vec3 p) {
    return vec4(0.9, 0.9, 0.9, 1.0);
}

vec4 fog(vec3 ray, float d, vec3 sunDir, vec4 material) {
    float fogAmount = 1.0-exp(-d*0.035);
    float sunAmount = pow(max(dot(ray, sunDir), 0.0), 90.0);
    vec4 fogCol = mix(vec4(0.3, 0.7, 0.9, 1.0), vec4(1.0, 0.9, 0.7, 1.0), sunAmount);
    return mix(material, fogCol, fogAmount);
}

vec4 terrain(vec3 p, vec3 sunDir) {
    vec3 normal = getNormal(p, 0.0);
	vec3 abnormal = abs(normal);	    
	vec4 grassRock = mix(grass(p), rock(p), smoothstep(0.0, 1.0, max(abnormal.x, abnormal.z)));
   	vec4 snowRock = mix(snow(p), rock(p), smoothstep(0.75, 1.0, max(abnormal.x, abnormal.z)));
   	vec4 fragC = mix(grassRock, snowRock, smoothstep(0.5, 1.0, p.y));
   	fragC *= max(dot(sunDir, normal), 0.2);
    return fragC;
}

MarchResult march(vec3 p0, vec3 ray, bool withWater) {
    float type = SKY;
    float d = 0.0;
    int stp = 0;
    vec3 p = p0;
    while (type==SKY && d<(withWater?maxDist:maxDist*0.125) && (stp++<(withWater?maxStep:maxStep/3))) {
        p = p0 + d*ray;
        float waterLevel = withWater ? /*getWaterLevel(p.xz, d)*/ meanWaterLevel : -9999.9;
        float stpSize = estDistToTrn(p,d) * (withWater?1.0:2.0);
        // TODO fix this mess
        if (p.y<=waterLevel) {
            type = WATER;
            d = (waterLevel-p0.y)/ray.y;
            p = p0+d*ray;
        }
        else if (stpSize<d*0.001) type = LAND;
        else d+= stpSize;
    }
    d = min(d, maxDist);
    return MarchResult(d, p, type);
}


vec4 water(vec3 p, float d, vec3 ray, vec3 sunDir) {
    vec3 normal = getWaterNormal(p, d);
    vec3 ref = normalize(reflect(-sunDir, normal));
    vec4 wc = vec4(0.2,0.55,0.8,1.0);
    vec4 sc = vec4(0.9,0.9,0.7,1.0);
    wc *= max(0.35, dot(sunDir, normal));
    
    MarchResult uwr = march(p, normalize(reflect(ray, normal)), false);
    vec4 uwt = terrain(uwr.pos, sunDir);
    wc = mix(wc, uwt, uwr.type*0.25);
    
    return mix(wc, sc, 0.85*pow(max(dot(ref, -ray),0.0),8.0));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	

    float pitch = MODE==0 ? 0.0 : 0.2*sin(iTime*0.2);
    float yaw = 0.0;
    float roll = MODE==0 ? 0.0 : 0.1*sin(iTime*0.5);

    vec3 ray = rayToPixel(fragCoord);
    
    mat3 tr = mat3(
        cos(roll),  -sin(roll), 0.0,
        sin(roll), cos(roll), 0.0,
        0, 0, 1
    ) 
    * mat3(
        cos(yaw), 0.0, sin(yaw),
        0.0, 1.0, 0.0,
        -sin(yaw), 0.0, cos(yaw)
    )
    * mat3(
        1.0, 0.0, 0.0,
        0.0, cos(pitch), -sin(pitch),
        0.0, sin(pitch), cos(pitch)
    )
    ;
    ray *= tr;
    
    
    #if MODE
    vec3 p0 = vec3(17.25, 2.0, 1.0*iTime);
    #else
    vec3 p0 = vec3(60.0*iMouse.x/iResolution.x, -0.25, 60.0*iMouse.y/iResolution.y);
    p0.y = max(getElevation(p0.xz,0.0), getWaterLevel(p0.xz,0.0)) + 0.05;
    #endif
    
    MarchResult res = march(p0, ray, true);
    vec3 sunDir = normalize(vec3(0.2, 0.1, 0.15));
    
    fragColor = vec4(1.0);
    if (res.dist<maxDist) {
        if (res.type==WATER) {
            fragColor = water(res.pos, res.dist, ray, sunDir);
        } else if (res.type==LAND) {
    		fragColor = terrain(res.pos, sunDir);
        }
    }
    
    fragColor = fog(ray, res.dist, sunDir, fragColor);
    fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'flj3WR';
  }
  name(): string {
    return 'Mountain rivers';
  }
  sort() {
    return 643;
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
      webglUtils.TEXTURE5, //
      webglUtils.TEXTURE7,
    ];
  }
}
