import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define FDIST 0.7
#define PI 3.1415926


#define GROUNDSPACING 0.5
#define GROUNDGRID 0.05
#define BOXDIMS vec3(0.75, 0.75, 1.)

#define ABSORPTION_RATE vec3(0.7, 0.5, 0.5)
#define IOR 1.33
#define SCATTER_FACTOR 0.02
#define SAMPLES 25
#define REFLECTIONS 4

#define TIME_T 2.
#define TIME_H 2.
#define TIME_L 10.


vec2 rand2d(in vec2 uv) {
    return fract(mat2(-199.258, 457.1819, -1111.1895, 2244.185)*sin(mat2(111.415, -184, -2051, 505)*uv));
}

float box(in vec3 ro, in vec3 rd, in vec3 r, out vec3 nn, bool entering) {
    vec3 dr = 1.0/rd;
    vec3 n = ro * dr;
    vec3 k = r * abs(dr);
    
    vec3 pin = - k - n;
    vec3 pout =  k - n;
    float tin = max(pin.x, max(pin.y, pin.z));
    float tout = min(pout.x, min(pout.y, pout.z));
    if (tin > tout) return -1.;
    if (entering) {
    	nn = -sign(rd) * step(pin.zxy, pin.xyz) * step(pin.yzx, pin.xyz);
    } else {
        nn = sign(rd) * step(pout.xyz, pout.zxy) * step(pout.xyz, pout.yzx);
    }
    return entering ? tin : tout;
}

vec2 sphere(in vec3 ro, in vec3 rd, in float r, out vec3 ni) {
	float pd = dot(ro, rd);
    float disc = pd*pd + r*r - dot(ro, ro);
    if (disc < 0.) return vec2(-1.);
    float tdiff = sqrt(disc);
    float tin = -pd - tdiff;
    float tout = -pd + tdiff;
    ni = normalize(ro + tin * rd);
    
    return vec2(tin, tout);
}

vec3 bgcol(in vec3 rd) {
    return mix(vec3(0., 0., 1.), vec3(0.6, 0.8, 1.), 1.-pow(abs(rd.z), 2.));
}

//raytrace the exterior surroundings
vec3 background(in vec3 ro, in vec3 rd) {
    float t = (-1. - ro.z)/rd.z;
    if (t < 0.) return bgcol(rd);
    vec2 uv = ro.xy+t*rd.xy;
    if (max(abs(uv.x), abs(uv.y)) > 8.) return bgcol(rd);
    vec2 checkers = smoothstep(vec2(GROUNDGRID*0.75), vec2(GROUNDGRID), abs(mod(uv, vec2(GROUNDSPACING))*2.-GROUNDSPACING));
    float aofac = smoothstep(-0.5, 1., length(abs(uv)-min(abs(uv), vec2(0.75))));
    return mix(vec3(0.2), vec3(1.), min(checkers.x,checkers.y)) * aofac;
}

