import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define M1 1597334677U     //1719413*929
#define M2 3812015801U     //140473*2467*11
#define M3 3299493293U     //467549*7057

#define F0 (1.0/float(0xffffffffU))

#define hash(n) n*(n^(n>>15))

#define coord1(p) (p*M1)
#define coord2(p) (p.x*M1^p.y*M2)
#define coord3(p) (p.x*M1^p.y*M2^p.z*M3)

float hash1(uint n){return float(hash(n))*F0;}
vec2 hash2(uint n){return vec2(hash(n)*uvec2(0x1U,0x3fffU))*F0;}
vec3 hash3(uint n){return vec3(hash(n)*uvec3(0x1U,0x1ffU,0x3ffffU))*F0;}
vec4 hash4(uint n){return vec4(hash(n)*uvec4(0x1U,0x7fU,0x3fffU,0x1fffffU))*F0;}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    uvec2 p = uvec2(ivec2(fragCoord)+2*iFrame);
	int cx = int(fragCoord.x) - (int(iResolution.x)>>1);
    int cy = int(fragCoord.y) - (int(iResolution.y)>>1);
    
    float h1 = hash1(coord2(p));
    vec2 h2 = hash2(coord2(p));
    vec3 h3 = hash3(coord2(p));
    vec4 h4 = hash4(coord2(p));
    
    vec3 col;
   	if(cx < 0 && cy < 0)col = vec3(h1);
    if(cx > 0 && cy < 0)col = vec3(h2.x * h2.y);
   	if(cx < 0 && cy > 0)col = vec3(h3);
    if(cx > 0 && cy > 0)col = vec3(h4.xyz * h4.w);
       
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '4dVBzz';
  }
  name(): string {
    return 'Toolbox of Noisey Goodness';
  }
  sort() {
    return 397;
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
}
