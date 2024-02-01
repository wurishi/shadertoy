import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_49;
uniform bool u_50;
uniform bool u_51;
uniform bool u_52;

const float RETICULATION = 3.;  // strenght of dust texture
const float NB_ARMS = 5.;       // number of arms
//const float ARM = 3.;         // contrast in/out arms
const float COMPR = .1;         // compression in arms
const float SPEED = .1;
const float GALAXY_R = 1./2.;
const float BULB_R = 1./4.;
const vec3 GALAXY_COL = vec3(.9,.9,1.); //(1.,.8,.5);
const vec3 BULB_COL   = vec3(1.,.8,.8);
const vec3 SKY_COL    = .5*vec3(.1,.3,.5);
		
#define t iTime

// --- base noise
float tex(vec2 uv) 
{
	float n = texture(iChannel0,uv, 0.).r;
	
#define MODE 3  // kind of noise texture
#if MODE==0         // unsigned
	#define A 2.
	return n;
#elif MODE==1       // signed
	#define A 3.
	return 2.*n-1.;
#elif MODE==2       // bulbs
	#define A 3.
	return abs(2.*n-1.);
#elif MODE==3       // wires
	#define A 1.5
	return 1.-abs(2.*n-1.);
#endif
}


// --- perlin turbulent noise + rotation
float noise(vec2 uv)
{
	float v=0.;
	float a=-SPEED*t,	co=cos(a),si=sin(a); 
	mat2 M = mat2(co,-si,si,co);
	const int L = 7;
	float s=1.;
	for (int i=0; i<L; i++)
	{
		uv = M*uv;
		float b = tex(uv*s);
		v += 1./s* pow(b,RETICULATION); 
		s *= 2.;
	}
	
    return v/2.;
}

// bool keyToggle(int ascii) 
// {
// 	return (texture(iChannel2,vec2((.5+float(ascii))/256.,0.75)).x > 0.);
// }

bool keyToggle(bool u) {
  return u;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy/iResolution.y-vec2(.8,.5);
	vec3 col;
	
	// spiral stretching with distance
	float rho = length(uv); // polar coords
	float ang = atan(uv.y,uv.x);
	float shear = 2.*log(rho); // logarythmic spiral
	float c = cos(shear), s=sin(shear);
	mat2 R = mat2(c,-s,s,c);

	// galaxy profile
	float r; // disk
	r = rho/GALAXY_R; float dens = exp(-r*r);
	r = rho/BULB_R;	  float bulb = exp(-r*r);
	float phase = NB_ARMS*(ang-shear);
	// arms = spirals compression
	ang = ang-COMPR*cos(phase)+SPEED*t;
	uv = rho*vec2(cos(ang),sin(ang));
	// stretched texture must be darken by d(new_ang)/d(ang)
	float spires = 1.+NB_ARMS*COMPR*sin(phase);
	// pires = mix(1.,sin(phase),ARM);
	dens *= .7*spires;	
	
	// gaz texture
	float gaz = noise(.09*1.2*R*uv);
	float gaz_trsp = pow((1.-gaz*dens),2.);

	// stars
	//float a=SPEED*t, co=cos(a),si=sin(a); 
	//mat2 M = mat2(co,-si,si,co);
	// adapt stars size to display resolution
	float ratio = .8*iResolution.y/iChannelResolution[0].y;
	float stars1 = texture(iChannel1,ratio*uv+.5, 0.).r, // M*uv
	      stars2 = texture(iChannel0,ratio*uv+.5, 0.).r,
		  stars = pow(1.-(1.-stars1)*(1.-stars2),5.);
	
	//stars = pow(stars,5.);
	
	// keybord controls (numbers)
	if (keyToggle(u_49)) gaz_trsp = 1./1.7;
	if (keyToggle(u_50)) stars = 0.;
	if (keyToggle(u_51)) bulb = 0.;
	if (keyToggle(u_52)) dens = .3*spires;
	
	// mix all	
	col = mix(SKY_COL,
			  gaz_trsp*(1.7*GALAXY_COL) + 1.2*stars, 
			  dens);
	col = mix(col, 1.2*BULB_COL, bulb);
		
	fragColor = vec4(col,1.);
}
`;

let gui: GUI;
const api = {
  u_49: false,
  u_50: false,
  u_51: false,
  u_52: false,
};

export default class implements iSub {
  key(): string {
    return 'Xsl3zX';
  }
  name(): string {
    return 'galaxy3';
  }
  sort() {
    return 494;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_49').name('禁用gaz_trsp');
    gui.add(api, 'u_50').name('禁用stars');
    gui.add(api, 'u_51').name('禁用bulb');
    gui.add(api, 'u_52').name('禁用dens');
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
    const u_49 = webglUtils.getUniformLocation(gl, program, 'u_49');
    const u_50 = webglUtils.getUniformLocation(gl, program, 'u_50');
    const u_51 = webglUtils.getUniformLocation(gl, program, 'u_51');
    const u_52 = webglUtils.getUniformLocation(gl, program, 'u_52');
    return () => {
      u_49.uniform1i(api.u_49 ? 1 : 0);
      u_50.uniform1i(api.u_50 ? 1 : 0);
      u_51.uniform1i(api.u_51 ? 1 : 0);
      u_52.uniform1i(api.u_52 ? 1 : 0);
    };
  }
  channels() {
    return [
      webglUtils.DEFAULT_NOISE_BW, //
      webglUtils.TEXTURE12,
    ];
  }
}
