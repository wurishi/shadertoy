import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// wonky parametric 3d surface, projected perspectively to 2d
// rendered with 2d line sdf 

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pi acos(-1.)
#define pmod(p,a) mod(p,a) - 0.5*a

// from iq
float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

vec3 transformPt(vec3 p){
    p.xz *= rot(0. + sin(iTime*0.2)*0.4);
    p.xy *= rot(0. + sin(iTime*0.6)*0.4 + 2. + iTime*0.2);
    p.z += 1.5 + sin(iTime + sin(iTime))*0.5;
    
    p.xy /= p.z*3.;
    
    return p;
}

const float itersi = 40.;
const float itersj = 40.;

const float mul = pi*1.;
const vec2 stepSz = 1./vec2(itersi,itersj)*mul;

vec3 getP(vec2 idx){
    //idx.x += iTime*3.4;
    //idx.y += iTime*0.001;
    idx.y += idx.x*stepSz.x*(74. + sin(iTime*0.5)*50.) + iTime*2.;
    vec3 p = vec3(sin(idx.x*sin(idx.y*0.5)) + cos(idx.y )*0.5,cos(idx.y)*1. + cos(idx.x*1. )*1.,sin(idx.y));            
    return p;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(1.,1.1,1.);
    float minZ = 10e4;
    for(float i = 0.; i < itersi; i++){
        for(float j = 0.; j < itersi; j++){
            vec2 idx = vec2(i/itersi,j/itersj)*mul;
            vec3 p = getP(idx);
            vec3 pNi = getP(idx + vec2(1,0.)*stepSz);
            //vec3 pNj = getP(idx + vec2(0,1.)*stepSz);
            
            //points[int(j + i*itersj)] = p;
            vec3 op = p;
            p = transformPt(p);
            pNi = transformPt(pNi);
            //pNj = transformPt(pNj);
            //vec3 n = cross(pNi - p,pNj - p);
            
            float li = sdSegment( uv, p.xy, pNi.xy );
            //float lj = sdSegment( uv, p.xy, pNj.xy );

            //float d = dot(p.xy - uv.xy,p.xy - uv.xy);
            float d = 10e5;
            d = min(d,li);
            //d = min(d,lj);
            //bool normalCond = n.z > -0.000;
            bool normalCond = true;
            
            
            float dfac = smoothstep(fwidth(uv.y),0.,d - 0.00);
            if(p.z > 0.)
            col = mix(col,vec3(0),dfac*1.*smoothstep(0.2,1.,abs(op.z)));
            //if (d < fwidth(uv.y)*0.5 && normalCond)col -= 1.;
            
            if(p.z < minZ && dfac > 0.1)
                minZ = p.z;
                //minZ = mix(minZ,p.z,dfac);
            
        
        }
    }
                    
    {
        float iters = 7.;
        for(float i = 0.; i < iters; i++){
            for(float j = 0.; j < iters; j++){
                for(float k = 0.; k < iters; k++){
                    vec3 p = vec3(i/iters - 0.5 + sin(i + cos(k*20. +iTime)+ iTime)*0.0,k/iters - 0.5,j/iters - 0.5)*4.;
                    vec3 op = p;
                    p = transformPt(p);
                    
                    vec2 np = p.xy - uv.xy;
                    np.xy *= rot(0.25*pi);
                    np *= rot((p.x*2. + sin(p.z+iTime*1.) + iTime));
                    //float d = length(p.xy - uv.xy) - 0.00;
                    float d = max(min(abs(np.x),abs(np.y)) - 0.0004,length(np) - 0.01*sin(k/iters +cos(i/iters*6.)+ iTime));
                    //if (d < fwidth(uv.y)*0.5 && normalCond)col -= 1.;
                    if(
                        (p.z > 0. && !(minZ < 10e4 && p.z > minZ )))
                        col = mix(col,vec3(1.+ sin(p.x*4. + iTime*3.)*0.,0.,0.4 ) - col*1.,smoothstep(fwidth(uv.y),0.,d - 0.00));

                }
            }
        }
    }
    vec2 ouv = uv;
    float md = 0.025;
    vec3 p = vec3(uv*1.,0);
    //p = transformPt(p);
            
    p = pmod(p,md);
    float d = min(abs(p.x),abs(p.y));
    //d = max(d,-length(p.xy) + md*0.5);
    //d = min(d,-abs(uv.x + uv.y) );
    d -= 0.02*md;
    float pxSz = fwidth(uv.y);
    col = mix(col,vec3(0.,0.7,0.1) - col*1.,smoothstep(pxSz,0.,d - 0.00)*smoothstep(md*0.02,0.,d)*0.2);
    
    if(mod(iTime,3.) < 0.5 && fract(iTime/0.01) < 0.5){
        col = vec3(1,1.,0.7) - col;
    }
    
    
    col = pow(col,vec3(0.4545));

    fragColor = vec4(col,1.0);
} 

`;

export default class implements iSub {
    key(): string {
        return '7tBGDd';
    }
    name(): string {
        return 'Day 558';
    }
    sort() {
        return 755;
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
    webgl() {
        return WEBGL_2;
    }
    fragmentPrecision?(): string {
        return PRECISION_MEDIUMP;
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {};
    }
}
