import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
const float initalSpeed = 10.;
#define time iTime

vec3 hash3(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.1);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z))-0.5;
}

vec3 update(in vec3 vel, vec3 pos, in float id)
{   
    vel.xyz = vel.xyz*.999 + (hash3(vel.xyz + time)*2.)*7.;
    
    float d = pow(length(pos)*1.2, 0.75);
    vel.xyz = mix(vel.xyz, -pos*d, sin(-time*.55)*0.5+0.5);
    
    return vel;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy / iResolution.xy;
    
    vec4 col= vec4(0,0,0,1);
    vec2 w = 1./iResolution.xy;
    
    vec3 pos = texture(iChannel0, vec2(q.x,100.*w)).xyz;
    vec3 velo = texture(iChannel0, vec2(q.x,0.0)).xyz;
    velo = update(velo, pos, q.x);
    
    if (fragCoord.y < 30.)
    {
    	col.rgb = velo;
    }
    else
    {
        pos.rgb += velo*0.002;
        col.rgb = pos.rgb;
    }
	
    //Init
    if (iFrame < 10) 
    {
        if (fragCoord.y < 30.)
        	col = ((texture(iChannel1, q*1.9))-.5)*10.;
        else
        {
            col = ((texture(iChannel1, q*1.9))-.5)*.5;
        }
    }
    
	fragColor = col;
}
`;

const buffB = `
#define time iTime

//Anywhere under 900 "should" work fine (might slow down though)
const int numParticles = 140;
const int stepsPerFrame = 7;

float mag(vec3 p){return dot(p,p);}

vec4 drawParticles(in vec3 ro, in vec3 rd)
{
    vec4 rez = vec4(0);
    vec2 w = 1./iResolution.xy;
    
    for (int i = 0; i < numParticles; i++)
    {
        vec3 pos = texture(iChannel0, vec2(i,100.0)*w).rgb;
        vec3 vel = texture(iChannel0, vec2(i,0.0)*w).rgb;
        for(int j = 0; j < stepsPerFrame; j++)
        {
            float d = mag((ro + rd*dot(pos.xyz - ro, rd)) - pos.xyz);
            d *= 1000.;
            d = .14/(pow(d,1.1)+.03);
            
            rez.rgb += d*abs(sin(vec3(2.,3.4,1.2)*(time*.06 + float(i)*.003 + 2.) + vec3(0.8,0.,1.2))*0.7+0.3)*0.04;
            //rez.rgb += d*abs(sin(vec3(2.,3.4,1.2)*(time*.06 + float(i)*.003 + 2.75) + vec3(0.8,0.,1.2))*0.7+0.3)*0.04;
            pos.xyz += vel*0.002*0.2;
        }
    }
    rez /= float(stepsPerFrame);
    
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
	
	vec3 ro = vec3(0.,0.,2.5);
    vec3 rd = normalize(vec3(p,-.5));
    
    vec4 cola = drawParticles(ro, rd);
    vec4 colb = texture(iChannel1, q);
    
    //Feedback
    vec4 col = cola + colb;
    col *= 0.9975;
    
    if (iFrame < 5) col = vec4(0);
    
	fragColor = col;
  fragColor.a = 1.;
}
`;

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	fragColor = vec4(texture(iChannel2, fragCoord.xy/iResolution.xy).rgb, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdG3Dd';
  }
  name(): string {
    return 'Synaptic';
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
      webglUtils.DEFAULT_NOISE,
      { type: 1, f: buffA, fi: 1 },
      { type: 1, f: buffB, fi: 2 }, //
    ];
  }
}
