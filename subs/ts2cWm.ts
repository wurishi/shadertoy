import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
mat2 rotate(float a){
  float c=cos(a),s=sin(a);
  return mat2(c,-s,s,c);
}

float sdRect(vec2 p, vec2 r)
{
  p=abs(p)-r;
  return max(p.x,p.y);
}

float sdf(vec2 p)
{
  float d=1e9;
  d=min(d,sdRect(p-vec2(3),vec2(7,1)));
  d=min(d,sdRect(p-vec2(3),vec2(1,7)));
  d=min(d,sdRect(p+vec2(3),vec2(1,7)));
  d=min(d,sdRect(p+vec2(6,3),vec2(4,1)));
  d=min(d,sdRect(p+vec2(9),vec2(1)));
  d=min(d,sdRect(p-vec2(9),vec2(1)));
  return d;
}

void mainImage(out vec4 fragColor, vec2 fragCoord)
{
vec2 uv=fragCoord.xy/iResolution.xy;
vec4 tex=texelFetch(iChannel0,ivec2(fragCoord),0);

// divide by sample-count
vec3 color=tex.rgb/tex.a;
  
  // each grayscale light is in a separate color channel
  // so I can adjust the balance in post here
  // comment this out for pretty debug colors
  vec3 weights = vec3(1.5,.2,.2);
  weights /= dot(weights,vec3(1));
  color = vec3(dot(color,weights));
  
// vignette to darken the corners
uv-=.5;
color *= 1.-dot(uv,uv)*.8;

  // exposure and tonemap
  color *= 2.5;
  color = 1.-exp(color*-2.);

// gamma correction
color = pow(color, vec3(.45));
  
  // raise the black level slightly
  color = color*.98+.02;

  // "final" color
  fragColor = vec4(vec3(color),1);
  
// set up for logo overlay
  uv.x*=iResolution.x/iResolution.y;
  uv -= vec2(.8888,-.5); // assumes 16:9
  uv *= 720.;
  uv += vec2(20,-20);
float threshold = abs(dFdx(uv.x)*.5);
uv+=vec2(8,0);
  uv*=rotate(acos(-1.)*.25);

  // logo overlay
fragColor.rgb *= smoothstep(-threshold,threshold,sdf(uv))*.2+.8;
fragColor.a = 1.;
}`;

const f = `
#define pi acos(-1.)

mat2 rotate(float b)
{
    float c = cos(b),s = sin(b);
    return mat2(c,-s,s,c);
}

vec2 hash2(float n) {
	return fract(sin(vec2(n,n+1.))*vec2(43758.5453123));
}

float sdIcosahedron(vec3 p, float r)
{
    const float q = (sqrt(5.)+3.)/2.;

    const vec3 n1 = normalize(vec3(q,1,0));
    const vec3 n2 = vec3(sqrt(3.)/3.);

    p = abs(p);
    float d = dot(p, n2.xyz);
    p=p*n1.x+p.yzx*n1.y;
    return max(max(p.x,p.y),max(p.z,d))-n1.x*r;
}

float sdOctahedron(vec3 p, float r)
{
    return (dot(abs(p),vec3(1))-r)/sqrt(3.);
}

float sdDodecahedron(vec3 p, float r)
{
	const float phi = (1.+sqrt(5.))*.5;
    p = abs(p);
    p += phi*p.zxy;
    return (max(max(p.x,p.y),p.z)-r*phi) / sqrt(phi*phi+1.);
}

struct prim_t {
    vec3 pos;
    float size;
    float rxy;
    float ryz;
};

