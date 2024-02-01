import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define pi acos(-1.)


#define sint(a) (asin(sin(a))*2. - 1.)

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pmod(p,d) mod(p - (d)*0., (d)) - 0.5*(d)

#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + (e)))

float r11(float i){ return fract(sin(i*15.126)*115.6);}

vec2 r12(float i){float r=r11(i );  return vec2(r,r11(i + r + 2.));}

#define xor(a,b,c) min(max((a),-(b)), max((b),-(a) - c)) 

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
    
    p.yz *= rot(1.5);
    float amp = 1.;
    float gain = 0.8 + sin(p.z*0.2)*0.2;
    const float lacunarity = 1.6;
    const int octaves = 5;
    
    const float warp =.2;    
    float warpTrk = 1.5 ;
    const float warpTrkGain = .2;
    
    vec3 seed = vec3(-4,-2.,0.5);
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
    
    vec3 seed = vec3(-4,-2.,0.5);
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

    #define sdfTrail(sdf,tpos,tdisp,variable, width)  {                           \
            vec2 circGrad = tpos(iTime - tdisp) - tpos(iTime - tdisp*2.) ;                     \
            circGrad *= rot(0.5*pi);                                              \
            vec3 circB =  sdf( p + tpos(iTime)  );                                \
            vec3 circBold = sdf( p + tpos(iTime - tdisp) ) + width*0.5;                         \
            vec2 rotUv = (p + tpos(iTime-0.1))*rot(-atan(circGrad.y,circGrad.x)); \
            circBold -= 9.*cyclicNoiseB(vec3(rotUv.x,1. +  floor(iTime*140.)*0.001,2)*42., false, floor(iTime*10.)*20.)*smoothstep(0.4,0.1,rotUv.y ) \
                *smoothstep(0.,0.9,length(circGrad))*0.1                          \
                * smoothstep(0.4,-0.3,circBold.x);                                \
            variable.x = opSmoothUnion(circB.x,circBold.x,0.2);                     \
        }
        
        #define getCircB(t) vec2(0.1 + sin((t)*2.5)*0.5,0. + sin((t)*4.)*0.2)
        
    
    float palIdx = 0.;
    
    vec3 sdgCircle( in vec2 p, in float r ) 
    {
        float d = length(p);
        return vec3( d-r, p/d*smoothstep(1.,0.,abs(d)/r) );
    }
    
    
    
    float noise(vec2 fragCoord){
        int idx = iFrame/15;
        return texture(iChannel0,(fragCoord + sin(float(idx)*20.)*10.)/256.,0.4)[idx%2];
    }
    
    const float palA = 0.5;
    const vec3 palB = 0.5*vec3(1.,0.7,0.4);
    const vec3 palC = vec3(4,2,2);
    const float palD = 1.;
    
    void draw( vec2 uv, vec2 fragCoord,inout vec3 col, float d, vec2 grad, float palOffs, bool isPal, bool isXor){
        
        float n = cyclicNoise(vec3(uv,2)*92., false, floor(iTime*10.))*0.004;
        float grain = noise(fragCoord);
        float df = dFdx(uv.x)*1. + n*0.5;
        
        palIdx += palOffs + d*(0.2 + 3.*float(palIdx!=0.)) - smoothstep(0.04,0.0,abs(d))*0.1 + n*10. - grain*.42;
        
        vec3 c = pal(palA,palB,palC,palD,palIdx);
        
        d -= n;
        
        vec3 shadc = c*.9;
        shadc.xz *= rot(0.2);
        shadc.xy *= rot(.3);
        
        float dots =  smoothstep(-3.,5.,dot(grad,vec2(-1.)) - d*2.);
        c = mix(c,shadc,
            smoothstep(0.3 + dots,0.4 + dots,grain + d));
        
            //step(0.3+ smoothstep(-3.,5.,dot(grad,vec2(-1.)) - d*2.),noise(fragCoord)));
        
        if(isPal){
            vec3 oldCPalled = pal(palA,palB,palC,palD,palIdx + length(col) )*(col + 0.5);
        
            
            col = mix(col, oldCPalled*c, smoothstep(df,0.,d)); 
            
        } else if(isXor){
            //vec3 oldCPalled = pal(palA,palB,palC,palD,palIdx - length(col)*1. + palOffs)*mix(vec3(1.-length(col)),vec3(1),1.);
            vec3 oldCPalled = max(col,0.);
            float luma =  (oldCPalled.x+oldCPalled.y+oldCPalled.z)/3.;
            
            oldCPalled = 1. - oldCPalled;
            
            oldCPalled.xz *=rot(sin(smoothstep(0.5,0.,abs(d)*14.)*5.)*0.05);
            oldCPalled = mix(oldCPalled,shadc,
                smoothstep(0.3 + dots,0.5 + dots,grain + d*2.)*0.2);
        
            col = mix(col, oldCPalled, smoothstep(df,0.,d)); 
        
        
        } else {
            
            col = mix(col, c, smoothstep(df,0.,d)); 
        
        }
        
    }
    
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
    
    
    float text(vec2 p, float[1] chars, float spacing, float s) {
        p *= s;
        p += vec2(1./16.,1./16.);
        
        p.x *= 1. - spacing;
        vec2 id = floor(p*16.);
        p = mod(p,1./16.);
        p.x = p.x/(1. - spacing) + 0.1375*0.;
        float char = chars[int(id.x)];
        //char += 112.;
        float t;
        if( abs(id.y) < 1. && id.x >= 0. && id.x < 1. && mod(char, 1.) == 0. && char < 256.){
            vec4 letter = texture(iChannel3,p + vec2(mod(char,16.),-floor(char/16.) )/16.);
            t = letter.w - 0.5;
            t /= s*10.1;
        } else {
            t = 10e5;
        }
        return t;
        
    }
    
    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        #define iTime mod(iTime,9.)
        vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
        float env  = getEnv(iTime*1.      ,1.5,16.,3.,0.9,true);
        float envb = getEnv(iTime*1. - 0.4,1.,1.,1.,0.9 ,true);
        float envc = getEnv(iTime*1. - 1.2,1.5,2.,4.,0.2 ,true);
        float envd = getEnv(iTime*1. - 1.5,0.4,1.,1.,0.4  ,true);
        float enve = getEnv(iTime*1. - 3.5,1.,1.,1.,0.4  ,true);
        float envf = getEnv(iTime*1. - 4. ,2.,1.,1.,0.4  ,true);
        float envg = getEnv(iTime*1. - 4.5,1.,1.,1.,0.4  ,true);
        float envh = getEnv(iTime*1. - 4.8,2.,1.,1.,0.4  ,true);
        float envi = getEnv(iTime*1. - 5. ,1.5,1.,1.,0.4 ,true);
        float envj = getEnv(iTime*1. - 6. ,1.5,1.,1.,0.4 ,true);
        float envk = getEnv(iTime*1. - 7.5 ,1.5,1.,1.,0.4 ,true);
        float envl = getEnv(iTime*1. - 7.4 ,1.5,1.,1.,0.4 ,true);
        float envm = getEnv(iTime*1. - 7.9 ,1.5,1.,1.,0.4 ,true);
        
        vec3 col = vec3(0);
    
        draw( uv, fragCoord, col, length(uv) - 4. + smoothstep(0.4,0.3,texture(iChannel1,uv*0.05).x)*2., normalize(uv), 3.7,false, false);
        
        vec2 p = uv;
        
        vec3 circ = sdgCircle( p - (1.-pow(env,0.1)), 0. + env*0.4 - envc*0.1 + envg*0.1 + envk*0.1 - envm*2.  ) ;
        
        draw( uv, fragCoord, col, circ.x, circ.yz, 1.,false, false);
        
        
        circ.x = abs(circ.x - env*0.4) - envb*0.5 - envc*0.5 - 0.1 - envm*2.;
        draw( uv, fragCoord, col, circ.x, circ.yz, 0.,false, true);
        
        
        if(envd < 0.){
            for(float i = 0.; i < 8.; i ++){
            
                float envm = getEnv(iTime*1. - 7.9  - i/8.,1.5,1.,1.,0.4 ,false);
                p = uv*rot(2.*pi*i/8.*envg) + vec2(0,0.2 + envh*0.5 - envj*0.6  );
    
                vec3 circ = sdgCircle( p, 0. + envg*0.5  + envi*0.6 +  + envj*0.6 - envm*0.3  ) ;
    
                if( envg > 0.)
                    draw( uv, fragCoord, col, circ.x, circ.yz, 0.,false, true);
    
            }
        } else {
        
            for(float i = 0.; i < 8.; i ++){
            
                float envm = getEnv(iTime*1. - 7.9  - i/8.,1.5,1.,1.,0.4 ,false);
                p = uv*rot(2.*pi*i/8.*envg) + vec2(0,0.2 + envh*0.5 - envj*0.6  );
    
                vec3 circ = sdgCircle( p, 0. + envg*0.5  + envi*0.6 +  + envj*0.6 - envm*0.3  ) ;
    
                if( envg > 0.)
                    draw( uv, fragCoord, col, circ.x, circ.yz, 0.,false, true);
    
            }
        }
        p = uv;
        
        vec3 plane = vec3((p*rot((0.25*envc + envf*0.25 - envi*0.5)*pi)).y - 0.5*(1.-env) + envl,0,-0.) ;
        draw( uv, fragCoord, col, plane.x, plane.yz, 1.7,false, true);
        
        for(float i = 0.; i < 13.; i++){
        
            float other = float(i>4.)*envk;
            
            vec3 plane = vec3((p * rot(-pi*i*(0.25)*(envj + pow(envk,1.)) + sin(i*4.+iTime)  )).y,0.,-0.) ;
            
            if(i < 4.){
                plane = abs(plane) + 0.04 - envj*0.24 - envk*1.2 ;
                draw( uv, fragCoord, col, plane.x, plane.yz, 1.5,false, true);
    
            } else {
                plane = abs(plane) + 0.04  - other*5. ;
                draw( uv, fragCoord, col, plane.x, plane.yz, 1.5,false, true);
    
            }
            
            
        }
        p = uv;
        
        
        for(float i = 0.; i < 5.; i++){
            float envc = getEnv(iTime*1. - 1.9 - i/17.*0.,1.,1.,2.,0.1,false);
            
            
            p *= rot((0. + envd*0.25 + cos(i*pi )*enve*0.5 - cos(i*pi*0.5 )*envf*0.25 - cos(i*pi*1. )*envg*0.5  + envj  )*pi*envc);
            float envcb = getEnv(iTime*1. - 1. - i/17.*0.5,1.,1.,2.,0.1,false);
        
            //vec3 circ = sdSq( p, vec2(0.25 + i*0.1 + sin(envb*pi*1.)) ) ;
            vec3 circ = sdgBox( p, vec2(0. + i*0. + envb*pi*1. - envcb*(2.5 +i*0.1) + envd*0. - envg*0.4  - envj*0.5)  );
            draw( uv, fragCoord, col, circ.x, circ.yz, 1.,false, true);
            
            
        
        }
        
        
        //col = mix(col,1.-col,smoothstep(0.001,0.,text(uv - vec2(0.9,-0.35), float[1](81. + envcnt), 0., 0.4) ));
        
        /*
        //
        vec3 c;
        float w = 0.15 + sin(iTime)*0.05;
        #define sdfA(pos) sdgCircle( pos , w )
        
        sdfTrail(sdfA,getCircB, 0.2, c, w);
    
        draw( uv, fragCoord, col, c.x, c.yz, 0.7,false, true);
        //
        
        //
        
        #define getPlane(t) vec2(0.,0. + sin((t)*4.)*1.)
        
        w = 0. + sin(iTime)*0.;
        #define sdfB(pos) vec3((p + pos).x + p.y,0.,0.)
        
        sdfTrail(sdfB,getCircB, 0., c, w);
    
        draw( uv, fragCoord, col, c.x, c.yz, 1.1,false, true);
        //
        */
        
        
        fragColor = vec4(col,1.0);
    }`;

const buffB = `
    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        
        float sc = 0. + valueNoise(iTime*4.,2.)*0.2 ;
        
        fragColor.x =texture(iChannel0,(fragCoord + sc*vec2(0,8))/iResolution.xy).x;
        
        fragColor.y =texture(iChannel0,(fragCoord + sc*vec2(0,-1))/iResolution.xy).y;
        
        fragColor.z =texture(iChannel0,(fragCoord + sc*vec2(0,-4))/iResolution.xy).z;
        
        
    }`;

const fragment = `
// Fork of "Day 421" by jeyko. https://shadertoy.com/view/ttcfzB
// 2021-02-14 17:04:45

