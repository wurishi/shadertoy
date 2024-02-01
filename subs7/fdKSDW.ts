import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define iTime (iTime + 56.)


// from iq
float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}
// from iq
vec2 boxIntersection( in vec3 ro, in vec3 rd, vec3 boxSize, out vec3 outNormal ) 
{
    vec3 m = 1./rd; // can precompute if traversing a set of aligned boxes
    vec3 n = m*ro;   // can precompute if traversing a set of aligned boxes
    vec3 k = abs(m)*boxSize;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
    if( tN>tF || tF<0.0) return vec2(-1.); // no intersection
    outNormal = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);
    return vec2( tN, tF );
}
float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}
float sdSegmentPersp( in vec2 p, in vec3 _a, in vec3 _b )
{
    float amt = 1.;
    vec2 a = _a.xy/_a.z*amt;
    vec2 b = _b.xy/_b.z*amt;
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}
#define xord(a,b,c) min(max(a,-(b) + c),max(b,-(a)))
    #define xor(a,b) float(int(a)^int(b))
    #define and(a,b) float(int(a)&int(b))
    #define or(a,b) float(int(a)|int(b))
    #define pi acos(-1.)
    #define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
    #define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + (e)))
#define pmod(p,a) mod(p,a) - 0.5*a


// dave hoskins hash
vec4 r14(float p)
{
	vec4 p4 = fract(vec4(p) * vec4(.1031, .1030, .0973, .1099));
    p4 += dot(p4, p4.wzxy+33.33);
    return fract((p4.xxyz+p4.yzzw)*p4.zywx);
    
}
`;

const buffA = `


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    uv *= 1.+smoothstep(1.,0.,dot(uv,uv))*0.05;
    vec3 col = vec3(1);
    float pxSz = fwidth(uv.y);
    
    float seg = 1.;
    
    
    
    // ----- 2d stuf ----- //
    {
        float range = 4.;
        float a = 0.;
        float b = 1.;
        float fact = smoothstep(0.,0.1,fract(iTime/range));
        float id = floor(iTime/range);
        float bs;
        if(mod(id,2.) == 0.){
            bs = mix(a,b,fact);
        }else {
            bs = mix(b,a,fact);
        }
        
        vec2 smallsz = vec2(0.4,0.42)*1.;
        if(mod(id-1.,4.) < 2.){
            smallsz *= 0.5;
        }
        
        
        vec2 s = mix(smallsz,vec2(2),bs);
        float d = sdBox( uv, s );
        col = mix(col,1.-col,smoothstep(pxSz,0.,-d));
        
        /*
        float cnt = 20.;
        for(float i = 0.; i < cnt; i++){
            
            vec4 r = r14(i);
            vec2 bpos = r.xy*2. - 1.;
            bpos.x*=0.5;
            bpos.x += sign(bpos.x)*float(abs(bpos.x) < 0.5)*0.5;
            bpos.y = mod(bpos.y + iTime*abs(sin(i))*0.2  + sin(i*4. + iTime)*0.1 + i,1.)*3.-1.;

            vec2 p = uv - bpos;
            vec3 c = pal(vec3(0.5,0.8,0.7),vec3(1,0.6,1),vec3(3,2,1),1.*sin(i),floor(p.y*20.)  + iTime);
            c = pow((c),vec3(.1,.8,0.9));
            //c = 1.-c;
            
            float d = sdBox(p,vec2(0.02,0.1));
            col = mix(col,c,smoothstep(pxSz,0.,d-0.0003));
            
        }
        */
        // lines
        {
        vec2 p = uv;
        float liters = 52.;
        for(float i = 0.; i < liters; i++){
            float T = iTime*0.4;
            float lt = (T*(1. + sin(i) ) + sin(T + i*20.)*0.5)*0.1;
            vec2 bpos = + vec2(mod(
                lt
                ,1.)*3. - 1.5,cos(i*16.)*0.5);
            
            bpos.y += sign(bpos.y)*float(abs(bpos.y) < 0.5)*0.5;
            
            vec2 p = uv.yx + bpos;

            p *= rot(0.5*pi);
            float d = sdBox(p,vec2(0.01,0.1 + sin(i*20. + iTime + sin(i+iTime)))*0.4);
            
            p *= rot(0.5*pi);
            float md = 0.04;
            float id = floor(p.x/md + iTime*4.);
            p.x = pmod(p.x,md);
            
            d = max(d,abs(p.x) - 0.03*abs(sin(id*4. + i)) + 0.01);
            //col = mix(col,vec3(0.,0.6,0.5)-col*1.,smoothstep(pxSz,0.,d));
            col = mix(col,vec3(1.)-col*1.,smoothstep(pxSz,0.,d));
        
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
                //col = mix(col,vec3(0.,0.6,0.5)-col*1.,smoothstep(pxSz,0.,d));

            }    
        }

    }
    
    float deye = 10e5;
    {
        vec2 p = uv;
        float liters = 125.*float(seg==0.) + 40.*float(seg==1.) ;
        for(float i = 0.; i < liters; i++){
        
            float lt = (iTime*(1. + sin(i) ) + sin(iTime + i*20.)*0.5)*0.1;
            vec2 p = -uv.yx + vec2(mod(
                lt
                ,1.)*3. - 1.5,cos(i*16.)*0.5);
            p = p.yx;
            
            float d = sdBox(p,vec2(0.2));
            
            deye = min(deye,d);
            //deye = min(deye,sdBox(uv + vec2(0.1,0.2),vec2(0.2)));


            col = mix(col,vec3(0),smoothstep(pxSz,0.,abs(d) - 0.002));

        }
    }
    {
        float circ = length(uv);
        
        
    }
    
    
    
    // ----- 3d stuf ----- //
    float boxCnt = 52.;
    vec3 ro = vec3(0,0.,-0);
    vec3 rd = normalize(vec3(uv,1.));
    rd += 0.001;
    for(float i = 0.; i < boxCnt; i++){
        
        vec3 n = vec3(0);
        vec4 r = r14(i);
        vec4 rb = r14(i+13.);
        
        vec3 sz = vec3(0.1,0.2,0.1) ;
        
        vec3 bpos = r.xyz*2. - 1.;
        bpos.z += 2.;
        bpos.x*=0.8;
        bpos.y = mod(bpos.y + iTime*abs(sin(i))*0.3  + sin(i*4. + iTime)*0.04 + i,1.)*4.-2.;
        vec2 b = boxIntersection( ro-bpos, rd, sz,  n);
        sz -= 0.005 + (sin(iTime+i)*2.+1.)*.0;
        if(b.x > 0. && b.y > 0.  ) {
            col = mix(
                col,
                0.3*abs(dot(col,col))-col,
                smoothstep(pxSz,0.,deye)
            );
         
            vec3 vertxyz = bpos + sz;
            vec3 vertnxnynz = bpos - sz;
            vec3 vertnxyz = bpos + vec3(-sz.x,sz.y,sz.z);
            vec3 vertxnyz = bpos + vec3(sz.x,-sz.y,sz.z);
            vec3 vertxynz = bpos + vec3(sz.x,sz.y,-sz.z);
            vec3 vertnxynz = bpos + vec3(-sz.x,sz.y,-sz.z);
            vec3 vertnxnyz = bpos + vec3(-sz.x,-sz.y,sz.z);
            vec3 vertxnynz = bpos + vec3(sz.x,-sz.y,-sz.z);
            float d = 10e5;
            d = min(d,sdSegmentPersp( uv.xy, vertxyz, vertxnyz ));
            d = min(d,sdSegmentPersp( uv.xy, vertxyz, vertnxyz ));
            d = min(d,sdSegmentPersp( uv.xy, vertxyz, vertxynz ));
            
            d = min(d,sdSegmentPersp( uv.xy, vertnxnynz, vertnxnyz ));
            d = min(d,sdSegmentPersp( uv.xy, vertnxnynz, vertxnynz ));
            d = min(d,sdSegmentPersp( uv.xy, vertnxnynz, vertnxynz ));
            
            d = min(d,sdSegmentPersp( uv.xy, vertnxynz, vertnxyz ));
            d = min(d,sdSegmentPersp( uv.xy, vertnxynz, vertxynz ));
            
            d = min(d,sdSegmentPersp( uv.xy, vertnxnyz, vertnxyz ));
            d = min(d,sdSegmentPersp( uv.xy, vertnxnyz, vertxnyz ));
            
            d = min(d,sdSegmentPersp( uv.xy, vertxnynz, vertxynz ));
            d = min(d,sdSegmentPersp( uv.xy, vertxnynz, vertxnyz ));
            
            //col = mix(col,1.-col,smoothstep(fwidth(abs(d)),0.,d - 0.0004));
            col = mix(col,vec3(1),smoothstep(pxSz,0.,d-0.001));
            
            
        }
    }
            
    if(iMouse.z > 0.)
        col = 1. - col;
    
    
    fragColor = vec4(col,1.0);
}`;

const fragment = `
// Fork of "Day 670" by jeyko. https://shadertoy.com/view/7dGSWW
// 2021-10-19 14:31:23

