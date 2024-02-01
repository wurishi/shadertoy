import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

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


void refl(inout vec4 p, vec4 reflectionPlane, float offs){

    reflectionPlane = normalize(reflectionPlane);
    float dotReflectionPlane = dot(p + reflectionPlane*offs,reflectionPlane);
    dotReflectionPlane = max(abs(dotReflectionPlane),0.)*sign(dotReflectionPlane);
    p -= min(dotReflectionPlane,0.)*2.*reflectionPlane;
}
float hypercubeLattice(inout vec4 p){
float sz = 0.4;
    for(float i = 0.; i < 2.; i++){
       p = abs(p);
       refl(p,-vec4(0.,1.,0.,0.),sz);
       refl(p,-vec4(1.,0.,0.,0.),sz);
       refl(p,-vec4(0.,0.,1.,0.),sz);
       refl(p,-vec4(0.,0.,0.,1.),sz);
       
    
    }
    
    
    //d.x = length(p) - 0.1;
    
    vec2 d;
    d.x = length(p.xzy);
    
    d.x = min(d.x,length(p.xzw));
    
    d.x = min(d.x,length(p.yzw));
    
    d.x = min(d.x,length(p.yxw));
    
    d.x = min(d.x,length(p) - 0.03);
    return d.x;

}

float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}


float sdBox(vec4 p, vec4 s){p = abs(p) - s; return max(p.x,max(p.y,max(p.z,p.w)));}


