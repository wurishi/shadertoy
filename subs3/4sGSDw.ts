import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
const float initalSpeed = 10.;
#define time iTime

vec2 hash(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3.zxy, p3.yxz+19.19);
    return fract(vec2(p3.x * p3.y, p3.z*p3.x))*2.0 - 1.0;
}

float noise( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
	
	vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( dot( hash( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ), 
                     dot( hash( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( hash( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ), 
                     dot( hash( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}

const mat2 m2 = mat2( 0.80, -0.60, 0.60, 0.80 );
float fbm( in vec2 p, float tm )
{
    p *= 2.0;
    p -= tm;
	float z=2.;
	float rz = 0.;
    p += time*0.001 + 0.1;
	for (float i= 1.;i < 7.;i++ )
	{
		rz+= abs((noise(p)-0.5)*2.)/z;
		z = z*1.93;
        p *= m2;
		p = p*2.;
	}
	return rz;
}

vec3 update(in vec3 vel, vec4 p, in float id) { 
    
    float n1a = fbm(p.xy, p.w);
    float n1b = fbm(p.yx, p.w);
    float nn = fbm(vec2(n1a,n1b),0.)*5.8 + .5;
    
    vec2 dir = vec2(cos(nn), sin(nn));
    vel.xy = mix(vel.xy, dir*1.5, 0.005);
    return vel;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy / iResolution.xy;
    
    vec4 col= vec4(0);
    vec2 w = 1./iResolution.xy;
    if (fragCoord.y > 60.)discard;
    
    //vec2 mo = iMouse.xy/iResolution.xy;
    
    vec4 pos = texture(iChannel0, vec2(q.x,100.*w));
    vec3 velo = texture(iChannel0, vec2(q.x,0.0)).xyz;
    velo = update(velo, pos, pos.w);
    col.w = pos.w;
    
    float mdf = mod(float(iFrame),1601.);
    
    if (fragCoord.y < 30.)
    {
    	if (mdf < 2.5)
        {
            col = vec4(0.1,0,0,0);
            col.w++;
        }
        else
        	col.rgb = velo;
    }
    else
    {
        if (mdf < 2.5)
        {
            pos = vec4(-0.99,((texture(iChannel1, q*1.+3.15 + time))-.5).x,0,0);
            col.w++;
        }
        pos.xy += velo.xy*0.002;
        col.xyz = pos.xyz;
    }
    
	
    //Init
    if (iFrame < 15) 
    {
        if (fragCoord.y < 30.)
            col = vec4(0.1,0,0,0);
        else {
            col = vec4(-0.99,((texture(iChannel1, q*.5+3.15))-.5).x,0,0);;
        }
    }
    
	fragColor = col;
}
`;

const buffB = `
#define time iTime

//Anywhere under 800 "should" work fine (might slow down though)
const int numParticles = 500;

float mag(vec2 p){return dot(p,p);}

vec4 drawParticles(in vec2 p)
{
    vec4 rez = vec4(0);
    vec2 w = 1./iResolution.xy;
    
    for (int i = 0; i < numParticles; i++)
    {
        vec2 pos = texture(iChannel0, vec2(i,50.0)*w).rg;
        vec2 vel = texture(iChannel0, vec2(i,0.0)*w).rg;
        float d = mag(p - pos);
        d *= 500.;
        d = .01/(pow(d,1.0)+.001);

        //rez.rgb += d*abs(sin(vec3(2.,3.4,1.2)*(time*.01 + float(i)*.0017 + 2.5) + vec3(0.8,0.,1.2))*0.7+0.3)*0.04;
        rez.rgb += d*abs(sin(vec3(2.,3.4,1.2)*(time*.07 + float(i)*.0017 + 2.5) + vec3(0.8,0.,1.2))*0.7+0.3)*0.04;
        pos.xy += vel*0.002*0.2;
    }
    
    return rez;
}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

vec3 roty(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

vec3 rotz(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x - s*p.y, s*p.x + c*p.y, p.z);
}

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{	
    vec2 q = fragCoord.xy/iResolution.xy;
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(-0.15,0.):mo;
	mo.x *= iResolution.x/iResolution.y;
    mo*=6.14;
    
    p *= 1.1;
    
    vec4 cola = drawParticles(p)*0.05;
    
    vec4 colb = 1.-texture(iChannel1, q);
    vec4 col = cola + colb;
    
    vec4 base = 1.-vec4(1,0.98,0.9,0.9)*(1.-mag(p+vec2(-0.20,-.3))*0.1);
    
    float mdf = mod(float(iFrame),1601.);
    
    if (iFrame < 15 || mdf < 2.5) col = base;
    fragColor = 1.-col;
    
}
`;

const fragment = `

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    vec2 p = fragCoord.xy/iResolution.xy;
    vec4 c = vec4(texture(iChannel0, p).rgb, 1.0);
    fragColor = vec4(mix(c, 1.-c, smoothstep(-.3,.3,sin(p.y+iTime*.0717+3.4))));
}
`;

export default class implements iSub {
  key(): string {
    return '4sGSDw';
  }
  name(): string {
    return 'Sinuous';
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
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
