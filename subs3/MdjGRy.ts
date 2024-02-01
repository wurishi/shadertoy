import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define simple_mode
#define numfunc 3

float f(in float x, in float num)
{
	float fx = 0.;
    float stride = 3.0;
	if (num == 1.)
	//______________function 1_______________	
        fx = sin(x);
	
	else if (num == 2.)
	//______________function 2_______________
		fx = x*x*x;
		
	else
	//______________function 3_______________
		fx = x-4.;
	
	
	return fx;
}

#define decimalPlace 4.

#define baseScale 10.
#define thickness 2.5

#define color1 vec3(.1,0.5,0.)
#define color2 vec3(0.1,0.3,.9)
#define color3 vec3(0.6,0.1,.6)


#define KEY_X 88.5/256.0
#define KEY_C 67.5/256.0
#define KEY_V 86.5/256.0
#define KEY_S 83.5/256.0
#define KEY_D 68.5/256.0
#define KEY_F 70.5/256.0
#define KEY_1 49.5/256.0
#define KEY_2 50.5/256.0
#define KEY_3 51.5/256.0


//http://www.iquilezles.org/www/articles/distance/distance.htm
float de(const in vec2 p, const in float num)
{
    float v = f(p.x, num)-p.y;
	float h = .5;
    float g = 1.5+ pow(f(p.x+h, num) - f(p.x-h, num),2.);
    float de = abs(v)/sqrt(g);
    return float(smoothstep( 0., .13, de ));
}

const float kCharBlank = 12.0;
const float kCharMinus = 11.0;
const float kCharDecimalPoint = 10.0;

float DigitBin(const in int x)
{
    return x==0?480599.0:x==1?139810.0:x==2?476951.0:x==3?476999.0:x==4?350020.0:x==5?464711.0:x==6?464727.0:x==7?476228.0:x==8?481111.0:x==9?481095.0:0.0;
}

float PrintValue(const in vec2 vPixelCoords, const in vec2 vFontSize, const in float fValue, const in float fMaxDigits, const in float fDecimalPlaces)
{
    vec2 vStringCharCoords = (gl_FragCoord.xy - vPixelCoords) / vFontSize;
    if ((vStringCharCoords.y < 0.0) || (vStringCharCoords.y >= 1.0)) return 0.0;
	float fLog10Value = log2(abs(fValue)) / log2(10.0);
	float fBiggestIndex = max(floor(fLog10Value), 0.0);
	float fDigitIndex = fMaxDigits - floor(vStringCharCoords.x);
	float fCharBin = 0.0;
	if(fDigitIndex > (-fDecimalPlaces - 1.01)) {
		if(fDigitIndex > fBiggestIndex) {
			if((fValue < 0.0) && (fDigitIndex < (fBiggestIndex+1.5))) fCharBin = 1792.0;
		} else {		
			if(fDigitIndex == -1.0) {
				if(fDecimalPlaces > 0.0) fCharBin = 2.0;
			} else {
				if(fDigitIndex < 0.0) fDigitIndex += 1.0;
				float fDigitValue = (abs(fValue / (pow(10.0, fDigitIndex))));
                float kFix = 0.0001;
                fCharBin = DigitBin(int(floor(mod(kFix+fDigitValue, 10.0))));
			}		
		}
	}
    return floor(mod((fCharBin / pow(2.0, floor(fract(vStringCharCoords.x) * 4.0) + (floor(vStringCharCoords.y * 5.0) * 4.0))), 2.0));
}

float print(const in float value, const in float line)
{
	vec2 pos = vec2(0., 20.*float(line)+5.);
	vec2 vFontSize = vec2(8.0, 15.0);
	float fDigits = 2.0;
	float fDecimalPlaces = decimalPlace;
	return PrintValue(pos, vFontSize, value, fDigits, fDecimalPlaces);
}

//_______________________End of Numbers printing___________________

