import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_flat;
uniform bool u_light;
uniform bool u_default_texture;

#define STEPS 22
#define NOISE_INTENSITY 3.

#define time iTime

//iq's ubiquitous 3d noise
float noise(in vec3 p)
{
	vec3 ip = floor(p);
    vec3 f = fract(p);
	f = f*f*(3.0-2.0*f);
	
	vec2 uv = (ip.xy+vec2(37.0,17.0)*ip.z) + f.xy;
  vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
	return mix(rg.x, rg.y, f.z);
}

mat3 m3 = mat3( 0.00,  0.80,  0.60,
              -0.80,  0.36, -0.48,
              -0.60, -0.48,  0.64 );

float grid(vec3 p)
{
	float s = sin(p.x)*cos(p.y);
	//float s = sin(p.x)*cos(p.y);
	return s;
}

float flow(in vec3 p)
{
	float z=2.;
	float rz = 0.;
	vec3 bp = p;
	for (float i= 1.;i < 5.;i++ )
	{
		//movement
		p += time*0.25;
		bp -= time*.3;
		
		//displacement map
		vec3 gr = vec3(grid(p*3.-time*1.),grid(p*3.5+4.-time*1.),grid(p*4.+4.-time*1.));
		p += gr*0.15;
		rz+= (sin(noise(p)*8.)*0.5+0.5) /z;
		
		//advection factor (.1 = billowing, .9 high advection)
		p = mix(bp,p,.7);
		
		//scale and rotate
		z *= 2.;
		p *= 2.01;
		p*=m3;
		bp *= 1.7;
		bp*=m3;
	}
	return rz;	
}

vec4 map(in vec3 p)
{
  float d;
  if(u_flat) {
    d = -1.1;
  }
  else {
    d = 1.5-dot(p,p);
  }
	vec3 q = p+vec3(1.0,0.,0.)*time*.2;
	float f = flow(q);

	d += NOISE_INTENSITY*f;
	d = clamp(d, 0.0, 1.0);
	
	vec4 res = vec4(d);
	//color
	res.xyz = mix( 3.*vec3(.7,0.95,0.5), vec3(0.4,.5,.5), res.x );
	return res;
}


vec4 raymarch( in vec3 ro, in vec3 rd )
{
	vec4 sum = vec4(0);

	float t = 2.1;
	for(int i=0; i<STEPS; i++)
	{
		if( sum.a > 0.99 ) continue;

		vec3 pos = ro + t*rd;
		vec4 col = map( pos );
		
		//lights
    if(u_light) {
      float dif =  clamp((col.w - map(pos+.2).w)/.5, 0.1, 1. );
      vec3 lin = vec3(0.5,0.2,.5)*1. + .5*vec3(2., 0.8, 1.)*dif;
		  col.xyz *= lin;
    }
		
		col.a *= .2;
		col.rgb *= col.a;
		sum = sum + col*(1. - sum.a);
		//fixed step
		t += 0.06;
	}
	sum.b += sum.w*0.45;
	return clamp(sum, 0.0, 1.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy / iResolution.xy;
	vec2 p = -1.0 + 2.0*q;
	p.x *= iResolution.x/ iResolution.y*0.95;
	vec2 mo = -1.0 + 2.0*iMouse.xy / iResolution.xy;
	mo.x += time*0.025;
	p*= 2.5;
	
	//camera
	vec3 ro = 4.0*normalize(vec3(cos(2.75-3.0*mo.x), -mo.y, sin(2.75-3.0*mo.x)));
	vec3 ta = vec3(0.);
	vec3 ww = normalize(ta - ro);
	vec3 uu = normalize(cross(vec3(0.,1.,0.), ww));
	vec3 vv = normalize(cross(ww,uu));
	vec3 rd = normalize(p.x*uu + p.y*vv + 5.*ww);

	
	vec4 col = raymarch(ro, rd);
	    
  fragColor = vec4(col.rgb, 1.0);
}
`;

let gui: GUI;
const api = {
  u_flat: false,
  u_light: true,
  u_default_texture: true,
};

export default class implements iSub {
  key(): string {
    return 'XdfXRj';
  }
  name(): string {
    return 'Noise animation - 3D';
  }
  sort() {
    return 80;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_flat');
    gui.add(api, 'u_light');
    // gui.add(api, 'u_default_texture');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_flat = webglUtils.getUniformLocation(gl, program, 'u_flat');
    const u_light = webglUtils.getUniformLocation(gl, program, 'u_light');
    const u_default_texture = webglUtils.getUniformLocation(
      gl,
      program,
      'u_default_texture'
    );
    return () => {
      u_flat.uniform1i(api.u_flat ? 1 : 0);
      u_light.uniform1i(api.u_light ? 1 : 0);
      // u_default_texture.uniform1i(api.u_default_texture ? 1 : 0);
    };
  }
  channels() {
    return [{ ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
