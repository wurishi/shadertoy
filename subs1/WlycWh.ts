import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float cro( in vec2 a, in vec2 b ) { return a.x*b.y - a.y*b.x; }
float dot2(in vec2 a ) { return dot(a,a); }

void quadSkeleton( in vec2 v[4], out vec2 qa, out vec2 qb, out int of )
{
    of = 0;
    if( dot2(v[1]-v[0])+dot2(v[3]-v[2]) > 
        dot2(v[2]-v[1])+dot2(v[0]-v[3]) )
    {
        vec2 t = v[0];
        v[0] = v[1]; 
        v[1] = v[2];
        v[2] = v[3]; 
        v[3] = t;
        of = 1;
    }
    
    vec2 s10 = v[1]-v[0]; float e10 = length(s10);
    vec2 s21 = v[2]-v[1]; float e21 = length(s21);
    vec2 s32 = v[3]-v[2]; float e32 = length(s32);
    vec2 s03 = v[0]-v[3]; float e03 = length(s03);

    float kd = cro(s03,s21);
    float k0 = cro(s03,s10);
    float k1 = cro(s10,s21);
    float k2 = cro(s21,s32);
    float k3 = cro(s32,s03);
    
    // k0+k2 = k1+k3 = area = cro(s20,s31) = cro(v[2]-v[0],v[3]-v[1])
    
    // k3 = k0+k2-k1;
    
    qa = 0.5*(v[0]+v[1]) + 
         0.5*((s03*e10-s10*e03)*k1 -
              (s21*e10-s10*e21)*k0)/(-k0*e21-k1*e03+kd*e10);

    qb = 0.5*(v[2]+v[3]) + 
         0.5*((s21*e32-s32*e21)*k3 -
              (s03*e32-s32*e03)*k2)/(-k2*e03-k3*e21-kd*e32);
}

//----------------------------------------------------

vec2 sdSeg( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return vec2(dot2(pa-ba*h), cro(pa, ba));
}

vec3 sdgQuad( in vec2 p, in vec2 v[4] )
{
    float gs = cro(v[0]-v[3],v[1]-v[0]);
    vec4 res;
    
    // edge 0
    {
    vec2  e = v[1]-v[0];
    vec2  w = p-v[0];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4(d,q,s);
    }
    
    // edge 1
    {
	vec2  e = v[2]-v[1];
    vec2  w = p-v[1];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4( (d<res.x) ? vec3(d,q) : res.xyz,
                (s>res.w) ?      s    : res.w );
    }
    
    // edge 2
    {
	vec2  e = v[3]-v[2];
    vec2  w = p-v[2];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4( (d<res.x) ? vec3(d,q) : res.xyz,
                (s>res.w) ?      s    : res.w );
    }

    // edge 3
    {
    vec2  e = v[0]-v[3];
    vec2  w = p-v[3];
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4( (d<res.x) ? vec3(d,q) : res.xyz,
                (s>res.w) ?      s    : res.w );
    }    
    
    // distance and sign
    float d = sqrt(res.x)*sign(res.w);
    
    return vec3(d,res.yz/d);
}

float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h );
}


// signed distance to a disk
float sdDisk( in vec2 p, in vec2 c, in float r )
{
    return length(p-c)-r;
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    float px = 2.0/iResolution.y;
    
    float time = iTime;
    vec2 v[4] = vec2[4](
        vec2(-0.9,-0.5) + 0.3*cos( 0.5*time + vec2(0.0,1.9) + 4.0 ),
	    vec2( 0.9,-0.5) + 0.3*cos( 0.7*time + vec2(0.0,1.7) + 2.0 ),
	    vec2( 0.9, 0.5) + 0.3*cos( 0.9*time + vec2(0.0,1.3) + 1.0 ),
	    vec2(-0.9, 0.5) + 0.3*cos( 1.1*time + vec2(0.0,1.5) + 0.0 ) );


	vec3 dg = sdgQuad(p, v);
    float d = dg.x;
    vec2  g = dg.yz;
    
	// coloring
    vec3 col = (d>0.0) ? vec3(0.9,0.6,0.3) : vec3(1.1,1.4,1.7)*0.5;
    col *= 0.5+vec3(0.5+0.5*g,0.5);
    col *= 1.0 - 0.7*exp(-8.0*abs(d));
    col *= 0.8 + 0.2*cos(200.0*d);
    col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.02,abs(d)) );
    col = clamp(col,0.0,1.0);
 
    int of;
    vec2 qa, qb;
    quadSkeleton( v, qa, qb, of);
   

    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdSegment( p, v[(0+of)  ], qa )-0.003));
    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdSegment( p, v[(1+of)  ], qa )-0.003));
    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdSegment( p, v[(2+of)  ], qb )-0.003));
    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdSegment( p, v[(3+of)&3], qb )-0.003));
    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdDisk(p,qb,0.025)));
    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdDisk(p,qa,0.025)));
    col = mix(col,vec3(1.0,1.0,1.0),smoothstep(2.0*px,0.0,sdSegment( p, qa, qb)-0.003));
   

    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'WlycWh';
  }
  name(): string {
    return 'Quad - Gradient Boundaries';
  }
  sort() {
    return 196;
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
}
