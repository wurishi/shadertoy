import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `

//SETTINGS
#define ZOOM  3.
#define MS  3.
#define M 255.
#define RAIN
#define DEMOT 30. //enable to switch scenario every 30s

//RESOLUTION
#define R iResolution.xy
#define RZ (R/ZOOM  -vec2(0.,10.))
#define Main void mainImage(out vec4 Q, vec2 U)

//VARIABLES
#define A(U) texture(iChannel0,(U)/R)
#define TS vec2(textureSize(iChannel0,0))
#define DEMO (texture(iChannel0,vec2(RZ.x,0.)).r > 0.)
#define Neighborhood vec4 n[9] = vec4[] \
		(A(U+vec2(-1,1)),  A(U+vec2(0,1)),  A(U+vec2(1,1)),  \
         A(U+vec2(-1,0)),  A(U+vec2(0, 0)), A(U+vec2(1,0)), \
         A(U+vec2(-1,-1)), A(U+vec2(0,-1)), A(U+vec2(1,-1)));
#define w(i) n[i].x //water
#define b(i) n[i].y //barrier

            
//EMPIRICAL ADJUSTMENT           
#define OVERFLOW .2 //0.=  waterfalls are always vertical but slow, >.5: water flows lateral in waterfalls
#define LTRANSF .8 //.5=half difference is transferred lateral (stable but slow) 
//RULES:
#define RULE1_IN   if(w(1) > 0. && w(4) <M &&  b(4)<1.)  Q.x=min(M, w(4)+w(1))            
#define RULE1_OUT  if(w(4) >0. && w(7) <M  && b(7) <1.) Q.x =max(0., w(4) + w(7)-M) 

//RULE 2 (SEMILATERAL VERSION):                 
#define RULE2_OUT  if(w(4)>0. && (w(7)>=M*(1.-OVERFLOW) || b(7)>0.)  &&  w(5-i) < w(4)-2. && b(5-i)<1. && w(2-i)<1.) {\
  Q.x=w(4)-floor((w(4)-w(5-i)) *LTRANSF);}   
#define RULE2_IN   if (w(3+i)>0. && (w(6+i)>=M*(1.-OVERFLOW*.4) || b(6+i)>0.) && w(4) < w(3+i) -2. && b(4)<1. && w(1)<1.){ \
  Q.x= w(4)+floor((w(3+i)-w(4))*LTRANSF );}

/*
//RULE 2 (BILATERAL VERSION):
#define RULE2_OUT  if( w(4)>.0 &&  (w(7)>=M*(1.-OVERFLOW) || b(7)>0.) ) {\
  float rd=   ( w(3+i) < w(4)-2. && b(3+i)<1. && w(i)<1.) ? w(4)-w(3+i):0.;\
  float ld=   ( w(5-i) < w(4)-2. && b(5-i)<1. && w(2-i)<1.) ? w(4)-w(5-i):0.;\
  if(ld+rd>2.) Q.x=w(4)-floor( min(ld+rd,w(4)) *LTRANSF);} 

#define RULE2_IN if( b(4)<1. && w(1)<1.){ \
  float ld= (w(4) < w(3+i) -2. && w(3+i)>0. && (w(6+i)>=M*(1.-OVERFLOW*.4) || b(6+i)>0.)) ? w(3+i)-w(4) :0.; \
  float rd= (w(4) < w(5-i) -2. && w(5-i)>0. && (w(8-i)>=M*(1.-OVERFLOW*.4) || b(8-i)>0.)) ? w(5-i)-w(4) :0.; \
  if(ld+rd>2.) Q.x= w(4)+floor(min(ld+rd,M-w(4))*LTRANSF );}             
*/

//KEYBOARD
#define CH_SPC 32
#define CH_SH 16      
#define keyboard(k) texelFetch(iChannel1, ivec2(k,0), 0).r>.5

//HASH
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}


`;

