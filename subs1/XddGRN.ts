import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//Here you can define the color space you want to visualize
//TYPE 1 = CIE Lab,  TYPE 2 = XYZ (CIE 1931), TYPE 3 = RGB
uniform int u_type;

//This is only used for the Lab and Lch spaces
//You can radically change the mapping by varying those values
const vec3 wref =  vec3(.95047, 1.0, 1.08883); 
//const vec3 wref =  vec3(1.0,1.,1.);

//If showing Lab space (Type 1), you can use this define to 
//see the difference betweem sRGB mapping and "Adobe RGB" mapping
uniform bool u_adobe;

#define MOUSE_Y_CUTS_SPACE


#define time iTime
mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
vec2 mo;

//---------------------------------------------------------------------------------
//--------------------------------Color Functions----------------------------------
//---------------------------------------------------------------------------------

//I'm keeping the functions self-contained, so that will inlcude subsets of each other
//Example: the forward Lch function includes RGB->XYZ, XYZ->Lab and Lab-Lch

//----------------------sRGB----------------------
float sRGB(float t){ return mix(1.055*pow(t, 1./2.4) - 0.055, 12.92*t, step(t, 0.0031308)); }
vec3 sRGB(in vec3 c) { return vec3 (sRGB(c.x), sRGB(c.y), sRGB(c.z)); }

//This is only useful if you have non-linear (sRGB) inputs and 
//want to convert them to linear for in-shader calculations
float linearize(float t){ return mix(pow(((t + 0.055)/1.055), 2.4), t / 12.92, step(t, 0.04045)); }
vec3 linearize(in vec3 c){ return vec3(linearize(c.x), linearize(c.y), linearize(c.z)); }

//----------------------XYZ----------------------
vec3 rgb2xyz(in vec3 c)
{
    return c*mat3(0.4124, 0.3576, 0.1805,
          		  0.2126, 0.7152, 0.0722,
                  0.0193, 0.1192, 0.9505);
}

vec3 xyz2rgb(in vec3 c)
{
    vec3 rgb = c*mat3( 3.2406, -1.5372,-0.4986,
          		      -0.9689,  1.8758, 0.0415,
    				   0.0557,  -0.2040, 1.0570);
    return rgb;
}

//These are used for Lab and Lch functions
float xyzF(float t){ return mix(pow(t,1./3.), 7.787037*t + 0.139731, step(t,0.00885645)); }
float xyzR(float t){ return mix(t*t*t , 0.1284185*(t - 0.139731), step(t,0.20689655)); }

//----------------------CIE Lab----------------------
vec3 rgb2lab(in vec3 c)
{
	c  *= mat3( 0.4124, 0.3576, 0.1805,
          		0.2126, 0.7152, 0.0722,
                0.0193, 0.1192, 0.9505);
    
    c.x = xyzF(c.x/wref.x);
	c.y = xyzF(c.y/wref.y);
	c.z = xyzF(c.z/wref.z);
	
	return vec3(max(0.,116.*c.y - 16.0), 500.*(c.x - c.y), 200.*(c.y - c.z));
}

vec3 lab2rgb(in vec3 c)
{   
    float lg = 1./116.*(c.x + 16.);
    vec3 xyz = vec3(wref.x*xyzR(lg + 0.002*c.y),
    				wref.y*xyzR(lg),
            wref.z*xyzR(lg - 0.005*c.z));
    vec3 rgb;
    if(u_adobe) {
      rgb = xyz*mat3( 2.0413690, -0.5649464, -0.3446944,
        -0.9692660,  1.8760108,  0.0415560,
         0.0134474, -0.1183897,  1.0154096);
    }
    else {
      rgb = xyz*mat3( 3.2406, -1.5372,-0.4986,
        -0.9689,  1.8758, 0.0415,
         0.0557,  -0.2040, 1.0570);
    }
    return rgb;
}

