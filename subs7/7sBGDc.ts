import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
vec3 P;

#define iTime (iTime - 4.)
#define dminb(a,b) a.x < b.x ? a : b

#define xor(a,b) min(max(a,-(b)),max(b,-(a) +0.02))

vec2 dmin(vec2 a, vec2 b,vec3 q){
    vec2 d = a.x < b.x ? a : b;
    if(d.x == a.x){
    
    } else {
        P = q;
    }
    return d;
}
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pmod(p,a) mod(p,a) - 0.5*a
float fOpIntersectionRound(float a, float b, float r) {
	vec2 u = max(vec2(r + a,r + b), vec2(0));
	return min(-r, max (a, b)) + length(u);
}

float fOpDifferenceRound (float a, float b, float r) {
	return fOpIntersectionRound(a, -b, r);
}

float sdBox(vec2 p, vec2 s){p = abs(p) -s; return max(p.y,p.x);}

float noise(vec3 p){
    float n = 0.;
    float amp = 1.;
    for(int i = 0; i < 2; i++){
        p.xy *= rot(0.5);
        p.yz *= rot(0.5);
        
        n += dot(sin(p),cos(p))*amp;
        p *= 1.5;
        amp *= 0.6;
    }
    return n;
}
`;

const fragment = `

vec2 map(vec3 p){
    vec2 d = vec2(10e5);
    
    p.yz *= rot(1.*pow(max(sin(iTime*0.25),0.),4.));

    float n = noise(p*14. + vec3(0,iTime*2.1,0));
    
    for(float i = 0.; i < 18.; i++){
        vec3 q = p;
        float dsp = sin(q.y*10. + iTime + i + sin(i*6. + iTime))*0.06 + cos(q.y*6. + iTime*1.5 + i*17.)*0.07 + sin(i*4.)*0.5;
        q.x -= dsp;
        float da = length(q.xz) - 0.01 - abs(sin(i +iTime*0.2))*0.02;
        vec2 cd = vec2(da,1.);
        cd = dminb(cd,vec2(da - n*0.04 -0.01 ,2.));
        cd.x = fOpDifferenceRound (cd.x, -p.y + 2.*sin(iTime + 13.*i + sin(i*46. + iTime) )*0.2 + 0.3, 0.15);
        
        d = dmin(d,cd,q);
    }
    return d;  
}

vec3 pal(float m){
    vec3 c = 0.5+0.5*sin(m + vec3(1.5,0.,-0.5));
    c = pow(c, vec3( .5));
    
    return c;
}

