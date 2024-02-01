import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// created by florian berger (flockaroo) - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// wedding of voxels and SDF

// try to enable FAKE_VOXEL_AO if its very slow on your machine

#define SHADOW
//#define FAKE_VOXEL_AO
//#define GRID_LINES

// some quaternion functions

#define PI2 (3.141592653*2.)
vec4 multQuat(vec4 a, vec4 b)
{
    return vec4(cross(a.xyz,b.xyz) + a.xyz*b.w + b.xyz*a.w, a.w*b.w - dot(a.xyz,b.xyz));
}

vec3 transformVecByQuat( vec3 v, vec4 q )
{
    return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w*v );
}

vec4 axAng2Quat(vec3 ax, float ang)
{
    return vec4(normalize(ax),1) * sin(vec2(ang*.5)+vec2(0,PI2*.25)).xxxy;
}

//vec3 light=normalize(vec3(cos(iTime),sin(iTime),sin(iTime*.17)));
vec3 light=normalize(vec3(1,.6,.3));

float torusDist(vec3 pos, float R, float r)
{
    return length(vec2(length(pos.xy)-R,pos.z))-r;
}

#define randSampler iChannel0

vec4 getRand(vec3 texc)
{
    // nonlinear interpolation experiment by adding a sine to texcoords
    texc+=.6*sin(texc*256.*PI2)/PI2/256.;
    float z=texc.z*256.+.5;
    float fz=floor(z);
    vec4 v1 = textureLod( randSampler, texc.xy+(fz     *vec2(17.0,7.0))/256.0, 0.0);
    vec4 v2 = textureLod( randSampler, texc.xy+((fz+1.)*vec2(17.0,7.0))/256.0, 0.0);
    return mix( v1, v2, fract(z) );
}

float distGradX;

float distTor(vec3 pos)
{
    vec4 q = vec4(0,0,0,1);
    q=multQuat(q,axAng2Quat(vec3(1,0,0),PI2*.125));
    q=multQuat(q,axAng2Quat(vec3(0,0,1),iTime*.5+2.));
    pos=transformVecByQuat(pos,q);
    
    pos+=.100*(getRand(pos*.015).xyz-.5);
    pos+=.050*(getRand(pos*.030).xyz-.5);
    pos+=.025*(getRand(pos*.060).xyz-.5);
    float d=torusDist(pos+vec3(.33,0,0),.66,.22+/*(pos.x+.33)**/distGradX);
    d=min(d,torusDist((pos-vec3(.33,0,0)).xzy,.66,.22+/*(pos.x-.33)**/-distGradX));
    return d;
}

#define iMouseData vec4(0)
float dist(vec3 pos)
{
    return distTor(pos);
}

vec3 grad(vec3 pos, float eps)
{
    vec3 d=vec3(eps,0,0);
    return vec3(
        dist(pos+d.xyz)-dist(pos-d.xyz),
        dist(pos+d.zxy)-dist(pos-d.zxy),
        dist(pos+d.yzx)-dist(pos-d.yzx)
        )/eps/2.;
}

bool checkSolid(vec3 pos)
{
    return dist(pos)-.00<.0;
}

bool gridStep(inout vec3 pos, inout vec3 n, vec3 grid, vec3 dir)
{
    float l,lmin=10000.;
    vec3 s = sign(dir);
    // find next nearest cube border (.00001 -> step a tiny bit into next cube)
    vec3 next=floor(pos/grid+s*(.5+.00001)+.5)*grid; // assuming floor(x+1.)==ceil(x)
    l=(next.x-pos.x)/dir.x; if (l>0. && l<lmin) { lmin=l; n=-vec3(1,0,0)*s; }
    l=(next.y-pos.y)/dir.y; if (l>0. && l<lmin) { lmin=l; n=-vec3(0,1,0)*s; }
    l=(next.z-pos.z)/dir.z; if (l>0. && l<lmin) { lmin=l; n=-vec3(0,0,1)*s; }
    
    pos+=dir*lmin;
    return checkSolid((floor((pos-.5*n*grid)/grid)+.5)*grid);
}

bool march(inout vec3 pos, vec3 dir, inout float dmin)
{
    bool rval=false;
    float eps=.001;
    float dtot=0.;
    dmin=10000.;
    float dp=dist(pos);
    for(int i=0;i<100;i++)
    {
        float d=dist(pos);
        if(d<dp) dmin=min(d,dmin);
        dp=d;
        d*=.8;
        pos+=d*dir;
        dtot+=d;
        if(d<eps) { rval=true; break; }
        if(dtot>4.) { pos-=(dtot-4.)*dir; break; }
    }
    return rval;
}

bool march(inout vec3 pos, vec3 dir)
{
    float dmin;
    return march(pos,dir,dmin);
}

#define GRID vec3(.05)

