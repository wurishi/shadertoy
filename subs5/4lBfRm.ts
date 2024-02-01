import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
const ivec2 dims = ivec2(16, 7);
const uvec2 magic = uvec2(0x7fc00000u, 0xff800000u);
int cur, idx;
vec4 data;

void store(in uvec4 v) {
    if (cur++ == idx) {
         data = uintBitsToFloat(v);
    }    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	
    ivec2 fc = ivec2(fragCoord);

    vec4 rescheck = texelFetch(iChannel0, dims, 0);
    uvec4 res = uvec4(floatBitsToUint(iResolution.xy), magic);
        
    if (floatBitsToUint(rescheck) == res) {
        fragColor = texelFetch(iChannel0, fc, 0);
        return;
    }

    if (fc == dims) {
        fragColor = uintBitsToFloat(res);
        return;
    } else if (any(greaterThanEqual(fc, dims))) { 
        return; 
    }
    
    idx = fc.x + (fc.y << 4);
    cur = 0;
    data = vec4(0);

    store(uvec4(0xffffffffu, 0xffffffffu, 0xffffffffu, 0xffffffffu));
    store(uvec4(0xffffffffu, 0x5bffffffu, 0xea7fa5ffu, 0xff9ffe9fu));
    store(uvec4(0xffffffffu, 0xe555ffffu, 0xabff5aaau, 0xffffbfffu));
    store(uvec4(0xffffffffu, 0xffffffffu, 0xfffdffffu, 0xfff6fff6u));
    store(uvec4(0x56ffffffu, 0xff9fa96fu, 0x96ffe96fu, 0xbfff6fffu));
    store(uvec4(0xfff9fff6u, 0xfffffffeu, 0xffffffffu, 0xfff5fffeu));
    store(uvec4(0x5bffbfffu, 0xbfffbfffu, 0xbfffffffu, 0xafffbfffu));
    store(uvec4(0xfff9fffdu, 0xfff6fff5u, 0xfff6fff6u, 0xfff9fff6u));
    store(uvec4(0x97ff6fffu, 0xfa7fa9ffu, 0xfe9ffe6fu, 0xff9fff9fu));
    store(uvec4(0xfffafff5u, 0xffffffffu, 0xffffffffu, 0xffffffffu));
    store(uvec4(0xd6aff95fu, 0x6fff6affu, 0xbfffbfffu, 0xbfffbfffu));
    store(uvec4(0xffffffffu, 0xfffeffffu, 0xfffdfffdu, 0xfffdfffdu));
    store(uvec4(0xaa6ffe9fu, 0x56ffa5bfu, 0xffff6fffu, 0xffffffffu));
    store(uvec4(0xffaaffefu, 0xeaa5feaau, 0xa96faa55u, 0x5bff55bfu));
    store(uvec4(0xffffffffu, 0xabffbfffu, 0x5aaaaaaau, 0xe5555555u));
    store(uvec4(0x6aaaabfbu, 0xd56656aau, 0xfff9fe55u, 0xfffffffeu));
    store(uvec4(0xfffdfffdu, 0xffffffffu, 0xffffffffu, 0xffffffffu));
    store(uvec4(0xefbfaaffu, 0xffefffefu, 0xafdfbfefu, 0x55bf6a6fu));
    store(uvec4(0xfbefaaaau, 0xffffffffu, 0xeafefbffu, 0x5555a6aau));
    store(uvec4(0xfffeffffu, 0xfffbfffbu, 0xfff6fffbu, 0xfffefff9u));
    store(uvec4(0xffffffffu, 0x83ff3fffu, 0xaa3fa8ffu, 596617279u));
    store(uvec4(0xffffffffu, 0xf0aaff00u, 44747434u, 0xfe2fb8a0u));
    store(uvec4(0x56ffffffu, 0xff9fa96fu, 0x96ffe96fu, 0xbffc6ffcu));
    store(uvec4(0xef8f238fu, 0x8a3faa8fu, 0xa0ffaa3fu, 0x3fff03ffu));
    store(uvec4(0xfcafff2fu, 0xccaaf0aau, 44708522u, 0x3e2ebc00u));
    store(uvec4(0xfff3fff2u, 0xfff2fff3u, 0xfffcfffcu, 0xfffffffcu));
    store(uvec4(0xffffc0c0u, 0xe555ffffu, 0xabff5aaau, 0xffffbfffu));
    store(uvec4(0xe6ff6fffu, 0xbf7ffdbfu, 0x9bdf5fafu, 0xe6dfe7dfu));
    store(uvec4(0x9bfff955u, 0xfe557fffu, 0xe7fff5aau, 0xdfffdbffu));
    store(uvec4(0xffffffffu, 0xfffdfffeu, 0xfff6fffau, 0xfff6fff6u));
    store(uvec4(0xafaffeffu, 0xdaea6b6bu, 0xe69ad99au, 0xa699b666u));
    store(uvec4(0xbffffffeu, 0xdaffebffu, 0xa9b6a6bbu, 0xbe6955a9u));
    store(uvec4(0xfffffffeu, 0xffffffffu, 0xfff6fffbu, 0xfff9fff9u));
    store(uvec4(0xffffffffu, 0xabffbfffu, 0xf2aa0aaau, 0xfc55fc55u));
    store(uvec4(0x6aaaabfbu, 797065258u, 0x3ff3fff8u, 0xfffffffbu));
    store(uvec4(0xfffdfffdu, 0xfffcffffu, 0xffcffff2u, 0xff3cffccu));
    store(uvec4(0xffffffffu, 0xffffffffu, 0xffffffffu, 0xf0fff0ffu));
    store(uvec4(0xe6dfe6dfu, 0xe6dfe6dfu, 0xe6dfe6dfu, 0xe6dfe6dfu));
    store(uvec4(0xdfffdfffu, 0xdfffdfffu, 0xdfffdfffu, 0xdfffdfffu));
    store(uvec4(0xfff6fff6u, 0xfff6fff6u, 0xfff6fff6u, 0xfff6fff6u));
    store(uvec4(0x55550000u, 0xffffaaaau, 0xeeeeffffu, 0xaaaaaaaau));
    store(uvec4(0x55150070u, 0xfa4faa4au, 0xee4efb8fu, 0xaa4aaa4au));
    store(uvec4(0x55550000u, 0xafffaaaau, 0xeeeeefffu, 0xaaaaaaaau));
    store(uvec4(0xbff4fffdu, 0xdaf1ebf1u, 0xa9b1a6b2u, 0xbe6155a1u));
    store(uvec4(0xfcfffcffu, 0xe3fff8ffu, 0xfcfffcffu, 0xfcfffcffu));
    store(uvec4(0xffffffffu, 0xffff2fffu, 0xffffffffu, 0xffffffffu));
    store(uvec4(0xff2fff3fu, 0xfff0ffcbu, 0xfff3fff3u, 0xfff3fff3u));
    store(uvec4(0xffffffffu, 0x3fffffffu, 0x8fff8fffu, 0x8fff8fffu));
    store(uvec4(0xaa0f00dfu, 715172515u, 0xca2aca8au, 0xcaaacaaau));
    store(uvec4(0xdfc2dffcu, 0xdcffdf00u, 0xdccfdccfu, 0xd3ffd3cfu));
    store(uvec4(0x9bf6f956u, 0xfe567ff6u, 0xe7f6f5a6u, 0xdff6dbf6u));
    store(uvec4(0xeaaaaeaau, 0xaaaeaaeau, 0xbaaaabaau, 0xaaabaabau));
    store(uvec4(0xea4aae4au, 0xaa4eaa4au, 0xba4aaa4au, 0xaa4baa4au));
    store(uvec4(0xaaaaaeaau, 0xaaaeaaeau, 0xbaaaabaau, 0xaaabaabau));
    store(uvec4(0x6f61a5d1u, 0xa5515bd1u, 0x6691a691u, 0xaaa169a1u));
    store(uvec4(0x5b996555u, 0xbbf57e69u, 0x7e96dbe5u, 0xaaaa556au));
    store(uvec4(0xbffafffeu, 0xdaf9ebfau, 0xa9b9a6b9u, 0xbe6a55aau));
    store(uvec4(0xf3aff8ffu, 0x8aeae36bu, 0x869a099au, 0xa6993666u));
    store(uvec4(0xffffffffu, 0xffffffffu, 196600u, 0x80002aaau));
    store(uvec4(0xaf83fef3u, 0xda2f6b2cu, 0xe690d90bu, 0xa699b666u));
    store(uvec4(0xbffffffeu, 0xdaffebffu, 0xa9b6a6bbu, 0xbc2955a9u));
    store(uvec4(0x3fff3fffu, 0x3fff3fffu, 0xcfffcfffu, 0x3fffcfffu));
    store(uvec4(715180714u, 0xaaa0aaaau, 0xaa3faa8bu, 0xe6d0000fu));
    store(uvec4(0xd2ffd3ffu, 0xdc2adc00u, 0xd3f2d3cau, 0xdf03dcfcu));
    store(uvec4(0xdff6dff6u, 0xdff6dff6u, 0xdff6dff6u, 0xdff6dff6u));
    store(uvec4(0xbfffffffu, 0xdaffebffu, 0xa9bfa6bfu, 0xbe6f55afu));
    store(uvec4(0x555a000au, 0xfffeaaaau, 0xeeeafffau, 0xaaabaaaau));
    store(uvec4(0x57d4000du, 0xfff1abe1u, 0xeee1fff2u, 0xaaa1aaa1u));
    store(uvec4(0x55550000u, 0xffffaaaau, 0xeeeeffffu, 0xaaa0aaaau));
    store(uvec4(0x6aaaaeaau, 0xb6aedaeau, 0xadaaadaau, 0x6b6bab6au));
    store(uvec4(0xeaa5aea5u, 0xa9a9aae5u, 0x59d9a969u, 0x69ad65b5u));
    store(uvec4(0xeaaaaeaau, 0xaaaeaaeau, 0xbaa9abaau, 0xaaabaabau));
    store(uvec4(0xeaa1aea1u, 0xaaa1aae1u, 0xbaa1aba1u, 0xaaa1aab1u));
    store(uvec4(0xeaafaea0u, 0xaaaeaaefu, 0xbaaaabaau, 0xaaabaabau));
    store(uvec4(0x6aaaaeaau, 0xb6aedaeau, 0xada9adaau, 0x6b6bab6au));
    store(uvec4(0xea4aae4au, 0xaa4eaa4au, 0xba49aa4au, 0xaa4baa4au));
    store(uvec4(0xbe6a55aau, 0xffdeff9au, 0xff99ffdau, 0x55abbe6au));
    store(uvec4(0x5a6969aau, 0x6697a696u, 0x9a6665a7u, 0x6fead559u));
    store(uvec4(0x6aa6aea9u, 0xb6aedaedu, 0xadabadafu, 0x6b66ab66u));
    store(uvec4(0x6aa4aeadu, 0xb6a1dae1u, 0xada1ada2u, 0x6b61ab61u));
    store(uvec4(0xbe6655a9u, 0xffdeff9du, 0xff9bffdfu, 0x55a6be66u));
    store(uvec4(0xea46ae49u, 0xaa4eaa4du, 0xba4baa4fu, 0xaa46aa46u));
    store(uvec4(0xbe6a55aau, 0xffdeff9au, 0xff9affdau, 0x55abbe6au));
    store(uvec4(0xb5565ad9u, 0xb69eb69du, 0xadabadafu, 0xab66ab66u));
    store(uvec4(0xfaf9bf56u, 0x7ff6dff9u, 0xbe767fd6u, 0xa96d556du));
    store(uvec4(0xbe6955a9u, 0xffd6ff96u, 0xff95ffd6u, 0x55a9be69u));
    store(uvec4(0xbe6155a1u, 0xffd1ff91u, 0xff91ffd1u, 0x55a1be61u));
    store(uvec4(0xb5595ad9u, 0xb696b696u, 0xada5ada6u, 0xab69ab69u));
    store(uvec4(0xff03ffffu, 0xcfc33cf0u, 0xcc3ccf0fu, 0xffff3f03u));
    store(uvec4(0xffffffffu, 0xff30ffcu, 0xff3ffffu, 0xffff0ffcu));
    store(uvec4(0xf0ffffffu, 0xf0fff03fu, 0xf0fff0ffu, 0xc03ff0ffu));
    store(uvec4(0xc00fffffu, 0xfff0fc3u, 0xfc3fc0ffu, 261903u));
    store(uvec4(0xc00fffffu, 0xfc30fc3u, 0xfc30fc3u, 0xc00f0fc3u));
    store(uvec4(0xf0f0ffffu, 0xff003c30u, 0xfc30ff00u, 0xffff30f0u));
    store(uvec4(0xffffffffu, 0xcf3cf030u, 0xf33cf03cu, 0xffffcf30u));
    store(uvec4(0xffffffffu, 859583424u, 0xcf3ccfc0u, 0xffffcfc0u));
    store(uvec4(0xf003ffffu, 0xcabccabcu, 0xcaa8caa8u, 0xfffff003u));
    store(uvec4(0xcff3f00fu, 0x3ccc3ffcu, 0xcffc3cccu, 9202u));
    store(uvec4(0xcff3ffffu, 0xfc3ff3cfu, 0xf3cffc3fu, 0xffffcff3u));
    store(uvec4(0xc0ffffffu, 0xc30fc03fu, 246723u, 0xc3ffc3ffu));

    fragColor = data;
    fragColor.a = 1.;
}

