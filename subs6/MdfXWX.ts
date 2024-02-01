import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const sound = `
#define PI2 6.28318530718
#define RES 0.02
#define trunc(a) float(int(a))

float n2f(float note)
{
   return 55.0*pow(2.0,(note-3.0)/12.); 
}

vec2 bass(float time, float tt, float note)
{
    if (tt<0.0)
      return vec2(0.0);

    float freqTime = 6.2831*time*n2f(note);
    
    return vec2(( sin(     freqTime
                      +sin(freqTime)*7.0*exp(-2.0*tt)
                     )+
                  sin(     freqTime*2.0
                      +cos(freqTime*2.0)*1.0*sin(time*3.14)
                      +sin(freqTime*8.0)*0.25*sin(1.0+time*3.14)
                    )*exp(-2.0*tt)+
                  cos(     freqTime*4.0
                      +cos(freqTime*2.0)*3.0*sin(time*3.14+0.3)
                    )*exp(-2.0*tt)
                )
                
                *exp(-1.0*tt) );
}

vec2 duhduh(float time, float tt)
{
   float bn = 0.0;
   tt = mod(tt,48.0);
   if (tt>=16.0)
      if (tt>=40.0)
         bn -= 5.0;
      else
         if (mod(tt,8.0)>=4.0)
            bn -= 5.0;
       
   tt = mod(tt,8.0);
   if (tt <4.0)
     tt = mod(tt,2.0);
   else
     tt = mod(tt,4.0);
   return bass(time,tt-3.0,bn+3.)+
          bass(time,tt-2.0,bn+3.)+
          bass(time,tt-1.0,bn+0.)+
          bass(time,tt-0.0,bn+0.);
}

vec2 duhduh2(float time, float tt)
{
   float bn = 0.0;
   tt = mod(tt,48.0);
   if (tt>=16.0)
      if (tt>=40.0)
         bn -= 5.0;
      else
         if (mod(tt,8.0)>=4.0)
            bn -= 5.0;
       
   int ti = int(mod(tt,8.0)/2.0);
   tt = mod(tt,2.0);
   if (ti == 0)
     return bass(time,tt-0.83,bn+12.0)+
            bass(time,tt-0.50,bn+12.0)+
            bass(time,tt-0.17,bn+12.0);
    
   if (ti == 3)
     return bass(time,tt-0.66,bn+15.)+
            bass(time,tt-0.0,bn+15.);
    
   return bass(time,tt-0.66,bn+12.)+
          bass(time,tt-0.0,bn+12.);
}

float note(float nr)
{
    if (nr<=15.)  return -120.;
    if (nr<=16.)  return 31.;
    if (nr<=17.)  return 56.;
    
    if (nr<=22.)  return 55.;
    if (nr<=23.)  return -120.;
    
    if (nr<=24.)  return 58.;
    if (nr<=25.)  return 42.;
    if (nr<=30.)  return 43.;
    
    if (nr<=33.)  return -120.;
    
    if (nr<=34.5)  return 43.;
    if (nr<=35.5)  return 39.;
    if (nr<=37.0)  return 31.;
    if (nr<=39.0)  return 34.;
    if (nr<=39.5)  return 32.;
    if (nr<=40.5)  return 31.;
    if (nr<=41.0)  return -120.;
    if (nr<=42.5)  return 31.;
    if (nr<=43.0)  return 44.;
    if (nr<=46.0)  return 43.;
    
    return -120.0;
}

float getSample(float time, float tt, float FM)
{
    tt -= mod(tt,RES);

    float note1 = note(tt);
    float note2 = note(tt+0.5);
    if (note1 <0.0)
        return 0.0;
    
    float stepper = smoothstep(0.1,0.5,mod(tt,0.5));
    
    float note = mix(note1,note2,stepper);
    
    float angle = PI2*n2f(note)*time;
    return sin(angle+FM*sin(angle*2.033));
}

vec2 theramin(float time, float tt)
{
    tt = mod(tt,48.0);
    tt += 1.33;
    float FM = 0.0;
    if (tt>=32.)
        FM = PI2/2.;
        
    float ssample;
    float ta = mod(tt-RES/2.0,RES)-RES/2.0;
    float halfSin = RES/4.0;//4.0/frequency;
    if (abs(ta)<halfSin)
    {
        float sample1 = getSample(time,tt-RES/2.0,FM);
        float sample2 = getSample(time,tt+RES/2.0,FM);
        ssample = mix(sample1,sample2,smoothstep(-halfSin,halfSin,ta));
    }
    else
        ssample = getSample(time,tt,FM);
    
    return vec2( ssample);
}

vec2 mainSound( in int samp,float time)
{
    float tt = time *2.4;
    
    float d1 = clamp(duhduh(time,tt).x,-0.8,0.8)*1.3+
               clamp(duhduh(time,tt-0.33).x,-0.5,0.5)*1.4+
               clamp(duhduh(time,tt-0.66).x,-0.3,0.3)*2.0;
    
    float d2 = clamp(duhduh2(time,tt).x,-0.8,0.8)*.3+
               clamp(duhduh2(time,tt-0.33).x,-0.8,0.8)*.2+
               clamp(duhduh2(time,tt-0.66).x,-0.8,0.8)*.1;
    
    return 0.2*vec2(d1+0.5*d2,d2+0.5*d1)
          +0.3*(
            theramin(time,tt-0.75)*vec2(0.2,0.4)
           +theramin(time,tt)*vec2(0.6,0.4)
           +theramin(time,tt-0.506)*vec2(0.4,0.2)
           +theramin(time,tt-1.00)*vec2(0.1,0.2));
}`;

