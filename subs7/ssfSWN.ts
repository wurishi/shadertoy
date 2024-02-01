import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define NOISE_THRESHOLD 1.0
#define comp(a, b, c) (v[a].c > v[b].c)
#define swap(a, b, c) temp = v[b].c; v[b].c = v[a].c; v[a].c = temp;
#define cmpswap(x, y) if (comp(x, y, r)){ swap(x, y, r)}; if (comp(x, y, g)){ swap(x, y, g)}; if (comp(x, y, b)){ swap(x, y, b)};

vec3 medianSub(in vec3[9] v){
    float temp;  
        
    cmpswap(0, 1); 
    cmpswap(3, 4); 
    cmpswap(6, 7); 
    
    cmpswap(1, 2); 
    cmpswap(4, 5); 
    cmpswap(7, 8); 
    
    cmpswap(0, 1); 
    cmpswap(3, 4); 
    cmpswap(6, 7); 
    cmpswap(2, 5); 
    
    cmpswap(0, 3); 
    cmpswap(1, 4); 
    cmpswap(5, 8); 
    
    cmpswap(3, 6); 
    cmpswap(4, 7); 
    cmpswap(2, 5); 
    
    cmpswap(0, 3); 
    cmpswap(1, 4); 
    cmpswap(5, 7); 
    cmpswap(2, 6); 
    
    cmpswap(1, 3); 
    cmpswap(4, 6); 
    
    cmpswap(2, 4); 
    cmpswap(5, 6); 
    
    cmpswap(2, 3); 
    
    return (v[4]);
}



#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + e))

#define AO(a) smoothstep(0.,1.,map(p+n*a).x/a)

#define pi acos(-1.)
vec3 ACESFilm(vec3 x)
{
    float a = 2.51f;
    float b = 0.03f;
    float c = 2.43f;
    float d = 0.59f;
    float e = 0.14f;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);
}
/*
vec4 getNormala(vec4 p){
    vec2 t = vec2(0.0004,0.00);
    return normalize(vec4(
        map(p+t.xyyy).x - map(p-t.xyyy).x,
        map(p+t.yxyy).x - map(p-t.yxyy).x,
        map(p+t.yyxy).x - map(p-t.yyxy).x,
        map(p+t.yyyx).x - map(p-t.yyyx).x));
}
*/
float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}


float sdBox(vec4 p, vec4 s){p = abs(p) - s; return max(p.x,max(p.y,max(p.z,p.w)));}


float sdBoxEdges(vec4 p, vec4 s, float edgeW){
    float d = sdBox(p, s);
    
    float cuttingEdgeW = edgeW*1.;
    //d = abs(d);
    d = max(d, -sdBox(p, s - vec4(-cuttingEdgeW,edgeW,edgeW,edgeW)));
    d = max(d, -sdBox(p, s - vec4(edgeW,-cuttingEdgeW,edgeW,edgeW)));
    d = max(d, -sdBox(p, s - vec4(edgeW,edgeW,-cuttingEdgeW,edgeW)));
    d = max(d, -sdBox(p, s - vec4(edgeW,edgeW,edgeW,-cuttingEdgeW)));
    
    
    return d;
}


#define max4v(v) max(max(v.x, v.y), max(v.z, v.w))
#define min4(x,y,z,w) min(min(x, y), min(z, w))


#define dmin(d,b) d.x < b ? d : vec2(b,d.y + 1.)
float sdTesseractFrame( vec4 p, vec4 b, float e ) { 
  p = abs(p)-b; 
  vec4 q = abs(p+e)-e; 
  mat4 t = mat4(
        p.x, q.y, q.z, q.w,
        q.x, p.y, q.z, q.w,
        q.x, q.y, p.z, q.w,
        q.x, q.y, q.z, p.w
  );
  return min4(
        length(max(t[0], 0.0)+min(max4v(t[0]),0.0)),
        length(max(t[1], 0.0)+min(max4v(t[1]),0.0)),
        length(max(t[2], 0.0)+min(max4v(t[2]),0.0)),
        length(max(t[3], 0.0)+min(max4v(t[3]),0.0))
  );
}

