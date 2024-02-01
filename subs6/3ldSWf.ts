import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// sdfs from inigo quilez

float sdLine( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}
float sdEquilateralTriangle( in vec2 p, float s )
{
    const float k = sqrt(3.0);
    p.x = abs(p.x) - s;
    p.y = p.y + s/k;
    if( p.x+k*p.y>0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0, 0.0 );
    return -length(p)*sign(p.y);
}
float sdTriangleIsosceles( in vec2 p, in vec2 q )
{
    p.x = abs(p.x);
    vec2 a = p - q*clamp( dot(p,q)/dot(q,q), 0.0, 1.0 );
    vec2 b = p - q*vec2( clamp( p.x/q.x, 0.0, 1.0 ), 1.0 );
    float s = -sign( q.y );
    vec2 d = min( vec2( dot(a,a), s*(p.x*q.y-p.y*q.x) ),
                  vec2( dot(b,b), s*(p.y-q.y)  ));
    return -sqrt(d.x)*sign(d.y);
}

#define iTime (iTime + 100.)

#define outline(x, w) (abs(x) - w)
#define inline(x) -((x)) 

#define pi acos(-1.)
#define tau (2.*pi)
#define rot(x) mat2(cos(x),-sin(x),sin(x),cos(x))
#define pmod(a, x) mod(a, x) - x*0.5

//#define KALEIDOMODE


float rand2D(in vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}
// http://www.science-and-fiction.org/rendering/noise.html
// dot noise from here

float dotNoise2D(in float x, in float y, in float fractionalMaxDotSize, in float dDensity)
{
    float integer_x = x - fract(x);
    float fractional_x = x - integer_x;

    float integer_y = y - fract(y);
    float fractional_y = y - integer_y;

    if (rand2D(vec2(integer_x+1.0, integer_y +1.0)) > dDensity)
       {return 0.0;}

    float xoffset = (rand2D(vec2(integer_x, integer_y)) -0.5);
    float yoffset = (rand2D(vec2(integer_x+1.0, integer_y)) - 0.5);
    float dotSize = 0.5 * fractionalMaxDotSize * max(0.25,rand2D(vec2(integer_x, integer_y+1.0)));

    vec2 truePos = vec2 (0.5 + xoffset * (1.0 - 2.0 * dotSize) , 0.5 + yoffset * (1.0 -2.0 * dotSize));

    float distance = length(truePos - vec2(fractional_x, fractional_y));

    return 1.0 - smoothstep (0.3 * dotSize, 1.0* dotSize, distance);

}

    
#define pal(a,b,c,d,e) (a + b*sin(tau*(c*d + e)))

vec4 valueNoise(float i, float tol){
    vec4 a = texture(iChannel0,vec2(floor(i)*0.01));
    vec4 b = texture(iChannel0,vec2(floor((i+1.))*0.01));
    
    if (a.z > tol)
        a -= a;
    if (b.z > tol)
        b -= b;
    
	return mix(a,b,pow(fract(i), 20.));
}


