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


#define dmin(a,b,c) (max(a.x,-b) < b ? a : vec2(b,c))

float sdTriangle( in vec2 p, in vec2 p0, in vec2 p1, in vec2 p2 )
{
    vec2 e0 = p1-p0, e1 = p2-p1, e2 = p0-p2;
    vec2 v0 = p -p0, v1 = p -p1, v2 = p -p2;
    vec2 pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0.0, 1.0 );
    vec2 pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0.0, 1.0 );
    vec2 pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0.0, 1.0 );
    float s = sign( e0.x*e2.y - e0.y*e2.x );
    vec2 d = min(min(vec2(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),
                     vec2(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),
                     vec2(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
    return -sqrt(d.x)*sign(d.y);
}

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}`;

const buffA = `
#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + (e)))
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))


float cnt = 0.;
void get(vec3 p, inout vec3 col, vec2 uv, bool reverse){
    
    
    if(reverse){
        p.yz *= rot(0.8 );
        p.yx *= rot(0.4  );

        p.zx *= rot(-0.4 - iTime*0.);
    
    }
    
    float df = fwidth(p.x);
    float md = 0.35;
    
    vec3 id = floor(p/md + 0.);
    
    
    p = pmod(p,md);
    
    vec3 triCol = pal(0.5,0.5*vec3(1.,0.1,0.5),vec3(1,5. + 20.*id.y + iTime + uv.x*2. + length(p)*4.,3),2.,id.x*5. + uv.x*1. + iTime);
    
    //triCol = mix(triCol,vec3(1),smoothstep(0.,4.,cnt));
    
    
    {    
        //col = mix(col,vec3(0.9),smoothstep(df,0.,abs(max(p.x,max(p.y,p.z)) - md*0.45) - md*0.01 ));
    }
    float env = 0.;
    
    if(reverse){
        env = (sin(fract(sin(id.x*4. + id.y*id.z*20.)*40.)*20. + id.y*10. + iTime*0.4*sin(id.x*20. + sin(id.z*20.)*20.)));
        
    } else {
        env = pow(sin(fract(sin(id.x*4. + id.y*id.z*20.)*40.)*20. + id.y*10. + iTime*0.8*sin(id.x*20. + sin(id.z*20.)*20.)),5.);
    
    }
    
    p = abs(p);
    
    if(sin(id.x + fract(sin(id.z)*10.)*200.) < 1.){
        float d = length(p) - 0.1*env;
        //d = abs(d);
        if(reverse){
            float d = (length(p)) - 0.4*md*env;
       
            d = abs(d);
            d -= 0.01;
            
            d/= df;
            
            vec3 nc = 2.-col;
            
            nc.xz *= rot(0. - sin(id.x + id.y*10. + sin(id.z))*0.7);
            col = mix(col,nc,smoothstep(1.,0.,d));
            //col -= col;
        } else {
            col = mix(col,triCol,smoothstep(df,0.,d));
        
        }
        
        //col = mix(col,triCol,smoothstep(df,0.,abs((p).x)));

    }
    cnt ++;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float vn = valueNoiseStepped(iTime*0.25,2.,2.);
    float vnb = valueNoiseStepped(iTime*0.125,4.,2.);
    vnb = pow(vnb,82.);
    
    vec2 muv = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;
    
    vec2 uv = fragCoord/iResolution.y;
    uv -= 0.5;
    vec3 col = vec3(1,1.4,1.)*1.;
    uv += vec2(muv.x,muv.y);
    
    uv *= rot(0.7);
    uv.y += iTime*0.1;
    
    
    
    vec3 p = vec3(uv,1);
    
    p.yz *= rot(0.4 );
    p.yx *= rot(0.7  );
    
    p.zx *= rot(-0.4 - iTime*0.);
    
    
    //get(p*17.*2., col, uv);
    
    vec3 scrobble = vec3(0,1.,1)*(iTime*1. + vn*10.);
    
    //get(p*1. + scrobble*0.0, col, uv, true);
    
    get(p*18. + scrobble*0.2, col, uv, false);
    
    get(p*27. + scrobble*0.05, col, uv, false);
    
    get(p*6. + scrobble*0.21, col, uv, false);
    get(p*1. + scrobble*0.2, col, uv, false);
    get(p*1.5+ scrobble*0.1, col, uv, true);
    get(p*4.5+ scrobble*0.1, col, uv, true);
    
    
    
    fragColor = vec4(col,1.0);
}`;

const buffB = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    float sc = 0. + valueNoise(iTime*14.,2.)*0. ;
    
    fragColor.x =texture(iChannel2,(fragCoord + sc*vec2(0,8))/iResolution.xy).x;
    
    fragColor.y =texture(iChannel2,(fragCoord + sc*vec2(0,-1))/iResolution.xy).y;
    
    fragColor.z =texture(iChannel2,(fragCoord + sc*vec2(0,-4))/iResolution.xy).z;
    
    
}`;

const fragment = `


// 2d slices of a 3d cube lattice as learned from blackle! 

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragCoord -= 0.5*iResolution.xy;
    //fragCoord *= 0.99;
    fragCoord += 0.5*iResolution.xy;
    
    float n1d = texelFetch(iChannel3,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel3,ivec2(mod(fragCoord  + n1d*200. ,256.)),0).xyz;
    
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    fragColor.xyz =texture(iChannel2,fragCoord/iResolution.xy).xyz;
    
    //fragColor.xyz = floor(fragColor.xyz*50.)/50.;
    
    fragColor.xyz = pow(fragColor.xyz, vec3(1.,1.2,1));
    
    //fragColor.xyz = 1. - fragColor.xyz;
    
    
    //fragColor.xyz *= 1. - dot(uv,uv)*0.8;
    fragColor.xyz = pow(fragColor.xyz, vec3(0.4545 + n*0.));
    fragColor.a = 1.;
    
    //fragColor = texture(iChannel2,fragCoord/iResolution.xy);
    
    //fragColor.xyz += smoothstep(1.,0.,length(fragColor))*n*0.;
    
    //fragColor.xyz -= smoothstep(0.,1.,length(fragColor))*n*0.05;
    
}
`;

export default class implements iSub {
    key(): string {
        return 'Wl3Bzl';
    }
    name(): string {
        return 'Day 423';
    }
    sort() {
        return 771;
    }
    common() {
        return common;
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
    channels() {
        return [
            webglUtils.TEXTURE5,
            webglUtils.DEFAULT_NOISE, //
            { type: 1, f: buffA, fi: 2 },
            webglUtils.DEFAULT_NOISE,
        ];
    }
}
