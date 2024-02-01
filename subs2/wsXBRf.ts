import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.14159265

// Random hash function
vec2 rand2d(vec2 uv) {
    return fract(sin(vec2(
        dot(uv, vec2(215.1616, 82.1225)),
        dot(uv, vec2(12.345, 856.125))
    )) * 41234.45) * 2.0 - 1.0;
}

// Calculate CoC: https://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch23.html
float getCoC(float depth, float focalPlane) {
    float focalLength = 0.1;
    float aperture = min(1.0, focalPlane * focalPlane);
    return abs(aperture * (focalLength * (focalPlane - depth)) /
        (depth * (focalPlane - focalLength)));
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;
    
    // Sample original texture data at uv
    vec4 texData = texture(iChannel0, uv);
    
    // Get its depth
    float depth = texData.w;
    
    // Focal plane at 3.9 (the camera is looking at the center from ~4.0)
    float focalPlane = 3.9;
    
    // Calculate CoC, see above
    float coc = getCoC(depth, focalPlane);
    
    // Sample count
    const int taps = 32;
    
    // Golden ratio: https://www.youtube.com/watch?v=sj8Sg8qnjOg
    float golden = 3.141592 * (3.0 - sqrt(5.0));
    
    // Color & total weight
    vec3 color = vec3(0.0);
    float tot = 0.0;
    
    for (int i = 0; i < taps; i++) {
        // Radius slowly increases as i increases, all the way up to coc
        float radius = coc * sqrt(float(i) / float(taps));
        
        // Golden ratio sample offset
        float theta = float(i) * golden;
        vec2 tapUV = uv + sin(theta + vec2(0.0, PI / 2.0)) * radius;
        
        // Sample the bit over there
        vec4 tapped = texture(iChannel0, tapUV);
        float tappedDepth = tapped.w;

        if (tappedDepth > 0.0) {
            // Use CoC over there as weight
            float tappedCoC = getCoC(tappedDepth, focalPlane);
            float weight = max(0.001, tappedCoC);
            
            // Contribute to final color
            color += tapped.rgb * weight;
            // And final weight sum
            tot += weight;
        }
    }
    // And normalize the final color by final weight sum
    color /= tot;
    fragColor = vec4(color, 1.0);
}

`;

const f = `
// It's "floor" because floor is reserved keyword
float sol(vec3 pos) {
    return pos.y;
}

// Finite repetition: https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float cube(vec3 pos, vec3 off) {
    vec3 c = vec3(3.0, 0.0, 3.0);
    vec3 l = vec3(1.0);
    pos = pos - c * clamp(floor(pos / c + 0.5), -l, l);
    pos -= off;
    vec3 d = abs(pos) - vec3(0.5);
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// Classic map from raymarching. I ripped it off from iq's fruxis: ldl3zl 
vec2 map(vec3 pos) {
    float closest = 1000.0;
    float id = -1.0;
    
    // Ground
    float dist = sol(pos);
    if (dist < closest) { closest = dist; id = 0.5; }
    
    // Cubes
    dist = cube(pos, vec3(0.0, 0.48, 0.0));
    if (dist < closest) { closest = dist; id = 1.5; }
    
    return vec2(closest, id);
}

// Raymarching
vec2 trace(vec3 ro, vec3 rd) {
    float depth = 0.0;
    float id = -1.0;
    for (int i = 0; i < 200; i++) {
        vec2 info = map(ro + rd * depth);
        if (abs(info.x) <= 0.001) {
            id = info.y;
            break;
        }
        depth += info.x;
    }
    return vec2(depth, id);
}

// Returns a grid like color
vec3 getFloorColor(vec3 pos) {
    pos *= 2.0;
    vec3 baseColor = vec3(1.0, 1.0, 1.0);
    vec3 f = mod(floor(pos), 2.0);
    return baseColor * clamp(abs(f.x - f.z), 0.8, 1.0);
}

// Returns a slowly-turning-from-blue-to-white-as-ray-direction-increases color
vec3 getSkyColor(vec3 rd) {
    vec3 baseColor = vec3(0.69, 0.89, 0.99);
    return mix(baseColor, vec3(1.0, 1.0, 1.0), clamp(rd.y * 4.6, 0.0, 1.0));
}

