import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
//#define A(U) texture(iChannel0,(U)/R)
#define A(U) texelFetch(iChannel0, ivec2(mod(U,R)), 0)
#define R iResolution.xy
#define Main void mainImage(out vec4 Q, vec2 U)
#define BITS 32.
#define MAXUINT  (0u -1u)  // 2^32-1


// pixel is a 128 bit mask (0-31 -> x, 32-63 -> y, 64-95 -> z, 96-127 -> w)
uint getBit(inout uvec4 bm, uint i)
{
    uint bv = i/uint(BITS),  bi= i%uint(BITS);
       
    return  (bm[bv]  &  (1u<<bi) )>0u?1u:0u;
}

//works only if n<=32u 
uint getBits(inout uvec4 bm, uint k, uint n){
   
    
    uint bv = k/uint(BITS),  bi= k%uint(BITS);
    if(n+bi<=32u){
        //inside vec4 dimension
        uint m = (1u<<n)-1u; 
        return (bm[bv] & (m<<bi) )>>bi;
    }
    else
    {
        //cross dimension
        uint n1= 32u-bi, n2 = bi+n-32u;
        uint m1 =(1u<<n1)-1u, m2= (1u<<n2)-1u;
        return ((bm[bv] & (m1<<bi) )>>bi) 
             + ((bm[bv+1u] & m2 )<<n1);
    }
}

// set bit value in a 128 bit mask 
void setBit(inout uvec4 bm, uint i, uint val){
    uint bv = i/uint(BITS),  bi= i%uint(BITS);
    bm[bv]  &= ( MAXUINT - (1u<<bi) );
    if(val>0u)  bm[bv]  +=(1u<<bi);
}

void setBits(inout uvec4 bm, uint i, uint n, uint val){
    val =clamp( val, 0u, (1u<<n)-1u) ;
    uint bv = i/uint(BITS),  bi= i%uint(BITS);
    if(n+bi<=32u){
        //inside vec4 dimension
        bm[bv]  &= ( MAXUINT - (((1u<<n)-1u ) <<bi) );
        bm[bv]  +=(val<<bi);
    }
    else
    {
        //cross dimension
        for(uint j=0u; j<n;j++) 
        {
            uint b = (val  &  (1u<<j) )>0u?1u:0u;
            setBit(bm, i+j, b);
        }
    }
}
`;

const fragment = `

Main 
{
    
    vec4 col = A(U);
    uvec2 i = uvec2( floor(U/R*BITS*4.));
    
    uvec4 iv =  floatBitsToUint(col);              
     
    float on = getBit(iv, i.y )>0u ?1.:0.;
    

    
    // Output to screen
    Q = vec4(on);
    if( fract(U.y/R.y*4.)<.01) Q=vec4(1,0,0,0);

    Q.a = 1.;
}
`;

const buffA = `
Main 
{

 if(iFrame==0)  Q = uintBitsToFloat(uvec4(0u));
 
 else{

    vec4 col = A(U);
    uvec4 iv =  floatBitsToUint(col);
     
     uint a1= (getBits(iv,32u,16u)+uint(U.x))%0xFFFFFFFFu;     
     uint a2= (getBits(iv,48u,15u)+uint(U.x))%0xFFFFFFFFu;
     setBits(iv, 32u,16u,a1);    
     setBits(iv, 48u,15u,a2);
     
     uint a3= (getBits(iv,0u,16u)-uint(U.x))%0xFFFFFFFFu;     
     uint a4= (getBits(iv,16u,15u)-uint(U.x))%0xFFFFFFFFu;
     setBits(iv, 0u,16u,a3);    
     setBits(iv, 16u,15u,a4);
     
     setBits(iv, 64u,31u,getBits(iv,64u,31u) +uint(U.x));
     setBits(iv, 96u,31u,getBits(iv,96u,31u) -uint(U.x));
     
     //known bug from: 4lBfRm
     // Whatever 7 desired exponent bits are, we can avoid inf, NaN, subnormal by choosing 8th appropriately.
     //If all 7 are 0's pick 8th bit to be 1 (avoids subnormal).
     //If all 7 are 1's, pick 8th bit to be 0 (avoids inf/NaN). 
     setBit(iv,120u,getBits(iv,121u,7u)==0u?1u:0u);
     setBit(iv,88u,getBits(iv,89u,7u)==0u?1u:0u);
     setBit(iv,56u,getBits(iv,57u,7u)==0u?1u:0u);
     setBit(iv,24u,getBits(iv,25u,7u)==0u?1u:0u);
     
    Q= uintBitsToFloat(iv) ;
   
   

 }
}
`;

export default class implements iSub {
  key(): string {
    return 'tsGBWy';
  }
  name(): string {
    return 'floatBitsToUint test';
  }
  // sort() {
  //   return 0;
  // }
  common() {
    return common;
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
    return [{ type: 1, f: buffA, fi: 0 }];
  }
}
