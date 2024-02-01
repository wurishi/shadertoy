import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
//by musk License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//rendering pass

#define SPHERE 1.0 
//#define SPHERE 0.0 

#define FOCUS_DISTANCE 7.5
#define DEFOCUS_PER_UNIT 0.0925
#define BLUR_LIMIT 1.0

#define RAY_STEPS_PRIMARY 80
#define RAY_STEPS_SECOND 20
#define RAY_STEPS_THIRD 10
#define RAY_STEPS_FOURTH 5

float df2obj(vec3 p){//repeated spheres
    p.x+=iTime-2.0;
    vec3 op=p;
    vec3 p2 = p;
    p.xz=mod(p.xz+vec2(2.0),4.0)-vec2(2.0);
    float box=max(abs(p.x),max(abs(p.y),abs(p.z)));
    float sphere = length(p);
    return (mix(box,sphere,SPHERE)-1.0);
}

float df2floor(vec3 p){//the floor
	return p.y+1.0;
}

float df2(vec3 p){//union(spheres, floor)
	return min(df2obj(p), df2floor(p));
}

#define nvec3(A,B,C) normalize(vec3(A,B,C))
#define nvec3a2(A,B) normalize(vec3(A,B))

mat2 matr(float a){//build a 2d rotation matrix
    float c=cos(a),s=sin(a);
    return mat2(c,s,-s,c);
}

#define NF(R,P,F) {vec2 e=vec2(0,0.01);R=nvec3(F(P-e.yxx),F(P-e.xyx),F(P-e.xxy));}
#define RM(R,P,D,F,S) {R=P+D*.1; for(int i=0; i<S; i++){float t=F(R);R+=t*D;}}


vec3 shading(vec3 p, vec3 d, vec3 n){//compute the shade at given position direction surface normal
    vec3 c = vec3(.0); //object color
    vec3 bg; //background color
    bg = (d*.5+.5)*.5;
    bg+=sin(d.y*4.0)*.5+.5;
    bg*=max(cos(iTime*0.2-10.0)*.7+.5,.0);
    if (df2(p)<.1){ //if near surface
        float lt=iTime-14.0;
        vec3 l = vec3(sin(lt*.1)*14.0,4.0+cos(lt*.23)*2.0,cos(lt*.13)*14.0);
        vec3 ldir = normalize(vec3(p-l));
        float oa = (df2(p-n)+df2(p-n*.5)*2.0+df2(p-n*.25)*4.0)*.5*.3333+.5;//ambient occlusion
        float od = max(min(min(df2(p-ldir*.3)/0.3,df2(p-ldir)),df2(p-ldir*0.6)/.6),.0);//shadow
        float dist = distance(p,l);
        c = vec3(.8,.7,.6)*max(.0,dot(n,ldir)*.5)/(1.0+dist*0.1)*(od*.8+.2)*2.0;//diffuse component
        float spec = pow(max(.0,dot(normalize(reflect(d,n)),-ldir)*.5+.5),1000.0)*56.0;//specular component
        c+=vec3(spec*od);
        c*=oa;
        c=mix(bg,c,1.0/(1.0+length(p)*0.01));//fogging
    } else {
        c =bg;
    }
    return c;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uvs = (fragCoord.xy-iResolution.xy*.5)/iResolution.yy*2.0;
    float ar= iResolution.x / iResolution.y;
    
    vec3 dir = nvec3a2(uvs, 2.0);//primary ray direction
    
    vec3 pos = vec3(.0,.0,-8.0);//primary ray position
    vec2 muvs = (iMouse.xy-iResolution.xy*.5)/iResolution.yy;//mouse position
    
    //rotate the direction and position based on mouse
	mat2 rx = matr(muvs.y*4.0-4.7);
    mat2 ry = matr(muvs.x*4.0+4.5);
    vec3 p;
    dir.yz*=rx;
    dir.xz*=ry;
    pos.yz*=rx;
    pos.xz*=ry;
    
    //first ray
    RM(p,pos,dir,df2,RAY_STEPS_PRIMARY);
    vec3 norm;
    NF(norm, p, df2);
    
    //fresnel shading
    float fres = 1.0-dot(dir,norm)*.9;
    vec3 color = shading(p,dir, norm);
    
    if (df2(p)<.1){//did we hit surface?
        
        //then shoot the second ray
        vec3 p2,n2,d2=reflect(dir,norm);
        RM(p2,p,d2,df2,RAY_STEPS_SECOND);
        NF(n2,p2,df2);
        
        color += shading(p2,d2,n2)*fres;
        
        if (df2(p2)<.1){//did we hit surface again?
			
            //then shoot the third ray
            float fres2 = 1.0-dot(d2,n2)*.9;
            vec3 p3,n3,d3=reflect(d2,n2);
            RM(p3,p2,d3,df2,RAY_STEPS_THIRD);
            NF(n3,p3,df2);

            color += shading(p3,d3,n3)*fres2*fres;

            if (df2(p3)<.1){//again?
                
            	//then shoot the fourth ray
                float fres3 = 1.0-dot(d3,n3)*.9;
                vec3 p4,n4,d4=reflect(d3,n3);
                RM(p4,p3,d4,df2,RAY_STEPS_FOURTH);
                NF(n4,p4,df2);

                color += shading(p4,d4,n4)*fres3*fres2*fres;
            }
        }
    }
    
    //compute how much this pixel is focused (this math could be improved)
    float focus = abs(distance(p,pos)-FOCUS_DISTANCE)*DEFOCUS_PER_UNIT;
    focus = min(BLUR_LIMIT,focus);
    
    //store color and focus amount
	fragColor = vec4(color,focus);
}`;

const buffB = `
//by musk License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//first blur pass

