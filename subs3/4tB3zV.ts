import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define SPARKS

#ifdef SPARKS
	#define PALETTE vec3(0.0,.2,1.5)
#else
	#define PALETTE vec3(1.2,0.,.0)
#endif


#define HIGH_QUALITY

#ifdef HIGH_QUALITY
#define STEPS 90
#define ALPHA_WEIGHT 0.022
#define BASE_STEP 0.055
#else
#define STEPS 45
#define ALPHA_WEIGHT 0.044
#define BASE_STEP 0.11
#endif

#define time iTime
vec2 mo;
vec2 rot(in vec2 p, in float a){float c = cos(a), s = sin(a);return p*mat2(c,s,-s,c);}
float hash21(in vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
float noise(in vec3 p)
{
	vec3 ip = floor(p), fp = fract(p);
    fp = fp*fp*(3.0 - 2.0*fp); //Cubic smoothing
	vec2 tap = (ip.xy+vec2(37.0,17.0)*ip.z) + fp.xy;
	vec2 rz = textureLod( iChannel0, (tap + 0.5)/256.0, 0.0 ).yx;
	return mix(rz.x, rz.y, fp.z);
}

float fbm(in vec3 p)
{
    p *= 2.5 + mo.y*2.;
    float rz = 0., z = 1.;
    for(int i=0;i<4;i++)
    {
        float n = noise(p + time*.5);
        rz += (sin(n*4.3)*1.-.45)*z;
        z *= .47;
        p *= 3.;
    }
    return rz;
}

float dsph(in vec3 p)
{
    float r = dot(p,p);
    vec2 sph = vec2(acos(p.y/r), atan(p.x, p.z));
    r += sin(sph.y*2.+sin(sph.x*2.)*5.)*0.8;
    return r;
}

vec4 map(in vec3 p)
{
    float dtp = dsph(p); //Inversion basis is a deformed sphere
	p = .7*p/(dtp + .1);
    p.xz = rot(p.xz, p.y*2.);
    #ifdef SPARKS
    p = 6.*p/(dtp - 6.);
    p = 7.5*p/(dtp + 7.);
    float r = clamp(fbm(p)*1.5-exp2(dtp*0.7-2.73), 0., 1.);
    vec4 col = vec4(1.)*r*r;
    #else
    p = 6.*p/(dtp - 5.4);
    p = 7.*p/(dtp + 6.);
    float r = clamp(fbm(p)*1.5-exp2(dtp*0.7-2.75), 0., 1.);
    vec4 col = vec4(1.)*r;
    #endif
    vec3 lv = mix(p,vec3(.25),1.25);
    float grd =  clamp((col.w - fbm(p+lv*.045))*4.5, 0.01, 2. );
    col.rgb *= grd*vec3(.9, 1., .43) + vec3(.05,0.1,0.0);
    col.a *= clamp(dtp*0.5-.14,0.,1.)*0.7 + 0.3;
    
    return col;
}

vec4 vmarch(in vec3 ro, in vec3 rd)
{
	vec4 rz = vec4(0);
	float t = 2.4;
    t += 0.03*hash21(gl_FragCoord.xy);
	for(int i=0; i<STEPS; i++)
	{
		if(rz.a > 0.99 || t > 6.)break;

		vec3 pos = ro + t*rd;
        vec4 col = map(pos);
        float den = col.a;
        col.a *= ALPHA_WEIGHT;
		col.rgb *= col.a*1.4;
		rz = rz + col*(1. - rz.a);   
        t += BASE_STEP-den*BASE_STEP;
	}
    
    rz.rgb += PALETTE*rz.w;
    return rz;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
	vec2 p = fragCoord.xy/iResolution.xy*2. - 1.;
	p.x *= iResolution.x/iResolution.y*0.95;
	mo = 2.0*iMouse.xy/iResolution.xy;
    mo = (mo==vec2(.0))?mo=vec2(0.5,2.):mo;
    mo.x += time*0.01;
	
	vec3 ro = 4.0*normalize(vec3(cos(2.75-3.0*mo.x), sin(time*0.22)*0.2, sin(2.75-3.0*mo.x)));
	vec3 eye = normalize(vec3(0) - ro);
	vec3 rgt = normalize(cross(vec3(0,1,0), eye));
	vec3 up = cross(eye,rgt);
	vec3 rd = normalize(p.x*rgt + p.y*up + 2.3*eye);
	
	vec4 col = vmarch(ro, rd);
    fragColor = vec4(col.rgb, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '4tB3zV';
  }
  name(): string {
    return 'Promethean';
  }
  sort() {
    return 306;
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
    return [webglUtils.DEFAULT_NOISE];
  }
}
