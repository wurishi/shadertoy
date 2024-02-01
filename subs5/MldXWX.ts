import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Copy the same code to all buffers and chain them.

#define SIZX 130.0
#define SIZY 66.0
const vec3 windvel = vec3(0.01,0.0,-0.005);
const float gravity = 0.0022;
float mytime=0.0;

vec3 getpos(vec2 uv)
{
    return texture(iChannel1,(uv+0.01)/iResolution.xy).xyz;
}
vec3 getvel(vec2 uv)
{
    return texture(iChannel1,(uv+0.01+vec2(SIZX,0.0))/iResolution.xy).xyz;
}

vec3 pos,vel,ovel;
vec2 c;

void edge(vec2 dif)
{
    if ( 
        (dif+c).x>=0.0 && (dif+c).x<SIZX &&
        (dif+c).y>=0.0 && (dif+c).y<SIZY    )
    {
        float edgelen = length(dif);
        vec3 posdif = getpos(dif+c)-pos;
        vec3 veldif = getvel(dif+c)-ovel;

        vel += normalize(posdif)*(clamp(length(posdif)-edgelen,-1.0,1.0)*0.15); // spring

        //            vel += dot(posdif,veldif)*posdif/dot(posdif,posdif)*0.33; // damper
        vel +=normalize(posdif)*( dot(normalize(posdif),veldif)*0.10); // damper
        //            vel += normalize(posdif)*(-0.005); // spring
    }
}

vec3 findnormal(vec2 c)
{
    return normalize(cross(  getpos(c-vec2(1.0,0.0))-getpos(c+vec2(1.0,0.0)) ,  getpos(c-vec2(0.0,1.0))-getpos(c+vec2(0.0,1.0)) ));
}

vec3 ballpos()
{
    return vec3(128.0*0.4,64.0*0.7,64.0*(cos(mytime/3.0)*0.8));;
}

void ballcollis()
{
    float ballradius = 64.0*0.3;
    vec3 ballpos2 = ballpos();
    if ( length(pos-ballpos2)<ballradius)
    {
        vel -= normalize(pos-ballpos2)*dot(normalize(pos-ballpos2),vel);
        vel += (normalize(pos-ballpos2)*ballradius+ballpos2-pos);
    }
                        
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
//    mytime = float(iFrame) / 60.0;
    mytime = getpos(vec2(0.0,SIZY)).x;
    
    fragColor=vec4(0.0);
    vec2 fc = fragCoord+0.1;
    fc-=fract(fc);

    if (fc.y>=SIZY+2.0 || fc.x>=SIZX*2.0) discard;
    
    c = fc;
    c.x = fract(c.x/SIZX)*SIZX;

    pos = getpos(c);
     vel = getvel(c);

    
    
    
/*    vec2 edges[6];
    edges[2]=vec2(1.0,0.0);
    edges[3]=vec2(-1.0,0.0);
    edges[0]=vec2(0.0,1.0);
    edges[1]=vec2(0.0,-1.0);
    edges[4]=vec2(1.0,1.0);
    edges[5]=vec2(-1.0,-1.0);*/
    
    ovel = vel;
    
    edge(vec2(0.0,1.0));
    edge(vec2(0.0,-1.0));
    edge(vec2(1.0,0.0));
    edge(vec2(-1.0,0.0));
    edge(vec2(1.0,1.0));
    edge(vec2(-1.0,-1.0));

    edge(vec2(0.0,2.0));
    edge(vec2(0.0,-2.0));
    edge(vec2(2.0,0.0));
    edge(vec2(-2.0,0.0));
    edge(vec2(2.0,-2.0));
    edge(vec2(-2.0,2.0));
    
    
//    vel.x = 0.0;
    ballcollis();
    
    pos += vel;
    vel.y += gravity; // gravity
    
    // apply air friction
    
    vec3 norm = findnormal(c);
    vel -= norm * (dot(norm,vel-windvel)*0.05 );
    
    
    if (iFrame==0 || c.y==0.0) // init
    {
        pos = vec3(fc.x*0.85,fc.y,fc.y*0.01);
        vel = vec3(0.0,0.0,0.0);
    }
    
    
    fragColor = vec4(fc.x>=SIZX ? vel : pos,0.0);
    
    if (fc.y>=SIZY)
    {
        mytime += 1.0/4.0/60.0;
        fragColor = vec4(mytime);
    }
    fragColor.a = 1.;
}
`;

const fragment = `
/*
  128x64 vertex cloth simulation with collision, wind

  try to guess, how it works before reading :D

*/

