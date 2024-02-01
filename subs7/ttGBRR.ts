import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
 

mat3 getOrthogonalBasis(vec3 direction){
    direction = normalize(direction);
    vec3 right = normalize(cross(vec3(0,1,0),direction));
    vec3 up = normalize(cross(direction, right));
    return mat3(right,up,direction);
}


float cyclicNoise(vec3 p, bool turbulent, float time){
    float noise = 0.;
    
    float amp = 1.;
    const float gain = 0.9;
    const float lacunarity = 1.5;
    const int octaves = 6;
    
    const float warp = 0.2;    
    float warpTrk = 1.5 ;
    const float warpTrkGain = .2;
    
    vec3 seed = vec3(-1,-2.,0.5);
    mat3 rotMatrix = getOrthogonalBasis(seed);
    
    for(int i = 0; i < octaves; i++){
        
        p += sin(p.zxy*warpTrk + vec3(0,-time*2.,0) - 2.*warpTrk)*warp; 
        noise += sin(dot(cos(p), sin(p.zxy + vec3(0,time*0.3,0))))*amp;
    
        p *= rotMatrix;
        p *= lacunarity;
        
        warpTrk *= warpTrkGain;
        amp *= gain;
    }
    
    if(turbulent){
        return 1. - abs(noise)*0.5;
    
    }{
        return (noise*0.25 + 0.5);

    }
}

float cyclicNoiseMarb(vec3 p, bool turbulent, float time){
    float noise = 0.;
    
    float amp = 1.;
    const float gain = 0.6;
    const float lacunarity = 1.75;
    const int octaves = 9;
    
    const float warp = 0.7;    
    float warpTrk = 2. ;
    const float warpTrkGain = 1.09;
    
    vec3 seed = vec3(-5,-2.,0.5);
    mat3 rotMatrix = getOrthogonalBasis(seed);
    
    for(int i = 0; i < octaves; i++){
        
        p += sin(p.zxy*warpTrk + vec3(0,-time*2.,0) - 2.*warpTrk)*warp; 
        noise += sin(dot(cos(p), sin(p.zxy + vec3(0,time*0.3,0))))*amp;
    
        p *= rotMatrix;
        p *= lacunarity;
        
        warpTrk *= warpTrkGain;
        amp *= gain;
    }
    
    if(turbulent){
        return 1. - abs(noise)*0.5;
    
    }{
        return (noise*0.25 + 0.5);

    }
}

float cyclicNoiseMarbB(vec3 p, bool turbulent, float time){
    float noise = 0.;
    
    float amp = 1.;
    const float gain = 0.6;
    const float lacunarity = 1.75;
    const int octaves = 5;
    
    const float warp = .9;
    float warpTrk = 1. ;
    const float warpTrkGain = 1.09;
    
    vec3 seed = vec3(-5,-2.,0.5);
    mat3 rotMatrix = getOrthogonalBasis(seed);
    
    for(int i = 0; i < octaves; i++){
        
        p += sin(p.zxy*warpTrk + vec3(0,-time*2.,0) - 2.*warpTrk)*warp; 
        noise += sin(dot(cos(p), sin(p.zxy + vec3(0,time*0.3,0))))*amp;
    
        p *= rotMatrix;
        p *= lacunarity;
        
        warpTrk *= warpTrkGain;
        amp *= gain;
    }
    
    if(turbulent){
        return 1. - abs(noise)*0.5;
    
    }{
        return (noise*0.25 + 0.5);

    }
}
`;

const fragment = `
// :)
// in the vibe of https://twitter.com/beesandbombs

#define pi acos(-1.)
#define tau (2.*pi)
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define dmin(a,b) a.x < b.x ? a : b
#define preplim(g,c,l) g-c*clamp(round((g)/c),-l,l)
#define xor(a,b,c) min(max(a,-b), max(-a,b + c))



float pixSz;

// Hex code from BigWings! He has a tutorial on them.
float HexDist(vec2 p) {
	p = abs(p);
    float c = dot(p, normalize(vec2(1,1.73)));
    c = max(c, p.x);
    return c;
}

vec4 HexCoords(vec2 uv, out vec2 gv) {
	vec2 r = vec2(1, 1.73);
    vec2 h = r*.5;
    vec2 a = mod(uv, r)-h;
    vec2 b = mod(uv-h, r)-h;
    gv = dot(a, a) < dot(b,b) ? a : b;
    float x = atan(gv.x, gv.y);
    float y = .5-HexDist(gv);
    vec2 id = uv-gv;
    return vec4(x, y, id.x,id.y);
}


float sdBox(vec2 p, vec2 s){
    p = abs(p) - s; return max(p.x, p.y);
}
void getTile( vec2 p, out float d, inout vec3 col, vec2 gv, vec4 hc){
    vec2 op = p;
    for(float i = 0.; i < 3.; i++){
        float t = iTime - i*.05;
        p = op;
        
        float m =   + 0.3*sin( hc.z*1. + sin(hc.w + t)*0.4)*sin(t) + .4*( length(hc.zw) + sin(length(hc.w)*0.));
        p *= rot(0. 
            + m - length(hc.zw)*0.9
            + t*3.);

        p.y += 0.5;
        p.x -= sin(hc.w)*.5*(sin(m*1.14));
        d = length(p) - sin(m*2. + t)*0.04 - 0.05;

        col[int(i)] = mix( col[int(i)], 1., smoothstep(pixSz*2.,0.,d));
    
    }
    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 col = vec3(0);
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    vec2 ouv = uv;
    
    uv *= 31.;
    
    //uv.y += iTime*0.5;
    
    pixSz = fwidth(uv.x);
    
    vec2 gv;
    vec4 hc = HexCoords(uv, gv);
    /*
    float d = map(gv);
    col += smoothstep(pixSz,0.,abs(d));
    */
    for(float i = 0.; i < 7.; i++){
        vec2 offs = vec2(0);
        
        float ioffs = 0.;
        if(i < 3. ){
            float offsIdx = tau*(i + ioffs)/6.;
            offs = vec2(sin(offsIdx),cos(offsIdx))*0.5;
        } else if( i == 3.) {
        
        } else if( i == 4. || i == 5.){
            float offsIdx = tau*(i + ioffs - 1. + float(i == 5.)  )/6.;
            offs = vec2(sin(offsIdx),cos(offsIdx))*0.5;
        
        } else if( i == 6.){
            float offsIdx = tau*(i + ioffs - 2.)/6.;
            offs = vec2(sin(offsIdx),cos(offsIdx))*0.5;
        }
        
        vec4 hc = HexCoords(uv + offs, gv);
        
        float d; 
        getTile(gv - offs, d, col, uv - offs, hc);
        
        
        
    }
    
    
    
    col = max(col,0.);
    col = mix(col,col*col*0.0,pow(smoothstep(0.,1.,dot(ouv,ouv)),1.5));

    col *= vec3(1.,1.,1.);
    
    if( mod(iTime/10.,1.) > 0.66)
        col = 1. - col;
    if(iMouse.z > 0.5)
        col = 1. - col;
    col = pow(col,vec3(0.454545));
    
    
    fragColor.xyz += col;
    fragColor.a = 1.;
}
`;

export default class implements iSub {
    key(): string {
        return 'ttGBRR';
    }
    name(): string {
        return 'day 428';
    }
    sort() {
        return 770;
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
    common() {
        return common;
    }
    webgl() {
        return WEBGL_2;
    }
    channels() {
        return [webglUtils.TEXTURE9];
    }
}
