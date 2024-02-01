import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define R iResolution.xy
#define T(u) texture(iChannel0,(u)/R)
`;

const buffA = `
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pal(a,b,c,d,e) (a+(b)*sin((c)*(d) +e))
void mainImage( out vec4 fragColor, in vec2 U )
{
    vec2 oU = U;
    vec2 uv = (U - 0.5*iResolution.xy)/iResolution.y;
    float T = iTime*0.5;
    U.x += sin(T + sin(T))*0.4;
    
    float du = 0.1;
    float stSz = R.y*0.004*(1. + sin(iTime + dot(uv,uv)*10.));
    int idx = iFrame / 1144 % 3;
    vec2 dF = vec2( 
        T(U+vec2(1,0)*stSz)[idx]-T(U-vec2(1,0)*stSz)[idx],
        T(U+vec2(0,1)*stSz)[idx]-T(U-vec2(0,1)*stSz)[idx]
    );
    float stSzB = stSz;
    vec4 n = T(U+vec2(0,1)*stSzB), e = T(U+vec2(1,0)*stSzB), s = T(U-vec2(0,1)*stSzB), w = T(U-vec2(1,0)*stSzB), m = 0.25*(n+e+s+w); 
    
    float div = 0.25*(n.y-s.y+e.x-w.x);
    
    
    vec3 prevFr = T(U + dF*stSz*2.*(.2 + sin(iTime)*0.05 + dot(dF,dF) )).xyz;

    vec3 col = mix(vec3(0.96,0.9,0.8 - dot(uv,uv)*0.1 ), prevFr,0.99 + sin(iTime*4.)*0.009);
    
    float ddf =  dot(dF,dF)*1.;
    float cenv = max(sin(iTime*0.6),0.);
    cenv = smoothstep(0.,1.,cenv);
    for(float i = 0.; i < 130.; i++){
        vec2 p = uv + vec2(sin(i)*0.25*cenv,0);
        p *= rot(i*10. + (iTime +sin(iTime + i*2.1)*1.)*0.4*sin(i));
        //p.y += sin(i*240.)*5.;
        
        p = vec2(length(p),atan(p.xy));
        
        float env = mod(sin(i)*10.2 + iTime*0.1,1.)*1. + sin(iTime)*0.15;
        p.x -= env;
        
        float d = length(p )
            - 0.02*smoothstep(0.,0.6,env)
            + 0.04*smoothstep(0.1,-0.04,env)
            + 0.04*smoothstep(0.,0.3,env);
        vec3 c = pal(vec3(1.,1.,0.4),vec3(0.4,0.8,0.9),vec3(3,2,1),1.,i*3. + iTime + p.x*3. - ddf + p.x*47. + 0.*smoothstep(0.03,0.1,d));
        //col = mix(col,c -col*vec3(0.4,1.,1.),smoothstep(fwidth(d),0.,d));
        col = mix(col,c -col*vec3(0.4,1.,1.),smoothstep(0.04 + sin(iTime*0.7 + sin(i))*0.02,0.,d ));
        
    }

    if(iFrame < 2)
        col -= col - 1.;
    
      
    fragColor = vec4(col,1.0);
}
`;

const fragment = `

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 col = texture(iChannel0,fragCoord/iResolution.xy).rgb;
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    float md = 3.;
    float stSz = R.y*0.01*(1.);
    int idx = iFrame / 1144 % 3;
    vec2 U = fragCoord;
    vec2 dF = vec2( 
        T(U+vec2(1,0)*stSz)[idx]-T(U-vec2(1,0)*stSz)[idx],
        T(U+vec2(0,1)*stSz)[idx]-T(U-vec2(0,1)*stSz)[idx]
    );
    col = mix(smoothstep(0.,1.,1.-col),col,1.-float(iMouse.z>0.));
    col = pow(max(col,0.),vec3(0.4545 ));
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'slXGWn';
    }
    name(): string {
        return 'Day 522';
    }
    // sort() {
    //     return 0;
    // }
    tags?(): string[] {
        return [];
    }
    main(): HTMLCanvasElement {
        return createCanvas();
    }
    userFragment(): string {
        return buffA;
    }
    fragmentPrecision?(): string {
        return PRECISION_MEDIUMP;
    }
    common() {
        return common;
    }
    webgl() {
        return WEBGL_2;
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {};
    }
    channels() {
        return [{ type: 1, f: buffA, fi: 0 }];
    }
}
