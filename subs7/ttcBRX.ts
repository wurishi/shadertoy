import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define R (iResolution.xy)
#define T(U) texture(iChannel0, (U)/R)
#define T1(U) texture(iChannel1, (U)/R)
#define T2(U) texture(iChannel2, (U)/R)
#define T3(U) texture(iChannel3, (U)/R)`;

const buffA = `
void xch( inout vec4 C, inout vec4 othera, inout vec4 otherb, float positiona, float positionb){
    if(C[int(positiona)] < othera[int(positionb)]){
        C = othera;
        othera = C;
    } else if(C[int(positiona)] > otherb[int(positionb)]){
        C = otherb;
        otherb = C;
    }
}

//vec2 getGradient(vec4 C,vec4 n,vec4 s,vec4 e,vec4 w, vec4 indices){
vec2 getGradient(vec4 C, vec2 U, vec4 indices){
    float range = 2.;
    vec4 n = T(U + vec2(0,1)*range);
    vec4 s = T(U - vec2(0,1)*range);
    vec4 e = T(U + vec2(1,0)*range);
    vec4 w = T(U - vec2(1,0)*range);
    
    return vec2(n[int(indices.x)] - s[int(indices.y)], e[int(indices.z)] - w[int(indices.w)]);
}

void mainImage( out vec4 C, in vec2 U )
{
    vec2 muv = (iMouse.xy - 0.5*R)/R.y;
    vec2 uvn = (U.xy - 0.5*R)/R.y;
    vec2 uv = U/R;

    //vec2 grad = getGradient(C, n, s, e, w, vec4(1,1,1,1));
    
    
    vec2 grad = getGradient(C, U, vec4(2,2,2,2));
    
    U -= grad*(1. + sin(iTime*2.)*2.);
    
    
    C = T(U );
    

    float m = mod(float(iFrame),3.);
    
    float range = 1. + m*1.;
    vec4 n = T(U + vec2(0,1)*range);
    vec4 s = T(U - vec2(0,1)*range);
    vec4 e = T(U + vec2(1,0)*range);
    vec4 w = T(U - vec2(1,0)*range);
    
    xch(C,e,n,0. + m,1.);
    xch(C,n,w,3. - m,2. - m);
    xch(C,e,s,1. + m,1. - m);
    xch(C,n,w,1. + m,4.);
    xch(C,w,e,2. - m,1. + m);
    xch(C,w,n,2. - m,3.);
    xch(C,e,w,1. + m,4.);
    xch(C,n,s,3. - m,4.);
    xch(C,s,e,2. - m,2.);
    
    if(iFrame % 20 < 1){
        //xch(C,n,w,1,2);
    
    }
    
    if(length(grad) < 0.001 )
        C = mix(C,T1(U + float(iFrame)*R*0.01),1.);
    /*
    if(C.x < e.y){
        C = e;
    } else if(C.y > w.x){
        C = w;
    }
    */
    if( false &&iMouse.z != 0. && length(muv - uvn) < 0.2 ){
        if(C.x < e.y){
            C = e;
        } else if(C.y > w.x){
            C = w;
        }
        
        if(C.z < e.w){
            C = e;
        } else if(C.w > w.z){
            C = w;
        }
    
    }
    
    
    C = mix(C,abs(sin(C*100.))*1.,0.01);
    
    if(iFrame % 3 == 0){
        C = T(U);
    
    }
    
    if(iFrame == 1){
        C = T1(U);
    }
}`;

const fragment = `
void mainImage( out vec4 C, in vec2 U )
{
    vec2 uv = U/R;

    C = 0.5 + 0.5*sin(T(U*0.5*2.)*111. + vec4(3,2,2,3) + iTime*0.1);
}
`;

export default class implements iSub {
    key(): string {
        return 'ttcBRX';
    }
    name(): string {
        return 'Pixels do what pixels gotta do';
    }
    // sort() {
    //     return 0;
    // }
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
        return [{ type: 1, f: buffA, fi: 0 }, webglUtils.DEFAULT_NOISE];
    }
    common() {
        return common;
    }
}
