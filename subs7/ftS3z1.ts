import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define pmod(p,a) mod(p,a) - 0.5*a 

#define iTime (iTime + 6.)
// plane degined by p (p.xyz must be normalized)
float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}
float opSmoothSubtraction( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h); }`;

const fragment = `
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pi acos(-1.)
float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float sdBox( vec2 p, vec2 b )
{
  vec2 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,q.y),0.0);
}

float env = 0.;


float map(vec3 p){
    p.xz *= rot(env + iTime);
    p.yz *= rot(sin(iTime));
    
    //d = min(length(p.xy),length(p.zx));
    //d = min(d,length(p.zy)) - 0.1;
    
    float e = env;
    float db = sdBox(p,vec3(0.5) - sin(e)*0.1) - 0.07; 
    //p = pmod(p,0.4);
    
    float d = length(p) - 0.4 + sin(iTime)*0. + sin(e)*0.1;
    //d = max(db,-d);
    d = opSmoothSubtraction( d, db, 0.4 );
    //d = abs(d) - 0.001;
    return d;
}


vec3 getNormal(vec3 p){
    vec2 t = vec2(0.004,0.);
    return normalize( 
        map(p) - vec3(
            map(p - t.xyy),
            map(p - t.yxy),
            map(p - t.yyx)
        )
    );
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-0.5*iResolution.xy)/iResolution.y;
    vec2 uvn = fragCoord/iResolution.xy;
    vec3 col = vec3(0);
    
    env = iTime + sin(iTime);
    
    
    vec3 ro = vec3(0,0,-2);
    vec3 p = ro;
    vec3 rd = normalize(vec3(uv,1));
    float side = 1.;
    
    
    
    float chrab = 0.;
    float refrd = 0.;
    for(int i = 0; i < 450; i++){
        float d = map(p)*side;
        //float pl = plaIntersect( ro, rd, vec4(0,0,-2,1.) );
        float db = -p.z + 0.8 + sin(env*pi/4. + 0.5*pi)*0.4;
        vec3 n = getNormal(p)*side;
        
        float accrf = 0.;
        float accbeer = 0.;
            
        if(side < 1.)
            accbeer += d;
            
        if(d < 0.0001){
            rd = refract(rd,n,0.94);
            ro = p;
            d += 0.01;
            side *= -1.;
            
            //chrab += dot(rd,reflect(rd,n));
            chrab += sin(dot(rd,reflect(rd,n))*10.);
            float rf = pow(max(dot(n,normalize(rd-normalize(vec3(1)))),0.), 2. )*4.;
            rf = pow(1.-max(dot(-rd,n),0.),5.);
            accrf += rf;
            col = mix(col,vec3(0.9,0.4,0.9)*1., rf);
        } else if (db < 0.001){
            //vec2 pp = (ro + rd*pl).xy;
            //pp.x /= iResolution.x/iResolution.y;
            
            float chrabSteps = 14.;
            vec3 acc = vec3(0);
            for(float i = 0.; i < chrabSteps; i++){
                for(int c = 0; c < 3; c++){
                    vec2 pp = p.xy;
                    vec2 oop = pp;
                    pp.x += env + iTime*0.1;
                    pp.x += vec3(-0.001,0.,0.002)[c]*chrab*16.*(0. - i/chrabSteps*1.);
                    vec2 opp = pp;
                    pp = pmod(pp,0.125);
                    float d = length(pp) - 0.004;
                    
                    float md = 0.5;
                    float db = abs(opp.y + abs(mod(opp.x*0.5,md) - 0.5*md)) - 1.;
                    float cc = mix(1.,vec3(0.)[c],smoothstep(0.007,0.,d));
                    
                    {
                        for(float arrow = 0.; arrow < 20.; arrow++){
                            float sz = 1. + sin(arrow)*0.4;
                            vec2 p = oop + vec2(mod((env + iTime*0.4)*(1. + sin(arrow*15.6)*0.6)*0.1,1.)*8. - 4.,sin(arrow*20.)*1.5);
                            p *= sz;
                            
                            float md = 0.1;
                            p.x -= abs(p.y);
                            vec2 q = p;
                            q.x = pmod(p.x,md);
                            
                            
                            float d = length(q.x) - md*0.3;
                            d = max(d,abs(p.y) - 0.04);
                            
                            d = max(d,abs(p.x) - md*floor(4. + sin(arrow*10.)));
                            
                            d /= sz;
                            cc = mix(cc,0.,smoothstep(0.007,0.,d));
                        }
                    }
                    
                    //cc = mix(cc,vec3(1)[c],smoothstep(0.007,0.,db));
                    //cc = mix(cc,vec3(0.1,1.,0.5)[c],smoothstep(0.007,0.,abs(db) - 0.02));
                    
                    
                    acc[c] += cc ;

                }
                
            }
            col = mix(col,acc/chrabSteps,1.-col);
            //col = mix(col,col*0.,accbeer*1.1);
            
            
            //col = texture(iChannel0,pp).xyz;

            break;
        }

        d = min(d,db);
        
        p += rd*d;
    }
    
    {
        vec2 p = uv;
        p.xy *= rot(0.5*pi);
        
        if (p.y < 0.){
            p.y = -p.y;
        }
        p.y -= 0.75;
        p.y -= 0.12;
        
        float d = 10e5;
        #define xor(a,b) min(max(a,-(b) + 0.04),max(b,-(a)))
        for(float i = 0.; i < 12.; i++){
            vec2 q = p;
            float e = iTime*0.1 + env*0.1 + float(uv.x < 0.);
            
            if(mod(i,3.) < 1.){
                q.x = -q.x;
                e += 1.2;
            }
            q.x += sin(i + e);
            q.y += fract(clamp(q.x*6.,0.,0.99))*0.15;
            float ld = sdBox(q,vec2(0.5,0.014));
            
            d = xor(d,ld);
            
        }
        
        //d = abs(d);
        
        
        p = uv;
        p.y = abs(p.y) - 0.2;
        float douter = p.y - 0.22;
        douter = - douter;
        float md = 0.04;
        float id = floor(p.x/md);
        p.x = pmod(p.x,md);
        
        
        p.x += sin(id/md + (env + iTime*0.2)*2.)*md/1.;
        
        p.y -= 0.31;
        //douter = max(douter,-sdBox(p,vec2(0.006,0.04)));
        
        col = mix(col,1.-col*vec3(0.5,0.1,0.2),smoothstep(0.001,0.,douter));
        //col = mix(col,vec3(0.,0.7 ,0.6),smoothstep(0.004,0.,d));
        
    }
    
    //col = texture(iChannel0,uvn).xyz;
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'ftS3z1';
    }
    name(): string {
        return 'Day 538';
    }
    sort() {
        return 757;
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
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
            webglUtils.FONT_TEXTURE,
        ];
    }
}