`;

const buffB = `
const ivec2 dims = ivec2(16, 2);
const uvec2 magic = uvec2(0x7fc00000u, 0xff800000u);
int cur, idx;
vec4 data;

void store(in uvec4 v) {
    if (cur++ == idx) {
         data = uintBitsToFloat(v);
    }    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
	
    ivec2 fc = ivec2(fragCoord);

    vec4 rescheck = texelFetch(iChannel0, dims, 0);
    uvec4 res = uvec4(floatBitsToUint(iResolution.xy), magic);
        
    if (floatBitsToUint(rescheck) == res) {
        fragColor = texelFetch(iChannel0, fc, 0);
        return;
    }

    if (fc == dims) {
        fragColor = uintBitsToFloat(res);
        return;
    } else if (any(greaterThanEqual(fc, dims))) { 
        return; 
    }
    
    idx = fc.x + (fc.y << 4);
    cur = 0;
    data = vec4(0);

    store(uvec4(16777216u, 770u, 328704u, 460288u));
    store(uvec4(50462976u, 0x9080000u, 723456u, 0xd0c0000u));
    store(uvec4(1052430u, 0xa000908u, 328704u, 460288u));
    store(uvec4(319951104u, 370480128u, 0x6000005u, 0xd0c0000u));
    store(uvec4(1052430u, 0, 421009152u, 0xf0e0d0cu));
    store(uvec4(50462976u, 319951104u, 0, 52035840u));
    store(uvec4(0, 0xa000908u, 11u, 0));
    store(uvec4(0xa000908u, 11u, 0x6000005u, 16777223u));
    store(uvec4(67109634u, 0x6000005u, 7u, 0xf0e0d0cu));
    store(uvec4(0x9080010u, 723456u, 0xf0e0d0cu, 16u));
    store(uvec4(0, 328704u, 460288u, 452984832u));
    store(uvec4(67116316u, 522067742u, 0xd0c201eu, 2302497u));
    store(uvec4(620766208u, 10022u, 673720616u, 538848042u));
    store(uvec4(3026220u, 808386560u, 1913393u, 858993715u));
    store(uvec4(943142453u, 0x3c3b3a39u, 0x3e3d201eu, 0x4127403fu));
    store(uvec4(858993715u, 673727027u, 0x432a2828u, 673727528u));
    store(uvec4(673720360u, 858993715u, 0x47464533u, 0x48353333u));
    store(uvec4(0x45334933u, 0x4a464a46u, 0x45334b46u, 0x4e4d4c46u));
    store(uvec4(0x42334746u, 0x4c464f2au, 0x504d504du, 0x5233514du));
    store(uvec4(0x5554534du, 0x47464e4du, 0x534d5635u, 0x57545754u));
    store(uvec4(0x58000000u, 89u, 0x5c5c5b5au, 0));
    store(uvec4(0, 0x5e5d0000u, 0x6060005fu, 0x60606060u));
    store(uvec4(0x62610000u, 25436u, 0, 0));

    fragColor = data;
    fragColor.a = 1.;
}
`;

const fragment = `
int tile_fetch(int tile_idx, ivec2 tc) {
    
  ivec2 fc = ivec2(tile_idx & 0xf, tile_idx >> 4);
  
  int idx = tc.x + tc.y*8; 
      
  vec4 v = texelFetch(iChannel0, fc, 0);

float s = v[idx >> 4];
  idx &= 0xf;
  
  uint x = floatBitsToUint(s);
  uint b = (x >> (idx<<1)) & 0x3u;
  
  return int(b);
     
}

