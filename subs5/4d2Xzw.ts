import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Bokeh disc.
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// The Golden Angle is (3.-sqrt(5.0))*PI radians, which doesn't precompiled for some reason.
// The compiler is a dunce I tells-ya!!
#define GOLDEN_ANGLE 2.39996

#define ITERATIONS 150

mat2 rot = mat2(cos(GOLDEN_ANGLE), sin(GOLDEN_ANGLE), -sin(GOLDEN_ANGLE), cos(GOLDEN_ANGLE));

//-------------------------------------------------------------------------------------------
vec3 Bokeh(sampler2D tex, vec2 uv, float radius)
{
	vec3 acc = vec3(0), div = acc;
    float r = 1.;
    vec2 vangle = vec2(0.0,radius*.01 / sqrt(float(ITERATIONS)));
    
	for (int j = 0; j < ITERATIONS; j++)
    {  
        // the approx increase in the scale of sqrt(0, 1, 2, 3...)
        r += 1. / r;
	    vangle = rot * vangle;
        vec3 col = texture(tex, uv + (r-1.) * vangle).xyz; /// ... Sample the image
        col = col * col *1.8; // ... Contrast it for better highlights - leave this out elsewhere.
		vec3 bokeh = pow(col, vec3(4));
		acc += col * bokeh;
		div += bokeh;
	}
	return acc / div;
}

//-------------------------------------------------------------------------------------------
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.x; //... with correct aspect ratio
    
    float time = mod(iTime*.2 +.25, 3.0);
    
	float rad = .8 - .8*cos(time * 6.283);
    if (iMouse.w >= 1.0)
    {
    	rad = (iMouse.x/iResolution.x)*3.0;

    }
    
    if (time < 1.0)
    {        
		fragColor = vec4(Bokeh(iChannel0, uv, rad), 1.0);
    }else
    if (time < 2.0)
    {
        fragColor = vec4(Bokeh(iChannel1, uv, rad), 1.0);    
    }else
    {
		fragColor = vec4(Bokeh(iChannel2, uv, rad), 1.0);
    }
    
}
`;

export default class implements iSub {
  key(): string {
    return '4d2Xzw';
  }
  name(): string {
    return 'Bokeh disc';
  }
  sort() {
    return 532;
  }
  webgl() {
    return WEBGL_2;
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
    return [webglUtils.TEXTURE7, webglUtils.TEXTURE3, webglUtils.TEXTURE12];
  }
}