#define SIZX 128.0
#define SIZY 64.0

#define SIZYPHYS (SIZY+2.0)

float mytime = 0.0; // timing stored in texture to deal with frame skip

const float maxextentionratio = 1.15;


const float ballradius = 0.99 * 64.0*0.3;
vec3 ballpos()
{
    return vec3(128.0*0.4,64.0*0.7,64.0*(cos(mytime/3.0)*0.8));;
}

vec3 lighting(vec3 normal)
{
	return vec3(dot(normal,normalize(vec3(0.5,1.0,0.0)))*0.5+0.5);    
}

vec4 background(vec3 campos,vec3 camdir)
{
	return vec4(vec3(atan(camdir.y*8.0)*-0.5+0.5),9999.0)    ;
}

vec3 getpos(vec2 uv)
{
    return textureLod(iChannel1,vec2((uv+0.5)/iResolution.xy),0.0).xyz;
}


vec3 rotatex(vec3 v,float anglex)
{
	float t;
	t =   v.y*cos(anglex) - v.z*sin(anglex);
	v.z = v.z*cos(anglex) + v.y*sin(anglex);
	v.y = t;
	return v;
}

float anglex = 0.1;
float angley = 0.0;

vec3 rotcam(vec3 v)
{
	float t;
	v = rotatex(v,anglex);
	
	t = v.x * cos(angley) - v.z*sin(angley);
	v.z = v.z*cos(angley) + v.x*sin(angley);
	v.x = t;
	return v;
}


vec3 findnormal(vec2 uv)
{
    return normalize(cross(getpos(uv+vec2(1.0,0.0))-getpos(uv-vec2(1.0,0.0)),getpos(uv+vec2(0.0,1.0))-getpos(uv-vec2(0.0,1.0))));
}

