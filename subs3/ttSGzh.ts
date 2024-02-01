import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define atmosphereHeight 8228.
#define earthRadius 6371000.
#define mieHeight 1200
#define sunColor vec3( 1., .899, .828 )
#define ozoneHeight 30000.
#define ozoneCoefficient (vec3(3.426, 8.298, .356) * 6e-5 / 100.)
#define mieCoefficient 2e-6 // adjust for foggier look

// ( Riley, Ebert, Kraus )
//#define rayleighCoefficient vec3(5.8e-6  , 1.35e-5 , 3.31e-5 )
// ( Bucholtz )
//#define rayleighCoefficient vec3(4.847e-6, 1.149e-5, 2.87e-5 ) 
// ( Thalman, Zarzana, Tolbert, Volkamer )
//#define rayleighCoefficient vec3(5.358e-6, 1.253e-5, 3.062e-5)
// ( Penndorf )
#define rayleighCoefficient vec3(5.178e-6, 1.226e-5, 3.06e-5 )

#define up vec3(0,1,0)

vec3 getSkyThicknesses(const vec3 rd){
    const vec4 sr = earthRadius + vec4(
        atmosphereHeight,
        mieHeight,
        ozoneHeight,
        ozoneHeight + atmosphereHeight
    );
    const float r2 = earthRadius * earthRadius;
    
    //float b = dot(rd, -up) * earthRadius;
    float b = -rd.y * earthRadius;
    vec4 z = sqrt( sr * sr + (b * b - r2) );

    return vec3(b+z.xy, z.w-z.z);
}

#define phaseRayleigh(a) (( .4 * (a) + 1.12 )/2.24)

float phaseg(float x,float g){
    const float  b = 1./2.;
    float a = inversesqrt(1.+g*g-2.*g*x);
	return b*(1.-g*g)*a*a*a;
}
float phaseMie(const float VdotL, const float depth){
    float g = exp2( depth * -15e-5 );
    return phaseg(VdotL, g);
}

vec3 getSky(const vec3 V, const vec3 L) {
    
    const float ln2 = log(2.);

    const mat3 coeffs = mat3(
        rayleighCoefficient      / ln2,
        vec3(mieCoefficient*1.11)/ ln2, // mie absorbs (Bruneton)
        ozoneCoefficient         / ln2
    );
    
    vec3 thicknesses = getSkyThicknesses(V);
    float VdotL = dot(V, L);

    vec3 rayleighScatter =(thicknesses.x * phaseRayleigh(VdotL))          * rayleighCoefficient;
    float     mieScatter = thicknesses.y * phaseMie(VdotL, thicknesses.y) *      mieCoefficient;

	vec3 scattering = rayleighScatter + mieScatter;
    
    vec3 sunCoeff = coeffs * getSkyThicknesses(L);
    vec3 viewCoeff = coeffs * thicknesses;
    vec3 absorption = (exp2(-viewCoeff)-exp2(-sunCoeff)) / ( (sunCoeff - viewCoeff) * ln2 );
    
    //  integral of x from 0 to 1
    //  exp2( -a*x - b*(1-x) )
    //
    //     2⁻ᵃ - 2⁻ᵇ
    //     ---------
    //  (a - b) * ln(2)

    return sunColor * scattering * absorption;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec3 L = vec3(0,cos(iTime/2.),sin(iTime/2.));
    vec3 V = normalize(vec3(fragCoord * 2.0 - iResolution.xy, iResolution.x));
    
    vec3 m = normalize(vec3(iMouse.xy*2.0-iResolution.xy,iResolution.x));
    //vec3 t = normalize(cross(up,m));
    vec3 t = vec3(m.z,0,-m.x)*inversesqrt(1.-m.y*m.y);
    
    V *= mat3(t,cross(m,t),m);
    
    fragColor.rgb = pow(getSky(V,L),vec3(1./2.2));
    fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'ttSGzh';
  }
  name(): string {
    return 'cheap sky simulation';
  }
  sort() {
    return 392;
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
