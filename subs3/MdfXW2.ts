import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//Music toolbox
//by nimitz (stormoid.com) (twitter: @stormoid)

/*
	Taking a different approach than sequencing all the notes one by one.
	Instead using a basic "sequencer" to create and combine/chain patterns
	this allows for a more tracker-like experience.

	The "sequencer" itself could be improved, a proper ADSR
	envelope comes to mind.

	Please let me know if you find stuff that can be fixed/improved.
	
	Also included are defines for the chromatic scale, a few simple
	waveforms/instruments with note and octave input, a few synths,
	some simple drums using the sequencer envelopes, 
	a 3 input arpeggiator and a very basic mix/pan function.
*/

//THE CODE HERE IS THE VISUALS ONLY, CLICK ON THE SOUND TAB TO SEE THE SOUND CODE

float noise( float x ){return fract(sin(1371.1*x)*43758.5453);}
float noise( in vec2 x ){return texture(iChannel0, x*.01).x;}
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}

#define PI 3.14159265358979323846
#define TAU PI*2.

#define C  32.703
#define CS 34.648
#define D  36.708
#define DS 38.891
#define E  41.203
#define F  43.654
#define FS 46.249
#define G  48.999
#define GS 51.913
#define A  55.0
#define AS 58.270
#define B  61.735

//-------------------------------------------------------------------
//----------------------Modulating/Sequencing------------------------
//-------------------------------------------------------------------

//3 input arpeggiator, with smoothing
float arp(float a, float b, float c, float t, float smoothv)
{	
	float ra = mix(0., a, smoothstep(0.333-smoothv, .333+smoothv, sin(t*TAU)));
	float rb = mix(0., b, smoothstep(0.333-smoothv, .333+smoothv, sin(t*TAU-.333*TAU)));
	float rc = mix(0., c, smoothstep(0.333-smoothv, .333+smoothv, sin(t*TAU-.666*TAU)));
	return ra+rb+rc;
}

//BPM define is only used by the sequencer
#define BPM 112.

/* Input:
	gate = how long the note is on [-1...1]
	smooth = symmetric attack/release smoothing (a real ADSR would be better)
	offset = time offset, [-1...1] 1 is one period
*/
float seq(float t, float gate, float smoothv, float ofst)
{
	return smoothstep( gate-smoothv, gate+smoothv,
                      cos( (t*PI*BPM/120.) - ofst*TAU - PI*0.5 + gate ) );
}

//same idea but with an AR envelope
float seqAR(float t, float gate, float atk, float rel, float ofst)
{
    float p = ((t*PI*BPM/120.)-ofst*TAU-PI*0.5+gate );
    float tp = fract(p/PI*.5);
    
    //The envelopes have to be scaled based on the gate length
    gate = clamp(gate,-1.,1.);
    float scl = (1.-abs(gate));
    atk *= scl;
    rel *= scl;
    
    //Attack envelope
	if (tp > 0.5)
		return smoothstep( gate-atk, gate+atk, cos(p));
    //Release envelope
	else
		return smoothstep( gate-rel, gate+rel, cos(p));
}

//-------------------------------------------------------------------
//---------------------------Instruments-----------------------------
//-------------------------------------------------------------------

//Basic waveforms with note and octave input
float sn(float t, float note, float octave)
{
	return sin(t*note*exp2(octave)*PI);
}

float saw(float t, float note, float octave)
{
	return fract(t*note*exp2(octave-1.))-0.5;
}

float tri(float t, float note, float octave)
{
	return (abs(fract(t*note*exp2(octave-1.))-0.5)*2.-0.5)*2.;
}

float sqr(float t, float note, float octave)
{
	return step(fract(t*note*exp2(octave-1.)), 0.5)-0.5;
}

//simple frequency modulation (3->1)
float fmsq(float t, float note, float octave)
{
	float fm = sn(t,note,octave-1.)*0.0008;
	float fm2 = sn(t,note,octave+1.)*0.0007;
	float fm3 = sn(t,note,octave+2.)*0.00055;
	return sqr(t+fm+fm2+fm3,note,octave);
}