// tri sdf from iq 


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord -= 0.5*iResolution.xy;
    fragCoord *= 0.99;
    fragCoord += 0.5*iResolution.xy;
    
    float n1d = texelFetch(iChannel1,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel1,ivec2(mod(fragCoord  + n1d*200. ,256.)),0).xyz;
    
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    fragColor.xyz =texture(iChannel0,fragCoord/iResolution.xy).xyz;
    
    
    fragColor.xyz = pow(fragColor.xyz, vec3(1.,1.,1.2));
    
    //fragColor.xyz = 1. - fragColor.xyz;
    
    //fragColor.xyz *= 1. - dot(uv,uv)*0.8;
    fragColor.xyz = pow(fragColor.xyz, vec3(0.4545 + n*0.));
    
    
    
    //fragColor = texture(iChannel2,fragCoord/iResolution.xy);
    
    fragColor.xyz += smoothstep(1.,0.,length(fragColor))*n*0.04;
    
    fragColor.xyz -= smoothstep(0.,1.,length(fragColor))*n*0.05;
       
}
`;

export default class implements iSub {
    key(): string {
        return '3lcBWB';
    }
    name(): string {
        return 'Day 423 oops counting lol';
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
        ];
    }
    webgl() {
        return WEBGL_2;
    }
}
