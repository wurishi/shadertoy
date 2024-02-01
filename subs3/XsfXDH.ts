import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define time iTime
const mat2 m2 = mat2( 0.5,  0.866, -0.866,  0.5 );

float koch(vec2 p)
{
	float rz = 1.;
	const float maxitr = 7.;
	float itnum = maxitr;
	for (float i=0.;i<maxitr;i++) 
	{
		if (i>mod(time*0.5,maxitr)) break;
		
		//draw triangle
		float d = max(abs(p.x)*1.73205+p.y, -p.y*2.)-3.;
		
		//edge scaling
		itnum--;
		d *=exp(itnum)*0.05;
		
		//min blending
		rz= min(rz,d);
		
		//show complete edges half the time
		rz *= rz+(abs(d)*step(mod(time,2.),1.));
		
		//fold both axes
		p = abs(p);
		
		//rotate
		p *= m2;
		
		//fold y axis
		p.y = abs(p.y);
		
		//rotate back
		p.yx*= m2;
		
		//move and scale
		p.y-=2.;
		p*=3.;
	}
	return clamp(rz,0.,1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy/iResolution.xy-.5;
	p.x *= iResolution.x/iResolution.y;
	p *= 6.;
	
	float rz = 1.-koch(p);
	vec3 col = vec3(1.)*rz;
	float lp = length(p);
	col -= pow(lp*.23,2.)*rz;
	
	//background coloring
	vec3 bg = vec3(0.1,0.2,0.3)*1.3;
	col = mix(bg,col, rz*rz);
	col -= lp*.03;
	
	fragColor = vec4(col,1.);
}

`;

export default class implements iSub {
  key(): string {
    return 'XsfXDH';
  }
  name(): string {
    return 'Koch snowflake IFS';
  }
  sort() {
    return 380;
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
