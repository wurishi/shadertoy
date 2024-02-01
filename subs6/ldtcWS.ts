import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// created by florian berger (flockaroo) - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// ballpoint line drawing

// drawing a line segment from previous position to actual 
// for every particle (ballpoint tip)

#define PI 3.1415927

#define PNUM 200

struct Particle {
    vec2 pos;
    vec2 vel;
    int idx;
};

int particleIdx(vec2 coord, sampler2D s)
{
    ivec2 ires=textureSize(s,0);
    return int(coord.x)+int(coord.y)*ires.x;
}

vec2 particleCoord(int idx, sampler2D s)
{
    ivec2 ires=textureSize(s,0);
    return vec2(idx%ires.x,idx/ires.x)+.5;
}

vec4 getPixel(vec2 coord, sampler2D s)
{
    return texelFetch(s,ivec2(coord),0);
}

void readParticle(inout Particle p, vec2 coord, sampler2D s)
{
    vec4 pix=getPixel(coord,s);
    p.pos=pix.xy;
    p.vel=pix.zw;
    p.idx=particleIdx(coord,s);
}

void readParticle(inout Particle p, int idx, sampler2D s)
{
    readParticle(p,particleCoord(idx,s),s);
}

void writeParticle(Particle p, inout vec4 col, vec2 coord, sampler2D s)
{
    if (particleIdx(coord,s)%PNUM==p.idx) col=vec4(p.pos,p.vel);
}

vec4 getRand(vec2 pos, sampler2D s)
{
    vec2 rres=vec2(textureSize(s,0));
    return textureLod(s,pos/rres,0.);
}

vec4 getRand(int idx, sampler2D s)
{
    ivec2 rres=textureSize(s,0);
    idx=idx%(rres.x*rres.y);
    return texelFetch(s,ivec2(idx%rres.x,idx/rres.x),0);
}

void initParticle(inout Particle p, sampler2D s, sampler2D sr, int frame)
{
    vec2 res=vec2(textureSize(s,0));
    //p.pos = vec2((p.idx/2)%NUM_X,(p.idx/2)/NUM_X)*res/vec2(NUM_X,NUM_Y);
    p.pos=getRand(frame+p.idx,sr).xy*res.xy;
    p.vel = (getRand(p.pos,sr).xy-.5)*(float(p.idx%2)-.5)*300.;
}

vec4 getCol(vec2 pos, sampler2D s, vec2 res)
{
    return textureLod(s,pos/res.xy,0.);
}

float getVal(vec2 pos, sampler2D s, vec2 res)
{
    return dot(getCol(pos,s,res).xyz,vec3(1)/3.);
}

vec2 getGrad(vec2 pos, float eps, sampler2D s, vec2 res)
{
    vec2 d=vec2(eps,0);
    return vec2(
        getVal(pos+d.xy,s,res)-getVal(pos-d.xy,s,res),
        getVal(pos+d.yx,s,res)-getVal(pos-d.yx,s,res)
        )/eps/2.;
}
`;

const buffA = `
// created by florian berger (flockaroo) - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// ballpoint line drawing

// drawing a line segment from previous position to actual 
// for every particle (ballpoint tip)


float sdLine( vec2 pos, vec2 p1, vec2 p2, float crop )
{
    float l=length(p2-p1);
  	if(l<.001) return 100000.;
    vec2 t=(p2-p1)/l;
    // crop a little from the ends, so subsequent segments will blend together well
    l-=crop;
    p2-=t*crop*.5;
    p1+=t*crop*.5;
  	float pp = dot(pos-p1,t);
  	float pn = dot(pos-p1,t.yx*vec2(1,-1));
  	return max(max(pp-l,-pp),abs(pn));
}

float segDist( int idx, vec2 pos, float crop )
{    
    Particle p,pp;
    readParticle(p,idx,iChannel0);
    readParticle(pp,idx+PNUM,iChannel0);
	//vec2 g=getGrad(p.pos,2.5*iResolution.x/600.)*iResolution.x/600.;
    //if(length(g)<.01) return 10000.;
    
    if(length(pos-p.pos)>25.*iResolution.x/600.) return 10000.;
    if(length(p.pos-pp.pos)>30.*iResolution.x/600.) return 10000.;
    return sdLine(pos,p.pos,pp.pos,crop);
}

void mainImage( out vec4 fragColor, vec2 fragCoord )
{
    vec3 col=vec3(0,.2,.65);
    vec3 c=vec3(0);
    float w=1.7*sqrt(iResolution.x/600.);
    
    for(int i=0; i<PNUM; i++)
    {
        c+=(-col+1.)*clamp(w*.5-segDist(i,fragCoord,w*.7),0.,1.);
    }
    fragColor=vec4(c,1);
}

`;

const buffB = `
// created by florian berger (flockaroo) - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// ballpoint line drawing

// some particles (the actual ballpoint tips)

#define N(v) (v.yx*vec2(1,-1))