//very fake filtered saw (not used)
float filterSaw(float t, float note, float octave, float cutoff, float q)
{
    float saw = fract(t*note*exp2(octave-1.))-0.5;
    float sn = cos((t*note*exp2(octave)*PI)+PI*0.5);
    float filt = smoothstep(cutoff-q,cutoff+q,abs(saw)*2.);
    return mix(saw,sn,filt);
}

//a slightly more complex intrument using the sequencer for harmonic envelopes
//freq is how often the note is triggered
float additive(float t, float note, float octave, float freq)
{
    float x = t*freq;
    float rz = 0.;
    float atk = 0.01;
    float rel = 1.;
    float h = 1.;
    float pw = 1.;
    float dcy = .0;
    
    for(int i=0;i<6;i++)
    {
        rz += sn(t*h, note, octave)*seqAR(x, dcy ,atk, rel, 0.)*pw;
        dcy += .1;
        pw  -= .1;
        h = float(i)+1.001;
    }
    rz = saw(rz*0.002,note,octave)*seqAR(x, .0 ,atk, rel, 0.);
    
    return rz;
}

//-------------------------------------------------------------------
//----------------------------Mixing---------------------------------
//-------------------------------------------------------------------

//Simple mixing function with balance control  (balance range 0..1)
vec2 mixb(float x, float bal)
{
	bal = clamp(bal,0.,1.);
	return vec2(x * bal, x*(1.-bal));
}