//raytrace the insides
vec3 insides(in vec3 ro, in vec3 rd, in float INNERRAD, in mat2 rot, out float tout) {
    vec3 ni;
    vec2 t = sphere(ro, rd, INNERRAD, ni);
    vec3 ro2 = ro + t.x * rd;
    // shading/texture
    vec2 checkers = step(mod(rot * ro2.xy, vec2(0.25)), vec2(0.01));
    vec3 tex = mix(vec3(1.), vec3(0., 0.7, 0.), abs(checkers.x-checkers.y));
    float fac = -ni.z;
    
    //inner background
    vec3 n;
    float tb = box(ro, rd, vec3(INNERRAD), n, false);
    vec3 rob = ro + tb * rd;
    vec3 checkersb = abs(mod(rob.xyz, vec3(0.5))-0.25)*4.;
    vec3 texb = mix(vec3(0., 0., 1.), vec3(0.), step(0.25, abs(abs(checkersb.x-checkersb.y)-checkersb.z)));
    tout = mix(tb, t.x, step(0., t.x));
    return mix(mix(vec3(0.5), texb, step(0., tb)) * 0.5, tex * fac, step(0., t.x));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float t_osc = 0.5*(TIME_H+TIME_L)+TIME_T;
    float h_l = 0.5*TIME_L/t_osc;
    float h_h = (0.5*TIME_L+TIME_T)/t_osc;
    float osc = smoothstep(0., 1., (clamp(abs(mod(iTime, t_osc*2.)/t_osc-1.), h_l, h_h) - h_l) / (h_h - h_l));
    float INNERRAD = mix(0.5, 1.5, osc);
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.x;
    float mouseY = iMouse.y < 1. ? 0.5 : (1.0-1.15*iMouse.y/iResolution.y) * 0.5 * PI;
    float mouseX = iMouse.x < 1. ? iTime*0.25 : -(iMouse.x/iResolution.x) * 2. * PI;
    vec3 eye = 4.*vec3(cos(mouseX) * cos(mouseY), sin(mouseX) * cos(mouseY), sin(mouseY));
    vec3 w = normalize(-eye);
    vec3 up = vec3(0., 0., 1.);
    vec3 u = normalize(cross(w, up));
    vec3 v = cross(u, w);
    
    vec3 rd = normalize(w * FDIST + uv.x * u + uv.y * v);
    
    vec3 ni;
    float t = box(eye, rd, BOXDIMS, ni, true);
    vec3 ro = eye + t * rd;
    vec2 coords = ro.xy * ni.z + ro.yz * ni.x + ro.zx * ni.y;
    
    if (t > 0.) {
        float ang = -iTime * 0.33;
    	float c = cos(ang);
    	float s = sin(ang);
    	mat2 rot = mat2(c, -s, s, c);
        vec3 col = vec3(0.);
        float R0 = (IOR-1.)/(IOR+1.);
        R0*=R0;
        for (int i=0; i<SAMPLES; i++) {
            
            vec2 theta = rand2d(coords + float(i) * vec2(1., 0.) * vec2(104., -30.6));
            theta *= vec2(2.*PI, SCATTER_FACTOR*PI);
            vec3 n = vec3(cos(theta.x)*sin(theta.y), sin(theta.x)*sin(theta.y), cos(theta.y));
            // reflection
            vec3 nr = n.zxy * ni.x + n.yzx * ni.y + n.xyz * ni.z;
            vec3 rdr = reflect(rd, nr);
            vec3 reflcol = background(ro, rdr);
            
            // refraction & insides
            
            //vec3 rd2 = rd.yzx * ni.x + rd.zxy * ni.y + rd.xyz * ni.z;
            
            vec3 rd2 = refract(rd, nr, 1./IOR);
            
            vec3 insidecol = vec3(0.);
            float accum = 1.;
            vec3 transmission = vec3(1.);
            vec3 no2 = ni;
            vec3 ro_refr = ro;
            
            for (int j=0; j<REFLECTIONS; j++) {
                float tb;
                //no2 = -no2;
                vec2 coords2 = ro_refr.xy * no2.z + ro_refr.yz * no2.x + ro_refr.zx * no2.y;
                vec3 eye2 = vec3(coords2, -max(INNERRAD, 1.));
                vec3 rd2trans = rd2.yzx * no2.x + rd2.zxy * no2.y + rd2.xyz * no2.z;
                rd2trans.z = -rd2trans.z;
                vec3 internalcol = insides(eye2, rd2trans, INNERRAD, rot, tb);
                if (tb > 0.) {
                    //terminate at interior geometry
                    insidecol += accum * internalcol * transmission * pow(ABSORPTION_RATE, vec3(tb));
					break;
                } else {
                    //compute contribution of the light leaked from the environment through this bounce
                    float tout = box(ro_refr, rd2, BOXDIMS, no2, false);
                    no2 = n.zyx * no2.x + n.xzy * no2.y + n.yxz * no2.z;
                    vec3 rout = ro_refr + tout * rd2;
                    vec3 rdout = refract(rd2, -no2, IOR);
                    float fresnel2 = R0 + (1.-R0) * pow(1.-dot(rdout, no2), 5.);
                    rd2 = reflect(rd2, -no2);
                    
                    ro_refr = rout;
                    ro_refr.z = max(ro_refr.z, -0.999);

                    transmission *= pow(ABSORPTION_RATE, vec3(tout));
                    insidecol += accum * (1.-fresnel2) * background(ro_refr, rdout) * transmission;
                    if (fresnel2 < 0.1) break;
                    accum *= fresnel2;
                }
            }
            
            // background
            
            float fresnel = R0 + (1.-R0) * pow(1.-dot(-rd, nr), 5.);
            col += mix(insidecol, reflcol, fresnel);
        }
        col /= float(SAMPLES);

        fragColor = vec4(col, 1.);
    } else {
		fragColor = vec4(background(eye, rd), 1.);
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'tsVXzh';
  }
  name(): string {
    return 'Strange Crystal';
  }
  sort() {
    return 105;
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
