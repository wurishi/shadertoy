import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
void mainImage( out vec4 f, in vec2 w )
{
   vec4 o=vec4(.2,.2,.2,1);

   for(float i=8.;i>0.;--i)
   {
   	   vec2 p=w/iResolution.xy*i;
       p.x+=iDate.w*.3;
       
       p=cos(p.x+vec2(0,1.6))*sqrt(p.y+1.+cos(p.x*.8+i*9.))*.71;
       
       for(int j=0;j<20;++j)
          p=reflect(p,p.yx)+p*.14;
       
   		o=f=dot(p,p)<3.?texture(iChannel0,p*2e-2)/i:o;
   }
}
`;

export default class implements iSub {
  key(): string {
    return '4lfGDM';
  }
  name(): string {
    return '[2TC 15] Night Forest';
  }
  sort() {
    return 386;
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
    return [webglUtils.WOOD_TEXTURE];
  }
}
