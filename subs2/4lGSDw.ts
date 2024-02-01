import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

float sdSegmentSq( in vec2 p, in vec2 a, in vec2 b )
{
	vec2 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    vec2  d = pa - ba*h;
	return dot(d,d);
}

float sdPointSq( in vec2 p, in vec2 a )
{
    vec2 d = p - a;
	return dot(d,d);
}

vec2 cmul( vec2 a, vec2 b )  { return vec2( a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x ); }

#define ZERO min(iFrame,0)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float e = 1.0/iResolution.x;
	vec2 p = fragCoord / iResolution.x;
    
    vec3 col = vec3(1.0);

    #define NUM 38
    
    vec2 path[NUM];
    
    //------------------------------------------------------
    // path
    //------------------------------------------------------
    {
        path[ 0] = vec2( 0.098, 0.062 );
        path[ 1] = vec2( 0.352, 0.073 );
        path[ 2] = vec2( 0.422, 0.136 );
        path[ 3] = vec2( 0.371, 0.085 );
        path[ 4] = vec2( 0.449, 0.140 );
        path[ 5] = vec2( 0.352, 0.187 );
        path[ 6] = vec2( 0.379, 0.202 );
        path[ 7] = vec2( 0.398, 0.202 );
        path[ 8] = vec2( 0.266, 0.198 );
        path[ 9] = vec2( 0.318, 0.345 );
        path[10] = vec2( 0.402, 0.359 );
        path[11] = vec2( 0.361, 0.425 );
        path[12] = vec2( 0.371, 0.521 );
        path[13] = vec2( 0.410, 0.491 );
        path[14] = vec2( 0.410, 0.357 );
        path[15] = vec2( 0.502, 0.482 );
        path[16] = vec2( 0.529, 0.435 );
        path[17] = vec2( 0.426, 0.343 );
        path[18] = vec2( 0.449, 0.343 );
        path[19] = vec2( 0.504, 0.335 );
        path[20] = vec2( 0.664, 0.355 );
        path[21] = vec2( 0.748, 0.208 );
        path[22] = vec2( 0.738, 0.277 );
        path[23] = vec2( 0.787, 0.308 );
        path[24] = vec2( 0.748, 0.183 );
        path[25] = vec2( 0.623, 0.081 );
        path[26] = vec2( 0.557, 0.099 );
        path[27] = vec2( 0.648, 0.116 );
        path[28] = vec2( 0.598, 0.116 );
        path[29] = vec2( 0.566, 0.195 );
        path[30] = vec2( 0.584, 0.228 );
        path[31] = vec2( 0.508, 0.083 );
        path[32] = vec2( 0.457, 0.140 );
        path[33] = vec2( 0.508, 0.130 );
        path[34] = vec2( 0.625, 0.071 );
        path[35] = vec2( 0.818, 0.093 );
        path[36] = vec2( 0.951, 0.066 );
        path[37] = vec2( 0.547, 0.081 );
    }

    //------------------------------------------------------
    // draw path
    //------------------------------------------------------
    {
        vec2 d = vec2(1000.0);
        for( int i=0; i<(NUM-1); i++ )
        {
            vec2 a = path[i+0];
            vec2 b = path[i+1];
            d = min( d, vec2(sdSegmentSq( p,a,b ), sdPointSq(p,a) ) );
        }
        d.x = sqrt( d.x );
        d.y = sqrt( min( d.y, sdPointSq(p,path[NUM-1]) ) );
        //col = mix( col, vec3(0.8,0.8,0.8), 1.0-smoothstep(0.0,e,d.x) );
        col = mix( col, vec3(0.9,0.2,0.0), 1.0-smoothstep(5.0*e,6.0*e,d.y) );
    }

    //------------------------------------------------------
    // compute fourier transform of the path
    //------------------------------------------------------
    vec2 fcsX[20];
    vec2 fcsY[20];
    for( int k=ZERO; k<20; k++ )
    {
        vec2 fcx = vec2(0.0);
        vec2 fcy = vec2(0.0);
        for( int i=0; i<NUM; i++ )
        {
            float an = -6.283185*float(k)*float(i)/float(NUM);
            vec2  ex = vec2( cos(an), sin(an) );
            fcx += path[i].x*ex;
            fcy += path[i].y*ex;
        }
        fcsX[k] = fcx;
        fcsY[k] = fcy;
    }

    //------------------------------------------------------
    // inverse transform with 6x evaluation points
    //------------------------------------------------------
    {
    float ani = min( mod((12.0+iTime)/10.1,1.3), 1.0 );
    float d = 1000.0;
    vec2 oq, fq;
    for( int i=ZERO; i<256; i++ )
    {
        float h = ani*float(i)/256.0;
        vec2 q = vec2(0.0);
        for( int k=0; k<20; k++ )
        {
            float w = (k==0||k==19)?1.0:2.0;
            float an = -6.283185*float(k)*h;
            vec2  ex = vec2( cos(an), sin(an) );
            q.x += w*dot(fcsX[k],ex)/float(NUM);
            q.y += w*dot(fcsY[k],ex)/float(NUM);
        }
        if( i==0 ) fq=q; else d = min( d, sdSegmentSq( p, q, oq ) );
        oq = q;
    }
    d = sqrt(d);
    col = mix( col, vec3(0.1,0.1,0.2), 1.0-smoothstep(0.0*e,2.0*e,d) );
    col *= 0.75 + 0.25*smoothstep( 0.0, 0.13, sqrt(d) );
    }

    //------------------------------------------------------

    col *= 1.0 - 0.3*length(fragCoord/iResolution.xy-0.5);
 
    
	fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '4lGSDw';
  }
  name(): string {
    return 'Fourier - interpolation';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 260;
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
