import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// for a dramatic display of the value of dithering,
// use these settings.
//const float PaletteRGBSize = 2.;// only 1 bit per R G B (8-color palette)
//const float ResolutionDivisor = 1.;// 1 pixel = 1 pixel, the finest visible.


const float PaletteRGBSize = 4.;// number of values possible for each R, G, B.
const float ResolutionDivisor = 2.;

//#define USE_BAYER4x4
#define USE_BAYER8x8
//#define USE_NOISE
//#define USE_ANIM_NOISE

//----------------------------------------------------------------------------


float quantize(float inp, float period)
{
    return floor((inp+period/2.)/period)*period;
}
vec2 quantize(vec2 inp, vec2 period)
{
    return floor((inp+period/2.)/period)*period;
}


//----------------------------------------------------------------------------


//----------------------------------------------------------------------------
float bayer4x4(vec2 uvScreenSpace)
{
	vec2 bayerCoord = floor(uvScreenSpace/ResolutionDivisor);
    bayerCoord = mod(bayerCoord, 4.);
    const mat4 bayerMat = mat4(
    1,9,3,11,
    13,5,15,7,
    4,12,2,10,
    16,8,14,6) / 16.;
    int bayerIndex = int(bayerCoord.x + bayerCoord.y * 4.);
    if(bayerIndex == 0) return bayerMat[0][0];
    if(bayerIndex == 1) return bayerMat[0][1];
    if(bayerIndex == 2) return bayerMat[0][2];
    if(bayerIndex == 3) return bayerMat[0][3];
    if(bayerIndex == 4) return bayerMat[1][0];
    if(bayerIndex == 5) return bayerMat[1][1];
    if(bayerIndex == 6) return bayerMat[1][2];
    if(bayerIndex == 7) return bayerMat[1][3];
    if(bayerIndex == 8) return bayerMat[2][0];
    if(bayerIndex == 9) return bayerMat[2][1];
    if(bayerIndex == 10) return bayerMat[2][2];
    if(bayerIndex == 11) return bayerMat[2][3];
    if(bayerIndex == 12) return bayerMat[3][0];
    if(bayerIndex == 13) return bayerMat[3][1];
    if(bayerIndex == 14) return bayerMat[3][2];
    if(bayerIndex == 15) return bayerMat[3][3];

    return 10.;// impossible
}

float bayer8x8(vec2 uvScreenSpace)
{
    return texture(iChannel0, uvScreenSpace/(ResolutionDivisor*8.)).r;
}











//----------------------------------------------------------------------------
// c64 palette
vec3 color0 = vec3(0,0,0);// black
vec3 color1 = vec3(1,1,1);// white
vec3 color2 = vec3(0.41,0.22,0.17);// red
vec3 color3 = vec3(0.44,0.64,0.70);// cyan
vec3 color4 = vec3(0.44,0.24,0.53);// violet
vec3 color5 = vec3(0.35,0.55,0.26);// green
vec3 color6 = vec3(0.21,0.16,0.47);// blue
vec3 color7 = vec3(0.72,0.78,0.44);// yellow
vec3 color8 = vec3(0.44,0.31,0.15);// orange
vec3 color9 = vec3(0.26,0.22,0);// brown
vec3 colorA = vec3(0.60,0.40,0.35);// light red
vec3 colorB = vec3(0.27,0.27,0.27);// grey1
vec3 colorC = vec3(0.42,0.42,0.42);// grey2
vec3 colorD = vec3(0.60,0.82,0.52);// light green
vec3 colorE = vec3(0.42,0.37,0.71);// light blue
vec3 colorF = vec3(0.58,0.58,0.58);// grey3

// not sure the best curve to use for mixing. linear looks nice to me though; better
// than smoothstep and smootherstep.
// smoothstep is of course the fastest though.
float gradientStep(float edge0, float edge1, float x)
{
    return smoothstep(edge0, edge1, x);

    // smootherstep
    //x = clamp((x - edge0)/(edge1 - edge0), 0.0, 1.0);
    //return x*x*x*(x*(x*6. - 15.) + 10.);
    
    // linear
    //x = clamp((x - edge0)/(edge1 - edge0), 0.0, 1.0);
    //return x;
}


// edge colors will naturally get slightly more intensity because they don't blend with
// anything on the left/right.
vec3 gradient(float t, vec3 c1, vec3 c2, vec3 c3)
{
    const float colCount = 3.;
    const float bandSize = 1./colCount;
    const float plateauSize = 0.0 * (bandSize/2.);
    t -= bandSize*.5;
	return
        + (c1 * (1.-gradientStep(plateauSize,bandSize-plateauSize, t-bandSize*0.)))
        + (c2 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*1.))))
        + (c3 * (1.-gradientStep(plateauSize,bandSize-plateauSize, bandSize*2.-t)))
        ;
}

vec3 gradient(float t, vec3 c1, vec3 c2, vec3 c3, vec3 c4)
{
    const float colCount = 3.;
    const float bandSize = 1./colCount;
    const float plateauSize = 0.0 * (bandSize/2.);
    t -= bandSize*.5;
	return
        + (c1 * (1.-gradientStep(plateauSize,bandSize-plateauSize, t-bandSize*0.)))
        + (c2 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*1.))))
        + (c3 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*2.))))
        + (c4 * (1.-gradientStep(plateauSize,bandSize-plateauSize, bandSize*3.-t)))
        ;
}

