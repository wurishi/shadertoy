import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float atan2(float y, float x)
{
    if(x>0.)
        return atan(y / x);
    else if (y>=0. && x<0.)
        return 3.1416 + atan(y / x);
    else if (y<0. && x<0.)
        return -3.1416 + atan(y / x);
    else if (y>0. && x==0.)
        return 3.1416 / 2.;
    else if (y<0. && x==0.)
        return -3.1416 / 2.;
    else   
        return 0.;    
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xx - vec2(0.5, 0.3);
    float r = length(uv);
    
    float ang = atan2(-uv.y, uv.x);
    float td = 1./ 4. * (3. * cos(2. * (ang + iTime)) + 1.);
    if(td < 0.) td = 0.;
    
    vec3 col;
    
    if(r < 0.2)
        col =vec3(mix(1.,0.25,  r / 0.2*r / 0.2), mix(0.3,0.2,  r / 0.2*r / 0.2), 0.0);
    else if(r < 0.2 + td*0.01)
        col = vec3(0., 0.2, 0.6);
        
        
    if(length(uv - vec2(0.4 * cos(iTime),  0.4 * sin(iTime))) < 0.05)
    {
        col = vec3(0.8, 0.7, 0.0);
    }
    // Output to screen
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'NdXGRr';
  }
  name(): string {
    return 'Tidal';
  }
  sort() {
    return 30;
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
