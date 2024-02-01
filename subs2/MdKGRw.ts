import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// define your sliders in BufA.  value [0,1]  = UI(i).a    , i=1..16
// define your buttons in BufA.  value {-1,1} = UI(i+16).a , i=1..16
// get mouse position enriched by demo-mode in UI(33)
// get prev mouse position in UI(34) (e.g.: detect move, get velocity, direction...)

// see below functions for
// - reading the keyboard
// - drawing sliders and buttons
// - drawing floats and digits
// - demoing the mouse states


// --- keyboard -----------------------------------------------------

// FYI: LEFT:37  UP:38  RIGHT:39  DOWN:40   PAGEUP:33  PAGEDOWN:34  END : 35  HOME: 36

bool keyToggle(int ascii) {
	return (texture(iChannel2,vec2((.5+float(ascii))/256.,0.75)).x > 0.);
}
bool keyClick(int ascii) {
	return (texture(iChannel2,vec2((.5+float(ascii))/256.,0.25)).x > 0.);
}

float segment(vec2 uv, bool On) {
	return (On) ?  (1.-smoothstep(0.08,0.09+float(On)*0.02,abs(uv.x)))*
			       (1.-smoothstep(0.46,0.47+float(On)*0.02,abs(uv.y)+abs(uv.x)))
		        : 0.;
}

float digit(vec2 uv,int num) {
	float seg= 0.;
    seg += segment(uv.yx+vec2(-1., 0.),num!=-1 && num!=1 && num!=4                    );
	seg += segment(uv.xy+vec2(-.5,-.5),num!=-1 && num!=1 && num!=2 && num!=3 && num!=7);
	seg += segment(uv.xy+vec2( .5,-.5),num!=-1 && num!=5 && num!=6                    );
   	seg += segment(uv.yx+vec2( 0., 0.),num!=-1 && num!=0 && num!=1 && num!=7          );
	seg += segment(uv.xy+vec2(-.5, .5),num==0 || num==2 || num==6 || num==8           );
	seg += segment(uv.xy+vec2( .5, .5),num!=-1 && num!=2                              );
    seg += segment(uv.yx+vec2( 1., 0.),num!=-1 && num!=1 && num!=4 && num!=7          );	
	return seg;
}

float showNum(vec2 uv,int nr, bool zeroTrim) { // nr: 2 digits + sgn . zeroTrim: trim leading "0"
	if (abs(uv.x)>2.*1.5 || abs(uv.y)>1.2) return 0.;

	if (nr<0) {
		nr = -nr;
		if (uv.x>1.5) {
			uv.x -= 2.;
			return segment(uv.yx,true); // minus sign.
		}
	}
	
	if (uv.x>0.) {
		nr /= 10; if (nr==0 && zeroTrim) nr = -1;
		uv -= vec2(.75,0.);
	} else {
		uv += vec2(.75,0.); 
		nr = int(mod(float(nr),10.));
	}

	return digit(uv,nr);
}

float dots(vec2 uv, int dot) { // dot: bit 0 = bottom dot; bit 1 = top dot
	float point0 = float(dot/2),
		  point1 = float(dot)-2.*point0; 
	uv.y -= .5;	float l0 = 1.-point0+length(uv); if (l0<.13) return (1.-smoothstep(.11,.13,l0));
	uv.y += 1.;	float l1 = 1.-point1+length(uv); if (l1<.13) return (1.-smoothstep(.11,.13,l1));
	return 0.;
}
//    ... end of digits adapted from Andre

#define STEPX .875
#define STEPY 1.5
float _offset=0.; // auto-increment useful for successive "display" call

// 2digit int + sign
float display_digit(vec2 uv, float scale, float offset, int number, int dot) { // dot: draw separator

	uv = (uv-0.)/scale*2.; 
    uv.x = .5-uv.x + STEPX*offset;
	uv.y -= 1.;
	
	float seg = showNum(uv,number,false);
	offset += 2.;
	
	if (dot>0) {
		uv.x += STEPX*offset; 
		seg += dots(uv,dot);
		offset += 2.;
	}

	_offset = offset;
	return seg;
}

