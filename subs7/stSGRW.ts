import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define pi acos(-1.)

#define xor(a,b,c) min(max(a,-(b) + c),max(b,-(a)))

float opSmoothUnion( float d1, float d2, float k ) {
float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
return mix( d2, d1, h ) - k*h*(1.0-h); }


float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
vec2 pa = p-a, ba = b-a;
float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
return length( pa - ba*h );
}`;

const buffA = `float sdBox(vec2 c, vec2 s){
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

float text(vec2 p, float[9] chars, float spacing, float s, bool isAbs, float absWidth, float opacity, bool scrobble, float offs) {
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
    if(abs(id.y) < 1. && id.x >= 0. && id.x < 9.  && char < 200.){
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

    vec3 col = vec3(0.8,0.5,0.4)*0.;
    vec3 baseCol = col;
    vec3 c = vec3(0.,0.511,0.2)*0.7;
    

    uv.x -= 0.725 + 0.04;

    
    {
        // grid
        vec2 p = uv;
        
        p.y -= 0.08;
        p.x += 0.35;
        
        float bdb = sdBox(p,vec2(0.35));
        
        p *= rot(sin(length(p)*15. + iTime)*0.2*smoothstep(0.,-0.4,bdb));
        
        float w = 0.001;
        float d = 10e5;
        
        //bd = bd + smoothstep(0.001,0.,bd)*smoothstep(-0.2,0.2,p.x)*texture(iChannel1,p).x;
        
        
        float biters = 10. + floor(10.*( 1.*max(sin(iTime*1.),-0.5)));
        float lastb;
        for (float i = 0.; i < biters; i ++){
            float b = sdBox(p,vec2(mod(exp(-i/10.),1.)*0.35));
            if(i == biters - 1.)
                lastb = b;
            d = min( d,abs(b));
        }
        
        float itersLines = 10.;
        for (float i = 0.; i < itersLines; i ++){
            vec2 q = p*rot(i/itersLines*pi + 1./itersLines*pi/2.);
            d = min( d,abs(q.x));
        }
        
        
        
        float outBox = smoothstep(fwidth(uv.y),0.,bdb);
        float inBox = smoothstep(fwidth(uv.y),0.,-lastb);
        
        col = mix(col,c,inBox*outBox*smoothstep(fwidth(uv.y),0.,d - w));
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,abs(bdb) - w));
            
        
        //d =  abs(bd);
        
        //col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        
    
    }
    
    {
        // MEATBALLS
        float d = 10e5;
        vec2 p = uv;
        
        p.y -= 0.08;
        p.x += 0.35;
        for(float i = 0.; i <6.; i++){
            float m = i + iTime;
            d = opSmoothUnion( d, length(p - vec2(cos(m*cos(i)),sin(m))*0.2) - 0.05*(1. + 0.5*sin(m*1.5)), 0.1);
        
        }
        float ballFill = smoothstep(fwidth(d),0.,d);
        col = mix(col,baseCol,ballFill);
        col = mix(col,c,smoothstep(fwidth(d),0.,abs(d)));
        col = mix(col,c,ballFill*smoothstep(-0.03,0.,d)*texture(iChannel1,p*0.3).x*2.*smoothstep(0.0,0.01,dot(vec2(-1),vec2(dFdx(d),dFdy(d)))));
        
        
    }
    
    
    
    {
        // GRAD LINE
        vec2 p = uv;
        
        p.y += 0.38;
        p.x += 0.35;
        
        float bd = sdBox(p - vec2(0,0.06),vec2(0.35,0.02));
        float bdb = sdBox(p - vec2(0.0,-0.001),vec2(0.35,0.005));
        
        
        float d = abs(bd);
        
        //bd = bd + smoothstep(0.001,0.,bd)*smoothstep(-0.2,0.2,p.x)*texture(iChannel1,p).x;
        
        d = bd;
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,d)*smoothstep(0.0,0.24 + sin(iTime)*0.1,smoothstep(-0.3,2.,p.x)*texture(iChannel1,p*0.3).x*2.));
        d =  abs(bd);
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,bdb));
        
        
        
        // botline
    
    }
    uv.x += 0.725 + 0.85;

    
    {
        // swirly
        
        vec2 p = uv;
        float sc = 2.5;
        
        p.x -= 0.66;
        p.y -= 0.35;
        p *= sc;
        float cd = length(p) - 0.2;
        cd = sdBox(p,vec2(0.4,0.2));
        p *= rot(sin((length(p)*1.)*6. + iTime + sin(iTime))*2.);
        p = vec2(atan(p.x,p.y)/pi,length(p));
        float fw = fwidth(p.x)/2.;
        if(cd > 0.0)
            fw = 0.00;
        p.x = pmod(p.x,1./3.);
        
        float d = cd;
        d = max(d,-abs(p.x) + 0.1);
        d /= sc;
       
        //float fw = mix(fwidth(d),fwidth(uv.y)*2.,1.);
        
        //d = min(d,abs(cd - 0.006 ));
        col = mix(col,c,smoothstep(fw,0.,(d)));
        col = mix(col,c,smoothstep(fwidth(cd),0.,abs(cd) - 0.00));
    
    }
    
    {
        // SINES
        float w = 0.001;
        vec2 p = uv;
        p -= vec2(0.25,0.23);
        
        float bd = sdBox(p,vec2(0.2));
        bd = mix(bd,length(p) - 0.2,0.5 + 0.5*sin((iTime*pi+sin(iTime*pi))/pi));
        float outBox = smoothstep(fwidth(uv.y),0.,bd);
        
        float d = 10e5;
        
        float iters = 20.;
        for(float i = 0.; i < iters; i++){
            vec2 q = p + vec2(0.,i/iters*0.45 -0.2);
            q.y += sin(q.x*4.2 + i*0.2 + iTime + sin(iTime))*0.04*cos(q.x*20. + sin(i + iTime + sin(iTime))*0.7 );
            d = q.y - w;
            
            col = mix(col,c,outBox*smoothstep(fwidth(d),0.,abs(d)-w));
        
        }
        
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,abs(bd) - w));
            
        
    }
    {
        // lines
        float md = 0.05;
        vec2 p = uv;
        p += vec2(-0.76,0.15);
        
        p *= rot(0.5*pi);
        p.x -= p.y*0.;
        
        float id = floor(p.x/md);
        
        p.x = pmod(p.x,md);
        
        float d = abs(p.x) - md*0.4*(sin(id + iTime)*0.5 + 0.5);
        d = max(d,abs(p.y) -0.02);
        
        if(abs(id) < 0.)
            col = mix(col,c,smoothstep(fwidth(uv.y),0.,abs(d)));
    }
    {
        // CIRCS
        vec2 p = uv;
        p.x -= 0.15;
        p.y += 0.05;
        float d = 10e5;
        for(float i = 8.; i>  0.; i--){
            vec2 q = p + vec2(0.,i/5./5.);
            q.y *= 3.;
            d = min(d,(length(q) - 0.2*i/25.*(0.5 + 0.5*sin(iTime + i*1.))) - 0.042);
            
        }
        //col = mix(col,c,smoothstep(fwidth(d),0.,(d) - 0.001));
        
        
    }
    {
        // smiley
        vec2 p = uv;
        p -= vec2(0.7 + sin(iTime)*0.04,-0.24);
        p *= 1.5 + sin(iTime + sin(iTime))*0.1;
        p *= rot(sin(iTime + sin(iTime))*0.2);
        p -= noiseGrid(vec3(p*12.,1. + iTime*1.))*0.01;
        
        float d = length(p) - 0.2;
        
        
        
        d = max(d, -length(vec2(abs(p.x),p.y)*vec2(1. ,0.4) - vec2(0.05,0.01)) + 0.03);
        p *= rot(1.*pi);
        
        float smile = abs(length(p) - 0.16) - 0.014;
        vec2 pp = vec2(atan(p.x,p.y)/pi,length(p));
        
        float smw = 0.4 + sin(iTime)*0.05;
        smile = max(smile,abs(pp.x) - smw);
        
        smile = min(smile,sdBox(abs(pp) - vec2(smw,0.15 + 0.0125),vec2(0.03,0.02)));
        d = max(d, - smile);
        
        col = mix(col,c,smoothstep(fwidth(d),0.,(d)));
    }
    {
        // TEXT
        
        float sc = 2.25;
        vec2 p = uv - vec2(0.12,-0.2);
        
        float b = sdBox(p - vec2(0.21,-0.03),vec2(0.20,0.07));
        p.x *= 1.;
        p.y *= 0.95;
        p *= sc;
        
        //float iters = 5.*(sin(iTime*4.)*0.5 + 0.5);
        float iters = 6.;
        float lt = 10e5;
        for(float i = 0.; i < iters; i ++){
            p.y -= 0.04;
            float t;
            
            //t = text(p, float[8](135.,130.,121.,119.,120.,132.,117.,130.), -0.5 , 0.4 , true, 0., 0.5 , false, i);
            t = text(p, float[9](131.,120.,113.,116.,117.,130.,114.,127.,121.), -0.5 , 0.4 , true, 0., 0.5 + i/iters*0.1 , false, i);
            if(i==0.)
                t = text(p, float[9](131.,120.,113.,116.,117.,130.,114.,127.,121.), -0.5 , 0.4 , false, 0., 0.5 , false, i);
            
            t -= 0.004;
            t /= sc*1.;
            
            lt = min(lt,t);
            
        }
        //lt = max(b,-lt);
        
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,lt));
    }
    {
        // TEXTB
        
        float sc = 3.5;
        vec2 p = uv - vec2(0.51,0.198);
        
        float b = sdBox(p - vec2(0.1675,-0.11),vec2(0.16));
        p *= sc;
        float t = 10e5;
        float iters = 7.;
        for(float i = 0.; i < iters; i ++){
            vec2 a = vec2(0.,0.);
            //if(sin(i))
            a.x += max(sin(i + 2.6) - 0.5,0.)*1.;
            vec2 b = vec2(a.x + 0.4 + sin(i + cos(i))*0.1,a.y + 0.);
            t = min(t, sdSegment(p,a,b) - 0.04);
            
            p.y += 0.12;
            
        }
        //lt = max(b,-lt);
        
        col = mix(col,c,smoothstep(fwidth(t),0.,t));
    }
    {
        // dots
        
        
        float sc = 1.9;
        vec2 p = uv - vec2(0.03,-0.33);
        
        p *= sc;
        float t = 10e5;
        float iters = 7.;
        for(float i = 0.; i < iters; i ++){
            vec2 a = vec2(0.,0.6);
            //if(sin(i))
            a.y += max(sin(i + 2.6 + iTime) - 0.5,0.)*0.1;
            vec2 b = vec2(a.x,a.y + 0.);
            t = xor(t, abs(sdSegment(p,a,b) - 0.01*max(sin(i + iTime*2.),0.4)),0.05*(0.5 + 0.5*sin(i + iTime*5. + sin(iTime + i))) );
            
            p.y += 0.12;
            
        }
        //t = xor(-t,-abs(p.x) - 0.02,-0.01);
        //lt = max(b,-lt);
        t /= sc;
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,t));
    }
     {
        // function
        
        vec2 p = uv;
        float sc = 1.;
        
        p.x -= 0.33;
        p.y += 0.3;
        p *= sc;
        float cd = length(p) - 0.2;
        cd = sdBox(p,vec2(0.2,0.1));
        vec2 q = p;
        
        q.x += iTime*0.1;
        p = q;
        q = pmod(q + 0.1/6.,0.1/3.);
        
        float d = abs(q.x);
        d = min(d,abs(q.y));
        
        
        //float fn = (p.y+ sin(p.x*10. + asin(sin(p.x*4. + cos(p.x)))*5.)*0.1) ;
        //float fn = (p.y+ asin(sin(p.x*35. + asin(sin(p.x*10.)*cos(p.x)*2.)))*0.05) ;
        float fn = (p.y+ asin(sin(p.x*35. + asin(sin(p.x*45.))))*0.05) ;
        
        col = mix(col,c,smoothstep(0.001,0.00,cd)*smoothstep(fwidth(fn),0.,abs(fn)-0.004));
        
        
        d = max(d,cd);
        d /= sc;
       
        //float fw = mix(fwidth(d),fwidth(uv.y)*2.,1.);
        
        //d = min(d,abs(cd - 0.006 ));
        d = min(d,abs(cd));
        col = mix(col,c,smoothstep(fwidth(uv.y),0.,(d)));
        
    }




    fragColor = vec4(col,1.0);
}`;

const fragment = `
// Fork of "Day 539" by jeyko. https://shadertoy.com/view/slSGz1
// 2021-06-11 08:12:26

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
    
    float no = noise(vec3(uv*2.,35.));
    col = mix(col,vec3(0),smoothstep(0.,0.5,max(noise(vec3(uv*2.2 + 0.1,35.)) - 0.5,0.))*0.4);
    
    col = mix(col,vec3(1),smoothstep(0.,5.,max(no - 0.5,0.))*.05);
    
    //col += min(no - 0.5,0.)*0.02;
    
    float n1d = texelFetch(iChannel2,ivec2(mod(fragCoord + vec2(float(iFrame)*0.,0.),256.)),0).x*0.5;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(fragCoord + n1d*200. ,256.)),0).xyz*0.6;
    
    
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
        return 'stSGRW';
    }
    name(): string {
        return 'Day 540';
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
    common() {
        return common;
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
