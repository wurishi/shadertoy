import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_layer;

const float N = 2.0; // grid ratio
float gridTexture( in vec2 p )
{
    // coordinates
    vec2 i = step( fract(p), vec2(1.0/N) );
    //pattern
    //return (1.0-i.x)*(1.0-i.y);   // grid (N=10)
    
    // other possible patterns are these
    //return 1.0-i.x*i.y;           // squares (N=4)
    return 1.0-i.x-i.y+2.0*i.x*i.y; // checker (N=2)
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // default "beautypass"
    vec3 col = 0.2 * vec3(1., 1., 1.) * gridTexture(fragCoord.xy/iResolution.xx * vec2(5., 5.)) + 0.6;

    // display render layers by using global flag
    if(u_layer) {
      vec2 visuv = fragCoord.xy / iResolution.yy + fragCoord.y/iResolution.y;
      float sliceCount = 6.;
      float sliceWidth = 2.;
      
      float lineWidth = 0.05;
      float speed = 0.2;
      
      float slice = floor(mod(visuv.x * sliceWidth - iTime * speed, sliceCount)) / sliceCount;
      float line = 1.-(smoothstep(0., lineWidth, mod((visuv.x - iTime * speed * (1./sliceWidth)) * sliceWidth * sliceCount, sliceCount)) * smoothstep(0., lineWidth, mod((-visuv.x + iTime * speed * (1./sliceWidth)) * sliceWidth * sliceCount, sliceCount)));
      
      float sliceStep = 1. / sliceCount;

      // just increase this with number of slices
      if(slice >= sliceStep && slice <= sliceStep*2.) col = vec3(1.,0.,0.);
      if(slice >= sliceStep*2. && slice <= sliceStep*3.) col = vec3(0.,1.,0.);
      if(slice >= sliceStep*3. && slice <= sliceStep*4.) col = vec3(0.,0.,1.);
      if(slice >= sliceStep*4. && slice <= sliceStep*5.) col = vec3(1.,0.,1.);
      if(slice >= sliceStep*5. && slice <= sliceStep*6.) col = vec3(1.,1.,0.);
      
      col = mix(col, vec3(0.,0.,0.), line);
    }
    fragColor = vec4(col, 1.);
}
`;

let gui: GUI;
const api = {
  layer: true,
};

export default class implements iSub {
  key(): string {
    return 'NdX3RH';
  }
  name(): string {
    return 'Layer Slice display';
  }
  sort() {
    return 27;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'layer');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_layer = webglUtils.getUniformLocation(gl, program, 'u_layer');

    return () => {
      u_layer.uniform1i(api.layer ? 1 : 0);
    };
  }
}
