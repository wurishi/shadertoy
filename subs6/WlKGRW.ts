import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define PI acos(-1.)

void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

// Reflect space at a plane
float pReflect(inout vec3 p, vec3 planeNormal, float offset) {
    float t = dot(p, planeNormal)+offset;
    if (t < 0.) {
        p = p - (2.*t)*planeNormal;
    }
    return sign(t);
}

int Type=5;
vec3 nc,pab,pbc,pca;
void initIcosahedron() {
    float cospin=cos(PI/float(Type)), scospin=sqrt(0.75-cospin*cospin);
	nc=vec3(-0.5,-cospin,scospin);
	pab=vec3(0.,0.,1.);
	pbc=vec3(scospin,0.,0.5);
	pca=vec3(0.,scospin,cospin);
	pbc=normalize(pbc);	pca=normalize(pca);
}

vec3 bToC(vec3 A, vec3 B, vec3 C, vec3 barycentric) {
	return barycentric.x * A + barycentric.y * B + barycentric.z * C;
}

vec3 pIcosahedron(inout vec3 p, int subdivisions) {
    p = abs(p);
	pReflect(p, nc, 0.);
    p.xy = abs(p.xy);
	pReflect(p, nc, 0.);
    p.xy = abs(p.xy);
	pReflect(p, nc, 0.);
    
    if (subdivisions > 0) {

        vec3 A = pbc;
       	vec3 C = reflect(A, normalize(cross(pab, pca)));
        vec3 B = reflect(C, normalize(cross(pbc, pca)));
       
        vec3 n;


        float d = .5;
        
        vec3 p1 = bToC(A, B, C, vec3(1.-d, .0, d));
        vec3 p2 = bToC(A, B, C, vec3(1.-d, d, .0));
        n = normalize(cross(p1, p2));
        pReflect(p, n, 0.);
        
        if (subdivisions > 1) {

            A = reflect(A, n);
            B = p1;
            C = p2;

            p1 = bToC(A, B, C, vec3(.5, .0, .5));
            p2 = bToC(A, B, C, vec3(.5, .5, .0));
            n = normalize(cross(p1, p2));
            pReflect(p, n, 0.);
            

			p2 = bToC(A, B, C, vec3(.0, .5, .5));
            p1 = bToC(A, B, C, vec3(.5, .5, .0));
            n = normalize(cross(p1, p2));
            pReflect(p, n, 0.);
        }
    }
    
    return pca;
}



// Inigo quilez
float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h); }

float opSmoothSubtraction( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h); }

float opSmoothIntersection( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h); }


float r31(vec3 u){
	return fract(sin(u.y*415125.1 + u.x *12425.125125 + u.z*12525.215215215)*124115.125235);
}
float valueNoise(vec3 uv){
    vec3 id = floor(uv);
    vec3 fd = fract(uv);
    fd = smoothstep(0.,1., fd);
    
    float ibl = r31(id + vec3(0,-1,0));
    float ibr = r31(id + vec3(1,-1,0));
    float itl = r31(id + vec3(0));
    float itr = r31(id + vec3(1,0,0));
    
    
    float jbl = r31(id + vec3(0,-1,1));
    float jbr = r31(id + vec3(1,-1,1));
    float jtl = r31(id + vec3(0,0, 1));
    float jtr = r31(id + vec3(1,0, 1));
    
    
    float ibot = mix(ibl, ibr, fd.x); 
    float iup = mix(itl, itr, fd.x);
    float jbot = mix(jbl, jbr, fd.x);
    float jup = mix(jtl, jtr, fd.x);
    
    float i = mix(ibot, iup, fd.y);
    float j = mix(jbot, jup, fd.y);
    
    //return j;
    return mix(i, j, fd.z); 
}

float fbmOld(vec3 p){

    float n = 0.;
    p *= 0.1;
    
    float f = valueNoise(p); 
    
    float q = valueNoise(p*1.4);
    
    float j = valueNoise(p*3.);
    float l = valueNoise(p*6.);
    
    float z = valueNoise(p*f*q*4.);
    float i = valueNoise(p*f*q*4.5);
   
    n += f*0.9 + q*1. + z*0.36 + j*0.4 + l * 0.2;
    //n += f*1.8 + q*0.5 + z*0.5 + i*0.4;
    
	return n;
}
`;

const buffA = `
#define PI acos(-1.)


