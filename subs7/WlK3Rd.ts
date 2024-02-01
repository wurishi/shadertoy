import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `

#define c0 iChannel0 
#define c1 iChannel1 
#define c2 iChannel2 
#define c3 iChannel3 

#define T(c, uv) texture(c, uv)

#define rot(x) mat2(cos(x),-sin(x),sin(x),cos(x))

#define pi acos(-1.)
#define tau (2.*pi)

#define PI pi


struct Mat {
    vec3 albedo;
	float metalness; 
	float roughness;
};
Mat mats[5] = Mat[](
	Mat(vec3(1)*0.9,0.5,0.23),
	Mat(vec3(1)*0.1,0.0,0.2),
	Mat(vec3(1,1,1.)*0.0,0.2,0.5),
	Mat(vec3(1,1,1.)*0.2,0.2,0.1),
	Mat(vec3(1,1,1.)*0.2,0.0,0.)
);  



float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / max(denom, 0.001); // prevent divide by zero for roughness=0.0 and NdotH=1.0
}


// ----------------------------------------------------------------------------
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
// ----------------------------------------------------------------------------
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}
// ----------------------------------------------------------------------------


float pModPolar(inout vec2 p, float repetitions) {
	float angle = 2.*PI/repetitions;
	float a = atan(p.y, p.x) + angle/2.;
	float r = length(p);
	float c = floor(a/angle);
	a = mod(a,angle) - angle/2.;
	p = vec2(cos(a), sin(a))*r;
	// For an odd number of repetitions, fix cell index of the cell in -x direction
	// (cell index would be e.g. -5 and 5 in the two halves of the cell):
	if (abs(c) >= (repetitions/2.)) c = abs(c);
	return c;
}

// Tri-Planar blending function. Based on an old Nvidia writeup:
// GPU Gems 3 - Ryan Geiss: https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html
vec3 tex3D( sampler2D tex, in vec3 p, in vec3 n ){
   
    n = max((abs(n) - .2)*7., .001);
    n /= (n.x + n.y + n.z );  
    
	p = (texture(tex, p.yz)*n.x + texture(tex, p.zx)*n.y + texture(tex, p.xy)*n.z).xyz;
    
    return p*p;
}
float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{
  vec3 pa = p - a, ba = b - a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length( pa - ba*h ) - r;
}



vec4 sharpen(sampler2D channel,vec2 uv,vec2 res){
    vec2 step = 1.0 / res;
    float kernel [9];vec2 offset [9];


    offset[0] = vec2(-step.x, -step.y);
    offset[1] = vec2(0.0, -step.y);
    offset[2] = vec2(step.x, -step.y);
    
    offset[3] = vec2(-step.x, 0.0);
    offset[4] = vec2(0.0, 0.0);
    offset[5] = vec2(step.x, 0.0);
    
    offset[6] = vec2(-step.x, step.y);
    offset[7] = vec2(0.0, step.y);
    offset[8] = vec2(step.x, step.y);
    
    kernel[0] = 0.0; kernel[1] = -0.25; kernel[2] = 0.0;
    kernel[3] = -0.25; kernel[4] = 1.0; kernel[5] = -0.25;
    kernel[6] = 0.0; kernel[7] = -0.25; kernel[8] = 0.0;
    
    vec4 sum = texture(channel, uv);
    
    for (int i = 0; i < 9; i++) {
        vec4 color = texture(channel, uv + offset[i]);
        sum += color * kernel[i]*2.;
    }
    return sum;
}

vec4 blur(sampler2D channel,vec2 uv,vec2 res){
    vec2 step = 1.0 / res;
    float kernel [9];vec2 offset [9];


    offset[0] = vec2(-step.x, -step.y);
    offset[1] = vec2(0.0, -step.y);
    offset[2] = vec2(step.x, -step.y);
    
    offset[3] = vec2(-step.x, 0.0);
    offset[4] = vec2(0.0, 0.0);
    offset[5] = vec2(step.x, 0.0);
    
    offset[6] = vec2(-step.x, step.y);
    offset[7] = vec2(0.0, step.y);
    offset[8] = vec2(step.x, step.y);
    
    kernel[0] = 1.0; kernel[1] = 1.; kernel[2] = 1.0;
    kernel[3] = 1.; kernel[4] = 1.0; kernel[5] = 1.;
    kernel[6] = 1.0; kernel[7] = 1.; kernel[8] = 1.0;
    
    vec4 sum = vec4(0);
    
    for (int i = 0; i < 9; i++) {
        vec4 color = texture(channel, uv + offset[i]);
        sum += color * kernel[i];
    }
    sum /= 9.;
	
    return sum;
}

`;