int stepAny(inout vec3 pos, in vec3 dir, inout vec3 n)
{
    distGradX=0.;
    vec3 startPos=pos;
    vec3 posV = pos;
    vec3 nV = vec3(0,0,1);
    bool bgV = true;
    for(int i=0;i<100;i++)
    {
        if(gridStep(posV,nV,GRID,dir)) { bgV=false; break; }
    }
    if (bgV) { n=light; posV=startPos+4.*dir; }
    
    distGradX=.1;
    vec3 posN = startPos;
    vec3 nN = vec3(0,0,1);
    bool bgN=!march(posN,dir);
    nN=grad(posN,.01);
    if (bgN) { nN=light; posN=startPos+4.*dir; }
    
    pos=posN; n=nN;
    if (bgV && bgN) return 0;
    if (length(posV-startPos)>length(posN-startPos)) return 1;
    pos=posV; n=nV; 
    return 2;
}

vec4 getRand( int idx )
{
    ivec2 res=textureSize(iChannel0,0);
    return texelFetch(iChannel0,ivec2(idx%res.x,(idx/res.x)%res.y),0);
}

vec4 getRand( vec2 pos )
{
    vec2 res=vec2(textureSize(iChannel0,0));
    return texture(iChannel0,pos/res);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float ph=iMouse.x/iResolution.x*7.;
    float th=-(iMouse.y/iResolution.y-.5)*3.;
    if(iMouse.x<1.) th=-0.1;
    if(iMouse.y<1.) ph=2.3;
    vec3 fwd = vec3(vec2(cos(ph),sin(ph))*cos(th),sin(th));
    vec3 right=normalize(vec3(fwd.yx*vec2(1,-1),0));
    vec3 up=cross(right,fwd);
    vec3 startPos=-fwd*2.5*(1.-iMouseData.z*.001);
    vec3 pos=startPos;
    vec2 sc=(fragCoord/iResolution.xy-.5)*2.*vec2(1,iResolution.y/iResolution.x);
    vec3 dir=normalize(fwd*1.6+right*sc.x+up*sc.y);
    vec3 n=vec3(0,0,1);
    float ao=1.;
    float sh=1.;
    float br=1.;
    float ao1,sh1,ao2,sh2;
    vec3 posS,nS;

    int m = stepAny(pos,dir,n);
    #ifdef SHADOW
    posS=pos+n*.005;
    int s = stepAny(posS,light,nS);
    sh = (s==0)?1.:0.;
    #endif

    #ifdef GRID_LINES
    if(m==2){
        vec3 s=sin(pos/GRID*PI2*.5);
        br*=1.-.15*(dot(exp(-s*s/.05),vec3(1))-1.);
        br*=1.-.075*(dot(exp(-s*s/.5),vec3(1))-1.);
    }
    #endif
    
    ao=1.;
    #ifndef FAKE_VOXEL_AO
    ao=0.;
    #define AONUM 24
    for(int i=0;i<AONUM;i++)
    {
        vec3 r=2.*(getRand(i+int(getRand(fragCoord).x*147.)+int(123.*pos.x+37.*pos.y+17.*pos.y)).xyz-.5);
        r-=dot(r,n)*n*.5;
        vec3 posC=pos+n*.02+r*.04;
        distGradX=0.;
        float solid=0.;
        if(dist((floor(posC/GRID)+.5)*GRID)<0.) solid=1.;
        distGradX=.1;
        if(dist(posC)<0.) solid=1.;
        ao+=solid;
    }
    ao=clamp(1.-ao/float(AONUM),0.,1.);
    #else
    if(m==2) { distGradX=.0; ao*=clamp(.8+.25*(dist(pos)+.03)/GRID.x,0.,1.); }
    if(m==1) { 
            ao-=.5*max(.15-dist(pos+n*.1),0.);
        	ao-=.5*max(.30-dist(pos+n*.2),0.);
        	ao-=.5*max(.60-dist(pos+n*.4),0.);
    }
    #endif
    ao*=1.-5.*max(.1-dist(pos+n*.2),0.);
    ao*=1.-8.*max(.05-dist(pos+n*.1),0.);
    
    float amb=.25;
    float fog=clamp(1.5-.5*length(pos),0.,1.);
    float diff=clamp(dot(normalize(n),normalize(light)),0.,1.)*.6;
    fragColor.xyz=vec3(mix(diff*sh,ao,amb))*br;
    fragColor.w=1.;
}


`;

const fragment = `
// created by florian berger (flockaroo) - 2018
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// crosshatch effect

// wedding of voxels and SDF

// try to enable FAKE_VOXEL_AO (in Buf A) if its very slow on your machine

#define FLICKER 1.

#define PI2 6.28318530718
#define sc (iResolution.x/600.)
    
vec2 roffs;
float ramp;
float rsc;


vec2 uvSmooth(vec2 uv,vec2 res)
{
    return uv+.6*sin(uv*res*PI2)/PI2/res;
}

vec4 getRand(vec2 pos)
{
    vec2 tres=vec2(textureSize(iChannel1,0));
    //vec2 fr=fract(pos-.5);
    //vec2 uv=(pos-.7*sin(fr*PI2)/PI2)/tres.xy;
    vec2 uv=pos/tres.xy;
    uv=uvSmooth(uv,tres);
    return textureLod(iChannel1,uv,0.);
}