const fragment = `
#define PI2 6.28318530718
#define RES 0.02
#define trunc(a) float(int(a))

float n2f(float note)
{
   return 55.0*pow(2.0,(note-3.0)/12.); 
}

float note(float nr)
{
    if (nr<=15.)  return -1.;
    if (nr<=16.)  return 31.;
    if (nr<=17.)  return 56.;
    
    if (nr<=22.)  return 55.;
    if (nr<=23.)  return -1.;
    
    if (nr<=24.)  return 58.;
    if (nr<=25.)  return 42.;
    if (nr<=30.)  return 43.;
    
    if (nr<=33.)  return -1.;
    
    if (nr<=34.5)  return 43.;
    if (nr<=35.5)  return 39.;
    if (nr<=37.0)  return 31.;
    if (nr<=39.0)  return 34.;
    if (nr<=39.5)  return 32.;
    if (nr<=40.5)  return 31.;
    if (nr<=41.0)  return -1.;
    if (nr<=42.5)  return 31.;
    if (nr<=43.0)  return 44.;
    if (nr<=46.0)  return 43.;
    
    return -1.0;
}

vec2 getSample(float time, float tt, float FM)
{
    tt -= mod(tt,RES);

    float note1 = note(tt);
    float note2 = note(tt+0.5);
    if (note1 <0.0)
        return vec2(0.0,50.0);
    
    float stepper = smoothstep(0.2,0.4,mod(tt,0.5));
    
    float note = mix(note1,note2,stepper);
    
    float f = n2f(note);
    float angle = PI2*f*time;
    return vec2(sin(angle+FM*sin(angle*2.)),f);
}

vec3 theramin(float time, float tt)
{
    tt = mod(tt,48.0);
    tt += 1.33;
    float FM = 0.0;
    if (tt>=32.)
        FM = PI2/2.;
        
    float ssample;
    float col = 0.0;
    float ta = mod(tt-RES/2.0,RES)-RES/2.0;
    float halfSin = RES/4.0;//4.0/frequency;
    if (abs(ta)<halfSin)
    {
        float sample1 = getSample(time,tt-RES/2.0,FM).x;
        float sample2 = getSample(time,tt+RES/2.0,FM).x;
        ssample = mix(sample1,sample2,smoothstep(-halfSin,halfSin,ta));
        if (sample1!=sample2)
          col = 1.0;
    }
    else
        ssample = getSample(time,tt,FM).x;
    
    return vec3( ssample,col,  getSample(time,tt,FM).y);
}

vec3 DoSound(float time)
{
    float tt = time *2.4;
    return theramin(time,tt);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    uv -= 0.5;
    
    float freq = DoSound(iTime-0.0125).z;
        
    float timePos = iTime-mod(iTime,1./freq*1.0033)-0.0125+uv.x/45.0;
    if (iMouse.z>0.0)
      timePos = uv.x*0.01*iMouse.y/100.0+5.5+iMouse.x/250.0;
    
    vec3 snd = DoSound(timePos)*0.4;;
    
    vec3 color = 1.0-vec3(smoothstep(0.004,0.06,distance(vec2(uv.x,snd.x),uv))); 
    color.b = snd.y;
	fragColor = vec4(color,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdfXWX';
  }
  name(): string {
    return 'Who?';
  }
  sort() {
    return 601;
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
