import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
#define HW_PERFORMANCE 1

// 0: bright
// 1: dark
#define COLOR_SCHEMA 0
// 0: off
// 1: on
#define TAA          1

#if HW_PERFORMANCE==0
#define AA 2
#else
#define AA 5
#endif


// --------------------------------------
// Visual Studio rand()
// --------------------------------------
int   seed = 1;
void  srand(int s ) { seed = s; }
int   rand(void) { seed = seed*0x343fd+0x269ec3; return (seed>>16)&32767; }
float frand(void) { return float(rand())/32767.0; }
// --------------------------------------
// hash to initialize the random sequence (copied from Hugo Elias)
// --------------------------------------
int hash( int n )
{
    n = (n << 13) ^ n;
    return n * (n * n * 15731 + 789221) + 1376312589;
}
// --------------------------------------
float dot2( in vec2 v ) { return dot(v,v); }
// --------------------------------------

// pixel to z-plane transform
mat3x3 pixel2z( in float time )
{
    // rotation
    float an = 0.021*time;
    float co = cos(an), si=sin(an);
    // scale
    float  sc = 1.2*pow(0.95,time);
    // translation
    vec2   tr = vec2(0.0,0.17);
    
    return mat3x3( sc*co, sc*si, 0.0,
                  -sc*si, sc*co, 0.0,
                   tr.x,  tr.y,  1.0 );
}

vec3 render( in vec2 fragCoord, in float gtime )
{
    vec4 col = vec4(0.0);
    
	#if AA>1
    for( int m=0; m<AA; m++ )
    for( int n=0; n<AA; n++ )
    {
        // 2.5 pixel wide filter footprint, cubic falloff
        const float fw = 2.5;
        vec2 o = fw*(vec2(float(m),float(n)) / float(AA) - 0.5);
        float w = smoothstep(fw*0.5,0.0,length(o));
        vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;
        // motion blur
        float time = gtime + (0.5/24.0)*frand();
		#else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
        float w = 1.0;
        float time = gtime;
		#endif

        // pixel to z
        vec2 z = (pixel2z(time)*vec3(p,1.0)).xy;

        // compute Julia set
        const float threshold = 64.0;
        const vec2  kC = vec2(0.105,0.7905);
        const int   kNumIte = 200;

        float it = 0.0;
        float dz2 = 1.0;
        float m2 = 0.0;
        for( int i=0; i<kNumIte; i++ )
        {
            // df(z)/dz = 3*z^2
            dz2 *= 9.0*dot2(vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y));
            // f(z) = z^3 + c
            z = vec2( z.x*z.x*z.x - 3.0*z.x*z.y*z.y, 3.0*z.x*z.x*z.y - z.y*z.y*z.y ) + kC;
            // check divergence
            it++;
            m2 = dot2(z);
            if( m2>threshold ) break;
        }
        
        // distance
        float d = 0.5 * log(m2) * sqrt(m2/dz2);
        // interation count
        float h = it - log2(log2(dot(z,z))/(log2(threshold)))/log2(3.0); // http://iquilezles.org/www/articles/mset_smooth/mset_smooth.htm
        
        // coloring
        vec3 tmp = vec3(0.0);
        if( it<(float(kNumIte)-0.5) )
        {
            #if COLOR_SCHEMA==0
            tmp = 0.5 + 0.5*cos( 5.6 + sqrt(h)*0.5 + vec3(0.0,0.15,0.2));
            tmp *= smoothstep(0.0,0.0005,d);
            tmp *= 1.2/(0.3+tmp);
            tmp = pow(tmp,vec3(0.4,0.55,0.6));
            #else
            tmp = vec3(0.12,0.10,0.09);
            tmp *= smoothstep(0.005,0.020,d);
            float f = smoothstep(0.0005,0.0,d);
            tmp += 3.0*f*(0.5+0.5*cos(3.5 + sqrt(h)*0.4 + vec3(0.0,0.5,1.0)));
            tmp = clamp(tmp,0.0,1.0);
			#endif
        }
        
        col += vec4(tmp*w,w);
	#if AA>1
    }
    col /= col.w;
	#endif

    return col.xyz;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // initialize random seed
    ivec2 q = ivec2(fragCoord);
    srand( hash(q.x+hash(q.y+hash(1117*iFrame))));
    
    // draw Julia set (supersampled)
    vec3 col = render(fragCoord,iTime);
    
    //----------------------
    // temporal reprojection
    //----------------------
#if TAA==1
    // new pixel to old pixel transform (velocity vector)
    mat3x3    z_from_pnew = pixel2z(iTime);
    mat3x3 pold_from_z    = inverse(pixel2z(iTime - iTimeDelta +  (0.25/24.0) )); // from previous frame
    mat3x3 pold_from_pnew = pold_from_z*z_from_pnew;
    
    // reproject
    vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec2 op = (pold_from_pnew*vec3(p,1.0)).xy;
    vec2 sp = 0.5*(iResolution.y*op + iResolution.xy);
    
    // blend color
    vec4 data = texture(iChannel0,sp/iResolution.xy);
  	col = mix(col,data.xyz,0.8);
#endif    
    // output
    fragColor = vec4(col,1.0);
}
`;

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 col = texelFetch(iChannel0,ivec2(fragCoord),0).xyz;
    
    // vignetting    
    vec2 p = fragCoord/iResolution.xy;
    col *= 0.5+0.5*pow(16.0*p.x*p.y*(1.0-p.x)*(1.0-p.y),0.1);

    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '3llyzl';
  }
  name(): string {
    return 'Julia - Distance 2';
  }
  sort() {
    return 605;
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
    return f;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [{ type: 1, f, fi: 0 }];
  }
}
