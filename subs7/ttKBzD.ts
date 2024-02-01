import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define R (iResolution.xy)
#define T(u) texture(iChannel0,(u)/R)
#define T1(u) texture(iChannel1,(u)/R)
#define T2(u) texture(iChannel2,(u)/R)
#define T3(u) texture(iChannel3,(u)/R)

#define TT(u,T) texture(T,(u)/res)

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))


#define kTimeCoeff 60./167.85*4.

vec2 getGradient(sampler2D tex, vec2 u, float offset, int channel, vec2 res){
    return vec2(
         TT(u + vec2(1,0)*offset,tex)[channel] - TT(u - vec2(1,0)*offset,tex)[channel],
         TT(u + vec2(0,1)*offset,tex)[channel] - TT(u - vec2(0,1)*offset,tex)[channel]  
    );
}
//#define Neighbordhood() vec4 me = T() 



float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

vec4 sharpen(sampler2D channel,vec2 fragCoord, vec2 resolution){
    float kernel [9];vec2 offset [9];
    
    vec2 step = vec2(1);
    
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
    
    vec4 sum = texture(channel, (fragCoord)/resolution);
    
    for (int i = 0; i < 9; i++) {
        vec4 color = texture(channel, (fragCoord + offset[i])/resolution);
        sum += color * kernel[i];
    }
    
    sum = clamp(sum,0.,1.);
    
    return sum;
}

vec4 blur(sampler2D channel,vec2 fragCoord, vec2 resolution){
    
    float kernel [9];vec2 offset [9];

     vec2 step = vec2(0.5);
    
    offset[0] = vec2(-step.x, -step.y);
    offset[1] = vec2(0.0, -step.y);
    offset[2] = vec2(step.x, -step.y);
    
    offset[3] = vec2(-step.x, 0.0);
    offset[4] = vec2(0.0, 0.0);
    offset[5] = vec2(step.x, 0.0);
    
    offset[6] = vec2(-step.x, step.y);
    offset[7] = vec2(0.0, step.y);
    offset[8] = vec2(step.x, step.y);
    
    kernel[0] = 1.0; kernel[1] = 1.0; kernel[2] = 1.0;
    kernel[3] = 1.0; kernel[4] = 1.0; kernel[5] = 1.0;
    kernel[6] = 1.0; kernel[7] = 1.0; kernel[8] = 1.0;
    
    vec4 sum = vec4(0);
    
    for (int i = 0; i < 9; i++) {
        vec4 color = texture(channel, (fragCoord + offset[i])/resolution);
        sum += color * kernel[i];
    }
    
    sum /= 9.;
    sum = clamp(sum,0.,1.);
    
    return sum;
}`;

const buffA = `
void mainImage( out vec4 C, in vec2 U )
{
    
    U -= 0.5*R;
    U *= 1. - fract(iTime*kTimeCoeff)*0.002;
    U *= rot(0.1*pow(fract(iTime*kTimeCoeff*0.125/2.),17.1)*0.1);
    
    U += 0.5*R;
    vec2 grad = getGradient( iChannel0, U, 3., 0, R);
    vec2 grady = getGradient( iChannel0, U, 3., 1, R);
    vec2 gradz = getGradient( iChannel0, U, 3., 2, R);
    //vec2 gradw = getGradient( iChannel0, U, 3., 3, R);
    
    //grad *= rot(.2);
    
    U -= grad*.2*sin(iTime);
    
    float id = floor(iTime*kTimeCoeff/10.); 
    float md = mod(iTime*kTimeCoeff, 10.);
    if(md < 1.){
        if (id == 0.){
            U -= grady*14.5;
        
        } else {
            U -= gradz*14.5;
    
        }
    }
    
    C = blur(iChannel0, U, R);

    
    if(iFrame%2100 == 0){
    
        C = 1. - C;
    }
    
    
    if(iFrame == 0){
        C = T3(U*0.2);
    }
}`;

const buffB = `
void mainImage( out vec4 C, in vec2 U )
{
    C = sharpen(iChannel0, U, R);
    
    vec2 uv = (U - 0.5*R)/R.y;   
    
    vec2 muv = (iMouse.xy - 0.5*R)/R.y;   
    if(iMouse.z > 0.)
        C = mix(C,pow(T2(U)*1.,vec4(5.)),smoothstep(0.01,0.,length(uv - muv) - .1));
    
    
    vec4 r = texture(iChannel2,(vec2(iFrame%256,floor(float(iFrame)/256.)) + 0.5 )/256.).xyzw;
    
    if(iFrame % 40 < 2){
        C = mix(C,vec4(0),
                smoothstep(0.01,0.,sdSegment( uv, vec2(r.x,r.y)*2. - 1., vec2(r.z,r.w)*2. - 1. ) - 0.0
            ));

    }
   
}
`;

const fragment = `
// blur and sharpen from https://www.shadertoy.com/view/MtdXW4

// LOOKS BETTER ON 144 HZ

void mainImage( out vec4 C, in vec2 U )
{
    C = C*0.;
    
    vec2 uv = (U - 0.5*R)/R.y;   
    
    //C += T1(U);
    C = T1(U);
    
    
    float md = kTimeCoeff;
    float fac = fract(iTime*md*0.25);
    
    fac = pow(fac,10.5)*smoothstep(1.,0.96,fac);
    C = mix(C.xxxx, C.yyyy,fac);
    
    //C = mix(C,T1(U).zxzy,dot(uv,uv)*0.1);

    
    float n1d = texelFetch(iChannel2,ivec2(mod(U + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(U  + n1d*200. ,256.)),0).xyz;
    
    C.xyz = pow(max(C.xyz,0.), vec3(1.,1.,1.) + dot(uv,uv)*0.6);
    
    
    
    
    C.xyz += smoothstep(1.,0.,length(C))*n*0.1;
    
    C.xyz -= smoothstep(0.,1.,length(C))*n*0.05;
    
    if(mod(iTime*kTimeCoeff,10.) < 1.){
        C = 1. - C;
    }
    
}
`;

export default class implements iSub {
    key(): string {
        return 'ttKBzD';
    }
    name(): string {
        return '空';
    }
    // sort() {
    //     return 0;
    // }
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
    common() {
        return common;
    }
    channels() {
        return [
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 0 },
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
        ];
    }
    webgl() {
        return WEBGL_2;
    }
}
