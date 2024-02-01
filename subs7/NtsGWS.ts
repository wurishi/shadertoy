import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `float sdBox(vec2 p,vec2 s){ p =abs(p) -s; return max(p.y,p.x);}`;

const buffA = `
#define pmod(p,a) mod(p,a) - 0.5*a
#define pi acos(-1.)
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define T (iTime + sin(iTime*2.)*0.4)*0.6

float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0.003);
    
    
    {
        vec3 ro = vec3(0,0,2);
        vec3 rd = normalize(vec3(uv,1));
        float iters = 16.;
        for(float i = 0.; i < iters; i++){
            float env = mod((T*0.25 + i/iters),1.);
            float pl = plaIntersect( ro - vec3(0,0,1. + env*2.),  rd, vec4(0,0,-1,0) );
            vec2 p = (ro + rd*pl).xy;
            float md = 0.1;
            p.x += sin(i/iters*4. + T)*0.05;
            vec2 id = floor(p/md);
            p = pmod(p,md);

            float d = length(p);

            float att = smoothstep(0.,0.01,env) * smoothstep(1.,0.2,env) ;
            //att = 1.;
            //col = mix(col,vec3(0.1,1.,0.6),smoothstep(fwidth(d) - 0.003,0.,d - env*0.0)*att);
            d -= 0.003;
            float pmp = (0.5 + 0.5*sin(iTime + i/iters*0.5));
            vec3 c = vec3(1. + pmp ,1. + 2.*pmp,0.6+ sin(id.x + cos(id.y*20.)*4.)*0.3);
            
            c *= max(sin(T*2. - i/iters*2.),0.);
            col = mix(col,c,smoothstep(fwidth(pl) + 0.002,0.,d - env*0.0*att)*att);

        }
        
    }


    {
        vec2 p = uv;
        p = vec2(atan(p.y,p.x)/pi*2.,length(p));
        float lpy = log(p.y);
        p.y = lpy + T*1.;
        
        
        vec2 op = p;
        //float md = 0.4;
        vec2 md = vec2(1./2.,0.8);
        vec2 id = floor(p/md);
        
        p = uv;
        p *= rot(sin(id.y + T + sin(T + id.y) + iTime*0.5)*1.9);
        p = vec2(atan(p.y,p.x)/pi*2.,length(p));
        
        p.y = log(p.y) + T*1.;
        id = floor((p-vec2(md.x*0.25,0.))/md);
        
        p.y += sin(id.x + iTime + sin(id.x + iTime))*0.2*max(sin(id.y),0.);
        
        
        //p *= rot(sin(id.y + iTime)*0.01);
        p = pmod(p,md);
        
        float d = abs(p.y);
        d = min(d,abs(p.y));
        //p = abs(p) + 0.01;
        d = max(d,-length(p) + length(md.x)*0.1);
        
        col = mix(col, vec3(12.6,3. + sin(id.y)*0.,0.1),smoothstep(fwidth(op.y)*1.5,0.,d)*smoothstep(0.,0.02,dot(uv,uv)));
        
    }
    {
        
        float d = 10e4;
        //uv -= vec2(0.5,0.2);
        float sc = 4.;
        #define xor(a,b) min(max(a ,-(b) + 0.2),max(b,-(a)))
        
        float enva = iTime + sin(iTime);
        for(float i = 0.; i < 8.; i++){
            float env = iTime + sin(iTime + i*.3) + i*0.1;
            vec2 p = uv * rot(env*2.)*sc;
            float ld = sdBox(p,vec2(-0.4 + sin(env)*1. + sin(i + iTime)*0.5 ));
            ld = abs(ld);
            ld = max(ld,-abs(p.x) + 0.2);
            ld = max(ld,-abs(p.y) + 0.2);
            d = xor(d,ld);
        }
        //d -= 0.01;
        col = mix(col,2.*vec3(4.,(0.5 + 0.5*sin(iTime*4.)),.5)*pow(abs(sin(enva)),0.2),smoothstep(fwidth(uv.y) + 0.01,0.,d/sc));
    }

    {
        
        float d = 10e4;
        float t = iTime*4.;
        float envc = max(sin(t + sin(t)),0.);
        envc *= pow(envc,2.);
        for(float i = 0.; i < 17.; i++){
            float env = iTime + sin(iTime + i*2.3)*1.6 + i*.5;
            vec2 p = uv * rot(env);
            float ld = sdBox(uv,vec2(1.6 + sin(iTime)*0.,0.4 ));
            ld = max(ld,-abs(p.x) + 0.2 + sin(env)*0.1);
            ld = max(ld,-abs(p.y) + 0.2 + sin(env)*0.1);
            //ld = abs(ld) - 0.4;
            
            d = xor(d,ld);
        }
        

        col = mix(col,4.5-col*1.,smoothstep(fwidth(uv.y) + 0.01,0.,d)*envc);
    }
    vec3 oc = col.zyx;
    //oc = vec3(1.,1.,1.)*2. - oc*vec3(1.,1.,1.)*4.4;
    oc = vec3(1.,1.,1.)*2. - length(oc)*vec3(1.,1.,1.)*4.4;
    
    col = mix(col,oc,smoothstep(-0.7,-0.8,sin(iTime*1. + sin(iTime)*1.)));

    col = abs(col);
    fragColor = vec4(col,1.0);
}`;

