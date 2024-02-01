import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/*
 	Hexagon Truchet Tiles in 3D

*/
#define MAX_DIST 	75.
#define PI  		3.1415926
#define R 			iResolution
#define M 			iMouse
#define T 			iTime
#define S 			smoothstep
#define r2(a)  mat2(cos(a), sin(a), -sin(a), cos(a))

//@iq vec2 to float hash.
float hash2(vec2 p){  return fract(sin(dot(p, vec2(27.609, 57.583)))*43758.5453); }

vec3 get_mouse( vec3 ro ) {
    float x = M.xy==vec2(0) ? -.6 : -(M.y / R.y * 1. - .5) * PI;
    float y = M.xy==vec2(0) ? .9 : (M.x / R.x * 2. - 1.) * PI;
    ro.zy *= r2(x);
    ro.zx *= r2(y);
    return ro;
}

float sdTorus( vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

// lazy globals
vec4 hextiles;
vec3 hitPoint =vec3(0.);
float tRnd;

vec4 map(in vec3 uv) {
    vec2 res = vec2(1000.,0.);

	// set scale for truchet marching
    // flip scale and speed based on mod
    float mchange = mod(T*.11,4.);
    float scale = mchange < 2. ? .38 : .7;

    // 100+ is camera trick to not make cuts jumpy
    // move camera down so when scale happen its
    // not seeing the same spot
    uv.x-= mchange < 2. ? T*1.25 : 120.+T*.5;
    float py = uv.y*scale;
	vec2 p = uv.xz*scale;
    // Tiling @Shane
	// unit for scaling
    const vec2 s = vec2(sqrt(3.), 1.);
    // Two IDs, based off the grid center.
    vec4 hC = floor(vec4(p, p - vec2(1, .5))/s.xyxy) + .5;
    // Centering the coordinates with the hexagon centers above.
    vec4 h4 = vec4(p - hC.xy*s, p - (hC.zw + .5)*s);
    h4 = dot(h4.xy, h4.xy)<dot(h4.zw, h4.zw) ? vec4(h4.xy, hC.xy) : vec4(h4.zw, hC.zw + .5);
    // Local coordinates and ID.
    p = h4.xy; vec2 id = h4.zw;
    // save for later
    hextiles=h4;
    // rnd has to flip tiles
    float rnd = hash2(id.xy);
    tRnd=rnd;
    if(rnd>.5) p *= r2(60.*PI/180.);
	
	// truchet pattern for cutout
    vec2 ts = vec2(.2891,.15);
	
    vec2 p0 = p - vec2(-.5/1.732, .5);
    vec2 p1 = p - vec2(.8660254*2./3., 0);
    vec2 p2 = p - vec2(-.5/1.732, -.5);

    float rings = sdTorus(vec3(p0.x, py, p0.y),		ts); 
    rings = min(  sdTorus(vec3(p1.x, py, p1.y),		ts), rings); 
    rings = min(  sdTorus(vec3(p2.x, py, p2.y),		ts), rings);
    rings = min(  length(vec3(p.x, py, p.y))-.25,	rings);
    
    float land = max(uv.y-.06,-rings);
    if(land<res.x) {
        res = vec2(land,1.);  
        hitPoint = vec3(p.x, py, p.y);
    }
    
	ts = vec2(.2891,.05);
    float truch = sdTorus(vec3(p0.x, py, p0.y),		ts); 
    truch = min(  sdTorus(vec3(p1.x, py, p1.y),		ts), truch); 
    truch = min(  sdTorus(vec3(p2.x, py, p2.y),		ts), truch);

    if(truch<res.x) {
        res = vec2(truch,2.);   
    }
   
    // random balls sin at hash id
    float ht = rnd + rnd*sin(rnd+T*(rnd*1.8));
    ht*=.13;
    float balls =length(vec3(p.x, py-ht, p.y))-.1;
    if(balls<res.x) {
        res = vec2(balls,3.);   
    }
    
    //res.x = res.x;
    return vec4(res, h4.xy);
}
//Tetrahedron technique
vec3 get_normal(in vec3 p, in float t) {
	//https://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
    float h = 0.0002*t; 
    #define ZERO (min(iFrame,0))
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ ){
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(p+e*h).x;
    }
    return normalize(n);
}

vec4 ray_march( in vec3 ro, in vec3 rd, int maxstep ) {
    float t = 0.001;
    vec3 m = vec3(0.);
    for( int i=0; i<maxstep; i++ ) {
        vec4 d = map(ro + rd * t);
        m = d.yzw;
        if(d.x<.0001*t||t>MAX_DIST) break;
        t += d.x*.75;
    }
    return vec4(t,m);
}

float get_diff(in vec3 p, in vec3 lpos, in vec3 n) {
    vec3 l = lpos-p;
    vec3 lp = normalize(l);
    float dif = clamp(dot(n,lp),0. , 1.),
          shadow = ray_march(p + n * 0.0002 * 2.,lp,128).x;
    if(shadow < length(l)) dif *= .2;
    return dif;
}

// Tri-Planar blending function Ryan Geiss
// https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch01.html
vec3 tex3D(sampler2D t, in vec3 p, in vec3 n ){
    n = max(abs(n), 0.001);
    n /= dot(n, vec3(1));
	vec3 tx = texture(t, p.yz).xyz;
    vec3 ty = texture(t, p.zx).xyz;
    vec3 tz = texture(t, p.xy).xyz;
    return (tx*tx*n.x + ty*ty*n.y + tz*tz*n.z);
}

vec3 get_hue(float rnd) {
    return .5 + .46*cos(2.23*rnd + vec3(2.15, 1.25, 1.5));
}