const buffA = `


#define maxIters 120
#define mx (30.*iMouse.x/iResolution.x)
#define dmin(a, b) a.x < b.x ? a : b
#define dmax(a, b) a.x > b.x ? a : b 
#define pmod(p, x) mod(p, x) - x*0.5

float r11c(float x){return texture(iChannel0, vec2(x, x*12.5)).x;}

vec2 offsetTunnel(float z){
    vec2 t = vec2(
        sin(z*0.1)*2.,
        cos(z*0.1)*2.
    );
    t.y -= 0.;
	return t;
}

#define szTunnel 1.

#define modDist 10.

vec3 centerPipes = vec3(0);
vec3 centerTunnel = vec3(0);


vec2 map(vec3 p){
	vec2 d = vec2(10e7);

    p.xy -= offsetTunnel(p.z);
    
    // --- TUNN --- //
    
	
    centerTunnel = p;
    d = dmin(d, vec2(-(length(p.xy) - szTunnel), 0.));
        

	vec3 q = p;
    q.z = pmod(q.z, 1.);
    
    p.z = pmod(p.z, modDist);
    
    // seperations
    d = dmin(d, vec2(max(-(length(p.xy) - szTunnel*0.9), (abs(q.z) - 0.01)) ,0.));
    
    // bolts
    vec3 i = q;
    pModPolar(i.xy, 20.);
    i.x -= 0.96;
    i.z *= 2.;
    d = dmin(d, vec2(length(i)-0.04,0.));
    
    // seperations2
    q = abs(q);
    q.xy *= rot(0.125*pi);
    q = abs(q);
    q.xy *= rot(0.125*pi);
    d = dmin(d, vec2(max(-(length(p.xy) - szTunnel*0.9), (abs(q.x) - 0.01)) ,0.));
    
    // --- LAMPS --- //
    
    d =dmin(d, vec2(sdCapsule( abs(p) - vec3(0.+ 0.07,szTunnel*0.8,0) , vec3(0,0,0.6), vec3(0.0), 0.04 ), 4.)); 

    
    // --- PIPES --- //
    i = p;
    i.x = abs(i.x);
    i.x -= 0.89;
    d = dmin(d, vec2(length(i.xy)-0.04,3.));
    
    i.xy += 0.45;

    i.x -= 0.02;
    i.y += 0.12;
    
    i.xy *= rot(p.z*0.5);
    i= abs(i);
    i.xy -= 0.03;
    //i.xy *= rot(0.9);i.y -= 0.05; i.y = abs(i.y); i.y -= 0.05;
    // cables
    d = dmin(d, vec2(length(i.xy)-0.02,2.));
    
    // --- FLOOR --- //
    float offsFloor = szTunnel*0.67;
    p.y += offsFloor;
    p.x = abs(p.x);
    d = dmin(d, vec2(
        max(
            max(max(p.y, (p.x- 0.4) ),
                -(p.y + 0.1)
               ),
            abs(q.z) - 0.42
            )
        , 1.));
    
    d.x *= 0.9;
	return d;
}
vec3 pLamp;

vec3 getNormal(vec3 p){
	vec2 t = vec2(0.001, 0.);
    return -normalize(
    	 vec3(
        	map(p - t.xyy).x - map(p + t.xyy).x,
        	map(p - t.yxy).x - map(p + t.yxy).x,
        	map(p - t.yyx).x - map(p + t.yyx).x
        )
    );
}

#define fov 0.8

vec3 getRd(vec3 ro, vec3 lookAt, vec2 uv){
	vec3 dir = normalize(lookAt - ro);
	vec3 right = normalize(cross(vec3(0,1,0), dir));
	vec3 up = normalize(cross(dir, right));
	return dir + right*uv.x*fov + up*uv.y*fov;
}

vec3 colLight = vec3(1.)*2.2;
vec3 glowLight = vec3(0);
vec3 att = vec3(1.);
int iters = 0;
float dither;
//vec3 p
vec2 march(inout vec3 ro,inout vec3 p,inout vec3 rd, inout float t, inout bool didHit, inout float bounce){
    p = ro + rd*0.5;vec2 d;
    didHit = false;
    for(; iters < maxIters; iters++){
    	d = map(p);
        d.x *= dither;
        if (d.y == 4.)
            glowLight += exp(-d.x*8.);
        
        if(((iters % 7) == 0) && d.x < 0.001){
            didHit = true;
            int id = int(d.y); 
            break;
        }
        
        t += d.x;
        p = ro + rd*t;
    }
    return d;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0);
    vec3 ro = vec3(0,0,-0.);
    ro.z += iTime*2. + mx;
    ro.xy += offsetTunnel(ro.z);
    
    vec3 lookAt = ro + vec3(0,0,9);
    lookAt.xy += offsetTunnel(lookAt.z);
    
    dither = mix(0.8,1.,texture(iChannel0,20.*uv*256. + iTime*2.).x);
    vec3 rd = getRd(ro, lookAt, uv);
    rd.xy *= 1. - dot(uv,uv)*0.2;
    rd = normalize(rd);
	
    vec3 p = ro; float t = 0.;vec2 d; vec3 l = vec3(0); bool didHit = false; float bounce = 0.;
    for (int i = 0; i < 2; i++){
    	d = march(ro, p, rd, t, didHit, bounce);
    
        if(didHit == true){
            pLamp = vec3(0,szTunnel*0.4,floor(p.z/modDist)*modDist + modDist*0.5 );
            pLamp.xy += offsetTunnel(pLamp.z);

            vec3 n = getNormal(p);
            l = normalize(pLamp - p);
            vec3 h = normalize(l - rd);
            int id = int(d.y);
            //id = 0;
            float metalness = mats[id].metalness;
            float roughness = mats[id].roughness;
            roughness = max(roughness, 0.);
            vec3 albedo = mats[id].albedo;
            vec3 N = getNormal(p);
            vec3 V = normalize(ro - p);
            //vec3 V = -rd;

            if (id == 0) 
            {
                float t =tex3D(iChannel0,p*0.6, n).b*0.2;
                roughness -= t;
            	metalness -= t;
            }
            if (id == 2) {
                float t =tex3D(iChannel0,p*0.6, n).b*0.2;
                roughness -= t;
            	metalness -= t;    
            }

            vec3 F0 = vec3(0.14); 
            F0 = mix(F0, albedo, metalness);


            // calculate per-light radiance
            float distL    = length(pLamp - p);
            float attenuation = 0.9 / (distL * distL);
            vec3 radiance     = colLight * attenuation;        

            // cook-torrance brdf
            float NDF = DistributionGGX(n, h, roughness);   
            float G   = GeometrySmith(n, V, l, roughness);      
            vec3 F    = fresnelSchlick(clamp(dot(n, V), 0.0, 1.0), F0);     

            vec3 kS = F;
            vec3 kD = vec3(1.0) - kS;
            kD *= 1.0 - metalness;	  

            vec3 numerator    = NDF * G * F;
            float denominator = 4.0 * max(dot(n, V), 0.0) * max(dot(n, l), 0.0);
            vec3 specular     = numerator / max(denominator, 0.001);  

            // add to outgoing radiance Lo
            float NdotL = max(dot(n, l), 0.0); 
            col += (kD * albedo / PI + specular) * radiance * NdotL * attenuation*att; 
			
           // col += glow;

            if (id < 2 && bounce != 2.){
                if(id == 0){
                	att *= max(0.03 - roughness*0.1, 0.);
                } else {
                	att *= max(0.37 - roughness, 0.);
                
                }
                bounce++;
                ro = p;
                rd = reflect(rd, n);
                t = 0.;
            } else {
                break;
            }
    }
        
    }
    if(d.y == 4.) col = vec3(1);

    col *= vec3(1.0,1.014,1.02);
    col += glowLight*0.02;
    
    col = pow(col, vec3(0.45));
    
    col = clamp(col, 0.07 ,1.);
    //col = smoothstep(0.,0.6,col);
    
    fragColor = vec4(col,1.0);
}`;