vec2 sUv = vec2(0);
#define mx (iTime*1. + 10.*iMouse.x/iResolution.x)
vec3 sumonTheDemon( vec2 p, float id )
{
    vec3 col = vec3(0);

    #define spacing (0.04 + sin(iTime*0.7)*0.02)
    #define PLANES 40.
    #define W 0.0003
    
    float rA = texture(iChannel0, vec2(sin(id*0.01)*200.,id )).x;
    float rB = texture(iChannel0, vec2(sin(id*0.03 + 0.2)*200.,id*1.4 )).x;
    float rS = sign(rA - 0.5);
    float rSB = sign(rB - 0.5);
    float fig = 10e6;
    vec2 k = p;
    //p.xy *= rot(iTime*rB*rS*0.2);
    
    float baseW = 0.05;
   
    vec4 nScreen = valueNoise(iTime, 1.);
    
    p.x += 0.1*nScreen.z*exp(-(500.+nScreen.y*500.)*abs(sUv.y - nScreen.x + 0.5))*0.2*sin(sUv.y*200. + iTime*50.);
    
    #ifdef KALEIDOMODE
    for(int i = 0; i < 7; i++){
		p = abs(p);
        p *= rot(0.1 + sin(id*0.1)*0.2);
        p -= 0.05 + sin(iTime*0.1 + id*0.1)*0.0;
    //    p.x -= 0.008;
    }
    #endif
    
    #define onion(d, amt) (length(mod(amt*d, 1.) - 0.5 ) - 0.0)
    
    #define ysep 10.
    float idy = floor(2000.*k.y/ysep);
    p.x += valueNoise(iTime*4. + idy*20.5 + id, 0.1).x*0.04;
    p = abs(p);
    p *= rot(0.25*pi);
    if(rA < 0.5){
    	p = abs(p);
    	p *= rot(0.25*pi);
    
    }
    p = abs(p);
    
    
    fig = min(fig, outline( length(p.y*1.) - 0.4, 0.4    ));
    fig = mix(fig, outline( length(p.y*1.) - 0.4, 0.4    ), 3.);
    
    fig = onion(fig , (20. + 5.*sin(iTime + id)));
    
    
    
    col += smoothstep(0.01,0.,fig)*vec3(1)*1.;    

    col *= pal(1.4,vec3(1.,1.,1.)*0.7,vec3(.87,4.4,1.8), vec3(3.7,2.5,1.1), id*0.1);
    
    
    k += id;
    for(int i = 0; i < 2; i++){
    	k = abs(k);
    	
        k.x -= 0.6;
        k *= rot(2.);
    }
    k *= 20.;
    col += dotNoise2D(k.x, k.y, 0.05, 1.);
    
    float stars = 10e5;
    

    
    //col += smoothstep(0.005,0.,stars)*vec3(1)*2.;    

    
    return col;
}


float iPlane(vec3 ro, vec3 rd, vec3 p0, vec3 n){
    float denom = dot(rd,n);
    if (denom > 1e-6) {
        float t = - dot(ro - p0, n)/denom; 
		if (t > 0.) return t;
        return t;
    }  
    return 1e10;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
	sUv = uv;
    uv *= 1. + dot(uv,uv)*0.2;
    
    vec3 col = vec3(0);
	
    vec3 ro = vec3(0);
    
    ro.z;
    vec3 rd = normalize(vec3(uv,1));
   
    #define fog(a) smoothstep(1., 0., a*1.4)
    
    for(float i = 0.; i < PLANES + float(min(iFrame, 0)); i++ ){
    	float plA = iPlane(ro, rd, vec3(0,0,mod(-mx + i,PLANES))*spacing, vec3(0,0,1));
    	col += sumonTheDemon( (ro+rd*plA).xy, floor((-mx+i)/PLANES)*PLANES + i)*fog(plA);
    }
    
	
    fragColor = vec4(col,1.0);
}

`;

const fragment = `
// Fork of "Day 55" by jeyko. https://shadertoy.com/view/wl3Szs
// 2020-02-16 14:20:34


#define T(uv) texture(iChannel1,uv)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord/iResolution.xy);

    #define chromaticAbberationAmt (0.00 + sin(iTime)*0.005)
    //float f = length(uv  - 0.5);
    float f = dot(uv  - 0.5,uv  - 0.5);
    fragColor.x = T(uv + f*chromaticAbberationAmt).x;
    fragColor.y = T(uv).y;
    fragColor.z = T(uv -f*chromaticAbberationAmt).z;
    fragColor += clamp(texture(iChannel1,uv, 6.), 0., 1.)*0.4;
    fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return '3ldSWf';
  }
  name(): string {
    return 'Day 59';
  }
  sort() {
    return 649;
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
    return [
      webglUtils.DEFAULT_NOISE, //
      { type: 1, f: buffA, fi: 1 },
    ];
  }
}