// General getColor function. You plug object id in, and get the respective object color
vec3 getColor(float id, vec3 pos, vec3 rd) {
    if (id < -0.5) { return getSkyColor(rd); } // sky
    if (id < 1.0) { return getFloorColor(pos); } // ground
    if (id < 2.0) { return vec3(1.0, 0.5, 0.0); }
    return vec3(1.0, 0.0, 0.0); // red for undefined
}

// Estimate normal function
vec3 getNormal(vec3 p) {
    const float epsilon = 0.001;
    float mapped = map(p).x;
    return normalize(vec3(
        mapped - map(vec3(p.x - epsilon, p.yz)).x,
        mapped - map(vec3(p.x, p.y - epsilon, p.z)).x,
        mapped - map(vec3(p.x, p.y, p.z - epsilon)).x
    ));
}

// Soft shadow calculation: https://www.iquilezles.org/www/articles/rmshadows/rmshadows.htm
float getShadowIntensity(vec3 ro, vec3 rd) {
    float depth = 0.001;
    float res = 1.0;
    for (int i = 0; i < 25; i++) {
        float dist = map(ro + rd * depth).x;
        res = min(res, 20.0 * dist / depth);
        if (res < 1e-6) { break; }
        depth += clamp(dist, 0.001, 2.0);
    }
    return clamp(res, 0.0, 1.0);
}

// Calculate ray direction
vec3 getRd(vec3 ro, vec2 uv) {
    vec3 center = vec3(0.0, 0.0, 0.0);

    vec3 front = normalize(center - ro);
    vec3 right = normalize(cross(front, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(right, front));
    
    mat4 lookAt = mat4(
        vec4(right, 0.0),
        vec4(up, 0.0),
        vec4(front, 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
    vec3 rd = normalize(vec3(lookAt * vec4(uv, 2.0, 1.0)));
    return rd;
}

// Get fragment color according to raymarched id, pos, etc.
vec3 getFinalColor(float id, vec3 pos, vec3 n, vec3 rd, vec3 lightDir) {
    float ambient = 1.0;
    float diffuse = max(dot(n, lightDir), 0.0);
    float dome = 0.2 + 0.8 * clamp(n.y, 0.0, 1.0);
    float sol = 0.2 + 0.8 * clamp(-n.y, 0.0, 1.0);
    float back = max(dot(n, vec3(-lightDir.x, 0.0, -lightDir.z)), 0.0);
    float shadow = getShadowIntensity(pos + n * 1e-3, lightDir);

    vec3 light = vec3(1.0);
    if (id > 0.0) {
        light = vec3(0.0);
        light += ambient * vec3(0.2, 0.2, 0.2) * shadow;
        light += diffuse * vec3(0.82, 0.80, 0.82) * shadow;
        light += dome * vec3(0.26, 0.32, 0.334);
        light += sol * vec3(0.3, 0.21, 0.23);
        light += back * vec3(0.2, 0.21, 0.23);
    }

    vec3 objColor = getColor(id, pos, rd) * light;
    return objColor;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord.xy / iResolution.xy * 2.0 - 1.0;
    float aspect = iResolution.x / iResolution.y;
    uv.x *= aspect;
    
    // Ray origin
    vec3 ro = vec3(4.0 * sin(iTime * 1.0), 1.5, 4.0 * cos(iTime * 1.0));
    
    // Ray direction
    vec3 rd = getRd(ro, uv);
    
    // Raymarch. info.x is depth, and info.y is object id
    vec2 info = trace(ro, rd);
    vec3 pos = ro + rd * info.x;
    vec3 n = getNormal(pos);

    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));

    // Get final color & apply gamma correction
    vec3 color = getFinalColor(info.y, pos, n, rd, lightDir);
    color = pow(color, vec3(0.4545));

    fragColor = vec4(color, info.x);
}

`;

export default class implements iSub {
  key(): string {
    return 'wsXBRf';
  }
  name(): string {
    return 'Simple DoF';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 205;
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
      // webglUtils.ROCK_TEXTURE, //
      { type: 1, f, fi: 0 },
    ];
  }
}
