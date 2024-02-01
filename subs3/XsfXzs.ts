import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define ITR 80.
#define BAILOUT 1e10

#define R .35
#define G .2
#define B .15

#define time iTime
mat2 mm2(const in float a){float c=cos(a), s=sin(a);return mat2(c,-s,s,c);}

//lerp between 3 colors
//usage: 0=a | 0.33=b | 0.66=c | 1=a
vec3 wheel(in vec3 a, in vec3 b, in vec3 c, in float delta)
{
	return mix(mix(mix( a,b,clamp((delta-0.000)*3., 0., 1.)),
						  c,clamp((delta-0.333)*3., 0., 1.)),
						  a,clamp((delta-0.666)*3., 0., 1.));
}

vec3 tone(vec3 color, float gamma)
{
	float white = 2.;
	float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
	float toneMappedLuma = luma * (1. + luma / (white*white)) / (1. + luma);
	color *= toneMappedLuma / luma;
	color = pow(color, vec3(1. / gamma));
	return color;
}

vec2 render(in vec2 p)
{
    //init vars
	vec2 c = p, z = p;
	vec2 oldz1 = vec2(1);
	vec2 oldz2 = vec2(1);
	float curv = 0.;
	float rz = 1., rz2 = 0.;
	float numitr = 0.;
    
    for( int i=0; i<int(ITR); i++ )
	{
		if (dot(z,z)<BAILOUT)
		{
			z = vec2(z.x*z.x-z.y*z.y, 2.*z.x*z.y)+c;
			vec2 tmp = vec2(1);
			if (i > 0)
			{
			tmp = (z-oldz1)/(oldz1-oldz2);
			}
			curv = abs(atan(tmp.y,tmp.x));
			curv = sin(curv*5.)*0.5+0.5;
			
			oldz2 = oldz1;
			oldz1 = z;
			rz2 = rz;
			rz += (.95-curv);
			numitr += 1.;
		}
	}
	
	//Thanks to iq for the proper smoothing formula
	float f = 1.-log2( (log(dot(z,z))/log(BAILOUT)) );
	f = smoothstep(0.,1.,f);
	
	//linear interpolation
	rz = rz / numitr;
	rz2 = rz2 / (numitr-1.);
	rz = mix(rz2,rz,f);
    return vec2(rz,rz2);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	//setup coords and mouse
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x *= iResolution.x/iResolution.y;
	float zoom = sin(time*.1+2.)*0.025+0.027;
    p*= zoom;
	vec2 um = iMouse.xy==vec2(0)?vec2(0):(iMouse.xy / iResolution.xy)-0.5;
	um.x *= iResolution.x/iResolution.y;
	p += um*0.03+vec2(-.483,0.6255);
	
    float px=.75/iResolution.x*zoom;
    vec2 rz = vec2(0);
    for (float i=0.; i<4.; i++) 
    {
        vec2  of = floor(vec2(i/2.,mod(i,2.)));
		rz += render(p+ of*px);
	}
    rz /= 4.;
    
	//coloring	
	rz.y = smoothstep(0.,1.2,rz.x);
	vec3 col = (sin(vec3(R,G,B)+6.*rz.y+2.9)*.5+0.51)*1.4;
	vec3 col2 = vec3(R*(sin(rz.x*5.+1.2)),G*sin(rz.x*5.+4.1),B*sin(rz.x*5.+4.4));
	col2= clamp(col2,0.,1.);
    vec3 col3 = vec3(R,G,B)*smoothstep(0.5,1.,1.-rz.x);
    col3 = pow(col3,vec3(1.2))*2.6;
	col3= clamp(col3,0.,1.);
	col = wheel(col,col2,col3,fract((time-20.)*0.015));
	col = tone(col,.8)*3.5;
    
	fragColor = vec4(col,1.);

}

`;

export default class implements iSub {
  key(): string {
    return 'XsfXzs';
  }
  name(): string {
    return 'Curvature average';
  }
  sort() {
    return 322;
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
