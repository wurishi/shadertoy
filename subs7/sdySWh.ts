import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define R iResolution.xy
#define T(u) texture(iChannel0,(u)/R)

///  3 out, 3 in...
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);

}
vec2 sphIntersect( in vec3 ro, in vec3 rd, in vec3 ce, float ra )
{
    vec3 oc = ro - ce;
    float b = dot( oc, rd );
    float c = dot( oc, oc ) - ra*ra;
    float h = b*b - c;
    if( h<0.0 ) return vec2(-1.0); // no intersection
    h = sqrt( h );
    return vec2( -b-h, -b+h );
}

float r11(float g){return fract(sin(g*12.5)*4.5);}
// from iq
vec2 boxIntersection( in vec3 ro, in vec3 rd, vec3 boxSize, out vec3 outNormal ) 
{
    vec3 m = 1.0/rd; // can precompute if traversing a set of aligned boxes
    vec3 n = m*ro;   // can precompute if traversing a set of aligned boxes
    vec3 k = abs(m)*boxSize;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
    if( tN>tF || tF<0.0) return vec2(-1.0); // no intersection
    outNormal = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);
    return vec2( tN, tF );
}
// from iq
float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}
#define xord(a,b,c) min(max(a,-(b) + c),max(b,-(a)))
    #define xor(a,b) float(int(a)^int(b))
    #define and(a,b) float(int(a)&int(b))
    #define or(a,b) float(int(a)|int(b))
    #define pi acos(-1.)
    #define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
    #define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + (e)))
#define pmod(p,a) mod(p,a) - 0.5*a
vec3 gp;
vec3 n;
vec2 intersect(vec3 ro, vec3 rd){
    //return sphIntersect( ro, rd, vec3(0), 1. );
    return boxIntersection(ro,rd,vec3(1),n);

}`;

const buffA = `
vec3 gg(vec3 p){
    p.xz *=rot(0.25);
    p.x += (iTime + sin(iTime))*0.2;
    vec3 c = vec3(0);
    p*=4.16;
    gp = p;
    float md = 2.;
    //p.x += iTime + sin(iTime);
    vec3 id = floor(p/md);
    //p.x = pmod(p.x,md);
    c += mod(id.x,2.);
    c = vec3(dot(c,c));
    c = clamp(c*20.,0.06,1.);
    return c;
}
    
