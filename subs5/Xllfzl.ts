import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define CAMERA_POS		0
#define CAMERA_TAR		1
#define SUN_DIRECTION 	2
#define CROW_POS		3
#define CROW_HEADING	4
#define CROW_FLAPPING	5
#define CROW_HEADTILT	6
#define CROW_TURN		7
#define CROW_CLIMBING	8

#define FAR 850.

#define TAU 6.28318530718
#define SUN_COLOUR vec3(1.1, .95, .85)
#define FOG_COLOUR vec3(.48, .49, .53)

vec3 sunLight, crowPos;

//----------------------------------------------------------------------------------------

vec3 cameraPath( float z )
{
	return vec3(100.2*sin(z * .0045)+90.*cos(z *.012), 43.*(cos(z * .0047)+sin(z*.0013)) + 53.*(sin(z*0.0112)), z);
}
// Set up a camera matrix

//--------------------------------------------------------------------------
mat3 setCamMat( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

float hash11(float p)
{
	vec3 p3  = fract(vec3(p) * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

`;

const buffA = `
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// These are indices into the variable data in this buffer...


//----------------------------------------------------------------------------------------
float noise( in float p  )
{
    float f = fract(p);
    p = floor(p);
	f = f*f*(3.0-2.0*f);
	return mix(hash11(p),hash11(p+1.), f);
}
//----------------------------------------------------------------------------------------
float noiseTilt( in float p  )
{
    float f = fract(p);
    p = floor(p);
	f = f*f*(3.0-2.0*f);
    
    f = f*f*f*f;
	return mix(hash11(p),hash11(p+1.), f);
}
//----------------------------------------------------------------------------------------
float grabTime()
{
  	float m = (iMouse.x/iResolution.x)*80.0;
	return (iTime+m+110.)*32.;
}

//----------------------------------------------------------------------------------------
int StoreIndex(ivec2 p)
{
	return p.x + 64 * p.y;
}

//----------------------------------------------------------------------------------------
vec4 getStore(int num)
{
   	//ivec2 loc = ivec2(num & 63, num/64); // Didn't need that many, doh!
    ivec2 loc = ivec2(num, 0);
    return  texelFetch(iChannel0, loc, 0);
}

//----------------------------------------------------------------------------------------
void mainImage( out vec4 fragColour, in vec2 fragCoord )
{
    ivec2 pos = ivec2(fragCoord);
    vec4 col = vec4(0.);
	float gTime = grabTime();
    
    int num = StoreIndex(pos);
    if (num > CROW_CLIMBING) discard;
    
    vec4 diff = (getStore(CROW_HEADING) - getStore(CROW_POS)) * vec4(-.07,.3, 1,1);
    float climb  = diff.y;
    float oldClimb  = getStore(CROW_CLIMBING).x;

    switch (num)
    {
        case CAMERA_POS:
        {
            float r = gTime / 63.;
        	col.xyz = cameraPath(gTime)+vec3(sin(r*.64 )*12., cos(r*.3)*12., 0.);
           
        }
    		break;
        case CAMERA_TAR:
            col.xyz = cameraPath(gTime + 20.);
        	break;
        case SUN_DIRECTION:
        	col.xyz  = normalize( vec3(  0.7, .8,  0.3 ) );
    		break;
       	case CROW_POS:
        {
        	float r = gTime / 200.-10.;
        	col.xyz = cameraPath(gTime + 45.+ sin(r*.5)* 30.)+vec3(sin(r)*15.0, cos(r*.2)*12.0, 0.0);
            float sp = pow((clamp(oldClimb+.1,0.0, .5)), 2.2)*3.;
            
            //col.y-= sin(gTime*.25)*sp;
            vec2 ax = vec2(sin(diff.x), cos(diff.x));
            col.xy+= -ax*sin(gTime*.25)*sp;
        }
        	break;
        case CROW_HEADING:
        {
        	float r = gTime / 200.-10.;
        	col.xyz = cameraPath(gTime + 50.+ sin(r*.5)* 30.)+vec3(sin(r)*15.0, cos(r*.2)*12.0, 0.0);
        }
         	break;
        case CROW_FLAPPING:
        {
            float sp = pow((clamp(oldClimb+.1,0.0, .5)), 2.2)*3.5;
   
        	col.x  = sin(gTime*.25)*sp+ noise(gTime*.1)*.35;
            col.y  = sin(gTime*.25-1.)*sp*.5+smoothstep(0.5,.0,sp)*.1;
            
            col.z  = sin(gTime*.25)*sp+ noise(gTime*.1+8.)*.35;
            col.w  = sin(gTime*.25-1.)*sp*.5+smoothstep(0.5,.0,sp)*.1;
        }
        	break;
        case CROW_HEADTILT:
        	col.x = noiseTilt(gTime*.01+8.)*.5;
        	col.y = noiseTilt(gTime*.05+111.)-.5;
        	col.z = noiseTilt(gTime*.03)*.8+.2;
        	col.w = (noiseTilt(gTime*.04)-.5);
        	break;
        case CROW_TURN:
        	col = diff;
        	break;
        case CROW_CLIMBING:
        	// IIR leaky integrator for smoothing wing power...
        	col.x = oldClimb *.99+climb *.01;
        	break;
        

    }
    fragColour = col;
    fragColour.a = 1.;
}
`;

const buffB = `
// Render the landscape and sky...
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// These are indices into the variable data in Buf A...

float gTime, specular;



//========================================================================
// Utilities...

//----------------------------------------------------------------------------------------
// Grab value of variable, indexed 'num' from buffer A...
// Useful because each pixel doesn't need to do a whole bunch of math/code over and over again.
// Like camera positions and animations...
vec4 getStore(int num)
{
    //ivec2 loc = ivec2(num & 63, num/64); // Didn't need that many, doh!
    ivec2 loc = ivec2(num, 0);
	return  texelFetch(iChannel0, loc, 0);
}

//----------------------------------------------------------------------------------------
float  sphere( vec3 p, float s )
{
    return length(p)-s;
}

//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
float noise( in vec3 p )
{
    vec3 f = fract(p);
    p = floor(p);
	f = f*f*(3.0-2.0*f);
	
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( iChannel3, (uv+ 0.5)/256.0, 0.0).yx;
	return mix( rg.x, rg.y, f.z );
}

//--------------------------------------------------------------------------

float sMax(float a, float b, float s){
    
    float h = clamp( 0.5 + 0.5*(a-b)/s, 0., 1.);
    return mix(b, a, h) + h*(1.0-h)*s;
}


//--------------------------------------------------------------------------
// This uses mipmapping with the incoming ray distance.
// I think it also helps with the texture cache, but I don't know that for sure...
float map( in vec3 p, float di)
{
  
    di = min(di, 6.0);

    // Grab texture based on 3D coordinate mixing...
 	float te = textureLod(iChannel1, p.xz*.0022 + p.xy * 0.0023-p.zy*.0011, di).x*40.0;
    // Make a wibbly wobbly sin/cos dot product..
    float h = dot(sin(p*.0173),cos(p.zxy*.0191))*30.;
    // Add them all together...
    float d =  h+p.y*.2 + te;
    //...Then subtract the camera tunnel...
    p.xy -= cameraPath(p.z).xy;
    float tunnel = 15. - length(p.xy)-h; 

    d = sMax(d, tunnel, 80.);
    
    //d = max(tunnel, d); 

    return d;
}

//--------------------------------------------------------------------------

vec3 getSky(vec3 dir, vec2 uv, vec3 pos)
{
    vec3 col;
    vec3 clou = dir * 1. + pos*.025;
	float t = noise(clou);
    t += noise(clou * 2.1) * .5;
    t += noise(clou * 4.3) * .25;
    t += noise(clou * 7.9) * .125;
	col = mix(vec3(FOG_COLOUR), vec3(0.2, 0.2,.2),abs(dir.y))+ FOG_COLOUR *t*.4;
 
    return col;
}


//--------------------------------------------------------------------------

vec3 getNormal(vec3 p, float e)
{
    return normalize( vec3( map(p+vec3(e,0.0,0.0), e) - map(p-vec3(e,0.0,0.0), e),
                            map(p+vec3(0.0,e,0.0), e) - map(p-vec3(0.0,e,0.0), e),
                            map(p+vec3(0.0,0.0,e), e) - map(p-vec3(0.0,0.0,e), e) ) );
}

//--------------------------------------------------------------------------

float BinarySubdivision(in vec3 rO, in vec3 rD, vec2 t)
{
    float halfwayT;
  
    for (int i = 0; i < 5; i++)
    {

        halfwayT = dot(t, vec2(.5));
        float d = map(rO + halfwayT*rD, halfwayT*.008); 
        t = mix(vec2(t.x, halfwayT), vec2(halfwayT, t.y), step(0.02, d));
    }

	return halfwayT;
}

//--------------------------------------------------------------------------
float marchScene(in vec3 rO, in vec3 rD, vec2 co)
{
	float t = 10.+10.*hash12(co), oldT = 0.;
	vec2 dist = vec2(1000);
	vec3 p;
    bool hit = false;
    
    for( int j=0; j < 150; j++ )
	{
		if (t >= FAR) break;
		p = rO + t*rD;

		float h = map(p, t*0.008);
 		if(h < 0.02)
		{
            dist = vec2(oldT, t);
            break;
	     }
        oldT = t;
        t += h * .4 + t*.004;
	}
    if (t < FAR) 
    {
       t = BinarySubdivision(rO, rD, dist);
    }
    return t;
}

//--------------------------------------------------------------------------
float noise2d(vec2 p)
{
    vec2 f = fract(p);
    p = floor(p);
    f = f*f*(3.0-2.0*f);
    
    float res = mix(mix( hash12(p),  		    hash12(p + vec2(1,0)),f.x),
                    mix( hash12(p + vec2(0,1)), hash12(p + vec2(1,1)),f.x),f.y);
    return res;
}

//--------------------------------------------------------------------------
float findClouds2D(in vec2 p)
{
	float a = 1.0, r = 0.0;
    p*= .001;
    for (int i = 0; i < 5; i++)
    {
        r+= noise2d(p*=2.563)*a;
        a*=.5;
    }
	return max(r-1.1, 0.0);
}

//--------------------------------------------------------------------------
// Use the difference between two cloud densities to light clouds in the direction of the sun.
vec4 getClouds(vec3 pos, vec3 dir)
{
    if (dir.y < 0.0) return vec4(0.0);
    float d = (600. / dir.y);
    vec2 p = pos.xz+dir.xz*d;
    float r = findClouds2D(p);
    float t = findClouds2D(p+normalize(sunLight.xz)*15.);    
    t = sqrt(max((r-t)*30., .8));
    vec3 col = vec3(t) * SUN_COLOUR;
    // returns colour and alpha...
    return vec4(col, r);
}

//--------------------------------------------------------------------------
// Turn a 2D texture into a six sided one...
vec3 texCube(in sampler2D tex, in vec3 p, in vec3 n )
{
	vec3 x = textureLod(tex, p.yz, 0.0).xyz;
	vec3 y = textureLod(tex, p.zx, 0.0).xyz;
	vec3 z = textureLod(tex, p.xy, 0.0).xyz;
	return (x*abs(n.x) + y*abs(n.y) + z*abs(n.z))/(1e-20+abs(n.x)+abs(n.y)+abs(n.z));
}

//--------------------------------------------------------------------------
// Grab the colour...
vec3 albedo(vec3 pos, vec3 nor)
{
    specular  = .8;
    vec3 alb  = texCube(iChannel2, pos*.03, nor);

    // Brown the texture in places for warmth...
    float v = noise(pos*.04+20.);
    alb *= vec3(.85+v, .9+v*.5, .9);
    
    // Mossy rocky bits...
    v = pow(max(noise(pos*.03)-.4, 0.0), .7);
    alb = mix(alb, vec3(.45,.55,.45), v*v*4.);
    
	// Do ice on flat areas..
    float ice = smoothstep(0.4, .7,nor.y);
	alb = mix(alb, vec3(.5, .8,1.), ice);
    specular+=ice*.5;
    
    return alb*1.8;
}

//--------------------------------------------------------------------------
float mapCrowShad(vec3 p)
{
    float d = 0.;
    p= p-crowPos;
    d = sphere(p, 3.);
    return smoothstep(.0, 8.0, d)+.8;
}

//--------------------------------------------------------------------------
float shadow(in vec3 ro, in vec3 rd)
{
	float res = 1.0;
    
    float t = .1;
    for( int i = 0; i < 14; i++ )
    {
		float h = map(ro + rd*t, 4.);
        float g = mapCrowShad(ro + rd*t);
        h = min(g, h); 
        res = min( res, 4.*h/t );
        t += h+.35;
    }
    return clamp( res, 0., 1.0 );
}


//--------------------------------------------------------------------------
vec3 lighting(in vec3 mat, in vec3 pos, in vec3 normal, in vec3 eyeDir, in float d)
{
  
	float sh = shadow(pos+normal*.5,  sunLight);
    //sh*=curve(pos)+1.;
    // Light surface with 'sun'...
	vec3 col = mat * SUN_COLOUR*(max(dot(sunLight,normal), 0.0))*sh;

    
    // Ambient...
	col += mat  * abs(normal.y*.14);
    
    normal = reflect(eyeDir, normal); // Specular...
    col += pow(max(dot(sunLight, normal), 0.0), 10.0)  * SUN_COLOUR * sh * specular;

	return min(col, 1.0);
}


//--------------------------------------------------------------------------
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (-iResolution.xy + 2.0 * fragCoord ) / iResolution.y;
    specular = 0.0;
  	vec3 col;

    sunLight 	= getStore(SUN_DIRECTION).xyz;
    vec3 camPos = getStore(CAMERA_POS).xyz;
    vec3 camTar = getStore(CAMERA_TAR).xyz;
    crowPos  	= getStore(CROW_POS).xyz;
  
    // Setup an epic fisheye lens for the ray 'dir'....
    mat3 camMat = setCamMat(camPos, camTar, (camTar.x-camPos.x)*.02);
    vec3 dir = camMat * normalize( vec3(uv, cos((length(uv*.5)))));

    // The sky is a general mix of blue to fog colour with 3D 'cold' clouds, for mixing with the distance fogging effect...
    vec3 sky = getSky(dir, uv, camPos);
    //March it...
    float dhit = marchScene(camPos, dir, fragCoord);
    // Render at distance value...
    if (dhit < FAR)
    {
	   	vec3  p = camPos+dhit*dir;
        float pixel = iResolution.y;
       	vec3 nor =  getNormal(p, dhit/pixel);
       	vec3 mat = albedo(p, nor);
		vec3  temp = lighting(mat, p, nor, dir, dhit);
		// Distance fog...
       	temp = mix(sky, temp , exp(-dhit*.0015)-.1);
       	col = temp;
    }else
	{
 
        // Clouds and Sun...
        col = sky;
        vec4 cc = getClouds(camPos, dir);
       
        col = mix(col, cc.xyz, cc.w);

        col+= pow(max(dot(sunLight, dir), 0.0), 200.0)*SUN_COLOUR;
    }
   	//col *= vec3(1.1,1.0,1.0);
    
	//col = mix( col, vec3(dot(col,vec3(0.333))), 0.4 );
    //col = col*0.5+0.5*col*col*(3.0-2.0*col);
    
	fragColor = vec4(col, dhit);
  fragColor.a = 1.;
}
`;

const fragment = `
// Homeward
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// Do the crow in this buffer...



#define PI 3.1415926535

mat3 crowDir;
vec4 flapping, headTilt;
float turn, specular;

//----------------------------------------------------------------------------------------
vec4 getStore(int num)
{
    //ivec2 loc = ivec2(num & 63, num/64); // Didn't need that many, doh!
    ivec2 loc = ivec2(num, 0);
    return  texelFetch(iChannel0, loc, 0);
}


//----------------------------------------------------------------------------------------

//----------------------------------------------------------------------------------------
float noise( in float p  )
{
    
    float f = fract(p);
    p = floor(p);
	f = f*f*(3.0-2.0*f);
	return mix(hash11(p),hash11(p+1.), f);
}

//----------------------------------------------------------------------------------------
float sMin( float a, float b, float k )
{
    
	float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( b, a, h ) - k*h*(1.-h);
}
//----------------------------------------------------------------------------------------
mat2 rot2D(float a)
{
	float si = sin(a);
	float co = cos(a);
	return mat2(co, si, -si, co);
}

//----------------------------------------------------------------------------------------
float  sphere( vec3 p, float s )
{
    return length(p)-s;
}

//----------------------------------------------------------------------------------------
float featherBox( vec3 p, vec3 b, float r )
{
    b.y-= smoothstep(3.75, -4.0, p.z)*noise(p.x*6.)*.56;

    p.y+=  smoothstep(1.5, .0, p.z)*noise(p.x*3.+crowPos.z*1.)*.35;
    return length(max(abs(p)-b,0.0))-r;
}

//----------------------------------------------------------------------------------------
float featherTailBox( vec3 p, vec3 b, float r )
{
    //b.x /= smoothstep(-10.,4.,p.z);
    p.x *= clamp((p.z+4.)/6., 0.1,2.5);
    b.y-= smoothstep(.75, .0, p.z)*noise(p.x*3.)*.3;
    
    p.y+=  smoothstep(1., -4.0, p.z)*noise(p.x*3.+crowPos.z*1.)*.5;
    return length(max(abs(p)-b,0.0))-r;
}

//----------------------------------------------------------------------------------------
float segment(vec3 p,  vec3 a, vec3 b, float r1, float r2)
{
	vec3 pa = p - a;
	vec3 ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - r1 + r2*h;
}


//--------------------------------------------------------------------------
float noise( in vec3 p )
{
    vec3 f = fract(p);
    p = floor(p);
	f = f*f*(3.0-2.0*f);
	
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = textureLod( iChannel3, (uv+ 0.5)/256.0, 0.0).yx;
	return mix( rg.x, rg.y, f.z );
}

//----------------------------------------------------------------------------------------
vec3 getSky(vec3 dir, vec3 pos)
{
    vec3 col;
    vec3 clou = dir * 1. + pos*.025;
	float t = noise(clou);
    t += noise(clou * 2.1) * .5;
    t += noise(clou * 4.3) * .25;
    t += noise(clou * 7.9) * .125;
	col = mix(vec3(FOG_COLOUR), vec3(0.2, 0.2,.2),abs(dir.y))+ FOG_COLOUR *t*.4;
 
    return col;
}

//----------------------------------------------------------------------------------------
// Map a crow like asbtract bird thing...
float map(vec3 p, float t)
{
    float d, f;
    specular = .1;
    // Normalize rotation...
    vec3 q = crowDir*(p-crowPos);
    // Head...
    vec3 b = q- vec3(.0, 0, 2.8);
    b.yz = b.yz*rot2D(headTilt.x);
    b.xz = b.xz*rot2D(headTilt.y);
    d = segment(b,vec3(0,0,1), vec3(0,0,5.), 1.2, 3.); 

    // Body...
    b = q+vec3(0,1.,3);
  	d = sMin(d, segment(q, vec3(0), vec3(0,0,-14), 1.3, 11.5), 3.); 
    // Tail...
    b.xy = b.xy* rot2D(headTilt.w);
    d = sMin(d, featherTailBox(b, vec3(headTilt.z,.1,2.2), .3),4.3); 
    // Left wing...
    b = q + vec3(2.8,0,0);
    b.xy = rot2D(flapping.x)*b.xy;
    d = sMin(d, featherBox(b+(vec3(4,0,1.)), vec3(4,.05,2.5),.4), 2.);
    
    b =  b + vec3(8,0,0);
    b.xy = rot2D(flapping.y*1.5)*b.xy;
	f = featherBox(b+vec3(4,0,0), vec3(4,.05,3.5),.4);
    f = max(f, sphere(b+vec3(2,0,3), 5.));
    d = sMin(d, f, .1);
    
    // Right wing...
    b = q - vec3(2.8,0,0);
    b.xy = rot2D(-flapping.z)*b.xy;
    d = sMin(d, featherBox(b-(vec3(4,0,-1.)), vec3(4,.05,2.5),.4), 2.);
    
    
    b =  b - vec3(8,0,0);
    b.xy = rot2D(-flapping.w*1.5)*b.xy;
    f = featherBox(b-vec3(4,0,0), vec3(4,.05,3.5),.4);
    f = max(f, sphere(b-vec3(2,0,-3), 5.));
    d = sMin(d, f, .1);

    // Do some glassy eyes...
    b = q- vec3(.0, .0, 2.85);
    
    b.yz = b.yz*rot2D(headTilt.x);
    b.xz = b.xz*rot2D(headTilt.y);
	b.x = abs(b.x);

    f = sphere(b-vec3(.7,0.1,1.4), .25);
    if (f < d){ d = f; specular = 4.0;}

    
    return d;
}
//----------------------------------------------------------------------------------------
vec3 getNormal(vec3 p, float e)
{
    return normalize( vec3( map(p+vec3(e,0.0,0.0), e) - map(p-vec3(e,0.0,0.0), e),
                            map(p+vec3(0.0,e,0.0), e) - map(p-vec3(0.0,e,0.0), e),
                            map(p+vec3(0.0,0.0,e), e) - map(p-vec3(0.0,0.0,e), e) ) );
}

//----------------------------------------------------------------------------------------
vec3 lighting(in vec3 pos, in vec3 normal, in vec3 eyeDir, in float d)
{
	;
   	normal = reflect(eyeDir, normal); // Specular...
    vec3 col = pow(max(dot(sunLight, normal), 0.0), 10.0)  * SUN_COLOUR * specular;


	return min(col, 1.0);
}


//--------------------------------------------------------------------------
float marchScene(in vec3 rO, in vec3 rD, vec2 co, float t)
{
	t += .5*hash12(co);

    
    for( int j=0; j < 30; j++ )
	{
		if (t >= FAR) break;
		float h = map( rO + t*rD, t*0.012);
 		if(h < 0.03)
		{
  
            break;
	     }

        t += h + t*.005;
	}


    return t;
}


vec3 lenseFlare(vec2 uv,vec3 dir, mat3 camMat)
{

    vec3 col = vec3(0);
    float bri = dot(dir, sunLight)*.7;
	if (bri > 0.0)
	{
		vec2 sunPos = vec2(dot( sunLight, camMat[0] ),dot( sunLight, camMat[1] ) );
        //sunPos = clamp(sunPos,-.5,.5);
        //sunPos *= vec2(iResolution.y/iResolution.x, 1.);
	    float z = textureLod(iChannel1,(sunPos+1.)*.5, 0.).w;
       	vec2 uvT = uv-sunPos;
        if (z >= FAR)
        {
            uvT = uvT*(length(uvT));
            bri = pow(bri, 6.0)*.7;

            // glare = the red shifted blob...
            float glare1 = max(dot(dir,sunLight),0.0)*1.4;
            // glare2 is the yellow ring...
            float glare2 = max(1.-length(uvT+sunPos*.4)*4.0, 0.0);
            uvT = mix (uvT, uv, -2.3);
            // glare3 is a splodge...
            float glare3 = max(1.-pow(length(uvT+sunPos*2.5)*3., 2.), 0.0);

            col += bri * vec3(1.0, .0, .0)  * pow(glare1, 12.5)*.05;
            col += bri * vec3(1.0, 1.0, .1) * pow(glare2, 2.0)*2.5;
            col += bri * SUN_COLOUR * pow(glare3, 3.)*3.0;
        }
	}
    return col;
}


//----------------------------------------------------------------------------------------
void mainImage( out vec4 colOut, in vec2 fragCoord )
{
    
    vec2 uv = (-iResolution.xy + 2.0 * fragCoord ) / iResolution.y;

  	vec3 col;

    sunLight 	= getStore(SUN_DIRECTION).xyz;
    vec3 camPos = getStore(CAMERA_POS).xyz;
    vec3 camTar = getStore(CAMERA_TAR).xyz;
    crowPos  	= getStore(CROW_POS).xyz;
    vec3 crowTar= getStore(CROW_HEADING).xyz;
    flapping	= getStore(CROW_FLAPPING);
    headTilt	= getStore(CROW_HEADTILT);
    turn  		= getStore(CROW_TURN).x;
    crowDir		= setCamMat(crowPos, crowTar, turn);
    crowDir 	= inverse(crowDir);
	mat3 camMat = setCamMat(camPos, camTar, (camTar.x-camPos.x)*.02);
    vec3 dir 	= camMat * normalize( vec3(uv, cos((length(uv*.5)))));


	
    colOut = texelFetch(iChannel1, ivec2(fragCoord), 0);
    float t = max(length(camPos-crowTar)-25., .0);
    float far = t+30.0;
    float dhit = marchScene(camPos, dir, fragCoord, t);
  
    if (dhit < far && dhit < colOut.w)
    {
      	
       	vec3  p = camPos+dhit*dir; 
        vec3 sky = getSky(dir, p);
       	vec3 nor =  getNormal(p, dhit*.003);
   		col = lighting(p,nor, dir, dhit);
        col = mix(sky, col.xyz , exp(-dhit*.0015)-.1);
    }else
    	col = texelFetch(iChannel1, ivec2(fragCoord), 0).xyz;
    
    
    col += lenseFlare(uv, dir, camMat);
    col = clamp(col, 0.0, 1.0);

	// Contrast & stretch...

    col = pow( col, vec3(1.7,1.95,2.) )*1.8;
    col = clamp(col, 0., 1.0);
	col = col*.2 + (col*col*(3.0-2.0*col))*.8;
 
    // Gamma...
    col = min(sqrt(col), 1.0);


    // Vignette...
    vec2 xy = abs((fragCoord.xy / iResolution.xy)-.5);
    col *= pow(abs(250.0* (.5-xy.y))*(.5-xy.x), .2 )*.7;
	colOut = vec4(col*smoothstep(.0, 2.,iTime), 1.0);
}
`;

const sound = `
// Wind and Crow sound effects.
// Usees a formant graph to approximate the CAW sound.
// by David Hoskins.
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.


//----------------------------------------------------------------------------------------
//  1 out, 1 in ...
float shash11(float p)
{
	vec2 p2 = fract(vec2(p) * vec2(.16632,.17369));
    p2 += dot(p2.yx, p2.xy+19.19);
	return fract(p2.x * p2.y)-.5;
}
//----------------------------------------------------------------------------------------
//  2 out, 1 in...
vec2 shash21(float p)
{
	//p  = fract(p * MOD3);
    vec3 p3 = fract(vec3(p) * vec3(.16532,.17369,.15787));
    p3 += dot(p3.xyz, p3.yzx + 19.19);
   return fract(vec2(p3.x * p3.y, p3.z*p3.x))-.5;
}

//----------------------------------------------------------------------------------------
///  2 out, 2 in...
vec2 shash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.16532,.17369,.15787));
    p3 += dot(p3.zxy, p3.yxz+19.19);
    return fract(vec2(p3.x * p3.y, p3.z*p3.x))-.5;
}