const buffB = `
ivec2 offsets[8] = ivec2[8]( ivec2(-1,-1), ivec2(-1, 1), 
	ivec2(1, -1), ivec2(1, 1), 
	ivec2(1, 0), ivec2(0, -1), 
	ivec2(0, 1), ivec2(-1, 0));

vec3 RGBToYCoCg( vec3 RGB )
{
	float Y = dot(RGB, vec3(  1, 2,  1 )) * 0.25;
	float Co= dot(RGB, vec3(  2, 0, -2 )) * 0.25 + ( 0.5 * 256.0/255.0 );
	float Cg= dot(RGB, vec3( -1, 2, -1 )) * 0.25 + ( 0.5 * 256.0/255.0 );
	return vec3(Y, Co, Cg);
}

vec3 YCoCgToRGB( vec3 YCoCg )
{
	float Y= YCoCg.x;
	float Co= YCoCg.y - ( 0.5 * 256.0 / 255.0 );
	float Cg= YCoCg.z - ( 0.5 * 256.0 / 255.0 );
	float R= Y + Co-Cg;
	float G= Y + Cg;
	float B= Y - Co-Cg;
	return vec3(R,G,B);
}

//#define NO_AA

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy / iResolution.xy;    
    vec3 new = RGBToYCoCg(textureLod(iChannel0, q, 0.0).xyz);
    vec3 history = RGBToYCoCg(textureLod(iChannel1, q, 0.0).xyz);
    
    vec3 colorAvg = new;
    vec3 colorVar = new*new;
    
    // Marco Salvi's Implementation (by Chris Wyman)
    for(int i = 0; i < 8; i++)
    {
        vec3 fetch = RGBToYCoCg(texelFetch(iChannel0, ivec2(fragCoord.xy)+offsets[i], 0).xyz);
        colorAvg += fetch;
        colorVar += fetch*fetch;
    }
    colorAvg /= 9.0;
    colorVar /= 9.0;
    float gColorBoxSigma = 0.75;
	vec3 sigma = sqrt(max(vec3(0.0), colorVar - colorAvg*colorAvg));
	vec3 colorMin = colorAvg - gColorBoxSigma * sigma;
	vec3 colorMax = colorAvg + gColorBoxSigma * sigma;
    
    history = clamp(history, colorMin, colorMax);
  
	fragColor = vec4(YCoCgToRGB(mix(new, history, 0.95)), 1.0);
#ifdef NO_AA
    fragColor = vec4(YCoCgToRGB(new), 1.0);
#endif
}
`;

const fragment = `
// Fork of "Day 29 - Dwarf Train" by jeyko. https://shadertoy.com/view/3tG3RK
// 2020-01-21 19:48:13
// Buffer A is draw buffer
// Buffer B is TAA from https://www.shadertoy.com/view/4dSBDt
// Image buffer removes buriness from TAA by sharpening from https://www.shadertoy.com/view/MtdXW4


void mainImage( out vec4 C, in vec2 U )
{
	//C += T(c0,U/iResolution.xy);
    C = sharpen(c0,U/iResolution.xy,iResolution.xy);
    C *= 1.3;
    C = mix(C,smoothstep(0.,1.,C), 0.8);
}
`;

export default class implements iSub {
    key(): string {
        return 'WlK3Rd';
    }
    name(): string {
        return 'Day 33 - Metalicity';
    }
    sort() {
        return 748;
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
    webgl() {
        return WEBGL_2;
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
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 1 }, //
            webglUtils.DEFAULT_NOISE,
        ];
    }
}
