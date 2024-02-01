import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
//Cheap Bezier palettes by nimitz
//by nimitz 2019 (twitter: @stormoid)

/*
	An alternative to the simple sine offset procedural
	palettes.

	Pros: simple to parameterize, versatile, self-contained,
	looping (0..1 interval) and cheap to evaluate.

	Evaluated as a combination of 3D quadtratic bezier curves which 
	ends up being only slighty (10 vs 9 instructions) more expensive
	to compute than the ubiquitous sine-based palette

	The shader is also plotting the palette in 3D RGB space
	which helps visualize the 3D path to design palettes
*/

//Type 1 = Bezier based, Type 2 = Linearly interpolated, Type 3 = Sine based
#define TYPE 1



#if (TYPE ==1)

#define COL1 vec3(0.8, .5, .3)
#define PT1 vec3(.5, .7, .0)
#define COL2 vec3(0.1, .7, .5)
#define PT2 vec3(0.1, .1, .9)

//Dual 3D Quadratic Bezier palette
//10 Instructions
vec3 getPalette(float x, vec3 c1, vec3 c2, vec3 p1, vec3 p2)
{
    
    float x2 = fract(x);
    x = fract(x*2.0);   
    mat3 m = mat3(c1, p1, c2);
    mat3 m2 = mat3(c2, p2, c1);
    float omx = 1.0-x;
    vec3 pws = vec3(omx*omx, 2.0*omx*x, x*x);
    return clamp(mix(m*pws, m2*pws, step(x2,0.5)),0.,1.);
}

#elif (TYPE==2)

#define COL1 vec3(0.8, .5, .2)
#define PT1 vec3(0.1, .75, .5)
#define COL2 vec3(0.5, .3, .7)
#define PT2 vec3(0.5, .7, .3)

//Linearly interpolated, 4-color looping palette 
//9 Instructions
vec3 getPalette(float x, vec3 a, vec3 b, vec3 c, vec3 d)
{
    x = fract(x);
    return mix(mix(mix(mix(a,b,clamp(x*4.,0.0,1.0)), c, clamp((x-0.25)*4.,0.0,1.0)), 
                   d, clamp((x-0.5)*4.,0.0,1.0)), a, clamp((x-0.75)*4.,0.0,1.0));
}
#else

#define COL1 vec3(1., .0, .4)
#define PT1 vec3(-2., 1.0, .1)
#define COL2 vec3(-1., 2.0, .4)
#define PT2 vec3(0.5, .5, .55)

//Simple sine based palette, much harder to get specific colors
//9 Instruction (8 in its simplest form)
vec3 getPalette(float x, vec3 a, vec3 b, vec3 c, vec3 d)
{
    x *= 6.2831853;
    return vec3(sin(x*a.x - a.y)*a.z + d.x, sin(x*b.x - b.y)*b.z + d.y, sin(x*c.x + c.y)*c.z + d.z);
}
#endif

`;

let f = `
//Cheap Bezier palettes by nimitz
//by nimitz 2019 (twitter: @stormoid)

#define time iTime

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy/iResolution.xy;
	fragColor = vec4(getPalette(q.x*4.6, COL1, COL2, PT1, PT2), 1.);
}

`;

let fragment = `
// Cheap Bezier palettes
// by nimitz 2019 (twitter: @stormoid)

// Palette type and base color selection in the "Common" tab
// Palette code also in the "Common" tab

/*
	An alternative to the simple sine offset procedural
	palettes.

	Pros: simple to parameterize, versatile, self-contained,
	looping (0..1 interval) and cheap to evaluate.

	Evaluated as a combination of 3D quadtratic bezier curves which 
	ends up being only slighty (10 vs 9 instructions) more expensive
	to compute than the ubiquitous sine-based palette

	The shader is also plotting the palette in 3D RGB space
	which helps visualize the 3D path to design palettes
*/


float mag2(vec3 p){return dot(p,p);}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

