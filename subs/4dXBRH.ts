import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform int u_noised_type;

float hash( in vec2 p )
{
    p  = 50.0*fract( p*0.3183099 + vec2(0.71,0.113));
    return -1.0+2.0*fract( p.x*p.y*(p.x+p.y) );
}

vec3 noised( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
    vec2 u, du;
    if(u_noised_type == 1) {
      // quintic interpolation
      u = f*f*f*(f*(f*6.0-15.0)+10.0);
      du = 30.0*f*f*(f*(f-2.0)+1.0);
    }
    else {
      // cubic interpolation
      u = f*f*(3.0-2.0*f);
      du = 6.0*f*(1.0-f);
    }
    
    float va = hash( i + vec2(0.0,0.0) );
    float vb = hash( i + vec2(1.0,0.0) );
    float vc = hash( i + vec2(0.0,1.0) );
    float vd = hash( i + vec2(1.0,1.0) );
    
    float k0 = va;
    float k1 = vb - va;
    float k2 = vc - va;
    float k4 = va - vb - vc + vd;

    return vec3( va+(vb-va)*u.x+(vc-va)*u.y+(va-vb-vc+vd)*u.x*u.y, // value
                 du*(u.yx*(va-vb-vc+vd) + vec2(vb,vc) - va) );     // derivative                
}

// -----------------------------------------------

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
    
    vec3 n = noised( 8.0*p );

    vec3 col = 0.5 + 0.5*((p.x>0.0)?n.yzx : n.xxx);

	fragColor = vec4( col, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_noised_type: 1,
};

export default class implements iSub {
  key(): string {
    return '4dXBRH';
  }
  name(): string {
    return 'Noise - Value - 2D - Deriv';
  }
  sort() {
    return 81;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_noised_type', { cubic: 0, quintic: 1 });
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
    const u_noised_type = webglUtils.getUniformLocation(
      gl,
      program,
      'u_noised_type'
    );
    return () => {
      u_noised_type.uniform1i(api.u_noised_type);
    };
  }
}