int index_fetch(int tile_idx) {
  
  int texel_idx = tile_idx >> 4;
  int idx = tile_idx & 0xf; 
  
  ivec2 texel_pos = ivec2(texel_idx & 0xf, texel_idx >> 4);
  
  vec4 v = texelFetch(iChannel1, texel_pos, 0);
  
  float s = v[idx >> 2]; 
  idx &= 0x3; 
  
  uint x = floatBitsToUint(s);
  uint b = (x >> (idx<<3)) & 0xffu;
  
  return int(b);
  
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {

  fragCoord -= 0.5*iResolution.xy;
  fragCoord.y *= -1.0;
  
float zoom = max(floor(iResolution.y / 144.), 1.);
  fragCoord /= zoom;
  
  ivec2 fc = ivec2(floor(fragCoord));
  fc += ivec2(80, 72);
  
  ivec2 tc = fc & ivec2(7, 7);
  fc = fc >> ivec2(3, 3); 
  
  int brt;
  
  if (fc.x < 0 || fc.y < 0 || fc.x >= 20 || fc.y >= 18) {
      
      brt = 1;
      
  } else {
      
      int flat_idx = fc.x + fc.y * 20;
      int tile_idx = index_fetch(flat_idx);
      brt = tile_fetch(tile_idx, tc);
      
  }

  ivec3 c = (brt == 0 ? ivec3(15,56,15) :
             brt == 1 ? ivec3(48,98,48) : 
             brt == 2 ? ivec3(139,172,16) :
             ivec3(165, 198,15));
  
  fragColor = vec4(vec3(c)/255., 1); 

}
`;

export default class implements iSub {
  key(): string {
    return '4lBfRm';
  }
  name(): string {
    return '128 bits per texel storage';
  }
  // sort() {
  //   return 0;
  // }
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
      { type: 1, f: buffA, fi: 0 },
      { type: 1, f: buffB, fi: 1 },
    ];
  }
}
