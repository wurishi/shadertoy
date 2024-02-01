import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define SHOW_EXP
#define SHOW_POLY

#define time iTime


float expOutIn(float t, float n) 
{
    t = clamp(t, 0.,1.);   
    float a = 1./(exp2(n) - 1.);
    
    if (t < 0.5)
    {
        a += 1.;
		float b = log2(a);
		return (a - exp2(-n*t*2.0 + b))*0.5;
    }
    else
    {
		float b = -log2(a)/n;
		return (-a + exp2(n*((t-0.5)*2.0 - b)))*0.5+0.5;
    }
}

float polyOutIn(in float t, in float n)
{
    t = clamp(t, 0.,1.);
    float pw = 0.5*pow(abs(2.0*t - 1.), n);
   	return t<0.5 ? 0.5 - pw : 0.5 + pw;
}

float expOut(in float t, in float n) 
{
	float a = 1. + 1./(exp2(n) - 1.);
	float b = log2(a);
	return a - exp2(-n*t + b);
}

float expIn(in float t, in float n)
{
	float a = 1./(exp2(n) - 1.);
	float b = -log2(a)/n;
	return -a + exp2(n*(t - b));
}

float polyIn(in float t, in float n)
{
	return pow(abs(t), n);
}

float polyOut(in float t, in float n)
{
	return 1. - pow(abs(t - 1.), n);
}

#define time iTime

float f(in float x, in float num)
{
    float st = sin(time)*6.+6.001;
	float fx = 0.;
	
    if (num == 1.)
    {
        //fx = expOut(x,st);
        fx = expOutIn(x, st);
        //fx = polyOutIn(x, st*0.35+1.0);
    }
	else if (num == 2.)
		fx = expIn(x,st);
	else if (num == 3.)
		fx = polyOut(x,st*0.45+1.);
    else
		fx = polyIn(x,st*0.45+1.);
	
	return fx;
}

#define baseScale 2.
#define thickness .1

#define color1 vec3(.1,0.5,0.)
#define color2 vec3(0.1,0.3,.9)


//http://www.iquilezles.org/www/articles/distance/distance.htm
float de(const in vec2 p, const in float num)
{
    float v = f(p.x, num)-p.y;
	float h = .35;
    float g = 1.5+ pow(f(p.x+h, num) - f(p.x-h, num),2.);
    float de = abs(v)/sqrt(g);
    return float(smoothstep( 0., .13, de ));
}

float draw(const in vec2 p, const in float num, const in float zoom)
{
	float rz = de(p, num);
	rz *= (1./thickness)/sqrt(zoom/iResolution.y);
	rz = 1.-clamp(rz, 0., 1.);
	return rz;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	float t= iTime;
	float zoom = baseScale;
	float width = 0.;
	width += 3. / iResolution.x* zoom;
	float asp = iResolution.x/iResolution.y;
	vec2 q = fragCoord.xy/ iResolution.xy;
	q.x = (q.x*asp)+(1.-asp)*.5;
	vec2 uv = q*zoom;
	uv -= 0.5*zoom;
    vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(0.0,0.0):mo;
	mo.x *= asp;
	float col1 = 0.,col2 = 0.,col3 = 0.,col4 = 0.;
    uv -= mo-vec2(0.5);
	
	vec3 col = vec3(.97);
	col1 += draw(uv,1., zoom);
    col1 *= step(uv.x,1.)*step(-uv.x,0.);
    
    col2 += draw(uv,2., zoom);
    col2 *= step(uv.x,1.)*step(-uv.x,0.);
    
    col3 += draw(uv,3., zoom);
    col3 *= step(uv.x,1.)*step(-uv.x,0.);
    
    col4 += draw(uv,4., zoom);
    col4 *= step(uv.x,1.)*step(-uv.x,0.);
	
	float grid;
	grid = 	   step(abs(uv.x), width*0.6)*.8;
	grid = max(step(abs(uv.y), width*0.6)*.8, grid);
	grid = max(step(fract(uv.x), width*1.2)*.2, grid);
	grid = max(step(fract(uv.y), width*1.2)*.2, grid);
	col -= grid;
	
    #ifdef SHOW_EXP
	col -= col1*(1.-color1);
	col -= col2*(1.-color1);
    #endif
	#ifdef SHOW_POLY
    col -= col3*(1.-color2);
    col -= col4*(1.-color2);
    #endif
	
	fragColor = vec4(col, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'ltBGDD';
  }
  name(): string {
    return 'Superior easing';
  }
  sort() {
    return 360;
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
