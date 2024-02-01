import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define M1 1597334677U     //1719413*929
#define M2 3812015801U     //140473*2467*11

float hash( uvec2 q )
{
    q *= uvec2(M1, M2); 
    
    uint n = (q.x ^ q.y) * M1;
    
    return float(n) * (1.0/float(0xffffffffU));
}

float hash_Tong(uvec2 q)
{
	q *= uvec2(M1, M2);
    uint n = q.x ^ q.y;
    n = n * (n ^ (n >> 15));
    return float(n) * (1.0/float(0xffffffffU));
}

///////////////////Below are some other hash functions I found to compare with///////////////////

float hash_FractSin(vec2 p)
{
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);   
}

float hash_2DWeyl(ivec2 c)
{
  int x = 0x3504f333*c.x*c.x + c.y;
  int y = 0xf1bbcdcb*c.y*c.y + c.x;
    
  return float(x*y)*(2.0/8589934592.0)+0.5;
}

float hash_IQ3( uvec2 x )
{
    uvec2 q = 1103515245U * ( (x>>1U) ^ (x.yx   ) );
    uint  n = 1103515245U * ( (q.x  ) ^ (q.y>>3U) );
    return float(n) * (1.0/float(0xffffffffU));
}

float hash_WithoutSine(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 fp = vec2(fragCoord)+float(iFrame);
    uvec2 up = uvec2(fragCoord)+uint(iFrame);
    ivec2 ip = ivec2(fragCoord)+int(iFrame);
    float c = hash(up);
    
    
    //each loop below runs at 15 frames per second on my machine (760GTX)
    
    //for(uint  i=0U; i<500000U; i++)c = hash(up+i);
    
    //for(float i=0.0;i<350000.0;i++)c = hash_FractSin(fp+i);

    //for(uint  i=0U; i<250000U; i++)c = hash_Tong(up+i);
    
    //for(int   i=0;  i<150000;  i++)c = hash_2DWeyl(ip+i);

    //for(uint  i=0U; i<125000U; i++)c = hash_IQ3(up+i);

    //for(float i=0.0;i<100000.0;i++)c = hash_WithoutSine(fp+i);
    
    
    
    fragColor = vec4(vec3(c),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdcfDj';
  }
  name(): string {
    return 'Simplest Fastest 2D Hash';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 396;
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
}
