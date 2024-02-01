import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec3 saturate(vec3 a){return clamp(a,0.,1.);}
float opS( float d2, float d1 ){return max(-d1,d2);}
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}
float rand(float n){
 	return fract(cos(n*89.42)*343.42);
}

float dtoa(float d, float amount)
{
    return clamp(1.0 / (clamp(d, 1.0/amount, 1.0)*amount), 0.,1.);
}
float sdColumn(vec2 uv, float xmin, float xmax)
{
	return max(xmin-uv.x, uv.x-xmax);
}
float sdAxisAlignedRect(vec2 uv, vec2 tl, vec2 br)
{
    vec2 d = max(tl-uv, uv-br);
    return length(max(vec2(0.0), d)) + min(0.0, max(d.x, d.y));
}

// 0-1 1-0
float smoothstep4(float e1, float e2, float e3, float e4, float val)
{
    return min(smoothstep(e1,e2,val), 1.-smoothstep(e3,e4,val));
}

const float left = 1.82;
const float right = 2.08;

vec3 texturize(vec2 uv, vec3 inpColor, float dist)
{
    float falloffY = 1.0 - smoothstep4(-0.5, 0.1, 0.4, 1., uv.y);
    float falloffX = (smoothstep(left, right, uv.x)) * 0.6;
    dist -= falloffX * pow(falloffY, 0.6) * 0.09;
    

    float amt = 13. + (max(falloffX, falloffY) * 600.);

    return mix(inpColor, vec3(0.), dtoa(dist, amt));
}

float map(vec2 uv)
{
    uv.x += rand(uv.y) * 0.006;// some distortion in x axis
    return sdColumn(uv, left, right);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord;
	uv = (uv / iResolution.y * 2.0) - 1.;
    uv.x += cos(uv.y* (uv.x+1.) * 3.) * 0.003;
    uv.y += cos(uv.x * 6.) * 0.00007;

    vec3 col = vec3(1.,1.,0.86);// bg
    
    // black stroke
    float dist = map(uv);
    col = texturize(uv, col, dist);// ok this is a stupid way to organize this effect. WIP.
    
    // red-orangeish square.
    dist = sdAxisAlignedRect(uv, vec2(-0.68), vec2(-0.55));
    float amt = 90. + (rand(uv.y) * 100.) + (rand(uv.x / 4.) * 90.);
    float vary = sin(uv.x*uv.y*50.)*0.0047;
    dist = opS(dist-0.028+vary, dist-0.019-vary);// round edges, and hollow it out
    col = mix(col, vec3(0.99,.4, 0.0), dtoa(dist, amt) * 0.7);
    col = mix(col, vec3(0.85,0.,0.), dtoa(dist, 700.));

    uv -= 1.0;// vignette
	float vignetteAmt = 1.-dot(uv*0.5,uv* 0.12);
    col *= vignetteAmt;
    
    // grain
    col.rgb += (rand(uv)-.5)*.07;
    col.rgb = saturate(col.rgb);

    
    fragColor = vec4(col, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'Xt2GWc';
  }
  name(): string {
    return 'Brush Smear';
  }
  sort() {
    return 141;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas({ width: '500px' });
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
