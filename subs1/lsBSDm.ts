import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float cross2d( in vec2 a, in vec2 b ) { return a.x*b.y - a.y*b.x; }

uniform int u_inv;

vec2 invBilinear1( in vec2 p, in vec2 a, in vec2 b, in vec2 c, in vec2 d )
{
    vec2 e = b-a;
    vec2 f = d-a;
    vec2 g = a-b+c-d;
    vec2 h = p-a;
        
    float k2 = cross2d( g, f );
    float k1 = cross2d( e, f ) + cross2d( h, g );
    float k0 = cross2d( h, e );
    
    float w = k1*k1 - 4.0*k0*k2;
    if( w<0.0 ) return vec2(-1.0);
    w = sqrt( w );

    // will fail for k0=0, which is only on the ba edge 
    float v = 2.0*k0/(-k1 - w); 
    if( v<0.0 || v>1.0 ) v = 2.0*k0/(-k1 + w);

    float u = (h.x - f.x*v)/(e.x + g.x*v);
    if( u<0.0 || u>1.0 || v<0.0 || v>1.0 ) return vec2(-1.0);
    return vec2( u, v );
}

vec2 invBilinear0( in vec2 p, in vec2 a, in vec2 b, in vec2 c, in vec2 d )
{
    vec2 res = vec2(-1.0);

    vec2 e = b-a;
    vec2 f = d-a;
    vec2 g = a-b+c-d;
    vec2 h = p-a;
        
    float k2 = cross2d( g, f );
    float k1 = cross2d( e, f ) + cross2d( h, g );
    float k0 = cross2d( h, e );
    
    // if edges are parallel, this is a linear equation. Do not this test here though, do
    // it in the user code
    if( abs(k2)<0.001 )
    {
        float v = -k0/k1;
        float u  = (h.x*k1+f.x*k0) / (e.x*k1-g.x*k0);
        if( v>0.0 && v<1.0 && u>0.0 && u<1.0 )  res = vec2( u, v );
    }
	else
    {
        // otherwise, it's a quadratic
        float w = k1*k1 - 4.0*k0*k2;
        if( w<0.0 ) return vec2(-1.0);
        w = sqrt( w );

        float ik2 = 0.5/k2;
        float v = (-k1 - w)*ik2; if( v<0.0 || v>1.0 ) v = (-k1 + w)*ik2;
        float u = (h.x - f.x*v)/(e.x + g.x*v);
        if( u<0.0 || u>1.0 || v<0.0 || v>1.0 ) return vec2(-1.0);
        res = vec2( u, v );
    }
    
    return res;
}

float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h );
}

vec3  hash3( float n ) { return fract(sin(vec3(n,n+1.0,n+2.0))*43758.5453123); }

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/iResolution.y;
    
    // background
    vec3 col = vec3( 0.35 + 0.1*p.y );

    // move points
    vec2 a = cos( 1.11*iTime + vec2(0.1,4.0) );
    vec2 b = cos( 1.13*iTime + vec2(1.0,3.0) );
    vec2 c = cos( 1.17*iTime + vec2(2.0,2.0) );
    vec2 d = cos( 1.15*iTime + vec2(3.0,1.0) );

    // d = c+a-b; // enable this to test parallelograms
    
    // area of the quad
    vec2 uv;
    if(u_inv == 0) {
      uv = invBilinear0( p, a, b, c, d );
    }
    else {
      uv = invBilinear1( p, a, b, c, d );
    }
    if( uv.x>-0.5 )
    {
        col = texture( iChannel0, uv ).xyz;
    }
    
    // quad borders
    float h = 2.0/iResolution.y;
    col = mix( col, vec3(1.0,0.7,0.2), 1.0-smoothstep(h,2.0*h,sdSegment(p,a,b)));
    col = mix( col, vec3(1.0,0.7,0.2), 1.0-smoothstep(h,2.0*h,sdSegment(p,b,c)));
    col = mix( col, vec3(1.0,0.7,0.2), 1.0-smoothstep(h,2.0*h,sdSegment(p,c,d)));
    col = mix( col, vec3(1.0,0.7,0.2), 1.0-smoothstep(h,2.0*h,sdSegment(p,d,a)));
 
    col += (1.0/255.0)*hash3(p.x+13.0*p.y);

	fragColor = vec4( col, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_inv: 1,
};

export default class implements iSub {
  key(): string {
    return 'lsBSDm';
  }
  name(): string {
    return 'Inverse Bilinear';
  }
  sort() {
    return 197;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_inv', [0, 1]);
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
    const u_inv = webglUtils.getUniformLocation(gl, program, 'u_inv');
    return () => {
      u_inv.uniform1i(api.u_inv);
    };
  }
  channels() {
    return [webglUtils.ROCK_TEXTURE];
  }
}
