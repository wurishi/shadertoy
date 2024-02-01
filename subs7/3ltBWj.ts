import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
float r11(float i){ return fract(sin(i*15.126)*115.6);}

float ss( float c, float power, float bias){
    c = clamp(c,-0.,1.);
    //c = smoothstep(0.,1.,c);
    
    c = pow(c,1. + bias);
    
    float a = pow( abs(c), power);
    float b = 1.-pow( abs(c - 1.), power);
    
    return mix(a,b,c);
}

float valueNoise(float i, float p){ return mix(r11(floor(i)),r11(floor(i) + 1.), ss(fract(i), p,0.6));}

float valueNoiseStepped(float i, float p, float steps){ return mix(  floor(r11(floor(i))*steps)/steps, floor(r11(floor(i) + 1.)*steps)/steps, ss(fract(i), p,0.6));}

#define kSegment (floor(mod(iTime,15.)/7.5))

#define pi acos(-1.)

#define R (iResolution.xy)
#define T(u) texture(iChannel2,(u)/R)
#define T0(u) texture(iChannel0,(u)/R)

//#define sino(a) sin(a)
#define sint(a) (asin(sin(a))*2. - 1.)*0.4
#define cost(a) (acos(cos(a - 3.14*0.3))*2. - 1.)*0.3

//#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pmod(p,d) mod(p - (d)*0., (d)) - 0.5*(d)

#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + (e)))

vec2 r12(float i){float r=r11(i );  return vec2(r,r11(i + r + 2.));}

#define xor(a,b,c) min(max((a),-(b)), max((b),-(a) - c)) 
#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + (e)))
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pi acos(-1.)

