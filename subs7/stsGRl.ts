import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define pmod(p,a) mod(p,a) - 0.5*a
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pi acos(-1.)
#define iTime (iTime + 24.)
// from inigo quilez
vec3 triIntersect( in vec3 ro, in vec3 rd, in vec3 v0, in vec3 v1, in vec3 v2 )
{
    vec3 v1v0 = v1 - v0;
    vec3 v2v0 = v2 - v0;
    vec3 rov0 = ro - v0;
    vec3  n = cross( v1v0, v2v0 );
    vec3  q = cross( rov0, rd );
    float d = 1.0/dot( rd, n );
    float u = d*dot( -q, v2v0 );
    float v = d*dot(  q, v1v0 );
    float t = d*dot( -n, rov0 );
    if( u<0.0 || u>1.0 || v<0.0 || (u+v)>1.0 ) t = -1.0;
    return vec3( t, u, v );
}

vec4 n14(float f){ return texture(iChannel0,vec2(mod(floor(f),256.),floor(f/256.))/256.); }


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
    float char = chars[int(id.x)];
    //char += 112. ;
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
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(1.);
    col.x -= 0.1;
    //col.xz -= sin(abs(dot(uv,uv))*1.)*0.1;
    
    float envb = sin(floor(iTime/2.));
            
    bool hit = false;
    {
        vec3 ro = vec3(0.4,0,-1.);
        vec3 rd = normalize(vec3(uv + sin(envb*20.)*0.4,0.5));
        vec3 rol = ro;
        for(float i = 0.; i < 150.*(0.5 + 0.3*sin(envb*27.)); i++){
            
            float env = iTime + sin(iTime + i/40. + envb*20.);
            
            
            
            
            vec3 rol = ro + vec3(sin(i*20.),cos(i),sin(i*20.))*0.2;
            vec3 lrd = rd;
            ro += 0.1*sin(i*0.4 + env);
            lrd.yx *= rot(i*1.3 + env*0.1*sign(sin(envb*20.)));
            lrd.xz *= rot(envb*.5);
            vec3 a = vec3(0.,0.,-0.2);
            vec3 b = vec3(0.2,-0.2,0);
            vec3 c = vec3(0.1,0.2,0.);
            //b *= 1. + sin(i);
            //b *= 1. + sin(i);
            a *= 1. + sin(i);
            b *= 1. + sin(i + env*0.5);
            b *= 1. + sin(i + env*0.3);
            
            vec3 tri = triIntersect( rol + vec3(0.+sin(i*20. + env)*0.1,0,0), lrd, a, b, c );
        
            if(tri.x >0.){
                hit = true;
                //col -= 0. + ;
                col = mix(col,1.*pow(abs(envb),0.1)-col*0.5*sin(vec3(2,3.5,4) + i + tri.x*3. + env),1.);
            }
        }
    }
    
    {
        vec2 p = uv;
        p = pmod(p,0.02);
        float d = abs(p.x);
        d = min(d,abs(p.y));
        d -= 0.00;
        
        for(float j = 0.; j < 18.; j++){
            vec2 luv = uv + vec2(sin(j*20.)*1.5,sin(j*20.)*1.5);
            for(float i = 0.; i < 7. + sin(j)*9.; i++){
                p = luv;
                if(sin(i) < -0.9){
                    p *= rot(0.5*pi);
                }
                p.x -= 0.4 + sin(i*11. + envb*120. )*0.1;
                float ld = abs(p.x) - 0.005 + sin(i)*0.03;
                float env = sin(i*1.1 + j*1.1 + envb);
            
                ld = max(ld,p.y + sin(i*20. + env));
                //ld = abs(ld) - 0.001;
                d = max(d,-ld + 0.1);

            }
        }
        float od = d;
        d = 10e5;
        #define xor(a,b) min(max(a,-(b) + 0.5*sin(i)),max(b,-(a)))
        
        for(float j = 0.; j < 18.; j++){
            vec2 luv = uv + vec2(sin(j*20.)*1.5,sin(j*20.)*1.5);
            for(float i = 0.; i < 7. + sin(j)*9.; i++){
                p = luv;
                if(sin(i) < -0.9){
                    p *= rot(0.5*pi);
                }
                p.x -= 0.4 + sin(i*11.+ envb*120. )*0.1;
                
                float s =  - 0.005 + sin(i)*0.2;
                float ld = abs(p.x) + s;
                float env = iTime + sin(iTime + i*0.1 + j*0.1);
            
                ld = max(ld,p.y + sin(i*20. + env*0.1 + envb*12.));
                ld = max(abs(ld) - 0.001,-abs(p.x) - s);
                d = xor(d,ld);

            }
        }
            
        d = min(d,od);
        
        
        col = mix(col,vec3(1.,1. ,1.) - col*0.2 - 0.1,smoothstep(fwidth(uv.y),0.,d)*0.6);
        
        
        
    }
    
    {
                float t = 10e5;
            
            for(float i = 0.; i < 14.; i++){
                float m = sin(iTime*0.4 + sin(iTime)+i);
                t = min(t,text(uv + vec2(0. + sin(envb + i),sin(i+ m)*0.1), float[8](135.,130.,121.,119.,120.,132.,117.,130.), 0.04 +m*0.5 , 0.5 , true, 0.004, 0.3 + 0.1*sin(iTime+i*0.4), false));
                
                
            }
            {
                float m = sin(iTime*0.4 + sin(iTime));
                vec2 p = uv + vec2(0.7,-0.2);
                p *= rot(0.5*pi);
                p.x += (iTime + sin(iTime))*0.3;
                p.x = pmod(p.x,2.);
                //t = min(t,text(p, float[8](128.,127.,132.,113.,132.,117.,1117.,1130.), 0.01 +m*0.4 , 0.4 , true, 0.0001, 0.4 + 0.*sin(iTime*0.3 + 0.4), true));
            }   
             
            
            col = mix(col,vec3(1.,1. ,1.) - col*0.2 - 0.1,smoothstep(fwidth(uv.y) + 0.04,0., t)*0.5);
    }
    
    {
        vec2 p = uv;
        if( (abs(p.y) > 0.47 || abs(p.x) > 0.85)){
            col = 1. - col*0.4;
        }
    
    }
    //col = vec3(1.,1.,1.) - col*vec3(1.,0.7,1.);
    
    //col = smoothstep(1.,0.,vec3(1,1.,1.)-col*vec3(1.,1.,1.));
    if(sin(envb*12.) < 0.){
        float m = sin(envb*6.7 + iTime*0.3 + sin(iTime) );
        //m = max(abs(m),0.8)*sign(m);
        //col = pow(smoothstep(0.6,1.2,col),vec3(1. + m*1.5 ,1.   ,.5 - m*1.4));
        //col = pow(smoothstep(0.4,1.2,col),max(vec3(0.8 - m*4.,0.2   ,.5 + m*4.4),0.4));
        if(sin(envb*250.) <0.){
            col = 1. - col.xzy*vec3(0.1,0.5,0.5);
            
        } else {
            col = 1. - col.xzy*vec3(0.1,0.5,0.5);
            col = pow(col,vec3(2.,0.7,1.));
            col = smoothstep(0.6,1.,col.x*vec3(1.,1.,1.4));
        }
    }
    
    //col = mix(col,1.-exp(-col*1.4),0.6);
    
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'stsGRl';
    }
    name(): string {
        return 'Day 531';
    }
    sort() {
        return 759;
    }
    tags?(): string[] {
        return [];
    }
    main(): HTMLCanvasElement {
        return createCanvas();
    }
    webgl() {
        return WEBGL_2;
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
    channels() {
        return [
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
            webglUtils.FONT_TEXTURE,
        ];
    }
}