//-------------------------------------------------------------------
//-----------------------------Main----------------------------------
//-------------------------------------------------------------------
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord.xy / iResolution.xy*2.-1.;
	p.x *= iResolution.x/iResolution.y;
    float time = iTime-0.1;
    vec2 q = p;
    //shake on the kicks (idea shamelessly stolen from srtuss)
    float beat = seqAR(time*4.,.9,1.,1.,0.);
    beat *= seq(time/8., -.75, 0.01, 0.);
    p.x += (noise(time*80.)-0.5)*0.15*beat;
    p.y += (noise(time*50.)-0.5)*0.15*beat;
    p *= mm2((noise(time*1.)-0.5)*0.1*beat);
	float t = p.x*.005+time;
	
    vec2 bp = p;
    p = fract(p*.9)-0.5;
    p.y *= 1.5;
    float v = 0.;
    vec3 col = vec3(0.);
    if (bp.x< 0. && bp.y > 0.)
    {   
        //--------------first voice: pad---------------
		//the sequencer can be used to xfade
		v = fmsq(t,A,2.)*seq(time/4., 0.0, 0.9, 0./2.);
		v+= fmsq(t,A,3.)*seq(time/4., 0.0, 0.9, 1./2.)*0.75;
    	//two gate patterns and a mix between them
    	float seq1 = seqAR(time*16.,.25, .1,1., 0.25);
    	float seq2 = seqAR(time*8., .0, .001,1., 0.25);
		v *= mix(seq1, seq2, seq(time,0.,2.,0.));
        
        float rz = smoothstep(0.,.1,abs(p.y*2.+v));
    	col = vec3(0.12,0.075,0.35)*-log(rz+0.01);
    }
    else if (bp.x< 0.)
    {
        //-------------second voice: drums--------------
    	//the AR envelope version of the sequencer can be used for basic "drums"
    
    	//kick: low frequency sin with sharp attack and slow release
    	//in this care i'm also modulating the frequency for extra oomph
    	float frq = seqAR(time*4.,.9,1.,1.,0.)*0.05;
    	v = sn(t+frq,A,1.)*seqAR(time*4.,.9,.005,1.,0.);
    	//break
    	v *= seq(time/8., -.75, 0.01, 0.);
    	//closed hihat is pretty much the same but noise instead of a sine
    	v += noise(t)*seqAR(time*8.,0.99,.0001,70.,0.)*0.5;
        
        float rz = smoothstep(0.,.1,abs(p.y*2.+v));
    	col = vec3(0.1,0.35,0.05)*-log(rz+0.01);    
    }
    else if (bp.y > 0.)
    {
        //----------third voice: chord-------------
        v += additive(t, A, 4., 8.);
        v += additive(t, C, 4., 8.);
        v += additive(t, E, 4., 8.);
        v *= seq(t/2.,7./8.,0.5,0.);
        
        float rz = smoothstep(0.,.15,abs(p.y*3.+v));
   		col = vec3(0.3,0.03,0.19)*-log(rz+0.01);
    }
	else
    {
    	//---------fourth vbice: arp melody-------------
        //Using this as a demo of the versatility of the sequencer

        //some base notes for the arp
        float nG = sqr(t,G,4.);
        float nA = saw(t,A,4.);
        float nB = sqr(t,B,4.);
        float nC = saw(t,C,5.);
        float nD = sqr(t,D,5.);
        float nE = sqr(t,E,5.);

        //some arp chords
        float arpspeed = t*16.;
        float arpgate = 0.5;
        float ACE = arp(nA,nC,nE, arpspeed, arpgate);
        float ABE = arp(nA,nB,nE, arpspeed, arpgate);
        float GCE = arp(nG,nC,nE, arpspeed, arpgate);
        float GBE = arp(nG,nB,nE, arpspeed, arpgate);
        float GBD = arp(nG,nB,nD, arpspeed, arpgate);

        //some patterns with those chords
        float t12 = t/2.;
        const float gat = 0.7;
        const float sm = 0.05;
        float pat1 = 0., pat2 = 0.;
        pat1 += ACE*seq(t12, gat, sm, 0./4.);
        pat1 += GBE*seq(t12, gat, sm, 2./4.);
        pat1 += GBD*seq(t12, gat, sm, 3./4.);
        pat2 = pat1; //only the second chord changes
        pat1 += GCE*seq(t12, gat, sm, 1./4.);
        pat2 += ABE*seq(t12, gat, sm, 1./4.);

        //use the sequencer again to chain patterns
        float chn= 0.;
        chn += pat1*seq(t/4., 0., 0.1, 0./2.);
        chn += pat2*seq(t/4., 0., 0.1, 1./2.);

        //use the sequencer once more to gate the channel
        float gt1 = chn*seq(t*8., -0.4, .5, 0.);
        float gt2 = chn*seq(t*24.,-0.9, 0.3, 0.);
        //a more complex gate sequence
        float gt3 = 0.;
        float t2 = t*2.;
        gt3 += chn*seq(t2, 0.9, 0.05, 0./8.);
        gt3 += chn*seq(t2, 0.9, 0.05, 2./8.);
        gt3 += chn*seq(t2, 0.9, 0.05, 3./8.);
        gt3 += chn*seq(t2, 0.9, 0.05, 5./8.);
        gt3 += chn*seq(t2, 0.9, 0.05, 6./8.);

        //use the sequencer once more to chain the gated sequences
        v += gt1*seq(t/8., 0.72, 0.05, 1./2.);
        v += gt2*seq(t/8., 0.72, 0.05, 0./2.);
        v += gt3*seq(t/4.,-0.05 ,0.05, 1./2.);
        
        float rz = smoothstep(0.,.15,abs(p.y*3.+v));
    	col = vec3(0.17,0.075,0.35)*-log(rz+0.01);
    }
    
    //separators
    p = bp;
	col = max(col,vec3(.3,0.,1.)*(1.-abs((p.x)*100.)));
	col = max(col,vec3(1.,0.,.5)*(1.-abs((p.y)*100.)));
    
    //post (grain)
    col *= 1.-.4*texture(iChannel0,q*0.12+time*0.05).rgb;
    
    //background
    bp *= mm2(time*.3);
	bp.x *= 22.;
	float rz = noise(bp+time*3.);
	rz *= sin(bp.x*.9)*0.05+0.15;
	vec3 col2 = rz*vec3(5.+p.y*10.*(bp.x*1.), 0., 60.)*.15;
    col = col2*(smoothstep(0.,.5,rz))+col;
    
    col *= 1.-beat*0.5;
    
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdfXW2';
  }
  name(): string {
    return 'Music toolbox';
  }
  sort() {
    return 319;
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