// 2.2 float + sign
float display_float(vec2 pos, float scale, float offset, float val) { // dot: draw separator
	if (display_digit( pos, scale, 0., int(val), 1)>0.) return 1.;
    if (display_digit( pos, scale, _offset, int(fract(abs(val))*100.), 0)>0.) return 1.;
	return 0.;
}



// --- sliders and mouse widgets -------------------------------------------

vec2 R;
#define UI(x) texture(iChannel0,(vec2(x,0)+.5)/R)
#define Swidth  .004
#define Sradius .02
#define Bradius .04
#define Mradius .02

vec4 affMouse(vec2 uv)  { // display mouse states ( color )
    vec4 mouse = UI(33);                       // current mouse pos
    float k = length(mouse.xy/R.y-uv)/Mradius,
          s = sign(mouse.z);
	if (k<1.) 
	    if (k>.8) return vec4(1e-10);
		   else   return vec4(s,1.-s,0,1); 
	
    k = length( UI(34).xy/R.y-uv)/Mradius;     // prev mouse pos 
	if (k<1.) 
	    if (k>.8) return vec4(1e-10);
		   else   return vec4(0,0,1,1); 
            
    k = length(abs(mouse.zw)/R.y-uv)/Mradius;  // drag start  mouse pos 
	if (k<1.) 
	    if (k>.8) return vec4(1e-10);
		   else   return vec4(0,.4,s,1); 
	
	return vec4(0);
}


float aff_sliders(vec2 U) { // display sliders ( grey level or 0.)
    for (float i=0.; i<16.; i++) {
        if (i>=UI(0).x) break;
        vec4 S = UI(i+1.);
        float l = abs(S.z);
        if (S.z>0. && abs(U.y-S.y)<Swidth && abs(U.x-S.x-l/2.)<l/2. ) return 1.;
        if (S.z<0. && abs(U.x-S.x)<Swidth && abs(U.y-S.y-l/2.)<l/2. ) return 1.;
        if (S.z>0. && length(U-S.xy-vec2(S.a*l,0))<Sradius ) return 1.;
        if (S.z<0. && length(U-S.xy-vec2(0,S.a*l))<Sradius ) return 1.;
    }
    return 0.;       
}

float aff_buttons(vec2 U) { // display buttons ( grey level or 0.)
    for (float i=0.; i<16.; i++) {
        if (i>=UI(0).y) break;
        vec4 S = UI(i+17.);
        float l = length(U-S.xy);
        if (l < Bradius) 
            if (S.a>0.) return 1.; 
            else return .3+smoothstep(.7,1.,l/Bradius);
    }
    return 0.;
}        

        

// --------------------------------------------------

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    R = iResolution.xy;
	vec2 uv = fragCoord.xy/R.y;
    vec4 mouse = UI(33)/R.y;
    
	// display sliders and buttons 
	{ float s = aff_sliders(uv); if (s>0.) { fragColor = s*vec4(1,.2,0,1); return;}}
    { float b = aff_buttons(uv); if (b>0.) { fragColor = b*vec4(0,0,1,1);  return;}}

	
	// display counters
	vec2 pos ; 
	float scale = 0.1;
	
	pos = vec2(.2,.8);    if (display_float( uv-pos, scale, 0., mouse.x*100.)>0.) { fragColor=vec4(1); return;}
	pos.y -= STEPY*scale; if (display_float( uv-pos, scale, 0., mouse.y*100.)>0.) { fragColor=vec4(1); return;} 
	pos.y -= STEPY*scale; if (display_float( uv-pos, scale, 0., UI(1).a*100.)>0.) { fragColor=vec4(1); return;}
	pos.y -= STEPY*scale; if (display_float( uv-pos, scale, 0., UI(2).a*100.)>0.) { fragColor=vec4(1); return;} 
	pos.y -= STEPY*scale; if (display_float( uv-pos, scale, 0., mod(iTime,60.))>0.) { fragColor=vec4(1); return;} 

    // display mouse states
    fragColor = affMouse(uv); if (fragColor!=vec4(0)) return; 
	 	
    fragColor= .3*vec4(uv,.5+.5*sin(iTime),1);
}
`;

const f = `
#define FAKE_MOUSE 1 // fake mouse motion if no user input
#define Sradius .02  // influence radius for sliders
#define Bradius .04  // influence radius for buttons

