import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Depth and normal Pass
#define PRECIS 0.001
#define DMAX 20.0
mat3 camMat;
vec3 lightDir = normalize(vec3(5.0, 5.0, -4.0));

// Distance functions by www.iquilezles.org
float fSubtraction(float a, float b) {return max(-a,b);}
float fIntersection(float d1, float d2) {return max(d1,d2);}
void fUnion(inout float d1, float d2) {d1 = min(d1,d2);}
float pSphere(vec3 p, float s) {return length(p)-s;}
float pRoundBox(vec3 p, vec3 b, float r) {return length(max(abs(p)-b,0.0))-r;}
float pTorus(vec3 p, vec2 t) {vec2 q = vec2(length(p.xz)-t.x,p.y); return length(q)-t.y;}
float pTorus2(vec3 p, vec2 t) {vec2 q = vec2(length(p.xy)-t.x,p.z); return length(q)-t.y;}
float pCapsule(vec3 p, vec3 a, vec3 b, float r) {vec3 pa = p - a, ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 ); return length( pa - ba*h ) - r;}

float map(vec3 p)
{
	float d = 100000.0;

    fUnion(d, pRoundBox(p - vec3(0,-2.0,0), vec3(4,0.1,4), 0.2));
	fUnion(d, pSphere(p - vec3(2,0,2), 1.5));
    fUnion(d, pSphere(p - vec3(3.5,-1.0,0.0), 0.8));
    fUnion(d, pTorus(p - vec3(-2,0,2), vec2(1,0.3)));
	fUnion(d, pTorus2(p - vec3(-3,0,2), vec2(1,0.3)));
    fUnion(d, pRoundBox(p - vec3(2,0.6,-2), vec3(0.1,0.1,1), 0.3));
	fUnion(d, pRoundBox(p - vec3(2,0,-2), vec3(0.1,1.5,0.1), 0.3));
	fUnion(d, pRoundBox(p - vec3(2,-0.4,-2), vec3(1.2,0.1,0.1), 0.3));
    fUnion(d, pCapsule(p, vec3(-2,1.5,-2), vec3(-2,-1,-1.0), 0.3));
	fUnion(d, pCapsule(p, vec3(-2,1.5,-2), vec3(-1.0,-1,-2.5), 0.3));
	fUnion(d, pCapsule(p, vec3(-2,1.5,-2), vec3(-3.0,-1,-2.5), 0.3));
	
	return d;
}

vec3 normal(vec3 pos) {
    vec2 eps = vec2(0.001, 0.0);
    return normalize(vec3(	map(pos + eps.xyy) - map(pos - eps.xyy),
                    		map(pos + eps.yxy) - map(pos - eps.yxy),
                         	map(pos + eps.yyx) - map(pos - eps.yyx)));
}

float shadow(vec3 ro, vec3 rd)
{
    float res = 1.0;
    float t = PRECIS * 30.0;
    for( int i=0; i < 30; i++ )
    {
		float distToSurf = map( ro + rd*t );
        res = min(res, 8.0 * distToSurf / t);
        t += distToSurf;
        if(distToSurf < PRECIS || t > DMAX) break;
    }
    
    return clamp(res, 0.0, 1.0);
}

vec4 raymarching(vec3 ro, vec3 rd)
{
    float t = 0.0;
    for (int i = 0; i < 50; i++) {
       	float distToSurf = map(ro + t * rd);
        t += distToSurf;
        if (distToSurf < PRECIS || t > DMAX) break; 
    }
    
    vec4 col = vec4(0.0);
    if (t <= DMAX) {
        vec3 nor = normal(ro + t * rd);
        col.z = 1.0 - abs((t * rd) * camMat).z / DMAX; // Depth
        col.xy = (nor * camMat * 0.5 + 0.5).xy;	// Normal
        col.w = dot(lightDir, nor) * 0.5 + 0.5; // Diff
        col.w *= shadow(ro + t * rd, lightDir);
    }
    
    return col;
}