float r11(float a){return fract(sin(a*142.5)*16.5);}
float r21(vec2 a) {return fract(r11(a.x) + 3.*r11(a.y*1.2 - a.x + 2.));}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    float pxsz = fwidth(uv.x);

    vec3 col = vec3(0.95);
    vec3 ocol = col;
    
    {
        vec2 p = uv;
        p.y += iTime*0.1 + sin(iTime)*0.05;
        float md = 0.1;
        vec2 id = floor(p/md);
        p = pmod(p,md);
        float d = abs(p.y);
        d = min(d,abs(p.x));
        float m = sin(id.y + iTime + cos(id.x*20. +sin(id.y + iTime*0.5)*13.))*0.04;
        d -= m*0.03;
        d = max(d,-abs(length(p) - 0.01 -m) + 0.04);
        col = mix(col,vec3(0.1,0.4,0.5)*1.4,smoothstep(pxsz,0.,d));
        //col = mix(col,vec3(0.6,0.7,0.4)*2.*col,col*smoothstep(pxsz,0.,uv.y + 0.3 + 0.04*7.*noise(vec3(uv*4.,1. + iTime))));
        
    }
    
    {
    
    }
            vec2 p = uv;
            
            p.y += iTime*0.1;
            float md = 0.02;
            float mdb = 8.*md;
            
            vec2 ida = floor(p/md);
            vec2 idb = floor(p/mdb);
            
            //p = pmod(p,md);
            col = mix(col,pal(r21(idb)*5. + iTime) + 0.4,smoothstep(0.9,1.,
                smoothstep(0.8,0.85,
                    abs(ida.x*md + sin(ida.x)*.2))
                    *sin(r21(ida)*20. + iTime*5. + cos(ida.y*20.)*6.))
                    *sin( r21(idb)*20. + 1.*iTime)
                    );
            
         
    {
    
        vec3 ro = vec3(0,0,-1.);
        vec3 rd = normalize(vec3(uv,1));
        vec3 p = ro;
        float t = 0.;
        bool hit = false;
        vec2 d;
        for(int i = 0; i < 30; i++){
            d = map(p);
            if(d.x < 0.001){
                hit = true;
                break;
            }
            p = ro + rd*(t+=d.x);
        }
        
        
        if(hit){
            vec3 ca = mix(ocol,vec3(0.1,0.4,0.5)*0.5,smoothstep(-0.1,0.6,P.x)*2.);
            if(d.y == 1.){
                col = ca;
            } else if(d.y == 2.){
               
               //col += smoothstep(-0.1,0.6,P.x)*pal(P.y*5.);
                
                
                col = mix(ca,pal(P.y*5.),smoothstep(0.01,0.16,length(P.xz)));
            }
            
        }
    }
    
    {
        vec2 p = uv;
        float md = 0.05;
        
        p.x -= 0.7 + md*1.;
        p.y -= md*0.5+0.2;
        vec2 id = floor(p/md);
        p = pmod(p,md);
        float d = (length(p ) - 0.02);
        
        float cnd = float(abs(id.x) == 0. && abs(id.y) < 4.);
        
        vec3 c = pal(id.y*1.5 + iTime + d*4.);
        
        d = 0.;
        col = mix(col,col*0.7*c,cnd*smoothstep(0.03,-0.1,d));
        //col *= 0. + cnd*mix(col*0.1,col,smoothstep(-0.1,0.04,d))+ (1.-cnd)*1.;
        
        col = mix(col,c+ 0.3,cnd*smoothstep(pxsz,0.,d));
        
        float db = 10e5;
        for(float i = 0.; i <3.; i++ ){
            float w = (sin(iTime/3.14*2.+ i ));
            w = pow(max(w,0.),0.5);
            db = xor(db,abs(length(uv + vec2(sin(i+iTime + sin(iTime + i)),0.)*0.4 ) - 0.2*w + 0.01)- 0.01);
        
        }
        col = mix(col,6.*(1.-col + 0.1)*mix(pal(uv.x*4. + iTime + sin(iTime)),vec3(1),0.5),smoothstep(pxsz,0.,db) );
        
        
        //col = mix(col,pal(uv.x*2.)*vec3(0.6,0.7,0.4)*2.*col,col*smoothstep(pxsz,0.,uv.y + 0.6 + 0.04*7.*noise(vec3(uv*9.,1. + iTime))));
        
        
    }
    
    {
        vec2 p = uv;
        vec2 md = vec2(0.08,0.05);
        
        p.x += 0.67 + md.x*1.;
        p.y += md.y*0.5+0.2;
        
        vec3 c = vec3(0.3,0.35,0.46)*col*2. + (0.4-col*0.5)*1.4;
        c = c*2.*(1.-col);
        c = max(c,0.6);
        
        vec3 oc = c*4.*(1.-col + 0.3);
        c =  (pal(uv.y*11. + iTime*1.) + 0.5)*c*1.5*(col*1.);
        
        {
            vec2 id = floor(p/md);
            vec2 q = pmod(p,md);
            float d = sdBox(q, vec2(0.1,0.002));
            
            d = xor(d,sdBox(q + vec2(+ sin(4.*id.y + iTime*3. + sin(id.y + iTime))*0.04,0.), vec2(0.02 ,0.01)));
            
            d = xor(d,0.0+sdBox(p - 0.01 , vec2(0.01 ,0.6)));
            
            
            float cnd = float(abs(id.x) == 0. && abs(id.y) < 4.);
            
            col = mix(col,c,cnd*smoothstep(pxsz,0.,d));
        
            float od = d;
            
            d = sdBox(p - vec2(-0.022,0) , vec2(0.01 ,0.2));
            
            d = min(d,xor(d,sdBox(p - vec2(-0.022,0) , vec2(0.001 ,0.5))));
            d = min(d,xor(d,sdBox(p - vec2(-0.06,0) , vec2(0.001 ,0.3))));
            d = min(d,xor(d,sdBox(p - vec2(-0.05,0) , vec2(0.046 ,0.3))));
            //d = min(d,xor(d,sdBox(p - vec2(-0.1,0.3) , vec2(0.02 ,0.1))));
            //d = abs(d) - 0.001;
            
            
            col = mix(col,c,smoothstep(pxsz,0.,d));
        
            float db = sdBox(uv + vec2(0.01,0.401) , vec2(0.6 ,0.015));
            col = mix(col,oc,smoothstep(pxsz,0.,db));
            
        }
        
        //d = min(d, sdBox(uv + vec2(0.1), vec2(0.0,0.04)));
        
    }
    
    col =abs(col);
    if(iMouse.z > 0. ){
        col = max(6.*(1.-col + 0.1)*mix(pal(uv.x*4. + iTime + sin(iTime)),vec3(1),0.5),0.4);
    
    }
    col = pow(col,vec3(0.5545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return '7sBGDc';
    }
    name(): string {
        return 'Day 478';
    }
    sort() {
        return 768;
    }
    tags?(): string[] {
        return [];
    }
    common() {
        return common;
    }
    webgl() {
        return WEBGL_2;
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
}