#define HORIZ   1.
#define VERTIC -1.


#define UI(x) texture(iChannel0,(vec2(x,0)+.5)/R)

#define add_slider(x,y,d,l,v0) { nbS++; if (U==vec2(nbS,0.))    O = vec4(x,y,(l)*(d),v0); }
#define add_button(x,y,v0)     { nbB++; if (U==vec2(nbB+16,0.)) O = vec4(x,y,0,v0);       }


void mainImage( out vec4 O,  vec2 U )
{
    vec2 R = iResolution.xy;
    O = texture(iChannel0,U/R);
    U -= .5;
    
    if (iFrame==0) {
        int nbS = 0, nbB = 0;
        
        add_slider (.15,.05,HORIZ, .5,.3); // --- define your sliders here ---
        add_slider (.15,.10,HORIZ, .5,.6); // read value [0,1] in UI(i).a  , i=1..16
        add_slider (.05,.15,VERTIC,.5,.0);
        add_slider (.10,.15,VERTIC,.5,.9);
        
        add_button ( .9,.2,  1.);          // --- define your buttons here ---
        add_button ( .9,.1, -1.);          // read value {-1,1} in UI(i+16).a , i=1..16
        add_button ( 1.,.2,  1.);          
        add_button ( 1.,.1, -1.);          
        
        if (U==vec2(0,0)) O.xy = vec2(nbS, nbB);
        return;
    }
    
    if (U==vec2(33,0)) {  // previous mouse state (for BufA) our mouse state (other shaders)
        vec4 m = iMouse;
#if FAKE_MOUSE
        if (length(m.xy)<10. && m.z<=0.) { // fake mouse motion if no user input
	        float t = iTime;         // you can reset this state by putting the mouse back in the corner
	        m.xy = (.5+.4*vec2(cos(t),sin(t)))*R;
	    }   
#endif
        O = m;
        return; 
    }              
    if (U==vec2(34,0)) { O = UI(33); return; } // previous mouse state (for other shaders)
    
    if (iMouse.z>0. && U.y==0.) {          // --- let mouse trigers the right slider or button
       	vec2 M = iMouse.xy/iResolution.y;
        if (U.x <= UI(0).x) {
	        vec4 S = UI(U.x);
    	    float l = abs(S.z);
        	vec2 m = iMouse.xy/iResolution.y;
	        if (S.z>0. && abs(M.y-S.y)<Sradius && abs(M.x-S.x-l/2.)<l/2. ) O.a = (M.x-S.x)/l;
    	    if (S.z<0. && abs(M.x-S.x)<Sradius && abs(M.y-S.y-l/2.)<l/2. ) O.a = (M.y-S.y)/l;
    	}
        else if (UI(33).z<0. &&  U.x>16. && U.x<=16.+UI(0).y ) {
	        vec4 S = UI(U.x);
            if (length(M-S.xy)<Bradius) O.a *= -1.;
        }
    }
        
}
`;

export default class implements iSub {
  key(): string {
    return 'MdKGRw';
  }
  name(): string {
    return 'digits/sliders/kbd widgets - 2';
  }
  sort() {
    return 274;
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
    return [{ type: 1, f, fi: 0 }];
  }
}
