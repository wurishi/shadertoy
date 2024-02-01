import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define R (iResolution.xy)
#define T(u) texture(iChannel0,fract((u)/R))
#define iTime (iTime + 26.)`;

const buffA = `#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pmod(p,a) mod(p,a) - 0.5*a

float noise(vec3 p){
    float n = 0.;
    float amp = 1.;
    for(int i = 0; i < 3; i++){
    
        p.xz *= rot(0.6);
        p.yz *= rot(0.6);
        
        n += dot(sin(p),cos(p))*amp;
        
        amp *= 0.6;
        p *= 1.5;
    }
    return n;
}

vec3 pal(vec3 p){
    vec3 c = 0.5 + 0.5* sin(p*vec3(1.,1.,1.) + vec3(0.5,0.,-0.5));

    c = pow(c,vec3(.4545));
    c = smoothstep(0.,0.7,c);
    return c;
}

vec3 getP(vec2 uv){
    float n = noise(vec3(uv*5.,iTime*0.1));
    uv -= n*0.1;
    float nb = noise(vec3(uv*4.,iTime*0.1 + 6.));
    float nc = noise(vec3(uv*4.,iTime*0.1));
    
    vec3 col = pal(vec3(1.,1. - n*0.1,1.)*nc*1.);
    col = mix(col,pow(pal(vec3(1.5,1.5,1.4)*nb *2. + 4.6 + n),vec3(1.)),smoothstep(-0.1,-0.5,nb));
    return col;
}
float sdBox(vec2 p, vec2 s){
    p = abs(p) - s; return max(p.x,p.y);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.y;
    vec2 ouv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    vec3 col = vec3(0);
    float pxsz = fwidth(uv.x);
        
    uv.y += iTime*0.1;
    
    col = getP(uv);
    float md = 0.04;
    vec2 mid = floor(uv/md)*md;
    //vec2 muv = 
    vec3 mcol = getP(mid);
    
    
    {
        for(float i = 0.; i < 7.; i++){
        
            vec2 p = ouv - vec2(0.5,-0.4);
        
            float w = sin(i*10. + iTime*0.4 + sin(i + iTime)*0.5*(sin(i)))*0.5 + .45;
            
            float d = length(p) - w*1.;
            d = abs(d) - 0.04*abs(sin(i+iTime));
            p *= rot(i*20. + sin(iTime+i));
            d = max(d,-abs(atan(p.y,p.x)) + 0.4);
            
            p *= rot(i*20. + sin(iTime+i));
            d = max(d,-abs(atan(p.y,p.x)) + 0.4);
            
            col *= max(smoothstep(-0.04,0.05,d),0.1);
            
            col = mix(col,0.4*pow(min(1.-col,1.),vec3(4.))*1.,smoothstep(pxsz,0.,d));
            //col = 1. - col;
    
        }
        
    }
    col = mix(col,mcol, smoothstep(1.,0.,noise(vec3(uv*4.,iTime*1.)) + 1.) );
    
    
    float db = sdBox(ouv,vec2(0.48));
    col *= smoothstep(0.02,-0.04,db);
    
    float sdb = smoothstep(0.,pxsz,db);
    col = mix(col,vec3(0.004),sdb);
    
    float nn = noise(vec3(uv*5.,iTime));
    {
        vec2 p = pmod(uv,0.1);
        col = mix(col,
            mix(col,col-vec3(1),smoothstep(pxsz,0.,length(p))),
            smoothstep(pxsz,0.,db));
        col = mix(col,vec3(1.)*0.1,sdb*smoothstep(pxsz,0.,abs(sdBox(ouv + 0.01,vec2(0.48)))));
        col = mix(col,vec3(1.)*0.1,sdb*smoothstep(pxsz,0.,abs(sdBox(ouv + 0.02,vec2(0.48)))));
    
        float no = max(nn,0.1);
        col = mix(col,
            mix(col,vec3(1)*no*0.3,smoothstep(pxsz,0.,length(p) - 0.002)),
            smoothstep(0.,pxsz,db));
    
    
    }
    {
        vec2 p = pmod(uv + 0.0,0.25);
        
        float d = abs(p.x);
        d = min( d, abs(p.y) );
        d = max( d, length(p) - 0.02);
        
        
        col = mix(col,
            mix(col,0.2-col*4.,nn*sdb*smoothstep(pxsz,0.,d)),
            smoothstep(pxsz,0.,d));
        ///col = mix(col,vec3(1.)*0.1,sdb*smoothstep(pxsz,0.,abs(sdBox(ouv + 0.01,vec2(0.48)))));
        //col = mix(col,vec3(1.)*0.1,sdb*smoothstep(pxsz,0.,abs(sdBox(ouv + 0.02,vec2(0.48)))));
    
        //float no = max(noise(vec3(uv*5.,iTime)),0.1);
        
    
    }
    
    {
        
        for(float i = 0.; i < 16.; i++){
        
            vec2 p = ouv + vec2(sin(i*1.)*0.4 + 0.4,1.5 - 2.5*mod(0.2*iTime*(1. + sin(i*6.)*0.8) + sin(i + iTime)*0.05,1.));
            float w = sin(i*50.)*0. + 0.001;
            
            float d = length(p.x);
            d = abs(d) - w;
            d = max(d,abs(p.y) - 0.1 + sin(i)*0.05);
            col *= smoothstep(-0.1,0.02,d);
            
            col = mix(col,1.*pow(min(1.-col,1.),vec3(1.))*1.,smoothstep(pxsz,0.,d));
            //col = 1. - col;
    
        }
        
    }
    col = mix(col,1.*pow(min(1.-col,1.),vec3(1.))*0.4 + 0.3,smoothstep(pxsz,0.,max(abs(ouv.y-.41),abs(ouv.x) - 0.2) - 0.01));
    {
        float id = floor(2.*ouv.y/0.2);
        //float id = floor(2.*ouv.x/0.11);
        
        //col = mix(col,pal(id*vec3(1.) + iTime*0.6),smoothstep(pxsz,0.,max(abs(ouv.x-.8) - 0.01,abs(ouv.y) - 0.2)));
        
        float d = max(abs(ouv.x-.8 ),abs(ouv.y) - 0.25) - 0.01;
        col *= smoothstep(-0.1,0.04,d);
    
        col = mix(col,1.-pal(id*vec3(1.) + sin(iTime+id*20.)*1.6),smoothstep(pxsz,0.,d));
    
    }       
    {
        
        for(float i = 0.; i < 4.; i++){
        
            vec2 p = ouv + vec2(sin(i*4.)*0.5 - 0.4,-.4 - .2*sin(0.2*iTime*(1. + sin(i*6.)*0.8) + sin(i + iTime)*0.05));
            float w = sin(i*50.)*0. + 0.001;
            
            float d = sdBox(p, vec2(0.1));
            //col *= smoothstep(-0.1,0.02,d);
            
            //col = mix(col,0.1*pow(max(1.-col,0.),vec3(0.1))*1.,smoothstep(pxsz,0.,d));
            //col = 1. - col;
    
        }
        
    }
    if(iMouse.z > 0. || fract(iTime*0.1) < 0.1)
        col = 1. - col;
    
    //col = pow(col,vec3(.4545));
    fragColor = vec4(col,1.0);
}`;

const fragment = `

void mainImage( out vec4 C, in vec2 U )
{
    C = C*.0;
    
    vec2 uv = (U - 0.5*R)/R.y;   
    
    C = T(U);
    
    
    
    
    float n1d = texelFetch(iChannel2,ivec2(mod(U + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(U  + n1d*200. ,256.)),0).xyz;
    
    
    C *= 1.  ;
    //C = smoothstep(0.,1.,C);z
    
    C.xyz = pow(max(C.xyz,0.), vec3(0.55) + n*0.1);
    
    
    
    C.xyz += smoothstep(1.,0.,length(C))*n*0.15;
    
    C.xyz -= smoothstep(0.,1.,length(C))*n*0.05;
    
    
}
`;

export default class implements iSub {
    key(): string {
        return 'fsB3zt';
    }
    name(): string {
        return 'Day 475';
    }
    sort() {
        return 769;
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
        return [
            { type: 1, f: buffA, fi: 0 },
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
        ];
    }
}