const buffA = `


Main {
  Q =vec4(0.);
  
  Neighborhood;
  // 0 1 2
  // 3 4 5
  // 6 7 8    
  Q = n[4]; //propagate state if nothing happens
  
  // DEMO MODE
  bool demoMode=true;
  if(iFrame>0) demoMode= DEMO;
if(keyboard(CH_SPC)) demoMode=false;
if(DEMO && !demoMode  && U.x>2. && U.x <RZ.x-2. &&  U.y> 2. ) Q.y=0.;

  //BARRIERS:
  if (iFrame==0 
      || (demoMode && mod(iTime,DEMOT)<.2 )         
      || TS.x != A(vec2(0.)).z){
      demoMode=true;
      Q =vec4(0.);
      if( U.x<=2. || U.x >=RZ.x-2. ||  U.y<= 2.  ) Q=vec4(0.,1.,0.,0.);
      
      float ang=.3;
      vec2 Us = U ;
      
      if(demoMode){
         
       float mode= mod( iTime/DEMOT,3.);       
       if(mode>=1.) Us = U + vec2(0., sin(U.x/5.)*5.);
       if(mode>=2.) Us=U+ vec2(U.x*sin(ang) -U.y*cos(ang),+U.x*cos(ang) +(U.y )* sin(ang));

       if(RZ.y - U.y>RZ.y*.2) Q.y= step(.4,Q.y +step( mod( (Us/MS) [ int( 1e4*length(ceil(Us/8./MS)) ) % 2 ] , 8. ),.7));
      }
  }
  
  //WATER UPDATE
  if(b(4)<1. && U.y>0. && U.y <RZ.y && U.x>1.){
      Neighborhood;   
  int i=int(hash12(iTime + U +1.)*2.)*2; //left or right RULE (for semilateraal version)
  
      // the order of IN/OUT  for each rule is crucial
      // neither is better, so i made it randomic
      
      //RULE 1 - FALLS       
      if(hash12(iTime + U)>0.5){
        RULE1_OUT; 
        RULE1_IN ;   
      } else { //inverse order
        RULE1_IN ;    
    RULE1_OUT; 
      }
      
      //RULE 2 - LATERAL 
      if(hash12(iTime + U)>.5){ 
          RULE2_OUT;
          RULE2_IN;          
      }else{//inverse order           
          RULE2_IN;
          RULE2_OUT;  
     }

  } else Q.x=0.; //out of the grid
  

#ifdef RAIN 
  //RAIN:
  if( U.x>1. && abs(U.y-RZ.y+5.)<5.  && hash12(U+iTime)>.995) Q.x=floor(M*.2);
#endif  
  
  //MOUSE 
  if(length(U- floor(iMouse.xy/ZOOM +.5))<1.) Q.z=1.; else Q.z=0.;
  if (iMouse.z>0.){
      if(keyboard(CH_SPC) &&  length(U -floor(iMouse.xy/ZOOM +.5))<5.){Q.x =0.; Q.y=1.;}
      else if(keyboard(CH_SH) &&  length(U -floor(iMouse.xy/ZOOM +.5))<5.){Q.x =0.; Q.y=0.;}
      else if ( length(U -floor(iMouse.xy/ZOOM +.5))<1.
      && U.x >1. //&& hash12(U+iTime)>.7
       && A(iMouse.xy/ZOOM).x <1. )
      {Q.x =  M; Q.y=0.; }
}	
  
  //CHANGE RESOLUTION DETECTION:
  if(max(U.x,U.y)<1.) Q.zw= TS.xy; 
  
  //store demo mode
  if(demoMode && U.y<1. && U.x>=RZ.x) Q.x=1.;

}
`;

const fragment = `
/*-----------------------------------------------------------

When playing Minecraft years ago, I always asked myself why 
water physic was so so irrealistic... I will never know!
Lucklily there was a mod called "finite liquid", that I liked so much.

I'm trying to make something similar, with these constraints:
1. the water state for each block (= texel) should be 
    stored in one integer (8 bits)
2. to update  water state, only neightbours blocks 
   from previous frame should be evaluated (8 blocks)
3. the water MUST be finite, so no water generation 
   or destruction during transition

I've modelled the water state in the "x" variable with the following values
	x==0: no water
    0 < x < M: surface water or falling water, with level =x
	x>= M: deep water, where x-M is the pressure (now pressure is always 0)
where M is max levelling distance.

At the moment, I've implemented two basic rules:
1. FALLS: when the block below is free, transfer as much water as possibile
2. LATERAL: when the blocks below are not free and the lateral block level
			is less then current level, transfer part of the difference

the 2nd rule is evaluated with the left block in odd frames, 
and with right block on even frames. 
In a 3D version, the lateral block would be 4 so a iFrame%4 would be necessary.

Each rule must be implemented  twice (water out, water in) 
to guarantee water conservation. Order of in/out rules must be randomic.

After implementing the rules, I added adjustment factors, 
based on empirical observation.

-------------------------------------------------------------*/
Main {
       
    vec4 data=A(U / ZOOM );
    float w = data.x;

    Q = mat4(0. , .5, 1., 0., //water
             0. , -5., 1., 0., //level max
             1. , 0, 0., 0.,  // pressure (not implemented yet)
             1. , 1., 1., 0. ) //barrier
        *vec4(step(.5,w),step(M,w),step(M+1.,w) ,data.y );
	
    //mouse pointer
    Q+=vec4(1. , 0., 0., 0. )*data.z;
   
}
`;

export default class implements iSub {
  key(): string {
    return 'WdjBDV';
  }
  name(): string {
    return 'Rain & Floods';
  }
  // sort() {
  //   return 0;
  // }
  common() {
    return common;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
    ];
  }
}