vec4 getCol(vec2 pos)
{
    vec4 r1 = (getRand((pos+roffs)*.05*rsc/sc+iTime*131.*FLICKER)-.5)*10.*ramp;
    vec2 res0=vec2(textureSize(iChannel2,0));
    vec2 uv=(pos+r1.xy*sc)/iResolution.xy;
    //uv=uvSmooth(uv,res0);
    vec4 c = texture(iChannel2,uv);
    vec4 bg= vec4(vec3(clamp(.3+pow(length(uv-.5),2.),0.,1.)),1);
    bg=vec4(1);
    //c = mix(c,bg,clamp(dot(c.xyz,vec3(-1,2,-1)*1.5),0.,1.));
    float vign=pow(clamp(-.5+length(uv-.5)*2.,0.,1.),3.);
    //c = mix(c,bg,vign);
    return c;
}

float getVal(vec2 pos)
{
    return clamp(dot(getCol(pos).xyz,vec3(.333)),0.,1.);
}

vec2 getGrad(vec2 pos, float eps)
{
    vec2 d=vec2(eps,0);
    return vec2(
        getVal(pos+d.xy)-getVal(pos-d.xy),
        getVal(pos+d.yx)-getVal(pos-d.yx)
        )/eps/2.;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // subtraction of 2 rand values, so its [-1..1] and noise-wise not as white anymore
    vec4 r = getRand(fragCoord*1.2/sqrt(sc))-getRand(fragCoord*1.2/sqrt(sc)+vec2(1,-1)*1.5);
    // white noise
    vec4 r2 = getRand(fragCoord*1.2/sqrt(sc));
    
    // outlines
    float br=0.;
    roffs = vec2(0.);
    ramp = .7;
    rsc=.7;
    int num=3;
    for(int i=0;i<num;i++)
    {
        float fi=float(i)/float(num-1);
    	float t=.03+.25*fi, w=t*2.;
        // one closely matched edge-line
    	ramp=.15*pow(1.3,fi*5.); rsc=1.7*pow(1.3,-fi*5.);
    	br+=.6*(.5+fi)*smoothstep(t-w/2.,t+w/2.,length(getGrad(fragCoord,.4*sc))*sc);
        // another wildly varying edge-line
    	ramp=.3*pow(1.3,fi*5.); rsc=10.7*pow(1.3,-fi*5.);
    	br+=.4*(.2+fi)*smoothstep(t-w/2.,t+w/2.,length(getGrad(fragCoord,.4*sc))*sc);
    	//roffs += vec2(13.,37.);
    }
    fragColor.xyz=vec3(1)-.7*br*(.5+.5*r2.z)*3./float(num);
    fragColor.xyz=clamp(fragColor.xyz,0.,1.);
    
    
    // cross hatch
    ramp=0.;
    int hnum=5;
    #define N(v) (v.yx*vec2(-1,1))
    #define CS(ang) cos(ang-vec2(0,1.6))
    float hatch = 0.;
    float hatch2 = 0.;
    float sum=0.;
    for(int i=0;i<hnum;i++)
    {
 		float br=getVal(fragCoord+1.5*sc*(getRand(fragCoord*.02+iTime*1120.).xy-.5)*clamp(FLICKER,-1.,1.))*1.7;
        // chose the hatch angle to be prop to i*i
        // so the first 2 hatches are close to the same angle, 
        // and all the higher i's are fairly random in angle
    	float ang=-.5-.08*float(i)*float(i);
    	vec2 uvh=mat2(CS(ang),N(CS(ang)))*fragCoord/sqrt(sc)*vec2(.05,1)*1.3;
    	vec4 rh = pow(getRand(uvh+1003.123*iTime*FLICKER+vec2(sin(uvh.y),0)),vec4(1.));
    	hatch += 1.-smoothstep(.5,1.5,(rh.x)+br)-.3*abs(r.z);
    	hatch2 = max(hatch2, 1.-smoothstep(.5,1.5,(rh.x)+br)-.3*abs(r.z));
    	sum+=1.;
    	if( float(i)>(1.-br)*float(hnum) && i>=2 ) break;
    }
    
    fragColor.xyz*=1.-clamp(mix(hatch/sum,hatch2,.5),0.,1.);
    

    fragColor.xyz=1.-((1.-fragColor.xyz)*.7);
    // paper
    fragColor.xyz *= .95+.06*r.xxx+.06*r.xyz;
    fragColor.w = 1.;
    
    if(true)
    {
    	vec2 scc=(fragCoord-.5*iResolution.xy)/iResolution.x;
    	float vign = 1.-.3*dot(scc,scc);
    	vign*=1.-.7*exp(-sin(fragCoord.x/iResolution.x*3.1416)*40.);
    	vign*=1.-.7*exp(-sin(fragCoord.y/iResolution.y*3.1416)*20.);
    	fragColor.xyz *= vign;
    }
    
    //fragColor.xyz=getCol(fragCoord).xyz;
}


`;

export default class implements iSub {
  key(): string {
    return 'MsKfRw';
  }
  name(): string {
    return 'when voxels wed pixels';
  }
  sort() {
    return 604;
  }
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
      webglUtils.DEFAULT_NOISE, //
      { type: 1, f: buffA, fi: 2 },
    ];
  }
}
