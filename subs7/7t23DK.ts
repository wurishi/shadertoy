import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define pmod(p,a) mod(p,a) - 0.5*a
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pi acos(-1.)
#define iTime (iTime + 5.)
float sdBox(vec2 p, vec2 s){p = abs(p) - s; return max(p.y,p.x);}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 col = vec3(1);
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    float pxSz = fwidth(uv.y);

    {
        // block
        vec2 p = uv;
        float liters = 1.;
        for(float i = 0.; i < liters; i++){
            vec2 md = vec2(0.3,0.1);
            vec2 p = uv + vec2(iTime*0.1,0.);
            vec2 id = floor(p/md);
            p = pmod(p,md);
            id += 50.;
            float r = fract(sin(id.x*10.*cos(id.y*4.) + sin(id.x)*sin(id.y)*16.)*200.);
            if(r < 0.04){
                
                col = vec3(1,0.1,0.1)*0.;
        
                
            }
            //col = mix(col,1.-col,smoothstep(pxSz,0.,d));
        }
    }    
    {
        // dots
        vec2 p = uv;
        float liters = 1.;
        for(float i = 0.; i < liters; i++){
            vec2 md = vec2(0.3,0.1);
            vec2 p = uv + vec2(iTime*0.1,0.);
            vec2 id = floor(p/md);
            p = pmod(p,md);
            id += 50.;
            float r = fract(sin(id.x*10.*cos(id.y*4.) + sin(id.x)*sin(id.y)*16.)*200.);
            if(r < 0.06){
                id = floor(p/md.y*16.);
                
                if(mod(id.x + mod(id.y,2.),2.) == 1.)
                    col = vec3(1,0.1,0.1)*0.;
        
                
            }
            //col = mix(col,1.-col,smoothstep(pxSz,0.,d));
        }
    }
    
    {
        // lines
        vec2 p = uv;
        float liters = 1.;
        for(float i = 0.; i < liters; i++){
            vec2 md = vec2(0.3,0.1);
            vec2 p = uv + vec2(iTime*0.1,0.);
            vec2 id = floor(p/md);
            p = pmod(p,md);
            float r = fract(sin(id.x*10.*cos(id.y*4.) + sin(id.x)*sin(id.y)*16.)*200.);
            if(r < 0.04){
                p = abs(p);
                //p *= rot(0.25*pi);
                float sz = md.x/16.;
                p = pmod(p,sz);
                p *= rot(0.25*pi + iTime);
                
                float d = sdBox(p, vec2(sz*0.5,0.));
                
                col = mix(col,vec3(1,0.1,0.1)*1.,smoothstep(pxSz,0.,d));
        
                
            }
            //col = mix(col,1.-col,smoothstep(pxSz,0.,d));
        }
    }
    
    {
        vec2 p = uv;
        float liters = 145.;
        for(float i = 0.; i < liters; i++){
            float md = 0.5 + 0.4*sin(i*2.5);
            md*=1.4;
            vec2 p = uv + vec2(sin(i) + iTime*(1.+sin(i*5.)*0.8)*0.1, 1.*sin(i*3.4)*0.5);;
            float id = floor(p.x/md);
            p.x = pmod(p.x,md);
            
            p.x += sin(id + iTime)*md*0.6;
            float d = abs(p.x) - 0.03;
            d = max(d,abs(p.y) - 0.001);
            col = mix(col,vec3(1,0.6,0.5)-col*1.,smoothstep(pxSz,0.,d));
        }
    }
    {
        vec2 p = uv;
        float liters = 72.;
        for(float i = 0.; i < liters; i++){
        
            float lt = (iTime*(1. + sin(i) ) + sin(iTime + i*20.)*0.5)*0.1;
            vec2 p = uv + vec2(mod(
                lt
                ,1.)*3. - 1.5,cos(i*16.)*0.7);
            float d = sdBox(p,vec2(0.1,0.1));
            
            p *= rot(0.25*pi);
            p.x = pmod(p.x,0.01);
            d = max(d,abs(p.x) - 0.001);
            col = mix(col,vec3(1,0.6,0.5)-col*1.,smoothstep(pxSz,0.,d));
        
        }    
    }
    {
        vec2 p = uv;
        float liters = 42.;
        for(float i = 0.; i < liters; i++){
        
            float lt = (iTime*(1. + sin(i) ) + sin(iTime + i*210.)*0.5)*0.1;
            vec2 p = uv + vec2(mod(
                lt
                ,1.)*3. - 1.5,cos(i*16.)*0.7);
            float d = length(p) - 0.2;
            
            p = pmod(p,0.015);
            d = max(d,length(p) - 0.000);
            col = mix(col,vec3(0.,0.6,0.5)-col*1.,smoothstep(pxSz,0.,d));
        
        }    
    }
    
    
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return '7t23DK';
    }
    webgl() {
        return WEBGL_2;
    }
    name(): string {
        return 'Livecode demozoo jam';
    }
    sort() {
        return 756;
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
}