const fragment = `

// vhs filter forked from an old shader of mine
// THE BLOOM ON LINE 145 is from FMS_Cat !! 


#define R (iResolution.xy)
#define T(U) texture(iChannel0,(U)/R)
#define Tn(U,mip) texture(iChannel0,(U),mip)

vec4 noise(float t){return texture(iChannel0,vec2(floor(t), floor(t))/256.);}
vec4 valueNoise(vec2 t, float w){
    vec2 fr = fract(t);
	return 
        mix(
            mix( 
                texture(iChannel1,vec2(floor(t.x), floor(t.y))/256.),
                texture(iChannel1,vec2(floor(t.x), floor(t.y) + 1.)/256.),
            	smoothstep(0.,1.,fr.y)
            ),
            mix( 
                texture(iChannel1,vec2(floor(t.x) + 1.,floor(t.y))/256.),
                texture(iChannel1,vec2(floor(t.x) + 1.,floor(t.y) + 1.)/256.),
            	smoothstep(0.,1.,fr.y)
            ),
            smoothstep(0.,1.,pow(fr.x, w)));
}
vec4 fbm(vec2 uv){
	vec4 n = vec4(0);
    n += valueNoise(uv*800.,0.1);
    n += valueNoise(uv*1700.,0.1)*0.5;
    n -= valueNoise(uv*10.,1.)*1.;
    n -= valueNoise(uv*20.,0.5)*0.5;
    //n = max(n, 0.);
    
    n = smoothstep(0.,1.,n);
    return n;
}



float eass(float p, float g) {
    float s = p*0.45;
    for(float i = 0.; i < g; i++){
    	s = smoothstep(0.,1.,s);
    }
    return s;
}


void mainImage( out vec4 C, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    
    vec2 nuv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    vec2 muv = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;
    
    vec2 offs = vec2(cos(iTime*0.5),sin(iTime*0.9))*0.04;
    offs += vec2(muv)*0.1;
    
    uv += offs;
    nuv += offs;
    vec2 bentuv = nuv * (1. - smoothstep(1.,0.,dot(nuv,nuv)*0.2)*0.4);
    
    bentuv *= 1.7;
    
    
    float df = dFdx(uv.x);
    float amt = (dot(nuv,nuv) + 0.1)*2.*(1.04-eass((iTime)/3.,3.));
    
    float env = eass(iTime*1.,3.);
    float envb = eass((iTime - 2.)*0.4,2.);
    float envc = eass((iTime - 4.)*1.,2.);
    float envd = eass((iTime - 9.)*1.,2.);
    
    
    vec4 nA = fbm(uv*0.02 + iTime*(20.));
    vec4 nB = fbm(vec2(1. + iTime*0.3 + sin(iTime)*0.1,uv.y*0.42));
    vec4 nC = valueNoise(vec2( iTime,uv.y),0.5);
    vec4 nD = valueNoise(vec2( iTime*50.,uv.y),0.5);
    vec4 nE = fbm(vec2(uv.x*0.02,iTime));
    vec4 nF = fbm(vec2(uv.x*1.0,mod(iTime*200.,2000.)));
    vec4 nG = fbm(vec2(uv.x,uv.y + mod(iTime,2000.)));
    vec4 nT = valueNoise(vec2( iTime),0.5);
    
    float glitch = 0.;
    glitch += pow(nB.x,0.5)*0.005 + nB.y*0.005;
    glitch *= 1.;
    uv.x += glitch*0.1;
    
    
    //+ float ( 0. == floor(fract(uv.y*iResolution.y/8.)*2.) ) 
    
    float slidey = smoothstep(0.01,0.,abs(uv.y - nC.x*1.4) - 0.1 + nE.x*0.06);
    
    
    slidey *= smoothstep(0.,df*(224.2 ),abs(nuv.x + R.x/R.y*0.5 - 0.01) - 0.004);
    
    
    glitch += slidey*0.002;
    uv.x += slidey*(pow(nC.y,0.01)*0.004 + 0.001);
    
    
    uv.x += 0.1*pow(nB.x,2.)*smoothstep(df*(4.2 ),0.,(abs(nuv.x + R.x/R.y*0.5 - 0.01) - 0.004 )*0.2);
    
    uv.x += pow(nB.x,2.)*0.007;
    
    C += smoothstep(df*(1. + nE.y*2.2),0.,abs(uv.y  + nC.x*.02 + 0.1 - 2.*nD.y*float(nC.z>0.4)) + nE.x*0.04 - (nE.y*0.01))*(0.5*nE.y );
    
    
    
    if(nA.x*nA.z > 0.1 - 0.0009*sin(iTime) ){
        glitch += 0.01;
        uv += 0.02;
    }
    if(nB.x*nB.y > 0.1 - envc*0.10001){
        
        //glitch += envc*0.;
        //uv += 0.1 + iTime;
    }
    
    
    
    
    
    float mip = 0.5 + nG.x*5.;
    
    float iters = 130.;
    
    vec3 chrab = vec3(0);
    vec2 chruv = uv;
    vec2 dir = vec2(1.,0.);
    amt *= 1.;
    amt += glitch*104.4;
    for(float i = 0.; i < iters; i++){
        //uv.x += 0.01;
        float slider = i/iters;
        chrab.r += Tn(uv + amt*dir*0.004*slider,mip).r;
        chrab.g += Tn(uv + -amt*dir*0.01*slider,mip).g;
        chrab.b += Tn(uv + amt*dir*0.01*slider,mip).b;
    }
    
    chrab /= iters;
    vec3 bloom = vec3(0);
      for( float x = -1.0; x < 2.5; x += 1.0 ){
        bloom += vec3(
          Tn( uv + vec2( x - 0.0, 0.0 ) * 7E-3, mip).x,
          Tn( uv + vec2( x - 1.0 + sin(iTime), 0.0 ) * 7E-3,mip ).y,
          Tn( uv + vec2( x - 4.0 - sin(iTime*4.), 0.0 ) * 7E-3, mip ).z
        );
      }
    bloom/=iters;
    
    C.rgb += mix(chrab,bloom,0.5);
    
    
    C = mix(C,vec4(1),(smoothstep(0.5,0.41,pow(nT.x,0.9)) + 0.02)*pow(smoothstep(0.6,0.,valueNoise( uv*190. + vec2(0,nA.x*30. + pow(nB.y, 0.01)*70.*nT.y) + mod(iTime*2000.,20000.),1. + 3.*nC.x).x),18. - nT.w*uv.y*17.));
    
    C.rgb = mix(vec3(1),C.rgb,1.);
    
    vec2 bentuvold = bentuv;
    
    float dfbentuv = dFdx(bentuv.x);
    
    bentuv = abs(bentuv);
    float dedges = abs(bentuv.x) - 0.9;
    dedges = max(dedges, bentuv.y - 0.5);
    float edger = 0.1;
    //dedges = max(dedges,-length(bentuv- vec2(R.x/R.y,R.y/R.y)*0.5 + edger) - edger);
    
   // C *= smoothstep(dfbentuv*4.,0.,);
    C *= pow(smoothstep(0.1,0., bentuv.x - R.x/R.y*0.47),1.);
    C *= pow(smoothstep(0.1,0., bentuv.y - R.y/R.y*0.4),1.);
    
    
    C = mix(C, Tn(uv + 0.2,2.)*0.04,1.-smoothstep(dfbentuv*4.,0.,dedges));
    
    C *= smoothstep(1.,0.2, 0.3 + 0.2*uv.y*(0.7 + nD.x));
    C *= pow(smoothstep(1.,0., dot(nuv*0.6,nuv)),1.);
    
    bentuvold -= vec2(0.3,0.1);
    
    C += pow(smoothstep(1.,0., length(bentuvold) - 0.),4.)*0.01*vec4(0.6,0.9,0.9,0.);
    
    C.xyz *= vec3(1,1,0.9);
    
    C = pow(max(C,0.),vec4(0.4545));

    C.a = 1.;
}

`;

export default class implements iSub {
    key(): string {
        return 'NtsGWS';
    }
    name(): string {
        return 'Day 532';
    }
    common() {
        return common;
    }
    webgl() {
        return WEBGL_2;
    }
    sort() {
        return 758;
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
            { type: 1, f: buffA, fi: 0 },
            { ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS },
        ];
    }
}
