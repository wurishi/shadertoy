import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const sound = `
// [SIG15] Oblivion [sound code]
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// The sound includes a vocoded 'aaah' and "Tech 4-9, Jack Harper" with formants collected straight from the film.
// Speech coefficients created using Wavesurfer:
// http://sourceforge.net/projects/wavesurfer/


#define TWO_PI 			6.2831
#define MOD2 vec2(.16632,.17369)
#define MOD3 vec3(.16532,.17369,.15787)
#define PLAY_PHRASES

#define cueINCLOUDS 0.0
#define cueFLYIN 14.0
#define cueFRONTOF cueFLYIN + 10.0
#define cueTHREAT cueFRONTOF + 5.
#define cueFLYOFF cueTHREAT + 19.0

float n1 = 0.0;
float n2 = 0.0;
float fb_lp = 0.0;
float lfb_lp = 0.0;
float hp = 0.0;
float p4=1.0e-24;
vec3 drone;
float gTime;
float speed, height;

#define TAU  6.28318530718
#define NT(a, b, c) if(t > a){x = a; n = b; ty = c;}
#define P(a, b, c, d, e, f) if(t >= sec){x = sec; pit = ivec2(a, b), form = ivec4(c, d, e, f);} if(t+step >= sec){pit2 = ivec2(a, b),  form2 = ivec4(c, d, e, f);} sec+=step;


#define N(a, b) if(t > a){x = a; n = b;}

//----------------------------------------------------------------------------------------
//  1 out, 1 in ...
float hash11(float p)
{
	vec2 p2 = fract(vec2(p) * MOD2);
    p2 += dot(p2.yx, p2.xy+19.19);
	return fract(p2.x * p2.y);
}

//----------------------------------------------------------------------------------
float tract(float x, float f, float bandwidth)
{
    float ret = sin(TAU * f * x) * exp(-bandwidth * 3.14159265359 * x);
    return ret;
}

//----------------------------------------------------------------------------------
float noise11(float x)
{
    float p = floor(x);
    float f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix( hash11(p), hash11(p + 1.0), f)-.5;
}

//----------------------------------------------------------------------------------
float Fricative(float x, float f)
{
    float ret = hash11(floor(f * x)*20.0)-.5;
	return ret*3.0;
}


//----------------------------------------------------------------------------------
float noteMIDI(float n)
{
	return 440.0 * pow(2.0, (n - 69.0) / 12.0);
}

//----------------------------------------------------------------------------------
float saw( float x, float a)
{
    float f = fract( x );
	return (clamp(f/a,0.0,1.0)-clamp((f-a)/(1.0-a),0.0,1.0))*2.0-.5;
}

//----------------------------------------------------------------------------------
float sqr(float t)
{
	return step(fract(t), 0.5)-0.5;
}

//----------------------------------------------------------------------------------
float tri(float t)
{
	return (abs(fract(t)-0.5)*2.-0.5)*2.;
}

//----------------------------------------------------------------------------------
float sine(float t)
{
	return sin(t* 3.141*2.0);
}

//----------------------------------------------------------------------------------------
float softBeep(float t)
{
	float n = 0.0;
    float x = 0.0;
    float ty = 0.0;
 
    //NT(cueFRONTOF-4.0, 61., .2);
    NT(cueFRONTOF-4.0,56., .5);
    
    NT(cueFRONTOF+.7, 56., .4);
    NT(cueFRONTOF+1., 61., .5);
    
    float asr = cueFLYOFF-.9;
    NT(asr+.7, 69.0, .5);

    n = noteMIDI(n);
    
    x = t-x;
    
	float aud = 0.0;
      
    float vol = smoothstep(.0, .05, x) * smoothstep(1.0, .8, x/ty);
    aud += sine(x*n*2.0+t)*sine(x*n*.9+t)*smoothstep(0.0, .04, t)*vol*.3;
    aud = clamp(aud*.9,-1., 1.);

    return aud;
}

//----------------------------------------------------------------------------------------
float beeDoop(float t)
{
	float n = 0.0;
    float x = 0.0;
    float ty = 0.0;
    
    NT(cueTHREAT-1.0, 63.0, .14);
    NT(cueTHREAT-1.0+.14, 51.0, .55);

    NT(cueTHREAT+3.2, 63.0, .14);
    NT(cueTHREAT+3.2+.14, 51.0, .55);

    n = noteMIDI(n);
    
    x = t-x;
    
	float aud = 0.0;
    float vol = smoothstep(.0, .01, x) * smoothstep(1.0, .7, x/ty);
    aud = tri(x*n*4.0) * tri(x*n*.5) * sine(x*n*2.)*vol;
    aud += sine(x*n*2.0+t)*smoothstep(0.0, .04, t)*vol*.3;
    aud = clamp(aud*.7,-1., 1.);

    return aud;
}

 //----------------------------------------------------------------------------------------
// Speech Processing Based on a Sinusoidal Model
// For the vocal part I analylised a sample from the film and extracted
// the vocal formants, which of course turned out to be an 'aaaah!' :)
// https://www.ll.mit.edu/publications/journal/pdf/vol01_no2/1.2.3.speechprocessing.pdf
float aaaah(float t)
{
	float n = 0.0;
    float x = 0.0;
    float ty = 0.0;
    //t=  mod(t, 2.0)+cueTHREAT;
    NT(cueTHREAT, 52., 1.1);
    NT(cueFLYOFF+2.0, 52., 3.1);
    
    n = noteMIDI(n);
    x = t-x;
    float vol= smoothstep(.0, .03, x) * smoothstep(1.0, .9, x/ty)*.5;
    float pit = smoothstep(.0, .8, x) * smoothstep(1.0, .9, x/ty);
    float formSlide = (smoothstep(.3, .0, x) + smoothstep(.8, 1., x/ty)) * 100.0;
    pit = pow(pit,.1);
    pit = (1.0-pit*.001)/n;
    
    t += noise11(x*7.+45.0)*.0008; // ...Add a bit of random flutter to humanise it.

    // Build the vocal tract with sine waves...
    x = mod(t, pit);
	float aud =	tract(x, 710.0-formSlide, 70.0) *.5 +
       			tract(x, 1000.0+formSlide, 90.0)  * .6 +
	       		tract(x, 2450.0+formSlide, 140.0) * .4;
   	    
    aud = clamp(aud * vol, -1.0, 1.0);
    return aud;
}
float tech49(float t)
{
    //t = mod(t, 7.0)+ cueTHREAT+4.5; // ...test
    float step = .013;
    float vol = .45;
    float adjust = 1.0;
    float sec = cueTHREAT+4.5;
    if (t > cueTHREAT+6.5 && t < cueTHREAT+13.5)
    {
        t-=3.0;
        vol = .7;
        step = 0.023;
        adjust = 1.18;
    }
    
    ivec4 form = ivec4(271,2104,3152,4600), form2 = form;
    ivec2 pit = ivec2(0	,0), pit2 = pit;
    float x = .0;

	// Pitch, intensity and formants for...
    // "Tech 4-9, Jack Harper"
    // Uses the output from free software called WaveSurfer:-
    // http://sourceforge.net/projects/wavesurfer/
    
    // It's still a little rough between the frames, but it's getting there.
    
    // I had to hand edit some of these bastards!...
   
    // Pitch or fricative(0) , gain, f1, f2, f3, f4
    P(0	,42,	271,	2104,	3152,	4600);
    P(0	,30,	515,	1568,	2589,	3820);
    P(0	,20,	650,	1955,	2644,	3900);
    P(154	,40	,650    ,1663,	 2644	,3900);
    P(164	,46	,557	,1663	,2540	,3532);
    P(178	,44	,576	,1641	,2465	,3399);
    P(179	,53	,604	,1677	,2439	,3368);
    P(180	,58	,610	,1751	,2352	,3272);
    P(181	,57	,594	,1805	,2327	,3211);
    P(183	,58	,573	,1847	,2267	,3195);
    P(186	,59	,554	,1594	,1999	,3120);
    P(186	,57	,534	,1611	,1981	,3097);
    P(185	,58	,512	,1762	,1902	,3205);
    P(184	,56	,429	,1848	,2489	,4087);
    P(0	,12	,350,1600,1900,3900	 );
    P(0	,40	,350,1600,1900,3900	 );
    P(0	,30	,300,1950,2800,4400	 );
    P(0	,23	,300,1950,2800,4400		 );
    P(0	,17	,300,1950,2800,4400		 );
    P(0	,0	,755	,1825	,2511	,4083	 );
    P(0	,0	,440	,1811	,2529	,4099	 );
    P(0	,17	,287	,1223	,2455	,3977	 );
    P(0	,28	,280	,1259	,2338	,3707	 );
    P(0	,32	,281	,1288	,2345	,3719	 );
    P(0	,34	,281, 1294, 2361,4166	 );
    P(0	,35	,281, 1294, 2361,4166	 );
    P(0	,45	,281, 1294, 2361,4166	 );
    P(207	,42	,487	,934	,1791	,3100);
    P(214	,48	,489	,993	,1858	,3159);
    P(220	,55	,489	,1005	,1925	,3233);
    P(221	,58	,487	,1014	,1942	,3252);
    P(220	,57	,483	,1038	,1950	,3234);
    P(224	,56	,486	,1057	,1985	,3227);
    P(223	,56	,491	,1058	,1996	,3205);
    P(222	,56	,494	,1078	,2007	,3101);
    P(222	,56	,495	,1320	,2480	,3186);
    P(220	,56	,481	,1523	,2554	,3497);
    P(221	,55	,464	,1539	,2580	,3525);
    P(221	,55	,460	,1547	,2629	,3550);
    P(220	,50	,463	,1562	,2551	,3523);
    P(219	,37	,474	,1573	,2494	,3562);
    P(219	,35	,501	,1604	,2513	,3596);
    P(219	,40	,555	,1650	,2501	,3624);
    P(226	,45	,625	,1598	,2486	,3676);
    P(226	,57	,655	,1562	,2462	,3752);
    P(227	,57	,667	,1552	,2410	,3852);
    P(227	,58	,674	,1552	,2390	,3900);
    P(225	,57	,679	,1549	,2402	,3900);
    P(225	,58	,681	,1537	,2425	,3877);
    P(227	,57	,677	,1513	,2448	,3850);
    P(227	,56	,667	,1504	,2410	,3823);
    P(229	,58	,659	,1536	,2346	,3766);
    P(229	,58	,640	,1604	,2318	,3611);
    P(231	,57	,589	,1791	,2333	,3433);
    P(229	,55	,518	,1852	,2396	,4156);
    P(229	,57	,468	,1907	,2497	,4151);
    P(227	,56	,440	,1973	,2564	,4113);
    P(221	,54	,423	,1970	,2576	,4053);
    P(178	,54	,400	,1857	,2517	,4033);
    P(205	,44	,425	,1690	,2231	,3986);
    P(175	,32	,418	,1566	,2124	,3959);
    P(172	,38	,384	,1569	,2307	,3983);
    P(165	,47	,455	,1783	,2630	,3942);
    P(0,    0, 0, 0, 0, 0);
    P(0,    0, 0, 0, 0, 0);
    P(0,    0, 0, 0, 0, 0);
    P(0,    0, 0, 0, 0, 0);

    P(0,    0, 0, 0, 0, 0);
    P(0,    20,480	,1840	,2697	,3859);
    P(177,  40,	174,1914,3509,3900);
    P(0	,   34,	174,1914,3509,3900);
    P(0	,	25,	174,	1914,	2609,3900);
    P(0	,	 10	,405	,1843	,2603	,3851);
    P(177	,46	,445	,1807	,2487	,2996);
    P(200	,47	,472	,1780	,2465	,3037);
    P(219	,48	,509	,1755	,2454	,3096);
    P(227	,54	,614	,1746	,2435	,3143);
    P(227	,56	,658	,1747	,2421	,3163);
    P(220	,53	,661	,1747	,2409	,3153);
    P(222	,53	,662	,1732	,2365	,3132);
    P(220	,57	,662	,1730	,2426	,3162);
    P(219	,59	,659	,1739	,2506	,3271);
    P(217	,59	,652	,1732	,2440	,3288);
    P(216	,58	,635	,1728	,2347	,3236);
    P(215	,57	,609	,1748	,2277	,3221);
    P(209	,57	,585	,1798	,2202	,3301);
    P(205	,57	,547	,1860	,2126	,3292);
    P(200	,56	,367	,1952	,3296	,4100);
    P(178	,44	,282	,1943	,3417	,4117);
    P(0	,03	,322	,1959	,2548	,4132	 );
    P(0	,27	,409	,1826	,2560	,4125	 );
    P(0	,0	,331,1761,2488,3921	 );
    P(0	,0	,331,1761,2488,3921	 );
    P(0	,30	,331,1761,2488,3921	 );
    P(0	,38	,331,1761,2488,3921	 );
    P(0	,40	,331,1761,2488,3921	 );
    P(189	,35	,600	,1300	,2020	,3912);
    P(193	,44	,621	,1290	,2070	,3972);
    P(201	,50	,636	,1203	,2070	,4011);
    P(208	,53	,643	,1097	,2004	,4119);
    P(217	,54	,644	,1084	,1987	,4227);
    P(220	,55	,642	,1095	,2109	,4224);
    P(217	,57	,642	,1115	,2067	,4193);
    P(215	,54	,643	,1120	,1923	,4078);
    P(214	,54	,647	,1138	,1842	,3808);
    P(216	,56	,650	,1169	,1801	,3762);
    P(218	,56	,652	,1237	,1790	,3768);
    P(220	,55	,648	,1275	,1784	,3763);
    P(223	,53	,621	,1256	,1763	,3629);
    P(225	,50	,533	,1123	,1636	,3516);
    P(222	,52	,386	,1006	,1563	,3361);
    P(192	,48	,255	,1203	,2528	,3211);
    P(183	,35	,304	,1151	,2209	,3086);
    P(156	,29	,303	,841	,1900	,2698);
    P(154	,7	,260	,895	,1884	,2635);
    P(168	,8	,217	,957	,2642	,3825);
    P(0  	,38	,254	,980	,1873	,2688);
    P(148	,28	,338	,1142	,1659	,3780);
    P(143	,26	,436	,1171	,1594	,3789);
    P(179	,25	,464	,1191	,1585	,3822);
    P(162	,31	,465	,1211	,1574	,3756);
    P(231	,44	,462	,1235	,1567	,3678);
    P(229	,53	,461	,1252	,1557	,3670);
    P(229	,53	,461	,1252	,1557	,3670);
    P(226	,52	,459	,1273	,1548	,3658);
    P(224	,57	,468	,1300	,1597	,3665);
    P(222	,56	,492	,1317	,1605	,3715);
    P(217	,52	,492	,1342	,1587	,3734);
    P(209	,49	,444	,1424	,1612	,3770);
    P(198	,46	,399	,1463	,1755	,2960);
    P(179	,38	,303	,1423	,1831	,2912);
    P(0,    0, 0, 0, 0, 0);
    P(0,    0, 0, 0, 0, 0);

    x = t - x;
    float sm = clamp(x/step, 0.0,1.0);

  
    float aud = 0.0;
    float fric = 0.0;
    float intensity = pow(8.0, float(pit.y)/19.0) * .001;
    float intensity2 = pow(8.0, float(pit2.y)/19.0) * .001;
    
    intensity = mix(intensity, intensity2, sm);
    vec4 formants  = mix(vec4(form), vec4(form2), sm);
    
    if (pit.x > 0)
    {

  		float p = 1.0/(float(pit.x)*adjust);
        if (pit2.x > 0)
        {
	       	float p2 = 1.0/(float(pit2.x)*adjust);
            p = max(mix(p, p2, sm), 0.);
        }

        float a = mod(x, p); 
		aud =	tract(a, formants.x, 70.0) +
      			tract(a, formants.y, 90.0)  * .7 +
	       		tract(a, formants.z, 140.0) * .6 + 
        		tract(a, formants.w, 210.0) * .4;
        aud *= intensity;
    }
    else
    {
         vec4 formants  = vec4(form);
         fric += Fricative(t, formants.x) +
      			Fricative(t, formants.y) +
       			Fricative(t, formants.z)*1.8;
        aud = fric*intensity*.25;
    }
  

	aud = clamp(aud*vol, -1.0, 1.0);
    
    return aud;

}


//----------------------------------------------------------------------------------------
float beepPong(float t)
{
	float n = 0.0, x = 0.0, ty = 0.0;
    float asr = cueFLYOFF-4.;
    //t = mod(t, 3.0) + cueFLYOFF-3.5;
    NT(asr, 93.0, .2);
    NT(asr+0.1, 69.0, .3);
    NT(asr+.3, 81.0, .55);
    n = noteMIDI(n);
    x = t-x;
	float aud = 0.0;
    asr = min((t-asr)*18.0, 1.0);
    float vol = smoothstep(.0, .002, x) * smoothstep(1.0, .1, x/ty)*asr;
    aud = sine(x*n)*vol;
   	aud += sine(x*n*.99+t)*smoothstep(0.0, .04, t)*vol*.3;
    aud = clamp(aud*.3,-1., 1.);

    return aud;//(1.5 * aud - 0.5 * aud * aud * aud);
}

//----------------------------------------------------------------------------------------
float boom(float t)
{
	float n = 0.0, x = 0.0, ty = 0.0;
    //t = mod(t, 2.)+cueFLYOFF-.9;
    float asr = cueFLYOFF-.9;

    NT(asr+0.3, 33.0, .1);
    NT(asr+.6, 29.0, .1);
    NT(asr+.9, 26.0, .2);
    
    n = noteMIDI(n);
    x = t-x;
    
	float aud = 0.0;
    float vol = smoothstep(.0, .002, x) * smoothstep(1.0, .9, x/ty);
    n-=x*50.0;
    aud = tri(x*n);
    aud += tri(x*n*2.0);
    aud = clamp(aud*vol,-1., 1.);

    return (1.5 * aud - 0.5 * aud * aud * aud)*.7;
}

//----------------------------------------------------------------------------------------
float scanner(float t)
{
    float n = noteMIDI(21.0);
     float   scannerOn = smoothstep(cueTHREAT+4.0,cueTHREAT+4.2, t)* smoothstep(cueTHREAT+11.5,cueTHREAT+11.2, t);
    float r = sin(t*2.) * scannerOn;
    float vol= (smoothstep(0.4, 0.0,abs(r-.4))+.2) * scannerOn;
	float b = abs(sin(t*8.0))*.3;
    
    float aud = (saw(t*n*2.0, 1.)+saw(t*n*2.1, 1.))*.2;
    aud += saw(t*n*4.0, .6+b)+saw(t*n*4.01, .6+b);
    aud = clamp(aud*vol,-1., 1.);
    return aud;//(1.5 * aud - 0.5 * aud * aud * aud);
}

//----------------------------------------------------------------------------------------
vec2 deepFuzz(float t)
{
	float n = 0.0;
    float x = 0.0;
    float ty = 0.0;
    
    NT(cueFRONTOF-2.2, 28., .5);
    NT(cueFRONTOF-1.2, 28., .5);

    NT(cueTHREAT+1.2, 28., .5);
    NT(cueTHREAT+2.2, 28., .5);
    
    NT(cueTHREAT+10.+1.2, 28., .5);
    NT(cueTHREAT+10.+2.2, 28., 1.5);
   
    n = noteMIDI(n);
    x = t-x;
    
    float vol= smoothstep(.0, .0, x) * smoothstep(1.0, .98, x/ty);
    
    vol *= smoothstep(cueFRONTOF, cueFRONTOF+.2, t)*.9+.1;
    float pit = 1.0+sqr(t*250.0)*.02;
    vec2 aud = vec2(0.0);
    aud.x += saw(t*n*pit, 1.)+saw(t*n*1.01*pit, 1.)+saw(t*n*4.0*pit, 1.);
    aud.y += saw(t*n*pit, 1.)+saw(t*n*.99*pit, 1.)+saw(t*n*4.0*pit, 1.);
    aud = clamp(aud * vol*.5, -1.0, 1.0);
    return aud;//(1.5 * aud - 0.5 * aud * aud * aud);
}
    
//----------------------------------------------------------------------------------------
vec3 dronePath(float ti)
{
    vec3 p = vec3(-2030, 340, 2200.0);
    p = mix(p, vec3(-2030, 340, 2000.0),		smoothstep(cueINCLOUDS, cueFLYIN-.5, ti));
    p = mix(p, vec3(-30.0, 18.0, 300.0),		smoothstep(cueFLYIN, cueFLYIN+4.0, ti));
    p = mix(p, vec3(-35.0, 25.0, 10.0), 		smoothstep(cueFLYIN+4.0,cueFLYIN+8.0, ti));
    p = mix(p, vec3(30.0, 0.0, 15.0), 			smoothstep(cueFRONTOF+.5,cueFRONTOF+2.5, ti)); //../ Move to front of cam.
    p = mix(p, vec3(0.0, 8.0, .0), 				smoothstep(cueTHREAT, cueTHREAT+.5, ti)); 	// ...Threaten
    p = mix(p, vec3(0.0, 8.0, -4.0), 			smoothstep(cueTHREAT+2.0, cueTHREAT+2.3, ti)); 	// ...Threaten
    p = mix(p, vec3(0.0, 8., -12.0), 			smoothstep(cueTHREAT+3.0, cueTHREAT+3.3, ti)); 	// ...Threaten
    p = mix(p, vec3(0.0, 110.0, 0.0), 			smoothstep(cueFLYOFF,cueFLYOFF+1.5, ti)); // ...Fly off
    p = mix(p, vec3(4000.0, 110.0, -4000.0), 	smoothstep(cueFLYOFF+2.6,cueFLYOFF+10.0, ti)); 
    return p; 
}

//----------------------------------------------------------------------------------------
vec3 cameraAni(float ti)
{
    vec3 p;
    p = mix(drone-vec3(0.0,0.0, 10.0), drone-vec3(0.0,0.0, 20.0), smoothstep(cueINCLOUDS,cueINCLOUDS+2.0, ti));
    p = mix(p, drone-vec3(17.0,-14.0, 35.0), smoothstep(cueINCLOUDS+2.0,cueFLYIN-3.0, ti));
    p = mix(p, vec3(0.0, 0.0, -28.0), step(cueFLYIN, ti));
	p = vec3(p.xy, mix(p.z, -40.0, smoothstep(cueTHREAT,cueTHREAT+4.0, ti)));
    return p;
}


//----------------------------------------------------------------------------------------
float engines(float ti)
{
	float  t = ti+ sin(height*.7)*.3+1.0;
	float t1 = texture(iChannel1, vec2(t*(2.44),t*11.33), -4.0).x *  .5-.25;
	t1 += texture(iChannel1, vec2(t*(2.44),t*1.33), -99.0).x -.5;
    float t2 = texture(iChannel0, vec2(ti*13.81,ti*4.73), -4.0).x * .5-.25;
    t2 += texture(iChannel0, vec2(ti*13.81,ti*14.54), -99.0).x * .08-.04;
	float f = mix(t1, t2, speed);
	f+= clamp((texture(iChannel1, vec2(ti*5.44,t*12.33), -99.0).x*2.0-1.) *(smoothstep(cueFLYOFF+.0, cueFLYOFF+2.8, ti))*4.0, -1.,1.);
    f += (texture(iChannel0, vec2(ti*2.4413,ti*4.1375), -3.).x*2.0-1.);
	return clamp(f*(speed+.5), -1.0, 1.0);
}

//----------------------------------------------------------------------------------------
vec2 droneGunAni(float ti)
{
    vec2 a;
   	float mov;
    mov = smoothstep(cueFLYOFF-1., cueFLYOFF-3.0, ti);
    mov = mov*3.1-1.4;
    a.x = (sin(mov)+1.0)*1.5;
    a.y = smoothstep(.3,.7,sin(mov))*3.0;
    return a;
}

//----------------------------------------------------------------------------------------
vec2 guns(float ti)
{
	vec2 a;
    vec2 ga = droneGunAni(ti);
    a = texture(iChannel0, vec2(ga.x*14.4,ga.x*21.33), -99.0).xy-.5;
    a -= texture(iChannel0, vec2(ga.x*14.4,ga.x*21.33), -3.0).xy-.5;
    a *= .3;
    a += texture(iChannel1, vec2(ga.y*1.44,ga.y*1.03), -99.0).xy*2.0-1.;
    return a*.5;
}

//----------------------------------------------------------------------------------------
vec2 allsounds(float t)
{
    vec2 audio = vec2(0);
	audio = vec2(beeDoop(t));
    audio += vec2(aaaah(t));
    audio += vec2(deepFuzz(t));
    audio += vec2(beepPong(t));
    audio += engines(t);
    audio += vec2(scanner(t));
    audio = clamp(audio, -1.0, 1.0);
    audio *= smoothstep(cueFLYOFF-.3, cueFLYOFF-.8, t)+smoothstep(cueFLYOFF, cueFLYOFF+.3, t);
    audio += vec2(boom(t));
    audio += vec2(softBeep(t));
    audio += guns(t);
    audio *= smoothstep(cueFLYIN, cueFLYIN-.2, t)  + smoothstep(cueFLYIN, cueFLYIN+.2, t);
    audio += vec2(tech49(t));
    return audio*.8;
}

//----------------------------------------------------------------------------------------
vec2 mainSound( in int samp,float time)
{
	 float ti = mod(time, 57.);
     // Tests cues...
//   float ti = mod(time, 45.0);
   //float ti = mod(time, 6.5)+cueFRONTOF;
   //float ti = mod(time, 15.)+cueTHREAT+1.0;
   //float ti = mod(time, 8.5)+cueFLYOFF-2.5;
    
    drone = dronePath(ti);
    vec3 camPos = cameraAni(ti);
    float l = max(length(drone-camPos)-20.0, 1.);
    speed = clamp(length(drone -dronePath(ti-.08)),0.0, 1.1);
    height = drone.y;
    float disAtten = clamp(7330.0/(l*l), 0.0, 1.0);

   	vec2 audio = allsounds(ti)*disAtten;
    // Echo, echo echo...
	audio += allsounds(ti-.3)*.12 * vec2(1.0, .3)*disAtten;
    audio += allsounds(ti-.6)*.06 * vec2(.3, 1.)*disAtten;
    audio += allsounds(ti-.9)*.03 * vec2(1., .3)*disAtten;
    //audio += allsounds(ti-.12)*.025 * vec2(.3, 1.)*disAtten;.// ...too much!
    
    return audio * smoothstep(0.0, 2., ti) * smoothstep(57.0, 55., time);
}

`;

