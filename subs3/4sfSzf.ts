import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define PROCEDURAL_TEXTURE

#define time iTime*0.4


vec3 intcPlane(vec3 rd, vec3 cn) {
            float t = cn.y/rd.y;
            if (t < 0.) return vec3(1e6);
            return vec3(t, cn.x + rd.x*t, cn.z + rd.z*t);
        }

vec3 texFiltered(in vec3 res, in float typ)
{
	//the base LOD to use, lower is better, but values under -2 would need a bigger
	//kernel (3+3 should work fine)
	const float baseLOD = -1.8;
	res.y += time*1.;
	//Scale of the texture
	const float scale = 1.;
	//This defines the width of the blur kernel 0.5 to 1. seems to work fine.
	const float wd = .75/scale;
	
	vec3 t0 = texture(iChannel0,vec2(res.y/scale,res.z/scale),baseLOD).rgb;
	
	float w = fwidth(res.y)*wd;
	float d1 = res.y/scale - (w/2.0);
    float d2 = d1 + w;
	vec3 t1 = texture(iChannel0,vec2(d1,res.z/scale),baseLOD).rgb;
	vec3 t2 = texture(iChannel0,vec2(d2,res.z/scale),baseLOD).rgb;
	vec3 col = (t1+t2)*0.5;
	
	w = fwidth(res.z)*wd;
	d1 = res.z/scale - (w/2.0);
    d2 = d1 + w;
	t1 = texture(iChannel0,vec2(res.y/scale,d1),baseLOD).rgb;
	t2 = texture(iChannel0,vec2(res.y/scale,d2),baseLOD).rgb;
	vec3 col2 = (t1+t2)*0.5;
	col = mix(col,col2,.5);
	
	return mix(t0,col,typ);
}

float hex(vec2 p, float thick) 
{		
	p*=1.5;
	p.y += floor(p.x)*0.5;
	p = abs(fract(p)-0.5);
	return abs(max(p.x*1.5 + p.y, p.y*2.) - 1.)*thick;
}

vec3 shadeHex (in vec3 res, in float typ)
{
	const float hexthick = 10.;
	res.y += time*2.;
	const float scale = .5;
	const float wd = 1./scale;
	
	float w = fwidth(res.y)*wd;
	float d1 = res.y/scale - (w/2.0);
    float d2 = d1 + w;
	float t1 = hex(vec2(d1,res.z/scale),hexthick);
	float t2 = hex(vec2(d2,res.z/scale),hexthick);
	float rz = (t1+t2)*0.5;

	
	w = fwidth(res.z)*wd;
	d1 = res.z/scale - (w/2.0);
    d2 = d1 + w;
	t1 = hex(vec2(res.y/scale,d1),hexthick);
	t2 = hex(vec2(res.y/scale,d2),hexthick);
	float rz2 = (t1+t2)*0.5;
	rz = mix(rz,rz2,0.5);
	
	vec3 col = clamp(vec3(0.1,0.2,0.5)/rz,0.,1.);
	vec3 col2 = clamp(vec3(0.1,0.2,0.5)/t1,0.,1.);
	
	return mix(col2,col,clamp(typ,0.,1.));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (fragCoord.xy/iResolution.xy-0.5)*2.;
	float asp = iResolution.x/iResolution.y;
	p.x *= asp;
	vec2 mo = (iMouse.xy/iResolution.xy-0.5)*2.;
	mo.x *= asp;

	vec3 ro = 3.0*vec3(cos(0.2*time),0.0,sin(0.2*time));
    vec3 ta = vec3(0.,-1.1,0.);
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.,1.,0.)));
    vec3 vv = normalize( cross(uu,ww));
	vec3 rd = normalize( p.x*uu + p.y*vv + 2.*ww);
	
	#ifdef PROCEDURAL_TEXTURE
	float sp = 0.;
	#else
	float sp = 0.33*asp;
	#endif
	float stp = mo.x;
	stp = (stp<=-1.*asp)?stp=0.:stp;
	float typ = step(p.x,stp-sp);
	typ += step(p.x,stp+sp);
	
	vec3 bg = vec3(0.05,0.05,0.15) + .5*rd.y;
	vec3 col = bg;

    vec3 res = intcPlane(rd, vec3(0,-1.,0));
	if( res.x<100.0 ) 
	{
		vec3 pos = ro + rd*res.x;
		#ifdef PROCEDURAL_TEXTURE
		col = shadeHex(res*(sin(time*0.5)*1.+1.5),typ);
		#else
		res *= (sin(time*0.5)*1.+1.5);
		if (typ < 2.) col = texFiltered(res,typ);
		else col = texture(iChannel0,vec2(res.y+time,res.z)).rgb;
		#endif
		col = mix( col, bg, 1.0-exp(-0.007*res.x*res.x) );
	}
	
	//separators
	col = max(col,vec3(1)*(1.-abs((p.x-stp+sp)*150.)));
	col = max(col,vec3(1)*(1.-abs((p.x-stp-sp)*150.)));

    fragColor = vec4(col, 1.);
}

`;

export default class implements iSub {
  key(): string {
    return '4sfSzf';
  }
  name(): string {
    return 'Derivative based AA';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 342;
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
    return [{ ...webglUtils.ROCK_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
