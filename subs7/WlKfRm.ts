import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define R (iResolution.xy)
#define T(u) texture(iChannel0,fract((u)/R))
#define T1(u) texture(iChannel1,fract((u)/R))
#define T2(u) texture(iChannel2,fract((u)/R))
#define T3(u) texture(iChannel3,fract((u)/R))

#define TT(u,T) texture(T,fract((u)/res))

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pi acos(-1.)

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
    vec2 uv = (U - 0.5*R)/R.y;   
    
    vec2 OU = U;
    U += 0.25;
    //U -= 0.5*R;   
    //U *= 1. - fract(iTime*kTimeCoeff)*0.002;
    //U *= rot(0.1*pow(fract(iTime*kTimeCoeff*0.125/2.),17.1)*0.1);
    
    //U *= 1. - dot(uv,uv)*0.001;
    //U += 0.5*R;
    //vec2 grady = getGradient( iChannel0, U, 3., 1, R);
    //vec2 gradz = getGradient( iChannel0, U, 3., 2, R);
        
    
    float neighrange = 25. - sin(iTime*0.25)*5.;
    neighrange *= 0.65;
    vec2 muv = (iMouse.xy - 0.5*R)/R.y;   
    
    if(iMouse.z > 0.)
        neighrange *= 1. + 1.*smoothstep(0.01,0.,length(uv - muv) - .3);

    
    
    vec2 grad = getGradient( iChannel0, U, neighrange*0.4, 0, R);
       
    
    
    
      
    float neighs = 0.;
    
    float iiters = 64.*0.5;            
    float jiters = 64.*0.5;
    
    for(float i = 0.; i < iiters; i++){
        vec2 p = U; 
        
        vec2 offs = vec2(0,1.)*rot(2.*pi*(i + 0.)/iiters);
        
        float samp = 0.;
        float jiters = 16.;
        for(float j = 0.; j < jiters; j++){
            vec2 ioffs = p + offs*mix(neighrange*0.2,neighrange,j/jiters);
            samp += texture(iChannel0,fract(ioffs/R),0.5).x/jiters;
        
        }
        
        neighs += samp/iiters*4.;
    }
   
    C = T(U);
    
    float deadness = smoothstep(1.,0.,abs(C.x));
    float aliveness = smoothstep(0.,1.,abs(C.x));
    //deadness = 1. - C.x;
    //aliveness = C.x;
    
    //U += grad*.01*smoothstep(1.8,0.1,abs(neighs - 3.))*aliveness;
    //U += grad*1.9*smoothstep(2.4,1.,abs(neighs - 2.))*aliveness;
    
    
    
    C = T(U);
    
    //deadness = smoothstep(1.,0.,abs(C.x));
    //aliveness = smoothstep(0.,1.,abs(C.x));
    //deadness = 1. - C.x;
    //aliveness = C.x;
    
    
    
    float speed = 0.8;
    C = mix(C,vec4(0),smoothstep(.5,0.,neighs - 1.)*aliveness*speed);
    C = mix(C,vec4(0),smoothstep(-0.125,0.,neighs - 3.)*aliveness*speed);
    
    
    C = mix(C,vec4(1),
            smoothstep(0.5,0.,abs(neighs - 2.5))*
        deadness*
        speed);
    
    
    //vec2 gradw = getGradient( iChannel0, U, 3., 3, R);
    
    //grad *= rot(.2);
    
    //U += grad[(iFrame/30)%0]*.1*sin(iTime);
    
    
    //if(iMouse.z > 0.)
    
    //C = blur(iChannel0, U, R);
    
    
    
    if(iFrame%4 > 0){
        //C = T(OU);
    }
    
    
    if(iFrame == 0){
        C = T3(U*2.2);
    }
}`;

const buffB = `
void mainImage( out vec4 C, in vec2 U )
{
    vec4 fr = texture(iChannel0,(U)/iResolution.xy);
   
    float r = 17.4
        + sin(fr.x*2. - 1.)*1.4;
    int didx = 0;
    
    vec2 dfn = vec2(T(U + vec2(1.,0)*r)[didx] - T(U - vec2(1.,0)*r)[didx],T(U + vec2(0.,1)*r)[didx] - T(U - vec2(0.,1)*r)[didx]);
    
    vec2 sc = vec2(0)
        + pow(smoothstep(0.,1.,length(dfn.xy)*4.),.2)*.15*dfn;
    
    
    
    C.x =texture(iChannel0,(U + sc*vec2(0,2))/iResolution.xy).x;
    
    C.y =texture(iChannel0,(U + sc*vec2(0,-5))/iResolution.xy).y;
    
    C.z =texture(iChannel0,(U + sc*vec2(5,-5.))/iResolution.xy).z;
    
}`;

const fragment = `
// Fork of "Day 431" by jeyko. https://shadertoy.com/view/ttKBzD
// 2021-02-23 15:15:41

// tried to make a continous Game of Life
// ended up being too wormy to be Game of Life, but cool in its own right! 

void mainImage( out vec4 C, in vec2 U )
{
    C = C*.0;
    
    vec2 uv = (U - 0.5*R)/R.y;   
    
    //C += T1(U);
    C = T1(U);
    
    
    
    
    float n1d = texelFetch(iChannel2,ivec2(mod(U + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(U  + n1d*200. ,256.)),0).xyz;
    
    
    C *= 1. - dot(uv,uv*0.25);
    C = smoothstep(0.,1.,C);
    
    C.xyz = pow(max(C.xyz,0.), vec3(0.55) + dot(uv,uv)*0.6);
    
    
    
    C.xyz += smoothstep(1.,0.,length(C))*n*0.15;
    
    C.xyz -= smoothstep(0.,1.,length(C))*n*0.05;
    
    
}
`;

export default class implements iSub {
    key(): string {
        return 'WlKfRm';
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
    webgl() {
        return WEBGL_2;
    }
    channels() {
        return [
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 1 },
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
        ];
    }
}
