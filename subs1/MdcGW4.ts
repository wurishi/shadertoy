import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// initial inspiration:
// http://static1.squarespace.com/static/53c9cdf3e4b0669c8d19e691/53ffa2f8e4b048b8b84fef6f/53ffa473e4b0f2e23aea116f/1409262727455/MagnetoLayer+2013-06-14-00-13-54-324.gif?format=500w
    
const float bandSpacing = .05;
const float lineSize = 0.008;
const float segmentLength = .3;
#define WARP



float rand(float n){
    return fract(cos(n*89.42)*343.42);
}
float roundx(float x, float p)
{
    return floor((x+(p*.5))/p)*p;
}
float dtoa(float d, float amount)
{
    return clamp(1./(clamp(d,1./amount,1.)*amount),0.,1.);
}
float sdSegment1D(float uv, float a, float b)
{
	return max(max(a - uv, 0.), uv - b);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy - .5;
    uv.x*=iResolution.x/iResolution.y;
    
    #ifdef WARP
    // warp the hell out of the uv coords
    vec2 oldUV = uv;
    uv = pow(abs(uv), sin(iDate.w*vec2(.2,.7))*.35+1.2)*sign(oldUV);
    #endif

    float bandRadius = roundx(length(uv),bandSpacing);
    vec3 bandID = vec3(rand(bandRadius),rand(bandRadius+1.),rand(bandRadius+2.));

    float distToLine = sdSegment1D(length(uv), bandRadius-(lineSize*.5), bandRadius+(lineSize*.5));
    float bandA = dtoa(distToLine, 400.);// alpha around this band.
    
    float bandSpeed = .1/max(0.05,bandRadius);// outside = slower
    float r = -3.*iDate.w+bandID.x *6.28;
    r *= bandSpeed;
    uv *= mat2(cos(r),sin(r),-sin(r),cos(r));

    float angle = mod(atan(uv.x,uv.y),6.28);// angle, animated
    float arcLength = bandRadius * angle;
    
    float color = sign(mod(arcLength, segmentLength*2.)-segmentLength);

    fragColor = vec4(vec3(bandID * color * bandA),1);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdcGW4';
  }
  name(): string {
    return 'Neon Hypno Bands';
  }
  sort() {
    return 154;
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