float sdBoxEdges(vec4 p, vec4 s, float edgeW){
    float d = sdBox(p, s);
    
    vec2 e = vec2(edgeW,0.);
    d = abs(d) - edgeW*0.1;
    edgeW *= 1.5;
    vec4 q = p;
    /*
    q.x = abs(q.x);
    d = max(d, -sdBox(q- vec4(s.x,0,0,0), vec4(edgeW,s.y,s.z,s.w) - e.yxxx));
    q = p;
    q.y = abs(q.y);
    d = max(d, -sdBox(q- vec4(0,s.y,0,0), vec4(s.x,edgeW,s.z,s.w) - e.xyxx));
    q = p;
    q.z = abs(q.z);
    d = max(d, -sdBox(q- vec4(0,0,s.z,0), vec4(s.x,s.y,edgeW,s.w) - e.xxyx));
    q = p;
    q.w = abs(q.w);
    d = max(d, -sdBox(q- vec4(0,0,0,s.w), vec4(s.x,s.y,s.z,edgeW) - e.xxxy));
    */
    
    //d = max(d,-length(q.xyz) );
    //d = max(d, -sdBox(p, s - vec4(edgeW,-cuttingEdgeW,edgeW,edgeW)));
    //d = max(d, -sdBox(p, s - vec4(edgeW,edgeW,-cuttingEdgeW,edgeW)));
    //d = max(d, -sdBox(p, s - vec4(edgeW,edgeW,edgeW,-cuttingEdgeW)));
    
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
// Failed attempt at doing 16-cell reflections
// thought it looked fun tho


// Fork of "Day 486[4d projected fractal]" by jeyko. https://shadertoy.com/view/7dXXD4
// 2021-04-17 09:42:03

// Fork of "Day 485[4d projected apollonian]" by jeyko. https://shadertoy.com/view/fdXSD4
// 2021-04-17 05:50:39

// Performance vars

float sliceCnt = 80.;
float marchSteps = 30.;
float dMult = 1.;


// Coeff vars

float rotSpd = .3;
float fov4D = 0.4;     // scale up the sliceZDepth when widening the fov
float sliceZDepth = 2.5; 
float minT = 10e5;

float normalEps = 0.01;
float distEps = 0.001;
float distOffs = 0.;

float ditherAmt = 0.5;

#define DEBUG 0
#define TUBES 1
vec4 C;
vec2 muv;



float lattice16Cell(inout vec4 p){
    
    float dpp = dot(p,p);
    dpp = 1.;
    
    //p.w = -p.w;
    p /= dpp;
    
    
    float sz =0.4;
    for(float i = 0.; i < 3.; i++){
       p = abs(p);
       vec4 r = -normalize(vec4(1.,1,1,1));
       
       /*
           r = vec4(0,1,0,0);
           r.xy *= rot(-pi/4.);
           r.zx *= rot(-pi/4.);
           r.yw *= rot(pi/4.);
           r = -r;
       */
       refl(p,r,sz);
    }
    
    
    //d.x = length(p) - 0.1;
    
    vec2 d = vec2(10e5);;
    
    #if 1
        d.x = length(p.xzy);
        d.x = min(d.x,length(p.xzw));
        d.x = min(d.x,length(p.yzw)); 
        d.x = min(d.x,length(p.yxw));
    #endif
    
    d.x = min(d.x,length(p) - 0.05);
    return d.x*dpp;

}



vec2 map(vec4 p){
    p -= vec4(.0,.0,.5,.5);
    vec2 d;
    vec4 orbit;
    
        p.yw *= rot( iTime*0.2*rotSpd );
        p.yx *= rot( iTime*0.1*rotSpd );
        p -= 0.2;

        p.yz *= rot( iTime*1.3*rotSpd );
        p.zw *= rot( iTime*1.*rotSpd );

        p.xw *= rot( iTime*0.5*rotSpd );
    
    
    //d.x = sdBoxEdges(p, vec4(0.4), 0.005);
    //d.x =  sdTesseractFrame(  p, vec4(0.4), 0.01 );
    
    
    d.x = lattice16Cell(p);
    vec2 a;
    //d.x = fTorus(p, a);

    
    d.x -= 0.01;
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


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    C = 0.45*cos( vec4(0.5,3.9,1.4,1.1) + 0.15*iTime*vec4(1.2,1.7,1.3,2.5) ) - vec4(0.3,0.0,0.0,0.0);

    muv = (iMouse.xy - 0.5*iResolution.xy)/iResolution.y;
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
    float dither = texture(iChannel1,(fragCoord)/1024.).x*2. - 1.;
        
    const vec3 fogCol = vec3(0.6,0.6,0.56)*1.;
        
    for(float slice = 0.; slice < sliceCnt; slice++){
          
        #if DEBUG
            vec3 sliceUv = gro + grd * plaIntersect( gro + vec3(0,0,1)*slice/sliceCnt*1.*sliceZDepth , grd, vec4(0,0,-1,0) );
        #else
            vec2 sliceUv = uv*(1. +  slice/sliceCnt);
        #endif
        
        
        vec4 rd = normalize(vec4(sliceUv.xy,sliceZDepth*((slice + dither*ditherAmt)/sliceCnt - 0.5),fov4D));
        
        vec4 p = vec4(0.); 
       
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
            } else if (t > 4.5){
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
            
            col = (pal(0.5,0.5*vec3(1.+ sin( p.w*6.)*0.,1.,1.),vec3(0.4,1.,1.5),1.,4.*dot(n,rd)));
            //col = pow(abs(col),vec3(1.8));
            //col *= AO(.1)*AO(.01)*AO(.04)*AO(.08)*AO(.13);
            
            col *= AO(.1)*AO(1.01)*2.;
            
            
            col = mix(col,fogCol,smoothstep(0.,1.,(t)*.56- 0.5));
            //col = mix(col,fogCol,0.7-exp(-t));
            
            }
        
        
    }

    if(!hitAtLeastOnce)
        col = fogCol;
    // reinhardt and sutff
    col = 1./(1. + 1./col);
    //col = 1. - exp(-col*1.);
    col = ACESFilm(col);
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return '7ssSD4';
    }
    name(): string {
        return 'Not a 16-cell honeycomb';
    }
    sort() {
        return 763;
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
    common() {
        return common;
    }
    webgl() {
        return WEBGL_2;
    }
    fragmentPrecision?(): string {
        return PRECISION_MEDIUMP;
    }
    destory(): void {}
    initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
        return () => {};
    }
    channels() {
        return [webglUtils.DEFAULT_NOISE, webglUtils.DEFAULT_NOISE];
    }
}
