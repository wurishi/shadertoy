import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_animate;

vec2 hash2( vec2 p )
{
	// texture based white noise
	return textureLod( iChannel0, (p+0.5)/256.0, 0.0 ).xy;
	
    // procedural white noise	
	//return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

vec3 voronoi( in vec2 x )
{
    vec2 n = floor(x);
    vec2 f = fract(x);

    //----------------------------------
    // first pass: regular voronoi
    //----------------------------------
	vec2 mg, mr;

    float md = 8.0;
    for( int j=-1; j<=1; j++ )
    for( int i=-1; i<=1; i++ )
    {
        vec2 g = vec2(float(i),float(j));
		vec2 o = hash2( n + g );
    if(u_animate) {
      o = 0.5 + 0.5*sin( iTime + 6.2831*o );
    }
        vec2 r = g + o - f;
        float d = dot(r,r);

        if( d<md )
        {
            md = d;
            mr = r;
            mg = g;
        }
    }

    //----------------------------------
    // second pass: distance to borders
    //----------------------------------
    md = 8.0;
    for( int j=-2; j<=2; j++ )
    for( int i=-2; i<=2; i++ )
    {
        vec2 g = mg + vec2(float(i),float(j));
		vec2 o = hash2( n + g );
    if(u_animate) {
      o = 0.5 + 0.5*sin( iTime + 6.2831*o );
    }
        vec2 r = g + o - f;

        if( dot(mr-r,mr-r)>0.00001 )
        md = min( md, dot( 0.5*(mr+r), normalize(r-mr) ) );
    }

    return vec3( md, mr );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord/iResolution.xx;

    vec3 c = voronoi( 8.0*p );

	// isolines
    vec3 col = c.x*(0.5 + 0.5*sin(64.0*c.x))*vec3(1.0);
    // borders	
    col = mix( vec3(1.0,0.6,0.0), col, smoothstep( 0.04, 0.07, c.x ) );
    // feature points
	float dd = length( c.yz );
	col = mix( vec3(1.0,0.6,0.1), col, smoothstep( 0.0, 0.12, dd) );
	col += vec3(1.0,0.6,0.1)*(1.0-smoothstep( 0.0, 0.04, dd));

	fragColor = vec4(col,1.0);
}
`;

let gui: GUI;
const api = {
  u_animate: true,
};

export default class implements iSub {
  key(): string {
    return 'ldl3W8';
  }
  name(): string {
    return 'Voronoi - distances';
  }
  sort() {
    return 95;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_animate');
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
    const u_animate = webglUtils.getUniformLocation(gl, program, 'u_animate');
    return () => {
      u_animate.uniform1i(api.u_animate ? 1 : 0);
    };
  }
  channels() {
    return [webglUtils.DEFAULT_NOISE];
  }
}