// where the magic numbers live:
const prim_t icosa[]=prim_t[](
	prim_t(vec3(3.36,-.23,0),1.2,-.65,0.),
	prim_t(vec3(2.0,-1.,0),.71,.2,0.),
	prim_t(vec3(1.2,-3.1,0),.71,-.08,0.),
	prim_t(vec3(1.75,1.36,-.2),.63,0.,0.03)
    
    // not necessary for the shadow effect,
    // added late for aesthetic reasons
	,prim_t(vec3(4.1,1.66,0),.3,0.,0.0)
	,prim_t(vec3(5.8,-.2,0),.3,7.,0.0)
);
const prim_t dodec[]=prim_t[](
	prim_t(vec3(.97,-1.55,0),.55,-.05,0.),
	prim_t(vec3(.90,-1.95,0),.51,.0,0.),
	prim_t(vec3(2.2,2.1,.2),1.2,.0,.08),
	prim_t(vec3(1.45,-2.4,0),.7,0.,0.)
    
    // see earlier comment
	,prim_t(vec3(3.0,-2.4,0),.4,.3,0.)
);
const prim_t octah[]=prim_t[](
	prim_t(vec3(.68,3.2,0),1.05,0.,-.47),
	prim_t(vec3(.5,-3.75,0),.8,0.,.45),
	prim_t(vec3(.8,.93,0),.8,0.,.72),
	prim_t(vec3(.18,-2.2,0),.4,1.5,0.5),
	prim_t(vec3(.2,-2.6,0),.5,0.,0.5)
);

vec3 primTransform(vec3 p, prim_t b) {
	p-=b.pos;
    p.xy*=rotate(b.rxy);
    p.yz*=rotate(b.ryz);
    return p;
}

float scene(vec3 p)
{
    float d = 1e9;
    
    float ground = -p.z;
    if (abs(ground)<.01){
    	// plaster wall surface, just two octaves of subtle noise
    	ground -= texture(iChannel1,p.xy*.125).r*.0025;
    	ground -= texture(iChannel1,p.xy*.25).r*.0025;
    }

    // avoid evaluating expensive geometry if possible
    if (p.x > -2. && p.x < 6.5 && abs(p.y) < 5.) {
        for(int i=0;i<6;++i){
            d=min(d,sdIcosahedron(
                primTransform(p,icosa[i]),
                icosa[i].size
            ));
        }
        for(int i=0;i<5;++i){
            d=min(d,sdDodecahedron(
                primTransform(p,dodec[i]),
                dodec[i].size
            ));
        }
        for(int i=0;i<5;++i){
            d=min(d,sdOctahedron(
                primTransform(p,octah[i]),
                octah[i].size
            ));
        }
    }
    
    return min(d,ground);
}

vec2 rv2;

vec3 ortho(vec3 a){
    vec3 b=cross(vec3(-1,-1,.5),a);
    // assume b is nonzero
    return (b);
}

// various bits of lighting code "borrowed" from 
// http://blog.hvidtfeldts.net/index.php/2015/01/path-tracing-3d-fractals/
vec3 getSampleBiased(vec3  dir, float power) {
	dir = normalize(dir);
	vec3 o1 = normalize(ortho(dir));
	vec3 o2 = normalize(cross(dir, o1));
	vec2 r = rv2;
	r.x=r.x*2.*pi;
	r.y=pow(r.y,1.0/(power+1.0));
	float oneminus = sqrt(1.0-r.y*r.y);
	return cos(r.x)*oneminus*o1+sin(r.x)*oneminus*o2+r.y*dir;
}

vec3 getConeSample(vec3 dir, float extent) {
	dir = normalize(dir);
	vec3 o1 = normalize(ortho(dir));
	vec3 o2 = normalize(cross(dir, o1));
	vec2 r =  rv2;
	r.x=r.x*2.*pi;
	r.y=1.0-r.y*extent;
	float oneminus = sqrt(1.0-r.y*r.y);
	return cos(r.x)*oneminus*o1+sin(r.x)*oneminus*o2+r.y*dir;
}

vec3 sky(vec3 viewDir) {
    float toplight = step(.5, dot(viewDir,vec3(0,1,-.2)));
    float sidelight = step(.5, dot(viewDir,normalize(vec3(1,0,-1))));
    return vec3(0,toplight,sidelight);
}

