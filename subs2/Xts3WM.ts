import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//Cheap curvature by nimitz (twitter: @stormoid)

/*
	Not sure if this method is new, but I haven't seen it around.
	Using a single extra tap to return analytic curvature of an SDF.

	My first implementation required 16 taps, then 12, then thanks 
	to some math help from a friend (austere) I got it down to 7 taps.
	And this is the	final optimization which requires 5 taps or a
	single tap if you're already computing normals.


	Edit (April 2016):

	Coming back to this I know realize that what I am returning is an
	approximation of the Laplacian of the SDF and the Laplacian being 
	the divergence of the gradient of the field means that any point
	on the surface being a sink will return negative "curvature" and
	vice-versa (since the gradient of a SDF should point to the centroid
	at any point in space).

	So now, I include the 7-tap version which is a more accurate Laplacian,
	while the 5-tap version while cheaper, it is less accurate.

	N.B. Mean curvature is computed here, not Gaussian curvature. (thanks to Fabrice)
*/

#define ITR 80
#define FAR 10.
#define time iTime

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}

float map(vec3 p)
{
    p.x += sin(p.y*4.+time+sin(p.z))*0.15;
    float d = length(p)-1.;
    float st = sin(time*0.42)*.5+0.5; 
    const float frq = 10.;
    d += sin(p.x*frq + time*.3 + sin(p.z*frq+time*.5+sin(p.y*frq+time*.7)))*0.075*st;
    
    return d;
}

float march(in vec3 ro, in vec3 rd)
{
	float precis = 0.001;
    float h=precis*2.0;
    float d = 0.;
    for( int i=0; i<ITR; i++ )
    {
        if( abs(h)<precis || d>FAR ) break;
        d += h;
	    float res = map(ro+rd*d);
        h = res;
    }
	return d;
}

//5 taps total, returns both normal and curvature
vec3 norcurv(in vec3 p, out float curv)
{
    vec2 e = vec2(-1., 1.)*0.01;   
    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);

    curv = .25/e.y*(t1 + t2 + t3 + t4 - 4.0*map(p));
    return normalize(e.yxx*t1 + e.xxy*t2 + e.xyx*t3 + e.yyy*t4);
}

//Curvature only, 5 taps, with epsilon width as input
float curv(in vec3 p, in float w)
{
    vec2 e = vec2(-1., 1.)*w;   
    
    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);
    
    return .25/e.y*(t1 + t2 + t3 + t4 - 4.0*map(p));
}

//Curvature in 7-tap (more accurate)
float curv2(in vec3 p, in float w)
{
    vec3 e = vec3(w, 0, 0);
    
    float t1 = map(p + e.xyy), t2 = map(p - e.xyy);
    float t3 = map(p + e.yxy), t4 = map(p - e.yxy);
    float t5 = map(p + e.yyx), t6 = map(p - e.yyx);
    
    return .25/e.x*(t1 + t2 + t3 + t4 + t5 + t6 - 6.0*map(p));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
	mo.x *= iResolution.x/iResolution.y;
	
    vec3 ro = vec3(0.,0.,4.);
    ro.xz *= mm2(time*0.05+mo.x*3.);
	vec3 ta = vec3(0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(vec3(0.,1.,0.), ww));
    vec3 vv = normalize(cross(ww, uu));
    vec3 rd = normalize(p.x*uu + p.y*vv + 1.5*ww);
	
	float rz = march(ro,rd);
	
    vec3 col = texture(iChannel0, rd.xy).rgb;
    
    if ( rz < FAR )
    {
        vec3 pos = ro+rz*rd;
        float crv;
        vec3 nor = norcurv(pos, crv);
        crv = curv2(pos, 0.01);
        vec3 ligt = normalize( vec3(.0, 1., 0.) );
        float dif = clamp(dot( nor, ligt ), 0., 1.);
        float bac = clamp( dot( nor, -ligt), 0.0, 1.0 );
        float spe = pow(clamp( dot( reflect(rd,nor), ligt ), 0.0, 1.0 ),400.);
        float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
        vec3 brdf = vec3(0.10,0.11,0.13);
        brdf += bac*vec3(0.1);
        brdf += dif*vec3(1.00,0.90,0.60);
        col = abs(sin(vec3(0.2,0.5,.9)+clamp(crv*80.,0.,1.)*1.2));
        col = mix(col,texture(iChannel0,reflect(rd,nor).xy).rgb,.5);
        col = col*brdf + col*spe +.3*fre*mix(col,vec3(1),0.5);
        col *= smoothstep(-1.,-.9,sin(crv*200.))*0.15+0.85;
    }
	
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'Xts3WM';
  }
  name(): string {
    return 'Cheap curvature';
  }
  sort() {
    return 266;
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
    return [webglUtils.ROCK_TEXTURE];
  }
}