vec3 get(vec2 fragCoord){
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    float pxSz = fwidth(uv.y);
    vec3 col = vec3(1);

    

    // 3d
    {
        vec3 ro = vec3(0);
        vec3 rd = normalize(vec3(uv,0.2));
        rd.yx*=rot(0.5);
        float t = iTime + sin(iTime + 3.);
        vec3 p = ro;
        vec3 att = vec3(1);
        vec3 C = vec3(0);
        
        for(float bnc = 0.; bnc < 1.; bnc++){
            vec2 box = intersect(p,rd);
            p = p + rd*box.y;
            vec3 c = gg(p);
            //C.xyz += c*att;
            att *= c;
            float bncSubCnt = 10.;
            float ratio = 0.1 + 0.9*floor(mod(gp.y*2.,2.));;

            p += n*0.002;
            for(float bncSub = 0.; bncSub < bncSubCnt; bncSub++){
                vec3 diff = hash33(vec3(uv*16.,bncSub + float(iFrame)*0.6));
                diff = normalize(diff);
                if(dot(diff,n)<0.)
                    diff = -diff;

                vec3 brd = reflect(rd,n);
                brd = mix(-brd,diff,ratio);
                brd = normalize(brd);
                vec2 scene = intersect(p,brd);
                vec3 pp = p + brd * scene.y;
                vec3 c = gg(pp);
                C += c*att/bncSubCnt;
                //att *= c;

                //vec2 
            }
        }
        C = clamp(C,0.,1.);
        vec2 luv = uv;
        luv.y += 0.3;
        float d = sdBox( luv, vec2(0.,0.3) ) - 0.3;
        
        //C = mix(vec3(0.8,0.6,0.5)*1.,vec3(1.,0.4,0.1)*0.,C);
        C = mix(vec3(0.8,0.6,0.5)*1.,vec3(1.,0.6,0.5)*0.2,C);
        
        //C = 1.-C*0.5;
        //col = mix(col,C,smoothstep(pxSz,0.,d));
        //col = col - (1.-col)*C*1.;
        //col = mix(col,C,smoothstep(0.9,1.,col));
        col = mix(col,C,col);
    
    }
    
        // Left thing
    {
        float p = 0.;
        vec2 luv = uv + vec2(0.5,-0.02);
        vec2 u = luv*1. + 1. ;
        float acc = 0.;
        for(float i = 1.; i < 17.; i++){
            float mul = 2.*i;
            if(mod(i,2.) == 0.){
                p += xor(u.y*mul,u.x*mul + floor(iTime*2. + u.y))*1.;
                acc += p;
            } else {
                u += and(u.x*mul - floor(iTime*4. + u.y) ,u.y*mul)*1.;

                p += xor(u.x*mul + floor(iTime*4. + u.y) ,u.y*mul)*1.;
                acc += p ;
            }
            p = mod(p*1.,2.);
        }
        
        
        vec3 c = pal(vec3(1.,0.2,0.5),0.5,vec3(3,2,1),1.,acc*20. + iTime);
        c = pow((c),vec3(0.1,0.2,1));
        
        p = clamp(p,0.,1.);
        vec2 bsz = vec2(0.0,0.0);
        float d = sdBox( luv, bsz ) - 0.05;
        bsz += 0.156;
        d -= 0.001;
        
        float db = sdBox( luv, bsz );
        db = max(  
            max(db,-abs(d - 0.14)+0.014)  ,
            -d + 0.14);
        
        db = min(db, abs(luv.x - 0.2)-0.001);
        db = min(db, abs(luv.x - 0.8)-0.001);
        
        db = min(db, 
                max(
                    abs(luv.y - 0.255)-0.001,
                    -abs(luv.x - 0.5) + 0.3
                )
            );
            
        // remove maybe
        db = min(db, 
                max(
                    abs(luv.y - 0.29)-0.001,
                    (luv.x - 0.5) + 0.3
                )
            );
        db = min(db, 
                max(
                    abs(luv.y + 0.256)-0.001,
                    (luv.x - 0.5) + 0.3
                )
            );
            
        // star thing
        float s = 0.06;
        
        vec2 lluv = abs(luv) - vec2(0.2,0);
        float dc = length(lluv) - s;
        
        dc = max(dc,lluv.x);
        lluv = abs(lluv) - s;
        dc = max(dc,-length(lluv) + s);
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,dc));
        
        // aaaaa
        
        //db = min(db,sdBox( luv + vec2(bsz.x*2.,0.), bsz ));
        col = mix(col,vec3(0),smoothstep(pxSz,0.,db));
        
        col = mix(col,mix(vec3(0),c,p),smoothstep(pxSz,0.,d - 0.07));
        
        //col = mix(col,vec3(p),smoothstep(pxSz,0.,d - 0.07));
        col = mix(col,vec3(0),smoothstep(pxSz,0.,abs(d - 0.07) - 0.003));
        
    }
    // Top thing
    {
        float p = 0.;
        vec2 luv = uv + vec2(0.,-0.4);
        vec2 u = luv*1. + 1. ;
        p = clamp(p,0.,1.);
        vec2 bsz = vec2(0.1,0.00);
        float d = sdBox( luv, bsz );
        float s = 0.02;
        d -= 0.01;
        col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
        
        float db = sdBox( luv, vec2(0.3,0.001) );
        float dbb = sdBox( -luv, vec2(0.3,0.001) );
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,db));
        col = mix(col,vec3(0),smoothstep(pxSz,0.,dbb));
        
        luv = abs(luv) - vec2(bsz*2.);
        float dc = length(luv) - s;
        
        dc = max(dc,luv.x);
        luv = abs(luv) - 0.02;
        dc = max(dc,-length(luv) + s);
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,dc));
        
        
    }

    // deez balls
    {
        float range = 3.;
        float id = floor(iTime/range);
        float a = abs(sin(id))*10.;
        float b = abs(sin(id + 1.))*10.;
        float fact = smoothstep(0.,0.5,fract(iTime/range));
        float bs;
        bs = mix(a,b,fact);
        
        float ballCnt = 16. + bs;
        float layerCnt = 2.;
        for (float ball = 0.; ball < ballCnt; ball++){
            for (float layer = 0.; layer < layerCnt; layer++){
                
                float ttt = mod(iTime + ball/ballCnt,3.);
                float pump = smoothstep(0.,0.2,ttt)*smoothstep(0.4,0.,ttt);
    
                float env = mod((iTime + layer/layerCnt + ball/ballCnt*(2.) + sin(iTime)*0.3)*0.5,0.99);
                
                float ballidx = ball/ballCnt*pi*4. +layer/layerCnt*pi*0. + env;
                vec2 p = vec2(
                    sin(ballidx),cos(ballidx)
                    ) *(0. +env*2.5 + pump)*0.1;
                
                float size = smoothstep(0.,1.,env)*smoothstep(1.,0.2,env)*0.1 -0.01;
                //float size = 0.01;
                col = mix(col,vec3(0),smoothstep(pxSz,0.,length(uv - p) - size));
                    
            }

        }
    
    }
    // top left
    {
        vec2 luv = uv;
        luv.x += 0.64;
        luv.y -= 0.37;
        // blocks
        for(float i = 0.; i < 3.; i++){
            float d = sdBox(luv, vec2(0.007));    
            vec3 c = pal(vec3(1.,0.2,0.5),0.5,vec3(3,2,1),1.,i + iTime);
            c = pow(abs(c),vec3(0.1,0.2,1));
            col = mix(col,c,smoothstep(pxSz,0.,d));
            
            d = abs(d) - 0.003;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
            luv.x -= 0.04;
        }
        luv.x -= 0.1;
        luv.y += 0.0;
        
        float range = 1.;
        float a = abs(sin(iTime));
        float b = abs(sin(iTime*1.4));
        float fact = smoothstep(0.,0.5,fract(iTime/range));
        float id = floor(iTime/range);
        float bs;
        if(mod(id,2.) == 0.){
            bs = mix(a,b,fact);
        }else {
            bs = mix(b,a,fact);
        }
        
        float d = sdBox(luv + vec2(bs*2. - 1.,0.)*0.02, vec2(0.007));
        d = abs(d) - 0.003;
        luv.y = abs(luv.y);
        d = min(d,sdBox(luv - vec2(0,0.01),vec2(0.04,0.001)) - 0.001);
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
                
        
    }
    // Bottom thing
    {
        float p = 0.;
        vec2 luv = uv + vec2(-0.01,0.4);
        vec2 u = luv*1. ;
        u = abs(u);
        u.x += u.y;
        float acc = 0.;
        float T = iTime + sin(iTime);
        T *= 0.5;
        for(float i = 1.; i < 7.; i++){
            float mul = 2.*i;
            if(mod(i,2.) == 0.){
                p += xor(u.y*mul,u.x*mul- T  )*1.;
            } else {
                u += and(u.x*mul - T   ,u.y*mul- T)*1.;

                p += xor(u.x*mul  ,u.y*mul)*1.;

            }
            acc += p + u.x + u.y;
            p = mod(p*1.,3.);
        }
        vec3 c = pal(vec3(1.,0.2,0.5),0.5,vec3(3,2,1),1.,acc + iTime);
        c = pow(abs(c),vec3(0.1,0.2,1));
        c = 1.-col*vec3(0.,0.8,0.2)*0.5 + c*0.5;
        p = clamp(p,0.,1.);
        vec2 bsz = vec2(0.1,0.0);
        float d = sdBox( luv, bsz );
        luv   -= vec2(-0.01,0.);
        float db = sdBox( luv  , vec2(0.3,0.001) );
        float dbb = sdBox( -luv , vec2(0.3,0.001) );
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,db));
        col = mix(col,vec3(0),smoothstep(pxSz,0.,dbb));
        
        d = d - 0.03;
        col = mix(col,mix(vec3(0),c,p),smoothstep(pxSz,0.,d));
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,abs(d) - 0.004));
        
        
        float s = 0.02;
        luv = abs(luv) - vec2(bsz*3.);
        float dc = length(luv) - s;
        
        dc = max(dc,luv.x);
        luv = abs(luv) - 0.02;
        dc = max(dc,-length(luv) + s);
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,dc));
        
    }
    // right
    {
        vec2 luv = uv;
        luv.x -= 0.4;
        luv.y -= 0.2;
        // blocks
        for(float i = 0.; i < 5.; i++){
            float d = sdBox(luv, vec2(0.007));    
            vec3 c = pal(vec3(1.,0.2,0.5),0.5,vec3(3,2,1),1.,i + iTime);
            c = pow(abs(c),vec3(0.1,0.2,1));
            col = mix(col,c,smoothstep(pxSz,0.,d));
            
            d = abs(d) - 0.003;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
            luv.y += 0.04;
        }
        luv.y += 0.02;
        // balls
        float balld = 0.2;
        float balliters = 5.;
        
        float env = sin(iTime);
        float bd = sdBox(luv +vec2(0.,balld*0.79 + env*balld*0.6),vec2(0,balld*(0.4-abs(env)*0.4)));
        col = mix(col,vec3(0),smoothstep(pxSz,0.,bd-0.003));
            
        for(float i = 0.; i < balliters-1.; i++){
            luv.y += balld/balliters;
            float d = length(luv);
            d = abs(d) - 0.004;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
            luv.y += 0.04;
        }
        // other blocks
        luv.y -= 0.4;
        luv.x += 0.1;
        float iters = 5.;
        for(float i = 0.; i < iters; i++){
            vec2 u = luv;
            //u *= rot(i*iters*pi);
            float d = sdBox(luv, vec2(0.002,0.01));    
            d = abs(d) - 0.003;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
            luv.y += 0.04;
        }
    }
    // bottom left
    {
        vec2 luv = uv;
        luv.x += 0.55;
        luv.y += 0.35;
        float iters = 15.;
        for(float i = 0.; i < iters; i++){
            vec2 u = luv;
            u *= rot(i/iters*pi*2.);
            u.y -= 0.02+ 0.03*abs(sin(iTime*2. + i));
            float d = sdBox(u, vec2(0.00,0.003));    
            d = abs(d) - 0.002;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
        }
        luv.x -= 0.15;
        luv.y += 0.;
        /*
        iters = 8.;
        float d = 10e5;    
            
        for(float i = 0.; i < iters; i++){
            vec2 u = luv;
            u *= rot(i/iters*pi*4. + sin(iTime + i));
            //u.y -= 0.02+ 0.03*abs(sin(iTime*2. + i));
            float ld = length(u + 0.01) - 0.02*(sin(iTime*2. + i*0.6)) - 0.02;
            //ld = abs(ld) - 0.002;
            d = xord(d,ld,0.02);
        }
        d = abs(d) - 0.001;
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
        */
        luv.y += 0.005;
        float md = 0.015;
        float range = 4.;
        vec2 lluv = luv;
        vec2 id = floor(lluv/md);
        lluv = pmod(lluv,md);
        if(abs(id.x) < range && abs(id.y) < range ){
            float d = length(lluv) - 0.004*sin(dot(id,id) + iTime*5. + sin(iTime*2.) + id.y);
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
        }
        
        // other blocks
        luv.x -= 0.1;
        iters = 5.;
        for(float i = 0.; i < iters; i++){
            vec2 u = luv;
            //u *= rot(i*iters*pi);
            float d = sdBox(luv, vec2(0.002,0.01));    
            d = abs(d) - 0.003;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
            luv.y += 0.04;
        }
        // other blocks
        luv.x += 0.35;
        luv.y -= 0.25;
        iters = 6.;
        for(float i = 0.; i < iters; i++){
            vec2 u = luv;
            float env = smoothstep(1.,0.,abs(i - mod(iTime*2.,iters + 1.) + 1.));
            u = abs(u) - 0.02*env;
            //u *= rot(i*iters*pi);
            float d = sdBox(u, vec2(0.002,0.002));    
            d = abs(d) - 0.001;
            col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
            luv.y += 0.02;
        }
        
    }
    
    // Upper black block
    {
        vec2 luv = uv;
        luv.y -= 0.56;
        float d = sdBox(luv,vec2(0.3,0.1));
        col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
    }
    // Outer
    // edges
    {
        vec2 luv = uv;
        luv = abs(luv) - 0.45;
        
        luv *= rot(1.*pi*smoothstep(0.,1.,mod(iTime + float(uv.x>0.) - float(uv.y<0.),4.)));
        float d = length(luv) - 0.02;
        luv = abs(luv);
        luv *= rot(-(1.)*pi);
        d = max(d,-sdBox(luv,vec2(0.005,0.05)));
        
        col = mix(col,vec3(0),smoothstep(pxSz,0.,d));
    }
    // colorline
    {
        vec2 luv = uv;
        float d = sdBox(luv - vec2(0.62,0.),vec2(0.075,0.5));
        vec3 c = pal(vec3(1.,0.2,0.5),0.5,vec3(3,2,1),1.,floor(luv.y*15.) + iTime);
        c = pow(abs(c),vec3(0.1,0.2,1));
        col = mix(col,c,smoothstep(pxSz,0.,d));
    }
    // dark stuff
    col = mix(col,col*0.,smoothstep(pxSz,0.,abs(uv.x - 0.5) - 0.05));
    col = mix(col,vec3(0),smoothstep(pxSz,0.,abs(uv.y + 0.5) - 0.05));
    col = mix(col,vec3(0),smoothstep(pxSz,0.,-((uv.x) - 0.7) - 0.02));
    col = mix(col,vec3(0),smoothstep(pxSz,0.,((uv.x) + 0.72) - 0.02));
    
    // sticker
    /*
    {
        vec2 luv = uv;
        luv -= vec2(-0.58,-0.37);
        luv *= rot(0.1);
        float boxw = 0.2;
        float db = sdBox(luv,vec2(boxw,0.1));
        //vec3 c = pal(vec3(0.9,1,0.5),0.5,vec3(3,2,1),1.,floor(luv.y*15.) + iTime);
        //c = pow(abs(c),vec3(0.2,5,1));
        for(float i = 0.; i < 3.; i++){
        
            float w = 0.07;
            vec2 lluv = (luv + vec2(boxw*0.25,0))*0.6;
            lluv -= vec2(boxw*i/7.*1.,0.);
            //luv *= rot(0.25*i + iTime);
            
            lluv.y *= 2.;
            
            float d = length(lluv ) - w;
            d = max(d,-length(abs(lluv) - w) + w);
            db = max(db,-d);

        }
        col = mix(col,vec3(0.1,0.9,0.4),smoothstep(fwidth(db),0.,db));
        
        
    }
    */
    // boxes
    {
        vec2 luv = uv;
        luv -= vec2(-0.6,0.5);
        float d = sdBox(luv,vec2(0.06,0.02));
        //vec3 c = pal(vec3(0.9,1,0.5),0.5,vec3(3,2,1),1.,floor(luv.y*15.) + iTime);
        //c = pow(abs(c),vec3(0.2,5,1));
        col = mix(col,vec3(0.9,0.1,0.2)*0.,smoothstep(pxSz,0.,d));
        
        luv = uv;
        luv -= vec2(0.4,0.29);
        d = sdBox(luv,vec2(0.1,0.02));
        //vec3 c = pal(vec3(0.9,1,0.5),0.5,vec3(3,2,1),1.,floor(luv.y*15.) + iTime);
        //c = pow(abs(c),vec3(0.2,5,1));
        col = mix(col,vec3(0.9,0.1,0.2)*0.,smoothstep(pxSz,0.,d));
        
        
    }
    
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 col = vec3(0);
    float aaSteps = 1.;
    float pxSz = fwidth(fragCoord.y);
    for(float i = 0.; i < aaSteps*aaSteps; i++){
        vec2 coord = fragCoord 
            + (vec2(
                mod(i,aaSteps),
                floor(aaSteps)
            )/aaSteps*2. - 1.)*pxSz/2.;
        col += get(coord);
    }
    col /= aaSteps*aaSteps;
    
    
    fragColor = vec4(col,1.0);
}`;

const fragment = `
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
    float chrabamt = 0.;
    vec3 c = vec3(
        texture(iChannel0,coord+ chrabamt*vec2(0.00,0.001)).x,
        texture(iChannel0,coord + chrabamt*vec2(0.001,0.00)).y,
        texture(iChannel0,coord + chrabamt*vec2(-0.001,0.00)).z
        );
    return c;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0);
    
    //fragCoord += 250.*noise(vec3(uv*2.5,5.))/iResolution.xy;
    col = get(fragCoord,uv);
    
    float no = noise(vec3(uv*2.,35.));
    //col = mix(col,vec3(0),smoothstep(0.,0.5,max(noise(vec3(uv*2.2 + 0.1,35.)) - 0.5,0.))*0.4);
    
    col = mix(col,vec3(1),smoothstep(0.,5.,max(no - 0.5,0.))*.05);
    
    //col += min(no - 0.5,0.)*0.02;
    
    float n1d = texelFetch(iChannel2,ivec2(mod(fragCoord + vec2(float(iFrame)*0.,0.),256.)),0).x*0.5;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(fragCoord + n1d*200. ,256.)),0).xyz*0.6;
    
    
    //C = smoothstep(0.,1.,C);z
    
    //col.xyz = pow(max(col.xyz,0.), vec3(0.55) + n*0.1);
    
    
    
    col = pow(clamp(col,0.,1.),vec3(0.4545));

    col.xyz += smoothstep(1.,0.,length(col))*n*0.2;
    
    col.xyz -= smoothstep(0.,1.,length(col))*n*0.1;
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'sdySWh';
    }
    name(): string {
        return 'Day 669';
    }
    sort() {
        return 754;
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
        ];
    }
}
