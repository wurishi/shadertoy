import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define time iTime

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy-0.5;
	p.x *= iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-0.5;
	mo *= 1.-step(abs(iMouse.z),0.);
	
	//background color
	vec3 col = vec3(.04,0.1,0.18)-(p.x-p.y-0.2)*0.1;
	//slight faked projection
	p *= (dot(p,p)+10.)*2.;
	
    //p = abs(p)-6.;
    
	float rz = 0.;
	vec3 ligt = normalize(vec3(-0.5,.6,.5));
	vec3 haf = normalize(vec3(0.,0.,1.)+ligt);
	for(float i=0.;i<120.;i++)
	{
		float cntd = (120.-i)*0.005;
		//draw disc
		float rz2 = 1.-clamp(pow(dot(p,p)*(cntd+1.),2.),0.,1.);
		//base color
		vec3 col2 = (sin(vec3(.9,.25,.2)*i*.15)*.5+0.5)*(smoothstep(0.,.3,rz2))*.18;
		
			//branching painter's algo
		//if (rz2 > 0.) col = col2;
			//step version
		//col = col*step(rz2,0.)+col2;
			//smoothstep version
		col = col*(1.-smoothstep(0.0,.4+mo.x*0.6,rz2))+col2;
		
		vec3 norm = normalize(vec3(p*1.5,rz2+i*.005));
		//diffuse
		col += rz2*(dot(norm,ligt))*col2*6.2;
		//specular
		col += rz2*pow(clamp((dot(norm,haf)),0.,1.),300.);
		
		//move the next disc
		float i2 = i*(sin(time*0.4)*0.1+1.5);
		p.x += sin(i2*.5-time*0.2)*i*0.04+sin(time*0.35)*0.1;
		p.y += cos(i2*.5+time*0.2)*i*0.04+cos(time*0.33)*0.06;
	}
	
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XslSWH';
  }
  name(): string {
    return 'Discs?';
  }
  sort() {
    return 352;
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
