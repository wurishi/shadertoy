import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
float sdBox(vec2 c, vec2 s){
    c = abs(c) - s; return max(c.x,c.y);
}
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pmod(p,a) mod(p,a) - 0.5*a


vec4 n14(float f){ return texture(iChannel1,vec2(mod(floor(f),256.),floor(f/256.))/256.); }


float eass(float p, float g) {
    float s = p*0.45;
    for(float i = 0.; i < g; i++){
    	s = smoothstep(0.,1.,s);
    }
    return s;
}

float text(vec2 p, float[8] chars, float spacing, float s, bool isAbs, float absWidth, float opacity, bool scrobble) {
	p *= s;  
    
    p.x *= 1. - spacing;
    vec2 id = floor(p*8.*2.);
    p = mod(p,1./16.);
    p.x = p.x/(1. - spacing) + 1./16./8.;
    float char = chars[int(id.x) ];
    char -= 32. ;
    if(scrobble)
        char += floor(15. * n14(id.x + (iTime + sin(id.x))*24.).y*pow(abs(sin(iTime + id.x*0.2)),14.) ) ;
    
    if(scrobble)
        char += 0.*floor(15. * n14(id.x + (iTime + sin(id.x))*24.).y * (2. - 1.)* (1. - eass((iTime - + id.x*1./16. - 3.)*1.,3.)) ) ;
    
    float t;
    if(abs(id.y) < 1. && id.x >= 0. && id.x < 8.  && char < 200.){
        vec4 letter = texture(iChannel3,p + vec2(mod(char,16.),-floor(char/16.) )/16.);
        t = letter.w - opacity;
        if(abs(p.x-1./16./2.)>1./16./2.)
            t = 10e4;
    
        t /= s*10.1;
    } else {
        t = 10e5;
    
	 }
    if (isAbs)
        t = abs(t) - absWidth;
    return t;
}

// cyclic noise by nimitz. i have a tutorial on it on shadertoy

float noise(vec3 p_){
    float n = 0.;
    float amp = 1.;
    vec4 p = vec4(p_,-(iTime + sin(iTime))*0.2);
    for(float i = 0.; i < 6.; i++){
        p.yz *= rot(.5);
        p.xz *= rot(2.5 + i);
        p.wy *= rot(2.5-i);
        p += cos(p*1. + vec4(3,2,1,1.+iTime*1.5) )*amp*.5;
        n += dot(sin(p),cos(p))*amp;
    
        amp *= 0.7;
        p *= 1.5;
    }
    
    //n = sin(n*1.);
    return n;
}