vec3 roty(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

vec4 draw(in vec3 ro, in vec3 rd)
{
    vec4 rez = vec4(0,0,0,110);
    vec2 w = 1./iResolution.xy;
    
    for (int i = 0; i < 175; i++)
    {
        vec3 pos = texture(iChannel0, vec2(i,100.0)*w).rgb;
        float d = mag2((ro + rd*dot(pos.xyz - ro, rd)) - pos.xyz);
        d = smoothstep(.75, 0.2, d*2000.);
       	rez.rgb = max(rez.rgb, d*pos.xyz);
    }
    
    return rez;
}

vec3 lineCub( in vec3 ro, in vec3 rd, vec3 pa, vec3 pb )
{
	vec3 ba = pb - pa;
	vec3 oa = ro - pa;
	float oad  = dot(oa, rd);
	float dba  = dot(rd, ba);
	float baba = dot(ba, ba);
	float oaba = dot(oa, ba);
	vec2 th = vec2( -oad*baba + dba*oaba, oaba - oad*dba ) / (baba - dba*dba);
	th.x = max(   th.x, 0.0 );
	th.y = clamp( th.y, 0.0, 1.0 );
	vec3 p = pa + ba*th.y;
	vec3 q = ro + rd*th.x;
    float l = dot( p-q, p-q );
    return clamp(0.001/(100.*l),0.,1.)*mix(pa, pb, th.y);
    
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{	
    vec2 q = fragCoord.xy/iResolution.xy;
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(-0.15,0.):mo;
	mo.x *= iResolution.x/iResolution.y;
    mo *=vec2(6.14, -2.0);
    
    vec3 rd = normalize(vec3(p,1.7));
    float angle = mo.x*0.5;
    rd = rotx(rd, mo.y);
    rd = roty(rd, angle);
    
    float camR = 1.37 * (cos(mo.y)+1.0);
    vec3 ro = vec3(0.5 - sin(angle)*camR, sin(mo.y)*2.9 + .45, 0.5 - cos(angle)*camR);    
    
    vec4 col = draw(ro, rd);
    col.rgb += lineCub(ro, rd, vec3(0,0,0), vec3(1,0,0));
    col.rgb += lineCub(ro, rd, vec3(0,0,0), vec3(0,1,0));
    col.rgb += lineCub(ro, rd, vec3(0,1,0), vec3(1,1,0));
    col.rgb += lineCub(ro, rd, vec3(1,0,0), vec3(1,1,0));
    
    col.rgb += lineCub(ro, rd, vec3(0,0,1), vec3(1,0,1));
    col.rgb += lineCub(ro, rd, vec3(0,0,1), vec3(0,1,1));
    col.rgb += lineCub(ro, rd, vec3(0,1,1), vec3(1,1,1));
    col.rgb += lineCub(ro, rd, vec3(1,0,1), vec3(1,1,1));
    
    col.rgb += lineCub(ro, rd, vec3(0,0,0), vec3(0,0,1));
    col.rgb += lineCub(ro, rd, vec3(1,0,0), vec3(1,0,1));
    col.rgb += lineCub(ro, rd, vec3(0,1,0), vec3(0,1,1));
    col.rgb += lineCub(ro, rd, vec3(1,1,0), vec3(1,1,1));
    
    col.rgb += lineCub(ro, rd, vec3(0,0,0), vec3(1,1,1));
    col.rgb += lineCub(ro, rd, vec3(0.5,0.5,0), vec3(0.5,0.5,1));
    col.rgb += lineCub(ro, rd, vec3(0.5,0.,0.5), vec3(0.5,1.,0.5));
    col.rgb += lineCub(ro, rd, vec3(0.,0.5,0.5), vec3(1.,.5,0.5));
    
    if (q.y < 0.09)
        col.rgb = getPalette(q.x, COL1, COL2, PT1, PT2);
    
	fragColor = vec4(col.rgb, 1.);
}

`;

fragment = common + fragment;
f = common + f;

export default class implements iSub {
  key(): string {
    return 'MlVBDR';
  }
  name(): string {
    return 'Cheap Bezier palettes';
  }
  sort() {
    return 354;
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
