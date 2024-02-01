import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//C64 Simulation by nimitz (twitter: @stormoid)

/*
	Features:
		-RGB to C64 palette using LAB space for color differencing
		-Auto dithering (could be improved)
		-C64 resolution and aspect ratio
*/

//#define time iTime

#define C64_COLOR
#define C64_PIXELS
#define AUTO_DITHER
//#define SHOW_PALETTE

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}


//-------------------------------------------------------------------
//---------------------------RGB to C64------------------------------
//-------------------------------------------------------------------

vec3 pal[16];  //Palette from: http://www.pepto.de/projects/colorvic/
void setpal()
{
    pal[0]=vec3(0),pal[1]=vec3(1),pal[2]=vec3(0.4530,0.2611,0.2089),pal[3]=vec3(0.4845,0.6764,0.7286), pal[4]=vec3(0.4825,0.2829,0.5663),pal[5]=vec3(0.3925,0.5921,0.3087),
    pal[6]=vec3(0.2500,0.1972,0.5206), pal[7]=vec3(0.7500,0.8028,0.4794),pal[8]=vec3(0.4825,0.3576,0.1837),pal[9]=vec3(0.3082,0.2691,0.0000),pal[10]=vec3(0.6405,0.4486,0.3964),
    pal[11]=vec3(0.3125,0.3125,0.3125),pal[12]=vec3(0.4688,0.4688,0.4688),pal[13]=vec3(0.6425,0.8421,0.5587),pal[14]=vec3(0.4688,0.4159,0.7393),pal[15]=vec3(0.6250,0.6250,0.6250);
}

float rectify(in float f){ return mix(pow(((f + 0.055)/1.055), 2.4), f / 12.92, step(f, 0.04045))*100.; }
float pivot(in float x){ return mix(pow(x,0.3333), (903.3*x + 16.)/116., step(x,216.0/24389.0)); }
//RGB to Lab (for color differencing) https://github.com/THEjoezack/ColorMine
vec3 rgb2lab(in vec3 c)
{
	c.r = rectify(c.r);
	c.g = rectify(c.g);
	c.b = rectify(c.b);
	c  *= mat3( 0.4124, 0.3576, 0.1805,
          		0.2126, 0.7152, 0.0722,
                0.0193, 0.1192, 0.9505);
	vec3 w = normalize(vec3(1.3,1.33,1.1));
	c.x = pivot(c.x/w.x);
	c.y = pivot(c.y/w.y);
	c.z = pivot(c.z/w.z);
	
	return vec3(max(0.,116.*c.y-16.), 500.*(c.x-c.y), 200.*(c.y-c.z));
}

float hash(in float n){return fract(sin(n)*43758.5453);}
//Using CIE76 for color difference, mainly because it is much cheaper
vec3 c64(in vec3 c, in vec2 p)
{
    c = clamp(c,.0,1.);
    
    vec3 hsv = rgb2lab(c);
    float d = 100000.;
    float d2 = 100000.;
    vec3 c2 = vec3(0);
    for(int i=0;i<16;i++)
    {
        vec3 ch = rgb2lab(pal[i]);
        float cd = distance(hsv,ch);
        if (cd < d)
        {
            d2 = d;
            c2 = c;
            d = cd;
            c = pal[i];
        }
        else if(cd < d2)
        {
            d2 = cd;
            c2 = pal[i];
        }
    }
    
    const float sclx = 320.;
    const float scly = 200.;
    float id = floor(p.x*sclx)*1.1+floor(p.y*scly)*2.;
    float px = mod(floor(p.x*sclx)+floor(p.y*scly),2.);
#ifdef AUTO_DITHER
    float rn = hash(id);
    if (rn < smoothstep(d2*0.96, d2*1., d*1.01) && (px ==0.))c=c2;
#endif
    return pow(abs(c),vec3(1.136));  //correct gamma
}



//-------------------------------------------------------------------
//--------------------------Effects----------------------------------
//-------------------------------------------------------------------

float tri(in float x){return abs(fract(x)-0.5);}