void propagate(inout Particle p)
{
    float dt=.02;
    p.pos+=p.vel*dt;
    float sc=(iResolution.x/800.);
    
    // gradient, its length, and unit vector
    vec2 g = 1.0*getGrad(p.pos,2.5*sc,iChannel2,iResolution.xy)*sc;
    // add some noise to gradient so plain areas get some texture
    g += (getRand(p.pos/sc,iChannel1).xy-.5)*.003;  //getRand is pixel based so we divide arg by sc so that it looks the same on all scales
    //g+=normalize(p.pos-iResolution.xy*.5)*.001;
    float gl=length(g);
    vec2 gu=normalize(g);
    
    // calculate velocity change
    vec2 dvel=vec2(0);
    
    float dir = (float(p.idx%2)*2.-1.); // every 2nd particle is bent left/right
    
    // apply some randomness to velocity
    dvel += .7*(getRand(p.pos/sc,iChannel1).xy-.5)/(.03+gl*gl)*sc;

    // vel tends towards gradient
    dvel -= 10.*gu*(1.+sqrt(gl*2.))*sc;
    
    // vel tends towards/away from normal to gradient (every second particle)
    dvel -= 20.*N(gu)/(1.+1.*sqrt(gl*100.))*sc*dir;
    
    // vel bends right/left (every second particle)
    //dvel += p.vel.yx*vec2(1,-1)*.06;
    dvel += .06*N(p.vel)/(1.+gl*10.)*dir;
    
    p.vel += dvel;
    
    // minimum vel
    //p.vel = normalize(p.vel)*max(length(p.vel),30.*sc);
    
    // anisotropic vel damping
    p.vel-=gu*dot(p.vel,gu)*(.1+2.*gl);
    //p.vel-=gu*dot(p.vel,gu)*.1;
    p.vel-=N(gu)*dot(p.vel,N(gu))*-.02;
    //p.vel*=.95;
}

void mainImage( out vec4 fragColor, vec2 fragCoord )
{
    int lNum = 40;
    Particle p;
    int idx = particleIdx(fragCoord,iChannel3);
    readParticle(p,idx%PNUM,iChannel3);
    if (idx<PNUM)
    {
        propagate(p);
        propagate(p);
        propagate(p);
        int atOnce=PNUM/100;
        //if (int(getRand(iFrame%PNUM).x*float(PNUM/2)) == p.idx/30) p.pos=getRand((iFrame+p.idx)%PNUM).xy*iResolution.xy;
        //if (int(getRand(iFrame).x*float(PNUM/atOnce)) == p.idx/atOnce)
        if ((p.idx+iFrame)%lNum == lNum-1)
        {
            p.pos=getRand(p.idx+iFrame+iFrame/17,iChannel1).yz*iResolution.xy;
            for(int i=0;i<10;i++) propagate(p);
        }
            //initParticle(p);
    }
	else if (idx>PNUM*2) discard;
    if (iFrame<10) initParticle(p,iChannel3,iChannel1,iFrame);
    //if (idx>PNUM) { p.pos=vec2(0,0); p.vel=vec2(1,1); readParticle(p,idx-PNUM); }
    writeParticle(p,fragColor,fragCoord,iChannel3);
}

`;

const fragment = `
// created by florian berger (flockaroo) - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// ballpoint line drawing

// realtime version on shaderoo: https://shaderoo.org/?shader=yMP3J7

// final mixing and some paper-ish noise

vec4 getRand(vec2 pos)
{
    vec2 tres = vec2(textureSize(iChannel1,0));
    vec4 r=texture(iChannel1,pos/tres/sqrt(iResolution.x/600.));
    return r;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 r = getRand(fragCoord*1.1)-getRand(fragCoord*1.1+vec2(1,-1)*1.);

    // buffC
    // vec2 uv = fragCoord.xy / iResolution.xy;
    // fragColor = (texture(iChannel0,uv)+texture(iChannel1,uv))*(1.-.006/2000.*float(PNUM));
    // fragColor.w=1.;
    // if(iFrame<10) fragColor=vec4(0,0,0,1);

    // vec4 c = 1.-.3*texture(iChannel0,fragCoord/iResolution.xy);

    vec2 uv = fragCoord.xy / iResolution.xy;
    vec4 i0 = (texture(iChannel0,uv)+texture(iChannel3,uv))*(1.-.006/2000.*float(PNUM));
    i0.w = 1.;
    if(iFrame<10) i0 = vec4(0,0,0,1);
    vec4 c = 1.-.3 * i0;

    fragColor = c*(.95+.06*r.xxxx+.06*r);
    //fragColor = c;
    vec2 sc=(fragCoord-.5*iResolution.xy)/iResolution.x;
    float vign = 1.0-.5*dot(sc,sc);
    vign*=1.-.7*exp(-sin(fragCoord.x/iResolution.x*3.1416)*20.);
    vign*=1.-.7*exp(-sin(fragCoord.y/iResolution.y*3.1416)*10.);
    fragColor *= vign;
    fragColor.w=1.;
}



`;

export default class implements iSub {
  key(): string {
    return 'ldtcWS';
  }
  name(): string {
    return 'ballpoint sketch';
  }
  // sort() {
  //   return 0;
  // }
  webgl() {
    return WEBGL_2;
  }
  common() {
    return common;
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
      { type: 0, path: './textures/XdlGzH.jpg' },
      { type: 1, f: buffB, fi: 3 },
    ];
  }
}
