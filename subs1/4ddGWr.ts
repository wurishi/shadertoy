import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
// for a dramatic display of the value of dithering,
// use these settings.
//const float PaletteRGBSize = 2.;// only 1 bit per R G B (8-color palette)
//const float ResolutionDivisor = 1.;// 1 pixel = 1 pixel, the finest visible.


const float PaletteRGBSize = 4.;// number of values possible for each R, G, B.
const float ResolutionDivisor = 2.;

uniform bool u_usebayer4;
uniform bool u_usebayer8;
uniform bool u_noise;
uniform bool u_anim_noise;

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
    return texture(iChannel1, uvScreenSpace/(ResolutionDivisor*8.)).r;
}

vec3 getSceneColor(vec2 uv)
{
    return texture(iChannel0, uv).rgb;
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
    if(u_usebayer4) {
      dc += (bayer4x4(fragCoord)-.5)*(quantizationPeriod);
    }
    if(u_usebayer8) {
      dc += (bayer8x8(fragCoord)-.5)*(quantizationPeriod);
    }
    if(u_noise) {
      dc += (rand(uvPixellated)-.5)*(quantizationPeriod);
    }
    if(u_anim_noise) {
      dc += (rand(vec2(rand(uvPixellated),iDate.w))-.5)*(quantizationPeriod);
    }
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

const {
  video, //
  videoAdd,
  videoInit,
  videoDestory,
} = webglUtils.createVideo();

let gui: GUI;
const api = {
  u_usebayer4: false,
  u_usebayer8: true,
  u_noise: false,
  u_anim_noise: false,
};
export default class implements iSub {
  key(): string {
    return '4ddGWr';
  }
  name(): string {
    return 'Palette Quantization & Dithering';
  }
  sort() {
    return 149;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    videoInit();
    gui = new GUI();
    gui.add(api, 'u_usebayer4');
    gui.add(api, 'u_usebayer8');
    gui.add(api, 'u_noise');
    gui.add(api, 'u_anim_noise');
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
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_usebayer4 = webglUtils.getUniformLocation(
      gl,
      program,
      'u_usebayer4'
    );
    const u_usebayer8 = webglUtils.getUniformLocation(
      gl,
      program,
      'u_usebayer8'
    );
    const u_noise = webglUtils.getUniformLocation(gl, program, 'u_noise');
    const u_anim_noise = webglUtils.getUniformLocation(
      gl,
      program,
      'u_anim_noise'
    );
    return () => {
      videoAdd();
      u_usebayer4.uniform1i(api.u_usebayer4 ? 1 : 0);
      u_usebayer8.uniform1i(api.u_usebayer8 ? 1 : 0);
      u_noise.uniform1i(api.u_noise ? 1 : 0);
      u_anim_noise.uniform1i(api.u_anim_noise ? 1 : 0);
    };
  }
  channels() {
    return [
      { type: 2, video },
      { type: 0, path: './textures/4ddGWr.png' },
    ];
  }
}
