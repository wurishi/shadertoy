import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/*
	Here is the top 10:

	#1  "Mystery Mountains" by Dave_Hoskins (llsGW7)
	#2  "old skool 3d driving" by mattz (XtlGW4)
	#3  "Supernova" by guil (MtfGWN)
	#4  "Venus" by Trisomie21 (llsGWM)
	#5  "Hall of Kings" by Trisomie21 (4tfGRB)
	#6  "Flying" by iq (4ts3DH)
	#7  "2 Tweets Challenge" by nimitz (4tl3W8)
	#8  "Night Forest" by fizzer (4lfGDM)
	#9  "Cave" by iq (ltlGDN)
	#10 "Minecraft" by reinder (4tsGD7)
*/

void mainImage( out vec4 f, vec2 w ){
    vec4 p = vec4(w,0.,1.)/iResolution.xyxx*6.-3.,z = p-p, c, d=z;
	float t = iTime;
    p.x -= t*.4;
    for(float i=0.;i<8.;i+=.3)
        c = texture(iChannel0, p.xy*.0029)*11.,
        d.x = cos(c.x+t), d.y = sin(c.y+t),
        z += (2.-abs(p.y))*vec4(.1*i, .3, .2, 9),
        //z += (2.-abs(p.y))*vec4(.2,.4,.1*i,1), // Alt palette
        z *= dot(d,d-d+.03)+.98,
        p -= d*.022;
    
	f = z/25.;
  f.a = 1.;
}

`;

export default class implements iSub {
  key(): string {
    return 'Mtf3Rj';
  }
  name(): string {
    return '[2TC 15]Results';
  }
  sort() {
    return 328;
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
    return [{ ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