#define pmod(p,a) (mod(p - 0.5*a,a) - 0.5*a)
`;

const fragment = `
// Fork of "Day 486[4d projected fractal]" by jeyko. https://shadertoy.com/view/7dXXD4
// 2021-04-17 06:41:35

// Fork of "Day 485[4d projected apollonian]" by jeyko. https://shadertoy.com/view/fdXSD4
// 2021-04-17 05:50:39

// My bro Nameless explained 4d projection/rendering to me,
// so I needed to render fractals in it. fun stuff.

// here follows my interpretation of his explanation

// 2d creatures see a line
// 3d creatures see a 2d array, projected by cam z
// 4d creatrues see a 3d grid, projected by cam w


// what i've done here is construct a 3d grid of 2d slices.
// each slice is a full raymarch into 4d space, projected by the w
// this just means that instead of doing
// rd = normalize(vec3(uv,1));
// we do
// rd = normalize(vec3(uv,sliceIdx/sliceCnt,1));d
// that's really about all there is to it. in the end we project the 3d grid isometrically to our 2d shadertoy screen.

// this code is probably not a good learning resource though.



// Performance vars

float sliceCnt = 128.;
float marchSteps = 30.;
float dMult = 1.;


// Coeff vars

float rotSpd = 0.5;
float fov4D = 0.4;     // scale up the sliceZDepth when widening the fov
float sliceZDepth = 1.; 
float minT = 10e5;

float normalEps = 0.01;
float distEps = 0.001;
float distOffs = 0.;

float ditherAmt = 1.;

#define DEBUG 0
#define TUBES 1


vec2 sdMeng(vec4 p){
    float sc = 1.;
    vec2 d = vec2(10e5,0.);
    
    //p = pmod(p,4.);
    vec4 op = p;
    for(float i = 0.; i < 4.; i++){
        
        float dpp = dot(p,p); 
        p /= dpp; sc /= dpp;
        
        p = abs(p);
        //if(p.x > p.z) p.xz = p.zx;
        //if(p.y > p.z) p.yz = p.zy;
        //if(p.w > p.y) p.yw = p.wy;
        
        //if(p.x > p.w) p.xw = p.wx;
        //if(p.x > p.y) p.xy = p.yx;
        
        
        //if(i == 2.)
        //p = pmod(p,vec4(3.5));
        
        p -= vec4(0.5,0.3,0.5,0.1)*.41;
        p.wx *= rot(0.4 + iTime*0.1 );
        p.wy *= rot(0.5*pi );
        //p.xy *= rot(-0.4*pi);
        
        const float scMult = 1.4;
        p *= scMult; sc *= scMult;
        
     
    }
    p /= sc;
    
    //d = dmin(d,ld(p.zxw) - 0.001 );
    //d = dmin(d,length(p.y) - 0.00 );
    
    //d = dmin(d,sdBox(p,vec4(0.06)));
    d = dmin(d,sdBox(p,vec4(0.01,0.01,0.01,.83)) - 0.0 );
    d = dmin(d,sdBox(p,vec4(0.01,0.01,.61,.02)) - 0.0 );
    
    return d;
}

vec2 map(vec4 p){
    
    
    p -= vec4(0.3,0.,1.,1.5);
    //p.x += sin(iTime*0.5)*0.4;
    
    //p.wz *= rot(1.4);
    //p.yw *= rot( -iTime*0.4);
    
    p.xw *= rot( iTime*1.5*rotSpd);
    p.wz *= rot( -iTime*1.7*rotSpd );
    
    p.yw *= rot( iTime*1.5*rotSpd);
    
    p.yx *= rot( iTime*.5*rotSpd);
    
    //p.xz *= rot( iTime*0.7 *rotSpd);
    
    //p += 0.2 ;
    
    //p -= 0.5 ;
    
    //p.yw *= rot( -iTime*0.15);

    //vec2 d = sdApollonian(p);
    vec2 d = sdMeng(p);
      
     
    return d;
}

vec4 getNormal(vec4 p){
    vec2 t = vec2(normalEps,0.00);
    return normalize(map(p).x-vec4(
        map(p-t.xyyy).x,
        map(p-t.yxyy).x,
        map(p-t.yyxy).x,
        map(p-t.yyyx).x));
}