#define mx (20.*iMouse.x/iResolution.y)
#define iTime (iTime + mx )



// Noise (from iq)
float noise (in vec3 p) {
	vec3 f = fract (p);
	p = floor (p);
	f = f * f * (3.0 - 2.0 * f);
	f.xy += p.xy + p.z * vec2 (37.0, 17.0);
	f.xy = texture (iChannel2, (f.xy + 0.5) / 256.0, -256.0).yx;
	return mix (f.x, f.y, f.z);
}

float fbm (in vec3 p) {
    
    float n = 0.; 
    p *= 3.;
    
    float f = noise(p); 
    
    float q = noise(p*1.4);
    
    float j = noise(p*3.);
    float l = noise(p*6.);
    
    float z = noise(p*f*q*4.);
    float i = noise(p*f*q*4.5);
   
    n += f*0.9 + q*1. + z*0.36 + j*0.4 + l * 0.2;
    
    return n;
}




#define dmin(a, b) a.x < b.x ? a : b

#define tendrilLength 3.5
#define orbSize 0.13

#define rot(x) mat2(cos(x),-sin(x),sin(x) , cos(x))
#define pmod(p, x) mod(p, x) - x*0.5
vec2 map(vec3 p){
    
    #define modDistX 10.
    #define modDistZ 10.
    #define modDistY (modDistZ*1.5)
    vec3 id = vec3(
    	floor(p.x / modDistX ),
    	floor(p.z / modDistZ ),
    	floor(p.y / modDistY ) // wat
    );    

    float r = fract(sin(id.x*2123.52421 + id.y*214.512 + id.z)*24.123);    
    
    
    p.y += id.x*(2.*r - 1.)*8.;
    
    
    p.z += sin(iTime*r*0.4)*0.2;
    p.x += sin(iTime*r*2.4)*0.2;
    p.y += sin(iTime*r*0.4)*2.4;
    
    p.x = pmod(p.x, modDistX);
    
    p.z = pmod(p.z, modDistZ);
    p.y = pmod(p.y, modDistY);
    

    
    
	vec2 d = vec2(10e5);
    if (id.xy == vec2(0.)){
        p.xy *= rot(0.2 + iTime*(1. - 2.*r)*0.1);
        p.xz *= rot(0.2 + iTime*(1. - 2.*fract(r*2214.124))*0.02);
        
    } else {
        p.xy *= rot(0.2 + iTime*(1. - 2.*r)*0.2);
        p.xz *= rot(0.2 + iTime*(1. - 2.*fract(r*2214.124))*0.2);
    }
    //p.xy *= rot(0.2 + iTime*r*0.02);
    
    vec3 z = p;
    
    //p.z += id.x*modDistX*0.5;
    
    
   	vec3 n = pIcosahedron(p, int(1));

    //d = dmin(d, vec2(dot(p - 1., n),1.));
    
	
    float dSphere = min(d.x, length(p) - 1.4);
    d.x = dSphere;
    
    d.x = opSmoothUnion(d.x,max(length(p.xy) - 0.01, (dot(p, n) - tendrilLength)), 0.5);
    
    
    p.z -= tendrilLength + orbSize*2.;
    d.x = opSmoothUnion(d.x, length(p) - orbSize, 0.1);
    
    
    
    if (d.x == dSphere){
    	d.y = 4.;
    }
    
    d.x -= fbm(z)*0.06;
    
    
    
    d.x *= 0.5;
    //d = dmin(d, vec2(length(p) - 1.,1.));
    
    
    
	return d;
}

#define modTime sin(iTime*0.8 +  sin(iTime*0.6))
#define fov (1. + modTime*0.04)

