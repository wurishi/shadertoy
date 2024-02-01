import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float nmzHash(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float biquadratic_noise(in vec2 p)
{
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    vec2 rfp = 1.0-fp;
    vec3 pwx = vec3(rfp.x*rfp.x, 2.0*fp.x*rfp.x, fp.x*fp.x);
    vec3 pwy = vec3(rfp.y*rfp.y, 2.0*fp.y*rfp.y, fp.y*fp.y);
    
    float x1c = nmzHash(ip + vec2(1,0));
    float x2c = nmzHash(ip + vec2(1,1));
    float x3c = nmzHash(ip + vec2(1,2));
    float x1 = dot((vec3((x1c+nmzHash(ip + vec2(0,0)))*0.5, x1c, (x1c+nmzHash(ip + vec2(2,0)))*0.5)), pwx);
    float x2 = dot((vec3((x2c+nmzHash(ip + vec2(0,1)))*0.5, x2c, (x2c+nmzHash(ip + vec2(2,1)))*0.5)), pwx);
    float x3 = dot((vec3((x3c+nmzHash(ip + vec2(0,2)))*0.5, x3c, (x3c+nmzHash(ip + vec2(2,2)))*0.5)), pwx);
    
    
    return dot((vec3((x1+x2)*0.5,x2,(x3+x2)*0.5)), pwy);
}

vec4 powX(float x) {float x2 = x*x; return vec4(x2*x, x2, x, 1.0); }
vec4 MNParamsA(float B, float C){ return vec4(12. - 9.*B - 6.*C, -18. + 12.*B + 6.*C, 0.0, 6. -2.*B)/6.; }
vec4 MNParamsB(float B, float C){ return vec4(-B -6.*C, 6.*B + 30.*C, -12.*B - 48.*C, 8.*B + 24.*C)/6.; }

float eval(float c0, float c1, float c2, float c3, float x) 
{   
    #if 0
    const float B = 0.7;
    const float C = 0.3;
    /*const float B = .8;
    const float C = 0.25;*/
    #else
    const float B = 1./3.;
    const float C = 1./3.;
    /*const float B = 1.;
    const float C = .0;*/
    #endif
    vec4 pA = MNParamsA(B, C);
    vec4 pB = MNParamsB(B, C);
    
    return c0*dot(pB, powX(x + 1.0)) + c1*dot(pA, powX(x)) +
           c2*dot(pA, powX(1.0 - x)) + c3*dot(pB, powX(2.0 - x));
}

float bicubic_noise(in vec2 p)
{
    vec2 fp = fract(p);
    vec2 ip = floor(p);
    
    float s99 = nmzHash(ip+vec2(-1,-1)), s19 = nmzHash(ip+vec2(1,-1));
    float s00 = nmzHash(ip+vec2(0,0)), s20 = nmzHash(ip+vec2(2,0));
    float s91 = nmzHash(ip+vec2(-1, 1)), s11 = nmzHash(ip+vec2(1, 1));
    float s02 = nmzHash(ip+vec2(0,2)), s22 = nmzHash(ip+vec2(2,2));
    float s09 = nmzHash(ip+vec2(0,-1)), s29 = nmzHash(ip+vec2(2,-1));
    float s90 = nmzHash(ip+vec2(-1,0)), s10 = nmzHash(ip+vec2(1,0));
    float s01 = nmzHash(ip+vec2(0,1)), s21 = nmzHash(ip+vec2(2,1));
    float s92 = nmzHash(ip+vec2(-1,2)), s12 = nmzHash(ip+vec2(1,2));
    
    return eval(eval(s99, s09, s19, s29, fp.x), eval(s90, s00, s10, s20, fp.x),
                eval(s91, s01, s11, s21, fp.x), eval(s92, s02, s12, s22, fp.x), fp.y);
}

float fbmCub(vec2 p)
{
    float rz = 0.;
    float amp = 2.;
    for (int i = 0; i < 6; i++)
    {
		rz += bicubic_noise(p)/amp;
        amp *= 2.;
        p *= 1.99;
    }
    return rz;
}

float fbmQuad(vec2 p)
{
    float rz = 0.;
    float amp = 2.;
    for (int i = 0; i < 6; i++)
    {
		rz += biquadratic_noise(p)/amp;
        amp *= 2.;
        p *= 1.99;
    }
    return rz;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord/iResolution.xy;
    vec2 p = q-0.5;
    p.x *= iResolution.x/iResolution.y;
    
    float rez = 0.;
    p += iTime*vec2(0.04,0.05);
    p *= 40. + sin(iTime*.1)*5.*0.;
    
    if (q.y < 0.5)
    {
    if (q.x < 0.5)
        rez = biquadratic_noise(p);
    else
    	rez = fbmQuad(p*0.45);
    }
    else
    {
        p.y -= 0.5*45.;
    if (q.x < 0.5)
		rez = bicubic_noise(p);
    else
    	rez = fbmCub(p*0.45);
    }
    
    vec3 col = vec3(rez);
    
    col *= smoothstep(0.,0.0035, abs(q.x-0.5));
    col *= smoothstep(0.,0.005, abs(q.y-0.5));
        
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XlVcWV';
  }
  name(): string {
    return 'Bicubic/Biquadratic noise';
  }
  sort() {
    return 363;
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
