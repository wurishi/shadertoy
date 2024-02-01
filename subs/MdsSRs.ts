import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_interpolation;

vec3 noised( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = fract(x);
    
    vec2 u, du, ddu;
    // cubic interpolation vs quintic interpolation
    if(u_interpolation) {
      u = f*f*(3.0-2.0*f);
      du = 6.0*f*(1.0-f);
      ddu = 6.0 - 12.0*f;
    }
    else {
      u = f*f*f*(f*(f*6.0-15.0)+10.0);
      du = 30.0*f*f*(f*(f-2.0)+1.0);
      ddu = 60.0*f*(1.0+f*(-3.0+2.0*f));
    }
    
	float a = textureLod(iChannel0,(p+vec2(0.5,0.5))/256.0,0.0).x;
	float b = textureLod(iChannel0,(p+vec2(1.5,0.5))/256.0,0.0).x;
	float c = textureLod(iChannel0,(p+vec2(0.5,1.5))/256.0,0.0).x;
	float d = textureLod(iChannel0,(p+vec2(1.5,1.5))/256.0,0.0).x;
	
    float k0 =   a;
    float k1 =   b - a;
    float k2 =   c - a;
    float k4 =   a - b - c + d;


    // value
    float va = a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;
    // derivative                
    vec2  de = du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx);
    // hessian (second derivartive)
    mat2  he = mat2( ddu.x*(k1 + k4*u.y),   
                     du.x*k4*du.y,
                     du.y*k4*du.x,
                     ddu.y*(k2 + k4*u.x) );
    
    return vec3(va,de);

}

const float scale  = 0.003;
const float height = 180.0;

vec4 fbmd( in vec2 x )
{
    float a = 0.0;
    float b = 1.0;
	float f = 1.0;
    vec2  d = vec2(0.0);
    for( int i=0; i<10; i++ ) // 10 octaves
    {
        vec3 n = noised(f*x*scale);
        a += b*n.x;           // accumulate values		
        d += b*n.yz*f;        // accumulate derivatives (note that in this case b*f=1.0)
        b *= 0.5;             // amplitude decrease
        f *= 2.0;             // frequency increase
    }

	a *= height;
	d *= height*scale;
	
	// compute normal based on derivatives
	return vec4( a, normalize( vec3(-d.x,1.0,-d.y) ) );
}

// raymarch against fbm heightfield
vec4 interesect( in vec3 ro, in vec3 rd )
{
	vec4 res = vec4(-1.0);
    float t = 0.0;
	for( int i=0; i<70; i++ )
	{
        vec3 pos = ro + t*rd;
		vec4 hnor = fbmd( pos.xz );

		res = vec4(t,hnor.yzw);
		if( (pos.y-hnor.x)<0.05 ||  t>2000.0) break;
		
		t += (pos.y-hnor.x)*(0.001+hnor.z);
	}

	if( t>2000.0 ) res = vec4(-1.0);
	return res;
}

// compute normal numerically
vec3 calcNormal( in vec3 pos )
{
    vec3 e = vec3(0.01,0.0,0.0);
	return normalize( vec3(fbmd(pos.xz-e.xy).x - fbmd(pos.xz+e.xy).x,
                           2.0*e.x,
                           fbmd(pos.xz-e.yx).x - fbmd(pos.xz+e.yx).x ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy) / iResolution.y;

	// camera anim
	vec3 ro = vec3( 1000.0*cos(0.001*iTime), 0.0, 1000.0*sin(0.001*iTime) );
	vec3 ta = vec3( 0.0 );
    ro.y = fbmd(ro.xz).x + 2.0;
    ta.y = fbmd(ro.xz).x + 2.0;
	
    // camera matrix	
	vec3  cw = normalize( ta-ro );
	vec3  cu = normalize( cross(cw,vec3(0.0,1.0,0.0)) );
	vec3  cv = normalize( cross(cu,cw) );
	vec3  rd = normalize( p.x*cu + p.y*cv + 2.0*cw );

	// render
	vec3 col = vec3(0.0);
    vec4 tnor = interesect( ro, rd );
	float t = tnor.x;
	
	// commented out becasue of an ANGLE bug:
    //if( t>0.0 )
	{
		vec3 pos = ro + t*rd;
		col = mix( tnor.yzw, calcNormal( pos ), step(0.0,p.x) );
        col = 0.5 + 0.5*col;
		col *= exp(-0.000015*t*t);
	}
	
	// here becasue of the ANGLE bug:
	col *= smoothstep(-0.5,0.0,t);

	col = mix( vec3(0.0), col, smoothstep(0.006,0.007,abs(p.x)) );
	
    fragColor=vec4(col,1.0);
}
`;

let gui: GUI;
const api = {
  u_interpolation: true,
};

export default class implements iSub {
  key(): string {
    return 'MdsSRs';
  }
  name(): string {
    return 'Analytic Normals 2D';
  }
  sort() {
    return 82;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_interpolation');
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
    const u_interpolation = webglUtils.getUniformLocation(
      gl,
      program,
      'u_interpolation'
    );
    return () => {
      u_interpolation.uniform1i(api.u_interpolation ? 1 : 0);
    };
  }
  channels() {
    return [webglUtils.DEFAULT_NOISE_BW];
  }
}
