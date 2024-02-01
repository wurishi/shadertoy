import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float iBilinearPatch(in vec3 ro, in vec3 rd, in vec4 ps, in vec4 ph)
{
    vec3 va = vec3(0.0, 0.0, ph.x + ph.w - ph.y - ph.z);
    vec3 vb = vec3(0.0, ps.w - ps.y, ph.z - ph.x);
    vec3 vc = vec3(ps.z - ps.x, 0.0, ph.y - ph.x);
    vec3 vd = vec3(ps.xy, ph.x);

    float tmp = 1.0 / (vb.y * vc.x);
    float a = 0.0;
    float b = 0.0;
    float c = 0.0;
    float d = va.z * tmp;
    float e = 0.0;
    float f = 0.0;
    float g = (vc.z * vb.y - vd.y * va.z) * tmp;
    float h = (vb.z * vc.x - va.z * vd.x) * tmp;
    float i = -1.0;
    float j = (vd.x * vd.y * va.z + vd.z * vb.y * vc.x) * tmp
            - (vd.y * vb.z * vc.x + vd.x * vc.z * vb.y) * tmp;

    float p = dot(vec3(a, b, c), rd.xzy * rd.xzy)
            + dot(vec3(d, e, f), rd.xzy * rd.zyx);
    float q = dot(vec3(2.0, 2.0, 2.0) * ro.xzy * rd.xyz, vec3(a, b, c))
            + dot(ro.xzz * rd.zxy, vec3(d, d, e))
            + dot(ro.yyx * rd.zxy, vec3(e, f, f))
            + dot(vec3(g, h, i), rd.xzy);
    float r = dot(vec3(a, b, c), ro.xzy * ro.xzy)
            + dot(vec3(d, e, f), ro.xzy * ro.zyx)
            + dot(vec3(g, h, i), ro.xzy) + j;
    if (abs(p) < 0.000001) {
      return -r / q;
    } else {
      float sq = q * q - 4.0 * p * r;
      if (sq < 0.0) {
        return 0.0;
      } else {
        float s = sqrt(sq);
        float t0 = (-q + s) / (2.0 * p);
        float t1 = (-q - s) / (2.0 * p);
        return min(t0 < 0.0 ? t1 : t0, t1 < 0.0 ? t0 : t1);
      }
    }
}

vec3 nBilinearPatch(in vec4 ps, in vec4 ph, in vec3 pos)
{
    vec3 va = vec3(0.0, 0.0, ph.x + ph.w - ph.y - ph.z);
    vec3 vb = vec3(0.0, ps.w - ps.y, ph.z - ph.x);
    vec3 vc = vec3(ps.z - ps.x, 0.0, ph.y - ph.x);
    vec3 vd = vec3(ps.xy, ph.x);

    float tmp = 1.0 / (vb.y * vc.x);
    float a = 0.0;
    float b = 0.0;
    float c = 0.0;
    float d = va.z * tmp;
    float e = 0.0;
    float f = 0.0;
    float g = (vc.z * vb.y - vd.y * va.z) * tmp;
    float h = (vb.z * vc.x - va.z * vd.x) * tmp;
    float i = -1.0;
    float j = (vd.x * vd.y * va.z + vd.z * vb.y * vc.x) * tmp
            - (vd.y * vb.z * vc.x + vd.x * vc.z * vb.y) * tmp;

    vec3 grad = vec3(2.0) * pos.xzy * vec3(a, b, c)
      + pos.zxz * vec3(d, d, e)
      + pos.yyx * vec3(f, e, f)
      + vec3(g, h, i);
    return -normalize(grad);
}

#define AA 2

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // camera movement	
	float an = 0.5*iTime;
	vec3 ro = vec3( 1.5*cos(an), 2.0, 1.5*sin(an) );
    vec3 ta = vec3( 0.0, 0.0, 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    
    vec3 tot = vec3(0.0);
    
    #if AA>1
    for( int m=0; m<AA; m++ )
    for( int n=0; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
        #else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
        #endif

	    // create view ray
	    vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );

        // raytrace
	
	    // raytrace-plane
	    vec4 ps = vec4( -1.0,-1.0,1.0,1.0 );
	    vec4 ph = vec4( -1.0,1.0,1.0,-1.0 );
	    float t = iBilinearPatch( ro, rd, ps, ph );

        // shading/lighting	
	    vec3 col = vec3(0.0);
	    if( t>0.0 )
	    {
            vec3 pos = ro + t*rd;
    		if (all(lessThanEqual(abs(pos), vec3(1.00001))))
            {
                vec3 nor = nBilinearPatch( ps, ph, pos );
                float dif = clamp( dot(nor,vec3(0.57703)), 0.0, 1.0 );
                float amb = clamp( 0.5 + 0.5*dot(nor,vec3(0.0,1.0,0.0)), 0.0, 1.0 );
                col = vec3(0.2,0.3,0.4)*amb + vec3(1.0,0.9,0.7)*dif;
                col *= 0.8;
            }
	    }
	
        col = sqrt( col );

	    tot += col;
    #if AA>1
    }
    tot /= float(AA*AA);
    #endif

	fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'ltKBzG';
  }
  name(): string {
    return 'Bilinear Patch - intersection';
  }
  sort() {
    return 104;
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
