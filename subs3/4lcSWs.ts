import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define time iTime
mat2 rot(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}

float segm(in vec2 p, in vec2 a, in vec2 b, in float nz, float id)
{
    vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 )+nz*0.017;
    float wave = textureLod( iChannel0, vec2(fract(h*.2+id*0.005),.75),-100. ).z;
    float vv = sin(time*0.0225)*0.1;
    return length( pa - wave*0.015*(h - 1.0) - ba*h )*wave*7.*wave;
}

float tri(in float x){return abs(fract(x)-.5);}
vec2 tri2(in vec2 p){return vec2(tri(p.x+tri(p.y*2.)),tri(p.y+tri(p.x*2.)));}
mat2 m2 = mat2( 0.970,  0.242, -0.242,  0.970 );

float triangleNoise(in vec2 p)
{
    float z=1.5;
    float z2=1.5;
	float rz = 0.;
    vec2 bp = p*0.8;
	for (float i=0.; i<=3.; i++ )
	{
        vec2 dg = tri2(bp*2.)*.5;
        dg *= rot(time*4.5);
        p += dg/z2;
        bp *= 1.5;
        z2 *= .6; 
		z *= 1.7;
		p *= 1.2;
        p*= m2;     
        rz+= (tri(p.x+tri(p.y)))/z;
	}
	return rz;
}

vec3 render(in vec2 p)
{    
    vec2 p1 = vec2(-1., 0.);
    vec3 col = vec3(0);
    float nz = clamp(triangleNoise(p),0.,1.);
    vec4 wave = textureLod( iChannel0, vec2(fract(p.x*.2),.75),-100. );
    p /= wave.w*1.+.5 + time*0.001;
    
    for(int i = 0; i < 100; i++)
    {
        p1 *= rot(0.05 + pow(time*2.25,1.5)*0.0007);
        vec2 p2 = p1*rot(0.04*float(i) - time*1.575 - wave.w*1.5);
        col += abs(sin(vec3(.6+sin(time*0.05)*0.4,1.5,2.0)+float(i)*0.011 + time*0.8))*0.0015/((pow(segm(p, p1, p2, nz, float(i)),1.2)));
    }
    
    col *= wave.w*1.;
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy*2.0-1.0;
    p.x *= iResolution.x/iResolution.y*.9;
    
	fragColor = vec4(render(p*0.75), 1.0);
}
`;

const f = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy/iResolution.xy;
    float fft  = texture( iChannel1, vec2(q.x,0.25) ).x;
	float nwave = texture( iChannel1, vec2(q.x,0.75) ).x;
    vec4 lData = texture( iChannel0, vec2(q.x,0.25) );
    
    float fwave = mix(nwave,lData.z, 0.5);

    float nfft = 0.;
    for (float i = 0.; i < 1.; i += 0.02)
    {
        nfft += texture( iChannel1, vec2(i,0.25) ).x; 
    }
    nfft = clamp(nfft/50.,0.,1.);
    
    float ffts = mix(nfft, lData.w, 0.);
    
    if (iFrame < 5) 
    {
        fft = 0.;
        fwave= .5;
        ffts = 0.;
    }
    
    fragColor = vec4(fft, 0, fwave, ffts);
}
`;

export default class implements iSub {
  key(): string {
    return '4lcSWs';
  }
  name(): string {
    return 'Filaments';
  }
  // sort() {
  //   return 0;
  // }
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
    return [
      // { type: 1, f, fi: 0 }, //
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
