import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float ResolutionDivisor = 4.;


//----------------------------------------------------------------------------

float bayer8x8(vec2 uvScreenSpace)
{
    return texture(iChannel1, uvScreenSpace/(ResolutionDivisor*8.)).r;
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

vec3 selectIfCloser (in vec3 idealColor, in vec3 paletteColor, in vec3 bestColorSoFar, inout float currentDistance) 
{
    float thisDistance = distance(idealColor, paletteColor);
    if(thisDistance < currentDistance)
    {
        currentDistance = thisDistance;
        return paletteColor;
    }
    return bestColorSoFar;
}

// a more optimized version of this could do something like a binary search
// or order by luminocity and short-circuit search that way.
vec3 palettize(vec3 idealColor)
{
    // init with first palette color
	float dmin = distance(idealColor, color0);
    vec3 closest = color0;

    closest = selectIfCloser(idealColor, color1, closest, dmin);
    closest = selectIfCloser(idealColor, color2, closest, dmin);
    closest = selectIfCloser(idealColor, color3, closest, dmin);
    closest = selectIfCloser(idealColor, color4, closest, dmin);
    closest = selectIfCloser(idealColor, color5, closest, dmin);
    closest = selectIfCloser(idealColor, color6, closest, dmin);
    closest = selectIfCloser(idealColor, color7, closest, dmin);
    closest = selectIfCloser(idealColor, color8, closest, dmin);
    closest = selectIfCloser(idealColor, color9, closest, dmin);
    closest = selectIfCloser(idealColor, colorA, closest, dmin);
    closest = selectIfCloser(idealColor, colorB, closest, dmin);
    closest = selectIfCloser(idealColor, colorC, closest, dmin);
    closest = selectIfCloser(idealColor, colorD, closest, dmin);
    closest = selectIfCloser(idealColor, colorE, closest, dmin);
    closest = selectIfCloser(idealColor, colorF, closest, dmin);
    return closest;
}

vec3 getSceneColor(in vec2 uv )
{
    return texture(iChannel0, uv).rgb;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;// 0-1
    
    // space between values of the dest palette
    vec3 quantizationPeriod = vec3(1./16.);
    
	vec2 uvPixellated = floor(fragCoord / ResolutionDivisor)*ResolutionDivisor;
    
    // original color panel---------------------
    vec3 originalCol = getSceneColor(uv);
    
    // dithered panel---------------------
    vec3 dc = getSceneColor(uvPixellated / iResolution.xy);
	dc += (bayer8x8(fragCoord)-.5)*(quantizationPeriod);

    dc = palettize(dc);

    fragColor = vec4(dc, 1);
}
`;

const { video, videoAdd, videoInit, videoDestory } = webglUtils.createVideo();

export default class implements iSub {
  key(): string {
    return 'Xdt3Dr';
  }
  name(): string {
    return 'Palettization + OrderedDithering';
  }
  sort() {
    return 152;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    videoInit();
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    videoDestory();
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {
      videoAdd();
    };
  }
  channels() {
    return [{ type: 2, video }, webglUtils.DEFAULT_NOISE];
  }
}
