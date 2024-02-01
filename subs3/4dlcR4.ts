import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define W0 0x3504f333u  // 15 | | 3*2309*128413 <- original
//#define W1 0xf1bbcdcbu  // 21 | | 7*349*1660097 <- original

#define W0 0x3504f335u    // 15 | 101 | 41*79*274627
//#define W1 0x6a09e663u  // 15 | 011 | 3*21963379
//#define W1 0x1f83d9abu  // 18 | 011 | 5*11*13*389*1901
//#define W1 0xbb67ae85u  // 19 | 101 | 3*349348253
#define W1   0x8fc1ecd5u  // 18 | 101 | 5*482370193


#define M  741103597u     // 15 | 13*83*686843


// if defined output on [0,1) otherwise on [0,1]. Undefined saves a shift
// as per hornet's comment.
//#define EQUIDISTANT

// basic version
uint hash(uint x, uint y)
{
  x *= W0;   // x' = Fx(x)
  y *= W1;   // y' = Fy(y)
  x ^= y;    // combine
  x *= M;    // MLCG constant
  return x;
}

// increase low bit period version. This does signficantly
// improve empirical stat testing...visually doesn't do
// much of anything (watch near line).
uint hash2(uint x, uint y)
{
  uint r = hash(x,y);
    
  // this can be replaced with a stronger
  // bit finalizer to further increase stat quality
  return r ^ (r >> 16);
}


//===============================================================
// visualization stuff below here


//======Start shared code for state
#define pz_stateYOffset 0.0
#define pz_stateBuf 0
#define pz_stateSample(x) texture(iChannel0,x)
vec2 pz_realBufferResolution;
vec2 pz_originalBufferResolution;

void pz_initializeState() {
    pz_realBufferResolution     = iChannelResolution[pz_stateBuf].xy;
    pz_originalBufferResolution = pz_stateSample(.5/pz_realBufferResolution).xy;
}

vec2 pz_nr2vec(float nr) {
    return vec2(mod(nr, pz_originalBufferResolution.x)
                      , pz_stateYOffset+floor(nr / pz_originalBufferResolution.x))+.5;
}

vec4 pz_readState(float nr) {
    return pz_stateSample(pz_nr2vec(nr)/pz_realBufferResolution);
}

float pz_resetCount() { return pz_readState(1.).z;   }
vec3 pz_position()    { return pz_readState(3.).xyz; }

vec2 pz_initializeState(vec2 fragCoord) {
    pz_initializeState();
    
    vec3 position = pz_position();
    fragCoord -= 0.5*iResolution.xy;
    fragCoord *= position.z;
    fragCoord += (0.5 + position.xy) * iResolution.xy ;
    return fragCoord;
}
//======End shared code for state



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  int   t = int(fragCoord.x) - int(0.5*iResolution.x);
  fragCoord = pz_initializeState(fragCoord);
    
  uvec2 p = uvec2(ivec2(fragCoord.xy));
  uint  h;
  
  if (t < 0)
    h = hash(p.x,p.y);
    else if (t > 1)
    h = hash2(p.x,p.y);
        
#if defined(EQUIDISTANT)
  float f = float(h>>8u)*(1.0/16777216.0);
#else
  float f = float(h)*(1.0/4294967296.0);
#endif
  
  fragColor = vec4(f,f,f,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '4dlcR4';
  }
  name(): string {
    return '2D Weyl hash 32-bit XOR';
  }
  sort() {
    return 399;
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
    return [
      webglUtils.WOOD_TEXTURE, //
    ];
  }
}
