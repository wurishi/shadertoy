import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform int u_triangle;

vec2 triangleSkeleton( in vec2 v0, in vec2 v1, in vec2 v2 )
{
    // side lengths
    float e10 = length(v1-v0);
    float e21 = length(v2-v1);
    float e02 = length(v0-v2);

    // center of mass
    vec2 ce = (v0+v1+v2)/3.0;

    // displacement
    return ce + ( (v0-ce)*e21 + 
                  (v1-ce)*e02 +
                  (v2-ce)*e10) / (e10+e21+e02);
}

// slightly optimized version
vec2 triangleEquicenter( in vec2 v0, in vec2 v1, in vec2 v2 )
{
    vec2 e0 = v1-v0; float l0 = length(e0);
    vec2 e1 = v2-v1; float l1 = length(e1);
    vec2 e2 = v0-v2; float l2 = length(e2);
    return v0 + (e0*l2-e2*l0)/(l0+l1+l2);
}

//=====================================================

// signed distance to a disk
float sdDisk( in vec2 p, in vec2 c, in float r )
{
    return length(p-c)-r;
}

// distance to a line segment
float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h );
}

// signed distance to a 2D triangle
float cro(in vec2 a, in vec2 b ) { return a.x*b.y-a.y*b.x; }
float dot2( in vec2 a ) { return dot(a,a); }
vec3 sdgTriangle( in vec2 p, in vec2 v0, in vec2 v1, in vec2 v2 )
{
    float gs = cro(v0-v2,v1-v0);
    vec4 res;
    
    // edge 0
    {
    vec2  e = v1-v0;
    vec2  w = p-v0;
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4(d,q,s);
    }
    
    // edge 1
    {
	vec2  e = v2-v1;
    vec2  w = p-v1;
    vec2  q = w-e*clamp(dot(w,e)/dot(e,e),0.0,1.0);
    float d = dot(q,q);
    float s = gs*cro(w,e);
    res = vec4( (d<res.x) ? vec3(d,q) : res.xyz,
                (s>res.w) ?      s    : res.w );
    }
    
    // edge 2
    {
	vec2  e = v0-v2;
    vec2  w = p-v2;
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

//=====================================================

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    float px = 2.0/iResolution.y;
	
	vec2 v0 = cos( 0.5*iTime + vec2(0.0,2.0) + 0.0 );
	vec2 v1 = cos( 0.5*iTime + vec2(0.0,1.5) + 1.5 );
	vec2 v2 = cos( 0.5*iTime + vec2(0.0,3.0) + 4.0 );

    // compute traingle SDF
	vec3 dg = sdgTriangle( p, v0, v1, v2 );
    float d = dg.x;
    vec2 g = dg.yz;
    
    // compute triangle equicenter (yellow dot)
    vec2 ce;
    if(u_triangle == 1) {
      ce = triangleSkeleton( v0, v1, v2 );
    }
    else {
      ce = triangleEquicenter( v0, v1, v2 );
    }

    // draw triangle SDF
    vec3 col = (d>0.0) ? vec3(0.9,0.6,0.3) : vec3(1.1,1.4,1.7)*0.5;
    col *= 0.5+vec3(0.5+0.5*g,0.5);
    col *= 1.0 - 0.9*exp(-5.0*abs(d));
    col *= 0.8 + 0.2*cos(200.0*d);
    col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.02,abs(d)) );
    col = clamp(col,0.0,1.0);

    // animate equicenter display
    float al = 1.0;//smoothstep(-0.2,0.2,cos(3.1415927*iTime) );
    
    // draw helped bisectors
    col = mix(col,vec3(1.0,1.0,1.0),al*smoothstep(px,0.0,sdSegment( p, v0, ce )-0.005));
    col = mix(col,vec3(1.0,1.0,1.0),al*smoothstep(px,0.0,sdSegment( p, v1, ce )-0.005));
    col = mix(col,vec3(1.0,1.0,1.0),al*smoothstep(px,0.0,sdSegment( p, v2, ce )-0.005));
    
    // draw equicenter in red
    col = mix(col,vec3(1.0,1.0,0.0),al*smoothstep(px,0.0,sdDisk(p,ce,0.025)));

    // output
    fragColor = vec4(col,1.0);
}
`;

let gui: GUI;
const api = {
  u_triangle: 1,
};

export default class implements iSub {
  key(): string {
    return 'tlKcDz';
  }
  name(): string {
    return 'Triangle - Gradient Boundaries';
  }
  sort() {
    return 195;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_triangle', { triangleSkeleton: 1, triangleEquicenter: 0 });
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
    const u_triangle = webglUtils.getUniformLocation(gl, program, 'u_triangle');
    return () => {
      u_triangle.uniform1i(api.u_triangle);
    };
  }
}
