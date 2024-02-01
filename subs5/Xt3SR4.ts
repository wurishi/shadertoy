import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Created by sebastien durand - 11/2016
//-------------------------------------------------------------------------------------
// Based on "Type 2 Supernova" 
// Sliders from IcePrimitives
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
//-------------------------------------------------------------------------------------

#define SPIRAL_NOISE_ITER 8
//#define SHANE_ORGANIC

float hash( const in vec3 p ) {
    return fract(sin(dot(p,vec3(127.1,311.7,758.5453123)))*43758.5453123);
}

float pn(in vec3 x) {
    vec3 p = floor(x), f = fract(x);
	f *= f*(3.-f-f);
	vec2 uv = (p.xy+vec2(37,17)*p.z) + f.xy,
	     rg = textureLod( iChannel0, (uv+.5)/256., -100.).yx;
	return 2.4*mix(rg.x, rg.y, f.z)-1.;
}

//-------------------------------------------------------------------------------------
// otaviogood's noise
//--------------------------------------------------------------
// This spiral noise works by successively adding and rotating sin waves while increasing frequency.
// It should work the same on all computers since it's not based on a hash function like some other noises.
// It can be much faster than other noise functions if you're ok with some repetition.
const float nudge = 20.;	// size of perpendicular vector
float normalizer = 1.0 / sqrt(1.0 + nudge*nudge);	// pythagorean theorem on that perpendicular to maintain scale
float SpiralNoiseC(vec3 p, vec4 id) {
    float iter = 2., n = 2.-id.x; // noise amount
    for (int i = 0; i < SPIRAL_NOISE_ITER; i++) {
        // add sin and cos scaled inverse with the frequency
        n += -abs(sin(p.y*iter) + cos(p.x*iter)) / iter;	// abs for a ridged look
        // rotate by adding perpendicular and scaling down
        p.xy += vec2(p.y, -p.x) * nudge;
        p.xy *= normalizer;
        // rotate on other axis
        p.xz += vec2(p.z, -p.x) * nudge;
        p.xz *= normalizer;  
        // increase the frequency
        iter *= id.y + .733733;
    }
    return n;
}

#ifdef SHANE_ORGANIC
float map(vec3 p, vec4 id) {
    float k = 2.*id.w +.1;  // p/=k;
    p *=(.5+4.*id.y);
    return k*(.1+abs(dot(p = cos(p*.6 + sin(p.zxy*1.8)), p) - 1.1)*3. + pn(p*4.5)*.12);
}
#else
float map(vec3 p, vec4 id) {
	float k = 2.*id.w +.1; //  p/=k;
    return k*(.5 + SpiralNoiseC(p.zxy*.4132+333., id)*3. + pn(p*8.5)*.12);
}
#endif