vec4 raytrace_curtain_background_rail(vec3 campos,vec3 camdir)
{
    // raycast 1024*512 voxels with spatial tree
    // note that the cloth has only 128x64 vertices, 
    // but linear filtered reading of the positions texture oversamples it
    
    const float minst = 1.0/8.0; // oversampling voxelgeometry by 8x8 
    const float voxelsize = minst*0.77*maxextentionratio;
    float mindept=999.0;
    vec2 c = vec2(0.0,0.0);
    vec2 minc=vec2(-1.0,-1.0);
    float st = SIZY;
    float levelup=0.0;
    
    
    float cnt=0.0;
    for(float i=0.0;i<5000.0;i+=1.0) // less than 200 iterations for most pixels
    {
        cnt+=1.0;
            
        vec3 wp = getpos(c);
        
        if (st==minst)
        {
        	float d=length( cross(wp-campos,camdir) );
        	if (d<=voxelsize)
        	{
                float dept = dot(camdir,wp);
                if (dept<mindept)
                {
                    mindept = dept;
                    minc = c;
                }
	        }
            
        	if (st==minst)            
	            levelup=1.0;
        }
        
        vec3 boundingcenter= getpos(c.xy + vec2(st*0.5));

        if (  length( cross(boundingcenter-campos,camdir) )>st*0.79*maxextentionratio )
        {
            levelup=1.0;
        }
        
        
        
        if (levelup>0.0)
        {
            levelup=0.0;
            
            if ( fract(c.x/st/2.0)<0.25 )
            {
                c.x += st;
            }
            else
            {
                c.x -= st;            

                if ( fract(c.y/st/2.0)<0.25 )
                {
                    c.y += st;
                }
                else
                {
                    c.y -= st;
                    st *= 2.0;
                    levelup=1.0;
                }
            }
        }
        else
        {
            
            if (st>minst) st/=2.0;
            
        }
        
//        if (c.x>=SIZX) break;    
        if (c.y>=SIZY) break;    
    }
    
    if (minc.x>=0.0)
    {
        vec3 diffuse;
        diffuse = clamp( (texture(iChannel0,vec2(minc.x/SIZX,minc.y/SIZX)).xyz-0.3)*-30.0,0.7,1.0)*1.5;
        
        vec3 normal = findnormal(minc);
        
        if ( dot(camdir,normal) < -0.1) // back side detection with antibug cheat
        {
            normal*=-1.0;  // backside color of curtian
            diffuse*=vec3(0.5,0.7,1.0);
        }
        else
        {
			diffuse*=vec3(1.0,0.8,0.6); // front color 
        }
        
        mindept-=dot(campos,camdir);
        vec3 hitpos = campos + camdir*mindept;
        
        // ball analitic ambient occlusion on curtian
        float aaom = clamp( (hitpos.y-ballpos().y)/ballradius,-1.0,1.0)*0.5+0.5;
        
        float balld = length(hitpos-ballpos());
        float aao = 1.0 - aaom * max(dot(normal,(hitpos-ballpos())),0.0)/balld/balld/balld*ballradius*ballradius*1.3;
        
//        aao = 1.0;
        
        return  vec4(diffuse*lighting(normal)*aao,mindept);
        
    }
    else
    {
        vec3 dir = camdir; // quick anti aliased 3d line
        dir.x = 0.0;
        vec3 p2 = campos;
        p2.x = 0.0;
        float rod = min(length(cross(normalize(dir),p2))/0.8,1.0);
        if (dot(dir,p2)>0.0) rod = 1.0;
        float mul = rod;
        return background(campos,camdir)*vec4(mul,mul,mul,1.0);
    }
    

}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
//    mytime = float(iFrame) / 60.0;
    mytime = getpos(vec2(0.0,SIZYPHYS)).x;
    
    float zoom = 1.4;
    float zoomamt = clamp(sin((mytime)/2.0+0.5)*-3.0+1.2,0.0,1.0);
    
    angley = cos((mytime+2.0)*0.1)*1.3;
    anglex = max(-0.05,-ballpos().z/SIZY*0.5);
    
    
    fragColor = vec4(1.0);
    
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec3 campos = vec3(SIZX/2.0,SIZY*0.6,SIZY*0.0);
	vec3 camdir = vec3((uv-0.5)*1.1,1);
	camdir.y *= -iResolution.y / iResolution.x; // wide screen
	camdir = normalize(rotcam(camdir));
    zoom = 1.1 - zoomamt*0.3;
	campos -= rotcam(vec3(0,0,SIZX*zoom)); // back up from subject    
    
    
    vec4 res  = raytrace_curtain_background_rail(campos,camdir);
    
    // raytrace ball    
    vec3 bp = ballpos();
    
    
    float m = length(cross(bp-campos,camdir))/ballradius;
    if (m<1.0)
    {
        float dept = dot(bp-campos,camdir) - sqrt(1.0-m*m)*ballradius;
        vec3 hitpos = campos + camdir*dept;
        vec3 normal = -(hitpos-bp)/ballradius;
        if (dept < res.a)
        {
            res.a = dept;
            
            vec3 reflectedraydir = reflect(camdir,normal);
            
            // ball shading:
            // raytracing the reflected curtain in the ball is very slow due to random texture access
            
//            vec3 reflectedcolor = raytrace_curtain_background_rail(hitpos,reflectedraydir).xyz;
            vec3 reflectedcolor = background(hitpos,reflectedraydir).xyz;
            
            float f=1.0-max(dot(normal,camdir),0.0);
            float fresnel = 0.05+0.95*f*f*f*f*f;
            res.xyz = mix(vec3(0.5,0.05,0.1)*lighting(normal),reflectedcolor, fresnel);
        }
    }
    
    fragColor = res;
    
    // progress bar was aimed to hide the bugs in the beginning, such as the stretching.
    // but it ruins the preview
/*    const float loadtime = 2.0;
    if (mytime<loadtime)
    { 
        fragColor = vec4(0.0);
        if ( uv.y>0.45 && uv.y<0.55)
        {
            fragColor = vec4(mytime/loadtime > uv.x ? 1.0 : 0.5);
        }
    }*/
}
`;

export default class implements iSub {
  key(): string {
    return 'MldXWX';
  }
  name(): string {
    return 'curtain and ball';
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
      webglUtils.TEXTURE6, //
      { type: 1, f: buffA, fi: 1 },
    ];
  }
}
