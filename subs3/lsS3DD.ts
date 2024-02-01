import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define tau 6.28318530718

const float maxiter=254.;

vec2 rotate(in vec2 p,in float angle)
{
	float c = cos(angle);
	float s = sin(angle);
	return p*mat2(c,-s,s,c);
}

float tree(vec2 p)
{
	int n = 0;
	float angle=tau*0.25;
	float t = iTime;
	float dtree;
	float dir = 1.;float dir2 = 1.;float dir3 = 1.;float dir4 = 1.;float dir5 = 1.;
	float dir6 = 1.;float dir7 = 1.;float dir8 = 1.;float dir9 = 1.;
	
	for (float n=0.; n < maxiter; n++) 
	{	
		if (n > mod(t*30., 512.)) break;
		float d=length((p+vec2(.0,1.))*vec2(5./(cos(t*0.5+tau*0.5)*2.+3.),1.2));
		
		if (n<2.) dtree=d;
		
		dtree= min(dtree,d);
		
		if (mod(n,128.)==0.)
		{
			dir8 *= -1.;
			p=rotate(p,-dir8*angle);
		}
		else if (mod(n,64.)==0.)
		{
			dir7 *= -1.;
			p =rotate(p,-dir7*angle);
		}
		else if (mod(n,32.)==0.)
		{
			dir6 *= -1.;
			p =rotate(p,-dir6*angle);
		}
		else if (mod(n,16.)==0.)
		{
			dir5 *= -1.;
			p =rotate(p,-dir5*angle);
		}
		else if (mod(n,8.)==0.)
		{
			dir4 *= -1.;
			p = rotate(p,-dir4*angle);
		}
		else if (mod(n,4.)==0.)
		{
			dir3 *= -1.;
			p = rotate(p,-dir3*angle);
		}
		else if (mod(n,2.)==0.)
		{
			dir2 *= -1.;
			p = rotate(p,-dir2*angle);
		}
		else if (mod(n,1.)==0.)
		{
			dir *= -1.;
			p = rotate(p,-dir*angle);
		}
		p.y-=1.5; //move forward
	}
	return clamp(dtree*dtree,0.,1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	float t = iTime;
	vec2 p = fragCoord.xy/iResolution.xy-.5;
	vec2 aspect=vec2(iResolution.x/iResolution.y,1.);
	float rz = 1.-dot(p,p*.6);
	p.y+=.14;
  	p.x-= 0.22+iResolution.x*1e-4;
	p*=aspect;
	p*=24.+iResolution.x*6e-3;
	p = rotate(p,tau*-0.25);
	float drg = tree(p);
	rz = mix(rz,drg,1.-drg);
	vec3 col = vec3(rz*0.9,rz*0.9,rz*0.75);
	fragColor = vec4(col,1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'lsS3DD';
  }
  name(): string {
    return 'Piecewise dragon';
  }
  sort() {
    return 337;
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
