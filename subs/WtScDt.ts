import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Box-filtering of cos(x):
//
// (1/w)∫cos(t)dt with t ∈ (x-½w, x+½w)
// = [sin(x+½w) - sin(x-½w)]/w
// = cos(x)·sin(½w)/(½w)
//

uniform bool u_fcos;

// box-filted cos(x)
vec3 fcos( in vec3 x )
{
    vec3 w = fwidth(x);
    if(u_fcos) {
      return cos(x) * sin(0.5*w)/(0.5*w);       // exact
    }
    else {
      return cos(x) * smoothstep(6.2832,0.0,w); // approx
    }
}

// pick raw cosine, or band-limited cosine
bool  mode = false;
vec3  mcos( vec3 x){return mode?cos(x):fcos(x);}

// color palette, made of 8 cos functions
// (see https://iquilezles.org/www/articles/palettes/palettes.htm)
vec3 getColor( in float t )
{
    vec3 col = vec3(0.6,0.5,0.4);
    col += 0.14*mcos(6.2832*t*  1.0+vec3(0.0,0.5,0.6));
    col += 0.13*mcos(6.2832*t*  3.1+vec3(0.5,0.6,1.0));
    col += 0.12*mcos(6.2832*t*  5.1+vec3(0.1,0.7,1.1));
    col += 0.11*mcos(6.2832*t*  9.1+vec3(0.1,0.5,1.2));
    col += 0.10*mcos(6.2832*t* 17.1+vec3(0.0,0.3,0.9));
    col += 0.09*mcos(6.2832*t* 31.1+vec3(0.1,0.5,1.3));
    col += 0.08*mcos(6.2832*t* 65.1+vec3(0.1,0.5,1.3));
    col += 0.07*mcos(6.2832*t*131.1+vec3(0.3,0.2,0.8));
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord )
{
    // coordiantes
	vec2 q = (2.0*fragCoord-iResolution.xy)/iResolution.y;

    // separation
    float th = (iMouse.z>0.001) ? (2.0*iMouse.x-iResolution.x)/iResolution.y : 1.8*sin(iTime);
    mode = (q.x<th);
    
    // deformation
    vec2 p = 2.0*q/dot(q,q);

    // animation
    p.xy += 0.05*iTime;

    // texture
    vec3 col = min(getColor(p.x),getColor(p.y));

    // vignetting
    col *= 1.5 - 0.2*length(q);
    
    // separation
    col *= smoothstep(0.005,0.010,abs(q.x-th));
    
    // palette
    if( q.y<-0.9 ) col = getColor( fragCoord.x/iResolution.x );

    fragColor = vec4( col, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_fcos: false,
};

export default class implements iSub {
  key(): string {
    return 'WtScDt';
  }
  name(): string {
    return 'Bandlimited Synthesis 1';
  }
  sort() {
    return 45; 
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_fcos');
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
    const u_fcos = webglUtils.getUniformLocation(gl, program, 'u_fcos');
    return () => {
      u_fcos.uniform1i(api.u_fcos ? 1 : 0);
    };
  }
}