//from iq
vec3 hsl2rgb(in vec3 c){
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 hsv2rgb(in vec3 c){
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
	
    return c.z * mix( vec3(1.0), rgb, c.y);
}

vec3 fx1(in vec2 p)
{
    return hsl2rgb(clamp(vec3(p.x,p.y,p.y),0.,1.));
}

//Plasma
vec3 fx2(in vec2 p)
{
    vec3 rz = vec3(0);
    const float q = 5.;
    float x = sin(iTime*0.8+p.x*q)+sin(iTime+p.x*q)+sin(iTime*0.9+p.y*q)+sin(iTime*0.82+p.y*q*2.)+sin(p.x*1.+iTime*1.1)*3.;
    rz = sin(vec3(1,2,3)*x+iTime*2.);
    return rz;
}

//Scrollbars
vec3 fx3(in vec2 p)
{
    vec3 rz = vec3(0);
    float xx = abs(sin((p.x+p.y)*10.+iTime*5.))*abs(sin(iTime*2.+p.x+p.y));
    rz = hsv2rgb(vec3(0.6+(p.x+p.y)*0.3+iTime*0.1,.82,5.))*xx;
    return rz;
}

//"Borrowed" from: "Fairlight - We are new" (http://www.pouet.net/prod.php?which=56000)
vec3 fx4(in vec2 p, in vec2 bp)
{
    vec3 rz = vec3(0);
    float id = floor(p.x*80.);
    float rn = hash(id+0.3);
    
    if (rn < 0.5)rz = vec3(.5,.5,0);
    else if(rn < 0.7)rz = vec3(0,.5,0);
   	else rz = vec3(0.5,1.,0.5);
        
    rz *= step(fract(p.y*.5+iTime*0.015+rn*(iTime+10.)*0.15)+.1,0.5);
    return rz;
}

float smoothfloor(in float x, in float k)
{
    k = clamp(k, 0., 1.);
    float xk = x+k*0.5;
    return floor(xk)+smoothstep(0.,k,fract(xk));
}

//Colored checkered grid  
vec3 fx5(in vec2 p)
{
    p -= 0.5;
    vec2 bp = p;
    
    p.y -= 0.35;
    p = vec2(p.x/p.y, 1./p.y);
    
    p.y += sin(iTime*.1)*20.+27.;
    p.x += sin(iTime*.2)*15.;
    p*= 2.;
    
    vec2 q = floor(p)*20.;
    
    float id = q.x + q.y;
    id *= sin(q.x*10.1+q.y*100.)*.5+.5;
    
    vec3 col = abs(sin(vec3(1,3,5)+id*0.01+iTime*0.5))*0.75;
    col /= sin(.9*iTime+id)*2.;
    
    //separators
    col *= smoothstep(.005,.04,abs(fract(p.x+0.5)-0.5));
    col *= smoothstep(.01,.04,abs(fract(p.y+0.5)-0.5));
    
    float g = (bp.y + iTime*0.05)*30.;
    vec3 bg = sin(vec3(1,2,3)+floor(g))*0.5+abs(sin(g-iTime*2.5)*.8);
    col = mix(bg, clamp(col,0.,1.), smoothstep(0.089,.09,-bp.y+0.35));
    
    return col;
}

vec4 balls(in vec2 p, in float of)
{
    p *= 1.5;
    float t = iTime*0.6+of;
    
    t = mod(t,4.);
    p.x += t;
    
    const float scl = 7.;
    float id = t-floor(p.x*scl)/scl+0.5;
    if (mod(p.x,2.) > 1.)return vec4(0);
    
    float pd1 = exp(id+1.)*id*id*2.-.3;
    float pd2 = exp(id+1.)*id*id*id*4.-.2;
    
    p.y += mix(pd1,pd2,sin(iTime*1.+of*3.)*0.5+0.5);
    p = vec2(fract(p.x*scl)-0.5,p.y*scl);
    
    float rz =length(p);
    float rz2 = rz;
    id = clamp(id*0.4,-0.22,.04);
    float rz3 = smoothstep(-0.1-id,.4-id,rz);
    rz = smoothstep(0.25-id,.3-id,rz);
    vec3 col = (abs(sin(vec3(1,2,3)+of*5.))*0.6)*(1.-rz);
    
    vec3 ligt = normalize(vec3(-.5,2.,.5));
    ligt.xy *= mm2(iTime*.8);
    vec3 nor = normalize(vec3(p,rz));
    col += rz2*(dot(nor,ligt))*vec3(20.*(id+0.5))*(1.-rz3);
    return vec4(col,1.-rz);
}

vec3 fx6(in vec2 p)
{
    vec3 col = vec3(0);
    float rz= 1.;
    p -= 0.5;
    p *= mm2(iTime*.8);
    p.x += 0.3;
    for(float i=0.;i<6.;i++)
    {
        vec4 rez = balls(p,i*.1);
        //vec4 rez = balls(p,i*(.75));
        col = col*(1.-smoothstep(0.,1.,rez.w))+rez.rgb;
        p.x += 0.09;
    }
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	setpal();
    //C64 native resolution (320x200)
    vec2 p = fragCoord.xy / iResolution.xy;
    vec2 bp = p;
    float asp = iResolution.x/iResolution.y;
   	
    //Ensure 16:10 and center it
    if(iResolution.x*.625 > iResolution.y)
	{
		p.x *= asp*0.625;
		p.x -= (asp*0.625-1.)*0.5;
	}
	else
	{
		p.y *= 1./asp*1.6;
		p.y -= (1.6/asp-1.)*0.5;
	}
    
    #ifdef C64_PIXELS
    p.x = floor(p.x*320.)/320.;
    p.y = floor(p.y*200.)/200.;
    #endif
    
#ifdef SHOW_PALETTE
  	vec3 col = fx1(p);  
#else
    
    //float tx = time-.5;
    //p += (hash(tx)-0.5)*0.01*smoothstep(-.8,1.,sin(tx*3.4))*smoothstep(7.4,7.5,tx);
    
    //background
    vec3 col = mix(vec3(0,0.4,1.),vec3(0.,0.2,.5),step(abs(p.y-0.5),0.4)*step(abs(p.x-0.5),0.4));
    
    float time = max((iTime*0.95)-3.5,0.);
    
    //bg transition
    col = mix(mix(col,fx5(p),smoothstep(-.07,.07,sin(3.9+time*0.1)+0.45 )),fx6(p),clamp(smoothstep(40.,43.,time),0.,1.));
    
    
    vec2 qq = p+vec2(smoothstep(0.,.6,sin(time*.28+1.7))*1.5,0)+vec2(smoothstep(40.,50.,time)*1.5,0);
    float t= time*1. + sin(time*1.5+3.5)*1.;
    vec2 q = qq+vec2(sin(t+1.57)*2.,sin(time))*0.2 + clamp(6.-time*0.25,0.,1.);
    float d = max(abs(q.x-0.5),abs(q.y-0.5));
    float sz = 0.22+sin(t)*0.1;
    if(d < sz)
        col = fx4(q,bp);
    float brd = 1.-smoothstep(0.,0.01,abs(abs(d)-sz));
    col = mix(col, sin(vec3(.3,.7,.5)+brd*2.+4.7)*1., smoothstep(0.0,.01,brd));
    
    
    t += 1.8;
    float d2 = 0.;
    float sz2 = 0.22+sin(t)*0.1;
    if (sz2 > sz || d > sz+0.01)
    {
        vec2 q = qq+vec2(sin(t+1.57)*2.,sin(time))*0.2 + clamp(3.-time*0.25,0.,1.);
        d2 = max(abs(q.x-0.5),abs(q.y-0.5));
        if(d2 < sz2) col = fx3(q);
        float brd = 1.-smoothstep(0.,0.01,abs(abs(d2)-sz2));
    	col = mix(col, sin(vec3(.0,.5,.5)+brd*2.+4.5)*1., smoothstep(0.0,.01,brd));
        
        
        t += 1.8;
        float sz3 = 0.22+sin(t)*0.1;
        if (sz3 > sz2 || d2 > sz2+0.007)
        {
            vec2 q = qq+vec2(sin(t+1.57)*2.,sin(time))*0.2 + clamp(1.-time*0.25,0.,1.);
            d = max(abs(q.x-0.5),abs(q.y-0.5));
            if(d < sz3)
                col = fx2(q);
            float brd = 1.-smoothstep(0.,0.01,abs(abs(d)-sz3));
    	col = mix(col, sin(vec3(.9,.3,.55)+brd*1.8+4.5)*1., smoothstep(0.0,.01,brd));
        }
    }
    
#endif
    
	#ifdef C64_COLOR
    col = c64(col,bp);
    #endif
    
    //clip screen to 16:10
    if (p.x > 1. || p.x <0. || p.y > 1. || p.y <0.)col = vec3(0);
    
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'Mll3DH';
  }
  name(): string {
    return 'C64 Simulation';
  }
  sort() {
    return 351;
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
