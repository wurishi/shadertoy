import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define COMPARE

vec2 Noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec4 rg = textureLod( iChannel0, (uv+0.5)/256.0, 0.0 );
	return mix( rg.yw, rg.xz, f.z );
}


float DistanceField( vec3 pos )
{
	//pos = abs(pos); return max( pos.x, max( pos.y, pos.z ) )-1.0;
	
	float p = 16.0; pos = pow(abs(pos),vec3(p/2.0)); return pow( dot( pos, pos ), 1.0/p )-1.0;
	
	//return (length(pos-vec3(0,-1,0))-2.0 + sin(sqrt(pow(atan(length(pos.xz),pos.y),2.0)+1.0)*20.0/*-iTime*/)/20.0)*.707;
	
	//return (pos.y + sin(pos.x*1.0)*sin(pos.z*1.0)/1.0)*.7;
}


vec3 Sky( vec3 ray )
{
	return mix( vec3(.8), vec3(0), exp2(-(1.0/max(ray.y,.01))*vec3(.4,.6,1.0)) );
}


vec3 Shade( vec3 pos, vec3 ray, vec3 normal, vec3 lightDir, vec3 lightCol )
{
	float ndotl = dot(normal,lightDir);
	vec3 light = lightCol*max(.0,ndotl);
	light += mix( vec3(.01,.04,.08), vec3(.1), (-normal.y+1.0) ); // ambient
	
	vec3 h = normalize(lightDir-ray);

	// this would work better using voronoi to get close points for aniso, then blend between them
	
	vec3 coord = pos*.6 + iTime*vec3(0,.0,0);
	coord.xy = coord.xy*.7071+coord.yx*.7071*vec2(1,-1);
	coord.xz = coord.xz*.7071+coord.zx*.7071*vec2(1,-1);
	vec3 aniso = vec3( Noise(coord), Noise(coord.yzx).x )*2.0-1.0;
	aniso -= normal*dot(aniso,normal);
	
	float anisotropy = min(1.0,length(aniso));
	aniso /= anisotropy;
	
	anisotropy = .8;
	
	#ifdef COMPARE
		anisotropy *= clamp(sin(iTime*1.0)*6.0+.5,.0,1.0); // constant magnitude => we get pinches, which actually look nice!
	#endif

	float ah = abs(dot(h,aniso)); // check if it's perpendicular to the striations
	float nh = max(.0,dot(normal,h));
	
	float q = exp2((1.0-anisotropy)*3.0);
	nh = pow( nh, q*10.0 );
	nh *= pow( 1.0-ah*anisotropy, 16.0 );
	vec3 specular = lightCol*nh*exp2((1.0-anisotropy)*1.0);
	
	// fade specular near terminator, to fake gradual occlusion of the micronormals
	specular *= smoothstep(.0,.5,ndotl);
	
	vec3 reflection = Sky( reflect(ray,normal) );
	float fresnel = pow( 1.0+dot(normal,ray), 5.0 );
	fresnel = mix( .0, .2, fresnel );
	
	return mix( light*vec3(.1), reflection, fresnel ) + specular;
}



// Isosurface Renderer

float traceStart = .1; // set these for tighter bounds for more accuracy
float traceEnd = 40.0;
float Trace( vec3 pos, vec3 ray )
{
	float t = traceStart;
	float h;
	for( int i=0; i < 60; i++ )
	{
		h = DistanceField( pos+t*ray );
		if ( h < .001 )
			break;
		t = t+h;
	}
	
	if ( t > traceEnd )//|| h > .001 )
		return 0.0;
	
	return t;
}

vec3 Normal( vec3 pos, vec3 ray )
{
	const vec2 delta = vec2(0,.001);
	vec3 grad;
	grad.x = DistanceField( pos+delta.yxx )-DistanceField( pos-delta.yxx );
	grad.y = DistanceField( pos+delta.xyx )-DistanceField( pos-delta.xyx );
	grad.z = DistanceField( pos+delta.xxy )-DistanceField( pos-delta.xxy );
	
	// prevent normals pointing away from camera (caused by precision errors)
	float gdr = dot ( grad, ray );
	grad -= max(.0,gdr)*ray;
	
	return normalize(grad);
}


