import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
#define time iTime

vec3 hash3(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.1);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z))-0.5;
}

vec3 update(in vec3 vel, vec3 pos, in float id)
{
    vec4 sndNFO = texture(iChannel2, vec2(0.75, 0.25));
    float R = 1.5;
    const float r = .5;
    float t= time*2.+id*8.;
    float d= 5.;
    
    float x = ((R-r)*cos(t-time*0.1) + d*cos((R-r)/r*t));
    float y = ((R-r)*sin(t) - d*sin((R-r)/r*t));
    
    vel = mix(vel, vec3(x*1.2,y,sin(time*12.6+id*50. + sndNFO.z*10.)*7.)*5. +hash3(vel*10.+time*0.2)*7., 1.);
    
    //vel.z += sin(time*sndNFO.z)*50.;
    //vel.z += sin(time + sndNFO.z*70.)*10.;
    //vel.z += sin(time)*30.*sndNFO.x;
    
    return vel;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 q = fragCoord.xy / iResolution.xy;
    vec2 p = q-0.5;
    p.x *= iResolution.x/iResolution.y;
    
    vec2 mo = iMouse.xy/iResolution.xy-0.5;
    
    float dt = iTimeDelta;
    
    vec4 col= vec4(0);
    
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
        pos += velo*0.002;
        col.rgb = pos;
    }
	
    if (iFrame < 5) 
    {
        if (fragCoord.y < 30.)
        	col = ((texture(iChannel1, q*1.9))-.5)*vec4(0.,0.,0.,0.);
        else
        {
            col = vec4(.0,-.7,0,0);
        }
    }
    
    
    if (mod(float(iFrame), 300.) == 0. && fragCoord.y > 30.)
    {
        col = vec4(.0,-.2, -0.,0);
    }
    
    col.a = q.x;
    
	fragColor = col;
}
`;

const buffB = `
#define time iTime
const int numParticles = 100;
const int stepsPerFrame = 9;

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
float mag(vec3 p){return dot(p,p);}

vec4 drawParticles(in vec3 ro, in vec3 rd, in float ints)
{
    vec4 rez = vec4(0);
    vec2 w = 1./iResolution.xy;
    
    for (int i = 0; i < numParticles; i++)
    {
        vec3 pos = texture(iChannel0, vec2(i,100.0)*w).rgb;
        vec3 vel = texture(iChannel0, vec2(i,0.0)*w).rgb;
        
        float st = sin(time*0.6);
        
        for(int j = 0; j < stepsPerFrame; j++)
        {
            float d = mag((ro + rd*dot(pos.xyz - ro, rd)) - pos.xyz);
            d *= 1000.;
            d = 2./(pow(d,1.+ sin(time*0.6)*0.15)+1.5);
            d *= (st+4.)*.8;

            rez.rgb += d*(sin(vec3(.7,2.0,2.5)+float(i)*.015 + time*0.3 + vec3(5,1,6))*0.45+0.55)*0.005;
            
            pos.xyz += vel*0.002*1.5;
        }
    }
    
    return rez;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{	
    vec2 q = fragCoord.xy/iResolution.xy;
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	
	vec3 ro = vec3(0.,0.,2.7);
    vec3 rd = normalize(vec3(p,-.5));
    
    vec3 sndNFO = texture(iChannel2, vec2(0.65, 0.1)).zwx + vec3(-.5, -0.1, -0.0);
    
    vec4 cola = drawParticles(ro, rd, sndNFO.y)*10.;
    if (mod(time+q.x*.15+q.y*0.15,28.) < 14.)cola = vec4(.9,.95,1.,1.)-cola*.9; //Invert colors
    
    vec2 mv = vec2(pow(sndNFO.z,2.)*0.05,sndNFO.x*.95);
    mv *= mm2(time*1.);
    
    vec4 colb = texture(iChannel1, q+mv);
    //vec4 colb = texture(iChannel1, q);
    
    vec4 col = mix(cola, colb, 0.91);
    if (iFrame < 5) col = vec4(0);
    
	fragColor = col;
}
`;

const buffC = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy/iResolution.xy;
    float fft  = texture( iChannel1, vec2(q.x,0.25) ).x;
	float nwave = texture( iChannel1, vec2(q.x,0.75) ).x;
    
    float owave = texture( iChannel0, vec2(q.x,0.25) ).z;
    float offt  = texture( iChannel0, vec2(q.x,0.25) ).w;
    
    
    float fwave = mix(nwave,owave, 0.85);
    
    
    /*
        get fft sum over many bands, this will allow
		to ge tthe current "intensity" of a track
	*/
    float nfft = 0.;
    for (float i = 0.; i < 1.; i += 0.05)
    {
        nfft += texture( iChannel1, vec2(i,0.25) ).x; 
    }
    nfft = clamp(nfft/30.,0.,1.);
    
    float ffts = mix(nfft, offt, 0.8);
    
    if (iFrame < 5) 
    {
        fft = 0.;
        fwave= .5;
        ffts = 0.;
    }
    
    fragColor = vec4(fft, nwave, fwave, ffts);
}`;

const fragment = `
// Homecomputer by nimitz 2016 (twitter: @stormoid)
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Contact the author for other licensing options

//Code is in the other tabs:
//Buf A = Velocity and position handling
//Buf B = Rendering
//Buf C = Soundcloud filtering and propagation

#define time iTime

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 q = fragCoord.xy / iResolution.xy;
	vec3 col = texture(iChannel0, q).rgb;
    col *= sin(gl_FragCoord.y*350.+time)*0.04+1.;//Scanlines
    col *= sin(gl_FragCoord.x*350.+time)*0.04+1.;
    col *= pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1)*0.35+0.65; //Vign
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XdVGWt';
  }
  name(): string {
    return 'Homecomputer';
  }
  // sort() {
  //   return 0;
  // }
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
    return buffB;
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
      // { type: 1, f: buffA, fi: 0 },
      // { type: 1, f: buffB, fi: 1 },
      // { type: 1, f: buffC, fi: 2 },
      webglUtils.DEFAULT_NOISE,
      webglUtils.DEFAULT_NOISE,
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
