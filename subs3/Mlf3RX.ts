import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define time iTime*0.35

float koch(vec2 p)
{
    float ft = mod(floor(time),6.)+1.;
    p = abs(fract(p)-0.5);
    for(int i=0;i<12;++i)
    {
        if (floor(float(i)*.5) > ft)break; //"animation"
#if 0
        p += vec2(p.y*1.735, -p.x*1.735);
        p.x = abs(p.x)-0.58;
        p = -vec2(-p.y, p.x)*.865;
#else
        p = -vec2(-p.y + p.x*1.735, abs(p.x + p.y*1.735) - 0.58)*.865; //One loc version
#endif
    }
    
    return mod(floor(time*2.),2.)>0. ? abs(p.x)/(ft*ft)*14. : p.x/(ft*ft)*16.;
    //return p.x;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy / iResolution.xy;
    vec2 p = q-0.5;
	p.x *= iResolution.x/iResolution.y;
    p = clamp(p,-.55,.55);
    
	float rz = koch(p.yx*.9+vec2(0.5,0));
    rz = 1.-clamp(rz,0.,1.);
    
    vec3 col = vec3(rz)*vec3(1,.97,.92);
	float lp = length(p*6.);
	col -= pow(lp*.23,2.)*rz;
	
	//background coloring
	vec3 bg = vec3(0.1,0.2,0.3)*1.3;
	col = mix(bg,col, rz);
	col -= lp*.03;
    
	fragColor = vec4(col,1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'Mlf3RX';
  }
  name(): string {
    return 'Koch Snowflake again';
  }
  sort() {
    return 329;
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