mat3 getOrthogonalBasis(vec3 direction){
    direction = normalize(direction);
    vec3 right = normalize(cross(vec3(0,1,0),direction));
    vec3 up = normalize(cross(direction, right));
    return mat3(right,up,direction);
}
float cyclicNoise(vec3 p, bool turbulent, float time){
    float noise = 0.;
    
    p.yz *= rot(2.5);
    p.xz *= rot(-2.5);
    float amp = 1.5;
    float gain = 0.7 + sint(p.x*1.5 + time)*0.;
    const float lacunarity = 1.2;
    const int octaves = 4;
    
     float warp = .1 + sin(time*0.5)*0.05;
    float warpTrk = 1.5 ;
    const float warpTrkGain = 1.1;
    
    vec3 seed = vec3(-1,-2.,0.5);
    mat3 rotMatrix = getOrthogonalBasis(seed);
    
    for(int i = 0; i < octaves; i++){
        
        p -= sint(p.zxy*warpTrk + vec3(0,-time*0.2,0) - 0.01*warpTrk)*warp; 
        noise += sint(dot(cost(p), sint(p.zxy + vec3(0,time*0.1,0))))*amp;
    
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



float cyclicNoiseB(vec3 p, bool turbulent, float time){
    float noise = 0.;
    
    p.yz *= rot(1.);
    float amp = 1.;
    float gain = 0.8 + sin(p.z*0.2)*0.2;
    const float lacunarity = 1.6;
    const int octaves = 2;
    
    const float warp =.4;    
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

vec3 sdgBox( in vec2 p, in vec2 b )
{
    vec2 w = abs(p)-b;
    vec2 s = vec2(p.x<0.0?-1:1,p.y<0.0?-1:1);
    float g = max(w.x,w.y);
    vec2  q = max(w,0.0);
    float l = length(q);
    return vec3(   (g>0.0)?l  :g,
                s*((g>0.0)?q/l:((w.x>w.y)?vec2(1,0):vec2(0,1))));
}


float sdSq(vec2 p, vec2 s){
    p = abs(p) - s;
    return max(p.x,p.y);
}


float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h); }`;

const buffA = `
    float envcnt = 0.;
    
    float getEnv(float t, float speed, float pa, float pb, float jumpAmt, bool cnt){
        //return pow(sin((t - 0.5)*3.14),1.)*0.5 + 0.5;
        t = clamp(t*speed,0.,1.);
        
        envcnt += float(t > 0.99 && cnt);
        //t = smoothstep(0.,1.,t);
        pa += 1.;
        pb += 1.;
        
        float c = cos(t*3.14);
        float a = 1.- ((pow(abs(c),pa)*sign(c))*0.5 + 0.5);
        float b = 1.-((pow(abs(c),pb)*sign(c))*0.5 + 0.5);
        
        a = pow(sin(t*3.14/2.),pa);
        b = 1.-pow(sin((-t + 1.)*3.14/2.),pb);
        
        b *= 1. + (
                smoothstep(0.,1.,t) *smoothstep(0.99,0.7,t)*jumpAmt
            );
        return mix( a, b,t);
    }
    
    
    void mainImage( out vec4 C, in vec2 U )
    {
        vec2 uv = (U - 0.5*iResolution.xy)/iResolution.y;
    
        vec3 col = vec3(1.);
        
        
        float segmentMod =  + sin(floor(kSegment))*20.;
        
        float vn = valueNoise(iTime + uv.x*0.01 + segmentMod, 2.)*1.;
        float t = iTime*1.3 - vn + 2. + segmentMod;
            
        float env = getEnv(t, 1., 2., 2., 1., false);
        
        vec2 offs = vec2(sin(t)*0.5,cos(t*0.6)*1.6) ;
        
        vec2 ouv = uv;
        uv -= offs*0.3;
        float nb = cyclicNoise(vec3(uv*1.5 + t*0. + offs*0.4,t*0.2), false, t*0.);
        
        float n = cyclicNoise(vec3(uv*(6.5- dot(ouv,ouv)*2.),t*0.5 - nb*4.) , false, t*1.);
        //nb*=1.;
    
    
        //n = abs(n - 1. )*1. ;
        //n -= 1. ;
        
        //nb *= 0.5;
        float r = .6 - n*2. + nb*4.;
        int didx = 3;
        vec2 dfn = vec2(T(U + vec2(1.,0)*r)[didx] - T(U - vec2(1.,0)*r)[didx],T(U + vec2(0.,1)*r)[didx] - T(U - vec2(0.,1)*r)[didx])*2.;
    
        r = 15. - n*0. + nb*4.;
        didx = 1;
        
        vec2 dfnb = vec2(T(U + vec2(1.,0)*r)[didx] - T(U - vec2(1.,0)*r)[didx],T(U + vec2(0.,1)*r)[didx] - T(U - vec2(0.,1)*r)[didx]);
        
        
        //col += 1.-abs(length(dfn.xyx))*4.;
        
        col = mix(col,0.1*vec3(0.,0.,0.1 + 0.2*sin(nb*10.)*0.2),smoothstep(-.15,0.01,-length(dfn)));
        
        vec3 c = vec3(0.+ sin(length(dfnb)*5. + iTime+ n*10.)*0.4+ sin(dfn.x*10.)*0.3 ,0.1 + n*0.05 + sin(nb*20. + t)*0.05 ,0.1  );
        c *= .9;
        //col = mix(col,c*3.,smoothstep(0. + n*0. + nb*0.0,0.0 + length(dfnb)*4.,length(dfnb.xy)));
        
        
        
        
        
        C = vec4(col,n);
    }`;

const buffB = `
    void mainImage( out vec4 C, in vec2 U )
    {
        vec4 fr = texture(iChannel0,(U)/iResolution.xy);
       
        float r = 1. 
            + sin(fr.w*5.)*1.5
            + sin(fr.x*1.)*.2;
        int didx = 3;
        
        vec2 dfn = vec2(T0(U + vec2(1.,0)*r)[didx] - T0(U - vec2(1.,0)*r)[didx],T0(U + vec2(0.,1)*r)[didx] - T0(U - vec2(0.,1)*r)[didx]);
        
        vec2 sc = vec2(0)
            + pow(smoothstep(0.,1.,length(dfn.x)*9.),0.6)*.6;
        
        sc *= dfn*15.;
        
        
        C.x =texture(iChannel0,(U + sc*vec2(0,9))/iResolution.xy).x;
        
        C.y =texture(iChannel0,(U + sc*vec2(0,-4))/iResolution.xy).y;
        
        C.z =texture(iChannel0,(U + sc*vec2(-3,-5))/iResolution.xy).z;
        
        
    }`;

const buffC = `// Fork of "Day 424" by jeyko. https://shadertoy.com/view/wldfDB
    // 2021-02-16 09:06:35
    
    // dont fullscreen
    
    void mainImage( out vec4 C, in vec2 fragCoord )
    {
        fragCoord -= 0.5*iResolution.xy;
        //fragCoord *= 0.99;
        fragCoord += 0.5*iResolution.xy;
        
        float n1d = texelFetch(iChannel1,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
        
        C -= C;
    
        vec4 bloom = vec4(0);
        //bloom += texture(iChannel0,fragCoord/R,0.);
        //bloom += texture(iChannel0,fragCoord/R,1.);
        bloom += texture(iChannel0,fragCoord/R,1.);
        //bloom += texture(iChannel0,fragCoord/R,3.);
        bloom += texture(iChannel0,fragCoord/R,4.);
        bloom += texture(iChannel0,fragCoord/R,5.);
        bloom += texture(iChannel0,fragCoord/R,6.);
        bloom += texture(iChannel0,fragCoord/R,7.);
        bloom += texture(iChannel0,fragCoord/R,6.);
        bloom += texture(iChannel0,fragCoord/R,9.);
        bloom += texture(iChannel0,fragCoord/R,12.);
        
        //bloom = smoothstep(0.4,1.,1.7*bloom/8.)*2.;
        bloom/=6.;
        C = bloom;
    }`;

const buffD = `// Fork of "Day 424" by jeyko. https://shadertoy.com/view/wldfDB
    // 2021-02-16 09:06:35
    
    // dont fullscreen
    
    void mainImage( out vec4 C, in vec2 fragCoord )
    {
        fragCoord -= 0.5*iResolution.xy;
        //fragCoord *= 0.99;
        fragCoord += 0.5*iResolution.xy;
        
        float n1d = texelFetch(iChannel1,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
        
        C -= C;
    
        vec4 bloom = vec4(0);
        //bloom += texture(iChannel0,fragCoord/R,0.);
        //bloom += texture(iChannel0,fragCoord/R,1.);
        bloom += texture(iChannel0,fragCoord/R,0.);
        //bloom += texture(iChannel0,fragCoord/R,3.);
        bloom += texture(iChannel0,fragCoord/R,4.);
        bloom += texture(iChannel0,fragCoord/R,5.);
        bloom += texture(iChannel0,fragCoord/R,6.);
        bloom += texture(iChannel0,fragCoord/R,7.);
        bloom += texture(iChannel0,fragCoord/R,6.);
        bloom += texture(iChannel0,fragCoord/R,9.);
        bloom += texture(iChannel0,fragCoord/R,9.);
        
        
                
        bloom = smoothstep(0.4,1.5,1.5*bloom/8.)*1.;
        
        
        C = texture(iChannel1,fragCoord/R);
        
        C = mix(C,bloom*1.4,pow(smoothstep(0.,1.,length(bloom)),2.)*0.2);
                
        if(kSegment > 0.5){
            C = 0.8 - C*0.8;
        }
    }`;

const fragment = `
// Fork of "Day 424" by jeyko. https://shadertoy.com/view/wldfDB
// 2021-02-16 09:06:35

// dont fullscreen

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord -= 0.5*iResolution.xy;
    //fragCoord *= 0.99;
    fragCoord += 0.5*iResolution.xy;
    
    float n1d = texelFetch(iChannel1,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel1,ivec2(mod(fragCoord  + n1d*200. ,256.)),0).xyz;
    
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    fragColor.xyz =texture(iChannel0,fragCoord/iResolution.xy).xyz;
    
    
    fragColor.xyz *= 1. - dot(uv,uv)*0.2;
    fragColor.xyz = pow(max(fragColor.xyz,0.), vec3(1.15,1.1,1.15));
    
    //fragColor.xyz = 1. - fragColor.xyz;
    
    fragColor.xyz = pow(fragColor.xyz, vec3(0.4545 + n*0.05));
    
    
    
    //fragColor = texture(iChannel2,fragCoord/iResolution.xy);
    
    
    
    fragColor.xyz += smoothstep(1.,0.,length(fragColor))*n*0.04;
    
    fragColor.xyz -= smoothstep(0.,1.,length(fragColor))*n*0.05;
       
}
`;

export default class implements iSub {
    key(): string {
        return '3ltBWj';
    }
    name(): string {
        return 'day 425';
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
            { type: 1, f: buffB, fi: 1 },
            { type: 1, f: buffC, fi: 2 },
            { type: 1, f: buffD, fi: 3 },
        ];
    }
    webgl() {
        return WEBGL_2;
    }
}