vec3 hsv2rgb(float x, float y, float z) {	
	return z+z*y*(clamp(abs(mod(x*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.)-1.);
}

//-------------------------------------------------------------------------------------
// Based on "Type 2 Supernova"
//-------------------------------------------------------------------------------------
vec4 renderSuperstructure(vec3 ro, vec3 rd, const vec4 id) {
    const float max_dist=20.;
	float ld, td=0., w, d, t, noi, lDist, a,         
    	  rRef = 2.*id.x,
          h = .05+.25*id.z;
   
    vec3 pos, lightColor;   
    vec4 sum = vec4(0);
   	
    t = .3*hash(vec3(hash(rd))+iTime); 

    for (int i=0; i<200; i++)  {
		// Loop break conditions.
	    if(td>.9 ||  sum.a > .99 || t>max_dist) break;
        
        // Color attenuation according to distance
        a = smoothstep(max_dist,0.,t);
        
        // Evaluate distance function
        d = abs(map(pos = ro + t*rd, id))+.07;
        
        // Light calculations 
        lDist = max(length(mod(pos+2.5,5.)-2.5), .001); // TODO add random offset
        noi = pn(0.03*pos);
        lightColor = mix(hsv2rgb(noi,.5,.6), 
                         hsv2rgb(noi+.3,.5,.6), 
                         smoothstep(rRef*.5,rRef*2.,lDist));
        sum.rgb += a*lightColor/exp(lDist*lDist*lDist*.08)/30.;
		
        if (d<h) {
			td += (1.-td)*(h-d)+.005;  // accumulate density
            sum.rgb += sum.a * sum.rgb * .25 / lDist;  // emission	
			sum += (1.-sum.a)*.05*td*a;  // uniform scale density + alpha blend in contribution 
        } 
		
        td += .015;
        t += max(d * .08 * max(min(lDist,d),2.), .01);  // trying to optimize step size
    }
    
    // simple scattering
    sum *= 1. / exp(ld*.2)*.9;
   	sum = clamp(sum, 0., 1.);   
    sum.xyz *= sum.xyz*(3.-sum.xyz-sum.xyz);
	return sum;
}

// ---------------------------------------------------
// Bers
// ---------------------------------------------------
vec4 processSliders(in vec2 uv, out vec4 sliderVal) {
    sliderVal = textureLod(iChannel1,vec2(0),0.0);
    if(length(uv.xy)>1.) {
    	return textureLod(iChannel1,uv.xy/iResolution.xy,0.0);
    }
    return vec4(0);
}

#define R(p, a) p=cos(a)*p+sin(a)*vec2(p.y, -p.x)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{   
    vec4 sliderVal, cSlider = processSliders(fragCoord, sliderVal);
    vec2 m = iMouse.xy/iResolution.xy;
    vec3 ro = vec3(15.+iTime, cos(.1*iTime), 15.+iTime),
		 rd = normalize(vec3((fragCoord.xy-0.5*iResolution.xy)/iResolution.y, 1.));
   
    R(rd.zx, 3.*m.x);
    R(rd.yx, 1.5*m.y);
    R(rd.xz, iTime*.1);
	   
    // Super Structure
	vec4 col = renderSuperstructure(ro, rd, sliderVal);

    //Apply slider overlay
    fragColor = vec4(mix(col.xyz + 0.5*vec3(.1,.2,.3),cSlider.rgb,cSlider.a), 1.);
}

`;

const buffA = `
//Buffer A : slider management (this is not required)
// Bers

#define saturate(x) clamp(x,0.0,1.0)

vec4 sliderVal = vec4(0.5,0.4,0.2,0.4); //Default slider values [0-1]

// vec4 sliderVal = vec4(0.4,0.4,0.,0.5); // bras de galaxies
// vec4 sliderVal = vec4(1.,0.2,0.,0.1); // bacteries


void SLIDER_setValue(float idx, float val)
{
    if(idx<0.) return;
    else if(idx<0.25) sliderVal[0] = saturate(val);
	else if(idx<0.50) sliderVal[1] = saturate(val);
	else if(idx<0.75) sliderVal[2] = saturate(val);
	else if(idx<1.00) sliderVal[3] = saturate(val);
}

float SLIDER_getValue(float idx)
{
    if     (idx<0.25) return sliderVal[0];
    else if(idx<0.50) return sliderVal[1];
    else if(idx<0.75) return sliderVal[2];
    else if(idx<1.00) return sliderVal[3];
	else return 0.;
}

void SLIDER_init(vec2 mousePos, vec2 cMin, vec2 cMax )
{
    vec4 cPingPong = textureLod(iChannel0,vec2(0),0.0);
    if(length(cPingPong)>0.001)
        sliderVal = cPingPong;
        
    float width = cMax.x-cMin.x;
    float height = cMax.y-cMin.y;
    if(mousePos.x>cMin.x && mousePos.x<cMax.x &&
       mousePos.y>cMin.y && mousePos.y<cMax.y )
    {
        float t = (mousePos.y-cMin.y)/height;
        t = clamp(t/0.75-0.125,0.,1.); //25% top/bottom margins
		SLIDER_setValue((mousePos.x-cMin.x)/width, t);
    }
}

//Returns the distance from point "p" to a given line segment defined by 2 points [a,b]
float UTIL_distanceToLineSeg(vec2 p, vec2 a, vec2 b)
{
    //       p
    //      /
    //     /
    //    a--e-------b
    vec2 ap = p-a;
    vec2 ab = b-a;
    //Scalar projection of ap in the ab direction = dot(ap,ab)/|ab| : Amount of ap aligned towards ab
    //Divided by |ab| again, it becomes normalized along ab length : dot(ap,ab)/(|ab||ab|) = dot(ap,ab)/dot(ab,ab)
    //The clamp provides the line seg limits. e is therefore the "capped orthogogal projection", and length(p-e) is dist.
    vec2 e = a+clamp(dot(ap,ab)/dot(ab,ab),0.0,1.0)*ab;
    return length(p-e);
}

//uv = slider pixel in local space [0-1], t = slider value [0-1], ar = aspect ratio (w/h)
vec4 SLIDER_drawSingle(vec2 uv, float t, vec2 ar, bool bHighlighted)
{
    const vec3  ITEM_COLOR = vec3(1);
    const vec3  HIGHLIGHT_COLOR = vec3(0.2,0.7,0.8);
    const float RAD = 0.05;  //Cursor radius, in local space
    const float LW  = 0.030; //Line width
    float aa  = 14./iResolution.x; //antialiasing width (smooth transition)
    vec3 selectionColor = bHighlighted?HIGHLIGHT_COLOR:ITEM_COLOR;
    vec3 cheapGloss   = 0.8*selectionColor+0.2*smoothstep(-aa,aa,uv.y-t-0.01+0.01*sin(uv.x*12.));
    vec2 bottomCenter = vec2(0.5,0.0);
	vec2 topCenter    = vec2(0.5,1.0);
    vec2 cursorPos    = vec2(0.5,t);
    float distBar = UTIL_distanceToLineSeg(uv*ar, bottomCenter*ar, topCenter*ar);
    float distCur = length((uv-cursorPos)*ar)-RAD;
    float alphaBar = 1.0-smoothstep(2.0*LW-aa,2.0*LW+aa, distBar);
    float alphaCur = 1.0-smoothstep(2.0*LW-aa,2.0*LW+aa, distCur);
    vec4  colorBar = vec4(mix(   vec3(1),vec3(0),smoothstep(LW-aa,LW+aa, distBar)),alphaBar);
    vec4  colorCur = vec4(mix(cheapGloss,vec3(0),smoothstep(LW-aa,LW+aa, distCur)),alphaCur);
    return mix(colorBar,colorCur,colorCur.a);
}

#define withinUnitRect(a) (a.x>=0. && a.x<=1. && a.y>=0. && a.y<=1.0)
vec4 SLIDER_drawAll(vec2 uv, vec2 cMin, vec2 cMax, vec2 muv)
{
    float width = cMax.x-cMin.x;
    float height = cMax.y-cMin.y;
    vec2 ar = vec2(0.30,1.0);
    uv  = (uv -cMin)/vec2(width,height); //pixel Normalization
    muv = (muv-cMin)/vec2(width,height); //mouse Normalization
    if( withinUnitRect(uv))
    {
        float t = SLIDER_getValue(uv.x);
		bool bHighlight = withinUnitRect(muv) && abs(floor(uv.x*4.0)-floor(muv.x*4.0))<0.01;
		uv.x = fract(uv.x*4.0); //repeat 4x
		uv.y = uv.y/0.75-0.125; //25% margins
        return SLIDER_drawSingle(vec2(uv.x*2.-.5, uv.y),t,ar,bHighlight);
    }
    return vec4(0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 cMinSliders = vec2(0.8,0.80);
    vec2 cMaxSliders = vec2(1.0,1.0);
    vec2 uvSliders = fragCoord.xy / iResolution.xy;

    vec2 mousePos = iMouse.xy / iResolution.xy;
    // SLIDER_init(mousePos, cMinSliders, cMaxSliders);
    
    if(length(fragCoord.xy-vec2(0,0))<1.) 
         fragColor = sliderVal;
    else {
		if (!withinUnitRect(uvSliders)) 
            discard;    
    	fragColor = SLIDER_drawAll(uvSliders,cMinSliders, cMaxSliders, mousePos);
	}
}
`;

export default class implements iSub {
  key(): string {
    return 'Xt3SR4';
  }
  name(): string {
    return 'Interactive thinks';
  }
  sort() {
    return 507;
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
    return [webglUtils.DEFAULT_NOISE, { type: 1, f: buffA, fi: 1 }];
  }
}