bool trace5(vec3 cam, vec3 dir, float EPS, out vec3 h, out vec3 n, out float k) {
	float t=0.;
    for(int i=0;i<100;++i)
    {
        k = scene(cam+dir*t);
        t += k;
        if (abs(k) < EPS)
            break;
    }

    h = cam+dir*t;
	
    // if we hit something
    if(abs(k)<EPS)
    {
        vec2 o = vec2(EPS, 0);
        k=scene(h);
        n = normalize(vec3(
            scene(h+o.xyy),
            scene(h+o.yxy),
            scene(h+o.yyx) 
        )-k);
        return true;
    }
    return false;
}

vec3 trace2(vec3 cam, vec3 dir)
{
    const vec3 sunPos = vec3(20,0,-5);
    const float sunSize = 1e-3;
    vec3 sunColor = vec3(1,0,0);
    
    vec3 accum = vec3(1);
    vec3 direct = vec3(0);
    for(int ibounce=0;ibounce<5;++ibounce)
    {
        vec3 h,n;
        float k;
        if (trace5(cam,dir,.001,h,n,k))
        {
            cam = h+n*.002;
            dir=getSampleBiased(n,1.);
             
            vec3 sunDirection = sunPos-h;
            vec3 sunSampleDir = getConeSample(sunDirection,sunSize);
            float sunLight = dot(n, sunSampleDir);
            vec3 dummy0,dummy1;
            float dummy2;
            if (sunLight>0.0 && !trace5(h + n*.01,sunSampleDir,.01,dummy0,dummy1,dummy2)) {
                direct += accum*sunLight*sunColor;
            }
            rv2=hash2(rv2.y);
        }
        else if (abs(k) > .1) {
            return direct + sky(dir) * accum;
        } else {
            break;
        }
    }
    
    // deliberately fail the pixel
    return vec3(-1.);
}

vec2 bokeh(){
	vec2 a=rv2;
    if(a.y>a.x)
        a=1.-a;
    a.y*=pi*2./a.x;
    return a.x*vec2(cos(a.y),sin(a.y));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // recover previous frame for iterative rendering
   	fragColor = texelFetch(iChannel0,ivec2(fragCoord),0);	
    
    // get UVs
    vec2 uv = fragCoord.xy/iResolution.xy-.5;

    // seed per-pixel
	rv2 = hash2( iTime+(uv.x+iResolution.x*uv.y)*1.51269341231 );
    
    // jitter for antialiasing
    uv += 2.*(rv2-.5)/iResolution.xy;
    
    // correct UVs for aspect ratio
    uv.x*=iResolution.x/iResolution.y;
	
    // camera params
    const vec3 camPos = vec3(-.5,-.2,-10);
    const vec3 lookAt = vec3(-.5,-.2,0);
    const float focusDistance=distance(camPos,lookAt);
    const vec2 apertureRadius=vec2(1,2)*.1;
   
    // make a camera
    vec3 cam = vec3(0);
    vec3 dir = normalize(vec3(uv,1.));
    
    // slight bokeh
    vec2 bokehJitter=bokeh();
    cam.xy+=bokehJitter*apertureRadius;
    dir.xy-=bokehJitter*apertureRadius*dir.z/focusDistance;

    // rotate/move the camera
    vec3 lookDir = lookAt-camPos;
    float pitch = -atan(lookDir.y,length(lookDir.xz));
    float yaw = -atan(lookDir.x,lookDir.z);
    cam.yz *= rotate(pitch);
    dir.yz *= rotate(pitch);
    cam.xz *= rotate(yaw);
    dir.xz *= rotate(yaw);
    cam += camPos;
    
    // compute the pixel color
	vec3 pixel = trace2(cam,dir);
        
    if (iMouse.z > 0.) {
        fragColor = vec4(0);
    }

    fragColor += (!isnan(pixel.r) && pixel.r >= 0.) ? vec4(vec3(pixel),1) : vec4(0);
}
`;

export default class implements iSub {
  key(): string {
    return 'ts2cWm';
  }
  name(): string {
    return 'Primitive Portrait';
  }
  // sort() {
  //   return 0;
  // }
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
    return [
      { type: 1, f, fi: 0 },
      webglUtils.DEFAULT_NOISE_BW, //
    ];
  }
}