float noiseGrid(vec3 p_){
    float n = 0.;
    float amp = 1.;
    vec4 p = vec4(p_,11.);
    for(float i = 0.; i <2.; i++){
        p.yz *= rot(.5);
        p.xz *= rot(2.5 + i);
        p.wy *= rot(2.5-i);
        p += cos(p*1. + vec4(3,2,1,1.) )*amp*.5;
        n += dot(sin(p),cos(p))*amp;
    
        amp *= 0.5;
        p *= 1.5;
    }
    
    //n = sin(n*1.);
    return n;
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0);
    
    vec3 c = vec3(0.97,0.01,0.04)*0.7;
    

    uv.x += 0.025;

    {
        // planet
        vec2 p = uv;
        
        p.y -= 0.;
        p.x += 0.35;
        
        float bd = length(p) - 0.2;
        
        
        float d = abs(bd);
        
        //bd = bd + smoothstep(0.001,0.,bd)*smoothstep(-0.2,0.2,p.x)*texture(iChannel1,p).x;
        
        d = -bd;
        
        float bdb = sdBox(p,vec2(0.44));
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,bdb)*smoothstep(fwidth(uv.y),0.,d)*smoothstep(0.0,0.04,smoothstep(-0.3,2. - noise(vec3(uv*4.,iTime))*0.6,d)*texture(iChannel1,p*0.3).x*2.));
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,abs(bdb) - 0.001));
            
        
        //d =  abs(bd);
        
        //col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        
    
    }
    
    uv.x -= 0.05;
        {
        // CIRCS
        vec2 p = uv;
        p -= vec2(0.5,-0.4);
        float sc = 2.;
        p *= sc;
        
        p.x = abs(p.x) - 0.5;
        
        float d = 10e5;
        
        #define xor(a,b,c) min(max(a,-(b) + c),max(b,-(a)))
        for(float i = 0.; i < 7.; i++){
            //d = min(d,abs(length(p - vec2(i*0.1,0.)) - 0.1));
            d = xor(d,abs(length(p - vec2(i*0.07,0.)) - 0.04*(0.5 + 0.5*sin(i+iTime*3. + sin(iTime + i)))), (8.-i)/150.);
        
        }
        d -= 0.005;
        d /= sc;
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
    }
    
    
    {
        // GRAD LINE
        vec2 p = uv;
        
        p.y -= 0.34;
        p.x -= 0.5;
        
        float bd = sdBox(p - vec2(0,0.05),vec2(0.3,0.05));
        
        
        float d = abs(bd);
        
        //bd = bd + smoothstep(0.001,0.,bd)*smoothstep(-0.2,0.2,p.x)*texture(iChannel1,p).x;
        
        d = bd;
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,d)*smoothstep(0.0,0.24 + sin(iTime)*0.1,smoothstep(-0.3,2.,p.x)*texture(iChannel1,p*0.3).x*2.));
        d =  abs(bd);
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        {
            vec2 q = p;
            q.y += 0.065;
            float qd = sdBox(q,vec2(0.3,0.01));
            float md = 0.02;
            float id = floor(q.x/md);
            q.x = pmod(q.x,md);
            q.x += sin(id + iTime)*md*0.5;
            //qd = max(qd,-abs(q.x) + 0.01);
            //p.x = pmod(p.x,0.2);
            //bd = xor(bd,abs(length(p) - 0.03) - 0.001,0.02);
            col = mix(col,c,smoothstep(fwidth(uv.y),0.,qd));
        
        }        
        {
            vec2 q = p;
            q.y += 0.435;
            float qd = sdBox(q,vec2(0.3,0.01));
            float md = 0.02;
            float id = floor(q.x/md);
            q.x = pmod(q.x,md);
            q.x += sin(id + iTime)*md*0.5;
            //qd = max(qd,-abs(q.x) + 0.01);
            //p.x = pmod(p.x,0.2);
            //bd = xor(bd,abs(length(p) - 0.03) - 0.001,0.02);
            col = mix(col,c,smoothstep(fwidth(uv.y),0.,qd));
        
        }
        
        
        // MIDLINE
    
    }
    {
        // text
        float sc = 1.4;
        vec2 p = uv - vec2(0.2,0.16);
        p *= sc;
        //float iters = 5.*(sin(iTime*4.)*0.5 + 0.5);
        float iters = 5.;
        
        for(float i = 0.; i < iters; i ++){
            p.y += 0.06;
            float t;
            
            t = text(p, float[8](135.,130.,121.,119.,120.,132.,117.,130.), -0.5 , 0.4 , true, 0., 0.5 , false);
            
            if(i == 0.){
                t = text(p, float[8](135.,130.,121.,119.,120.,132.,117.,130.), -0.5 , 0.4 , false, 0., 0.5 , false);
            } else {
            
            }
            t -= 0.004;
            t /= sc;
            if(mod(-iTime*4. + i,5.) > 1. || i == 0.)
                col = mix(col,c,smoothstep(fwidth(uv.y),0.,t));
        }
                
    }
    {
        // dots
        vec2 p = uv;
        p -= vec2(0.28,-0.25);
        float d = 10e5;
        for(float i = 0.; i < 74.; i++){
            float k = i*0.2;
            vec2 o = vec2(
                cos(k + iTime)*cos(k*1.5 - iTime), sin(k*1. + iTime)
            )*0.06;
            
            d = min(d,length(p - o) - 0.002);
        }
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        
    }
    {
        // circs
        vec2 p = uv;
        p -= vec2(0.438,-0.25);
        float d = 10e5;
        float iters = 6.;
        for(float i = 0.; i < iters; i++){
            
            vec2 q = p;
            //d = min(d,length(p - o) - 0.002);
            q.xy *= rot(0.1 + i + iTime+ sin(iTime + i));
            
            d = length(q) - 0.07*i/iters;
            d = abs(d) - 0.00;
            
            d = max(d,-abs(q.y) + 0.01);
            d -= 0.001;
            col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
    
        }
    {
        // dots
        vec2 p = uv;
        p -= vec2(0.11,-0.25*0.);
        float md = 0.025;
        p.y += md*0.5;
        vec2 id = floor(p/md);
        p = pmod(p,md);
        if(abs(id.x) < 2. && abs(id.y) < 18.){
                float d = abs(p.x);
        
                if(noise(vec3(id,iTime*0.5)) < 0.2)
                    d = min(d,length(p) - md*0.25);
                
                col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        }
        
        
        }
    }

    {
        // grid
        vec2 p = uv;
        p -= vec2(0.655,-0.25);
        float md = 0.015;
        vec2 res = vec2(9,5);
        
        float db = sdBox(p - vec2(0.5,0.)*md,(res - 0.5)*md);
        
        float n = noiseGrid(vec3(p.xy*10.,iTime*2.5));
        p += n*0.01*smoothstep(0.0,-0.05,db);
        p.y += md*0.5;
        vec2 id = floor(p/md);
        float fw = fwidth(p.x);
        p = pmod(p,md);
        p = abs(p) - md*0.5;
        float d = abs(p.x);
        d = min(d,abs(p.y));
        d = max(d,db);
        d = min(d,abs(db));
        d -= 0.001;
        col = mix(col,c,smoothstep(fw,0.,d));
        
        
    }




    fragColor = vec4(col,1.0);
}`;

const fragment = `
float sdBox(vec2 c, vec2 s){
    c = abs(c) - s; return max(c.x,c.y);
}
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pmod(p,a) mod(p,a) - 0.5*a