// Fork of "Day 539" by jeyko. https://shadertoy.com/view/slSGz1
// 2021-06-11 08:12:26

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pmod(p,a) mod(p,a) - 0.5*a


// cyclic noise by nimitz. i have a tutorial on it on shadertoy

float noise(vec3 p_){
    float n = 0.;
    float amp = 1.;
    vec4 p = vec4(p_,11.);
    p.xy *= rot(1.4);
    p.x *= 3.;
    for(float i = 0.; i < 3.; i++){
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

vec3 get(vec2 fc, vec2 uv){
    vec2 coord = fc/iResolution.xy;
    float chrabamt = 0.*smoothstep(0.,1.,dot(uv,uv));
    vec3 c = vec3(
        texture(iChannel0,coord+ chrabamt*vec2(0.000,0.00)).x,
        texture(iChannel0,coord + chrabamt*vec2(-0.0003,0.00)).y,
        texture(iChannel0,coord + chrabamt*vec2(0.,0.001)).z
        );
    return c;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0);
    
    //fragCoord += 150.*noise(vec3(uv*2.5,5.))/iResolution.xy;
    col = get(fragCoord,uv);
    
    float no = noise(vec3(uv*2.,35.));
    //col = mix(col,vec3(0),smoothstep(0.,0.5,max(noise(vec3(uv*2.2 + 0.1,35.)) - 0.5,0.))*0.4);
    
    col = mix(col,vec3(1),smoothstep(0.,5.,max(no - 0.5,0.))*.05);
    
    //col += min(no - 0.5,0.)*0.02;
    
    float n1d = texelFetch(iChannel2,ivec2(mod(fragCoord + vec2(float(iFrame)*0.,0.),256.)),0).x*0.5;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(fragCoord + n1d*200. ,256.)),0).xyz*0.6;
    
    
    //C = smoothstep(0.,1.,C);z
    
    //col.xyz = pow(max(col.xyz,0.), vec3(0.55) + n*0.1);
    
    
    
    col = pow(clamp(col,0.,1.),vec3(0.6545));

    col.xyz += smoothstep(1.,0.,length(col))*n*0.2;
    
    col.xyz -= smoothstep(0.,1.,length(col))*n*0.1;
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'fdKSDW';
    }
    name(): string {
        return 'Day 670';
    }
    sort() {
        return 753;
    }
    tags?(): string[] {
        return [];
    }
    common() {
        return common;
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
    webgl() {
        return WEBGL_2;
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {};
    }
    channels() {
        return [
            { type: 1, f: buffA, fi: 0 },
            webglUtils.DEFAULT_NOISE,
            webglUtils.DEFAULT_NOISE,
        ];
    }
}