vec3 getRd(vec3 ro, vec3 lookAt, vec2 uv){
	vec3 d = normalize(lookAt - ro);
	vec3 right = normalize(cross(vec3(0,1,0),d ));
	vec3 up = normalize(cross(d,right ));
    return d + right*uv.x*fov + up*uv.y*fov;
}

vec3 getNormal(vec3 p){
	vec2 t = vec2(0.001,0.);
    return normalize(
                    -vec3(
                    	map(p - t.xyy).x - map(p + t.xyy).x,
                    	map(p - t.yxy).x - map(p + t.yxy).x,
                    	map(p - t.yyx).x - map(p + t.yyx).x
                    )
                    );
}

    #define zoom 10.
vec3 render(vec3 ro, vec3 lookAt, vec2 uv, inout float t) {
    vec3 col = vec3(0);
    vec3 rd = getRd(ro, lookAt, uv);

    vec3 p = ro; float tL = 0.;
    rd.xz *= rot(0.1 - modTime*0.04);
    rd.yz *= rot(sin(iTime*0.6)*0.1);
    
    for (int i = 0; i < 100; i ++){
    	vec2 d = map(p);
        
        if(d.x < 0.002){
        	
            vec3 n = getNormal(p);
            
            vec3 lDir = normalize(vec3(1));
            
        	vec3 h = normalize(lDir - rd);
            
            float diff = max(dot(n, lDir), 0.);
            float spec = max(dot(n, h), 0.);
            float fres = pow(1. - max(dot(n, -rd), 0.), 3.);
            float fresB = pow(max(dot(n, -rd), 0.), 3.);
            float fresC = pow(max(dot(n, -rd), 0.)*1., 20.);
            
            //col += n*0.5 + 0.5;
            //col += mix(fresB*vec3(0,0.2,.9)*1., vec3(0.02,0.2,0.5), max(pow(fresC, 0.34) +0.15, 0.));
            col += fresB*vec3(0,0.34,.9)*1.;
            
            if (d.y==4.) {
            	col += fres*vec3(1.,1.,1)*2.;
            	col -= pow(fresC, 0.5)*vec3(0,0.34,.9)*1.;
            }else {
             	col += vec3(1)*pow(1. - max(dot(n, -rd), 0.), 2.);
            	col -= pow(fresC, 0.5)*vec3(0,0.34,.9)*1.;
            }
            break;
        }
        if (tL > 40.) {
        	break;
        }
    
        
        tL += d.x;
        p = ro + rd*tL;
    }
    
    t = tL;
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    initIcosahedron();
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    vec3 col = vec3(0);
    
    vec3 lookAt = vec3(0. + modDistX*0.5,0. + modTime*0.5 - modDistY*0.5,0. + modDistZ*0.5);
    vec3 ro = lookAt + vec3(sin(0.2 + sin(iTime*0.2)*0.15)*zoom, 0., cos(0.4)*zoom);
    ro.x += 3.4;
    float t = 0.;
    
    
    
    
    vec2 st =  0.5/iResolution.xy;
    col += render(ro, lookAt, uv, t);
    //col += render(ro, lookAt, uv + st, t);

    
    //col /= 2.;
    
    //col *= 1.;
    
    col = clamp(col, 0., 1.);
    col = mix(col, vec3(0.,0.05,0.8)*0.01, smoothstep(0.,1.,t*0.04));
    
    col *= 1. - pow(length(uv)*0.86 + 0.1, 2.)*1.;
    col = pow(col, vec3(0.45));
    
    
    

    fragColor = vec4(col,1.0);
}
`;

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
// All geodesic reflection functions and are from tdhooper! shadertoy.com/view/4tG3zW
// They are in common tab! 

// Buffer A is draw buffer
// Buffer B is TAA from https://www.shadertoy.com/view/4dSBDt


// These little guys really like fresnel :D

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec4 col = texture(iChannel1, uv);
    col *= 2.;
    fragColor = col;
}
`;

export default class implements iSub {
  key(): string {
    return 'WlKGRW';
  }
  name(): string {
    return 'Day 19 - Virus';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  common() {
    return common;
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
      { type: 1, f: buffB, fi: 1 }, //
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
