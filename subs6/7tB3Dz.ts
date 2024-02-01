import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float asphere(in vec3 ro, in vec3 rd, in vec3 sp, in float sr){ 
  // geometric solution for analytic ray-sphere intersection
  float sr2 = sr*sr;
  vec3 e0 = sp - ro; 
  float e1 = dot(e0,rd);
  float r2 = dot(e0,e0) - e1*e1; 
  if (r2 > sr2) return 1000.0 + sqrt(r2)-sqrt(sr2); // anything over 1k is a "miss" value. the amount over 1k is the nearest approach
  float e2 = sqrt(sr2 - r2); 
  return e1-e2; // nearest intersection between ray and sphere
}


float map(in vec3 ro, in vec3 rd){ 
  return min(asphere(ro,rd,vec3(0.0,0.0,0.0), 1.5),
             min(asphere(ro,rd,vec3(-2,0.0,0.0),1.0), 
                 min(asphere(ro,rd,vec3(0.0,-2,0.0),1.0),
                     min(asphere(ro,rd,vec3(1.15,1.15,1.15),1.0),
                         min(asphere(ro,rd,vec3(0.0,0.0,-2),1.0),
                            asphere(ro,rd,vec3(3.,3.,3.),0.2)
                         )
                     )
                 )
             )
         );
}


vec3 ascene(in vec3 ro, in vec3 rd, in float ow){
  float t = map(ro,rd);
  vec3 col = vec3(0);
  if (t>1000.0){
      if(t-1000.0<ow){ //if a "miss" is returned within outline radius, set outline
          col = vec3(0);
      }
      else{ //if a "miss" is returned outside of outline radius, set pixel to 50% grey
          col = vec3(0.5);
      }
  }
  else {
      vec3 loc = t*rd+ro;
      loc = loc*0.5;
      col =  vec3(clamp(loc.x,0.0,1.0),clamp(loc.y,0.0,1.0),clamp(loc.z,0.0,1.0));
  }
  return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
  //THIS v
  const int lensRes = 8; //THIS <
  const int ssaa = 1; //THIS <
  float lensDis = 0.6; //THIS <
  float lensSiz = 1.5; //THIS <
  float focalDis = 11.5; //THIS <
  float aberration = 0.15; //THIS <
  float outlineWidth = 0.2; //THIS <
  //THIS ^
  //fragcoord is the center of the pixel
vec2 sensorLoc = fragCoord.xy / iResolution.x; //sets x limits from 0-1 y at same scale, center at (0.5,0.?)
  sensorLoc = vec2(0.5, 0.5*(iResolution.y/iResolution.x)) - sensorLoc; //reverse sensor and center on (0,0)
  
  vec3 UP = vec3(0.0,1.0,0.0); //useful later could be hardcoded later instead
  float t = 0.5*iTime - 5.0*iMouse.x/iResolution.x; //tau used to determine camera position
  
  vec3 cameraPos = 10.0*vec3(1.0*sin(2.0*t),1.0*cos(1.5*t),1.0*cos(2.0*t)); //this is not normalized
  
  vec3 cameraDir = -cameraPos; //this will and should be normalized
  cameraDir = normalize(cameraDir); //normalize
  
  vec3 cameraX = cross(cameraDir,UP); //right dir for camera
  cameraX = normalize(cameraX); //normalize
  
  vec3 cameraY = cross(cameraX,cameraDir); //up dir for camera
  cameraY = normalize(cameraY); //normlize

  vec3 colorTotal = vec3(0.0);//for each pixel reset the accumulated color
  vec3 ucolorTotal = vec3(0.0); //set up for an unabberated comparison color
  float colorCount = 0.0; //keep track of how many color samples are in final sum
  float lensResF = float(lensRes); //for comparing to float later
  float focal = 1.0+lensDis/focalDis; //brings the image to focus at focalDis from the cameraPos
  float ssaaF = float(ssaa); //for using later to save a cast.
  float sscale = 1.0/(iResolution.x); //size of a pixel
  float sstep = 1.0/ssaaF; //step for SSAA
  float sstart = sstep/2.0-0.5; //location of first SSAA step
  float lstep = 1.0/lensResF; //step for lens
  float lstart = lstep/2.0-0.5; //location of first lens step
  
  //Red Channel
  float rFocalDis = focalDis*(1.0+aberration);
  float rFocal = 1.0+lensDis/rFocalDis;
  
 
  //Green Channel 
  float gFocalDis = focalDis;
  float gFocal = 1.0+lensDis/gFocalDis;
  
  
  //Blue Channel
  float bFocalDis = focalDis*(1.0-aberration);
  float bFocal = 1.0+lensDis/bFocalDis;
  
  for (float sx = sstart; sx < 0.5; sx += sstep){ //SSAA x direction
    for (float sy = sstart; sy < 0.5; sy += sstep){ //SSAA y direction
          
        vec2 ss = vec2(sx,sy)*sscale; //sub pixel offset for SSAA
          vec3 sensorRel = cameraX*(sensorLoc.x+ss.x) + cameraY*(sensorLoc.y+ss.y); //position on sensor relative to center of sensor. Used once
          vec3 sensorPos = cameraPos - lensDis*cameraDir + sensorRel; //3d position of ray1 origin on sensor
            
          for (float lx = lstart; lx < 0.5; lx+=lstep){
          for (float ly = lstart; ly < 0.5; ly+=lstep){
                  
              vec2 lensCoord = vec2(lx,ly); //fragCoord analog for lens array. lens is square
            vec2 lensLoc = (lensCoord)*lensSiz; //location on 2d lens plane
              
                  if (length(lensLoc)<(lensSiz/2.0)){ //trim lens to circle
                      
                  vec3 lensRel = cameraX*(lensLoc.x) + cameraY*(lensLoc.y); //position on lens relative to lens center. Used twice
                vec3 lensPos = cameraPos + lensRel; // 3d position of ray1 end and ray2 origin on lens
                vec3 senlenRay = lensPos - sensorPos; //direction of ray from sensor to lens
                      
                      //Red channel
                vec3 rRay = senlenRay - rFocal*(lensRel); //direction of ray afer being focused by lens
                rRay = normalize(rRay); //normalize after focus 
                float red = ascene(lensPos,rRay,outlineWidth).x; //scene returns red
                      
                      //Green channel
                vec3 gRay = senlenRay - gFocal*(lensRel); //direction of ray afer being focused by lens
                gRay = normalize(gRay); //normalize after focus 
                      vec3 ucolor = ascene(lensPos,gRay,outlineWidth); //unaberrated scene
                float green = ucolor.y; //scene returns green
                      
                      //Blue channel
                vec3 bRay = senlenRay - bFocal*(lensRel); //direction of ray afer being focused by lens
                bRay = normalize(bRay); //normalize after focus 
                float blue = ascene(lensPos,bRay,outlineWidth).z; //scene returns blue
                      
                colorTotal = colorTotal+vec3(red, green, blue); //sum color over all points from lens
                      colorCount += 1.0; //total number of colors added.
                  }
              }
          }
      }
  }
  fragColor = vec4(colorTotal/colorCount,0.0);
  fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return '7tB3Dz';
  }
  name(): string {
    return 'DoF, CA, OL, Camera demo, Enjoy!';
  }
  sort() {
    return 626;
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
}