mat3 setCamera(vec3 ro, vec3 ta, float cr)
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (2.0 * fragCoord.xy - iResolution.xy) / iResolution.yy;
    
    // Mouse
    vec2 mo = vec2(0.0);
    if (iMouse.z > 0.0) {
        mo += (2.0 * iMouse.xy - iResolution.xy) / iResolution.yy;
    }
    
    // Camera position
    float dist = 6.5;
    vec3 ro = vec3(dist * cos(iTime * 0.1 + 6.0 * mo.x), 2.0 + mo.y * 4.0, dist * sin(iTime * 0.1 + 6.0 * mo.x));
    
    // Rotate the camera
    vec3 target = vec3(0.0, 0.0, 0.0);
    
    // Compute the ray
    camMat = setCamera(ro, target, 0.0);
    vec3 rd = camMat * normalize(vec3(p.xy, 1.5));
    
    // calculate color
	fragColor = raymarching(ro, rd);
  fragColor.a = 1.;
}
`;

const buffB = `
// Edge detection Pass
#define Sensitivity (vec2(0.3, 1.5) * iResolution.y / 400.0)

float checkSame(vec4 center, vec4 samplef)
{
    vec2 centerNormal = center.xy;
    float centerDepth = center.z;
    vec2 sampleNormal = samplef.xy;
    float sampleDepth = samplef.z;
    
    vec2 diffNormal = abs(centerNormal - sampleNormal) * Sensitivity.x;
    bool isSameNormal = (diffNormal.x + diffNormal.y) < 0.1;
    float diffDepth = abs(centerDepth - sampleDepth) * Sensitivity.y;
    bool isSameDepth = diffDepth < 0.1;
    
    return (isSameNormal && isSameDepth) ? 1.0 : 0.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 sample0 = texture(iChannel0, fragCoord / iResolution.xy);
    vec4 sample1 = texture(iChannel0, (fragCoord + vec2(1.0, 1.0)) / iResolution.xy);
    vec4 sample2 = texture(iChannel0, (fragCoord + vec2(-1.0, -1.0)) / iResolution.xy);
    vec4 sample3 = texture(iChannel0, (fragCoord + vec2(-1.0, 1.0)) / iResolution.xy);
    vec4 sample4 = texture(iChannel0, (fragCoord + vec2(1.0, -1.0)) / iResolution.xy);
    
    float edge = checkSame(sample1, sample2) * checkSame(sample3, sample4);
    
    fragColor = vec4(edge, sample0.w, 1.0, 1.0);
}
`;

const fragment = `
#define EdgeColor vec4(0.2, 0.2, 0.15, 1.0)
#define BackgroundColor vec4(1,0.95,0.85,1)
#define NoiseAmount 0.01
#define ErrorPeriod 30.0
#define ErrorRange 0.003

float triangle(float x)
{
	return abs(1.0 - mod(abs(x), 2.0)) * 2.0 - 1.0;
}

float rand(float x)
{
    return fract(sin(x) * 43758.5453);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float time = floor(iTime * 16.0) / 16.0;
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv += vec2(triangle(uv.y * rand(time) * 1.0) * rand(time * 1.9) * 0.005,
			triangle(uv.x * rand(time * 3.4) * 1.0) * rand(time * 2.1) * 0.005);
    
    float noise = (texture(iChannel1, uv * 0.5).r - 0.5) * NoiseAmount;
    vec2 uvs[3];
    uvs[0] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 0.0) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 0.0) + noise);
    uvs[1] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 1.047) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 3.142) + noise);
    uvs[2] = uv + vec2(ErrorRange * sin(ErrorPeriod * uv.y + 2.094) + noise, ErrorRange * sin(ErrorPeriod * uv.x + 1.571) + noise);
    
    float edge = texture(iChannel2, uvs[0]).r * texture(iChannel2, uvs[1]).r * texture(iChannel2, uvs[2]).r;
  	float diffuse = texture(iChannel2, uv).g;
    
	float w = fwidth(diffuse) * 2.0;
	vec4 mCol = mix(BackgroundColor * 0.5, BackgroundColor, mix(0.0, 1.0, smoothstep(-w, w, diffuse - 0.3)));
	fragColor = mix(EdgeColor, mCol, edge);
    //fragColor = vec4(diffuse);
}`;

export default class implements iSub {
  key(): string {
    return 'MscSzf';
  }
  name(): string {
    return 'Noise Contour';
  }
  sort() {
    return 493;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
      { type: 1, f: buffA, fi: 0 }, //
      webglUtils.DEFAULT_NOISE3,
      { type: 1, f: buffB, fi: 2 }, //
    ];
  }
}