const vec2 dir = vec2(0.02,0.02);//blur direction
const float thresh = .5;//depth threshold

float weight(float x){
	return 1.0-x*x*x*x;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uvs = (fragCoord.xy-iResolution.xy*.5)/iResolution.yy*2.0;
    
    float dist = texture(iChannel0,uv).a;
    float totalw = .0;
    
    vec3 color = vec3(0,0,0);
    for (int i=0; i<=20; i++){
        vec2 p = uv;
        float fi = float(i-10)/10.0;
        p.xy+=dir*fi*dist;
        
        float w = weight(fi);
        
    	vec4 c = texture(iChannel0,p);
        if (dist>=c.a){
            w*=max(.0,1.0-(dist-c.a)/thresh);
        }
        color += c.xyz*w;
        totalw+=w;
    }
    color/=totalw;
	fragColor = vec4(color,dist);
}`;

const buffC = `
//by musk License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//second blur pass

const vec2 dir = vec2(0.02,-0.02);//blur direction
const float thresh = .5;//depth threshold

float weight(float x){
	return 1.0-x*x*x*x;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uvs = (fragCoord.xy-iResolution.xy*.5)/iResolution.yy;

    float dist = texture(iChannel1,uv).a;
    float totalw = .0;
    
    vec3 color = vec3(0,0,0);
    for (int i=0; i<=20; i++){
        vec2 p = uv;
        float fi = float(i-10)/10.0;
        p.xy+=dir*fi*dist;
        
        float w = weight(fi);
        
    	vec4 c = texture(iChannel1,p);
        if (dist>=c.a){
            w*=max(.0,1.0-(dist-c.a)/thresh);
        }
        color += c.xyz*w;
        totalw+=w;
    }
    color/=totalw;
	fragColor = vec4(color,dist);
}`;

const buffD = `
//by musk License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
//third blur pass

const vec2 dir = vec2(0.00,0.04);//blur direction
const float thresh = .5;//depth threshold

float weight(float x){
	return 1.0-x*x*x*x;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uvs = (fragCoord.xy-iResolution.xy*.5)/iResolution.yy;
    
    float dist = texture(iChannel2,uv).a;
    float totalw = .0;
    
    vec3 color = vec3(0,0,0);
    for (int i=0; i<=20; i++){
        vec2 p = uv;
        float fi = float(i-10)/10.0;
        p.xy+=dir*fi*dist;
        
        float w = weight(fi);
        
    	vec4 c = texture(iChannel2,p);
        if (dist>=c.a){
            w*=max(.0,1.0-(dist-c.a)/thresh);
        }
        color += c.xyz*w;
        totalw+=w;
    }
    color/=totalw;
	fragColor = vec4(color,dist);
}`;

const fragment = `
/*by musk License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
  email: muuuusk at gmail dot com

2016-02-02:

  My attempt at writing a decent depth of field effect.
  Well all I can say is that I'm satisfied with it.

  My attempt was to get a hexagonal bokeh. Well it's sort of like that.
  But maybe using it on a scene with a lot of reflection wasnt the best idea...

  So you might ask how come this is three pass when four buffers are used?
  Well only the depth of field effect uses 3 passes. 
  The rest of the passes handle rendering and post processing.
  
  This part here is the post processing.
*/

#define DISPLAY_GAMMA 1.8
#define USE_CHROMATIC_ABBERATION

vec2 uvsToUv(vec2 uvs){
    return (uvs)*vec2(iResolution.y/iResolution.x,1.0)+vec2(.5,.5);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uvs = (fragCoord.xy-iResolution.xy*.5)/iResolution.yy;
    
    //chromatic abberation
    #ifdef USE_CHROMATIC_ABBERATION
    vec3 color = vec3(0,0,0);
    color.x += texture(iChannel3, uvsToUv(uvs)).x*.66;
    color.xy += texture(iChannel3, uvsToUv(uvs*.995)).xy*.33;
    color.y += texture(iChannel3, uvsToUv(uvs*.990)).y*.33;
    color.yz += texture(iChannel3, uvsToUv(uvs*.985)).yz*.33;
    color.z += texture(iChannel3, uvsToUv(uvs*.980)).z*.66;
    #else
    vec3 color = texture(iChannel3, uvsToUv(uvs)).xyz;
    #endif
    
    //tone mapping
    color = vec3(1.7,1.8,1.9)*color/(1.0+color);
    
    //inverse gamma correction
	fragColor = vec4(pow(color,vec3((1.0)/(DISPLAY_GAMMA))),1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'MsG3Dz';
    }
    name(): string {
        return 'Three Pass DOF Example';
    }
    webgl() {
        return WEBGL_2;
    }
    sort() {
        return 730;
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
            { type: 1, f: buffB, fi: 1 },
            { type: 1, f: buffC, fi: 2 },
            { type: 1, f: buffD, fi: 3 },
        ];
    }
}