//----------------------------------------------------------------------------------------
//  2 out, 1 in...
vec2 Noise21(float x)
{
    float p = floor(x);
    float f = fract(x);
    f = f*f*(3.0-2.0*f);
    return  mix( shash21(p), shash21(p + 1.0), f)-.5;
    
}

//----------------------------------------------------------------------------------------
//  2 out, 1 in...
float Noise11(float x)
{
    float p = floor(x);
    float f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix( shash11(p), shash11(p + 1.0), f);

}

//----------------------------------------------------------------------------------------
//  2 out, 2 in...
vec2 Noise22(vec2 x)
{
    const vec2 add = vec2(1.0, 0.0);
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    
    vec2 res = mix(mix( shash22(p),          shash22(p + add.xy),f.x),
                   mix( shash22(p + add.yx), shash22(p + add.xx),f.x),f.y);
    return res;
}
#define F(p1, p2, p3, p4, p5) {d+=0.00625; f123 = ivec4(p2, p3, p4, p5);}
#define TAU  6.28318530718
#define PI TAU*.5;
//----------------------------------------------------------------------------------
float Tract(float x, float f, float bandwidth)
{
    float ret = sin(TAU * f * x) * exp(-bandwidth * 3.14159265359 * x)*(Noise11(f));
    return ret;
}
float crow(float time)
{
   	float	x = 0.0;
    time -= 1.0;
 
    float t = mod(time, 12.);
    float p = Noise11(floor(time/12.0)*33.0)*.002+.008;
    float v = smoothstep(0.,.01, t)*smoothstep(0.5,.49, t);
    x = mod(t, p + t * t * smoothstep(0.2, .5, t)*.002+t*smoothstep(0.2, .0, t)*.004);
    vec4 formants = vec4(1500.0, 1900., 2408., 3268.);
    
	float glot = 	Tract(x, formants.x, 200.0)  +
       		Tract(x, formants.y, 100.0)  * .8 +
       		Tract(x, formants.z, 90.0) * .6 +
   			Tract(x, formants.w, 90.0) * .5;
	
	return glot*v*3.;
}
//----------------------------------------------------------------------------------------
// Fractal Brownian Motion...
vec2 FBM22(vec2 x)
{
    vec2 r = vec2(0.0);
    
    float a = .7;
    
    for (int i = 0; i < 8; i++)
    {
        r += Noise22(x) * a;
        a *= .5;
        x *= 2.0;
        x += 10.;
    }
     
    return r;
}

