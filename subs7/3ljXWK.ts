import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Sparkling Cookie
// https://cookie.paris/
// Leon Denise (ponk) 2019.08.30
// Licensed under hippie love conspiracy

// tweak zone
const float count = 15.;
float scale = .9;
float thin = 0.002;
float ditherRange = .5;
float radiusVariation = .005;
float variationFrequecy = 16.;

// tool box
#define TAU 6.283
#define repeat(p,r) (mod(p,r)-r/2.)
float random(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
mat2 rot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

// generated with discrete Fourier transform
vec2 cookie(float t) {
	return vec2(0.08+cos(t-1.58)*0.23+cos(t*2.-1.24)*0.14+cos(t*3.-1.12)*0.09+cos(t*4.-0.76)*0.06+cos(t*5.-0.59)*0.05+cos(t*6.+0.56)*0.03+cos(t*7.-2.73)*0.03+cos(t*8.-1.26)*0.02+cos(t*9.-1.44)*0.02+cos(t*10.-2.09)*0.03+cos(t*11.-2.18)*0.01+cos(t*12.-1.91)*0.02,cos(3.14)*0.05+cos(t+0.35)*0.06+cos(t*2.+0.54)*0.09+cos(t*3.+0.44)*0.03+cos(t*4.+1.02)*0.07+cos(t*6.+0.39)*0.03+cos(t*7.-1.48)*0.02+cos(t*8.-3.06)*0.02+cos(t*9.-0.39)*0.07+cos(t*10.-0.39)*0.03+cos(t*11.-0.03)*0.04+cos(t*12.-2.08)*0.02);
}

vec2 camera2D (vec2 uv) {
    vec2 mouse = iMouse.xy/iResolution.xy*2.-1.;
    vec3 p = vec3(uv,0);
    if (iMouse.z > 0.5) {
        p.yz *= rot(mouse.y*3.1415/2.);
        p.xz *= rot(mouse.x*3.1415/2.);
    }
    return p.xy/(1.+p.z);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0);
    vec2 uv = .6*(fragCoord-.5*iResolution.xy)/iResolution.y+vec2(.05,.05);
    float dither = random(uv+fract(iTime))/count*TAU*scale*ditherRange;
    for (float index = count; index > 0.; --index) {
   		float time = dither + index/count*TAU*scale - iTime;
        vec2 pos = camera2D(cookie(time));
        float dist = max(0.,length(uv-pos)-radiusVariation*sin(time*variationFrequecy));
        fragColor += vec4(thin/dist);
    }
    
    vec4 frame = texture(iChannel0, fragCoord/iResolution.xy);
    fragColor = max(frame*(1.-iTimeDelta*2.), clamp(fragColor,0.,1.));
    fragColor.a = 1.;
}`;

const fragment = `
// Sparkling Cookie
// https://cookie.paris/
// Leon Denise (ponk) 2019.08.30
// Licensed under hippie love conspiracy

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = texture(iChannel0, fragCoord/iResolution.xy);
    fragColor.a = 1.;
}
`;

export default class implements iSub {
    key(): string {
        return '3ljXWK';
    }
    name(): string {
        return 'Sparkling Cookie';
    }
    sort() {
        return 744;
    }
    tags?(): string[] {
        return [];
    }
    main(): HTMLCanvasElement {
        return createCanvas();
    }
    userFragment(): string {
        return buffA;
    }
    fragmentPrecision?(): string {
        return PRECISION_MEDIUMP;
    }
    webgl() {
        return WEBGL_2;
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {};
    }
    // channels() {
    //     return [
    //         {
    //             type: 1,
    //             f: buffA,
    //             fi: 0,
    //         },
    //     ];
    // }
}