const fragment = `
// [SIG15] Oblivion
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// The Oblivion drone. I love all the scenes that include these things.
// It takes bits from all over:-
// https://www.youtube.com/watch?v=rEby9OkePpg&feature=youtu.be
// These drones were the true stars of the film!

// You might need to rewind to sync the audio properly.

// Some info, if you want to know:-
// The camera is delayed when following the drone to make it feel hand held.
// The rendering layers consist of:-
// 1. Background, including sky, ground and shadow. Plus a check for a possible heat haze
//    to bend the ray, before beginning trace.
// 2. Anti-aliased drone ray-marching, which is traced from just in front to just behind it for speed.
// 3. Clouds, and fogging.
// 4. Foreground, for ID scanner

#define PI 3.14156
#define TAU 6.2831853071
#define MOD2 vec2(443.8975,397.2973)
#define MOD3 vec3(443.8975,397.2973, 491.1871)

const vec2 add = vec2(1.0, 0.0);
vec3 sunDir = normalize(vec3(-2.3, 3.4, -5.89));
const vec3 sunCol = vec3(1.0, 1.0, .9);
vec2 gunMovement;
vec3 drone;
vec3 droneRots;
float scannerOn;
vec4 dStack;
vec4 eStack;
int emitionType = 0;
#define ZERO min(iFrame, 0)

//----------------------------------------------------------------------------------------
// Action cue sheet, for easy manipulation...
#define cueINCLOUDS 0.0
#define cueFLYIN 14.0
#define cueFRONTOF cueFLYIN + 10.0
#define cueTHREAT cueFRONTOF + 5.
#define cueFLYOFF cueTHREAT + 19.0

//----------------------------------------------------------------------------------------
// A hash that's the same on all platforms...
vec3 hash32(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * MOD3);
    p3 += dot(p3.zxy, p3.yxz+19.19);
    return fract(vec3(p3.x * p3.y, p3.x*p3.z, p3.y*p3.z));
}

//----------------------------------------------------------------------------------------
vec3 hash31(float p)
{
   vec3 p3 = fract(vec3(p) * MOD3);
   p3 += dot(p3.xyz, p3.yzx + 19.19);
   return fract(vec3(p3.x * p3.y, p3.x*p3.z, p3.y*p3.z));
}

//----------------------------------------------------------------------------------------
vec3 noise3(float n)
{
    float f = fract(n);
    n = floor(n);
    f = f*f*(3.0-2.0*f);
    return mix(hash31(n), hash31(n+1.0), f);
}

//----------------------------------------------------------------------------------------
vec3 noise( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(1.5-f)*2.0;
    
    vec3 res = mix(mix( hash32(p), hash32(p + add.xy),f.x),
               mix( hash32(p + add.yx), hash32(p + add.xx),f.x),f.y);
    return res;
}

//----------------------------------------------------------------------------------------
// CubeMap OpenGL clamping fix. Why do I have to do this?
vec3 cubeMap(in samplerCube sam, in vec3 v, float size)
{
   float M = max(max(abs(v.x), abs(v.y)), abs(v.z));
   float scale = (float(size) - 1.) / float(size);
   if (abs(v.x) != M) v.x *= scale;
   if (abs(v.y) != M) v.y *= scale;
   if (abs(v.z) != M) v.z *= scale;
   return texture(sam, v).xyz;
}

// Thanks to iq for the distance functions...
//----------------------------------------------------------------------------------------
float circle(vec2 p, float s )
{
    return length(p)-s;
}
//----------------------------------------------------------------------------------------
float  sphere(vec3 p, float s )
{
    return length(p)-s;
}

float prism( vec3 p, vec2 h )
{
    vec3 q = abs(p);
    return max(q.x-h.y,max(q.z*0.6+p.y*.5,-p.y)-h.x*0.5);
}

//----------------------------------------------------------------------------------------
float prismFlip( vec3 p, vec2 h )
{
    vec3 q = abs(p);
    return max(q.x-h.y,max(q.z*.8-p.y*.5,p.y)-h.x*0.5);
}

//----------------------------------------------------------------------------------------
float roundedSquare( vec2 p, vec2 b)
{
  vec2 d = abs(p) - b;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
    
}

//----------------------------------------------------------------------------------------
float roundedBox( vec3 p, vec3 b, float r )
{
	return length(max(abs(p)-b,0.0))-r;
}

//----------------------------------------------------------------------------------------
float sMin( float a, float b, float k )
{
    
	float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( b, a, h ) - k*h*(1.-h);
}

//----------------------------------------------------------------------------------------
vec2 rot2D(inout vec2 p, float a)
{
    return cos(a)*p - sin(a) * vec2(p.y, -p.x);
}

//----------------------------------------------------------------------------------------
vec3 rot3DXY(in vec3 p, in vec2 a)
{
	vec2 si = sin(a);
	vec2 co = cos(a);
    p.xz *= mat2(co.y, -si.y, si.y, co.y);
    p.zy *= mat2(co.x, -si.x, si.x, co.x);
    return p;
}

//----------------------------------------------------------------------------------------
float boxMap( sampler2D sam, in vec3 p, in vec3 n)
{
    p = p*vec3(.1, .03, .1);
    n = abs(n);
	float x = texture( sam, p.yz ).y;
	float y = texture( sam, p.zx ).y;
	float z = texture( sam, p.xy ).y;
	return (x*n.x + y*n.y + z*n.z)/(n.x+n.y+n.z);
}

float tri(in float x){return abs(fract(x)-.5);}
vec3 tri3(in vec3 p){return vec3( tri(p.z+tri(p.y*1.)), tri(p.z+tri(p.x*1.)), tri(p.y+tri(p.x*1.)));}

float triNoise3d(in vec3 p, in float spd, float ti)
{
    float z=1.1;
	float rz = 0.;
    vec3 bp = p*1.5;
	for (float i=0.; i<=3.; i++ )
	{
        vec3 dg = tri3(bp);
        p += (dg+spd);
        bp *= 1.9;
		z *= 1.5;
		p *= 1.3;
        
        rz+= (tri(p.z+tri(p.x+tri(p.y))))/z;
        bp += 0.14;
	}
	return rz;
}

float fogmap(in vec3 p, in float d, float ti)
{
    p.xz *= .4;
    p.z += ti*1.5;
    return max(triNoise3d(p*.3/(d+20.),0.2, ti)*1.8-.7, 0.)*(smoothstep(0.,25.,p.y));
}
// Thanks to nimitz for the quick fog/clouds idea...
// https://www.shadertoy.com/view/4ts3z2
vec3 clouds(in vec3 col, in vec3 ro, in vec3 rd, in float mt, float ti)
{
    float d = 3.5;
    for(int i=0; i<7; i++)
    {
        if (d>mt)break;
        vec3  pos = ro + rd*d;
        float rz = fogmap(pos, d, ti);
        vec3 col2 = (vec3(.4,0.4,.4));
        col = mix(col,col2,clamp(rz*smoothstep(d,d*1.86,mt),0.,1.) );
        d *= 1.86;
        
    }
    return col;
}

//----------------------------------------------------------------------------------------
vec4 numbers(vec4 mat, vec2 p)
{
    p.y *= 1.70;
    p.y+=.32;
	float d;
	d =(roundedSquare(p+vec2(1.4, -.25), vec2(.02, .76)));
  	d =min(d, (roundedSquare(p+vec2(1.48, -1.04), vec2(.1, .06))));

    vec2 v = p;
    v.x -= v.y*.6;
    v.x = abs(v.x+.149)-.75;
	d = min(d, roundedSquare(v+vec2(0.0, -.7), vec2(.07, .4)));
    v = p;
    v.x -= v.y*.6;
    v.x = abs(v.x-.225)-.75;
    p.x = abs(p.x-.391)-.75;
  	d = min(d, circle(p, .5));
   	d = max(d, -circle(p, .452));
    d = max(d, -roundedSquare(v+vec2(0., -.87), vec2(.33, .9)));
    
    mat = mix(mat, vec4(.8), smoothstep(0.2, .13, d));
    return mat;
}

//----------------------------------------------------------------------------------------
// Find the drone...
float mapDE(vec3 p)
{
    p -= drone.xyz;
    p = rot3DXY(p, droneRots.xy);

    float d = sphere(p, 10.0);
	vec3 v = p;
    v.xy = abs(v.xy);
    v.xy = rot2D(v.xy, -PI/6.2);
    // Cross pieces...
    d = sMin(d, roundedBox(v-vec3(0,0,-8), vec3(4.9, .3, .5), 1.), 1.2); 
    d = max(d, -roundedBox(v-vec3(0,0,-8.5), vec3(4.8, .3, 1.), 1.));
    
    // Centre cutout...
    //d = sMin(d, roundedBox(p-vec3(0,0,-8.5), vec3(1.3, 1.4, 1.5), .7), .4); 
    d = max(d,-roundedBox(p-vec3(0,0,-9.1), vec3(2., 1.5, 4.0), .7)); 
    // Inside...
    d = min(d, sphere(p, 8.8));
    d = max(d, roundedBox(p, vec3(6.5, 12, 12.0), .8)); 
    // Make back...
    d = sMin(d, prismFlip(p+ vec3(.0, -4.1, -8.1), vec2(7., 4.7) ), 1.);
    d = max(d, -prism(p + vec3(.0, 6.4, -11.4), vec2(8.0, 10.0) ));
    d = min(d, sphere(p+ vec3(.0, 5.6, -6.2), 3.0));
    
    // Eye locations../
    d = min(d, sphere(v+ vec3(-3.5, .0, 7.4), 1.1));
    
    v = p;
    v.x = abs(v.x);
    d = sMin(d, roundedBox(v+vec3(-4.2,-6.,-10.0), vec3(1.1, .1, 4.5), 1.), 2.4); 
    
    v =abs(p)-vec3(gunMovement.x, .0, 0.) ;
    v.x -= p.z*.1*gunMovement.y;
	float d2 = sphere(v, 10.0);
    d2 = max(d2, -roundedBox(v, vec3(6.55, 12, 12.0), .8)); 
    d = min(d2 ,d);
    d = min(d,roundedBox(v-vec3(5.5, 3.5, 3.5), vec3(2.3, .1, .1), .4));
    d = min(d,roundedBox(v-vec3(5.5, .0, 5.), vec3(2.4, .1, .1), .4));

    v =vec3(abs(p.xy)-vec2(gunMovement.x, .0), p.z);
    v.x -= p.z*.1*gunMovement.y;

    d = min(d, roundedBox(v-vec3(8., 2.8, -6.5), vec3(.3, 1., 3.), .2));
    d = min(d, roundedBox(v-vec3(8., 2.3, -10.), vec3(.2, .4, 1.2), .2));
    d = min(d, roundedBox(v-vec3(8., 3.4, -10.), vec3(.01, .01, 1.2), .4));
    d = max(d, -roundedBox(v-vec3(8., 3.4, -10.4), vec3(.01, .01, 1.2), .3));
    d = max(d, -roundedBox(v-vec3(8., 2.3, -10.4), vec3(.01, .01, 1.2), .3));
    
    d = min(d,  roundedBox(v-vec3(8.55, 0, -4.5), vec3(.4, .2, 1.), .4));
    d = max(d, -roundedBox(v-vec3(8.65, 0, -4.5), vec3(.0, .0, 2.), .34));
       
    return d;
}

//---------------------------------------------------------------------------
float bumpstep(float edge0, float edge1, float x)
{
    return 1.0-abs(clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)-.5)*2.0;
}

//----------------------------------------------------------------------------------------
// Find the drone's material...yes, it's IFtastic! :D
vec4 mapCE(vec3 p, vec3 nor)
{
    vec4 mat;
    p -= drone.xyz;
	p = rot3DXY(p, droneRots.xy);

    const vec4 gunMetal = vec4(.05, .05, .05,.3);
    vec4 body     = vec4(.8, .8, .8,.4);
   
    float dirt1 = smoothstep(-.1, .5,boxMap(iChannel1,p, nor))*.25+.75;
    mat = body*dirt1;
  
    float d = sphere(p+vec3(0,0,.5), 8.9);
    float d2;
    d = max(d, roundedBox(p, vec3(6., 12, 11.0), .72)); 
    if (d < .0 || p.z > 14.5)
    {
        d = sphere(p-vec3(-3.3 , 1.8, -8.1), .9);
        d2 = sphere(p-vec3(3.1 , 1.7, -8.1), .5);
        // EyeCam...
	    if (d < 0.0)
        {
            mat = vec4(1., 0.03, 0.0, .7);
            emitionType = 1;
        }else
		// Scanner...
       	if (d2 < 0.0)
       	{
            d2 = d2 < -.015 ? max(-circle(mod(p.xy-vec2(3.185 , 1.78), .16)-.08, .085)*35.0, 0.0): 1.0;
			mat = vec4(.2+scannerOn*.6, 0.2+scannerOn*.75, 0.2+scannerOn, .7*d2)*d2;
            
			emitionType = 2;
      	}
        else
	        mat = numbers(gunMetal, p.xy);
        // Do hex border line around numbers...
        p = abs(p);
        mat = p.x > p.y*.76 ? mix(mat, vec4(0.0), bumpstep(2.3, 2.4, p.x+p.y*.5)):mix(mat, vec4(0.0), bumpstep(1.82, 1.92, p.y));
        return mat;
    }

     // Gun placements and carriers...
    vec3 v = p;
    
   	//v.yz = rot2D(p.yz, gunMovement.x);
	v =abs(v)-vec3(gunMovement.x, .0, 0.) ;
    v.x -= p.z*.1*gunMovement.y;
	d2 = sphere(v, 10.0);
    d2 = max(d2, -roundedBox(v, vec3(6.55, 12, 4.0), 1.1)); 
    
    d = min(d2, d);
    d2 = min(d,	roundedBox(v-vec3(5.5, 3.5, 3.5), vec3(2.3, .1, .1), .4));
    //d2 = min(d2,roundedBox(v-vec3(5.5, .0, 3.7), vec3(2.3, .1, .1), .4));
    d2 = min(d2, sphere(v-vec3(5., .0, 3.7), 3.8));
    if(d2 < d) mat = vec4(.0, .0, .0, 6.);
    //return mat;
    
    v = vec3(abs(p.x)-gunMovement.x, p.yz);
    v.x -= p.z*.1*gunMovement.y;
    float dirt = (smoothstep(-.1, .5,boxMap(iChannel1,v, nor))*.2+.8);
    body = body * dirt;
 
    v = vec3(abs(p.xy)-vec2(gunMovement.x, .0), p.z);
    v.x -= p.z*.1*gunMovement.y;
    
    if ( v.x > 7.4)  mat =mix(body, gunMetal, smoothstep(2.5, 2.3, v.y))*dirt;
    d2 =  roundedBox(v-vec3(8., 2.3, -10.5), vec3(.4, 1.6, 1.5), .2);
    //if ( d2 < 0.1)  mat = gunMetal*dirt;
    mat= mix(mat, gunMetal*dirt, clamp(-d2*10.0, 0.0, 1.0));
    
    d =  sphere(p+ vec3(.0, 5.6, -6.2), 3.2);
    if ( d < 0.0)
    {
        mat = vec4(0);
        emitionType = 3;
    }

    return mat;
}

//----------------------------------------------------------------------------------------
float shadow( in vec3 ro, in vec3 rd)
{
	float res = 1.0;
    float t = .2;
    for (int i = ZERO; i < 12; i++)
	{
		float h = mapDE( ro + rd*t );
        if (h< -2.) break;
		res = min(10.*h / t, res);
		t += h+.2;
	}
    return max(res, .3);
}

//----------------------------------------------------------------------------------------
float SphereRadius(in float t)
{
    t = t*.003+.01;
	return min(t,256.0/iResolution.x);
}

//----------------------------------------------------------------------------------------
void rayMarch(vec3 pos, vec3 dir)
{
    // Efficiently start the ray just in front of the drone...
    float l = max(length(drone-pos)-14.2, .0);
    float d =  l;
    l+=23.;// ...and end it just after
    int hits = 0;
	// Collect 4 of the closest scrapes on the tracing sphere...
    for (int i = ZERO; i < 55; i++)
    {
        // Leave if it's gone past the drone or when it's found 7 stacks points...
        if(d > l || hits == 6) break;
        vec3 p = pos + dir * (d);
		float r= SphereRadius(d);
		float de = mapDE(p);
        // Only store the closest ones (roughly), which means we don't
        // have to render the 8 stack points, just the most relavent ones.
        // This also prevents the banding seen when using small stacks.
        if(de < r &&  de < eStack.x)
        {
            // Rotate the stack and insert new value!...
			dStack = dStack.wxyz; dStack.x = d; 
            eStack = eStack.wxyz; eStack.x = de;
			hits++;    
        }
		d +=de*.9;
    }
    return;
}

//----------------------------------------------------------------------------------------
vec3 normal( in vec3 pos, in float r )
{
	vec2 eps = vec2( r*1., 0.0);
	vec3 nor = vec3(
	    mapDE(pos+eps.xyy) - mapDE(pos-eps.xyy),
	    mapDE(pos+eps.yxy) - mapDE(pos-eps.yxy),
	    mapDE(pos+eps.yyx) - mapDE(pos-eps.yyx) );
	return normalize(nor);
}

//----------------------------------------------------------------------------------------
float terrain( in vec2 q )
{
    q *= .5;
    q += 4.;
	float h = smoothstep( 0., 0.7, textureLod( iChannel1, 0.023*q,  0.0).x )*6.0;
    h +=  smoothstep( 0., 0.7, textureLod( iChannel2, 0.03*q, 0.0 ).y )*3.0;
    //h +=  smoothstep( 0., 1., texture( iChannel1, .01*q, 00.0 ).y )*1.0;
    return h;
}

//----------------------------------------------------------------------------------------
vec3 skyUpper(in vec3 rd)
{
    vec3  sky;
    float f = pow(max(rd.y, 0.0), .5);
    sky = mix(vec3(.45, .5, .6), vec3(.7, .7, .7), f);
    float sunAmount = pow(max( dot( rd, sunDir), 0.0 ), 8.0);
    sky = sky + sunCol * sunAmount*.5;
    rd.xz = rd.zx;rd.y-=.05;
    //sky -= (vec3(.65, .67, .75)-cubeMap(iChannel3, rd, 64.0).xyz)*.5;
    //3D变2D
    sky -= vec3(.65, .67, .75);

	return clamp(sky, 0.0, 1.0);
}

//----------------------------------------------------------------------------------------
vec3 fogIt(in vec3 col, in vec3 sky, in float d)
{
    return mix (col, sky, clamp(1.0-exp(-d*0.001), 0.0, 1.0));
}

//----------------------------------------------------------------------------------------
vec3 ground(vec3 sky, in vec3 rd, in vec3 pos)
{
  
    if (rd.y > .0) return sky;
 
	float d = (-20.0-pos.y)/rd.y;
	vec2 p = pos.xz+rd.xz * d;
    
	vec3 tex1 = texture(iChannel1, p*.1).xyz;
	vec3 tex2 = texture(iChannel2, p*.0004).yyx*vec3(1.0, .8, .8);

	vec3 gro  = vec3(1.);
    
    d-=20.0;
	float a = .0004*d*d;
        
	vec3 nor  	= vec3(0.0,		    terrain(p), 0.0);
	vec3 v2		= nor - vec3(a,		terrain(p+vec2(a, 0.0)), 0.0);
	vec3 v3		= nor - vec3(0.0,		terrain(p+vec2(0.0, a)), -a);
	nor = cross(v2, v3);
	nor = normalize(nor);
	gro = mix(tex1, tex2, nor.y*.8);
	float sha = shadow(vec3(p.x, 0.0, p.y),  sunDir);
	float z =max(dot(nor, sunDir), 0.1);
    if (dStack[0] < 0.0) dStack[0]= d;
    vec3 col = gro*z*sha;

	return col = fogIt(col, sky, d);
}



//----------------------------------------------------------------------------------------
// This is also used for the camera's delayed follow routine.
// Which make the scene more dramitic because it's a human camera operator!
vec3 dronePath(float ti)
{
    vec3 p = vec3(-2030, 500, 2400.0);
    p = mix(p, vec3(-2030, 500, 2000.0),	 	smoothstep(cueINCLOUDS, cueFLYIN, ti));
    p = mix(p, vec3(-30.0, 18.0, 300.0),		smoothstep(cueFLYIN, cueFLYIN+4.0, ti));
    p = mix(p, vec3(-35.0, 25.0, 10.0), 		smoothstep(cueFLYIN+2.0,cueFLYIN+8.0, ti));
    p = mix(p, vec3(30.0, 0.0, 15.0), 			smoothstep(cueFRONTOF+.5,cueFRONTOF+2.5, ti)); //../ Move to front of cam.
    
    p = mix(p, vec3(0.0, 8.0, .0), 				smoothstep(cueTHREAT, cueTHREAT+.5, ti)); 	// ...Threaten
    p = mix(p, vec3(0.0, 8.0, -4.0), 			smoothstep(cueTHREAT+2.0, cueTHREAT+2.3, ti)); 	// ...Threaten
    p = mix(p, vec3(0.0, 8., -12.0), 			smoothstep(cueTHREAT+3.0, cueTHREAT+3.3, ti)); 	// ...Threaten
    
    p = mix(p, vec3(0.0, 110.0, 0.0), 			smoothstep(cueFLYOFF,cueFLYOFF+1.5, ti)); // ...Fly off
    p = mix(p, vec3(4000.0, 110.0, -4000.0), 	smoothstep(cueFLYOFF+2.6,cueFLYOFF+10.0, ti)); 
    return p; 
}

//----------------------------------------------------------------------------------------
vec3 droneRotations(float ti)
{
    vec3 a = vec3(0);
    
    
   	a.x = mix(a.x, .2, smoothstep(cueFLYIN-3.0,cueFLYIN-1.5, ti));
    a.x = mix(a.x, .0, smoothstep(cueFLYIN-1.5,cueFLYIN, ti));

    a.y = mix(a.y, -.8,smoothstep(cueFLYIN-1.5,cueFLYIN, ti));

    a.x = mix(a.x, .2,smoothstep(cueFLYIN+2.0,cueFLYIN+4.0, ti));
    a.x = mix(a.x, 0.,smoothstep(cueFLYIN+4.0,cueFLYIN+6., ti));

	a.y = mix(a.y, 0.0, smoothstep(cueFLYIN+3.0,cueFLYIN+4.4, ti));
    a.x = mix(a.x, .1,smoothstep(cueFLYIN+7.0,cueFLYIN+7.8, ti));
    a.x = mix(a.x, 0.,smoothstep(cueFLYIN+7.8,cueFLYIN+8.3, ti));
    
	a.y = mix(a.y, -1.5,smoothstep(cueFRONTOF,cueFRONTOF+.5, ti));// ..Turn to go right, infront
	a.y = mix(a.y, .6, 	smoothstep(cueFRONTOF+3.,cueFRONTOF+4.5, ti));

    a.y = mix(a.y, .0,  smoothstep(cueTHREAT,cueTHREAT+.5, ti));

    a.x = mix(a.x, -.28,smoothstep(cueTHREAT, cueTHREAT+.3, ti)); // ...Threaten
    
    a.x = mix(a.x, 0.0, smoothstep(cueFLYOFF-2.0, cueFLYOFF, ti)); // Normalise position, relax!
    a.x = mix(a.x, -0.5,smoothstep(cueFLYOFF, cueFLYOFF+.2, ti)); 	// ...Fly off
    a.x = mix(a.x, 0.0, smoothstep(cueFLYOFF+.2, cueFLYOFF+.7, ti));
    
    a.y = mix(a.y, -.78,smoothstep(cueFLYOFF+2., cueFLYOFF+2.3, ti)); 
    
    scannerOn = smoothstep(cueTHREAT+4.0,cueTHREAT+4.2, ti)* smoothstep(cueTHREAT+11.5,cueTHREAT+11.2, ti);
    a.z = sin(ti*2.) * scannerOn;

    return a;
}

//----------------------------------------------------------------------------------------
vec2 droneGunAni(float ti)
{
    vec2 a;
   	float mov = smoothstep(cueTHREAT+.5, cueTHREAT+1.5, ti);
    mov = mov * smoothstep(cueFLYOFF-1., cueFLYOFF-3.0, ti);
    mov = mov*3.1-1.4;
    a.x = (sin(mov)+1.0)*1.5;
    a.y = smoothstep(.3,.7,sin(mov))*3.0;
    return a;
}

//----------------------------------------------------------------------------------------
vec3 cameraAni(float ti)
{
    vec3 p;
    p = mix(drone-vec3(0.0,0.0, 10.0), drone-vec3(0.0,0.0, 20.0), smoothstep(cueINCLOUDS,cueINCLOUDS+2.0, ti));
    p = mix(p, drone-vec3(17.0,-14.0, 35.0), smoothstep(cueINCLOUDS+2.0,cueFLYIN-3.0, ti));

    p = mix(p, vec3(0.0, 0.0, -28.0), step(cueFLYIN, ti));
	p = vec3(p.xy, mix(p.z, -40.0, smoothstep(cueTHREAT,cueTHREAT+4.0, ti)));
    return p;
}

//----------------------------------------------------------------------------------------
float overlay(vec3 p, vec3 dir)
{
    float r = 0.0;
    vec3 pos = drone.xyz+vec3(3.25, -.48, -8.0);
    vec3 v = p-pos;
    vec3 n = vec3(0.0, 1., 0.0);
    n.zy = rot2D(n.zy, droneRots.z);
    n = normalize(n);
    float d = -dot(n, v)/ dot(n, dir);
    p = p + dir*d-pos;

    if (p.z < .0 && p.z > -20.)
    {
        float d = abs(p.z) - abs(p.x)+.4;
        r = step(.3, d)*.3;
        r += smoothstep(-.3, -.2,p.x) * smoothstep(0., -.2, p.x)*r;
        r += smoothstep(.3, .2,p.x) * smoothstep(0.0, .2, p.x)*r;
        r += smoothstep(0.1, .2, d) * smoothstep(0.4, .2, d);
    }
    r += smoothstep(0.3, 0.0,abs(droneRots.z-.4))*1.5;

    return r;
}

//----------------------------------------------------------------------------------------
void heatHaze(vec3 p, inout vec3 dir, float t)
{
    if (t < cueFLYIN) return;
    float r = 0.0;
    vec3 pos = vec3(0.0, -4.8, 7.);
    if (drone.y < 20.0)
    	pos.y += smoothstep(-.90, .5,droneRots.y)*smoothstep(.9, 0.5,droneRots.y)*-8.0;
    pos.zx = rot2D(pos.zx, droneRots.y);
    pos += drone.xyz;
    vec3 v = p-pos;
    vec3 n = vec3(0.0, 0., 1.0);

    n = normalize(n);
    float d = -dot(n, v)/ dot(n, dir);
    p = p + dir*d-pos;

    if (p.y < .0 && p.y > -30.)
    {
        float l = abs(p.y) - abs(p.x*(1.1))+8.0;
        r = smoothstep(.0, 14., l);
        //p.xy *= vec2(.5,.9);
        t*= 23.0;
        dir += r*(noise(p.xy*.8+vec2(0.0,t))-.5)*.001/(.07+(smoothstep(10.0, 2500.0, d)*20.0));
    }
}

//----------------------------------------------------------------------------------------
vec3 cameraLookAt(in vec2 uv, in vec3 pos, in vec3 target, in float roll)
{    
	vec3 cw = normalize(target-pos);
	vec3 cp = vec3(sin(roll), cos(roll),0.0);
	vec3 cu = normalize(cross(cw,cp));
	vec3 cv = normalize(cross(cu,cw));
	return normalize(-uv.x*cu + uv.y*cv +2.*cw );
}

//----------------------------------------------------------------------------------------
void mainImage( out vec4 outColour, in vec2 coords )
{
	vec2 xy = coords.xy / iResolution.xy;
    vec2 uv = (xy-.5)*vec2( iResolution.x / iResolution.y, 1)*2.0;
     // Multiply this time to speed up playback, but remember to do the sound as well!
  	float ti = mod(iTime, 57.);
    //float ti = mod(iTime, 5.)+cueFRONTOF;	// ...Test cues..
    //float ti = mod(iTime, 15.0)+cueTHREAT+1.0;
    //float ti = mod(iTime, 5.)+cueFLYIN;
    //float ti = mod(iTime, 5.)+cueFLYOFF;
	
    //---------------------------------------------------------
    // Animations...
	drone = dronePath(ti);
    droneRots = droneRotations(ti);
    vec3 camPos = cameraAni(ti);
    gunMovement = droneGunAni(ti);
    float t = smoothstep(cueTHREAT, cueTHREAT+.5, ti) *smoothstep(cueTHREAT+15.5, cueTHREAT+14.7, ti);
    
    float e = -droneRots.y+t*texture(iChannel0, vec2(.3, ti*.02)).x*.25-.22;
    e += texture(iChannel0, vec2(.4, ti*.005)).x*.5-.35;
    vec3 eyeCam = normalize(vec3(0.3, -.4*t,  -1.0));
    eyeCam.xz = rot2D(eyeCam.xz, e);
    
	//---------------------------------------------------------
	vec3 tar = dronePath(ti-.25);
    // Cameraman gets shaky when the drone is close...oh no...
    float l = 30.0 / length(tar-camPos);
    tar += (noise3(ti*4.0)-.5)*l;
    vec3 dir = cameraLookAt(uv, camPos, tar, 0.0);
	
    
    heatHaze(camPos, dir, ti);
    //--------------------------------------------------------
    // Reset and fill the render stack through ray marching...
    dStack = vec4(-1);
    eStack = vec4(1000.0);
    rayMarch(camPos, dir);

    //---------------------------------------------------------
	// Use the last stacked value to do the shadow, seems to be OK, phew!...
    float lg = dStack[0];
	vec3 p = camPos + dir * lg;
    float sha = shadow(p, sunDir);
    vec3 sky = skyUpper(dir);
	//---------------------------------------------------------
	// Render the stack...
    float alphaAcc = .0;
    vec3 col = vec3(0);
    float spe;
    for (int i = 0; i < 4; i++)
    {
        float d = dStack[i];
		if (d > 0.0)
        {
            float de = eStack[i];
            float s = SphereRadius(d);
            float alpha = max((1.0 - alphaAcc) * min(((s-de) / s), 1.0),0.0);

            vec3 p = camPos + dir * d;
            vec3  nor = normal(p, s);
            vec4  mat = mapCE(p, nor);
            float amb = abs(nor.y)*.6; amb = amb*amb;
            vec3 c= mat.xyz * vec3(max(dot(sunDir, nor), 0.0))+ amb * mat.xyz;
            spe = pow(max(dot(sunDir, reflect(dir, nor)), 0.0), 18.0);

            if (emitionType != 0)
            {
                if (emitionType == 1)
                {
                    s = cos(pow(max(dot(eyeCam, nor), 0.0), 4.4)*9.0)*.14;
                    s += pow(abs(dot(eyeCam, nor)), 80.)*18.0;
                    c*= max(s, 0.0);
                }
                if (emitionType == 3)
                {
                    vec3 dp = p - drone;
                    s = smoothstep(.0,-.1, nor.y) * smoothstep(-1.0,-.3, nor.y);
                    c = vec3((smoothstep(-5.8,-5., dp.y) * smoothstep(-4.8,-5., dp.y))*.1);
                    float g = abs(sin((atan(nor.x, -nor.z))*TAU+ti*33.0))+.2;
                    c += s*(texture(iChannel2, p.xy*vec2(.04, .01)+vec2(0.0, ti)).xyy)*vec3(1.5, 2.3,3.5)*g;

                    alpha *= smoothstep(-9.,-4.5, dp.y) - g * smoothstep(-4.5,-10., dp.y)*.2;

                }          

                sha = 1.0;
            }

            c += sunCol * spe * mat.w;


            col += c = fogIt(c *sha, sky, d)* alpha;
            alphaAcc+= alpha;
        }
     }
    
	//---------------------------------------------------------
    // Back drop...
    
    vec3 gro = ground(sky, dir, camPos);
	
    col = mix(col, gro, clamp(1.0-alphaAcc, 0.0, 1.0));
    
    
    if (dStack[0] < 0.0) dStack[0] = 4000.0;
    col = clouds(col,camPos, dir, dStack[0], ti);
    
        // Overlay...
    float scan = overlay(camPos, dir)*scannerOn;
	col = min(col+vec3(scan*.6, scan*.75, scan), 1.0);

    
    
	//---------------------------------------------------------
	// Post effects...
    col = col*0.5 + 0.5*col*col*(3.0-2.0*col);					// Slight contrast adjust
    col = sqrt(col);											// Adjust Gamma 
    // I can't decide if I like the added noise or not...
    //col = clamp(col+hash32(xy+ti)*.11, 0.0, 1.0); 					// Random film noise

    
    col *= .6+0.4*pow(50.0*xy.x*xy.y*(1.0-xy.x)*(1.0-xy.y), 0.2 );	// Vignette
    col *= smoothstep(0.0, .5, ti)*smoothstep(58.0, 53., ti);
	outColour = vec4(col,1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'XtfXDN';
  }
  name(): string {
    return '[SIG15] Oblivion';
  }
  sort() {
    return 694;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
      webglUtils.DEFAULT_NOISE, //
      webglUtils.TEXTURE12,
      webglUtils.TEXTURE6,
    ];
  }
}
