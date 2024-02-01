import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float nsin(float a)
{
    return (sin(a)+1.)/2.;
}
float rand(float n)
{
 	return fract(cos(n*89.42)*343.42);
}
vec2 rand(vec2 n)
{
 	return vec2(rand(n.x*23.62-300.0+n.y*34.35),rand(n.x*45.13+256.0+n.y*38.89)); 
}

// returns (dx, dy, distance)
vec3 worley(vec2 n,float s)
{
    vec3 ret = vec3(s * 10.);
    // look in 9 cells (n, plus 8 surrounding)
    for(int x = -1;x<2;x++)
    {
        for(int y = -1;y<2;y++)
        {
            vec2 xy = vec2(x,y);// xy can be thought of as both # of cells distance to n, and 
            vec2 cellIndex = floor(n/s) + xy;
            vec2 worleyPoint = rand(cellIndex);// random point in this cell (0-1)
            worleyPoint += xy - fract(n/s);// turn it into distance to n. ;
            float d = length(worleyPoint) * s;
            if(d < ret.z)
                ret = vec3(worleyPoint, d);
        }
    }
    return ret;
}

vec2 mouse = vec2(1.);// how do i initialize this??

vec4 applyLighting(vec4 inpColor, vec2 uv, vec3 normal, vec3 LightPos, vec4 LightColor, vec4 AmbientColor)
{
   // if(distance(uv.xy, LightPos.xy) < 0.01) return vec4(1.,0.,0.,1.);
    vec3 LightDir = vec3(LightPos.xy - uv, LightPos.z);
    vec3 N = normalize(normal);
    vec3 L = normalize(LightDir);
    vec3 Diffuse = (LightColor.rgb * LightColor.a) * max(dot(N, L), 0.0);
    vec3 Ambient = AmbientColor.rgb * AmbientColor.a;
    vec3 Intensity = Ambient + Diffuse;
    vec3 FinalColor = inpColor.rgb * Intensity;
    return vec4(FinalColor, inpColor.a);
}

float dtoa(float d)
{
    const float amount = 800.0;
    return clamp(1.0 / (clamp(d, 1.0/amount, 1.0)*amount), 0.,1.);
}


// distance to edge of grid line. real distance, and centered over its position.
float grid_d(vec2 uv, vec2 gridSize, float gridLineWidth)
{
    uv += gridLineWidth / 2.0;
    uv = mod(uv, gridSize);
    vec2 halfRemainingSpace = (gridSize - gridLineWidth) / 2.0;
    uv -= halfRemainingSpace + gridLineWidth;
    uv = abs(uv);
    uv = -(uv - halfRemainingSpace);
    return min(uv.x, uv.y);
}
// centered over lineposy
float hline_d(vec2 uv, float lineposy, float lineWidth)
{
	return distance(uv.y, lineposy) - (lineWidth / 2.0);
}
// centered over lineposx
float vline_d(vec2 uv, float lineposx, float lineWidth)
{
	return distance(uv.x, lineposx) - (lineWidth / 2.0);
}
float circle_d(vec2 uv, vec2 center, float radius)
{
	return length(uv - center) - radius;
}

// not exactly perfectly perfect, but darn close
float pointRectDist(vec2 p, vec2 rectTL, vec2 rectBR)
{
  float dx = max(max(rectTL.x - p.x, 0.), p.x - rectBR.x);
  float dy = max(max(rectTL.y - p.y, 0.), p.y - rectBR.y);
  return max(dx, dy);
}


vec2 getuv(vec2 fragCoord, vec2 newTL, vec2 newSize, out float distanceToVisibleArea, out float vignetteAmt)
{
    vec2 ret = vec2(fragCoord.x / iResolution.x, (iResolution.y - fragCoord.y) / iResolution.y);// ret is now 0-1 in both dimensions
    
    // warp
    //ret = tvWarp(ret / 2.) * 2.;// scale it by 2.
    distanceToVisibleArea = pointRectDist(ret, vec2(0.0), vec2(1.));

    // vignette
    vec2 vignetteCenter = vec2(0.5, 0.5);
	vignetteAmt = 1.0 - distance(ret, vignetteCenter);
    vignetteAmt = 0.03 + pow(vignetteAmt, .25);// strength
    vignetteAmt = clamp(vignetteAmt, 0.,1.);
    
    
    ret *= newSize;// scale up to new dimensions
    float aspect = iResolution.x / iResolution.y;
    ret.x *= aspect;// orig aspect ratio
    float newWidth = newSize.x * aspect;
    return ret + vec2(newTL.x - (newWidth - newSize.x) / 2.0, newTL.y);
}

vec4 drawHole(vec4 inpColor, vec2 uv, vec2 pos)
{
    vec4 circleWhiteColor = vec4(vec3(0.95), 1.);
	float d = circle_d(uv, pos, 0.055);
    return vec4(mix(inpColor.rgb, circleWhiteColor.rgb, circleWhiteColor.a * dtoa(d)), 1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float distanceToVisibleArea;
    float vignetteAmt;
	vec2 uv = getuv(fragCoord, vec2(-1.,1.), vec2(2., -2.), distanceToVisibleArea, vignetteAmt);
    float throwaway;
    mouse = getuv(iMouse.xy, vec2(-1.,1.), vec2(2., -2.), throwaway, throwaway);

    fragColor = vec4(0.94, 0.96, 0.78, 1.0);// background
    float d;
    
    // grid
    vec4 gridColor = vec4(0.2,0.4,.9, 0.35);
	d = grid_d(uv, vec2(0.10), 0.001);
	fragColor = vec4(mix(fragColor.rgb, gridColor.rgb, gridColor.a * dtoa(d)), 1.);
    
    // red h line
    vec4 hlineColor = vec4(0.8,0.,.2, 0.55);
	d = hline_d(uv, 0.60, 0.003);
	fragColor = vec4(mix(fragColor.rgb, hlineColor.rgb, hlineColor.a * dtoa(d)), 1.);
    
    // red v line
    vec4 vlineColor = vec4(0.8,0.,.2, 0.55);
	d = vline_d(uv, -1.40, 0.003);
	fragColor = vec4(mix(fragColor.rgb, vlineColor.rgb, vlineColor.a * dtoa(d)), 1.);

    
    // fractal worley crumpled paper effect
    float wsize = 0.8;
    const int iterationCount = 6;
    vec2 normal = vec2(0.);
    float influenceFactor = 1.0;
    for(int i = 0; i < iterationCount; ++ i)
    {
        vec3 w = worley(uv, wsize);
		normal.xy += influenceFactor * w.xy;
        wsize *= 0.5;
        influenceFactor *= 0.9;
    }
    
    // lighting
    vec3 lightPos = vec3(mouse, 8.);
    vec4 lightColor = vec4(vec3(0.99),0.6);
    vec4 ambientColor = vec4(vec3(0.99),0.5);
	fragColor = applyLighting(fragColor, uv, vec3(normal, 4.0), lightPos, lightColor, ambientColor);

    // white circles
    fragColor = drawHole(fragColor, uv, vec2(-1.6, 0.2));
	fragColor = drawHole(fragColor, uv, vec2(-1.6, -.7));
    
    // post effects
	fragColor.rgb *= vignetteAmt;
}
`;

export default class implements iSub {
  key(): string {
    return '4tj3DG';
  }
  name(): string {
    return 'Grid Paper (+mouse)';
  }
  sort() {
    return 142;
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
