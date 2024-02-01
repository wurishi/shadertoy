import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define TAU (2.*3.1415926)
#define SawOsc(f,m) (2.*fract((f)*t+(m)/TAU)-1.)
//#define TriOsc(f,m) TODO
#define SinOsc(f,m) sin(TAU*(f)*t+m)


float formantSin(float phase, float form)
{
    // Inspired by the wavetable "formant" option
    // in software synthesizer Surge (super cool freeware synth!)
    phase = fract(phase);
    phase = min(phase*form, 1.);
    return sin(TAU*phase);
}

vec2 mainSound( int samp, float time )
{
    float t = time;
    
    if(mod(t, 10.) > 7.)
        // Phase modulation synthesis using sawtooth waves
        return SawOsc(vec2(440.,441.6), SawOsc(-219., 0.)+SinOsc(5.,0.)) * vec2(0.1);
    
    
    vec2 v = vec2(0);
    
    vec2 formant = vec2(0.) + exp(3.*(0.5+0.5*sin(0.5*time)));
    //vec2 formant = vec2(time);
    v.x += formantSin(110.*time, formant.x) * 0.15;
    v.y += formantSin(111.*time, formant.y) * 0.15;
    return v;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord*2.-iResolution.xy)/iResolution.y;
	float dx = 1./iResolution.y;
    
    // Plot mainSound() function
    float x1 = uv.x - dx;
    float x2 = uv.x + dx;
    float y = uv.y;
    // float time = round(iTime*55.)/55.;
    float time = iTime;
    float scale = 3.;
    float scalex = 100.;
    float fx1 = mainSound(0, x1/scalex + time).x * scale;
    float fx2 = mainSound(0, x2/scalex + time).x * scale;
    float alpha = (fx2-fx1)/(2.*dx),
          beta  = (fx2+fx1)/(2.*dx);
    float d = abs(beta*dx - y)/length(vec2(1., alpha));
    
    vec3 col = vec3(0.);
    col = mix(col, vec3(1), smoothstep(3./iResolution.y,0.,d));

    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'WlycRW';
  }
  name(): string {
    return 'Synthesis ideas';
  }
  sort() {
    return 22;
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