// Camera

vec3 Ray( float zoom, vec2 fragCoord )
{
	return vec3( fragCoord.xy-iResolution.xy*.5, iResolution.x*zoom );
}

vec3 Rotate( inout vec3 v, vec2 a )
{
	vec4 cs = vec4( cos(a.x), sin(a.x), cos(a.y), sin(a.y) );
	
	v.yz = v.yz*cs.x+v.zy*cs.y*vec2(-1,1);
	v.xz = v.xz*cs.z+v.zx*cs.w*vec2(1,-1);
	
	vec3 p;
	p.xz = vec2( -cs.w, -cs.z )*cs.x;
	p.y = cs.y;
	
	return p;
}


// Camera Effects

void BarrelDistortion( inout vec3 ray, float degree )
{
	ray.z /= degree;
	ray.z = ( ray.z*ray.z - dot(ray.xy,ray.xy) ); // fisheye
	ray.z = degree*sqrt(ray.z);
}

vec3 LensFlare( vec3 ray, vec3 light, vec2 fragCoord )
{
	vec2 dirtuv = fragCoord.xy/iResolution.x;
	
	float dirt = 1.0-texture( iChannel1, dirtuv ).r;
	
	float l = max(.0,dot(light,ray));
	
	return (pow(l,20.0)*dirt*.1 + 1.0*pow(l,100.0))*vec3(1.05,1,.95);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec3 ray = Ray(1.0,fragCoord);
	BarrelDistortion( ray, .5 );
	ray = normalize(ray);
	vec3 localRay = ray;

	vec3 pos = 6.0*Rotate( ray, vec2(.4,iTime*.1+.5)+vec2(1.6,-6.3)*(iMouse.yx/iResolution.yx - .5) );
	
	vec3 col;

	vec3 lightDir = normalize(vec3(3,2,-1));
	
	float t = Trace( pos, ray );
	if ( t > .0 )
	{
		vec3 p = pos + ray*t;
		
		// shadow test
		float s = Trace( p, lightDir );
		
		vec3 n = Normal(p, ray);
		col = Shade( p, ray, n, lightDir, (s>.0)?vec3(0):vec3(.98,.95,.92) );
		
		// fog
		float f = 100.0;
//		col *= exp2(-t*vec3(.1,.6,1.0)/f);
		col = mix( vec3(.8), col, exp2(-t*vec3(.4,.6,1.0)/f) );
	}
	else
	{
		col = Sky( ray );
	}
	
	float sun = Trace( pos, lightDir );
	if ( sun == .0 )
	{
		col += LensFlare( ray, lightDir,fragCoord );
	}
	
	// vignetting:
	col *= smoothstep( .5, .0, dot(localRay.xy,localRay.xy) );

	// compress bright colours, ( because bloom vanishes in vignette )
	vec3 c = (col-1.0);
	c = sqrt(c*c+.01); // soft abs
	col = mix(col,1.0-c,.48); // .5 = never saturate, .0 = linear
	

	// grain
	vec2 grainuv = fragCoord.xy + floor(iTime*60.0)*vec2(37,41);
	vec2 filmNoise = texture( iChannel0, .5*grainuv/iChannelResolution[0].xy ).rb;
	col *= mix( vec3(1), mix(vec3(1,.5,0),vec3(0,.5,1),filmNoise.x), .1*filmNoise.y );

	
	fragColor = vec4(pow(col,vec3(1.0/2.6)),1);
}

`;

export default class implements iSub {
  key(): string {
    return 'XdB3DG';
  }
  name(): string {
    return 'Anisotropic Highlights';
  }
  sort() {
    return 379;
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
  channels() {
    return [
      webglUtils.DEFAULT_NOISE,
      webglUtils.ROCK_TEXTURE, //
    ];
  }
}
