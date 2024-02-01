import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
#define PI 3.14159265358979323846264338327950288419716939937510582
#define TAU (2.*PI)

//#define iDate (iDate*5000.)

const float[10] seg0 = float[](1., 0., 1., 1., 0., 1., 1., 1., 1., 1.);
const float[10] seg1 = float[](1., 0., 0., 0., 1., 1., 1., 0., 1., 1.);
const float[10] seg2 = float[](1., 1., 1., 1., 1., 0., 0., 1., 1., 1.);
const float[10] seg3 = float[](0., 0., 1., 1., 1., 1., 1., 0., 1., 1.);
const float[10] seg4 = float[](1., 0., 1., 0., 0., 0., 1., 0., 1., 0.);
const float[10] seg5 = float[](1., 1., 0., 1., 1., 1., 1., 1., 1., 1.);
const float[10] seg6 = float[](1., 0., 1., 1., 0., 1., 1., 0., 1., 1.);

float SDF_lineseg (vec2 p, vec2 a, vec2 b) {
    float t = clamp(dot(p-a, b-a)/dot(b-a, b-a), 0., 1.);
    return length(p-a-(b-a)*t)-.1;
}

#define SDF_plane(p, c, n) ( dot(normalize(p-c), n)*length(p-c) )

float DE_seg (vec2 p, vec2 a, float rot) {
    p -= a;
    p.xy = p.xy*(1.-rot)+p.yx*rot;
    //return SDF_lineseg(p, vec2(0.), vec2(1., 0.));
    #define segw .12
    #define segt -.02
    float SDFp = -1e9;
    SDFp = max( SDFp, (    SDF_plane(p, vec2(0.), normalize(vec2(-1., -1.)) )       - segt ));
    SDFp = max( SDFp, (    SDF_plane(p, vec2(0.), normalize(vec2(-1., 1.)) )        - segt ));
    SDFp = max( SDFp, (    SDF_plane(p, vec2(0., -segw), normalize(vec2(0., -1.)) ) - segt ));
    SDFp = max( SDFp, (    SDF_plane(p, vec2(0., segw), normalize(vec2(0., 1.)) )   - segt ));
    SDFp = max( SDFp, (    SDF_plane(p, vec2(1., 0.), normalize(vec2(1., -1.)) )    - segt ));
    SDFp = max( SDFp, (    SDF_plane(p, vec2(1., 0.), normalize(vec2(1., 1.)) )     - segt ));
    return SDFp;
}

float DE_7seg (vec2 p, float id) {
    float SDFp = 1e9;
    //
    #if 0
    float[10] seg0 = float[](1., 0., 1., 1., 0., 1., 1., 1., 1., 1.);
    float[10] seg1 = float[](1., 0., 0., 0., 1., 1., 1., 0., 1., 1.);
    float[10] seg2 = float[](1., 1., 1., 1., 1., 0., 0., 1., 1., 1.);
    float[10] seg3 = float[](0., 0., 1., 1., 1., 1., 1., 0., 1., 1.);
    float[10] seg4 = float[](1., 0., 1., 0., 0., 0., 1., 0., 1., 0.);
    float[10] seg5 = float[](1., 1., 0., 1., 1., 1., 1., 1., 1., 1.);
    float[10] seg6 = float[](1., 0., 1., 1., 0., 1., 1., 0., 1., 1.);
    #endif
    //
    //
    //
    // top
    SDFp = min(SDFp, DE_seg(p, vec2(0., 0.), 0.)+(1.-seg0[int(id)])*1e9 );
    // top left
    SDFp = min(SDFp, DE_seg(p, vec2(0., 0.), 1.)+(1.-seg1[int(id)])*1e9 );
    // top right
    SDFp = min(SDFp, DE_seg(p, vec2(1., 0.), 1.)+(1.-seg2[int(id)])*1e9 );
    // middle
    SDFp = min(SDFp, DE_seg(p, vec2(0., 1.), 0.)+(1.-seg3[int(id)])*1e9 );
    // bottom left
    SDFp = min(SDFp, DE_seg(p, vec2(0., 1.), 1.)+(1.-seg4[int(id)])*1e9 );
    // bottom right
    SDFp = min(SDFp, DE_seg(p, vec2(1., 1.), 1.)+(1.-seg5[int(id)])*1e9 );
    // bottom
    SDFp = min(SDFp, DE_seg(p, vec2(0., 2.), 0.)+(1.-seg6[int(id)])*1e9 );
    //
    return SDFp;
}

void mainImage (out vec4 fragColor, in vec2 fragCoord) {
    vec3 finalCol = vec3(0.);
    #define spp 1.
    #define samplei 0.
    //for (float samplei=0.; samplei<spp; ++samplei) {
        vec2 p = (fragCoord.xy-iResolution.xy/2.)/iResolution.y;
        //
        p *= 5.;
        p.y = -p.y;
        p.x -= .5;
        p.y -= -1.;
        //
        //#define iDate vec4(vec3(0.), iTime*60.*18.)
        //
        #define minute floor(iDate.w/60.)
        float hour = floor(iDate.w/60./60.);
    if (hour > 12.) { hour -= 12.; }
        //
        //
        //vec3 retina = vec3(0., 0., 100./255.)*mod(floor(p.x*1.)+floor(p.y*1.), 2.);
        vec3 retina;
        //
        float SDFp = 1e9;
        SDFp = min(SDFp, DE_7seg(p-vec2(2., 0.), mod(minute, 10.) ));
        SDFp = min(SDFp, DE_7seg(p-vec2(0., 0.), mod(floor(minute/10.), 6.) ));
        #if 1
        SDFp = min(SDFp, DE_7seg(p-vec2(-2, 0.), mod(hour, 10.) ));
        SDFp = min(SDFp, DE_7seg(p-vec2(-4, 0.), mod(floor(hour/10.), 2.) ));
        //
        //SDFp = min(SDFp, length(p-vec2(sin(float(iFrame)*PI/60.), 3.)) < .1 ? 1. : 0);
        SDFp = min(SDFp, length(p-vec2(-.5, 0.5))-.05  +1e9*floor(mod(iTime, 2.)) );
        SDFp = min(SDFp, length(p-vec2(-.5, 1.5))-.05  +1e9*floor(mod(iTime, 2.)) );
        #endif
        //
        if (SDFp > 0.) {
            retina = mix(
                vec3(0., 0., 100./255.),
                vec3(0., 1., 1.),
                1./(1.+pow(SDFp, 1.)*3. )
            );
        }
        else {
            retina = vec3(1.);
        }
        finalCol = retina;
    //}
    //
    fragColor = vec4(finalCol/spp, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return '3dtSRj';
  }
  name(): string {
    return '7 segment display (wip)';
  }
  sort() {
    return 277;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas({ width: '600px' });
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