float zeros(const in vec2 p, const in float x, const in float num, const in float zoom)
{	
	float rz;
	float d = 0.;
		for (float i = 0.;i <= 8.;i++)
		{
			float yval = f(x+d, num);
			float drv = -yval/( (f(x+d+0.4, num) - f(x+d-0.4, num)) *1.01 );
			if (abs(yval) < 0.0002)
			{
				rz += print(yval ,0.);
				rz += print(x+d-drv, 1.);
				rz = max(1.-pow(length(vec2(x+d, yval)-p), 4.)*4e4/(zoom*zoom), rz);
				break;
			}
			
			d+= drv;
		}
	return rz;
}

float info(const in vec2 p, const in float x, const in float num, const in float zoom)
{
	float rz;
	float yval = f(x, num);
	rz += print(yval ,0.);
	rz += print(x, 1.);
	float dr = f(x+0.5, num) - f(x-0.5, num);
	rz += print(dr, 2.);
	rz += 0.5-abs(smoothstep(0., max(.25,dr*0.25),p.y-p.x*dr-yval+dr*x+0.1)-.5);
	rz = max(1.-pow(length(vec2(x, yval)-p), 4.)*2e4/zoom,rz);
	return rz;
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
	if (texture(iChannel0, vec2(KEY_1,0.75)).x > 0.)
	{
		zoom *= 2.;
		width = -.02;
	}
	if (texture(iChannel0, vec2(KEY_2,0.75)).x > 0.)
	{
		zoom *= 2.;
		width = -.02;
	}
	width += 3. / iResolution.x* zoom;
	float asp = iResolution.x/iResolution.y;
	vec2 q = fragCoord.xy/ iResolution.xy;
	//centered aspect correction
	q.x = (q.x*asp)+(1.-asp)*.5;
	vec2 uv = q*zoom;
	uv -= 0.5*zoom;
	vec2 um = zoom*(iMouse.xy/ iResolution.xy-0.5);
	um.x *= asp;
	float col1 = 0.,col2 = 0.,col3 = 0.;
	#ifndef simple_mode
	if (texture(iChannel0,vec2(KEY_X, 0.75)).x > 0.)
	{
		col1 += info(uv, um.x, 1., zoom);
	}
	#if numfunc > 1
	else if (texture(iChannel0,vec2(KEY_C, 0.75)).x > 0.)
	{
		col2 += info(uv, um.x, 2., zoom);
	}
	#endif
	#if numfunc > 2
	else if (texture(iChannel0,vec2(KEY_V, 0.75)).x > 0.)
	{
		col3 += info(uv, um.x, 3., zoom);
	}
	#endif
	else if (texture(iChannel0, vec2(KEY_S,0.75)).x > 0.)
	{
		col1 += zeros(uv, um.x, 1., zoom);
	}
	#if numfunc > 1
	else if (texture(iChannel0, vec2(KEY_D,0.75)).x > 0.)
	{
		col2 += zeros(uv, um.x, 2., zoom);
	}
	#endif
	#if numfunc > 2
	else if (texture(iChannel0, vec2(KEY_F,0.75)).x > 0.)
	{
		col3 += zeros(uv, um.x, 3., zoom);
	}
	#endif
	else
	{
		uv.y -= ((iMouse.y/ iResolution.y) -.5)*zoom;
		uv.x -= ((iMouse.x/ iResolution.x) -.5)*zoom*asp;
	}
	#else
		uv.y -= ((iMouse.y/ iResolution.y) -.5)*zoom;
		uv.x -= ((iMouse.x/ iResolution.x) -.5)*zoom*asp;
	#endif
	
	//background
	vec3 col = vec3(.97);
	col1 += draw(uv,1., zoom);
	
	#if numfunc > 1
		col2 += draw(uv,2., zoom);
	#endif
	#if numfunc > 2
		col3 += draw(uv,3., zoom);
	#endif
	
	float grid;
	grid = 	   step(abs(uv.x), width*0.5)*.8;
	grid = max(step(abs(uv.y), width*0.5)*.8, grid);
	grid = max(step(fract(uv.x), width*1.2)*.2, grid);
	grid = max(step(fract(uv.y), width*1.2)*.2, grid);
	col -= grid;
	
	col -= col1*(1.-color1);
	col -= col2*(1.-color2);
	col -= col3*(1.-color3);
	
	fragColor = vec4(col, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdjGRy';
  }
  name(): string {
    return 'Graphing';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 316;
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