vec3 get_color(float m, in vec3 p, in vec3 n) {
    vec3 h = vec3(.15);
    float rnd = hash2(hextiles.zw*2.);
    vec3 hue = get_hue(2.23*rnd);
    vec3 tone = get_hue(3.25);
    float tn = tex3D(iChannel2,hitPoint*2.,n).r;
    float tx = tex3D(iChannel1,hitPoint*4.,n).g;
    if(m==1.) {
        h = vec3(.06);
        float hex = abs(max(abs(hextiles.x)*.8660254 + abs(hextiles.y)*.5, abs(hextiles.y)) - .5) - .01;
        float rnd = hash2(hextiles.zw*2.);
        
        float vt = (sin(3.*rnd+T*.75)*.05+.07);
        hex=abs(abs(hex)-.03-vt)-.001;

        // see hex tiles
        h = mix(h*tx, tone, 1.-S(.01, .012, hex));
        float cir = length(abs(hextiles.xy)-.01)-.15;
        float cir2 = length(abs(hextiles.xy)-.01)-.16;

        //mixdown
        
        h= mix(h,vec3(1),1.-S(.01,.011,cir2));
        h= mix(h,tone*tn,1.-S(.01,.011,cir));
        //h*=tex3D(iChannel1,hitPoint*4.,n).ggg;
    }
    if(m==2.) {
        vec2 qp = hextiles.xy;
        float dir = tRnd <.5 ? -1. : 1.;
        if(tRnd>.5) qp *= r2(60.*PI/180.); 
        //@Shane moving stripes
        //using hex coords generated in map
        //with lazy global var
        vec3 d3, a3;
        vec2 p0 = qp - vec2(-.5/1.732, .5);
        vec2 p1 = qp - vec2(.8660254*2./3., 0);
        vec2 p2 = qp - vec2(-.5/1.732, -.5);
		//could prob pack both into one but
        //first time and all
        d3 = vec3(length(p0), length(p1), length(p2));
        d3 = abs(d3 - 1.732/6.) - .125;
			
        a3.x = atan(p0.x, p0.y);
        a3.y = atan(p1.x, p1.y);
        a3.z = atan(p2.x, p2.y);
		// get closest
        vec2 da = d3.x<d3.y && d3.x<d3.z? vec2(d3.x, a3.x) : d3.y<d3.z? vec2(d3.y, a3.y) : vec2(d3.z, a3.z);
        float d = da.x;
        float a = abs(fract(da.y/6.2831*6. + T*dir) - .5)*2. - .5;
       // a = max(d + .08, a/6.2831);   
        h = mix(vec3(.05,.15,0.15), vec3(.1,.3,.3)*tx, 1. - smoothstep(0.01, .02, a));   
    }
    if(m==3.) {
     	float rnd = hash2(hextiles.zw*1.5); 
        h = .5 + .46*cos(2.23*rnd + vec3(2.15, 1.25, 1.5)); 
    }
	if(m==4.) h *= tn;
    return h;
}

// ACES tone mapping from HDR to LDR
// https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 ACESFilm(vec3 x) {
    float a = 2.51,
          b = 0.03,
          c = 2.43,
          d = 0.59,
          e = 0.14;
    return clamp((x*(a*x + b)) / (x*(c*x + d) + e), 0.0, 1.0);
}

void mainImage( out vec4 O, in vec2 F ) {
    vec2 U = (2.*F.xy-R.xy)/max(R.x,R.y);
    vec3 ro = vec3(0.,1.+.5+.5*sin(T*.2),1.6),
         lp = vec3(0.,.4,.0);
             
	// uncomment to look around
    // ro = get_mouse(ro);
    vec3 cf = normalize(lp-ro),
     	 cp = vec3(0.,1.,0.),
     	 cr = normalize(cross(cp, cf)),
     	 cu = normalize(cross(cf, cr)),
     	 c = ro + cf * .75,
     	 i = c + U.x * cr + U.y * cu,
     	 rd = i-ro;

    vec3 C = vec3(0.);
	// trace dat map
    vec4 ray = ray_march(ro,rd,256);
    float t = ray.x;
	float m = ray.y;

    if(t<MAX_DIST) {
		vec3 p = ro + t * rd,
             n = get_normal(p, t),
             h = get_color(m,p,n);
        vec3 lpos1 = vec3(.5, 15.0, -.5),
             lpos2 = vec3(1.75,11.,6.5),
             diff =  vec3(1.) * get_diff(p, lpos1, n) + get_diff(p, lpos1, n);

        C += h * (diff);
        
        if(m!=1.){
         	vec3 rr = reflect(rd,n);   
         	vec4 ref = ray_march(p,rr,256);
            float j =ref.x;
            if(j<MAX_DIST) {
                p+=j*rr;
                n = get_normal(p,j);
                h = get_color(ref.y,p,n);
                diff =  vec3(1.) * get_diff(p, lpos1, n) + get_diff(p, lpos1, n);
                C += h * (diff);
                C = mix( C, vec3(.125), 1.-exp(-.005*j*j*j));
            }
        }
        
    } else {
      C += vec3(.025);
    }
    
    C = mix( C, vec3(.125), 1.-exp(-.005*t*t*t));
	C = ACESFilm(C);
    O = vec4(pow(C, vec3(0.4545)),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'WlByW3';
  }
  name(): string {
    return 'HexTile Truchet Marching';
  }
  sort() {
    return 167;
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
      {
        ...webglUtils.DEFAULT_NOISE3,
        ...webglUtils.TEXTURE_MIPMAPS,
      },
      { ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS },
    ];
  }
}
