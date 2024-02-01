import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define R iResolution.xy
#define T(u) texture(iChannel0,(u)/R)

///  3 out, 3 in...
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);

}`;

const buffA = `#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
float r11(float g){return fract(sin(g*12.5)*4.5);}
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

#define pmod(p,a) mod(p,a) - 0.5*a
vec3 gp;
vec3 get(vec3 p){
p.xz *=rot(0.25);
    p.x += iTime + sin(iTime);
    vec3 c = vec3(0);
    p*=1.16;
    gp = p;
    float md = 0.2;
    //p.x += iTime + sin(iTime);
    vec3 id = floor(p/md);
    //p.x = pmod(p.x,md);
    c += mod(id.x,2.);
    c = vec3(dot(c,c));
    c = clamp(c*20.,0.06,1.);
    return c;
}
vec3 n;
vec2 intersect(vec3 ro, vec3 rd){
    return boxIntersection(ro,rd,vec3(1),n);

}

void mainImage( out vec4 C, in vec2 U){
    vec2 uvn = U.xy/R;

    C = T(U);
    C -= C;
    vec2 uv = (U - 0.5*R)/R.y;
    
    vec3 ro = vec3(0);
    vec3 rd = normalize(vec3(uv,0.2));
    float t = iTime + sin(iTime + 3.);
    rd.xz *= rot((t)*0.4);
    rd.xy *= rot((t)*0.4);
    vec3 p = ro;
    vec3 att = vec3(1);
    
    for(float bnc = 0.; bnc < 1.; bnc++){
        vec2 box = intersect(p,rd);
        p = p + rd*box.y;
        vec3 c = get(p);
        //C.xyz += c*att;
        att *= c;
        float bncSubCnt = 40.;
        float ratio = 0.2 + 0.9*floor(mod(gp.y*2.,2.));;
        
        p += n*0.001;
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
            vec3 c = get(pp);
            C.xyz += c*att/bncSubCnt;
            //att *= c;
        
            //vec2 
        }
    }
    //C += box.y*0.1;
    
    
    
    
    
    if(iFrame == 0){
        C = vec4(0,0,0,1);
    }
}`;

const fragment = `
// box intersection from IQ

void mainImage( out vec4 C, in vec2 U){
    vec2 uvn = U.xy/R;

    C= T(U);
    C = pow(C,vec4(0.4545));
    C.a = 1.;
}
`;

export default class implements iSub {
    key(): string {
        return '7tjXWd';
    }
    name(): string {
        return 'Day 60smth WIP';
    }
    // sort() {
    //     return 0;
    // }
    common() {
        return common;
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
        return [{ type: 1, f: buffA, fi: 0 }];
    }
}