vec3 gradient(float t, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5)
{
    const float colCount = 5.;
    const float bandSize = 1./colCount;
    const float plateauSize = 0.0 * (bandSize/2.);
    t -= bandSize*.5;
	return
        + (c1 * (1.-gradientStep(plateauSize,bandSize-plateauSize, t-bandSize*0.)))
        + (c2 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*1.))))
        + (c3 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*2.))))
        + (c4 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*3.))))
        + (c5 * (1.-gradientStep(plateauSize,bandSize-plateauSize, bandSize*4.-t)))
        ;
}



vec3 gradient(float t, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, vec3 c6, vec3 c7, vec3 c8, vec3 c9, vec3 c10, vec3 c11, vec3 c12, vec3 c13, vec3 c14, vec3 c15, vec3 c16)
{
    const float colCount = 16.;
    const float bandSize = 1./colCount;
    const float plateauSize = 0.0 * (bandSize/2.);
    t -= bandSize*.5;
	return
        + (c1 * (1.-gradientStep(plateauSize,bandSize-plateauSize, t-bandSize*0.)))
        + (c2 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*1.))))
        + (c3 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*2.))))
        + (c4 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*3.))))
        + (c5 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*4.))))
        + (c6 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*5.))))
        + (c7 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*6.))))
        + (c8 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*7.))))
        + (c9 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*8.))))
        + (c10 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*9.))))
        + (c11 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*10.))))
        + (c12 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*11.))))
        + (c13 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*12.))))
        + (c14 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*13.))))
        + (c15 * (1.-gradientStep(plateauSize,bandSize-plateauSize, abs(t-bandSize*14.))))
        + (c16 * (1.-gradientStep(plateauSize,bandSize-plateauSize, bandSize*15.-t)))
        ;

}


vec3 getSceneColor(in vec2 uv )
{
    vec4 fragColor;
//	vec2 uv = fragCoord.xy / iResolution.xy;
    
    if(uv.y > .666)
		fragColor = vec4(gradient(uv.x, color3, color2, colorC, colorD),1);
    else if(uv.y > .333)
		fragColor = vec4(gradient(uv.x, color2, color3, color4, color5, color6),1);
    else
		fragColor = vec4(gradient(uv.x, color0, color1, color2, color3, color4, color5, color6, color7, color8, color9, colorA, colorB, colorC, colorD, colorE, colorF),1);

    // band
    float f = fract(uv.y*3.0);
    // borders
    fragColor.rgb *= smoothstep( 0.49, 0.47, abs(f-0.5) );
    // shadowing
    fragColor.rgb *= 0.5 + 0.5*sqrt(4.0*f*(1.0-f));
    
    return fragColor.rgb;
}

float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;// 0-1
    
    // space between values of the dest palette
    vec3 quantizationPeriod = vec3(1./(PaletteRGBSize-1.));
    
	vec2 uvPixellated = floor(fragCoord / ResolutionDivisor)*ResolutionDivisor;
    
    // original color panel---------------------
    vec3 originalCol = getSceneColor(uv);
    
    // dithered panel---------------------
    vec3 dc = getSceneColor(uvPixellated / iResolution.xy);
    // apply bayer matrix, perturbing the original color values.
#ifdef USE_BAYER4x4
    dc += (bayer4x4(fragCoord)-.5)*(quantizationPeriod);
#endif
#ifdef USE_BAYER8x8
	dc += (bayer8x8(fragCoord)-.5)*(quantizationPeriod);
#endif
#ifdef USE_NOISE
	dc += (rand(uvPixellated)-.5)*(quantizationPeriod);
#endif
#ifdef USE_ANIM_NOISE
	dc += (rand(vec2(rand(uvPixellated),iDate.w))-.5)*(quantizationPeriod);
#endif
    // quantize color to palette
    dc = vec3(
        quantize(dc.r, quantizationPeriod.r),
        quantize(dc.g, quantizationPeriod.g),
        quantize(dc.b, quantizationPeriod.b)
            );
   
    // quantize to palette (raw quantization panel)---------------------
    vec3 qc = getSceneColor(uvPixellated / iResolution.xy);
    qc = vec3(
        quantize(qc.r, quantizationPeriod.r),
        quantize(qc.g, quantizationPeriod.g),
        quantize(qc.b, quantizationPeriod.b)
            );


    // framing and post
    float ySplit = (iMouse.y > 0.0 ? iMouse.y / iResolution.y : 0.3);
    float xSplit = .7;
    if(iMouse.x > 0.) xSplit = iMouse.x / iResolution.x;
    if(uv.x > xSplit)
	    fragColor = vec4(originalCol, 1);
    else
    {
        if(uv.y > ySplit)
		    fragColor = vec4(dc, 1);
        else
		    fragColor = vec4(qc, 1);
    }

    float f = abs(uv.x - xSplit);
    fragColor.rgb *= smoothstep(.00,.005, f);
    f = abs(uv.y - ySplit);
    if(uv.x < xSplit)
	    fragColor.rgb *= smoothstep(.00,.005, f);
}
`;

export default class implements iSub {
  key(): string {
    return 'Xdt3Wr';
  }
  name(): string {
    return 'Quantization & Dithering 2';
  }
  sort() {
    return 151;
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
    return [webglUtils.DEFAULT_NOISE];
  }
}