//----------------------------------------------------------------------------------------
vec2 mainSound( in int samp,float time)
{
	vec2 audio = vec2(.0);
    vec2 n1 = FBM22( vec2(time*520., time*530.) * (Noise21(time*.2+9.)*.2+1.)) * (Noise21(time*.5)+1.);
	vec2 n2 = FBM22( vec2(time*1800., time*900.) * (Noise21(time*.1)*.2+1.))  * (Noise21(time*.2)+1.);

    audio += (n1+n2)/2.0;
    
    audio+= (crow(time)+crow(time+.02)+crow(time+.04))*.2;  // ...Not very good, but it has a little style of its own...
    audio.x+= crow(time-.25)*.15;
    audio.y+= crow(time-.5)*.1;

 //   float foot = tri(time*3.);
//    audio += Noise11(time*10.0)*Noise11(time*500.0)*Noise11(time*3000.0)* smoothstep(0.6,1.,abs(foot)) * 6.;
    
    return clamp(audio, -1.0, 1.0) * smoothstep(0.0, .6, time) * smoothstep(180.0, 170.0, time);
    
}
`;

export default class implements iSub {
  key(): string {
    return 'Xllfzl';
  }
  name(): string {
    return 'Homeward';
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
  common() {
    return common;
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
      { type: 1, f: buffA, fi: 0 }, //
      webglUtils.TEXTURE6,
      webglUtils.TEXTURE7,
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