// cyclic noise by nimitz. i have a tutorial on it on shadertoy

float noise(vec3 p_){
    float n = 0.;
    float amp = 1.;
    vec4 p = vec4(p_,11.);
    p.xy *= rot(1.4);
    p.x *= 3.;
    for(float i = 0.; i < 6.; i++){
        p.yz *= rot(.5);
        p.xz *= rot(2.5 + i);
        p.wy *= rot(2.5-i);
        p += cos(p*1. + vec4(3,2,1,1.) )*amp*.5;
        n += dot(sin(p),cos(p))*amp;
    
        amp *= 0.7;
        p *= 1.5;
    }
    
    n = sin(n*2.);
    return n;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0);
    
    fragCoord += 650.*noise(vec3(uv*0.5,5.))/iResolution.xy;
    col = texture(iChannel0,fragCoord/iResolution.xy).xyz;

    col += smoothstep(0.,5.,max(noise(vec3(uv*2.,5.)) - 0.5,0.))*0.25;
    
    
    float n1d = texelFetch(iChannel2,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(fragCoord + n1d*200. ,256.)),0).xyz;
    
    
    //C = smoothstep(0.,1.,C);z
    
    //col.xyz = pow(max(col.xyz,0.), vec3(0.55) + n*0.1);
    
    
    
    col = pow(max(col,0.),vec3(0.4545));

    col.xyz += smoothstep(1.,0.,length(col))*n*0.15;
    
    col.xyz -= smoothstep(0.,1.,length(col))*n*0.05;
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'slSGz1';
    }
    name(): string {
        return 'Day 539';
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
    webgl() {
        return WEBGL_2;
    }
    channels() {
        return [
            { type: 1, f: buffA, fi: 0 },
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
            webglUtils.FONT_TEXTURE,
        ];
    }
}