// suggested from tdhooper. Thanks!
// improve compilation time & overall fps.
const int NORMAL_STEPS = 8;
vec4 getNormala(vec4 pos) {

    vec4 eps = vec4(normalEps*1., 0, 0,0.);
	
	vec4 nor = vec4(0);
	float invert = 1.;
	for (int i = 0; i < NORMAL_STEPS; i++) {
		nor += map(pos + eps * invert).x * eps * invert;
		eps = eps.wxyz;
		invert *= -1.;
	}
	return normalize(nor);
}

float rnd(vec2 uv) {
  return fract(dot(sin(uv*vec2(172.412,735.124)+uv.yx*vec2(97.354,421.653)+vec2(94.321,37.365)),vec2(4.6872,7.9841))+0.71243);
}

vec2 halton (int index)
{
    const vec2 coprimes = vec2(2.0f, 3.0f);
    vec2 s = vec2(index, index);
	vec4 a = vec4(1,1,0,0);
    while (s.x > 0. && s.y > 0.)
    {
        a.xy = a.xy/coprimes;
        a.zw += a.xy*mod(s, coprimes);
        s = floor(s/coprimes);
    }
    return a.zw;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec2 muv = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;
    muv *= 6.28;

    vec3 col = vec3(0);


    #if DEBUG
    
        vec3 gro = vec3(sin(muv.x),0,cos(muv.x))*sliceZDepth*1.5;
        vec3 grd = normalize(vec3(uv,1));

        gro.yz *= rot(-muv.y);
        grd.yz *= rot(-muv.y);
        grd.xz *= rot(-muv.x);

    #endif
    
    
    bool hitAtLeastOnce = false;
    float dither = texture(iChannel1, fragCoord / 1024.0f).r*ditherAmt*2. - 0.5*ditherAmt;
    
    
    const vec3 fogCol = vec3(0.6,0.6,0.56)*4.;

    col = fogCol;
    for(float slice = 0.; slice < sliceCnt; slice++){
          
        #if DEBUG
            vec3 sliceUv = gro + grd * plaIntersect( gro + vec3(0,0,1)*slice/sliceCnt*1.*sliceZDepth , grd, vec4(0,0,-1,0) );
        #else
            vec2 sliceUv = uv;
        #endif
        
        
        vec4 rd = normalize(vec4(sliceUv.xy,sliceZDepth*((slice+(dither))/sliceCnt - 0.5),fov4D));
        
        vec4 p = vec4(0); 
       
        bool hit = false;
        vec2 d;
        float glow = 0.;
        float t = 0.;
       
    
        for(float st = 0.; st < marchSteps; st++){
            d = map(p);
            d.x += distOffs;
            if(d.x < distEps){
                hit = true;
                break;
            } else if (t > 3.5){
                //t = 10.;
                break;
            }
            
            d.x *= dMult;
            t += d.x;
            p += rd*d.x;
        }
        

          
        if(hit && t < minT){
            minT = t;
            hitAtLeastOnce = true;
            vec4 n = getNormal(p); 
            
            col = (pal(0.5,0.5*vec3(1.,1.,1.),vec3(0.4,1.,1.5),1.,4.*dot(n,rd)));
            //col = pow(abs(col),vec3(1.8));
            col *= AO(.1)*AO(.01)*AO(.04)*AO(.08)*AO(.13);
            
            
            col = mix(col,fogCol,smoothstep(0.,1.,(t)*.66- 0.6));
            }
        else{
        }
        
    }
    
    // reinhardt and sutff
    col = 1./(1. + 1./col);
    
    //col = 0.5 - col*2.;
    //col = 1. - exp(-col*1.);
    col = ACESFilm(col);
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'ssfSWN';
    }
    name(): string {
        return 'Day 486[4d kaliset]';
    }
    sort() {
        return 764;
    }
    common() {
        return common;
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
    webgl() {
        return WEBGL_2;
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {};
    }
    channels() {
        return [webglUtils.DEFAULT_NOISE, webglUtils.DEFAULT_NOISE];
    }
}