//----------------------CIE Lch----------------------
vec3 rgb2lch(in vec3 c)
{
	c  *= mat3( 0.4124, 0.3576, 0.1805,
          		0.2126, 0.7152, 0.0722,
                0.0193, 0.1192, 0.9505);
    c.x = xyzF(c.x/wref.x);
	c.y = xyzF(c.y/wref.y);
	c.z = xyzF(c.z/wref.z);
	vec3 lab = vec3(max(0.,116.0*c.y - 16.0), 500.0*(c.x - c.y), 200.0*(c.y - c.z)); 
    return vec3(lab.x, length(vec2(lab.y,lab.z)), atan(lab.z, lab.y));
}

vec3 lch2rgb(in vec3 c)
{
    c = vec3(c.x, cos(c.z) * c.y, sin(c.z) * c.y);
    
    float lg = 1./116.*(c.x + 16.);
    vec3 xyz = vec3(wref.x*xyzR(lg + 0.002*c.y),
    				wref.y*xyzR(lg),
    				wref.z*xyzR(lg - 0.005*c.z));
    
    vec3 rgb = xyz*mat3( 3.2406, -1.5372,-0.4986,
          		        -0.9689,  1.8758, 0.0415,
                	     0.0557,  -0.2040, 1.0570);
    
    return rgb;
}

//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------

float sbox( vec3 p, vec3 b ){
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float map(vec3 p)
{
    float d=  sbox(p, vec3(1.));
#ifdef MOUSE_Y_CUTS_SPACE
if(u_type == 1) {
  d = max(d, -sbox(p + vec3(.9 + mo.y*0.35,0.0,0), vec3(1.)));
}
else {
  d = max(d, -sbox(p + vec3(1.4 + mo.y*0.35,0.0,0), vec3(1.)));
}
#endif
    return d;
} 

vec3 marchCol(in vec3 ro, in vec3 rd)
{
    float h = 1.0;
    float d = 0.;
    vec3 col = vec3(0);
    vec3 colLast = vec3(0);
    const float prc = 1e-8;
    const float sz = 115.;
    for( int i=0; i<240; i++ )
    {
        d += clamp(h,0.01,1.);
        vec3 pos = ro+rd*d;
        vec3 col2;
        if(u_type == 1) {
          col2 = lab2rgb(vec3(pos.x*sz,pos.y*sz , pos.z*sz));
        }
        else if(u_type == 2) {
          col2 = xyz2rgb(vec3(pos.x+0.5, pos.y+0.5, pos.z+0.5));
        }
        else {
          col2 = vec3(pos.x+0.5, pos.y+0.5, pos.z+0.5);
        }
        col2 = sRGB(col2);
        
        h = map(pos);
        col2 = clamp(col2, 0., 1.);
        
        if (h < 0.)
        if ((abs(col2.r-colLast.r) > prc)  && (abs(col2.g-colLast.g) > prc) && (abs(col2.b-colLast.b) > prc))
        {
        	col= col2;
            break;
        }
        colLast = col2;
    }
	return col;
}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}
vec3 roty(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(-0.15,1.):mo;
	mo.x *= iResolution.x/iResolution.y;
	mo *= 4.;
    
  vec3 ro;
  if(u_type == 1) {
    ro = vec3(0.,-0.1,3.5);
  }
  else if(u_type == 2) {
    ro = vec3(0.,0.0,2.5);
  }
  else {
    ro = vec3(0.,0.0,3.0);
  }
    vec3 rd = normalize(vec3(p,-1.5));
    float rx = mo.x+time*0.1;
    float ry = sin(time*0.6)*0.2;
    ro = rotx(ro,ry), rd = rotx(rd, ry);
    ro = roty(ro, rx), rd = roty(rd, rx);
	
    vec3 col = marchCol(ro, rd);
	fragColor = vec4( col, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_type: 0,
  u_adobe: false,
};

export default class implements iSub {
  key(): string {
    return 'XddGRN';
  }
  name(): string {
    return '3d color space visualization';
  }
  sort() {
    return 101;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_type', [0, 1, 2]);
    gui.add(api, 'u_adobe');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_type = webglUtils.getUniformLocation(gl, program, 'u_type');
    const u_adobe = webglUtils.getUniformLocation(gl, program, 'u_adobe');
    return () => {
      u_type.uniform1i(api.u_type);
      u_adobe.uniform1i(api.u_adobe ? 1 : 0);
    };
  }
}
