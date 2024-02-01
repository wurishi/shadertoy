import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + e))

#define AO(a) smoothstep(0.,1.,map(p+n*a).x/a)
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
// My bro Nameless explained 4d projection/rendering to me,
// so I needed to render an apollonian in it. fun stuff.

// here follows my interpretation of his explanation

// 2d creatures see a line
// 3d creatures see a 2d array, projected by cam z
// 4d creatrues see a 3d grid, projected by cam w


// what i've done here is construct a 3d grid of 2d slices.
// each slice is a full raymarch into 4d space, projected by the w
// this just means that instead of doing
// rd = normalize(vec3(uv,1));
// we do
// rd = normalize(vec3(uv,sliceIdx/sliceCnt,1));
// that's really about all there is to it. in the end we project the 3d grid perspectively to our 2d shadertoy screen.

// this code is probably not a good learning resource though.



// Performance vars

float sliceCnt = 60.;
float marchSteps = 30.;
float dMult = 0.4;


// Coeff vars

float rotSpd = 0.5;
float fov4D = 0.5;     // scale up the sliceZDepth when widening the fov
float sliceZDepth = 1.; 
float minT = 10e5;

float normalEps = 0.02;
float distEps = 0.01;
float distOffs = -0.01;

float ditherAmt = 1.;

#define DEBUG 0
#define TUBES 1


float ld(vec3 p){

    #if TUBES
        return length(p);
    #else
        return max(abs(p.x),max(abs(p.y),abs(p.z)));
    #endif
}
float ld(vec2 p){
    #if TUBES
        return length(p);
    #else
        return max(abs(p.x),abs(p.y));
    #endif
}
float ld(float p){
    return p;
}
vec2 sdApollonian(vec4 p){
    vec2 d = vec2(10e5,0.);
    
    float sc = 1.;
    
    for(float i = 0.; i < 4.; i++){
        //p = abs(p);
        p = pmod(p,vec4(1.5 + 0.5*iMouse.y/iResolution.y));
        
        float dpp = dot(p,p );
        p /= dpp; sc /=dpp;
        
     
    }
    p /= sc;

    d = dmin(d,ld(p.zxw) - 0.001 );
    //d = dmin(d,length(p.y) - 0.00 );
    
    d = dmin(d,ld(length(p)) - 0.001 );
    
    return d;
}

vec2 map(vec4 p){
    
    
    p -= 0.5 ;
    p.x += sin(iTime*0.5)*0.;
    
    //p.wz *= rot(1.4);
    //p.yw *= rot( -iTime*0.4);
    
    p.xw *= rot( iTime*0.5*rotSpd);
    p.wz *= rot( iTime*0.7*rotSpd );
    
    p.yw *= rot( iTime*0.5*rotSpd);
    p.xz *= rot( iTime*0.7 *rotSpd);
    
    //p += 0.2 ;
    
    //p -= 0.5 ;
    
    //p.yw *= rot( -iTime*0.15);

    vec2 d = sdApollonian(p);
     
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

float rnd(vec2 uv) {
  return fract(dot(sin(uv*vec2(172.412,735.124)+uv.yx*vec2(97.354,421.653)+vec2(94.321,37.365)),vec2(4.6872,7.9841))+0.71243);
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
        
    for(float slice = 0.; slice < sliceCnt; slice++){
          
        #if DEBUG
            vec3 sliceUv = gro + grd * plaIntersect( gro + vec3(0,0,1)*slice/sliceCnt*1.*sliceZDepth , grd, vec4(0,0,-1,0) );
        #else
            vec2 sliceUv = uv*(1. + slice/sliceCnt);
        #endif
        
        
        vec4 rd = normalize(vec4(sliceUv.xy,sliceZDepth*((slice + dither)/sliceCnt - 0.5),fov4D));
        
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
        

          
        const vec3 fogCol = vec3(0.6,0.6,0.56)*1.;
        if(hit && t < minT){
            minT = t;
            hitAtLeastOnce = true;
            vec4 n = getNormal(p); 
            
            col = (pal(0.5,0.5*vec3(1.+ sin( p.w*6.)*0.,1.,1.),vec3(0.4,1.,1.5),1.,4.*dot(n,rd)));
            col = pow(abs(col),vec3(1.8));
            col *= AO(1.)*AO(0.3)*AO(0.1)*AO(0.05);
            
            
            col = mix(col,fogCol,smoothstep(0.,1.,(t)*.46- 0.6));
            }
        else{
            if(!hitAtLeastOnce)
                col = fogCol;
        }
        
    }
    
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
        return 'fdXSD4';
    }
    name(): string {
        return 'Day 485[4d projected apollonian]';
    }
    sort() {
        return 766;
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
