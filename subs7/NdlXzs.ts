import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pmod(p,a) mod(p,a) - 0.5*a
vec3 pal(float m){
    vec3 c = 0.5 + 0.5*sin(vec3(
        m + 0.5,
        m + 0.3,
        m - 0.5
    ));
    
    c = pow(c,vec3(14.));
    
    return c;
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(1);
    
    
    {
        vec2 p = uv;
        
        float md = 0.02;
        float m =p.x*6. + iTime + sin(p.x + cos(iTime) + iTime);
        
        if(uv.y < 0.)
            m += iTime;
        p.x += sin(m)*0.1;
        float id = floor(p.x/md);
        p.y = abs(p.y);
        p.x = pmod(p.x,md);
        
        float d = abs(p.x) - md*(0.1 + sin(id + m)*0.05)*2.;
        d = max(d,abs(p.y - 0.45) -0.05);
        
        //col = mix(col,1.-col,smoothstep(fwidth(d),0.,d));
        
        md = 0.001;
        float oid = floor(uv.y/md);
        
        float om =uv.x*6. + iTime + cos(oid) + sin(uv.x + cos(iTime + oid*5.) + iTime + oid);
        
        col = mix(col,pal(id),smoothstep(fwidth(d) + abs(sin(om))*0.005,0.,d));
        
        d = abs(p.y - 0.4) - 0.015;
        col = mix(col,1.-col,smoothstep(fwidth(d) + 0.01*(0.5+0.5*sin(iTime +m)),0.,d));
        
        
    }
    {
         vec2 p = uv;
        
        float md = 0.01;
        float id = floor(p.y/md);
        
        float m =p.x*6. + iTime + cos(id) + sin(p.x + cos(iTime + id*5.) + iTime + id);
        
        if(uv.y < 0.)


            m += iTime;
        p.x += sin(m)*0.1 + m + cos(id + iTime);
        p.y = pmod(p.y,md);
        p.x = pmod(p.x,0.4);
        
        
        float d = abs(p.y) - md*0.2;
        d = max(d,abs(p.x) - 0.1);
        d = max(d,abs(uv.y - 0.3 + sin(m*20000.)*sin( + id*md + iTime*1. + cos(id*md + iTime))*0.15) -0.25);
        
        col = mix(col,1.-col,smoothstep(fwidth(d) + 0.04*(0.5+0.5*sin(iTime + cos(20.*m))),0.,d));
        
    }
    
    {
        // haha pp
        vec2 pp = uv;
        
        float md = 0.0142;
        float id = floor(pp.y/md);
        
        float m =pp.x*6. + iTime + cos(id) + sin(pp.x + cos(iTime*10.*sin(iTime) + id*5.) + iTime + id);
        
    
        vec3 rd = normalize(vec3(uv + sin(m)*0.14,1));
        vec3 ro = vec3(0,0,-2);
        vec3 p = ro;
        
        float t = 0.; bool hit = false;
        
        for(int i = 0; i < 10; i++){
            vec3 q = p;
            q -= 0.2;
            q.xy *= rot(-sin(m+iTime)*.01*sin(iTime) + 0.4*iTime);
            float d = mix(length(q.yz),q.y,0.5+0.5*sin(iTime)) - 0.1 + sin(iTime + m*0.01)*0.1;
            
            if(d < 0.001){
                hit = true; break;
            }
            
            p = ro + rd*(t+=d);
        }
        
        if(hit){
            
            col = mix(col,1. - col*pow(pal(m*10.1  + iTime*5.),vec3(22,1.4,0.4)),col + sin(m));
            //col = 1.-col;
        }
        
    }
    
    float m;
    {
        vec2 pp = uv;
        
        float md = 0.01;
        float id = floor(pp.y/md);
        
        
        m =pp.x*6. + iTime + cos(id) + sin(pp.x + cos(iTime + id*5.) + iTime + id);
        
        if(uv.x < 0.)
            m = sin(m);
        
        
        vec2 p = abs(uv);
        
        float d = length(p.x -(+ sin(m*120.4)*0.01 + 0.9 + sin(iTime + id*md*0.2)*0.04*sin(iTime))) - 0.0;
    
        
    
        col = mix(col,0.7-col*0.4,smoothstep(fwidth(d)*(5. + sin(m)*3.),0.,d));
    }
    
     {
         
        vec2 p = uv;
        p.x += m;
        p = pmod(p,0.01);
        
        float d = abs(p.x);
    
        col = mix(col,0.2-col*1.,(1.-col)*smoothstep(fwidth(d)*(2. + sin(m*20.)*1.),0.,d));
    }
    {
        vec2 pp = uv;
        
        float md = 0.01;
        float id = floor(pp.y/md);
        
        
        m =pp.x*6. + iTime + cos(id) + sin(pp.x + cos(iTime + id*5.) + iTime + id);
        
        col = mix(col, 1. - col, smoothstep(0.7,0.8,sin((iTime+ uv.x + sin(m*120. + iTime*20.)*0.4)/7. )));
    
    }
    

    col = max(col,0.03*(0.5+0.5*sin(iTime*2.)));
    
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'NdlXzs';
    }
    name(): string {
        return 'Day 490';
    }
    sort() {
        return 761;
    }
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
}
